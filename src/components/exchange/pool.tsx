import { Badge, Box, Button, Card, DataList, Dialog, Flex, SegmentedControl, Select, Slider, Text, TextField, Tooltip } from "@radix-ui/themes";
import { AssetId, ByteUtil, Chain, LiquidityPool, Readability, TextUtil } from "tangentsdk";
import { Pool, Exchange, Balance, PseudoDelegatedPool, DelegatedPool } from "../../core/exchange";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { AlertBox, AlertType } from "../alert";
import { mdiArrowRight, mdiClose, mdiCurrencyUsd, mdiScaleBalance, mdiScaleUnbalanced } from "@mdi/js";
import { AssetImage } from "../asset";
import { PerformerButton, Builder, BuilderResult } from "./performer";
import { defaultMakerState } from "./maker";
import { AppData } from "../../core/app";
import { AppStorage } from "../../core/storage";
import { pathOfMaker } from "../../pages/exchange/orderbook";
import { useEffectAsync } from "../../core/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";

const DLP_DEFAULT_FEE_RATE_MAYBE = 0.0005;

function toRateColor(value: number) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const colorPalette = ['jade', 'green', 'teal', 'blue', 'cyan', 'orange', 'red'];
  const totalBuckets = colorPalette.length - 1;
  const stepSize = 100 / totalBuckets;
  let index = Math.floor(clampedValue / stepSize);
  return colorPalette[index % colorPalette.length];
}

export function PoolView(props: { item: Pool, open?: boolean, flash?: boolean, readOnly?: boolean }) {
  const item = props.item;
  const concentrated = item.minPrice?.gt(0) && item.maxPrice?.gt(0);
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(props.open || false);
  const [mode, setMode] = useState<'isolated-rebalancer' | 'cross-rebalancer' | 'closure'>('cross-rebalancer');
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
  const revenue = useMemo(() => Exchange.toAPY(item.feeRate, state.liquidity, item.volume), [item.feeRate, state.liquidity, item.volume]);
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

  const FullPoolView = (subprops: { open?: boolean }) => (
    <Collapsible.Root open={subprops.open || expanded}>
      <Flex justify="start" align="center" gap="3" className={subprops.open ? undefined : 'card-expander'} onClick={() => subprops.open ? undefined : setExpanded(!expanded)}>
        <Box style={{ position: 'relative' }}>
          <AssetImage asset={item.secondaryAsset} size="2" style={{ position: 'absolute', top: '24px', left: '-6px' }}></AssetImage>
          <AssetImage asset={item.primaryAsset} size="4"></AssetImage>
        </Box>
        <Box width="100%">
          <Flex justify="between" align="center">
            <Flex align="center">
              <Text size="2">{ item.primaryAsset.token || item.primaryAsset.chain }</Text>
              <Text size="2" color="gray">x</Text>
              <Text size="2">{ item.secondaryAsset.token || item.secondaryAsset.chain }</Text>
            </Flex>
            <Flex align="center" style={{ textDecoration: item.active ? undefined : 'line-through' }}>
              <Text size="2">{ Readability.toMoney(Exchange.equityAsset, state.liquidity) }</Text>
            </Flex>
          </Flex>
          <Flex justify="between" align="center">
            <Flex gap="2">
              <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ revenue.toFixed(2) }% APY</Badge>
              <Badge variant="soft" color={item.active ? undefined : 'gray'} size="2">{ Readability.toMoney(Exchange.equityAsset, state.liquidity.multipliedBy(revenue.dividedBy(100 * 365))) } per day</Badge>
            </Flex>
            <Tooltip content={`Market price deviation: market price ± ${item.feeRate.plus(0.01).multipliedBy(100).toFixed(2)}% delta, degraded LP's revenue may decrease, use reopen to optimize the dev factor`}>
              <Badge variant="soft" color={item.active ? toRateColor(state.staleness?.score || 0) as any : 'gray'} size="2">
                <Icon path={state.staleness?.score || 0 >= 0.8 ? mdiScaleUnbalanced : (item.active ? mdiScaleBalance : mdiClose)} size={0.65}></Icon>
                <Text>+{ (100 * (state.staleness?.dev || 0)).toFixed(1) }% dev</Text>
              </Badge>
            </Tooltip>
          </Flex>
        </Box>
      </Flex>
      <Collapsible.Content>
        <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
        <DataList.Root orientation={orientation}>
          <DataList.Item>
            <DataList.Label>Market account:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(item.marketAccount || 'NULL');
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(item.marketAccount || 'NULL') }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet-total-assets'}>▒▒</Link>
              </Box>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Primary asset:</DataList.Label>
            <DataList.Value>{ Readability.toAssetName(item.primaryAsset) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Secondary asset:</DataList.Label>
            <DataList.Value>{ Readability.toAssetName(item.secondaryAsset) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Reference:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(item.poolId.toString(16));
                AlertBox.open(AlertType.Info, 'Reference copied!')
              }}>0x{ item.poolId.toString(16).length > 8 ? Readability.toHash(item.poolId.toString(16), 6) : item.poolId.toString(16) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Status:</DataList.Label>
            <DataList.Value>
              <Badge color={item.active ? (inLowerRange && inUpperRange ? undefined : 'yellow') : 'gray'}>{ item.active ? (inLowerRange && inUpperRange ? (concentrated ? 'Active (fully in range)' : 'Active') : 'Partially active (out of range)') : 'Inactive' }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Spread:</DataList.Label>
            <DataList.Value>
              <Flex wrap="wrap" gap="2">
                { inLowerRange && <Badge>BID { Readability.toMoney(item.secondaryAsset, bidPrice) }</Badge> }
                { inUpperRange && <Badge color="red">ASK { Readability.toMoney(item.secondaryAsset, askPrice) }</Badge> }
              </Flex>
            </DataList.Value>
          </DataList.Item>
          {
            (item.primaryRevenue.gt(0) || item.secondaryRevenue.gt(0)) &&
            <DataList.Item>
              <DataList.Label>Fees:</DataList.Label>
              <DataList.Value>
                <Flex wrap="wrap" gap="2">
                  { item.primaryRevenue.gt(0) && <Badge>{ Readability.toMoney(item.primaryAsset, item.primaryRevenue) }</Badge> }
                  { item.secondaryRevenue.gt(0) && <Badge>{ Readability.toMoney(item.secondaryAsset, item.secondaryRevenue) }</Badge> }
                </Flex>
              </DataList.Value>
            </DataList.Item>
          }
          <DataList.Item>
            <DataList.Label>Revenue:</DataList.Label>
            <DataList.Value>
              <Flex wrap="wrap" gap="2">
                <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ Readability.toMoney(Exchange.equityAsset, state.absoluteRevenue, true) }</Badge> 
                <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ state.relativeRevenue.gt(0) ? '+' : '' }{ state.relativeRevenue.multipliedBy(100).toFixed(2) }%</Badge>
              </Flex>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Price:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.price) }</DataList.Value>
          </DataList.Item>
          {
            concentrated &&
            <DataList.Item>
              <DataList.Label>Price range:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.minPrice || null) } — { Readability.toMoney(item.secondaryAsset, item.maxPrice || null) }</DataList.Value>
            </DataList.Item>
          }
          <DataList.Item>
            <DataList.Label>{ Readability.toAssetSymbol(item.primaryAsset) } reserve:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.primaryAsset, item.primaryValue) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>{ Readability.toAssetSymbol(item.secondaryAsset) } reserve:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.secondaryValue) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Fee rate:</DataList.Label>
            <DataList.Value>{ item.feeRate.multipliedBy(100).toFixed(2) }%</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Exit fee:</DataList.Label>
            <DataList.Value>{ item.exitFee.multipliedBy(100).toFixed(2) }%</DataList.Value>
          </DataList.Item>
        </DataList.Root>
        {
          !props.flash && !props.readOnly && item.active &&
          <Flex justify="between" align="center" wrap="wrap" gap="4" mt="2">
            <Select.Root value={mode} onValueChange={(e) => setMode(e as any)}>
              <Select.Trigger variant="ghost" />
              <Select.Content>
                <Select.Group>
                  <Select.Label>Do</Select.Label>
                  <Select.Item value="cross-rebalancer">Cross reopen</Select.Item>
                  <Select.Item value="isolated-rebalancer">Reopen</Select.Item>
                  <Select.Item value="closure">Close</Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
            {
              mode == 'closure' &&
              <PerformerButton title="Do" description="Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" color="red" onBuild={() => {
                return Builder.withdrawPool({ poolId: item.id.toString() });
              }}></PerformerButton>
            }
            {
              mode == 'isolated-rebalancer' &&
              <PerformerButton title="Do" description="Smart contract will re-balance this pool based on current market price and pool liquidity" color="jade" onBuild={() => rebalance(false)}></PerformerButton>
            }
            {
              mode == 'cross-rebalancer' &&
              <PerformerButton title="Do" description="Smart contract will re-balance this pool based on current market price and pool liquidity plus available balance" onBuild={() => rebalance(true)}></PerformerButton>
            }
          </Flex>
        }
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
    <Card variant="surface" style={{ borderRadius: '22px', position: "relative" }}>
      {
        props.flash &&
        <Box>
          <Dialog.Root>
            <Dialog.Trigger>
              <Button variant="surface" color="gray" style={{ display: 'block', width: '100%', height: 'auto', padding: '4px', backgroundColor: 'transparent', boxShadow: 'none' }}>
                <Flex direction="column" gap="2">
                  <Flex justify="between" wrap="wrap" gap="1" style={{ textDecoration: inLowerRange ? undefined : 'line-through', color: 'var(--gray-11)' }}>
                    <Text size="2" style={{ color: 'var(--accent-11)' }}>Buy at</Text>
                    <Text size="2" style={{ color: 'var(--accent-11)' }}>≤ { Readability.toMoney(item.secondaryAsset, bidPrice) }</Text>
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1" style={{ textDecoration: inUpperRange ? undefined : 'line-through', color: 'var(--gray-11)' }}>
                    <Text size="2" color="red">Sell at</Text>
                    <Text size="2" color="red">≥ { Readability.toMoney(item.secondaryAsset, askPrice) }</Text>
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1">
                    <Text size="2" color="gray">With</Text>
                    <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(Exchange.equityAsset, state.liquidity) }</Text>
                  </Flex>
                </Flex>
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Pool #{item.poolId.toString().length > 8 ? Readability.toHash(item.poolId.toString(), 4) : item.poolId.toString()}</Dialog.Title>
              <FullPoolView open={true}></FullPoolView>
            </Dialog.Content>
          </Dialog.Root>
          {
            !props.readOnly && item.active &&
            <Flex justify="between" align="center" wrap="wrap" gap="4" pl="1" mt="1">
              <Select.Root value={mode} onValueChange={(e) => setMode(e as any)}>
                <Select.Trigger variant="ghost" />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Do</Select.Label>
                    <Select.Item value="cross-rebalancer">Cross reopen</Select.Item>
                    <Select.Item value="isolated-rebalancer">Reopen</Select.Item>
                    <Select.Item value="closure">Close</Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              {
                mode == 'closure' &&
                <PerformerButton title="Do" description="Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" color="red" onBuild={() => {
                  return Builder.withdrawPool({ poolId: item.id.toString() });
                }}></PerformerButton>
              }
              {
                mode == 'isolated-rebalancer' &&
                <PerformerButton title="Do" description="Smart contract will re-balance this pool based on current market price and pool liquidity" color="jade" onBuild={() => rebalance(false)}></PerformerButton>
              }
              {
                mode == 'cross-rebalancer' &&
                <PerformerButton title="Do" description="Smart contract will re-balance this pool based on current market price and pool liquidity plus available balance" onBuild={() => rebalance(true)}></PerformerButton>
              }
            </Flex>
          }
        </Box>
      }
      {
        !props.flash &&
        <Box px="1" py="1">
          <FullPoolView></FullPoolView>
        </Box>
      }
    </Card>
  );
}

export function DelegatedPoolView(props: { item: DelegatedPool, readOnly?: boolean }) {
  const item = props.item;
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('withdraw');
  const [assets, setAssets] = useState<{ primary: BigNumber, secondary: BigNumber } | null>(null);
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
      primary: assets?.primary || new BigNumber(0),
      secondary: assets?.secondary || new BigNumber(0),
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
  useEffectAsync(async () => {
    if (!props.readOnly && !assets && mode == 'deposit') {
      const address = AppData.getWalletAddress();
      if (address) {
        try {
          const results = await Exchange.accountBalances({ address: address });
          setAssets({
            primary: results.find((v) => v.asset.id == item.primaryAsset.id)?.available || new BigNumber(0),
            secondary: results.find((v) => v.asset.id == item.secondaryAsset.id)?.available || new BigNumber(0),
          });
        } catch { }
      }
    }
  }, [mode, item, assets, props.readOnly]);

  return (
    <Card variant="surface" style={{ borderRadius: '22px', position: "relative" }}>
      <Collapsible.Root open={expanded}>
        <Flex justify="start" align="center" gap="3" className="card-expander" onClick={() => setExpanded(!expanded)}>
          <Box style={{ position: 'relative' }}>
            <AssetImage asset={item.secondaryAsset} size="2" style={{ position: 'absolute', top: '24px', left: '-6px' }}></AssetImage>
            <AssetImage asset={item.primaryAsset} size="4"></AssetImage>
          </Box>
          <Box width="100%">
            <Flex justify="between" align="center">
              <Flex align="center">
                <Text size="2">{ item.primaryAsset.token || item.primaryAsset.chain }</Text>
                <Text size="2" color="gray">x</Text>
                <Text size="2">{ item.secondaryAsset.token || item.secondaryAsset.chain }</Text>
              </Flex>
              <Flex align="center" style={{ textDecoration: item.active ? undefined : 'line-through' }}>
                <Text size="2">{ Readability.toMoney(Exchange.equityAsset, state.currentLiquidity) }</Text>
              </Flex>
            </Flex>
            <Flex gap="2">
              <Badge color={item.active ? 'purple' : 'gray'} variant="soft" size="2">{ revenue.toFixed(2) }% APY</Badge>
              <Badge color={item.active ? undefined : 'gray'} variant="soft" size="2">{ Readability.toMoney(Exchange.equityAsset, state.currentLiquidity.multipliedBy(revenue.dividedBy(100 * 365))) } per day</Badge>
            </Flex>
          </Box>
        </Flex>
        <Collapsible.Content>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <DataList.Root orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Delegator account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(item.delegatorAccount || 'NULL');
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(item.delegatorAccount || 'NULL') }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/portfolio/' + item.delegatorAccount + '?view=wallet-total-assets'}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Market account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(item.marketAccount || 'NULL');
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(item.marketAccount || 'NULL') }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet-total-assets'}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Primary asset:</DataList.Label>
              <DataList.Value>{ Readability.toAssetName(item.primaryAsset) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Secondary asset:</DataList.Label>
              <DataList.Value>{ Readability.toAssetName(item.secondaryAsset) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Status:</DataList.Label>
              <DataList.Value>
                <Badge color={item.active ? undefined : 'gray'}>{ item.active ? 'Active' : 'Inactive' }</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Share:</DataList.Label>
              <DataList.Value>{ item.share.multipliedBy(100).toFixed(2) }%</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Revenue (est.):</DataList.Label>
              <DataList.Value>
                <Flex wrap="wrap" gap="2">
                  <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ Readability.toMoney(Exchange.equityAsset, state.absoluteRevenue, true) }</Badge> 
                  <Badge variant="soft" color={item.active ? 'purple' : 'gray'} size="2">{ state.relativeRevenue.gt(0) ? '+' : '' }{ state.relativeRevenue.multipliedBy(100).toFixed(2) }%</Badge>
                </Flex>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>{ Readability.toAssetSymbol(item.primaryAsset) } reserve (est.):</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.primaryAsset, item.primaryValue) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>{ Readability.toAssetSymbol(item.secondaryAsset) } reserve (est.):</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.secondaryValue) }</DataList.Value>
            </DataList.Item>
            <Tooltip content="TAN subsidy gets allocated based on DLP position share each time underlying LP gets rebalanced">
              <DataList.Item>
                <DataList.Label>{ Readability.toAssetSymbol(new AssetId()) }:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(new AssetId(), item.rewardValue) }</DataList.Value>
              </DataList.Item>
            </Tooltip>
          </DataList.Root>
          {
            item.active &&
            <>
              <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
              <Tooltip side="left" content={`Reserve value in ${Readability.toAssetSymbol(item.primaryAsset)} to ${mode}`}>
                <Box mb="3">
                  <TextField.Root placeholder={Readability.toAssetName(item.primaryAsset) + ' to ' + mode} size="2" value={primaryReserve} onChange={(e) => setPrimaryReserve(TextUtil.toValue(primaryReserve, e.target.value))}>
                    <TextField.Slot>
                      <Icon path={mdiCurrencyUsd} size={0.8} />
                    </TextField.Slot>
                  </TextField.Root>
                  <Box px="2" pt="2">
                    <Slider color={slider.primary.overpulling ? 'red' : undefined} step={1} value={slider.primary.value} onValueChange={(v) => setPrimaryReserve(new BigNumber(v[0] / 100).multipliedBy(extra.primary).toString())} />
                  </Box>
                </Box>
              </Tooltip>
              <Tooltip side="left" content={`Reserve value in ${Readability.toAssetSymbol(item.secondaryAsset)} to ${mode}`}>
                <Box mb="3">
                  <TextField.Root placeholder={Readability.toAssetName(item.secondaryAsset) + ' to ' + mode} size="2" value={secondaryReserve} onChange={(e) => setSecondaryReserve(TextUtil.toValue(secondaryReserve, e.target.value))}>
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
              <Flex pt="2" justify="between">
                <SegmentedControl.Root value={mode} radius="full" size="2" onValueChange={(value) => setMode(value as any)}>
                  <SegmentedControl.Item value="deposit">Push</SegmentedControl.Item>
                  <SegmentedControl.Item value="withdraw">Pull</SegmentedControl.Item>
                </SegmentedControl.Root>
                <PerformerButton title="Do" description={mode == 'deposit' ? "Smart contract will add your deposit into the delegated LP and allocate your position" : "Smart contract will re-pay your deposit and deallocate the position"} color={mode == 'deposit' ? 'jade' : 'red'} disabled={!payload} onBuild={async () => {      
                  return payload ? (mode == 'deposit' ? await Builder.depositLiquidity(payload) : await Builder.withdrawLiquidity(payload)) : null;
                }}></PerformerButton>
              </Flex>
            </>
          }
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
}

export function PseudoDelegatedPoolView(props: { item: PseudoDelegatedPool, assets: Balance[] }) {
  const item = props.item;
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
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
    <Card variant="surface" style={{ borderRadius: '22px', position: "relative" }}>
      <Collapsible.Root open={expanded}>
        <Flex justify="start" align="center" gap="2" className="card-expander" onClick={() => setExpanded(!expanded)}>
          <Box style={{ position: 'relative' }}>
            <AssetImage asset={item.secondaryAsset} size="2" style={{ position: 'absolute', top: '24px', left: '-6px' }}></AssetImage>
            <AssetImage asset={item.primaryAsset} size="4"></AssetImage>
          </Box>
          <Box width="100%">
            <Flex justify="between" align="center">
              <Flex align="center">
                <Text size="2">{ item.primaryAsset.token || item.primaryAsset.chain }</Text>
                <Text size="2" color="gray">x</Text>
                <Text size="2">{ item.secondaryAsset.token || item.secondaryAsset.chain }</Text>
              </Flex>
              <Flex align="center">
                <Text size="2">{ Readability.toMoney(Exchange.equityAsset, item.currentValue) }</Text>
              </Flex>
            </Flex>
            <Flex justify="between" align="center" gap="2" pt="1" wrap="wrap">
              <Flex gap="2">
                <Badge color="purple" variant="soft" size="2">{ revenue.toFixed(2) }% APY</Badge>
                <Badge variant="soft" size="2">{ Readability.toMoney(Exchange.equityAsset, item.currentValue.multipliedBy(revenue.dividedBy(100 * 365))) } per day</Badge>
              </Flex>
              <Badge variant="soft" color="jade" size="2">{ item.delegatorAccount.substring(item.delegatorAccount.length - 6) }</Badge>
            </Flex>
          </Box>
        </Flex>
        <Collapsible.Content>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <DataList.Root orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Delegator account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(item.delegatorAccount || 'NULL');
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(item.delegatorAccount || 'NULL') }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/portfolio/' + item.delegatorAccount + '?view=wallet-total-assets'}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Market account:</DataList.Label>
              <DataList.Value>
                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                  navigator.clipboard.writeText(item.marketAccount || 'NULL');
                  AlertBox.open(AlertType.Info, 'Address copied!')
                }}>{ Readability.toAddress(item.marketAccount || 'NULL') }</Button>
                <Box ml="2">
                  <Link className="router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet-total-assets'}>▒▒</Link>
                </Box>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Primary asset:</DataList.Label>
              <DataList.Value>{ Readability.toAssetName(item.primaryAsset) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Secondary asset:</DataList.Label>
              <DataList.Value>{ Readability.toAssetName(item.secondaryAsset) }</DataList.Value>
            </DataList.Item>
            {
              extra.delegator &&
              <DataList.Item>
                <DataList.Label>TAN subsidy:</DataList.Label>
                <DataList.Value>{ Readability.toMoney(new AssetId(), extra.delegator.rewardEmission.dividedBy(extra.delegator.permissions.length).multipliedBy(86400000 / Chain.policy.BLOCK_TIME)) } per day</DataList.Value>
              </DataList.Item>
            }
            <DataList.Item>
              <DataList.Label>Liquidity:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(Exchange.equityAsset, item.currentValue) }</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Revenue:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(Exchange.equityAsset, item.currentValue.minus(item.initialValue)) }</DataList.Value>
            </DataList.Item>
          </DataList.Root>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <Tooltip side="left" content={`Reserve value in ${Readability.toAssetSymbol(item.primaryAsset)} to deposit`}>
            <Box mb="3">
              <TextField.Root placeholder={Readability.toAssetName(item.primaryAsset) + ' deposit'} size="2" value={primaryReserve} onChange={(e) => setPrimaryReserve(TextUtil.toValue(primaryReserve, e.target.value))}>
                <TextField.Slot>
                  <Icon path={mdiCurrencyUsd} size={0.8} />
                </TextField.Slot>
              </TextField.Root>
              <Box px="2" pt="2">
                <Slider step={1} value={[extra.primary.gt(0) ? new BigNumber(primaryReserve || '0').multipliedBy(100).dividedBy(extra.primary).toNumber() : 0]} onValueChange={(v) => setPrimaryReserve(new BigNumber(v[0] / 100).multipliedBy(extra.primary).toString())} />
              </Box>
            </Box>
          </Tooltip>
          <Tooltip side="left" content={`Reserve value in ${Readability.toAssetSymbol(item.secondaryAsset)} to deposit`}>
            <Box mb="3">
              <TextField.Root placeholder={Readability.toAssetName(item.secondaryAsset) + ' deposit'} size="2" value={secondaryReserve} onChange={(e) => setSecondaryReserve(TextUtil.toValue(secondaryReserve, e.target.value))}>
                <TextField.Slot>
                  <Icon path={mdiCurrencyUsd} size={0.8} />
                </TextField.Slot>
              </TextField.Root>
              <Box px="2" pt="2">
                <Slider step={1} value={[extra.secondary.gt(0) ? new BigNumber(secondaryReserve || '0').multipliedBy(100).dividedBy(extra.secondary).toNumber() : 0]} onValueChange={(v) => setSecondaryReserve(new BigNumber(v[0] / 100).multipliedBy(extra.secondary).toString())} />
              </Box>
            </Box>
          </Tooltip>
          <Flex pt="2" justify="center">
            <PerformerButton title="Deposit" description="Smart contract will add your deposit into the delegated LP and allocate your position" color="jade" disabled={!payload} onBuild={async () => {
              return payload ? await Builder.depositLiquidity(payload) : null;
            }}></PerformerButton>
          </Flex>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
}