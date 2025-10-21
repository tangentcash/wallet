import { Badge, Box, Button, Card, Flex, Heading, Tabs, Text } from "@radix-ui/themes";
import { AssetId, Readability } from "tangentsdk";
import { useEffect, useMemo, useState } from "react";
import { Wormhole, Balance, Order, Pool } from "../../core/wormhole";
import { useEffectAsync } from "../../core/react";
import { AppData } from "../..//core/app";
import BigNumber from "bignumber.js";
import BalanceView from "../../components/wormhole/balance";
import OrderView from "../../components/wormhole/order";
import PoolView from "../../components/wormhole/pool";

export default function PortfolioPage() {
  const account = AppData.getWalletAddress();
  const [assetUpdates, setAssetUpdates] = useState(0);
  const [dashboardUpdates, setDashboardUpdates] = useState(0);
  const [todayProfits, setTodayProfits] = useState(true);
  const [assets, setAssets] = useState<any[]>([])
  const [orders, setOrders] = useState<Order[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const equityAssets = useMemo((): (Balance & { value: BigNumber, equity: { current: BigNumber | null, previous: BigNumber | null } })[] => {
    return assets.map((v: Balance) => {
      const price = Wormhole.priceOf(v.asset);
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
    if (account != null) {
      const [assets, orders, pools] = await Promise.all([
        Wormhole.accountBalances({ address: account }),
        Wormhole.accountOrders({ address: account }),
        Wormhole.accountPools({ address: account }),
      ]);
      setAssets(assets);
      setOrders(orders);
      setPools(pools);
    } else {
      setAssets([]);
      setOrders([]);
      setPools([]);
    }
  }, [account, dashboardUpdates]);
  useEffect(() => {
    const updateAssets = () => setAssetUpdates(new Date().getTime());
    const updateDashboard = async () => setDashboardUpdates(new Date().getTime());
    window.addEventListener('update:order', updateDashboard);
    window.addEventListener('update:pool', updateDashboard);
    window.addEventListener('update:trade', updateAssets);
    window.addEventListener('wormhole:ready', updateDashboard);
    return () => {
      window.removeEventListener('update:order', updateDashboard);
      window.removeEventListener('update:pool', updateDashboard);
      window.removeEventListener('update:trade', updateAssets);
      window.removeEventListener('wormhole:ready', updateDashboard);
    };
  }, []);

  return (
    <Box px="4" pt="4" minWidth="285px" maxWidth="680px" mx="auto">
      <Card mt="3" variant="surface" style={{
          border: '1px solid var(--gray-7)',
          borderRadius: '28px'
        }}>
        <Box px="2" py="1">
          <Box mb="2">
            <Flex justify="between" align="center">
              <Text size="3" color="gray">Portfolio</Text>
              <Badge size="2" color="red">{ Readability.toAddress(account || '') }</Badge>
            </Flex>
            <Heading size="7">{ Readability.toMoney(Wormhole.equityAsset, equity.current) }</Heading>
          </Box>
          <Button variant="soft" size="2" color={ equity.previous.gt(equity.current) ? 'red' : (equity.previous.eq(equity.current) ? 'gray' : 'jade') } onClick={() => setTodayProfits(!todayProfits)}>{ Readability.toMoney(Wormhole.equityAsset, equity.current.minus(equity.previous), true) } ({ Readability.toPercentageDelta(equity.previous, equity.current) }) - { todayProfits ? 'Today' : 'Total' }</Button>
        </Box>
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
              { equityAssets.map((item) => <BalanceView key={item.asset.id} item={item}></BalanceView>) }
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
                    <OrderView item={item}></OrderView>
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
                    <PoolView item={item}></PoolView>
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