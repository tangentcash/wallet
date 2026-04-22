import { Badge, Box, Button, Card, Flex, Heading, SegmentedControl, Tabs, Text, TextField, Tooltip } from "@radix-ui/themes";
import { Link, useNavigate, useParams } from "react-router";
import { AppData } from "../../core/app";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Exchange, AccountTier, AggregatedLevel, AggregatedMatch, AggregatedPair, Market, MarketPolicy, Order, OrderCondition, OrderSide, Balance, Pool } from "../../core/exchange";
import { useEffectAsync } from "../../core/react";
import { CrosshairMode, PriceScaleMode } from "lightweight-charts";
import { mdiAlert, mdiArrowRightThin, mdiCheck, mdiCurrencyUsd } from "@mdi/js";
import { AlertBox, AlertType } from "../../components/alert";
import { AssetId, Readability, Whitelist } from "tangentsdk";
import { Storage } from "../../core/storage";
import { Maker } from "../../components/exchange/maker";
import { AssetImage } from "../../components/asset";
import { ChartViewType, ChartWidget, SeriesOptions, PriceScope } from "../../components/exchange/chart";
import BigNumber from "bignumber.js";
import OrderView from "../../components/exchange/order";
import Icon from "@mdi/react";
import Clock from "../../components/exchange/clock";
import PoolView from "../../components/exchange/pool";

type AggregatedGroupedLevel = {
  ids: number[],
  price: BigNumber,
  quantity: BigNumber
}

function reduceLevels(levels: (AggregatedGroupedLevel | AggregatedLevel)[], range: number): AggregatedGroupedLevel[] {
  const groups: Record<string, AggregatedGroupedLevel> = { };
  levels.forEach((level) => {
    const dynamicLevel: any = level;
    const dynamicIds: number[] = Array.isArray(dynamicLevel.ids) ? [...dynamicLevel.ids] : [dynamicLevel.id];
    const price = range > 0 ? level.price.dividedBy(range).integerValue().multipliedBy(range) : level.price;
    const target = groups[price.toString()];
    if (!target) {
      groups[price.toString()] = {
        ids: dynamicIds,
        price: new BigNumber(price),
        quantity: new BigNumber(level.quantity)
      };
    } else {
      target.ids = target.ids.concat(dynamicIds);
      target.quantity = target.quantity.plus(level.quantity);
    }
  });
  return Object.values(groups);
}
function policyOf(market: Market | null): string {
    switch (market ? market.marketPolicy.toNumber() : -1) {
      case MarketPolicy.Spot:
        return 'Spot';
      case MarketPolicy.Margin:
        return 'Margin';
      default:
        return 'Unknown';
    }
}
function pathOfOrderbook(orderbook: string): string {
  return `__orderbook:${orderbook}__`;
}
function pathOfOrder(orderbook: string): string {
  return `__order:${orderbook}__`;
}

let accountUpdateId: any = null;

export default function OrderbookPage() {
  const params = useParams();
  const navigate = useNavigate();
  const mobile = document.body.clientWidth <= 800;
  const [blockNumber, setBlockNumber] = useState<number>(AppData.tip?.toNumber() || 0)
  const [whitelisted, setWhitelisted] = useState<boolean | null>(null);
  const [showingPools, setShowingPools] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [preset, setPreset] = useState<{ id: number, condition: OrderCondition, side: OrderSide, price: string } | null>(null);
  const [tab, setTab] = useState<'info' | 'order' | 'book' | 'trades'>(mobile ? 'info' : 'order');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [levels, setLevels] = useState<{ ask: AggregatedGroupedLevel[], bid: AggregatedGroupedLevel[] }>({ ask: [], bid: [] })
  const [polyBalances, setPolyBalances] = useState<{ primary: Balance[], secondary: Balance[] }>({ primary: [], secondary: [] });
  const [tiers, setTiers] = useState<AccountTier | null>(null);
  const [pair, setPair] = useState<AggregatedPair | null>(null);
  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<AggregatedMatch[]>([]);
  const [_, setPolyAssets] = useState<{ primary: AssetId[], secondary: AssetId[] }>({ primary: [], secondary: [] });
  const [incomingTrades, setIncomingTrades] = useState<CustomEvent<any>[]>([]);
  const [incomingLevels, setIncomingLevels] = useState<CustomEvent<any>[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<SeriesOptions>({
    intervals: [
      [2628000, "1M"],
      [604800, "1W"],
      [259200, "3D"],
      [86400, "1D"],
      [14400, "4H"],
      [3600, "1H"],
      [1800, "30m"],
      [900, "15m"],
      [300, "5m"],
      [60, "1m"]
    ],
    interval: 3600,
    bars: 512,
    priceLevel: '',
    priceScope: PriceScope.All,
    view: ChartViewType.Candles,
    price: PriceScaleMode.Normal,
    crosshair: CrosshairMode.Normal,
    volume: false,
    inverted: false,
    showPrimary: true
  });
  const orderbook = useMemo(() => {
    if (!params.orderbook)
      return null;
    
    Exchange.setOrderbook(params.orderbook);
    return Exchange.fromOrderbookQuery(params.orderbook);
  }, [params]);
  const orderPath = useMemo(() => {
    return params.orderbook ? pathOfOrder(params.orderbook) : undefined;
  }, [params]);
  const liquidity = useMemo(() => {
    return {
      ask: levels.ask.reduce((a, b) => [a[0].plus(b.quantity), a[1].plus(b.price.multipliedBy(b.quantity))], [new BigNumber(0), new BigNumber(0)]),
      bid: levels.bid.reduce((a, b) => [a[0].plus(b.quantity), a[1].plus(b.price.multipliedBy(b.quantity))], [new BigNumber(0), new BigNumber(0)]),
    };
  }, [levels]);
  const spreads = useMemo((): { ask: BigNumber | null, bid: BigNumber | null } => {
    return {
      ask: levels.ask.length > 0 ? levels.ask[0].price : null,
      bid: levels.bid.length > 0 ? levels.bid[0].price : null
    }
  }, [levels]);
  const balances = useMemo((): { primary: { price: BigNumber | null, value: BigNumber }, secondary: { price: BigNumber | null, value: BigNumber } } => {
    const primaryBalance = polyBalances.primary.reduce((p, n) => ({ p: n.price ? (p.p.isNaN() ? n.price : p.p.plus(n.price).div(2)) : p.p, v: p.v.plus(n.available) }), { p: new BigNumber(NaN), v: new BigNumber(0) });
    const secondaryBalance = polyBalances.secondary.reduce((p, n) => ({ p: n.price ? (p.p.isNaN() ? n.price : p.p.plus(n.price).div(2)) : p.p, v: p.v.plus(n.available) }), { p: new BigNumber(NaN), v: new BigNumber(0) });
    return {
      primary: { price: primaryBalance.p.isNaN() ? null : primaryBalance.p, value: primaryBalance.v },
      secondary: { price: secondaryBalance.p.isNaN() ? null : secondaryBalance.p, value: secondaryBalance.v },
    };
  }, [polyBalances]);
  const valuation = useMemo(() => {
    const rate = pair ? Exchange.priceOf(seriesOptions.showPrimary ? pair.secondaryAsset : pair.primaryAsset)?.close : null;
    const basePrice = rate ? (seriesOptions.showPrimary ? balances.primary.price : balances.secondary.price)?.dividedBy(rate) || null : null;
    const currentPrice = rate ? (seriesOptions.showPrimary ? pair?.price.close : (pair?.price.close ? new BigNumber(1).dividedBy(pair.price.close) : null)) || null : null;
    const quantity = seriesOptions.showPrimary ? balances.primary.value : balances.secondary.value;
    const worth = currentPrice ? quantity.multipliedBy(currentPrice) : null;
    const relativePL = currentPrice && basePrice ? currentPrice.minus(basePrice).dividedBy(basePrice) : new BigNumber(0);
    return {
      primary: (seriesOptions.showPrimary ? pair?.primaryAsset : pair?.secondaryAsset) || AssetId.fromHandle('?'),
      secondary: (seriesOptions.showPrimary ? pair?.secondaryAsset : pair?.primaryAsset) || AssetId.fromHandle('?'),
      basePrice: basePrice,
      currentPrice: currentPrice,
      quantity: quantity,
      worth: worth,
      absolutePL: worth?.multipliedBy(relativePL) || null,
      relativePL: relativePL
    }
  }, [seriesOptions.showPrimary, pair, balances]);
  const groupedLevels = useMemo(() => {
    const range = parseFloat(seriesOptions.priceLevel);
    if (range <= 0 || isNaN(range))
      return levels;

    return {
      ask: reduceLevels(levels.ask, range).sort((a, b) => a.price.minus(b.price).toNumber()),
      bid: reduceLevels(levels.bid, range).sort((a, b) => b.price.minus(a.price).toNumber())
    }
  }, [seriesOptions.priceLevel, levels]);
  const updatePreset = useCallback((side: OrderSide, price: BigNumber) => {
    setPreset({
      id: (preset?.id || 0) + 1,
      condition: OrderCondition.Limit,
      side: side,
      price: price.toString()
    });
    setTab('order');
  }, [preset]);
  const updateSeriesOptions = useCallback((change: (prev: any) => any) => {
    setSeriesOptions(prev => {
      const result = change(prev);
      if (typeof params.orderbook == 'string' && params.orderbook.length > 0)
        Storage.set(pathOfOrderbook(params.orderbook), result);
      return result;
    });
  }, [params]);
  const updateIncomingTrades = useCallback((trades: AggregatedMatch[]) => {
    setIncomingTrades([]);
    if (trades.length > 0)
      setTrades(prev => ([...prev, ...trades]));
  }, []);
  useEffectAsync(async () => {
    setLoading(true);
    try {
      if (!orderbook || !orderbook.marketId || !orderbook.primaryAsset || !orderbook.secondaryAsset)
        throw false;
      
      const result = await Exchange.marketPair(orderbook.marketId, orderbook.primaryAsset, orderbook.secondaryAsset, false);
      if (!result)
        throw false;

      setPair(result);
      if (typeof params.orderbook == 'string' && params.orderbook.length > 0) {
        const memorizedSeriesOptions = Storage.get(pathOfOrderbook(params.orderbook));
        if (memorizedSeriesOptions != null && typeof memorizedSeriesOptions == 'object') {
          setSeriesOptions(prev => ({ ...prev, ...memorizedSeriesOptions }));
        }
      }
      
      const marketId = orderbook.marketId;
      const updateAccount = async () => {
        const account = AppData.getWalletAddress();
        if (!account)
          return;

        const ordersResult = Exchange.accountOrders({ marketId: marketId, pairId: result.id, address: account, active: true });
        const poolsResults = Exchange.accountPools({ marketId: marketId, pairId: result.id, address: account, active: true });
        const tiersResult = Exchange.accountTiers({ marketId: marketId, pairId: result.id, address: account });
        const balancesResult = Exchange.accountBalances({ address: account });
        try {
          setOrders(await ordersResult || []);
        } catch {  }

        try {
          setPools(await poolsResults || []);
        } catch {  }

        try {
          setTiers(await tiersResult);
        } catch { }

        try {
          const accountBalances = await balancesResult;
          setPolyAssets((poly) => {
            setPolyBalances({
              primary: accountBalances?.filter((v) => v.asset.id == result.primaryAsset.id || poly.primary.findIndex((i) => i.id == v.asset.id) != -1),
              secondary: accountBalances?.filter((v) => v.asset.id == result.secondaryAsset.id || poly.secondary.findIndex((i) => i.id == v.asset.id) != -1)
            });
            return poly;
          });
        } catch { }
      };
      const marketResult = Exchange.market(orderbook.marketId);
      const levelsResult = Exchange.marketPairPriceLevels(orderbook.marketId, result.id, 128);
      const assetsResult = Exchange.marketPairAssets(orderbook.marketId, result.id);
      const tradesResult = Exchange.marketPairTrades({ marketId: orderbook.marketId, pairId: result.id });
      try {
        setMarket(await marketResult);
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch market data: ' + (exception.message || 'unknown error'));
      }

      try {
        const marketLevels = await levelsResult;
        setLevels({
          ask: reduceLevels(marketLevels?.ask || [], 0).sort((a, b) => a.price.minus(b.price).toNumber()),
          bid: reduceLevels(marketLevels?.bid || [], 0).sort((a, b) => b.price.minus(a.price).toNumber())
        });
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch orderbook: ' + (exception.message || 'unknown error'));
      }

      try {
        const assetsData = await assetsResult;
        if (assetsData != null)
          setPolyAssets(assetsData);
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch market poly assets: ' + (exception.message || 'unknown error'));
      }

      try {
        const tradesData = await tradesResult;
        if (tradesData != null) {
          setTrades(tradesData);
        }
      } catch (exception: any) {
        AlertBox.open(AlertType.Error, 'Failed to fetch market trades: ' + (exception.message || 'unknown error'));
      }

      await updateAccount();
      setWhitelisted(!!Whitelist.contractAddressOf(result.primaryAsset) && !!Whitelist.contractAddressOf(result.secondaryAsset));
      setLoading(false);

      const updateAccountReactive = () => {
        if (accountUpdateId != null)
          clearTimeout(accountUpdateId);
        accountUpdateId = setTimeout(() => updateAccount(), 500);
      };
      window.addEventListener('update:order', updateAccountReactive);
      window.addEventListener('update:pool', updateAccountReactive);
      return () => {
        window.removeEventListener('update:pool', updateAccountReactive);
        window.removeEventListener('update:order', updateAccountReactive);
      };
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Failed to fetch market: ' + (exception.message || 'unknown error'));
      navigate(Exchange.location);
    }
  }, [orderbook]);
  useEffect(() => {
    if (!incomingLevels.length)
      return;

    setIncomingLevels([]);
    setLevels(prev => {
      const copy = { ask: [...prev.ask], bid: [...prev.bid] };
      for (let i = 0; i < incomingLevels.length; i++) {
        const data = incomingLevels[i].detail || null;
        const id = data && data.id != null ? parseInt(data.id) : NaN;
        if (isNaN(id))
          continue;

        if (data.side != null && data.price != null && data.quantity != null) {
          const target = data.side == OrderSide.Buy ? copy.bid : copy.ask;
          const index = target.findIndex((v) => v.ids.indexOf(id) !== -1);
          if (index == -1) {
            target.push({
              ids: [id],
              price: new BigNumber(data.price),
              quantity: new BigNumber(data.quantity)
            });
          } else {
            const level = target[index];
            level.price = new BigNumber(data.price);
            level.quantity = new BigNumber(data.quantity);
          }
        } else {
          const askIndex = copy.ask.findIndex((v) => v.ids.indexOf(id) !== -1);
          const bidIndex = copy.bid.findIndex((v) => v.ids.indexOf(id) !== -1);
          if (askIndex != -1) {
            const ask = copy.ask[askIndex];
            ask.ids.splice(ask.ids.indexOf(id), 1);
            if (!ask.ids.length)
              copy.ask.splice(askIndex, 1);
          }
          if (bidIndex != -1) {
            const bid = copy.bid[bidIndex];
            bid.ids.splice(bid.ids.indexOf(id), 1);
            if (!bid.ids.length)
              copy.bid.splice(bidIndex, 1);
          }
        }
      }
      copy.ask = reduceLevels(copy.ask, 0).sort((a, b) => a.price.minus(b.price).toNumber());
      copy.bid = reduceLevels(copy.bid, 0).sort((a, b) => b.price.minus(a.price).toNumber());
      return copy;
    });
  }, [incomingLevels]);
  useEffect(() => {
    const updateChain = (event: any) => setBlockNumber(event.detail.tip);
    const updateTrades = (event: any) => setIncomingTrades(prev => ([...prev, event]));
    const updateLevels = (event: any) => setIncomingLevels(prev => ([...prev, event]));
    window.addEventListener('update:chain', updateChain);
    window.addEventListener('update:trade', updateTrades);
    window.addEventListener('update:level', updateLevels);
    return () => {
      window.removeEventListener('update:level', updateLevels);
      window.removeEventListener('update:trade', updateTrades);
      window.removeEventListener('update:chain', updateChain);
    };
  }, []);

  return (
    <Box minWidth={mobile ? undefined : '800px'}>
      <Box px={mobile ? undefined : '3'} py={mobile ? undefined : '4'} width="100%" maxWidth="1560px" mx="auto">
        <Flex gap="3" align="start">
          {
            !mobile &&
            <ChartWidget 
              orderbook={orderbook}
              pair={pair}
              blockNumber={blockNumber}
              whitelisted={whitelisted}
              options={seriesOptions}
              tradeEvents={incomingTrades}
              onOptionsChange={updateSeriesOptions}
              onTradesChange={updateIncomingTrades}
              onPairChange={setPair}></ChartWidget>
          }
          <Box width={ mobile ? '100%' : '460px'}>
            <Tabs.Root value={tab} onValueChange={(e) => {
              setTab(e as any);
              if (e != 'order')
                setPreset(null);
            }}>
              <Tabs.List size="2" justify="center" color="lime" style={mobile ? { paddingTop: '20px' } : { }}>
                <Tabs.Trigger value="info" className="tab-padding-erase">
                  <Badge size="3" radius="large" style={mobile ? { fontSize: '1.15rem' } : undefined}>Market</Badge>
                </Tabs.Trigger>
                <Tabs.Trigger value="order" className="tab-padding-erase">
                  <Badge size="3" radius="large" style={mobile ? { fontSize: '1.15rem' } : undefined}>Trade</Badge>
                </Tabs.Trigger>
                <Tabs.Trigger value="book" className="tab-padding-erase">
                  <Badge size="3" radius="large" style={mobile ? { fontSize: '1.15rem' } : undefined}>Book</Badge>
                </Tabs.Trigger>
                <Tabs.Trigger value="trades" className="tab-padding-erase">
                  <Badge size="3" radius="large" style={mobile ? { fontSize: '1.15rem' } : undefined}>Log</Badge>
                </Tabs.Trigger>
              </Tabs.List>
              <Clock></Clock>
              <Box pt={mobile ? '1' : '3'}>
                <Tabs.Content value="info">
                  {
                    mobile &&
                    <ChartWidget 
                      orderbook={orderbook}
                      pair={pair}
                      blockNumber={blockNumber}
                      whitelisted={whitelisted}
                      options={seriesOptions}
                      tradeEvents={incomingTrades}
                      onOptionsChange={updateSeriesOptions}
                      onTradesChange={updateIncomingTrades}
                      onPairChange={setPair}></ChartWidget>
                  }
                  {
                    orderbook?.primaryAsset && orderbook.secondaryAsset && 
                    <Box px={mobile ? '3' : undefined} pt={mobile ? '2' : undefined}>
                      <Card mb={mobile ? '5' : '3'} variant="surface" style={{ borderRadius: '22px' }}>
                        <Flex align="center" justify="between" mb="3">
                          <Heading size="5">Wallet P&L</Heading>
                          <SegmentedControl.Root size="1" value={seriesOptions.showPrimary ? '1' : '0'} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, showPrimary: parseInt(e) > 0 }))}>
                            <SegmentedControl.Item value="1">
                              <Flex align="center">
                                <AssetImage asset={orderbook.primaryAsset} size="1" iconSize="16px"></AssetImage>
                              </Flex>
                            </SegmentedControl.Item>
                            <SegmentedControl.Item value="0">
                              <Flex align="center">
                                <AssetImage asset={orderbook.secondaryAsset} size="1" iconSize="16px"></AssetImage>
                              </Flex>
                            </SegmentedControl.Item>
                          </SegmentedControl.Root>
                        </Flex>
                        <Flex direction="column">
                          <Text size="2" color="gray">{ Readability.toAssetSymbol(valuation.primary) } balance of wallet</Text>
                          <Text size="4">{ Readability.toMoney(valuation.primary, valuation.quantity) }</Text>
                        </Flex>
                        <Flex gap="1" align="center">
                          <Text size="2" color="gray">{ Readability.toValue(null, valuation.basePrice, false, true) }</Text>
                          <Icon path={mdiArrowRightThin} size={0.8}></Icon>
                          <Text size="2" color="gray">{ Readability.toValue(null, valuation.currentPrice, false, true) }</Text>
                        </Flex>
                        <Flex direction="column" mt="4">
                          <Text size="2" color="gray">{ Readability.toAssetSymbol(valuation.secondary) } cost of { Readability.toAssetSymbol(valuation.primary) }</Text>
                          <Text size="4">{ Readability.toMoney(valuation.secondary, valuation.worth) }</Text>
                          <Text size="2" color={valuation.relativePL.gt(0) ? 'lime' : (valuation.relativePL.lt(0) ? 'red' : 'gray')}>{ Readability.toValue(null, valuation.absolutePL, true, true) } ({ valuation.relativePL.gt(0) ? '+' : '' }{ valuation.relativePL.multipliedBy(100).toFixed(2) }%)</Text>
                        </Flex>
                      </Card>
                      <Card mb="3" variant="surface" style={{ borderRadius: '22px' }}>
                        <Heading mb="3" size="5">Market P&L</Heading>
                        <Flex direction="column" gap="2">
                          <Flex justify="between" wrap="wrap" gap="1">
                            <Text size="2" color="gray">Pair</Text>
                            <Flex gap="1">
                              <Flex gap="2" align="center">
                                <AssetImage asset={orderbook.primaryAsset} size="1" iconSize="16px"></AssetImage>
                                <Text>{ Readability.toAssetSymbol(orderbook.primaryAsset) }</Text>
                              </Flex>
                              <Text>/</Text>
                              <Flex gap="2" align="center">
                                <AssetImage asset={orderbook.secondaryAsset} size="1" iconSize="16px"></AssetImage>
                                <Text>{ Readability.toAssetSymbol(orderbook.secondaryAsset) }</Text>
                              </Flex>
                            </Flex>
                          </Flex>
                          <Tooltip side="left" content="Risk metric based on asset pair combination">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Risk</Text>
                              <Text size="2" style={{ color: whitelisted === true ? 'var(--lime-11)' : (whitelisted === false ? 'var(--red-11)' : 'var(--gray-11)') }}>
                                { typeof whitelisted == 'boolean' && <Icon path={whitelisted === true ? mdiCheck : mdiAlert} color={whitelisted === true ? 'var(--lime-10)' : 'var(--yellow-9)'} size={0.7} style={{ transform: 'translateY(3px)', marginRight: '5px' }}></Icon> }
                                { whitelisted === true ? 'Low risk pair' : (whitelisted === false ? 'High risk pair' : 'Loading...') }
                              </Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Smart contract address that facilitates the trading">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">{ policyOf(market) }</Text>
                              <Flex>
                                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                  navigator.clipboard.writeText(market?.account || 'NULL');
                                  AlertBox.open(AlertType.Info, 'Program account address copied!')
                                }}>{ Readability.toAddress(market?.account || 'NULL', 5) }</Button>
                                <Box ml="2">
                                  <Link className="router-link" to={'/portfolio/' + market?.account}>▒▒</Link>
                                </Box>
                              </Flex>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Price at the start of the day">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Open</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook.secondaryAsset, pair?.price.open || null) }</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Price at current time">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Close</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook.secondaryAsset, pair?.price.close || null) }</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Absolute difference between price open and price close">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Delta</Text>
                              <Text size="2" color={ (pair?.price.open || new BigNumber(0)).gt(pair?.price.close || new BigNumber(0)) ? 'red' : ((pair?.price.open || new BigNumber(0)).eq(pair?.price.close || new BigNumber(0)) ? undefined : 'lime') }>{ Readability.toMoney(orderbook.secondaryAsset, (pair?.price.close || new BigNumber(0)).minus(pair?.price.open || new BigNumber(0)), true) }</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Actual amount traded within last 24 hours">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Volume</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook.secondaryAsset, pair?.price.totalVolume || new BigNumber(0)) }</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Total amount being currently open for trading including LP positions">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Liquidity</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook.secondaryAsset, pair?.price.totalLiquidity || new BigNumber(0)) }</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Average revenue of LP position">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Revenue</Text>
                              <Text size="2" color="purple">{ market && pair?.price.poolVolume?.gt(0) && pair?.price.poolLiquidity?.gt(0) ? Exchange.toAPY(pair.poolFeeRate || market.maxPoolFeeRate, pair.price.poolLiquidity, pair.price.poolVolume).toFixed(2) : '0.00' }% APY</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Minimal to maximal price range observed during the day">
                            <Flex justify="between" wrap="wrap" gap="1" mt="2" mb="1">
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toValue(null, pair?.price.low || null, false, true) }</Text>
                              <Text size="2" color="gray">—</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toValue(null, pair?.price.high || null, false, true) }</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Fee rate range taken from order makers">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Maker fee</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ (market?.minMakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }% — { (market?.maxMakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Fee rate range taken from order takers">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Taker fee</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ (market?.minTakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }% — { (market?.maxTakerFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content="Fee rate range for LP positions">
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Pool fee</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>0.00% — { (market?.maxPoolFeeRate || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content={`Exit fee is based on fee revenue of a pool and will be charged on pool withdrawal. Any change to exit fee only affects new pools, existing pools are not affected.`}>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Pool exit fee</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ (market?.poolExitFee || new BigNumber(0)).multipliedBy(100).toFixed(2) }%</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content={`To reach lowest maker/taker fees, account impact must cover at least ${(market?.assetVolumeTarget || new BigNumber(0)).multipliedBy(100).toFixed(0) }% of ${ (market?.assetResetDays || new BigNumber(0)).toString() } day volume of this market pair within ${ (market?.accountResetDays || new BigNumber(0)).toString() } days`}>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Impact rule</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>≥ { (market?.assetVolumeTarget || new BigNumber(0)).multipliedBy(100).toFixed(0) }% of { (market?.assetResetDays || new BigNumber(0)).toString() }d VOL</Text>
                            </Flex>
                          </Tooltip>
                          <Tooltip side="left" content={`Maker/taker fee impact difficulty: fee will get lower exponentially as account impact grows, higher fee impact difficulty will slow down the fee discounts on smaller impact accounts and speed up the fee discounts on higher impact accounts`}>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Impact difficuly</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ (market?.makerFeeExponent || new BigNumber(0)).multipliedBy(100).toFixed(0) }% — { (market?.takerFeeExponent || new BigNumber(0)).multipliedBy(100).toFixed(0) }%</Text>
                            </Flex>
                          </Tooltip>
                        </Flex>
                      </Card>
                    </Box>
                  }
                </Tabs.Content>
                <Tabs.Content value="order">
                  <Maker
                    path={orderPath}
                    marketId={orderbook?.marketId || new BigNumber(0)}
                    pairId={pair?.id || new BigNumber(0)}
                    primaryAsset={orderbook?.primaryAsset || new AssetId()}
                    secondaryAsset={orderbook?.secondaryAsset || new AssetId()}
                    balances={loading ? undefined : polyBalances}
                    prices={spreads}
                    tiers={tiers || undefined}
                    preset={preset}
                    onStateChange={(state) => setShowingPools(state.pool)}></Maker>
                  {
                    !showingPools && orders.map((item) =>
                      <Box mt="3" key={item.orderId.toString()}>
                        <OrderView flash={true} item={item}></OrderView>
                      </Box>)
                  }
                  {
                    showingPools && pools.map((item) =>
                      <Box mt="3" key={item.poolId.toString()}>
                        <PoolView flash={true} item={item}></PoolView>
                      </Box>)
                  }
                </Tabs.Content>
                <Tabs.Content value="book">
                  <Card variant="surface" style={{ borderRadius: '22px', border: mobile ? 'none' : undefined }}>
                    <Box mb="2">
                      <SegmentedControl.Root mb="2" style={{ width: '100%' }} value={seriesOptions.priceScope.toString()} onValueChange={(e) => updateSeriesOptions(prev => ({ ...prev, priceScope: parseInt(e) }))}>
                        <SegmentedControl.Item value={PriceScope.Bid.toString()}>Bid</SegmentedControl.Item>
                        <SegmentedControl.Item value={PriceScope.All.toString()}>/</SegmentedControl.Item>
                        <SegmentedControl.Item value={PriceScope.Ask.toString()}>Ask</SegmentedControl.Item>
                      </SegmentedControl.Root>
                      <TextField.Root type="number" placeholder="Price distance" value={seriesOptions.priceLevel} onChange={(e) => updateSeriesOptions(prev => ({ ...prev, priceLevel: e.target.value }))}>
                        <TextField.Slot>
                          <Icon path={mdiCurrencyUsd} />
                        </TextField.Slot>
                      </TextField.Root>
                    </Box>
                    <Flex justify={
                      seriesOptions.priceScope == PriceScope.All ? 'between' : (seriesOptions.priceScope == PriceScope.Bid ? 'start' : 'end')
                    } style={{ borderTopLeftRadius: '12px', borderTopRightRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--gray-3)' }} px="1" py="2" position="relative">
                      {
                        seriesOptions.priceScope != PriceScope.Ask &&
                        <>
                          <Box position="absolute" top="0" left="0" right={`${seriesOptions.priceScope == PriceScope.All ? liquidity.ask[0].dividedBy(liquidity.bid[0].plus(liquidity.ask[0])).multipliedBy(100) : 0}%`} bottom="0" style={{ zIndex: 0, backgroundColor: 'var(--lime-a5)' }}></Box>
                          <Text size="2" style={{ zIndex: 1, color: 'var(--lime-11)' }}>{ Readability.toMoney(orderbook?.primaryAsset || null, liquidity.bid[0]) }</Text>
                        </>
                      }
                      {
                        seriesOptions.priceScope != PriceScope.Bid &&
                        <>
                          <Box position="absolute" top="0" left={`${seriesOptions.priceScope == PriceScope.All ? liquidity.bid[0].dividedBy(liquidity.bid[0].plus(liquidity.ask[0])).multipliedBy(100) : 0}%`} right="0" bottom="0" style={{ zIndex: 0, backgroundColor: 'var(--red-a5)' }}></Box>
                          <Text size="2" style={{ zIndex: 1, color: 'var(--red-11)' }}>{ Readability.toMoney(orderbook?.primaryAsset || null, liquidity.ask[0]) }</Text>
                        </>
                      }
                    </Flex>
                    <Flex style={{ borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--gray-3)' }}>
                      {
                        seriesOptions.priceScope != PriceScope.Ask &&
                        <Box width={seriesOptions.priceScope == PriceScope.All ? '50%' : '100%'}>
                          {
                            groupedLevels.bid.map((item) =>
                              <Tooltip side="left" key={item.price.toString()} content={`Buy ${Readability.toMoney(orderbook?.primaryAsset || null, item.quantity)} at ≤ ${Readability.toMoney(orderbook?.secondaryAsset || null, item.price)}`}>
                                <Button variant="ghost" radius="none" style={{ width: '100%', height: 'auto', padding: 0, margin: 0 }} onClick={() => updatePreset(OrderSide.Buy, item.price)}>
                                  <Flex width="100%" justify="start" px="1" py="1" position="relative">
                                    <Box position="absolute" top="0" left={`${100 - 100 * item.quantity.dividedBy(liquidity.bid[0]).toNumber()}%`} right="0" bottom="0" style={{ zIndex: 0, backgroundColor: 'var(--lime-7)' }}></Box>
                                    <Text size="2" style={{ zIndex: 1, color: 'var(--lime-11)' }}>{ Readability.toValue(null, item.price, false, true) }</Text>
                                  </Flex>
                                </Button>
                              </Tooltip>)
                          }
                          {
                            !groupedLevels.bid.length &&
                            <Box height="28px" style={{ backgroundColor: 'var(--gray-4)' }}></Box>
                          }
                        </Box>
                      }
                      {
                        seriesOptions.priceScope != PriceScope.Bid &&
                        <Box width={seriesOptions.priceScope == PriceScope.All ? '50%' : '100%'}>
                          {
                            groupedLevels.ask.map((item) =>
                              <Tooltip side="left" key={item.price.toString()} content={`Sell ${Readability.toMoney(orderbook?.primaryAsset || null, item.quantity)} at ≥ ${Readability.toMoney(orderbook?.secondaryAsset || null, item.price)}`}>
                                <Button variant="ghost" radius="none" style={{ width: '100%', height: 'auto', padding: 0, margin: 0 }} onClick={() => updatePreset(OrderSide.Sell, item.price)}>
                                  <Flex width="100%" justify="end" px="1" py="1" position="relative">
                                    <Box position="absolute" top="0" left="0" right={`${100 - 100 * item.quantity.dividedBy(liquidity.ask[0]).toNumber()}%`} bottom="0" style={{ zIndex: 0, backgroundColor: 'var(--red-7)' }}></Box>
                                    <Text size="2" style={{ zIndex: 1, color: 'var(--red-11)' }}>{ Readability.toValue(null, item.price, false, true) }</Text>
                                  </Flex>
                                </Button>
                              </Tooltip>)
                          }
                          {
                            !groupedLevels.ask.length &&
                            <Box height="28px" style={{ backgroundColor: 'var(--gray-5)' }}></Box>
                          }
                        </Box>
                      }
                    </Flex>
                  </Card>
                </Tabs.Content>
                <Tabs.Content value="trades">
                  <Box px={mobile ? '3' : undefined} pt={mobile ? '4' : undefined}>
                    {
                      trades.map((item) =>
                        <Box key={item.account + item.time.getTime()} mb="3" className="rt-Card" style={{ width: '100%', height: 'auto', backgroundColor: 'var(--color-panel)', borderRadius: '22px' }}>
                          <Flex direction="column" gap="2" style={{ padding: '12px' }}>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">At</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(orderbook?.secondaryAsset || null, item.price) }</Text>
                            </Flex>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color={item.side == OrderSide.Buy ? 'lime' : 'red'}>{ item.side == OrderSide.Buy ? 'Buy' : 'Sell' }</Text>
                              <Text size="2" color={item.side == OrderSide.Buy ? 'lime' : 'red'}>{ Readability.toMoney(orderbook?.primaryAsset || null, item.quantity) }</Text>
                            </Flex>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>With</Text>
                              <Flex>
                                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                  navigator.clipboard.writeText(item.account || 'NULL');
                                  AlertBox.open(AlertType.Info, 'Account address copied!')
                                }}>{ Readability.toAddress(item.account || 'NULL', 5) }</Button>
                                <Box ml="2">
                                  <Link className="router-link" to={'/portfolio/' + item.account}>▒▒</Link>
                                </Box>
                              </Flex>
                            </Flex>
                            <Flex justify="between" wrap="wrap" gap="1">
                              <Text size="2" color="gray">Age</Text>
                              <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toTimePassed(item.time) }</Text>
                            </Flex>
                          </Flex>
                        </Box>)
                    }
                    {
                      !trades.length &&
                      <Flex justify="center">
                        <Text>No activity</Text>
                      </Flex>
                    }
                  </Box>
                </Tabs.Content>
              </Box>
            </Tabs.Root>
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}