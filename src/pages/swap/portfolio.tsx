import { Box, Button, Card, Dialog, Flex, Heading, Spinner, Tabs, Text, TextField } from "@radix-ui/themes";
import { AssetId, Readability, Signing } from "tangentsdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { Swap, Balance, Order, Pool } from "../../core/swap";
import { useEffectAsync } from "../../core/react";
import { AppData } from "../..//core/app";
import BigNumber from "bignumber.js";
import BalanceView from "../../components/swap/balance";
import OrderView from "../../components/swap/order";
import PoolView from "../../components/swap/pool";
import Icon from "@mdi/react";
import { mdiMagnify, mdiMagnifyScan, mdiRefresh } from "@mdi/js";
import { useNavigate, useParams } from "react-router";

export default function PortfolioPage() {
  const params = useParams();
  const ownerAddress = AppData.getWalletAddress() || '';
  const baseAddress = params.account || ownerAddress;
  const readOnly = baseAddress != ownerAddress;
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const [assetUpdates, setAssetUpdates] = useState(0);
  const [dashboardUpdates, setDashboardUpdates] = useState(0);
  const [todayProfits, setTodayProfits] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [assets, setAssets] = useState<any[]>([])
  const [orders, setOrders] = useState<Order[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const equityAssets = useMemo((): (Balance & { value: BigNumber, equity: { current: BigNumber | null, previous: BigNumber | null } })[] => {
    return assets.map((v: Balance) => {
      const price = Swap.priceOf(v.asset);
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
    });
  }, [assets, todayProfits, assetUpdates]);
  const equity = useMemo((): { previous: BigNumber, current: BigNumber } => {
    return {
      previous: equityAssets.reduce((a, b) => a.plus(b.equity.previous || b.equity.current || new BigNumber(0)), new BigNumber(0)),
      current: equityAssets.reduce((a, b) => a.plus(b.equity.current || b.equity.previous || new BigNumber(0)), new BigNumber(0))
    }
  }, [equityAssets]);
  useEffectAsync(async () => {
    setLoading(true);
    try {
      if (!baseAddress)
        throw false;

      const portfolio = await Swap.accountPortfolio({ address: baseAddress, resync: dashboardUpdates == -1 });
      if (!portfolio)
        throw false;
      
      setAssets(portfolio.balances);
      setOrders(portfolio.orders);
      setPools(portfolio.pools);
    } catch {
      setAssets([]);
      setOrders([]);
      setPools([]);
    }
    setLoading(false);
  }, [params, dashboardUpdates]);
  useEffect(() => {
    const updateAssets = () => setAssetUpdates(new Date().getTime());
    const updateDashboard = async () => setDashboardUpdates(new Date().getTime());
    window.addEventListener('update:order', updateDashboard);
    window.addEventListener('update:pool', updateDashboard);
    window.addEventListener('update:trade', updateAssets);
    window.addEventListener('swap:ready', updateDashboard);
    return () => {
      window.removeEventListener('update:order', updateDashboard);
      window.removeEventListener('update:pool', updateDashboard);
      window.removeEventListener('update:trade', updateAssets);
      window.removeEventListener('swap:ready', updateDashboard);
    };
  }, []);

  return (
    <Box px="4" pt="4" minWidth="285px" maxWidth="680px" mx="auto">
      <Flex gap="2" align="center" justify="between" px="2" mb="2">
        <Flex align="center" gap="2">
          <Heading size={document.body.clientWidth < 450 ? '4' : '6'}>Portfolio</Heading>
          <Button variant="surface" size="1" color={ readOnly ? 'red' : 'orange' }>{ baseAddress.substring(baseAddress.length - 6) }</Button>
        </Flex>
        <Flex justify="end" gap="1">
          <Dialog.Root onOpenChange={(opened) => setSearching(opened)} open={searching}>
            <Dialog.Trigger>
              <Button variant="soft" size="2" color="gray">
                <Icon path={mdiMagnifyScan} size={0.7} style={{ transform: 'translateY(-1px)' }} /> FIND
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
                  <Button variant="ghost" size="3" type="submit" loading={loading} disabled={!query.trim().length || !Signing.verifyAddress(query.trim()) } onClick={(e) => { e.preventDefault(); navigate(`/swap/${query.trim()}`); }}>Find portfolio</Button>
                </Flex>
              </form>
            </Dialog.Content>
          </Dialog.Root>
        </Flex>
      </Flex>
      <Card mt="3" variant="surface" style={{ borderRadius: '28px' }}>
        {
          loading &&
          <Box px="2" py="1">
            <Flex justify="between" align="center" mb="1">
              <Text size="3" color="gray">Net worth</Text>
              <Button variant="soft" size="2" color="orange" disabled={true}>
                <Icon path={mdiRefresh} size={0.8}></Icon> Syncing
              </Button>
            </Flex>
            <Box pt="5" pb="6">
              <Spinner size="3"></Spinner>
            </Box>
          </Box>
        }
        {
          !loading &&
          <Box px="2" py="1">
            <Box mb="2">
              <Flex justify="between" align="center" mb="1">
                <Text size="3" color="gray">Net worth</Text>
                <Button variant="soft" size="2" color="orange" disabled={loading} onClick={() => setDashboardUpdates(-1)}>
                  <Icon path={mdiRefresh} size={0.8}></Icon> Re-sync
                </Button>
              </Flex>
              <Heading size="7">{ Readability.toMoney(Swap.equityAsset, equity.current) }</Heading>
            </Box>
            <Button variant="soft" size="2" color={ equity.previous.gt(equity.current) ? 'red' : (equity.previous.eq(equity.current) ? 'gray' : 'jade') } onClick={() => setTodayProfits(!todayProfits)}>{ Readability.toMoney(Swap.equityAsset, equity.current.minus(equity.previous), true) } ({ Readability.toPercentageDelta(equity.previous, equity.current) }) - { todayProfits ? 'Today' : 'Total' }</Button>
          </Box>
        }
      </Card>
      <Tabs.Root defaultValue="balances" mt="4">
        <Tabs.List>
          <Tabs.Trigger value="balances">Balances</Tabs.Trigger>
          <Tabs.Trigger value="orders">Orders</Tabs.Trigger>
          <Tabs.Trigger value="pools">Pools</Tabs.Trigger>
        </Tabs.List>
        <Box pt="3">
          <Tabs.Content value="balances">
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
          <Tabs.Content value="orders">
            <Box pt="4">
              {
                orders.map((item) =>
                  <Box key={item.orderId.toString()} mb="4">
                    <OrderView item={item} readOnly={readOnly}></OrderView>
                  </Box>)
              }
              {
                !orders.length &&
                <Box px="4">
                  <Text size="2" align="center">Orders created from this account will appear here.</Text>
                </Box>
              }
            </Box>
          </Tabs.Content>
          <Tabs.Content value="pools">
            <Box pt="4">
              {
                pools.map((item) =>
                  <Box key={item.poolId.toString()} mb="4">
                    <PoolView item={item} readOnly={readOnly}></PoolView>
                  </Box>)
              }
              {
                !pools.length &&
                <Box px="4">
                  <Text size="2" align="center">Pools created from this account will appear here.</Text>
                </Box>
              }
            </Box>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
}