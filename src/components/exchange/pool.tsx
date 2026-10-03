import { Badge, Box, Button, Card, Dialog, Flex, SegmentedControl, Text, TextField, Tooltip } from "@radix-ui/themes";
import { AssetId, ByteUtil, Chain, LiquidityPool } from "tangentsdk/algorithm";
import { TextUtil } from "tangentsdk/text";
import { UiUtil } from "tangentsdk/ui";
import { Assetlist } from "tangentsdk/assetlist";
import { Pool, Exchange, Balance, PseudoDelegatedPool, DelegatedPool, PolyAsset } from "../../core/exchange";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertBox, AlertType } from "../alert";
import { mdiArrowRight, mdiLayers, mdiOpenInNew, mdiWallet } from "@mdi/js";
import { AssetImage } from "../asset-image";
import { PerformerButton, Builder, BuilderResult } from "./performer";
import { defaultMakerState } from "./maker";
import { AppData } from "../../core/app";
import { AppStorage } from "../../core/storage";
import { pathOfMaker } from "../../pages/exchange/orderbook";
import { useEffectAsync } from "../../core/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";
import { toFancyMoney } from "../../core/utils";

const DLP_DEFAULT_FEE_RATE_MAYBE = 0.0005;
// Single condition shared by the lime Max highlight and the automatic 100% withdrawal (empty value)
// so the button state and the on-chain execution can never disagree: the amount counts as full when it
// lies within the wider of the ±0.5% band and the ±1e-6 dust range around the full position. The
// contract tracks reserves with 18 decimals while the UI floors amounts to 8 (Max button) and users
// may round manual input either way; the dust cap covers tiny positions where ±0.5% is narrower than
// the flooring/rounding error.
const DLP_FULL_WITHDRAW_EPSILON = new BigNumber('0.000001');
const isFullWithdraw = (position: BigNumber, amount: BigNumber) => position.gt(0) && amount.gt(0)
  && amount.lte(BigNumber.max(position.multipliedBy(1.005), position.plus(DLP_FULL_WITHDRAW_EPSILON)))
  && amount.gte(BigNumber.min(position.multipliedBy(0.995), position.minus(DLP_FULL_WITHDRAW_EPSILON)));


function DlpAmount(props: { label: string, meta?: string, asset: AssetId, value: string, onChange: (value: string) => any, max: BigNumber, err?: boolean }) {
  const amount = new BigNumber(props.value || '0');
  const near = (fraction: number) => { const target = props.max.multipliedBy(fraction); return target.gt(0) && amount.gt(0) && amount.lte(target.multipliedBy(1.005)) && amount.gte(target.multipliedBy(0.995)); };
  const set = (fraction: number) => props.onChange(props.max.multipliedBy(fraction).decimalPlaces(8, BigNumber.ROUND_FLOOR).toString());
  return (
    <div className={ 'amount-box' + (props.err ? ' err' : '') }>
      <div className="swap-lab"><span>{ props.label }</span><span>{ props.meta }</span></div>
      <div className="swap-amt">
        <TextField.Root placeholder="0.0" type="text" value={props.value} onChange={(e) => props.onChange(TextUtil.toValue(props.value, e.target.value))} />
        <span className="token-select static">
          <AssetImage asset={props.asset} size="2" iconSize="26px"></AssetImage>
          { UiUtil.toAssetSymbol(props.asset) }
        </span>
      </div>
      <div className="pct-row">
        <button type="button" className={ 'pct' + (near(0.25) ? ' hot' : '') } onClick={() => set(0.25)}>25%</button>
        <button type="button" className={ 'pct' + (near(0.5) ? ' hot' : '') } onClick={() => set(0.5)}>50%</button>
        <button type="button" className={ 'pct' + (near(0.75) ? ' hot' : '') } onClick={() => set(0.75)}>75%</button>
        <button type="button" className={ 'pct' + (isFullWithdraw(props.max, amount) ? ' hot' : '') } onClick={() => set(1)}>Max</button>
      </div>
    </div>
  );
}


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
          <span className="usd" style={{ flex: 'none' }}>{ toFancyMoney(Exchange.equityAsset, state.liquidity) }<span className="usd-sub">+{ (100 * (state.staleness?.dev || 0)).toFixed(1) }% dev</span></span>
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
            <PerformerButton name="Close position" className="btn-sm btn-ghost" title="Close" description="Close position — Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" variant="classic" color="gray" onBuild={() => {
              return Builder.withdrawPool({ poolId: item.id.toString() });
            }}></PerformerButton>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PerformerButton name="Adjust position" className="btn-sm btn-brand" title="Adjust" description={ rebalancer == 'cross' ? "Smart contract will re-balance this pool based on current market price, pool liquidity and available balance" : "Smart contract will re-balance this pool using only the assets allocated to it" } onBuild={() => rebalance(rebalancer == 'cross')}></PerformerButton>
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
          <Link className="dl-open router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
          <div className="dl-row"><span className="dl-k">Primary asset</span><span className="dl-v">{ Assetlist.toName(item.primaryAsset) }</span></div>
          <div className="dl-row"><span className="dl-k">Secondary asset</span><span className="dl-v">{ Assetlist.toName(item.secondaryAsset) }</span></div>
          <div className="dl-row"><span className="dl-k">Reference</span><span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(item.poolId.toString(16));
            AlertBox.open(AlertType.Info, 'Reference copied!')
          }}>0x{ item.poolId.toString(16).length > 8 ? UiUtil.toHash(item.poolId.toString(16), 6) : item.poolId.toString(16) }</span></span></div>
          <div className="dl-row"><span className="dl-k">Status</span><span className="dl-v"><Badge color={item.active ? (inLowerRange && inUpperRange ? undefined : 'yellow') : 'gray'}>{ item.active ? (inLowerRange && inUpperRange ? (concentrated ? 'Active (fully in range)' : 'Active') : 'Partially active (out of range)') : 'Inactive' }</Badge></span></div>
          <div className="dl-row"><span className="dl-k">Spread</span><span className="dl-v"><Flex wrap="wrap" gap="2" justify="end">
            { inLowerRange && <Badge>BID { toFancyMoney(item.secondaryAsset, bidPrice) }</Badge> }
            { inUpperRange && <Badge color="red">ASK { toFancyMoney(item.secondaryAsset, askPrice) }</Badge> }
          </Flex></span></div>
          {
            (item.primaryRevenue.gt(0) || item.secondaryRevenue.gt(0)) &&
            <div className="dl-row"><span className="dl-k">Fees</span><span className="dl-v"><Flex wrap="wrap" gap="2" justify="end">
              { item.primaryRevenue.gt(0) && <Badge>{ toFancyMoney(item.primaryAsset, item.primaryRevenue) }</Badge> }
              { item.secondaryRevenue.gt(0) && <Badge>{ toFancyMoney(item.secondaryAsset, item.secondaryRevenue) }</Badge> }
            </Flex></span></div>
          }
          <div className="dl-row"><span className="dl-k">Revenue</span><span className="dl-v"><Flex wrap="wrap" gap="2" justify="end">
            <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ toFancyMoney(Exchange.equityAsset, state.absoluteRevenue, true) }</Badge>
            <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ state.relativeRevenue.gt(0) ? '+' : '' }{ state.relativeRevenue.multipliedBy(100).toFixed(2) }%</Badge>
          </Flex></span></div>
          <div className="dl-row"><span className="dl-k">Price</span><span className="dl-v">{ toFancyMoney(item.secondaryAsset, item.price) }</span></div>
          {
            concentrated &&
            <div className="dl-row"><span className="dl-k">Price range</span><span className="dl-v">{ toFancyMoney(item.secondaryAsset, item.minPrice || null) } — { toFancyMoney(item.secondaryAsset, item.maxPrice || null) }</span></div>
          }
          <div className="dl-row"><span className="dl-k">{ UiUtil.toAssetSymbol(item.primaryAsset) } reserve</span><span className="dl-v">{ toFancyMoney(item.primaryAsset, item.primaryValue) }</span></div>
          <div className="dl-row"><span className="dl-k">{ UiUtil.toAssetSymbol(item.secondaryAsset) } reserve</span><span className="dl-v">{ toFancyMoney(item.secondaryAsset, item.secondaryValue) }</span></div>
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
                    <Text size="2" style={{ color: 'var(--accent-11)' }}>≤ { toFancyMoney(item.secondaryAsset, bidPrice) }</Text>
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1" style={{ textDecoration: inUpperRange ? undefined : 'line-through', color: 'var(--gray-11)' }}>
                    <Text size="2" color="red">Sell at</Text>
                    <Text size="2" color="red">≥ { toFancyMoney(item.secondaryAsset, askPrice) }</Text>
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1">
                    <Text size="2" color="gray">With</Text>
                    <Text size="2" style={{ color: 'var(--gray-12)' }}>{ toFancyMoney(Exchange.equityAsset, state.liquidity) }</Text>
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

function usePolyBalance(assets: Balance[], asset: AssetId, marketId: BigNumber, enabled: boolean) {
  const [family, setFamily] = useState<PolyAsset[] | null>(null);
  useEffectAsync(async () => {
    if (!enabled)
      return;
    try {
      const result = await Exchange.marketAssets(asset, true);
      setFamily(result.filter((v) => v.marketId?.toString() == marketId.toString()));
    } catch {
      setFamily(null);
    }
  }, [asset.id, marketId.toString(), enabled]);
  const total = useMemo((): BigNumber => {
    const own = assets.find((v) => v.asset.id == asset.id)?.available || new BigNumber(0);
    if (!family)
      return own;
    return assets.filter((v) => v.asset.id == asset.id || family.some((f) => f.id == v.asset.id)).reduce((a, b) => a.plus(b.available), new BigNumber(0));
  }, [assets, family, asset]);
  return { family, total };
}
function toWrapPlan(deposit: BigNumber, target: AssetId, family: PolyAsset[] | null, assets: Balance[]): { entry: PolyAsset, value: BigNumber }[] | null {
  let shortage = deposit.minus(assets.find((v) => v.asset.id == target.id)?.available || new BigNumber(0));
  if (!shortage.gt(0))
    return [];
  if (!family)
    return null;

  const plan: { entry: PolyAsset, value: BigNumber }[] = [];
  for (const entry of family) {
    if (!shortage.gt(0))
      break;
    if (entry.id == target.id)
      continue;
    const balance = assets.find((v) => v.asset.id == entry.id)?.available || new BigNumber(0);
    const capacity = entry.liquidity ? BigNumber.min(balance, entry.liquidity) : balance;
    if (!capacity.gt(0))
      continue;
    const value = BigNumber.min(shortage, capacity);
    plan.push({ entry, value });
    shortage = shortage.minus(value);
  }
  return shortage.gt(0) ? null : plan;
}

export function DelegatedPoolView(props: { item: DelegatedPool, assets: Balance[], readOnly?: boolean }) {
  const item = props.item;
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [primaryReserve, setPrimaryReserve] = useState<string>('');
  const [secondaryReserve, setSecondaryReserve] = useState<string>('');
  const [exit, setExit] = useState<'primary' | 'secondary' | 'both'>('both');
  const [flexAmount, setFlexAmount] = useState<string>('');
  const [expanded, setExpanded] = useState(false);
  const primaryPoly = usePolyBalance(props.assets, item.primaryAsset, item.marketId, expanded);
  const secondaryPoly = usePolyBalance(props.assets, item.secondaryAsset, item.marketId, expanded);
  const extra = useMemo(() => {
    const delegator = Exchange.delegators.find((v) => v.id.eq(item.delegatorId));
    return mode == 'withdraw' ? {
      primary: item.primaryValue,
      secondary: item.secondaryValue,
      delegator: delegator
    } : {
      primary: primaryPoly.total,
      secondary: secondaryPoly.total,
      delegator: delegator
    };
  }, [item, primaryPoly, secondaryPoly, mode]);
  const overpulling = useMemo(() => ({
    primary: mode == 'withdraw' && item.primaryTotal.minus(item.primaryReserve).minus(new BigNumber(primaryReserve || '0')).lt(0),
    secondary: mode == 'withdraw' && item.secondaryTotal.minus(item.secondaryReserve).minus(new BigNumber(secondaryReserve || '0')).lt(0)
  }), [mode, item, primaryReserve, secondaryReserve]);
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
  const flex = useMemo(() => {
    if (mode != 'withdraw' || exit == 'both')
      return null;
    const primaryPrice = Exchange.priceOf(item.primaryAsset).close || new BigNumber(0);
    const secondaryPrice = Exchange.priceOf(item.secondaryAsset).close || new BigNumber(0);
    const wanted = exit == 'primary' ? item.primaryAsset : item.secondaryAsset;
    const unwanted = exit == 'primary' ? item.secondaryAsset : item.primaryAsset;
    const wantedPrice = exit == 'primary' ? primaryPrice : secondaryPrice;
    const unwantedPrice = exit == 'primary' ? secondaryPrice : primaryPrice;
    const toWanted = (value: BigNumber, price: BigNumber) => wantedPrice.gt(0) ? value.multipliedBy(price).dividedBy(wantedPrice) : new BigNumber(0);
    const wantedPosition = exit == 'primary' ? item.primaryValue : item.secondaryValue;
    const unwantedPosition = exit == 'primary' ? item.secondaryValue : item.primaryValue;
    const cap = toWanted(item.primaryValue, primaryPrice).plus(toWanted(item.secondaryValue, secondaryPrice));
    const amount = new BigNumber(flexAmount || '0');
    const free = toWanted(BigNumber.max(item.primaryTotal.minus(item.primaryReserve), 0), primaryPrice).plus(toWanted(BigNumber.max(item.secondaryTotal.minus(item.secondaryReserve), 0), secondaryPrice));
    const atMax = isFullWithdraw(cap, amount);
    const wantedOut = atMax ? wantedPosition : BigNumber.min(amount, wantedPosition);
    const swapIn = atMax ? unwantedPosition : unwantedPrice.gt(0) ? BigNumber.min(amount.minus(wantedOut).multipliedBy(wantedPrice).dividedBy(unwantedPrice), unwantedPosition) : new BigNumber(0);
    return {
      wanted: wanted,
      unwanted: unwanted,
      cap: cap,
      amount: amount,
      atMax: atMax,
      over: !atMax && amount.gt(cap),
      pullLp: amount.gt(free),
      swapIn: swapIn,
      withdrawPrimary: exit == 'primary' ? wantedOut : swapIn,
      withdrawSecondary: exit == 'primary' ? swapIn : wantedOut
    };
  }, [mode, exit, item, flexAmount]);
  const swapInKey = flex && !flex.over && flex.swapIn.gt(0) ? flex.swapIn.toString() : null;
  const [swapOk, setSwapOk] = useState<boolean | null>(null);
  const probeSeq = useRef(0);
  useEffect(() => {
    const seq = ++probeSeq.current;
    if (!swapInKey || !flex) {
      setSwapOk(null);
      return;
    }
    const timer = setTimeout(() => {
      Exchange.marketPaths(item.marketId, flex.unwanted, flex.wanted, swapInKey, '0.005').then((paths) => {
        if (seq == probeSeq.current)
          setSwapOk(paths.length > 0);
      }, () => {
        if (seq == probeSeq.current)
          setSwapOk(false);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [swapInKey, item.marketId]);
  const blocked = !!flex && swapInKey != null && swapOk == false;
  const payload = useMemo(() => {
    if (flex) {
      if (!flex.amount.gt(0) || flex.over || blocked)
        return null;
      return {
        delegatorId: item.delegatorId.toString(),
        primaryAssetHash: item.primaryAsset.id,
        secondaryAssetHash: item.secondaryAsset.id,
        primaryValue: flex.atMax ? '' : flex.withdrawPrimary.toString(),
        secondaryValue: flex.atMax ? '' : flex.withdrawSecondary.toString()
      };
    }
    const primary = new BigNumber(primaryReserve || '0');
    const secondary = new BigNumber(secondaryReserve || '0');
    const primaryFull = mode == 'withdraw' && isFullWithdraw(extra.primary, primary);
    const secondaryFull = mode == 'withdraw' && isFullWithdraw(extra.secondary, secondary);
    if ((!primaryFull && primary.gt(extra.primary)) || (!secondaryFull && secondary.gt(extra.secondary)) || (!primary.gt(0) && !secondary.gt(0)))
      return null;

    return {
      delegatorId: item.delegatorId.toString(),
      primaryAssetHash: item.primaryAsset.id,
      secondaryAssetHash: item.secondaryAsset.id,
      primaryValue: primaryFull ? '' : primary.toString(),
      secondaryValue: secondaryFull ? '' : secondary.toString()
    };
  }, [primaryReserve, secondaryReserve, extra, item, mode, flex, blocked]);
  const wrapPlan = useMemo((): { entry: PolyAsset, value: BigNumber, target: AssetId }[] | null => {
    if (!payload || mode == 'withdraw')
      return [];
    const primary = toWrapPlan(new BigNumber(payload.primaryValue || '0'), item.primaryAsset, primaryPoly.family, props.assets);
    const secondary = toWrapPlan(new BigNumber(payload.secondaryValue || '0'), item.secondaryAsset, secondaryPoly.family, props.assets);
    if (!primary || !secondary)
      return null;
    return primary.map((v) => ({ ...v, target: item.primaryAsset })).concat(secondary.map((v) => ({ ...v, target: item.secondaryAsset })));
  }, [payload, mode, primaryPoly, secondaryPoly, item, props.assets]);
  const revenue = useMemo(() => Exchange.toAPY(item.feeRate || DLP_DEFAULT_FEE_RATE_MAYBE, state.currentLiquidity, item.volume.dividedBy(180).multipliedBy(item.share)), [item.volume, item.share, state.currentLiquidity]);
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
            <span className="usd" style={{ flex: 'none' }}>{ toFancyMoney(Exchange.equityAsset, state.currentLiquidity) }<span className={ "usd-sub" + (revenue.gt(0) ? " earn" : "") }>{ revenue.toFixed(2) }% APY · { toFancyMoney(Exchange.equityAsset, state.currentLiquidity.multipliedBy(revenue.dividedBy(100 * 365))) }/day</span></span>
          </div>
        </button>
        <Collapsible.Content>
          <div className="dl dl-rule" style={{ marginTop: 14 }}>
            <div className="dl-row"><span className="dl-k">Delegator account</span><span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(item.delegatorAccount || 'NULL');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(item.delegatorAccount || 'NULL') }</span>
            <Link className="dl-open router-link" to={'/portfolio/' + item.delegatorAccount + '?view=wallet'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
            <div className="dl-row"><span className="dl-k">Market account</span><span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(item.marketAccount || 'NULL');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(item.marketAccount || 'NULL') }</span>
            <Link className="dl-open router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
            <div className="dl-row"><span className="dl-k">Primary asset</span><span className="dl-v">{ Assetlist.toName(item.primaryAsset) }</span></div>
            <div className="dl-row"><span className="dl-k">Secondary asset</span><span className="dl-v">{ Assetlist.toName(item.secondaryAsset) }</span></div>
            <div className="dl-row"><span className="dl-k">Your share</span><span className="dl-v">{ item.share.multipliedBy(100).toFixed(2) }%</span></div>
            <div className="dl-row"><span className="dl-k">TAN revenue</span><span className="dl-v">{ toFancyMoney(new AssetId(), item.rewardValue) }</span></div>
          </div>
          <div className="dl dl-rule">
            <div className="dl-row"><span className="dl-k">Revenue and IL</span><span className="dl-v">{ toFancyMoney(Exchange.equityAsset, state.absoluteRevenue, true) }</span></div>
            <div className="dl-row"><span className="dl-k">{ UiUtil.toAssetSymbol(item.primaryAsset) } reserve (est.)</span><span className="dl-v">{ toFancyMoney(item.primaryAsset, item.primaryValue) }</span></div>
            <div className="dl-row"><span className="dl-k">{ UiUtil.toAssetSymbol(item.secondaryAsset) } reserve (est.)</span><span className="dl-v">{ toFancyMoney(item.secondaryAsset, item.secondaryValue) }</span></div>
            <div className="dl-row"><span className="dl-k">Status</span><span className="dl-v"><span className={ 'badge ' + (item.active ? 'ok' : 'flat') }>{ item.active ? 'Active' : 'Inactive' }</span></span></div>
          </div>
          {
            item.active &&
            <>
              <SegmentedControl.Root value={mode} onValueChange={(value) => setMode(value as 'deposit' | 'withdraw')} size="2" radius="full" mb="3" style={{ width: '100%' }}>
                <SegmentedControl.Item value="deposit" style={{ flex: 1, justifyContent: 'center' }}><Text size="2">Add funds</Text></SegmentedControl.Item>
                <SegmentedControl.Item value="withdraw" style={{ flex: 1, justifyContent: 'center' }}><Text size="2">Withdraw</Text></SegmentedControl.Item>
              </SegmentedControl.Root>
              {
                mode == 'deposit' &&
                <>
                  <DlpAmount label={ Assetlist.toName(item.primaryAsset) } meta={ 'Available ' + toFancyMoney(item.primaryAsset, extra.primary) } asset={item.primaryAsset} value={primaryReserve} onChange={setPrimaryReserve} max={extra.primary} />
                  <DlpAmount label={ Assetlist.toName(item.secondaryAsset) } meta={ 'Available ' + toFancyMoney(item.secondaryAsset, extra.secondary) } asset={item.secondaryAsset} value={secondaryReserve} onChange={setSecondaryReserve} max={extra.secondary} />
                </>
              }
              {
                mode == 'withdraw' &&
                <>
                  <SegmentedControl.Root value={exit} onValueChange={(value) => setExit(value as 'primary' | 'secondary' | 'both')} size="1" radius="full" mb="3" style={{ width: '100%' }}>
                    <SegmentedControl.Item value="primary" style={{ flex: 1, justifyContent: 'center' }}><Text size="1">{ symP }</Text></SegmentedControl.Item>
                    <SegmentedControl.Item value="secondary" style={{ flex: 1, justifyContent: 'center' }}><Text size="1">{ symQ }</Text></SegmentedControl.Item>
                    <SegmentedControl.Item value="both" style={{ flex: 1, justifyContent: 'center' }}><Text size="1">{ symP } and { symQ }</Text></SegmentedControl.Item>
                  </SegmentedControl.Root>
                  {
                    !flex &&
                    <>
                      <DlpAmount label={ Assetlist.toName(item.primaryAsset) } meta={ 'In position ' + toFancyMoney(item.primaryAsset, extra.primary) } asset={item.primaryAsset} value={primaryReserve} onChange={setPrimaryReserve} max={extra.primary} err={overpulling.primary} />
                      <DlpAmount label={ Assetlist.toName(item.secondaryAsset) } meta={ 'In position ' + toFancyMoney(item.secondaryAsset, extra.secondary) } asset={item.secondaryAsset} value={secondaryReserve} onChange={setSecondaryReserve} max={extra.secondary} err={overpulling.secondary} />
                      {
                        (overpulling.primary || overpulling.secondary) &&
                        <Flex justify="end" mt="3" mb="3">
                          <Text size="1" color="gray">Underlying LP will be withdrawn</Text>
                        </Flex>
                      }
                    </>
                  }
                  {
                    flex &&
                    <>
                      <DlpAmount label={ 'Total to receive in ' + UiUtil.toAssetSymbol(flex.wanted) } meta={ 'Position ≈ ' + toFancyMoney(flex.wanted, flex.cap) } asset={flex.wanted} value={flexAmount} onChange={setFlexAmount} max={flex.cap} err={flex.over || blocked || flex.pullLp} />
                      {
                        flex.over ?
                        <Flex justify="end" mt="3" mb="3"><Text size="1" color="gray">Exceeds total position value</Text></Flex> :
                        blocked ?
                        <Flex justify="end" mt="3" mb="3"><Text size="1" color="gray">No market liquidity to swap { UiUtil.toAssetSymbol(flex.unwanted) } · reduce the amount</Text></Flex> :
                        flex.pullLp ?
                        <Flex justify="end" mt="3" mb="3"><Text size="1" color="gray">Underlying LP will be withdrawn · the swap may fail if the liquidity is gone</Text></Flex> :
                        null
                      }
                    </>
                  }
                </>
              }
              <PerformerButton name={ (mode == 'deposit' ? 'Deposit ' : 'Withdraw ' + (flex ? (exit == 'primary' ? symP : symQ) + ' from ' : '')) + symP + 'x' + symQ + ' DLP' } className="btn-sm btn-brand" style={{ width: '100%' }} title={ mode == 'deposit' ? 'Review deposit' : 'Review withdrawal' } description={mode == 'deposit' ? (wrapPlan && wrapPlan.length ? 'Other-network versions of your tokens will be converted into the pool asset 1:1 automatically, then the smart contract will add your deposit into the delegated LP and allocate your position' : 'Smart contract will add your deposit into the delegated LP and allocate your position') : flex ? 'Both sides of the position are withdrawn and ' + (exit == 'primary' ? symQ : symP) + ' is swapped into ' + (exit == 'primary' ? symP : symQ) + ' at the current market rate' : 'Smart contract will re-pay your deposit and deallocate the position'} color={mode == 'deposit' ? 'jade' : 'red'} disabled={!payload || wrapPlan == null} onBuild={async () => {
                if (!payload)
                  return null;
                if (mode == 'withdraw') {
                  const results = [await Builder.withdrawLiquidity(payload)];
                  if (flex) {
                    const swapIn = exit == 'primary' ? flex.withdrawSecondary : flex.withdrawPrimary;
                    if (swapIn.gt(0)) {
                      const paths = await Exchange.marketPaths(item.marketId, flex.unwanted, flex.wanted, swapIn, '0.005');
                      if (!paths.length)
                        throw new Error('No liquidity to swap ' + UiUtil.toAssetSymbol(flex.unwanted) + ' in this market');
                      const path = paths.reduce((best, candidate) => candidate[candidate.length - 1].output.min.gt(best[best.length - 1].output.min) ? candidate : best, paths[0]);
                      const legs = await Builder.swap({ tokenIn: flex.unwanted, tokenOut: flex.wanted, amountIn: swapIn.toString(), amountOut: '', slippage: '0.5', path: path, pays: { [flex.unwanted.id]: swapIn.toString() }, marketId: item.marketId.toString() });
                      legs[0].body.function = '>' + legs[0].body.function;
                      results.push(...legs);
                    }
                  }
                  return results;
                }
                const results: BuilderResult[] = [];
                for (const leg of (wrapPlan || []))
                  results.push(await Builder.payUnifiedAsset({ pays: { [leg.entry.id]: leg.value.toString() }, marketId: item.marketId.toString(), primaryAssetHash: AssetId.fromHandle(leg.entry.chain || '').id, secondaryAssetHash: leg.target.id }));
                results.push(await Builder.depositLiquidity(payload));
                return results;
              }}></PerformerButton>
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
  const primaryPoly = usePolyBalance(props.assets, item.primaryAsset, item.marketId, expanded);
  const secondaryPoly = usePolyBalance(props.assets, item.secondaryAsset, item.marketId, expanded);
  const extra = useMemo(() => {
    const delegator = Exchange.delegators.find((v) => v.id.eq(item.delegatorId));
    const absoluteRevenue = item.currentValue.minus(item.initialValue);
    const relativeRevenue = item.initialValue.gt(0) ? absoluteRevenue.dividedBy(item.initialValue) : new BigNumber(0);
    return {
      primary: primaryPoly.total,
      secondary: secondaryPoly.total,
      delegator: delegator,
      absoluteRevenue: absoluteRevenue,
      relativeRevenue: relativeRevenue
    }
  }, [item, primaryPoly, secondaryPoly]);
  const revenue = useMemo(() => Exchange.toAPY(item.feeRate || DLP_DEFAULT_FEE_RATE_MAYBE, item.currentValue, item.volume.dividedBy(180)), [item.currentValue, item.volume]);
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
  const wrapPlan = useMemo((): { entry: PolyAsset, value: BigNumber, target: AssetId }[] | null => {
    if (!payload)
      return [];
    const primary = toWrapPlan(new BigNumber(payload.primaryValue || '0'), item.primaryAsset, primaryPoly.family, props.assets);
    const secondary = toWrapPlan(new BigNumber(payload.secondaryValue || '0'), item.secondaryAsset, secondaryPoly.family, props.assets);
    if (!primary || !secondary)
      return null;
    return primary.map((v) => ({ ...v, target: item.primaryAsset })).concat(secondary.map((v) => ({ ...v, target: item.secondaryAsset })));
  }, [payload, primaryPoly, secondaryPoly, item, props.assets]);


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
            <span className="usd" style={{ flex: 'none' }}>{ toFancyMoney(Exchange.equityAsset, item.currentValue) }<span className={ "usd-sub" + (revenue.gt(0) ? " earn" : "") }>{ revenue.toFixed(2) }% APY · { toFancyMoney(Exchange.equityAsset, item.currentValue.multipliedBy(revenue.dividedBy(100 * 365))) }/day</span></span>
          </div>
        </button>
        <Collapsible.Content>
          <div className="dl dl-rule" style={{ marginTop: 14 }}>
            <div className="dl-row"><span className="dl-k">Delegator account</span><span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(item.delegatorAccount || 'NULL');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(item.delegatorAccount || 'NULL') }</span>
            <Link className="dl-open router-link" to={'/portfolio/' + item.delegatorAccount + '?view=wallet'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
            <div className="dl-row"><span className="dl-k">Market account</span><span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(item.marketAccount || 'NULL');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(item.marketAccount || 'NULL') }</span>
            <Link className="dl-open router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
            <div className="dl-row"><span className="dl-k">Primary asset</span><span className="dl-v">{ Assetlist.toName(item.primaryAsset) }</span></div>
            <div className="dl-row"><span className="dl-k">Secondary asset</span><span className="dl-v">{ Assetlist.toName(item.secondaryAsset) }</span></div>
            <div className="dl-row"><span className="dl-k">Revenue</span><span className="dl-v">{ toFancyMoney(Exchange.equityAsset, item.volume.multipliedBy(item.feeRate || DLP_DEFAULT_FEE_RATE_MAYBE), true) }</span></div>
            <div className="dl-row"><span className="dl-k">Liquidity</span><span className="dl-v">{ toFancyMoney(Exchange.equityAsset, item.currentValue) }</span></div>
            {
              extra.delegator &&
              <div className="dl-row"><span className="dl-k">TAN rewards</span><span className="dl-v">{ toFancyMoney(new AssetId(), extra.delegator.rewardEmission.dividedBy(extra.delegator.permissions.length).multipliedBy(86400000 / Chain.policy.BLOCK_TIME)) } per day</span></div>
            }
          </div>
          <Box my="4" className="dl-rule"></Box>
          <DlpAmount label={ Assetlist.toName(item.primaryAsset) } meta={ 'Available ' + toFancyMoney(item.primaryAsset, extra.primary) } asset={item.primaryAsset} value={primaryReserve} onChange={setPrimaryReserve} max={extra.primary} />
          <DlpAmount label={ Assetlist.toName(item.secondaryAsset) } meta={ 'Available ' + toFancyMoney(item.secondaryAsset, extra.secondary) } asset={item.secondaryAsset} value={secondaryReserve} onChange={setSecondaryReserve} max={extra.secondary} />
          <Flex pt="2">
            <PerformerButton name={ 'Deposit ' + (item.primaryAsset.token || item.primaryAsset.chain) + 'x' + (item.secondaryAsset.token || item.secondaryAsset.chain) + ' DLP' } title="Review deposit" description="Smart contract will add your deposit into the delegated LP and allocate your position" className="btn-brand btn-cta" color="jade" style={{ width: '100%' }} disabled={!payload || wrapPlan == null} onBuild={async () => {
              if (!payload)
                return null;
              const results: BuilderResult[] = [];
              for (const leg of (wrapPlan || []))
                results.push(await Builder.payUnifiedAsset({ pays: { [leg.entry.id]: leg.value.toString() }, marketId: item.marketId.toString(), primaryAssetHash: AssetId.fromHandle(leg.entry.chain || '').id, secondaryAssetHash: leg.target.id }));
              results.push(await Builder.depositLiquidity(payload));
              return results;
            }}></PerformerButton>
          </Flex>
          <Text size="1" className="dim" style={{ display: 'block', marginTop: 10, textAlign: 'center' }}>Deposits only · withdrawals are handled in the <Link className="router-link" to="?view=wallet">Wallet tab</Link></Text>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
}
