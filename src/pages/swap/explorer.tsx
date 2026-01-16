import { Avatar, Badge, Box, Button, Flex, Heading, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import { AggregatedPair, Swap, Market } from "../../core/swap";
import { AlertBox, AlertType } from "../../components/alert";
import { useEffectAsync } from "../../core/react";
import { mdiArrowLeftRight, mdiCurrencyBtc, mdiCurrencyUsd, mdiMagnify } from "@mdi/js";
import { AssetId, Readability } from "tangentsdk";
import { useNavigate } from "react-router";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import AssetSelector from "../../components/swap/selector";

function toAssetSymbol(asset: AssetId): string {
  return asset.chain == 'TAN' && asset.token ? (asset.token || '') : ((asset.token || '') + (asset.chain || ''));
}

export default function ExplorerPage() {
  const [market, setMarket] = useState<Market | null>(null);
  const [pairs, setPairs] = useState<AggregatedPair[]>([]);
  const [launchablePair, setLaunchablePair] = useState<AggregatedPair | null>(null);
  const [marketLauncher, setMarketLauncher] = useState<{ primary: AssetId | null, secondary: AssetId | null }>({ primary: null, secondary: null });
  const [query, setQuery] = useState<string>('');
  const assetQuery = useMemo((): { primary: string | null, secondary: string | null } => {
    let [primary, secondary] = query.toLowerCase().split('/').map((x) => x.trim());
    return {
      primary: primary || null,
      secondary: secondary || null
    };
  }, [query]);
  const pairsFilter = useMemo((): AggregatedPair[] => {
    let result = [...pairs].filter((item) => {
      const primaryMatches = !assetQuery.primary || Readability.toAssetQuery(item.primaryAsset).toLowerCase().indexOf(assetQuery.primary) != -1;
      const secondaryMatches = !assetQuery.secondary || Readability.toAssetQuery(item.secondaryAsset).toLowerCase().indexOf(assetQuery.secondary) != -1;
      return primaryMatches && secondaryMatches;
    });
    if (launchablePair != null) {
      result = [launchablePair, ...result];
    }
    return result;
  }, [pairs, assetQuery, launchablePair]);
  const navigate = useNavigate();
  useEffectAsync(async () => {
    await Swap.acquireDeferred();
    if (Swap.contracts.length > 0)
      setMarket(Swap.contracts[0]);
  }, []);
  useEffectAsync(async () => {
    try {
      if (market != null) {
        const results = await Swap.marketPairs(market.id);
        if (Array.isArray(results))
          setPairs(results)
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

      const result = await Swap.marketPair(market.id, marketLauncher.primary, marketLauncher.secondary);
      setLaunchablePair(result);
    } catch (exception: any) {
      if (exception instanceof Error)
        AlertBox.open(AlertType.Error, 'Failed to launch a market: ' + exception.message);
      setLaunchablePair(null);
    }
  }, [marketLauncher]);
  useEffect(() => {
    const update = () => {
      setPairs(prev => {
        const copy = [...prev];
        for (let i = 0; i < copy.length; i++) {
          const symbol = copy[i];
          const target = Swap.priceOf(symbol.primaryAsset, symbol.secondaryAsset);
          symbol.price.open = target.open || symbol.price.open;
          symbol.price.close = target.close || symbol.price.close;
        }
        return copy;
      });
    };
    window.addEventListener('update:trade', update);
    return () => window.removeEventListener('update:trade', update);
  }, []);

  return (
    <Box px="4" pt="4" minWidth="285px" maxWidth="680px" mx="auto">
      <Flex justify="between" pb="2" align="center">
        <Heading size="5">{ market ? Swap.marketPolicyOf(market) : 'Explore' }</Heading>
        <Select.Root value={market ? market.id.toString() : ''} onValueChange={(e) => setMarket(Swap.contracts.find((v) => v.id.toString() == e) || null)} size="2">
          <Select.Trigger variant="soft" color="gray">{ market ? market.account.substring(market.account.length - 6) : 'no market' }</Select.Trigger>
          <Select.Content position="popper" side="bottom">
            <Select.Group>
              <Select.Label>Market contract</Select.Label>
              { Swap.contracts.map((item) => <Select.Item key={item.id.toString()} value={item.id.toString()}>{ Swap.marketPolicyOf(item) } contract — { item.account.substring(item.account.length - 6) }</Select.Item>) }
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Flex>
      <Box pb="3">
        <Tooltip content="Find already launched market pairs by name">
          <TextField.Root placeholder="Try ETH/USDT…" variant="soft" color="gray" size="3" value={query} style={{ width: '100%' }} onInput={(e) => setQuery(e.currentTarget.value || '')}>
            <TextField.Slot>
              <Icon path={mdiMagnify} size={0.8}></Icon>
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Flex gap="1">
        <AssetSelector title="token 1 to launch" value={marketLauncher.primary} onChange={(value) => setMarketLauncher(prev => ({ primary: value, secondary: prev?.secondary || null }))}>
          <Button style={{ width: '50%', height: '72px', display: 'block', borderRadius: '24px', backgroundColor: 'var(--jade-2)', position: 'relative' }} color="red">
            <Flex justify="center" align="center">
              {
                marketLauncher.primary != null &&
                <Flex align="center" gap="1">
                  <Avatar mr="1" size="2" radius="full" fallback={Readability.toAssetFallback(marketLauncher.primary)} src={Readability.toAssetImage(marketLauncher.primary)} style={{ width: '32px', height: '32px' }} />
                  <Text size="4">{ Readability.toAssetSymbol(marketLauncher.primary) }</Text>
                </Flex>
              }
              {
                marketLauncher.primary == null &&
                <Icon path={mdiCurrencyBtc} size={1.2}></Icon>
              }
            </Flex>
            <Box style={{ zIndex: '1', borderRadius: '16px', backgroundColor: 'var(--gray-1)', padding: '4px', position: 'absolute', bottom: '50%', right: '-25px', transform: 'translateY(50%)' }}>
              <Flex justify="center" align="center" style={{ borderRadius: '12px', backgroundColor: 'var(--jade-4)', width: '40px', height: '40px' }}>
                <Icon path={mdiArrowLeftRight} size={1.2}></Icon>
              </Flex>
            </Box>
          </Button>
        </AssetSelector>
        <AssetSelector title="token 2 to launch" value={marketLauncher.secondary} onChange={(value) => setMarketLauncher(prev => ({ primary: prev?.primary || null, secondary: value }))}>
          <Button style={{ width: '50%', height: '72px', display: 'block', borderRadius: '24px', backgroundColor: 'var(--jade-3)' }} color="red">
            <Flex justify="center" align="center">
              {
                marketLauncher.secondary != null &&
                <Flex align="center" gap="1">
                  <Avatar mr="1" size="2" radius="full" fallback={Readability.toAssetFallback(marketLauncher.secondary)} src={Readability.toAssetImage(marketLauncher.secondary)} style={{ width: '32px', height: '32px' }} />
                  <Text size="3">{ Readability.toAssetSymbol(marketLauncher.secondary) }</Text>
                </Flex>
              }
              {
                marketLauncher.secondary == null &&
                <Icon path={mdiCurrencyUsd} size={1.2}></Icon>
              }
            </Flex>
          </Button>
        </AssetSelector>
      </Flex>
      <Box pt="4">
        {
          market != null && pairsFilter.map((item, index) =>
            <Button variant="ghost" radius="none" style={{ display: 'block', width: '100%', borderRadius: '24px' }} mb={index < pairsFilter.length - 1 ? '4' : undefined} key={item.id.toString()} onClick={() => navigate(`/swap/orderbook/${Swap.toOrderbookQuery(market.id, item.primaryAsset, item.secondaryAsset)}`)}>
              <Box px="2" py="2">
                <Flex justify="start" align="center" gap="3">
                  <Box style={{ position: 'relative' }}>
                    <Avatar size="2" fallback={Readability.toAssetFallback(item.secondaryAsset)} src={Readability.toAssetImage(item.secondaryAsset)} style={{ position: 'absolute', top: '24px', left: '-6px' }} />
                    <Avatar size="4" fallback={Readability.toAssetFallback(item.primaryAsset)} src={Readability.toAssetImage(item.primaryAsset)} />
                  </Box>
                  <Box width="100%">
                    <Flex justify="between" align="center">
                      <Flex align="center">
                        {
                          item.secondaryBase == null &&
                          <>
                            <Text size="2" weight="bold" style={{ color: 'var(--gray-12)' }}>{ item.primaryAsset.token || item.primaryAsset.chain }</Text>
                            <Text size="2" color="gray" mx="1">x</Text>
                            <Text size="2" weight="bold" style={{ color: 'var(--gray-12)' }}>{ item.secondaryAsset.token || item.secondaryAsset.chain }</Text>
                          </>
                        }
                        {
                          item.secondaryBase != null &&
                          <Text size="2" weight="bold" style={{ color: 'var(--gray-12)' }}>{ Readability.toAssetName(item.primaryAsset) }</Text>
                        }
                      </Flex>
                      <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(item.secondaryAsset, item.price.close && item.secondaryBase != null ? item.price.close.dp(2) : item.price.close) }</Text>
                    </Flex>
                    <Flex justify="between" align="center">
                      <Flex align="center">
                        <Text size="1" color="gray">{ toAssetSymbol(item.primaryAsset) }{ toAssetSymbol(item.secondaryAsset) }</Text>
                      </Flex>
                      <Flex gap="1">
                        {
                          item.price.poolVolume && item.price.poolLiquidity &&
                          <Badge radius="full" size="1" color="orange">{ (item.price.poolLiquidity || new BigNumber(0)).gt(0) ? (item.price.poolVolume || new BigNumber(0)).multipliedBy(market.maxPoolFeeRate).dividedBy(item.price.poolLiquidity || new BigNumber(0)).multipliedBy(365 * 100).toFixed(2) : '0.00' }% APY</Badge>
                        }
                        <Badge radius="full" size="1" color={ (item.price.open || new BigNumber(0)).gt(item.price.close || new BigNumber(0)) ? 'red' : ((item.price.open || new BigNumber(0)).eq(item.price.close || new BigNumber(0)) ? 'gray' : 'jade') }>{ Readability.toPercentageDelta(item.price.open || new BigNumber(0), item.price.close || new BigNumber(0)) }</Badge>
                      </Flex>
                    </Flex>
                  </Box>
                </Flex>
              </Box>
            </Button>
          )
        }
      </Box>
    </Box>
  );
}