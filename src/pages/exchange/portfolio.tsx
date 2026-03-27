import { Badge, Box, Button, Card, Dialog, Flex, Heading, Select, Tabs, Text, TextField } from "@radix-ui/themes";
import { AssetId, Readability, RPC, Signing, Whitelist } from "tangentsdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Exchange, Balance, Order, Pool, Cursor, AggregatedPair, Market } from "../../core/exchange";
import { useEffectAsync } from "../../core/react";
import { AppData } from "../..//core/app";
import { mdiCheckDecagram, mdiMagnify, mdiMagnifyScan, mdiRefresh } from "@mdi/js";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Storage } from "../../core/storage";
import { AlertBox, AlertType } from "../../components/alert";
import { AssetImage } from "../../components/asset";
import BigNumber from "bignumber.js";
import BalanceView from "../../components/exchange/balance";
import OrderView from "../../components/exchange/order";
import PoolView from "../../components/exchange/pool";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import AssetSelector from "../../components/exchange/selector";

function toAssetSymbol(asset: AssetId): string {
  return asset.chain == 'TAN' && asset.token ? (asset.token || '') : ((asset.token || '') + (asset.chain || ''));
}

export default function PortfolioPage() {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const ownerAddress = AppData.getWalletAddress();
  const baseAddress = params.account || ownerAddress;
  const readOnly = baseAddress != ownerAddress;
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const [market, setMarket] = useState<Market | null>(null);
  const [pairs, setPairs] = useState<{ pair: AggregatedPair, whitelisted: boolean }[]>([]);
  const [launchablePair, setLaunchablePair] = useState<AggregatedPair | null>(null);
  const [marketLauncher, setMarketLauncher] = useState<{ primary: AssetId | null, secondary: AssetId | null }>({ primary: null, secondary: null });
  const [viewer, setViewer] = useState<'market' | 'assets' | 'orders' | 'pools'>(readOnly ? 'assets' : 'market');
  const [assetUpdates, setAssetUpdates] = useState(0);
  const [dashboardUpdates, setDashboardUpdates] = useState(0);
  const [todayProfits, setTodayProfits] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [assets, setAssets] = useState<any[]>([])
  const [orders, setOrders] = useState<Order[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [moreOrders, setMoreOrders] = useState(true);
  const [morePools, setMorePools] = useState(true);
  const assetQuery = useMemo((): { primary: string | null, secondary: string | null } => {
    let [primary, secondary] = query.toLowerCase().split('/').map((x) => x.trim());
    return {
      primary: primary || null,
      secondary: secondary || null
    };
  }, [query]);
  const pairsFilter = useMemo((): { pair: AggregatedPair, whitelisted: boolean }[] => {
    let result = [...pairs].filter((item) => {
      const primaryMatches = !assetQuery.primary || Readability.toAssetQuery(item.pair.primaryAsset).toLowerCase().indexOf(assetQuery.primary) != -1;
      const secondaryMatches = !assetQuery.secondary || Readability.toAssetQuery(item.pair.secondaryAsset).toLowerCase().indexOf(assetQuery.secondary) != -1;
      return primaryMatches && secondaryMatches;
    });
    if (launchablePair != null) {
      result = [{ pair: launchablePair, whitelisted: !!Whitelist.contractAddressOf(launchablePair.primaryAsset) && !!Whitelist.contractAddressOf(launchablePair.secondaryAsset) }, ...result];
    }
    return result;
  }, [pairs, assetQuery, launchablePair]);
  const equityAssets = useMemo((): (Balance & { value: BigNumber, equity: { current: BigNumber | null, previous: BigNumber | null } })[] => {
    return assets.map((v: Balance) => {
      const price = Exchange.priceOf(v.asset);
      const value = v.available.plus(v.unavailable);
      const previousEquity = todayProfits ? (price.open ? new BigNumber(price.open.multipliedBy(value).toFixed(2)) : null) : (v.price ? new BigNumber(v.price.multipliedBy(value).toFixed(2)) : null);
      const currentEquity = price.close ? new BigNumber(price.close.multipliedBy(value).toFixed(2)) : null;
      return {
        asset: v.asset as AssetId,
        unavailable: v.unavailable as BigNumber,
        available: v.available as BigNumber,
        price: v.price as BigNumber,
        value: value,
        equity: { previous: previousEquity, current: currentEquity }
      };
    }).sort((a, b) => (b.equity.current || new BigNumber(0)).minus(a.equity.current || 0).toNumber());
  }, [assets, todayProfits, assetUpdates]);
  const equity = useMemo((): { previous: BigNumber, current: BigNumber } => {
    return {
      previous: equityAssets.reduce((a, b) => a.plus(b.equity.previous || b.equity.current || new BigNumber(0)), new BigNumber(0)),
      current: equityAssets.reduce((a, b) => a.plus(b.equity.current || b.equity.previous || new BigNumber(0)), new BigNumber(0))
    }
  }, [equityAssets]);
  const findOrders = useCallback(async (refresh?: boolean) => {
    if (!ownerAddress) {
      setOrders([]);
      setMoreOrders(false);
      return false;
    }
    try {
      const cursor = Cursor.offset(refresh ? 0 : orders.length);
      const data = await Exchange.accountOrders({ address: ownerAddress, page: cursor.offset * cursor.count });
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setOrders([]);
        setMoreOrders(false);
        return false;
      }

      setOrders(refresh ? data : prev => prev.concat(data));
      setMoreOrders(data.length >= cursor.count);
      return data.length > 0;
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch orders: ' + (exception as Error).message);
      if (refresh)
        setOrders([]);
      setMoreOrders(false);
      return false;
    }
  }, [ownerAddress, pools]);
  const findPools = useCallback(async (refresh?: boolean) => {
    if (!ownerAddress) {
      setPools([]);
      setMorePools(false);
      return false;
    }
    try {
      const cursor = Cursor.offset(refresh ? 0 : pools.length);
      const data = await Exchange.accountPools({ address: ownerAddress, page: cursor.offset * cursor.count });
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setPools([]);
        setMorePools(false);
        return false;
      }

      setPools(refresh ? data : prev => prev.concat(data));
      setMorePools(data.length >= cursor.count);
      return data.length > 0;
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch pools: ' + (exception as Error).message);
      if (refresh)
        setPools([]);
      setMorePools(false);
      return false;
    }
  }, [ownerAddress, pools]);
  useEffectAsync(async () => {
    try {
      const pullAddress = params.account || ownerAddress;
      if (!pullAddress)
        throw false;

      const assets = await Exchange.accountBalances({ address: pullAddress, resync: dashboardUpdates == -1 });
      if (!assets)
        throw false;
      
      Storage.set(`__assets:${pullAddress}__`, assets);
      setAssets(assets);
    } catch {
      setAssets([]);
    }
    setLoading(false);
  }, [params.account, dashboardUpdates]);
  useEffectAsync(async () => {
    try {
      if (market != null) {
        const results = await Exchange.marketPairs(market.id);
        if (Array.isArray(results)) {
          const data = results.map((x) => ({ pair: x, whitelisted: !!Whitelist.contractAddressOf(x.primaryAsset) && !!Whitelist.contractAddressOf(x.secondaryAsset) }));
          Storage.set('__explorer__', data);
          setPairs(data);
        }
      } else {
        setPairs([]);
      }
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Failed to receive markets: ' + exception.message);
    }
  }, [market]);
  useEffectAsync(async () => {
    try {
      if (!market || !marketLauncher.primary || !marketLauncher.secondary)
        throw false;

      const result = await Exchange.marketPair(market.id, marketLauncher.primary, marketLauncher.secondary, true);
      setLaunchablePair(result);
    } catch (exception: any) {
      if (exception instanceof Error)
        AlertBox.open(AlertType.Error, 'Failed to launch a market: ' + exception.message);
      setLaunchablePair(null);
    }
  }, [marketLauncher]);
  useEffect(() => {
    if (viewer == 'market') {
      if (!market) {
        Exchange.acquireDeferred().then(() => {
          if (Exchange.contracts.length > 0)
            setMarket(Exchange.contracts[0]);
        });
      }
    } else if (viewer == 'orders') {
      findOrders(true);
    } else if (viewer == 'pools') {
      findPools(true);
    }
  }, [viewer, market]);
  useEffect(() => {
    const pullAddress = params.account || ownerAddress;
    const updatePairs = () => {
      setPairs(prev => {
        const copy = [...prev];
        for (let i = 0; i < copy.length; i++) {
          const symbol = copy[i];
          const target = Exchange.priceOf(symbol.pair.primaryAsset, symbol.pair.secondaryAsset);
          symbol.pair.price.open = target.open || symbol.pair.price.open;
          symbol.pair.price.close = target.close || symbol.pair.price.close;
        }
        return copy;
      });
    };
    const updateAssets = () => setAssetUpdates(new Date().getTime());
    const updateDashboard = async () => setDashboardUpdates(new Date().getTime());
    setPairs((RPC.fetchObject(Storage.get('__explorer__')) || []).map((x: any) => {
      if (x.pair != null && x.pair.primaryAsset != null && x.pair.secondaryAsset != null) {
        x.pair.primaryAsset = new AssetId(x.pair.primaryAsset.id);
        x.pair.secondaryAsset = new AssetId(x.pair.secondaryAsset.id);
      }
      return x;
    }));
    setAssets(RPC.fetchObject(Storage.get(`__assets:${pullAddress}__`)) || []);
    window.addEventListener('update:trade', updatePairs);
    window.addEventListener('update:order', updateDashboard);
    window.addEventListener('update:pool', updateDashboard);
    window.addEventListener('update:trade', updateAssets);
    window.addEventListener('exchange:ready', updateDashboard);
    return () => {
      window.removeEventListener('update:trade', updatePairs);
      window.removeEventListener('update:order', updateDashboard);
      window.removeEventListener('update:pool', updateDashboard);
      window.removeEventListener('update:trade', updateAssets);
      window.removeEventListener('exchange:ready', updateDashboard);
    };
  }, [params.account]); 
  useEffect(() => {
    const view = search.get('view');
    if (view != null && ['market', 'assets', 'orders', 'pools'].includes(view))
      setViewer(view as any);
  }, [search]);

  return (
    <Box px="4" pt="4" minWidth="285px" maxWidth="680px" mx="auto">
      <Flex gap="2" align="center" justify="between" px="2" mb="2">
        <Flex align="center" gap="2">
          <Heading size={document.body.clientWidth < 450 ? '4' : '6'}>Portfolio</Heading>
          <Button variant="surface" size="1" color={ readOnly ? 'red' : 'lime' }>{ baseAddress ? baseAddress.substring(baseAddress.length - 6) : 'NONE' }</Button>
        </Flex>
        <Flex justify="end" gap="1">
          <Dialog.Root onOpenChange={(opened) => {
            setSearching(opened)
            setQuery('');
          }} open={searching}>
            <Dialog.Trigger>
              <Button variant="soft" size="2" color="gray">
                <Icon path={mdiMagnifyScan} size={0.9}/>
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <form action="">
                <Dialog.Title mb="2">Explorer</Dialog.Title>
                <TextField.Root placeholder="Account address" size="3" color="amber" variant="soft" value={query} onChange={(e) => setQuery(e.target.value)} readOnly={loading} ref={searchInput}>
                  <TextField.Slot>
                    <Icon path={mdiMagnify} size={0.9} color="var(--accent-8)"/>
                  </TextField.Slot>
                </TextField.Root>
                <Flex justify="center" mt="4">
                  <Button variant="ghost" size="3" type="submit" loading={loading} disabled={!query.trim().length || !Signing.verifyAddress(query.trim()) } onClick={(e) => { e.preventDefault(); navigate(`/dex/account/${query.trim()}`); }}>Find portfolio</Button>
                </Flex>
              </form>
            </Dialog.Content>
          </Dialog.Root>
        </Flex>
      </Flex>
      <Card mt="3" variant="surface" style={{ borderRadius: '28px' }}>
        <Box px="2" py="1">
          <Box mb="2">
            <Flex justify="between" align="center" mb="1">
              <Text size="3" color="gray">Net worth</Text>
              <Button variant="soft" size="2" color="yellow" loading={loading} onClick={() => setDashboardUpdates(-1)}>
                <Icon path={mdiRefresh} size={0.8}></Icon> Re-sync
              </Button>
            </Flex>
            <Heading size="7">{ Readability.toMoney(Exchange.equityAsset, equity.current) }</Heading>
          </Box>
          <Button variant="soft" size="2" color={ equity.previous.gt(equity.current) ? 'red' : (equity.previous.eq(equity.current) ? 'gray' : 'lime') } onClick={() => setTodayProfits(!todayProfits)}>{ Readability.toMoney(Exchange.equityAsset, equity.current.minus(equity.previous), true) } ({ Readability.toPercentageDelta(equity.previous, equity.current) }) - { todayProfits ? 'Today' : 'Total' }</Button>
        </Box>
      </Card>
      <Tabs.Root value={viewer} onValueChange={(x) => setSearch({ view: x })} mt="4">
        <Tabs.List>
          <Tabs.Trigger value="market">Market</Tabs.Trigger>
          <Tabs.Trigger value="assets">Assets</Tabs.Trigger>
          <Tabs.Trigger value="pools">Pools</Tabs.Trigger>
          <Tabs.Trigger value="orders">Orders</Tabs.Trigger>
        </Tabs.List>
        <Box pt="3">
          <Tabs.Content value="market">
            <Box pt="2" pb="2">
              <Flex px="1" align="center" justify="start">
                <TextField.Root placeholder="Try ETH/USDT…" variant="soft" color="gray" size="2" value={query} style={{ width: '100%', borderTopRightRadius: '0', borderBottomRightRadius: '0', borderRight: '1px solid var(--gray-6)' }} onInput={(e) => setQuery(e.currentTarget.value || '')}>
                  <TextField.Slot>
                    <Icon path={mdiMagnify} size={0.8}></Icon>
                  </TextField.Slot>
                </TextField.Root>
                <Select.Root value={market ? market.id.toString() : ''} onValueChange={(e) => setMarket(Exchange.contracts.find((v) => v.id.toString() == e) || null)} size="2">
                  <Select.Trigger variant="soft" color="gray" style={{ borderTopLeftRadius: '0', borderBottomLeftRadius: '0' }}>{ market ? Exchange.marketPolicyOf(market) + ' ' + (market.version || market.account.substring(market.account.length - 4)) : 'Market unset' }</Select.Trigger>
                  <Select.Content position="popper" side="bottom">
                    <Select.Group>
                      <Select.Label>Market contract</Select.Label>
                      { Exchange.contracts.map((item) => <Select.Item key={item.id.toString()} value={item.id.toString()}>{ Exchange.marketPolicyOf(item) } contract — { item.version || item.account.substring(item.account.length - 4) }</Select.Item>) }
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Flex>
              <Flex justify="between" align="center" px="3" pt="4">
                <Text>{ Readability.toCount('pair', pairsFilter.length) }</Text>
                <Flex gap="2" justify="end">
                  <Text color="gray">Add</Text>
                  <AssetSelector title="token 1 to launch" value={marketLauncher.primary} onChange={(value) => setMarketLauncher(prev => ({ primary: value, secondary: prev?.secondary || null }))}>
                    <Button variant="ghost" size="3">
                      {
                        marketLauncher.primary != null &&
                        <Flex align="center" gap="2">
                          <AssetImage asset={marketLauncher.primary} size="2" iconSize="16px"></AssetImage>
                          <Text>{ Readability.toAssetSymbol(marketLauncher.primary) }</Text>
                        </Flex>
                      }
                      { marketLauncher.primary == null && (assetQuery.primary?.toUpperCase() || 'A') }
                    </Button>
                  </AssetSelector>
                  <Text>x</Text>
                  <AssetSelector title="token 2 to launch" value={marketLauncher.secondary} onChange={(value) => setMarketLauncher(prev => ({ primary: prev?.primary || null, secondary: value }))}>
                    <Button variant="ghost" size="3">
                      {
                        marketLauncher.secondary != null &&
                        <Flex align="center" gap="2">
                          <AssetImage asset={marketLauncher.secondary} size="2" iconSize="16px"></AssetImage>
                          <Text>{ Readability.toAssetSymbol(marketLauncher.secondary) }</Text>
                        </Flex>
                      }
                      { marketLauncher.secondary == null && (assetQuery.secondary?.toUpperCase() || 'B') }
                    </Button>
                  </AssetSelector>
                </Flex>
              </Flex>
            </Box>
            {
              market != null && pairsFilter.map((item, index) =>
                <Button variant="ghost" color="gray" radius="none" style={{ display: 'block', width: '100%', borderRadius: '24px' }} mb={index < pairsFilter.length - 1 ? '4' : undefined} key={item.pair.id.toString()} onClick={() => navigate(`/dex/${Exchange.toOrderbookQuery(market.id, item.pair.primaryAsset, item.pair.secondaryAsset)}`)}>
                  <Box px="2" py="2">
                    <Flex justify="start" align="center" gap="3">
                      <Box style={{ position: 'relative' }}>
                        <AssetImage asset={item.pair.secondaryAsset} size="2" style={{ position: 'absolute', top: '24px', left: '-6px' }}></AssetImage>
                        <AssetImage asset={item.pair.primaryAsset} size="4"></AssetImage>
                      </Box>
                      <Box width="100%">
                        <Flex justify="between" align="center">
                          <Flex gap="1">
                            <Flex align="center">
                              {
                                item.pair.secondaryBase == null &&
                                <>
                                  <Text size="2" weight="bold" style={{ color: 'var(--gray-12)' }}>{ item.pair.primaryAsset.token || item.pair.primaryAsset.chain }</Text>
                                  <Text size="2" color="gray" mx="1">x</Text>
                                  <Text size="2" weight="bold" style={{ color: 'var(--gray-12)' }}>{ item.pair.secondaryAsset.token || item.pair.secondaryAsset.chain }</Text>
                                </>
                              }
                              {
                                item.pair.secondaryBase != null &&
                                <Text size="2" weight="bold" style={{ color: 'var(--gray-12)' }}>{ item.whitelisted ? Readability.toAssetName(item.pair.primaryAsset).replace(item.pair.primaryAsset.chain + ' ', '') : Readability.toAssetName(item.pair.primaryAsset) }</Text>
                              }
                            </Flex>
                            { item.whitelisted && <Icon path={mdiCheckDecagram} color="var(--sky-9)" size={0.7}></Icon> }
                          </Flex>
                          <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(item.pair.secondaryAsset, item.pair.price.close) }</Text>
                        </Flex>
                        <Flex justify="between" align="center">
                          <Flex align="center">
                            <Text size="1" color="gray">{ toAssetSymbol(item.pair.primaryAsset) }{ toAssetSymbol(item.pair.secondaryAsset) }</Text>
                          </Flex>
                          <Flex gap="1">
                            {
                              item.pair.price.poolVolume?.gt(0) && item.pair.price.poolLiquidity?.gt(0) &&
                              <Badge radius="full" size="1" color="purple">{ Exchange.toAPY(item.pair.poolFeeRate || market.maxPoolFeeRate, item.pair.price.poolLiquidity, item.pair.price.poolVolume).toFixed(2) }% APY</Badge>
                            }
                            <Badge radius="full" size="1" color={ (item.pair.price.open || new BigNumber(0)).gt(item.pair.price.close || new BigNumber(0)) ? 'red' : ((item.pair.price.open || new BigNumber(0)).eq(item.pair.price.close || new BigNumber(0)) ? 'gray' : 'lime') }>{ Readability.toPercentageDelta(item.pair.price.open || new BigNumber(0), item.pair.price.close || new BigNumber(0)) }</Badge>
                          </Flex>
                        </Flex>
                      </Box>
                    </Flex>
                  </Box>
                </Button>
              )
            }
          </Tabs.Content>
          <Tabs.Content value="assets">
            <Box pt="4">
              { equityAssets.map((item) => <BalanceView key={item.asset.id} item={item} readOnly={readOnly}></BalanceView>) }
              {
                !assets.length && 
                <Box px="4">
                  <Text size="2" align="center">Assets funded to this account will appear here.</Text>
                </Box>
              }
            </Box>
          </Tabs.Content>
          <Tabs.Content value="pools">
            <Box pt="4">
              <InfiniteScroll dataLength={pools.length} hasMore={morePools} next={findPools} loader={<div></div>}>
                {
                  pools.map((item) =>
                    <Box key={item.poolId.toString()} mb="4">
                      <PoolView item={item} readOnly={readOnly}></PoolView>
                    </Box>)
                }
              </InfiniteScroll>
              {
                !pools.length &&
                <Box px="4">
                  <Text size="2" align="center">Pools created from this account will appear here.</Text>
                </Box>
              }
            </Box>
          </Tabs.Content>
          <Tabs.Content value="orders">
            <Box pt="4">
              <InfiniteScroll dataLength={orders.length} hasMore={moreOrders} next={findOrders} loader={<div></div>}>
                {
                  orders.map((item) =>
                    <Box key={item.orderId.toString()} mb="4">
                      <OrderView item={item} readOnly={readOnly}></OrderView>
                    </Box>
                  )
                }
              </InfiniteScroll>
              {
                !orders.length &&
                <Box px="4">
                  <Text size="2" align="center">Orders created from this account will appear here.</Text>
                </Box>
              }
            </Box>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
}