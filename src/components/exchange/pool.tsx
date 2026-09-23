import { Badge, Box, Button, Card, Dialog, Flex, Slider, Text, TextField, Tooltip } from "@radix-ui/themes";
import { AssetId, ByteUtil, Chain, LiquidityPool } from "tangentsdk/algorithm";
import { TextUtil } from "tangentsdk/text";
import { UiUtil } from "tangentsdk/ui";
import { Assetlist } from "tangentsdk/assetlist";
import { Pool, Exchange, Balance, PseudoDelegatedPool, DelegatedPool } from "../../core/exchange";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertBox, AlertType } from "../alert";
import { mdiArrowRight, mdiBankPlus, mdiCurrencyUsd, mdiLayers, mdiOpenInNew, mdiWallet } from "@mdi/js";
import { AssetImage } from "../asset-image";
import { PerformerButton, Builder, BuilderResult } from "./performer";
import { defaultMakerState } from "./maker";
import { AppData } from "../../core/app";
import { AppStorage } from "../../core/storage";
import { pathOfMaker } from "../../pages/exchange/orderbook";
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";

const DLP_DEFAULT_FEE_RATE_MAYBE = 0.0005;


export function PoolView(props: { item: Pool, open?: boolean, flash?: boolean, readOnly?: boolean }) {
  const item = props.item;
  const concentrated = item.minPrice?.gt(0) && item.maxPrice?.gt(0);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(props.open || false);
  const [rebalancer, setRebalancer] = useState<'cross' | 'isolated'>('cross');
  const bidPrice = useMemo(() => item.price.multipliedBy(new BigNumber(1).minus(item.feeRate)), [item.price, item.feeRate]);
  const askPrice = useMemo(() => item.price.multipliedBy(new BigNumber(1).plus(item.feeRate)), [item.price, item.feeRate]);
  const inLowerRange = useMemo(() => concentrated ? bidPrice.gte(item.minPrice || 0) : true, [bidPrice]);
  const inUpperRange = useMemo(() => concentrated ? askPrice.lte(item.maxPrice || 0) : true, [askPrice]);
  const state = useMemo(() => {
    const primaryPrice = Exchange.priceOf(item.primaryAsset), secondaryPrice = Exchange.priceOf(item.secondaryAsset);
    const isolatedLiquidity = item.primaryValue.multipliedBy(primaryPrice.close || new BigNumber(0)).plus(item.secondaryValue.multipliedBy(secondaryPrice.close || new BigNumber(0)));
    const revenueLiquidity = item.primaryRevenue.multipliedBy(primaryPrice.close || new BigNumber(0)).plus(item.secondaryRevenue.multipliedBy(secondaryPrice.close || new BigNumber(0)));
    let staleness: { score: number, dev: number } | null = null;
    if (item.active && item.price) {
      const marketPrice = Exchange.priceOf(item.primaryAsset, item.secondaryAsset);
      const deviation = marketPrice.close != null && (!item.minPrice || item.minPrice.lte(marketPrice.close)) && (!item.maxPrice || item.maxPrice.gte(marketPrice.close));
      const delta = deviation ? (marketPrice as any).close.minus(item.price).dividedBy(item.price).abs().toNumber() : (marketPrice.close ? 1 : 0);
      const score = 100 * delta / item.feeRate.plus(0.01).toNumber();
      staleness = { score: score, dev: delta };
    }
    return {
      absoluteRevenue: revenueLiquidity,
      relativeRevenue: isolatedLiquidity.gt(0) ? revenueLiquidity.dividedBy(isolatedLiquidity) : new BigNumber(0),
      liquidity: isolatedLiquidity.plus(revenueLiquidity),
      staleness: staleness
    }
  }, [item]);
  const rebalance = useCallback(async (cross: boolean): Promise<BuilderResult[]> => {
    const price = Exchange.priceOf(item.primaryAsset, item.secondaryAsset).close;
    if (!price)
      throw new Error('Failed to re-balance the pool because no market price found');
    
    let minPrice: BigNumber | null = item.minPrice && item.minPrice.isFinite() ? item.minPrice : null;
    let maxPrice: BigNumber | null = item.maxPrice && item.maxPrice.isFinite() ? item.maxPrice : null;
    if (minPrice?.gt(0) && maxPrice?.gt(0)) {
      const range = maxPrice.minus(minPrice).dividedBy(2);
      minPrice = BigNumber.max(price.minus(range), 0);
      maxPrice = price.plus(range);
    }
    
    let crossPoly: { primary: AssetId[], secondary: AssetId[] } | null = null, crossBalances: Balance[] | null = null;
    let maxSecondaryValue = item.secondaryValue.plus(item.secondaryRevenue);
    let maxPrimaryValue = item.primaryValue.plus(item.primaryRevenue);
    let baseMaxSecondaryValue = maxSecondaryValue;
    let baseMaxPrimaryValue = maxPrimaryValue;
    if (cross) {
      try {
        const account = AppData.getWalletAddress();
        if (account != null) {
          const [poly, balances] = await Promise.all([Exchange.marketPairAssets(item.marketId, item.pairId), Exchange.accountBalances({ address: account })]);
          if (Array.isArray(balances)) {
            const primaryBalance = balances?.filter((v) => v.asset.id == item.primaryAsset.id || (poly?.primary ? poly.primary.findIndex((i) => i.id == v.asset.id) != -1 : false)).reduce((p, c) => p.plus(c.available), new BigNumber(0));
            const secondaryBalance = balances?.filter((v) => v.asset.id == item.secondaryAsset.id || (poly?.secondary ? poly.secondary.findIndex((i) => i.id == v.asset.id) != -1 : false)).reduce((p, c) => p.plus(c.available), new BigNumber(0));
            maxPrimaryValue = maxPrimaryValue.plus(primaryBalance);
            maxSecondaryValue = maxSecondaryValue.plus(secondaryBalance);
            crossBalances = balances;
            crossPoly = poly;
          }
        }
      } catch (exception) {
        AlertBox.open(AlertType.Error, 'Failed to fetch current balances: ' + (exception as Error)?.message || '')
      }
    }

    let secondaryValue = LiquidityPool.toSecondaryValue(maxPrimaryValue, price, minPrice, maxPrice);
    if (!secondaryValue)
      throw new Error('Failed to re-balance the pool because of insufficient primary reserve');

    let primaryValue: BigNumber | null = maxPrimaryValue;
    if (secondaryValue.gt(maxSecondaryValue)) {
      secondaryValue = maxSecondaryValue;
      primaryValue = LiquidityPool.toPrimaryValue(maxSecondaryValue, price, minPrice, maxPrice);
      if (!primaryValue)
        throw new Error('Failed to re-balance the pool because of insufficient secondary reserve');
    }

    let primaryPays: Record<string, string> = { };
    let secondaryPays: Record<string, string> = { };
    if (crossPoly && crossBalances) {
      baseMaxPrimaryValue = BigNumber.min(baseMaxPrimaryValue, primaryValue);
      primaryPays = Exchange.toPayment(new BigNumber(primaryValue.minus(baseMaxPrimaryValue)), crossBalances.filter((v) => v.asset.id == item.primaryAsset.id || (crossPoly ? crossPoly.primary.findIndex((i) => i.id == v.asset.id) != -1 : false)));
      primaryPays[item.primaryAsset.id] = ByteUtil.bigNumberToString(primaryPays[item.primaryAsset.id] ? baseMaxPrimaryValue.plus(new BigNumber(primaryPays[item.primaryAsset.id])) : baseMaxPrimaryValue);
      baseMaxSecondaryValue = BigNumber.min(baseMaxSecondaryValue, secondaryValue);
      secondaryPays = Exchange.toPayment(new BigNumber(secondaryValue.minus(baseMaxSecondaryValue)), crossBalances.filter((v) => v.asset.id == item.secondaryAsset.id || (crossPoly ? crossPoly.secondary.findIndex((i) => i.id == v.asset.id) != -1 : false)));
      secondaryPays[item.secondaryAsset.id] = ByteUtil.bigNumberToString(secondaryPays[item.secondaryAsset.id] ? baseMaxSecondaryValue.plus(new BigNumber(secondaryPays[item.secondaryAsset.id])) : baseMaxSecondaryValue);
    } else {
      primaryPays[item.primaryAsset.id] = ByteUtil.bigNumberToString(primaryValue);
      secondaryPays[item.secondaryAsset.id] = ByteUtil.bigNumberToString(secondaryValue);
    }
    return [
      await Builder.withdrawPool({ poolId: item.id.toString() }),
      await Builder.depositPool({
        marketId: item.marketId.toString(),
        primaryAssetHash: item.primaryAsset.id,
        secondaryAssetHash: item.secondaryAsset.id,
        primaryPays: primaryPays,
        secondaryPays: secondaryPays,
        price: ByteUtil.bigNumberToString(price),
        minPrice: minPrice ? ByteUtil.bigNumberToString(minPrice) : undefined,
        maxPrice: maxPrice ? ByteUtil.bigNumberToString(maxPrice) : undefined,
        feeRate: ByteUtil.bigNumberToString(item.feeRate)
      })
    ];
  }, [item]);

  const renderFullPool = (open?: boolean) => (
    <Collapsible.Root open={open || expanded}>
      <button type="button" className={ open ? undefined : 'card-expander' } onClick={ open ? undefined : () => setExpanded(!expanded) }>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ position: 'relative', width: 42, height: 42, flex: 'none' }}>
            <AssetImage asset={item.primaryAsset} size="2" iconSize="42px"></AssetImage>
            <AssetImage asset={item.secondaryAsset} size="1" iconSize="20px" style={{ position: 'absolute', bottom: -3, right: -3, border: '2px solid var(--card)', borderRadius: '50%' }}></AssetImage>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', textDecoration: item.active ? undefined : 'line-through' }}>
              { item.primaryAsset.token || item.primaryAsset.chain }x{ item.secondaryAsset.token || item.secondaryAsset.chain }
            </div>
            <div className="tiny dim" style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span className={ 'badge ' + (item.active ? 'warn' : 'flat') }>MANUAL</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Self-managed</span>
            </div>
          </div>
          <span className="usd" style={{ flex: 'none' }}>{ UiUtil.toMoney(Exchange.equityAsset, state.liquidity) }<span className="usd-sub">+{ (100 * (state.staleness?.dev || 0)).toFixed(1) }% dev</span></span>
        </div>
        { (() => {
          const primaryPrice = Exchange.priceOf(item.primaryAsset).close || new BigNumber(0);
          const total = item.primaryValue.multipliedBy(primaryPrice).plus(item.secondaryValue);
          const share = total.gt(0) ? item.primaryValue.multipliedBy(primaryPrice).multipliedBy(100).dividedBy(total).toNumber() : 0;
          return (
            <>
              <div className="progress"><i style={{ width: Math.min(100, Math.max(0, share)) + '%' }}></i></div>
              <div className="tiny dim num">{ share.toFixed(1) }% { item.primaryAsset.token || item.primaryAsset.chain } · { (100 - share).toFixed(1) }% { item.secondaryAsset.token || item.secondaryAsset.chain }</div>
            </>
          );
        })() }
      </button>
      {
        !props.readOnly && item.active &&
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PerformerButton className="btn-sm btn-ghost" title="Close" description="Close position — Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" variant="classic" color="gray" onBuild={() => {
              return Builder.withdrawPool({ poolId: item.id.toString() });
            }}></PerformerButton>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PerformerButton className="btn-sm btn-brand" title="Adjust" description={ rebalancer == 'cross' ? "Smart contract will re-balance this pool based on current market price, pool liquidity and available balance" : "Smart contract will re-balance this pool using only the assets allocated to it" } onBuild={() => rebalance(rebalancer == 'cross')}></PerformerButton>
          </div>
          <Tooltip content={ rebalancer == 'cross' ? 'Adjust takes free balances into account · switch to pool-only rebalance' : 'Adjust uses the pool allocation only · switch to rebalance with free balances' }>
            <button className="icon-btn icon-btn-lg" aria-label="Adjust rebalance mode" onClick={() => setRebalancer(rebalancer == 'cross' ? 'isolated' : 'cross')} style={ rebalancer == 'isolated' ? { background: 'var(--lime-dim)', color: 'var(--lime)' } : undefined }>
              <Icon path={ rebalancer == 'cross' ? mdiWallet : mdiLayers } size={0.65}></Icon>
            </button>
          </Tooltip>
        </div>
      }
      <Collapsible.Content>
        <div className="dl dl-rule" style={{ marginTop: 16 }}>
          <div className="dl-row"><span className="dl-k">Market account</span><span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(item.marketAccount || 'NULL');
            AlertBox.open(AlertType.Info, 'Address copied!')
          }}>{ UiUtil.toAddress(item.marketAccount || 'NULL') }</span>
          <Link className="dl-open router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet-total-assets'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
          <div className="dl-row"><span className="dl-k">Primary asset</span><span className="dl-v">{ Assetlist.toName(item.primaryAsset) }</span></div>
          <div className="dl-row"><span className="dl-k">Secondary asset</span><span className="dl-v">{ Assetlist.toName(item.secondaryAsset) }</span></div>
          <div className="dl-row"><span className="dl-k">Reference</span><span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(item.poolId.toString(16));
            AlertBox.open(AlertType.Info, 'Reference copied!')
          }}>0x{ item.poolId.toString(16).length > 8 ? UiUtil.toHash(item.poolId.toString(16), 6) : item.poolId.toString(16) }</span></span></div>
          <div className="dl-row"><span className="dl-k">Status</span><span className="dl-v"><Badge color={item.active ? (inLowerRange && inUpperRange ? undefined : 'yellow') : 'gray'}>{ item.active ? (inLowerRange && inUpperRange ? (concentrated ? 'Active (fully in range)' : 'Active') : 'Partially active (out of range)') : 'Inactive' }</Badge></span></div>
          <div className="dl-row"><span className="dl-k">Spread</span><span className="dl-v"><Flex wrap="wrap" gap="2" justify="end">
            { inLowerRange && <Badge>BID { UiUtil.toMoney(item.secondaryAsset, bidPrice) }</Badge> }
            { inUpperRange && <Badge color="red">ASK { UiUtil.toMoney(item.secondaryAsset, askPrice) }</Badge> }
          </Flex></span></div>
          {
            (item.primaryRevenue.gt(0) || item.secondaryRevenue.gt(0)) &&
            <div className="dl-row"><span className="dl-k">Fees</span><span className="dl-v"><Flex wrap="wrap" gap="2" justify="end">
              { item.primaryRevenue.gt(0) && <Badge>{ UiUtil.toMoney(item.primaryAsset, item.primaryRevenue) }</Badge> }
              { item.secondaryRevenue.gt(0) && <Badge>{ UiUtil.toMoney(item.secondaryAsset, item.secondaryRevenue) }</Badge> }
            </Flex></span></div>
          }
          <div className="dl-row"><span className="dl-k">Revenue</span><span className="dl-v"><Flex wrap="wrap" gap="2" justify="end">
            <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ UiUtil.toMoney(Exchange.equityAsset, state.absoluteRevenue, true) }</Badge>
            <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ state.relativeRevenue.gt(0) ? '+' : '' }{ state.relativeRevenue.multipliedBy(100).toFixed(2) }%</Badge>
          </Flex></span></div>
          <div className="dl-row"><span className="dl-k">Price</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, item.price) }</span></div>
          {
            concentrated &&
            <div className="dl-row"><span className="dl-k">Price range</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, item.minPrice || null) } — { UiUtil.toMoney(item.secondaryAsset, item.maxPrice || null) }</span></div>
          }
          <div className="dl-row"><span className="dl-k">{ UiUtil.toAssetSymbol(item.primaryAsset) } reserve</span><span className="dl-v">{ UiUtil.toMoney(item.primaryAsset, item.primaryValue) }</span></div>
          <div className="dl-row"><span className="dl-k">{ UiUtil.toAssetSymbol(item.secondaryAsset) } reserve</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, item.secondaryValue) }</span></div>
          <div className="dl-row"><span className="dl-k">Fee rate</span><span className="dl-v">{ item.feeRate.multipliedBy(100).toFixed(2) }%</span></div>
          <div className="dl-row"><span className="dl-k">Exit fee</span><span className="dl-v">{ item.exitFee.multipliedBy(100).toFixed(2) }%</span></div>
        </div>
        {
          !props.flash && props.readOnly && item.active &&
          <Flex justify="center" mt="3">
            <Button variant="soft" onClick={() => {
              const orderbook = Exchange.toOrderbookQuery(item.marketId, item.primaryAsset, item.secondaryAsset);
              const path = pathOfMaker(orderbook);
              AppStorage.set(path, {
                ...(AppStorage.get(path) || defaultMakerState),
                basePrice: ByteUtil.bigNumberToString(item.price),
                rangePrice: item.minPrice && item.maxPrice ? ByteUtil.bigNumberToString(item.maxPrice.minus(item.minPrice)) : '',
                feeRate: ByteUtil.bigNumberToString(item.feeRate.multipliedBy(100)) + '%',
                pool: true
              });
              navigate(`/orderbook/${orderbook}?tab=pool`);
            }}>
              Add liquidity using this LP
              <Icon path={mdiArrowRight} size={0.75}></Icon>
            </Button>
          </Flex>
        }
      </Collapsible.Content>
    </Collapsible.Root>
  );
  return (
    <Card variant="surface" style={{ padding: 16, position: "relative" }}>
      {
        props.flash &&
        <Box>
          <Dialog.Root>
            <Dialog.Trigger>
              <Button variant="surface" color="gray" style={{ display: 'block', width: '100%', height: 'auto', padding: '4px', backgroundColor: 'transparent', boxShadow: 'none' }}>
                <Flex direction="column" gap="2">
                  <Flex justify="between" wrap="wrap" gap="1" style={{ textDecoration: inLowerRange ? undefined : 'line-through', color: 'var(--gray-11)' }}>
                    <Text size="2" style={{ color: 'var(--accent-11)' }}>Buy at</Text>
                    <Text size="2" style={{ color: 'var(--accent-11)' }}>≤ { UiUtil.toMoney(item.secondaryAsset, bidPrice) }</Text>
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1" style={{ textDecoration: inUpperRange ? undefined : 'line-through', color: 'var(--gray-11)' }}>
                    <Text size="2" color="red">Sell at</Text>
                    <Text size="2" color="red">≥ { UiUtil.toMoney(item.secondaryAsset, askPrice) }</Text>
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1">
                    <Text size="2" color="gray">With</Text>
                    <Text size="2" style={{ color: 'var(--gray-12)' }}>{ UiUtil.toMoney(Exchange.equityAsset, state.liquidity) }</Text>
                  </Flex>
                </Flex>
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Pool #{item.poolId.toString().length > 8 ? UiUtil.toHash(item.poolId.toString(), 4) : item.poolId.toString()}</Dialog.Title>
              { renderFullPool(true) }
            </Dialog.Content>
          </Dialog.Root>
        </Box>
      }
      {
        !props.flash &&
        <Box>
          { renderFullPool() }
        </Box>
      }
    </Card>
  );
}

export function DelegatedPoolView(props: { item: DelegatedPool, assets: Balance[], readOnly?: boolean }) {
  const item = props.item;
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const assets = useMemo(() => ({
    primary: props.assets.find((v) => v.asset.id == item.primaryAsset.id)?.available || new BigNumber(0),
    secondary: props.assets.find((v) => v.asset.id == item.secondaryAsset.id)?.available || new BigNumber(0),
  }), [props.assets, item]);
  const [primaryReserve, setPrimaryReserve] = useState<string>('');
  const [secondaryReserve, setSecondaryReserve] = useState<string>('');
  const [expanded, setExpanded] = useState(false);
  const extra = useMemo(() => {
    const delegator = Exchange.delegators.find((v) => v.id.eq(item.delegatorId));
    return mode == 'withdraw' ? {
      primary: item.primaryValue,
      secondary: item.secondaryValue,
      delegator: delegator
    } : {
      primary: assets.primary,
      secondary: assets.secondary,
      delegator: delegator
    };
  }, [item, assets, mode]);
  const slider = useMemo(() => {
    const primaryValue = new BigNumber(primaryReserve || '0');
    const secondaryValue = new BigNumber(secondaryReserve || '0');
    return {
      primary: { overpulling: mode == 'withdraw' ? item.primaryTotal.minus(item.primaryReserve).minus(primaryValue).lt(0) : false, value: [extra.primary.gt(0) ? primaryValue.multipliedBy(100).dividedBy(extra.primary).toNumber() : 0] },
      secondary: { overpulling: mode == 'withdraw' ? item.secondaryTotal.minus(item.secondaryReserve).minus(secondaryValue).lt(0) : false, value: [extra.secondary.gt(0) ? secondaryValue.multipliedBy(100).dividedBy(extra.secondary).toNumber() : 0] }
    };
  }, [extra, mode, item, primaryReserve, secondaryReserve]);
  const state = useMemo(() => {
    const primaryPrice = Exchange.priceOf(item.primaryAsset), secondaryPrice = Exchange.priceOf(item.secondaryAsset);
    const initialLiquidity = item.initialPrimaryValue.multipliedBy(item.allocationPrice ? item.allocationPrice.multipliedBy(secondaryPrice.close || new BigNumber(0)) : primaryPrice.close || new BigNumber(0)).plus(item.initialSecondaryValue.multipliedBy(secondaryPrice.close || new BigNumber(0)));
    const currentLiquidity = item.primaryValue.multipliedBy(primaryPrice.close || new BigNumber(0)).plus(item.secondaryValue.multipliedBy(secondaryPrice.close || new BigNumber(0)));
    const revenueLiquidity = currentLiquidity.minus(initialLiquidity);
    return {
      absoluteRevenue: revenueLiquidity,
      relativeRevenue: initialLiquidity.gt(0) ? revenueLiquidity.dividedBy(initialLiquidity) : new BigNumber(0),
      initialLiquidity: initialLiquidity,
      currentLiquidity: currentLiquidity
    }
  }, [item]);
  const payload = useMemo(() => {
    const primary = new BigNumber(primaryReserve || '0');
    const secondary = new BigNumber(secondaryReserve || '0');
    if (primary.gt(extra.primary) || secondary.gt(extra.secondary) || (!primary.gt(0) && !secondary.gt(0)))
      return null;

    return {
      delegatorId: item.delegatorId.toString(),
      primaryAssetHash: item.primaryAsset.id,
      secondaryAssetHash: item.secondaryAsset.id,
      primaryValue: mode == 'withdraw' && primary.eq(extra.primary) ? '' : primary.toString(),
      secondaryValue: mode == 'withdraw' && secondary.eq(extra.secondary) ? '' : secondary.toString()
    };
  }, [primaryReserve, secondaryReserve, extra, item, mode]);
  const revenue = useMemo(() => Exchange.toAPY(item.feeRate || DLP_DEFAULT_FEE_RATE_MAYBE, state.currentLiquidity, item.volume.multipliedBy(item.share)), [item.volume, item.share, state.currentLiquidity]);
  const symP = item.primaryAsset.token || item.primaryAsset.chain;
  const symQ = item.secondaryAsset.token || item.secondaryAsset.chain;
  return (
    <Card variant="surface" style={{ padding: 16, position: "relative" }}>
      <Collapsible.Root open={expanded}>
        <button type="button" className="card-expander" onClick={() => setExpanded(!expanded)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ position: 'relative', width: 42, height: 42, flex: 'none' }}>
              <AssetImage asset={item.primaryAsset} size="2" iconSize="42px"></AssetImage>
              <AssetImage asset={item.secondaryAsset} size="1" iconSize="20px" style={{ position: 'absolute', bottom: -3, right: -3, border: '2px solid var(--card)', borderRadius: '50%' }}></AssetImage>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: item.active ? undefined : 'line-through' }}>
                { symP }x{ symQ } <span className={ 'badge ' + (item.active ? 'info' : 'flat') } style={{ verticalAlign: 2 }}>AUTO</span>
              </div>
              <div className="tiny dim" style={{ marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Delegated to { UiUtil.toAddress(item.delegatorAccount || 'NULL', 6) }</div>
            </div>
            <span className="usd" style={{ flex: 'none' }}>{ UiUtil.toMoney(Exchange.equityAsset, state.currentLiquidity) }<span className="usd-sub">{ revenue.toFixed(2) }% APY · { UiUtil.toMoney(Exchange.equityAsset, state.currentLiquidity.multipliedBy(revenue.dividedBy(100 * 365))) }/day</span></span>
          </div>
        </button>
        <Collapsible.Content>
          <div className="dl dl-rule" style={{ marginTop: 14 }}>
            <div className="dl-row"><span className="dl-k">Your share</span><span className="dl-v">{ item.share.multipliedBy(100).toFixed(2) }%</span></div>
            <div className="dl-row"><span className="dl-k">Fees earned (est.)</span><span className="dl-v">{ UiUtil.toMoney(Exchange.equityAsset, state.absoluteRevenue, true) }</span></div>
            <div className="dl-row"><span className="dl-k">TAN subsidy</span><span className="dl-v">{ UiUtil.toMoney(new AssetId(), item.rewardValue) }</span></div>
          </div>
          <div className="dl dl-rule">
            <div className="dl-row"><span className="dl-k">Delegator account</span><span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(item.delegatorAccount || 'NULL');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(item.delegatorAccount || 'NULL') }</span>
            <Link className="dl-open router-link" to={'/portfolio/' + item.delegatorAccount + '?view=wallet-total-assets'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
            <div className="dl-row"><span className="dl-k">Market account</span><span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(item.marketAccount || 'NULL');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(item.marketAccount || 'NULL') }</span>
            <Link className="dl-open router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet-total-assets'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
            <div className="dl-row"><span className="dl-k">Primary asset</span><span className="dl-v">{ Assetlist.toName(item.primaryAsset) }</span></div>
            <div className="dl-row"><span className="dl-k">Secondary asset</span><span className="dl-v">{ Assetlist.toName(item.secondaryAsset) }</span></div>
            <div className="dl-row"><span className="dl-k">Status</span><span className="dl-v"><span className={ 'badge ' + (item.active ? 'ok' : 'flat') }>{ item.active ? 'Active' : 'Inactive' }</span></span></div>
            <div className="dl-row"><span className="dl-k">{ UiUtil.toAssetSymbol(item.primaryAsset) } reserve (est.)</span><span className="dl-v">{ UiUtil.toMoney(item.primaryAsset, item.primaryValue) }</span></div>
            <div className="dl-row"><span className="dl-k">{ UiUtil.toAssetSymbol(item.secondaryAsset) } reserve (est.)</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, item.secondaryValue) }</span></div>
          </div>
          {
            item.active &&
            <>
              <Box my="4" className="dl-rule"></Box>
              <Tooltip side="left" content={`Reserve value in ${UiUtil.toAssetSymbol(item.primaryAsset)} to ${mode}`}>
                <Box mb="3">
                  <TextField.Root placeholder={Assetlist.toName(item.primaryAsset) + ' to ' + mode} size="2" value={primaryReserve} onChange={(e) => setPrimaryReserve(TextUtil.toValue(primaryReserve, e.target.value))}>
                    <TextField.Slot>
                      <Icon path={mdiCurrencyUsd} size={0.8} />
                    </TextField.Slot>
                  </TextField.Root>
                  <Box px="2" pt="2">
                    <Slider color={slider.primary.overpulling ? 'red' : undefined} step={1} value={slider.primary.value} onValueChange={(v) => setPrimaryReserve(new BigNumber(v[0] / 100).multipliedBy(extra.primary).toString())} />
                  </Box>
                </Box>
              </Tooltip>
              <Tooltip side="left" content={`Reserve value in ${UiUtil.toAssetSymbol(item.secondaryAsset)} to ${mode}`}>
                <Box mb="3">
                  <TextField.Root placeholder={Assetlist.toName(item.secondaryAsset) + ' to ' + mode} size="2" value={secondaryReserve} onChange={(e) => setSecondaryReserve(TextUtil.toValue(secondaryReserve, e.target.value))}>
                    <TextField.Slot>
                      <Icon path={mdiCurrencyUsd} size={0.8} />
                    </TextField.Slot>
                  </TextField.Root>
                  <Box px="2" pt="2">
                    <Slider color={slider.secondary.overpulling ? 'red' : undefined} step={1} value={slider.secondary.value} onValueChange={(v) => setSecondaryReserve(new BigNumber(v[0] / 100).multipliedBy(extra.secondary).toString())} />
                  </Box>
                </Box>
              </Tooltip>
              {
                (slider.primary.overpulling || slider.secondary.overpulling) &&
                <Flex justify="end" mb="2">
                  <Text size="1" color="gray">Underlying LP will be withdrawn</Text>
                </Flex>
              }
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PerformerButton className="btn-sm btn-brand" title={ mode == 'deposit' ? 'Review deposit' : 'Review withdrawal' } description={mode == 'deposit' ? "Smart contract will add your deposit into the delegated LP and allocate your position" : "Smart contract will re-pay your deposit and deallocate the position"} color={mode == 'deposit' ? 'jade' : 'red'} disabled={!payload} onBuild={async () => {
                    return payload ? (mode == 'deposit' ? await Builder.depositLiquidity(payload) : await Builder.withdrawLiquidity(payload)) : null;
                  }}></PerformerButton>
                </div>
                <Tooltip content={ mode == 'deposit' ? 'Mode: adding funds · switch to withdrawal' : 'Mode: withdrawing funds · switch to adding funds' }>
                  <button className="icon-btn icon-btn-lg" aria-label="Deposit or withdrawal mode" onClick={() => setMode(mode == 'deposit' ? 'withdraw' : 'deposit')} style={ mode == 'withdraw' ? { background: 'var(--down-dim)', color: 'var(--down)' } : undefined }>
                    <Icon path={ mdiBankPlus } size={0.65}></Icon>
                  </button>
                </Tooltip>
              </div>
            </>
          }
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
}

export function PseudoDelegatedPoolView(props: { item: PseudoDelegatedPool, assets: Balance[] }) {
  const item = props.item;
  const [expanded, setExpanded] = useState(false);
  const [primaryReserve, setPrimaryReserve] = useState<string>('');
  const [secondaryReserve, setSecondaryReserve] = useState<string>('');
  const extra = useMemo(() => {
    const delegator = Exchange.delegators.find((v) => v.id.eq(item.delegatorId));
    const primary = props.assets.find((v) => v.asset.id == item.primaryAsset.id);
    const secondary = props.assets.find((v) => v.asset.id == item.secondaryAsset.id);
    const absoluteRevenue = item.currentValue.minus(item.initialValue);
    const relativeRevenue = item.initialValue.gt(0) ? absoluteRevenue.dividedBy(item.initialValue) : new BigNumber(0);
    return {
      primary: primary?.available || new BigNumber(0),
      secondary: secondary?.available || new BigNumber(0),
      delegator: delegator,
      absoluteRevenue: absoluteRevenue,
      relativeRevenue: relativeRevenue
    }
  }, [item, props.assets]);
  const revenue = useMemo(() => Exchange.toAPY(item.feeRate || DLP_DEFAULT_FEE_RATE_MAYBE, item.currentValue, item.volume), [item.currentValue, item.volume]);
  const payload = useMemo(() => {
    const primary = new BigNumber(primaryReserve || '0');
    const secondary = new BigNumber(secondaryReserve || '0');
    if (primary.gt(extra.primary) || secondary.gt(extra.secondary) || (!primary.gt(0) && !secondary.gt(0)))
      return null;

    return {
      delegatorId: item.delegatorId.toString(),
      primaryAssetHash: item.primaryAsset.id,
      secondaryAssetHash: item.secondaryAsset.id,
      primaryValue: primary.toString(),
      secondaryValue: secondary.toString()
    };
  }, [primaryReserve, secondaryReserve, extra, item]);

  return (
    <Card variant="surface" style={{ padding: 16, position: "relative" }}>
      <Collapsible.Root open={expanded}>
        <button type="button" className="card-expander" onClick={() => setExpanded(!expanded)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ position: 'relative', width: 42, height: 42, flex: 'none' }}>
              <AssetImage asset={item.primaryAsset} size="2" iconSize="42px"></AssetImage>
              <AssetImage asset={item.secondaryAsset} size="1" iconSize="20px" style={{ position: 'absolute', bottom: -3, right: -3, border: '2px solid var(--card)', borderRadius: '50%' }}></AssetImage>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                { item.primaryAsset.token || item.primaryAsset.chain }x{ item.secondaryAsset.token || item.secondaryAsset.chain } <span className="badge info" style={{ verticalAlign: 2 }}>AUTO</span>
              </div>
              <div className="tiny dim" style={{ marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Delegated to { item.delegatorAccount.substring(item.delegatorAccount.length - 6) }</div>
            </div>
            <span className="usd" style={{ flex: 'none' }}>{ UiUtil.toMoney(Exchange.equityAsset, item.currentValue) }<span className="usd-sub">{ revenue.toFixed(2) }% APY · { UiUtil.toMoney(Exchange.equityAsset, item.currentValue.multipliedBy(revenue.dividedBy(100 * 365))) }/day</span></span>
          </div>
        </button>
        <Collapsible.Content>
          <div className="dl dl-rule" style={{ marginTop: 14 }}>
            <div className="dl-row"><span className="dl-k">Liquidity</span><span className="dl-v">{ UiUtil.toMoney(Exchange.equityAsset, item.currentValue) }</span></div>
            <div className="dl-row"><span className="dl-k">Revenue</span><span className="dl-v">{ UiUtil.toMoney(Exchange.equityAsset, item.currentValue.minus(item.initialValue), true) }</span></div>
            {
              extra.delegator &&
              <div className="dl-row"><span className="dl-k">TAN subsidy</span><span className="dl-v">{ UiUtil.toMoney(new AssetId(), extra.delegator.rewardEmission.dividedBy(extra.delegator.permissions.length).multipliedBy(86400000 / Chain.policy.BLOCK_TIME)) } per day</span></div>
            }
          </div>
          <div className="dl dl-rule">
            <div className="dl-row"><span className="dl-k">Delegator account</span><span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(item.delegatorAccount || 'NULL');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(item.delegatorAccount || 'NULL') }</span>
            <Link className="dl-open router-link" to={'/portfolio/' + item.delegatorAccount + '?view=wallet-total-assets'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
            <div className="dl-row"><span className="dl-k">Market account</span><span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(item.marketAccount || 'NULL');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(item.marketAccount || 'NULL') }</span>
            <Link className="dl-open router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet-total-assets'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
            <div className="dl-row"><span className="dl-k">Primary asset</span><span className="dl-v">{ Assetlist.toName(item.primaryAsset) }</span></div>
            <div className="dl-row"><span className="dl-k">Secondary asset</span><span className="dl-v">{ Assetlist.toName(item.secondaryAsset) }</span></div>
          </div>
          <Box my="4" className="dl-rule"></Box>
          <Tooltip side="left" content={`Reserve value in ${UiUtil.toAssetSymbol(item.primaryAsset)} to deposit`}>
            <Box mb="3">
              <TextField.Root placeholder={Assetlist.toName(item.primaryAsset) + ' deposit'} size="2" value={primaryReserve} onChange={(e) => setPrimaryReserve(TextUtil.toValue(primaryReserve, e.target.value))}>
                <TextField.Slot>
                  <Icon path={mdiCurrencyUsd} size={0.8} />
                </TextField.Slot>
              </TextField.Root>
              <Box px="2" pt="2">
                <Slider step={1} value={[extra.primary.gt(0) ? new BigNumber(primaryReserve || '0').multipliedBy(100).dividedBy(extra.primary).toNumber() : 0]} onValueChange={(v) => setPrimaryReserve(new BigNumber(v[0] / 100).multipliedBy(extra.primary).toString())} />
              </Box>
            </Box>
          </Tooltip>
          <Tooltip side="left" content={`Reserve value in ${UiUtil.toAssetSymbol(item.secondaryAsset)} to deposit`}>
            <Box mb="3">
              <TextField.Root placeholder={Assetlist.toName(item.secondaryAsset) + ' deposit'} size="2" value={secondaryReserve} onChange={(e) => setSecondaryReserve(TextUtil.toValue(secondaryReserve, e.target.value))}>
                <TextField.Slot>
                  <Icon path={mdiCurrencyUsd} size={0.8} />
                </TextField.Slot>
              </TextField.Root>
              <Box px="2" pt="2">
                <Slider step={1} value={[extra.secondary.gt(0) ? new BigNumber(secondaryReserve || '0').multipliedBy(100).dividedBy(extra.secondary).toNumber() : 0]} onValueChange={(v) => setSecondaryReserve(new BigNumber(v[0] / 100).multipliedBy(extra.secondary).toString())} />
              </Box>
            </Box>
          </Tooltip>
          <Flex pt="2">
            <PerformerButton title="Review deposit" description="Smart contract will add your deposit into the delegated LP and allocate your position" className="btn-brand btn-cta" color="jade" style={{ width: '100%' }} disabled={!payload} onBuild={async () => {
              return payload ? await Builder.depositLiquidity(payload) : null;
            }}></PerformerButton>
          </Flex>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
}
