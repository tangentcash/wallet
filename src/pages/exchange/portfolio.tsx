import { Badge, Box, Button, Card, Dialog, Flex, Heading, Select, Tabs, Slider, Spinner, Switch, Text, TextField, Tooltip, Separator, Callout } from "@radix-ui/themes";
import { mdiAlert, mdiArrowRight, mdiChevronDoubleRight, mdiCog, mdiLockOutline, mdiPercent, mdiSetRight, mdiSwapVertical } from "@mdi/js";
import { AssetId, Readability, ByteUtil, TextUtil, RPC, Signing, Whitelist } from "tangentsdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Exchange, Balance, Order, Pool, Cursor, AggregatedPair, OrderSide, RouterPath, Market, PolyAsset } from "../../core/exchange";
import { useEffectAsync } from "../../core/react";
import { AppData } from "../..//core/app";
import { mdiCheckDecagram, mdiMagnify, mdiMagnifyScan, mdiMapMarkerPath, mdiPaletteSwatchVariant, mdiRefresh, mdiShimmer, mdiShoppingSearch, mdiWater } from "@mdi/js";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AppStorage } from "../../core/storage";
import { AlertBox, AlertType } from "../../components/alert";
import { AssetImage, AssetName } from "../../components/asset";
import { Builder, PerformerButton } from "./../../components/exchange/performer";
import BigNumber from "bignumber.js";
import OrderView from "../../components/exchange/order";
import PoolView from "../../components/exchange/pool";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import AssetSelector from "../../components/exchange/selector";

type SwapState = {
  tokenIn: AssetId | null,
  tokenOut: AssetId | null,
  amountIn: string,
  amountOut: string,
  slippage: string
};

type CachedBalance = Balance & { cached: boolean }

let swapPathTimeoutId: number | null = null;
let portfolioSyncTimeoutId: number | null = null;
let toAssetSymbol = (asset: AssetId): string => asset.chain == 'TAN' && asset.token ? (asset.token || '') : ((asset.token || '') + (asset.chain || ''));
let toEquityAssets = (assets: Balance[], todayProfits: boolean, available?: boolean) => {
  return (): (Balance & { value: BigNumber, equity: { current: BigNumber | null, previous: BigNumber | null } })[] => {
    return assets.map((v: Balance) => {
      const price = Exchange.priceOf(v.asset);
      const value = available ? v.available : v.available.plus(v.unavailable);
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
  };
};

function RepayableBalanceView(props: { item: Balance & { equity: { current: BigNumber | null, previous: BigNumber | null } }, available?: boolean }) {
  const item = props.item;
  const baseEquity = item.equity.current || item.equity.previous || new BigNumber(0);
  const previousEquity = item.equity.previous ? item.equity.previous : baseEquity;
  const currentEquity = item.equity.current ? item.equity.current : baseEquity;
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<PolyAsset[] | null>(null);
  const [asset, setAsset] = useState<PolyAsset | null>(null);
  const [amount, setAmount] = useState<string>('');
  const assetPayload = useMemo((): {
    marketId: string,
    repaymentAssetHash: string,
    paymentAssetHash: string,
    pays: string
  } | null => {
    if (!asset || !asset.marketId || asset.chain == item.asset.chain || asset.token != item.asset.token)
      return null;

    const valueQuantity = TextUtil.toNumericValueOrPercent(amount.trim());
    if (!valueQuantity.value.gt(0))
      return null;

    const value = valueQuantity.relative ? item.available.multipliedBy(valueQuantity.relative) : valueQuantity.value;
    if (!value.gt(0) || value.gt(item.available) || value.gt(asset.liquidity || new BigNumber(0)))
      return null;

    return {
      marketId: asset.marketId.toString(),
      repaymentAssetHash: asset.id,
      paymentAssetHash: item.asset.id,
      pays: value.toString()
    }
  }, [asset, amount]);
  useEffectAsync(async () => {
    if (!loading && !assets) {
      setLoading(true);
      try {
        const assets = await Exchange.marketAssets(item.asset, true);
        setAssets(assets);
      } catch {
        setAssets([]);
      }
      setLoading(false);
    }
  }, [assets, loading]);
  return (
    <Card mb="4" variant="surface" style={{ borderRadius: '24px', position: "relative", overflow: 'visible' }}>
      <Flex justify="start" align="center" gap="3" px="1" py="1">
        <AssetImage asset={item.asset} size="4"></AssetImage>
        <Box width="100%">
          <Flex justify="between">
            <AssetName asset={item.asset} size="2"></AssetName>
            <Text size="2">{ Readability.toMoney(Exchange.equityAsset, item.equity.current) }</Text>
          </Flex>
          <Flex justify="between" align="center">
            <Tooltip content={ 'Currently locked: ' + Readability.toMoney(item.asset, item.unavailable) }>
              <Flex align="center" gap="1">
                { item.unavailable.gt(0) && <Icon path={mdiLockOutline} size={0.575} color="var(--gray-11)" style={{ transform: 'translateY(-1px)' }}></Icon> }
                <Text size="2" color="gray">{ Readability.toMoney(null, props.available ? item.available : item.available.plus(item.unavailable)) }</Text>
              </Flex>
            </Tooltip>
            <Tooltip content={ Readability.toMoney(Exchange.equityAsset, currentEquity.minus(previousEquity), true) }>
              <Badge size="2" variant="soft" color={previousEquity.gt(currentEquity) ? 'red' : (previousEquity.eq(currentEquity) ? 'gray' : 'lime')} mt="1">
                <Icon path={mdiSetRight} size={0.7}></Icon>
                <Text size="1">{ Readability.toPercentageDelta(previousEquity, currentEquity) }</Text>
              </Badge>
            </Tooltip>
          </Flex>
        </Box>
      </Flex>
      <Flex justify="between" mt="2" gap="2">
        <Select.Root size="2" value={asset?.id || '!'} onValueChange={(value) => setAsset(value == '!' ? null : assets?.find(x => x.id == value) || null)}>
          <Select.Trigger variant="surface" placeholder="Repayable asset">
          </Select.Trigger>
          <Select.Content variant="soft">
            <Select.Group>
              <Select.Item value="!" disabled={true}>Network</Select.Item>
              {
                assets && assets.map((item) =>
                  <Select.Item key={item.id + '_select'} value={item.id}>
                    <AssetName asset={AssetId.fromHandle(item.chain || '')} size="3" badgeSize={0.7} badgeOffset={0} symbol={true}></AssetName>
                  </Select.Item>
                )
              }
            </Select.Group>
          </Select.Content>
        </Select.Root>
        <Box width="100%">
          <TextField.Root placeholder={`≤ ${Readability.toMoney(item.asset, BigNumber.min(item.available, asset?.liquidity || new BigNumber(0)))} or %`} size="2" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: '100%' }}></TextField.Root>   
        </Box>
        <PerformerButton title="Pay" description="Smart contract will re-pay you back the 1:1 value of selected token after this action" variant="soft" color="yellow" disabled={!assetPayload} onBuild={async () => {
          return assetPayload ? Builder.repayAsset(assetPayload) : null;
        }}></PerformerButton>
      </Flex>
    </Card>
  );
}

function DefaultBalanceView(props: { item: Balance & { equity: { current: BigNumber | null, previous: BigNumber | null } }, available?: boolean }) {
  const item = props.item;
  const baseEquity = item.equity.current || item.equity.previous || new BigNumber(0);
  const previousEquity = item.equity.previous ? item.equity.previous : baseEquity;
  const currentEquity = item.equity.current ? item.equity.current : baseEquity;
  return (
    <Card mb="4" variant="surface" style={{ borderRadius: '24px', position: "relative", overflow: 'visible' }}>
      <Flex justify="start" align="center" gap="3" px="1" py="1">
        <AssetImage asset={item.asset} size="4"></AssetImage>
        <Box width="100%">
          <Flex justify="between">
            <AssetName asset={item.asset} size="2"></AssetName>
            <Text size="2">{ Readability.toMoney(Exchange.equityAsset, item.equity.current) }</Text>
          </Flex>
          <Flex justify="between" align="center">
            <Tooltip content={ 'Currently locked: ' + Readability.toMoney(item.asset, item.unavailable) }>
              <Flex align="center" gap="1">
                { item.unavailable.gt(0) && <Icon path={mdiLockOutline} size={0.575} color="var(--gray-11)" style={{ transform: 'translateY(-1px)' }}></Icon> }
                <Text size="2" color="gray">{ Readability.toMoney(null, props.available ? item.available : item.available.plus(item.unavailable)) }</Text>
              </Flex>
            </Tooltip>
            <Tooltip content={ Readability.toMoney(Exchange.equityAsset, currentEquity.minus(previousEquity), true) }>
              <Badge size="2" variant="soft" color={previousEquity.gt(currentEquity) ? 'red' : (previousEquity.eq(currentEquity) ? 'gray' : 'lime')} mt="1">
                <Text size="1">{ Readability.toPercentageDelta(previousEquity, currentEquity) }</Text>
              </Badge>
            </Tooltip>
          </Flex>
        </Box>
      </Flex>
    </Card>
  );
}

function BalanceView(props: { item: Balance & { equity: { current: BigNumber | null, previous: BigNumber | null } }, readOnly?: boolean, available?: boolean }) {
  const repayable = props.item.asset.token != null && props.item.asset.chain == new AssetId().chain;
  return repayable && !props.readOnly ? RepayableBalanceView(props) : DefaultBalanceView(props);
}

function PortfolioWorth(props: {
  address: string | null,
  assetResync: number,
  todayProfits: boolean,
  onTodayProfitsChange: (value: boolean) => any,
  onAssetsChange?: (value: CachedBalance[] | ((prev: CachedBalance[]) => CachedBalance[])) => any 
}) {
  const mobile = document.body.clientWidth <= 600;
  const [assets, setAssets] = useState<CachedBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sync, setSync] = useState(0);
  const equityAssets = useMemo(toEquityAssets(assets, props.todayProfits), [assets, props.todayProfits, sync]);
  const equity = useMemo((): { previous: BigNumber, current: BigNumber } => {
    return {
      previous: equityAssets.reduce((a, b) => a.plus(b.equity.previous || b.equity.current || new BigNumber(0)), new BigNumber(0)),
      current: equityAssets.reduce((a, b) => a.plus(b.equity.current || b.equity.previous || new BigNumber(0)), new BigNumber(0))
    }
  }, [equityAssets]);
  useEffectAsync(async () => {
    if (sync > 0) {
      if (props.onAssetsChange)
        props.onAssetsChange([...assets]);
      return;
    }

    if (props.address) {
      const assetsFromCache = (prev: CachedBalance[]) => {
        if (prev.length > 0)
          return prev;

        return (RPC.fetchObject(AppStorage.get(`__assets:${props.address}__`)) || []).map((x: any) => ({ ...x, cached: true }));
      };
      setLoading(true);
      setAssets(assetsFromCache);
      if (props.onAssetsChange)
        props.onAssetsChange(assetsFromCache);
      try {
        const results = await Exchange.accountBalances({ address: props.address, resync: sync == -1 });
        const assetsFromResults = () => (results || []).map((x) => ({ ...x, cached: false }));
        AppStorage.set(`__assets:${props.address}__`, results || []);
        setAssets(assetsFromResults);
        if (props.onAssetsChange)
          props.onAssetsChange(assetsFromResults);
      } catch { }
      setLoading(false);
    } else {
      setAssets([]);
      if (props.onAssetsChange)
        props.onAssetsChange([]);
    }
    setSync(new Date().getTime());
  }, [props.address, sync]);
  useEffect(() => {
    const resync = (normal: boolean) => {
      if (portfolioSyncTimeoutId)
        clearTimeout(portfolioSyncTimeoutId);
      portfolioSyncTimeoutId = setTimeout(() => {
        portfolioSyncTimeoutId = null;
        if (normal)
          setSync((prev) => prev == -1 ? -1 : new Date().getTime());
        else
          setSync(-1);
      }, 500) as any;
    };
    const updateNormal = () => resync(true);
    const updateForced = () => resync(false);
    window.addEventListener('update:trade', updateNormal);
    window.addEventListener('update:order', updateForced);
    window.addEventListener('update:pool', updateForced);
    window.addEventListener('exchange:ready', updateNormal);
    return () => {
      window.removeEventListener('update:trade', updateNormal);
      window.removeEventListener('update:order', updateForced);
      window.removeEventListener('update:pool', updateForced);
      window.removeEventListener('exchange:ready', updateNormal);
    };
  }, [props.address]);
  useEffect(() => {
    if (props.assetResync > 0 && props.onAssetsChange) {
      props.onAssetsChange([...assets]);
      setSync(0);
    }
  }, [props.assetResync]);
  
  return (
    <Card mt="3" variant={mobile ? 'ghost' : 'surface'} style={mobile ? { margin: 0, border: 'none', paddingTop: 0 } : { borderRadius: '28px' }}>
      <Box px={mobile ? undefined : '2'} py={mobile ? undefined : '1'}>
        <Box mb="2">
          <Flex justify="between" align="center" mb="1">
            <Text size={mobile ? '4' : '3'} color="gray">Net worth</Text>
            <Button variant="soft" size="2" color="yellow" loading={loading} onClick={() => setSync(-1)}>
              <Icon path={mdiRefresh} size={0.8}></Icon> Re-sync
            </Button>
          </Flex>
          <Heading size="7">{ Readability.toMoney(Exchange.equityAsset, equity.current) }</Heading>
        </Box>
        <Button variant="soft" size="2" color={ equity.previous.gt(equity.current) ? 'red' : (equity.previous.eq(equity.current) ? 'gray' : 'lime') } onClick={() => props.onTodayProfitsChange(!props.todayProfits)}>{ Readability.toMoney(Exchange.equityAsset, equity.current.minus(equity.previous), true) } ({ Readability.toPercentageDelta(equity.previous, equity.current) }) - { props.todayProfits ? 'Today' : 'Total' }</Button>
      </Box>
    </Card>
  )
}

function SwapRouter(props: {
  assets: CachedBalance[]
}) {
  const assets = props.assets;
  const [market, setMarket] = useState<Market | null>(null);
  const [polyAssets, setPolyAssets] = useState<AssetId[]>([]);
  const [state, setState] = useState<SwapState>({ tokenIn: null, tokenOut: null, amountIn: '', amountOut: '', slippage: '1%' });
  const [bestPaths, setBestPaths] = useState<RouterPath[]>([]);
  const [convervative, setConservative] = useState(false);
  const [loadingPoly, setLoadingPoly] = useState<boolean>(false);
  const [loadingPath, setLoadingPath] = useState<boolean>(false);
  const assetsIn = useMemo((): Balance[] => assets.filter((v) => v.asset.id == state.tokenIn?.id || polyAssets.findIndex((i) => i.id == v.asset.id) != -1), [state.tokenIn, assets, polyAssets]);
  const swapInfo = useMemo((): { balanceIn: BigNumber, balanceOut: BigNumber, amountIn: BigNumber, amountOut: BigNumber, priceIn: BigNumber | null, priceOut: BigNumber | null, valuationIn: BigNumber | null, valuationOut: BigNumber | null, slippage: BigNumber } => {
    const assetIn = assetsIn.reduce((a, b) => a.plus(b.available), new BigNumber(0));
    const assetOut = state.tokenIn ? assets.find((x) => x.asset.id == state.tokenOut?.id) : null;
    const finalAmountIn = TextUtil.toNumericValueOrPercent(state.amountIn);
    const finalAmountOut = TextUtil.toNumericValue(state.amountOut);
    const priceIn = state.tokenIn ? Exchange.priceOf(state.tokenIn).close : null;
    const priceOut = state.tokenOut ? Exchange.priceOf(state.tokenOut).close : null;
    const amountIn = finalAmountIn.relative?.gt(0) ? finalAmountIn.relative.multipliedBy(assetIn) : (finalAmountIn.absolute?.gt(0) ? finalAmountIn.absolute : new BigNumber(0));
    const amountOut = finalAmountOut.gt(0) ? finalAmountOut : new BigNumber(0);
    const slippage = TextUtil.toNumericValueOrPercent(state.slippage);
    return {
      balanceIn: assetIn,
      balanceOut: assetOut?.available || new BigNumber(0),
      amountIn: amountIn,
      amountOut: amountOut,
      priceIn: priceIn,
      priceOut: priceOut,
      valuationIn: priceIn?.multipliedBy(amountIn) || null,
      valuationOut: priceOut?.multipliedBy(amountOut) || null,
      slippage: BigNumber.min(1, BigNumber.max(0, slippage.relative || new BigNumber(0)))
    }
  }, [state, assets, assetsIn]);
  const updateState = useCallback((change: (prev: SwapState) => SwapState) => {
    setState(prev => {
      const result = change(prev);
      AppStorage.set('__portfolio_swap__', {
        tokenIn: result.tokenIn?.id || null,
        tokenOut: result.tokenOut?.id || null,
        amountIn: result.amountIn,
        amountOut: result.amountOut,
        slippage: result.slippage
      })
      return result;
    });
  }, []);
  const setAmount = useCallback((type: 'amount-in' | 'amount-out', value: string) => {
    if (type == 'amount-in') {
      const amountIn = TextUtil.toNumericValueOrPercent(value); let amountOut = '';
      if (amountIn.relative) {
        const assetIn = state.tokenIn ? assets.find((x) => x.asset.id == state.tokenIn?.id) : null;
        amountIn.absolute = amountIn.relative.multipliedBy(assetIn?.available || new BigNumber(0));
      }
      if (amountIn.absolute && amountIn.absolute.gte(0) && amountIn.absolute.isFinite()) {
        const priceIn = state.tokenIn ? Exchange.priceOf(state.tokenIn).close : null;
        const priceOut = state.tokenOut ? Exchange.priceOf(state.tokenOut).close : null;
        if (priceIn?.gt(0) && priceOut?.gt(0)) {
          amountOut = ByteUtil.bigNumberToString(amountIn.absolute.dividedBy(priceOut.dividedBy(priceIn)));
        }
      }
      updateState(prev => ({ ...prev, amountIn: value, amountOut: amountOut }));
    } else if (type == 'amount-out') {
      const amountOut = TextUtil.toNumericValue(value); let amountIn = '';
      if (amountOut.gte(0) && amountOut.isFinite()) {
        const priceIn = state.tokenIn ? Exchange.priceOf(state.tokenIn).close : null;
        const priceOut = state.tokenOut ? Exchange.priceOf(state.tokenOut).close : null;
        if (priceIn?.gt(0) && priceOut?.gt(0)) {
          amountIn = ByteUtil.bigNumberToString(amountOut.multipliedBy(priceOut.dividedBy(priceIn)));
        }
      }
      updateState(prev => ({ ...prev, amountIn: amountIn, amountOut: value }))
    }
  }, [state, assets]);
  useEffectAsync(async () => {
    if (!state.tokenIn) {
      setPolyAssets([]);
      return;
    }

    setLoadingPoly(true);
    try {
      setPolyAssets(await Exchange.marketAssets(state.tokenIn));
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch poly assets: ' + (exception as Error).message);
      setPolyAssets([]);
    }
    setLoadingPoly(false);
  }, [state.tokenIn]);
  useEffect(() => {
    if (swapPathTimeoutId != null) {
      clearTimeout(swapPathTimeoutId);
      setLoadingPath(false);
    }

    const tokenIn = state.tokenIn, tokenOut = state.tokenOut;
    if (market != null && tokenIn != null && tokenOut != null) {
      const balanceIn = assetsIn.reduce((a, b) => a.plus(b.available), new BigNumber(0));
      const finalAmountIn = TextUtil.toNumericValueOrPercent(state.amountIn);
      const amountIn = finalAmountIn.relative?.gt(0) ? finalAmountIn.relative.multipliedBy(balanceIn) : (finalAmountIn.absolute?.gt(0) ? finalAmountIn.absolute : new BigNumber(0));
      const slippage = BigNumber.min(1, BigNumber.max(0, TextUtil.toNumericValueOrPercent(state.slippage).relative || new BigNumber(0)))
      if (amountIn.lte(balanceIn) && amountIn.gt(0) && slippage.gte(0) && slippage.lte(1)) {
        setLoadingPath(true);
        swapPathTimeoutId = setTimeout(async () => {
          try {
            const paths = await Exchange.marketPaths(market.id, tokenIn, tokenOut, amountIn, slippage);
            const best = paths.length > 0 ? paths[0] : [];
            setBestPaths(paths);
            if (best.length > 0) {
              updateState(prev => ({ ...prev, amountOut: ByteUtil.bigNumberToString(best[best.length - 1].output.max) }));
            }
          } catch (exception) {
            AlertBox.open(AlertType.Error, 'Failed to find best routes: ' + (exception as Error).message);
            setBestPaths([]);
          }
          setLoadingPath(false);
        }, 1000) as any;
      }
    }
    
    return () => {
      if (swapPathTimeoutId != null)
        clearTimeout(swapPathTimeoutId);
    };
  }, [market, state.tokenIn, state.tokenOut, state.amountIn, state.slippage]);
  useEffectAsync(async () => {
    await Exchange.connectSocket();
    if (Exchange.contracts.length > 0) {
      setMarket(Exchange.contracts[0]);
    }
    
    const prev = AppStorage.get('__portfolio_swap__');
    if (prev != null) {
      setState({
        tokenIn: prev.tokenIn ? new AssetId(prev.tokenIn) : null,
        tokenOut: prev.tokenOut ? new AssetId(prev.tokenOut) : null,
        amountIn: prev.amountIn || '',
        amountOut: prev.amountOut || '',
        slippage: prev.slippage || ''
      });
    }
  }, []);
  
  return (
    <Box>
      <Card mt="4" variant="surface" style={{ borderRadius: '28px' }}>
        <Flex justify="between" align="center" px="3" mb="2">
          <Text color="gray" size="2">Spending ↗</Text>
          <Dialog.Root>
            <Dialog.Trigger>
              <Button variant="ghost" color="gray">
                <Icon path={mdiCog} size={0.8}></Icon>
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Flex justify="between" align="center">
                <Dialog.Title mb="0">Config</Dialog.Title>
                <Select.Root value={market ? market.id.toString() : ''} onValueChange={(e) => setMarket(Exchange.contracts.find((v) => v.id.toString() == e) || null)} size="2">
                  <Select.Trigger variant="soft" color="gray">{ market ? Exchange.marketPolicyOf(market) + ' ' + (market.version || market.account.substring(market.account.length - 4)) : 'Market unset' }</Select.Trigger>
                  <Select.Content position="popper" side="bottom">
                    <Select.Group>
                      <Select.Label>Market contract</Select.Label>
                      { Exchange.contracts.map((item) => <Select.Item key={item.id.toString()} value={item.id.toString()}>{ Exchange.marketPolicyOf(item) } contract — { item.version || item.account.substring(item.account.length - 4) }</Select.Item>) }
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Flex>
              <Box mt="3">
                <Tooltip side="top" content={`Slippage: maximal unfavorable deviation from best price`}>
                  <TextField.Root placeholder="Slippage %" size="2" value={state.slippage} onChange={(e) => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, e.target.value) }))}>
                    <TextField.Slot>
                      <Icon path={mdiPercent} size={0.8} />
                    </TextField.Slot>
                  </TextField.Root>
                </Tooltip>
              </Box>
            </Dialog.Content>
          </Dialog.Root>
        </Flex>
        <Flex justify="between" align="center">
          <TextField.Root style={{ width: '100%', backgroundColor: 'var(--color-background)' }} size="3" placeholder="Amount out" type="text" value={state.amountIn} onChange={(e) => setAmount('amount-in', e.target.value)} />
          <AssetSelector title="token to sell" value={state.tokenIn} onChange={(value) => updateState(prev => ({ ...prev, tokenIn: value }))}>
            <Button variant="soft" size="4" style={{ backgroundColor: 'var(--color-background)', boxShadow: 'none' }}>
              {
                state.tokenIn != null &&
                <Flex align="center" gap="1">
                  <Box style={{ position: 'relative' }}>
                    <AssetImage asset={state.tokenIn} size="2" iconSize="24px"></AssetImage>
                    {
                      state.tokenIn.token != null &&
                      <AssetImage asset={AssetId.fromHandle(state.tokenIn.chain || '')} size="1" style={{ position: 'absolute', top: '16px', left: '-6px' }} iconSize="16px"></AssetImage>
                    }
                  </Box>
                  <AssetName asset={state.tokenIn} symbol={true} tokenOnly={true} size="4"></AssetName>
                </Flex>
              }
              {
                state.tokenIn == null &&
                <Text size="4">Token ↗</Text>
              }
            </Button>
          </AssetSelector>
        </Flex>
        <Flex justify="between" px="3" mt="2" mb="1">
          <Text size="2" color="gray">{ Readability.toMoney(Exchange.equityAsset, swapInfo.valuationIn) }</Text>
          <Flex align="center" gap="1">
            { loadingPoly && <Spinner size="1"></Spinner> }
            <Text size="2" color="gray">{ Readability.toMoney(state.tokenIn, swapInfo.balanceIn) }</Text>
          </Flex>
        </Flex>
        <Flex align="center" gap="2" px="2" mt="2">
          <Slider variant="soft" color={swapInfo.balanceIn.gte(swapInfo.amountIn) ? undefined : 'red'} step={5} size="3" value={[swapInfo.balanceIn.gt(0) ? Math.min(100, Math.max(0, swapInfo.amountIn.dividedBy(swapInfo.balanceIn).multipliedBy(100).toNumber())) : 0]} onValueChange={(e) => setAmount('amount-in', ByteUtil.bigNumberToString(swapInfo.balanceIn.multipliedBy(e[0] / 100)))} />
          <Badge size="1" color={swapInfo.balanceIn.gte(swapInfo.amountIn) ? undefined : 'red'}>{ (swapInfo.balanceIn.gt(0) ? Math.min(100, Math.max(0, swapInfo.amountIn.dividedBy(swapInfo.balanceIn).multipliedBy(100).toNumber())) : 0).toFixed(2) }%{ swapInfo.balanceIn.lt(swapInfo.amountIn) ? '+' : '' }</Badge>
        </Flex>
        <Box position="relative">
          <Separator my="6" size="4"></Separator>
          <Flex justify="center" px="3" py="3" align="center" position="absolute" className="rt-Card" style={{ backgroundColor: 'var(--color-panel-solid)', borderRadius: '16px', top: '-24px', left: '50%', transform: 'translateX(-50%)' }}>
            <Button variant="ghost" style={{ height: 'auto' }} onClick={() => updateState(prev => ({
              tokenIn: prev.tokenOut,
              tokenOut: prev.tokenIn,
              amountIn: prev.amountOut,
              amountOut: prev.amountIn,
              slippage: prev.slippage
            }))}>
              <Icon path={mdiSwapVertical} size={1}></Icon>
            </Button>
          </Flex>
        </Box>
        <Flex justify="between" align="center" px="3" mb="2">
          <Text color="gray" size="2">Receiving ↙</Text>
          { loadingPath && <Spinner size="3"></Spinner> }
        </Flex>
        <Flex justify="between" align="center">
          <TextField.Root style={{ width: '100%', backgroundColor: 'var(--color-background)' }} size="3" placeholder="Amount in" type="text" value={state.amountOut} onChange={(e) => setAmount('amount-out', e.target.value)} />
          <AssetSelector title="token to buy" value={state.tokenOut} onChange={(value) => updateState(prev => ({ ...prev, tokenOut: value }))}>
            <Button variant="soft" size="4" style={{ backgroundColor: 'var(--color-background)', boxShadow: 'none' }}>
              {
                state.tokenOut != null &&
                <Flex align="center" gap="1">
                  <Box style={{ position: 'relative' }}>
                    <AssetImage asset={state.tokenOut} size="2" iconSize="24px"></AssetImage>
                    {
                      state.tokenOut.token != null &&
                      <AssetImage asset={AssetId.fromHandle(state.tokenOut.chain || '')} size="1" style={{ position: 'absolute', top: '16px', left: '-6px' }} iconSize="16px"></AssetImage>
                    }
                  </Box>
                  <AssetName asset={state.tokenOut} symbol={true} tokenOnly={true} size="4"></AssetName>
                </Flex>
              }
              {
                state.tokenOut == null &&
                <Text size="4">Token ↙</Text>
              }
            </Button>
          </AssetSelector>
        </Flex>
        <Flex justify="between" px="3" mt="2" mb="1">
          <Text size="2" color="gray">{ Readability.toMoney(Exchange.equityAsset, swapInfo.valuationOut) }</Text>
          <Text size="2" color="gray">{ Readability.toMoney(state.tokenOut, swapInfo.balanceOut) }</Text>
        </Flex>
      </Card>
      {
        bestPaths.map((path: RouterPath, pathIndex: number) => {
          const last = path[path.length - 1];
          const type = convervative ? 'min' : 'max';
          const amountIn = swapInfo.priceIn?.gt(0) && swapInfo.amountIn.gt(0) ? swapInfo.amountIn.multipliedBy(swapInfo.priceIn) : null;
          const amountOut = swapInfo.priceOut?.gt(0) && last.output[type].gt(0) ? last.output[type].multipliedBy(swapInfo.priceOut) : null;
          return (
            <Card key={'swap_path_' + pathIndex} mt="4" style={{ borderRadius: '28px' }}>
              <Box px="2">
                <Flex justify="between" align="center">
                  <Flex gap="2">
                    <Badge size="3" color={pathIndex == 0 ? undefined : 'gray'}>{ pathIndex == 0 ? 'Best route' : (pathIndex == 1 ? '2nd route' : (pathIndex == 2 ? '3rd route' : ((pathIndex + 1) + 'th route'))) }</Badge>
                    <Badge size="3" color="gray">{ Readability.toCount('swap', path.length) }</Badge>
                  </Flex>
                  <Text as="label" size="3">Slip <Switch size="2" color="red" checked={convervative} onCheckedChange={(e) => setConservative(e)} /></Text>
                </Flex>
                <Flex align="center" gap="1" wrap="wrap" my="4">
                  {
                    path.map((swap, swapIndex: number) =>
                      <Flex align="center" gap="1" wrap="wrap" key={'swap_path_' + pathIndex + '_' + swapIndex}>
                        {
                          swapIndex == 0 &&
                          <>
                            <Icon path={mdiChevronDoubleRight} size={0.9}></Icon>
                            <AssetImage asset={swap.side == OrderSide.Buy ? swap.pair.secondaryAsset?.hash : swap.pair.primaryAsset?.hash} iconSize="24px"></AssetImage>
                            <Text>{ Readability.toMoney(swap.side == OrderSide.Buy ? swap.pair.secondaryAsset?.hash || null : swap.pair.primaryAsset?.hash || null, swap.input[type]) }</Text>
                          </>
                        }
                        <Flex gap="1">
                          <Icon path={mdiArrowRight} size={0.9}></Icon>
                          <AssetImage asset={swap.side == OrderSide.Buy ? swap.pair.primaryAsset?.hash : swap.pair.secondaryAsset?.hash} iconSize="24px"></AssetImage>
                          <Text>{ Readability.toMoney(swap.side == OrderSide.Buy ? swap.pair.primaryAsset?.hash || null : swap.pair.secondaryAsset?.hash || null, swap.output[type]) }</Text>
                        </Flex>
                      </Flex>
                    )
                  }
                </Flex>
                <Flex justify="between" align="center" gap="2">
                  <Badge size="3" color={(amountOut || new BigNumber(0)).gte(amountIn || new BigNumber(0)) ? 'gray' : 'red'}>{ (amountOut || new BigNumber(0)).gte(amountIn || new BigNumber(0)) ? (convervative ? 'Min gain' : 'Gain') : (convervative ? 'Max loss' : 'Loss') } { amountIn && amountOut ? amountOut.minus(amountIn).dividedBy(amountIn).multipliedBy(100).toFixed(2) : '0.00' }%</Badge>
                  <PerformerButton title="Execute" description={`Swap involves paying ${Readability.toAssetSymbol(state.tokenIn || new AssetId())} to smart contract and placing one or more market orders in a row to receive ${Readability.toAssetSymbol(state.tokenOut || new AssetId())} as a result`} color={pathIndex == 0 ? 'lime' : 'gray'} onBuild={async () => {
                    const pays: Record<string, string> = Exchange.toPayment(new BigNumber(swapInfo.amountIn), assetsIn);
                    return Builder.swap({
                      ...state,
                      marketId: market?.id.toString() || '',
                      path: path,
                      pays: pays,
                    });
                  }}></PerformerButton>
                </Flex>
              </Box>
            </Card>
          )
        })
      }
    </Box>
  )
}

function TradingPairs() {
  const navigate = useNavigate();
  const [launchablePair, setLaunchablePair] = useState<AggregatedPair | null>(null);
  const [marketLauncher, setMarketLauncher] = useState<{ primary: AssetId | null, secondary: AssetId | null }>({ primary: null, secondary: null });
  const [pairs, setPairs] = useState<{ pair: AggregatedPair, whitelisted: boolean, cached: boolean }[]>([]);
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(false);
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
      result = [{ pair: launchablePair, whitelisted: !!Whitelist.contractAddressOf(launchablePair.primaryAsset) && !!Whitelist.contractAddressOf(launchablePair.secondaryAsset), cached: false }, ...result];
    }
    return result;
  }, [pairs, assetQuery, launchablePair]);
  useEffectAsync(async () => {
    setLoading(true);
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
    setLoading(false);
  }, [market, marketLauncher]);
  useEffectAsync(async () => {
    if (!market)
      return;

    setLoading(true);
    setPairs(prev => {
      if (prev.length > 0)
        return prev;

      return (RPC.fetchObject(AppStorage.get('__explorer__')) || []).map((x: any) => {
        if (x.pair != null && x.pair.primaryAsset != null && x.pair.secondaryAsset != null) {
          x.pair.primaryAsset = new AssetId(x.pair.primaryAsset.id);
          x.pair.secondaryAsset = new AssetId(x.pair.secondaryAsset.id);
        }
        x.cached = true;
        return x;
      });
    });
    try {
      const data = ((await Exchange.marketPairs(market.id)) || []).map((x) => ({
        pair: x,
        whitelisted: !!Whitelist.contractAddressOf(x.primaryAsset) && !!Whitelist.contractAddressOf(x.secondaryAsset),
        cached: false
      }));
      AppStorage.set('__explorer__', data);
      setPairs(data);
    } catch { }
    setLoading(false);
  }, [market]);
  useEffectAsync(async () => {
    await Exchange.connectSocket();
    if (Exchange.contracts.length > 0) {
      setMarket(Exchange.contracts[0]);
    }
    
    const updatePairs = () => setPairs(prev => {
      const copy = [...prev];
      for (let i = 0; i < copy.length; i++) {
        const symbol = copy[i];
        const target = Exchange.priceOf(symbol.pair.primaryAsset, symbol.pair.secondaryAsset);
        symbol.pair.price.open = target.open || symbol.pair.price.open;
        symbol.pair.price.close = target.close || symbol.pair.price.close;
      }
      return copy;
    });
    window.addEventListener('update:trade', updatePairs);
    return () => window.removeEventListener('update:trade', updatePairs);
  }, []);

  return (
    <>
      <Box pt="5" pb="3">
        <Flex px="1" align="center" justify="start">
          <TextField.Root placeholder="Try ETH/USDC…" variant="soft" color="gray" size="3" value={query} style={{ width: '100%', borderTopRightRadius: '0', borderBottomRightRadius: '0' }} onInput={(e) => setQuery(e.currentTarget.value || '')}>
            <TextField.Slot>
              <Icon path={mdiMagnify} size={0.8}></Icon>
            </TextField.Slot>
          </TextField.Root>
          <Select.Root value={market ? market.id.toString() : ''} onValueChange={(e) => setMarket(Exchange.contracts.find((v) => v.id.toString() == e) || null)} size="3">
            <Select.Trigger variant="soft" color="gray" style={{ borderTopLeftRadius: '0', borderBottomLeftRadius: '0' }}>{ market ? Exchange.marketPolicyOf(market) + ' ' + (market.version || market.account.substring(market.account.length - 4)) : 'Unset market' }</Select.Trigger>
            <Select.Content position="popper" side="bottom">
              <Select.Group>
                <Select.Label>Market contract</Select.Label>
                { Exchange.contracts.map((item) => <Select.Item key={item.id.toString()} value={item.id.toString()}>{ Exchange.marketPolicyOf(item) } contract — { item.version || item.account.substring(item.account.length - 4) }</Select.Item>) }
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Flex>
        <Flex justify="between" align="center" px="3" pt="4">
          { loading && <Spinner></Spinner> }
          { !loading && <Text>{ Readability.toCount('pair', pairsFilter.length) }</Text> }
          <Flex gap="2" justify="end">
            <Text>Launch</Text>
            <AssetSelector title="token 1 to launch" value={marketLauncher.primary} onChange={(value) => setMarketLauncher(prev => ({ primary: value, secondary: prev?.secondary || null }))}>
              <Button variant="ghost" size="3">
                {
                  marketLauncher.primary != null &&
                  <Flex align="center" gap="2">
                    <AssetImage asset={marketLauncher.primary} size="2" iconSize="16px"></AssetImage>
                    <Text>{ Readability.toAssetSymbol(marketLauncher.primary) }</Text>
                  </Flex>
                }
                { marketLauncher.primary == null && (assetQuery.primary?.toUpperCase() || 'AAA') }
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
                { marketLauncher.secondary == null && (assetQuery.secondary?.toUpperCase() || 'BBB') }
              </Button>
            </AssetSelector>
          </Flex>
        </Flex>
      </Box>
      {
        pairsFilter.map((item, index) =>
          <Button variant="ghost" color="gray" radius="none" style={{ display: 'block', width: '100%', borderRadius: '24px' }} mb={index < pairsFilter.length - 1 ? '4' : undefined} key={item.pair.id.toString()} onClick={() => navigate(`/orderbook/${Exchange.toOrderbookQuery(market?.id || new BigNumber(0), item.pair.primaryAsset, item.pair.secondaryAsset)}`)}>
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
                        <Badge radius="full" size="1" color="purple">{ Exchange.toAPY(item.pair.poolFeeRate || market?.maxPoolFeeRate || new BigNumber(0), item.pair.price.poolLiquidity, item.pair.price.poolVolume).toFixed(2) }% APY</Badge>
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
    </>
  )
}

function PortfolioAssets(props: {
  assets: CachedBalance[],
  todayProfits: boolean,
  readOnly: boolean
}) {
  const [available, setAvailable] = useState(false);
  const equityAssets = useMemo(toEquityAssets(props.assets, props.todayProfits, available), [props.assets, props.todayProfits, available]);
  const repayableAssets = useMemo(() => equityAssets.filter(x => x.asset.token != null && x.asset.chain == new AssetId().chain), [equityAssets]);
  const nativeAssets = useMemo(() => equityAssets.filter(x => x.asset.token == null || x.asset.chain != new AssetId().chain), [equityAssets]);
  return (
    <Box pt="4">
      <Flex justify="between" align="center" pb="4">
        <Text>{ repayableAssets.length > 0 ? 'Synthetic balance sheet' : 'Native balance sheet' }</Text>
        <Select.Root value={available ? '1' : '0'} onValueChange={(e) => setAvailable(parseInt(e) > 0)}>
          <Select.Trigger />
          <Select.Content>
            <Select.Group>
              <Select.Label>View mode</Select.Label>
              <Select.Item value="1">Spendable</Select.Item>
              <Select.Item value="0">Overall</Select.Item>
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Flex>
      {
        repayableAssets.length > 0 &&
        <Box mb="4">
          <Callout.Root color="yellow">
            <Callout.Icon>
              <Icon path={mdiAlert} />
            </Callout.Icon>
            <Callout.Text>Use synthetic assets to access the multi-chain liquidity, convert them back to native tokens at a 1:1 rate using available liquidity.</Callout.Text>
          </Callout.Root>
        </Box>
      }
      { repayableAssets.map((item) => <BalanceView key={item.asset.id} item={item} readOnly={props.readOnly} available={available}></BalanceView>) }
      {
        repayableAssets.length > 0 && nativeAssets.length > 0 &&
        <Flex mt="6" mb="4" align="center" justify="between">
          <Text>Native balance sheet</Text>
          <Badge variant="surface" color="yellow" size="3">Native</Badge>
        </Flex>
      }
      { nativeAssets.map((item) => <BalanceView key={item.asset.id} item={item} readOnly={props.readOnly} available={available}></BalanceView>) }
      {
        !props.assets.length && 
        <Flex px="4" justify="center">
          <Text size="2" align="center">No assets to show.</Text>
        </Flex>
      }
    </Box>
  )
}

export default function PortfolioPage() {
  const params = useParams();
  const ownerAddress = AppData.getWalletAddress();
  const baseAddress = params.account || ownerAddress || null;
  const readOnly = baseAddress != ownerAddress;
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const mobile = document.body.clientWidth <= 600;
  const [search, setSearch] = useSearchParams();
  const [assetResync, setAssetResync] = useState(0);
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<CachedBalance[]>([]);
  const [viewer, setViewer] = useState<'swap' | 'trade' | 'assets' | 'open-orders' | 'closed-orders' | 'open-pools' | 'closed-pools' | 'best-pools'>('assets');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [todayProfits, setTodayProfits] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [moreOrders, setMoreOrders] = useState(true);
  const [morePools, setMorePools] = useState(true);
  const findOrders = useCallback(async (refresh?: boolean) => {
    if (!baseAddress) {
      setOrders([]);
      setMoreOrders(false);
      return false;
    }
    try {
      const cursor = Cursor.offset(refresh ? 0 : orders.length);
      const data = await Exchange.accountOrders({ address: baseAddress, page: Math.floor(cursor.offset / cursor.count), active: viewer == 'open-orders' });
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
  }, [params.account, pools, viewer]);
  const findPools = useCallback(async (refresh?: boolean) => {
    const bestPools = viewer == 'best-pools';
    if (!bestPools && !baseAddress) {
      setPools([]);
      setMorePools(false);
      return false;
    }
    try {
      const cursor = Cursor.offset(refresh ? 0 : pools.length);
      const page = Math.floor(cursor.offset / cursor.count);
      const data = bestPools ? await Exchange.marketPools({ page: page }) : await Exchange.accountPools({ address: baseAddress || '', page: page, active: viewer == 'open-pools' });
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
      AlertBox.open(AlertType.Error, 'Failed to fetch LPs: ' + (exception as Error).message);
      if (refresh)
        setPools([]);
      setMorePools(false);
      return false;
    }
  }, [params.account, pools, viewer]);
  useEffectAsync(async () => {
    setLoading(true);
    if (viewer == 'open-orders' || viewer == 'closed-orders') {
      await findOrders(true);
    } else if (viewer == 'open-pools' || viewer == 'closed-pools'|| viewer == 'best-pools') {
      await findPools(true);
    } else if (viewer == 'assets' || viewer == 'swap') {
      setAssetResync(new Date().getTime());
    }
    setLoading(false);
  }, [viewer, params.account]);
  useEffect(() => {
    const view = search.get('view') || AppStorage.get('__portfolio_view__') || null;
    if (view != null && ['swap', 'trade', 'assets', 'open-orders', 'closed-orders', 'open-pools', 'closed-pools', 'best-pools'].includes(view)) {
      AppStorage.set('__portfolio_view__', view);
      setViewer(view as any);
    } else {
      AppStorage.set('__portfolio_view__');
    }  
  }, [search]);

  return (
    <Box px={mobile ? undefined : '4'} pt="4" minWidth="285px" maxWidth="680px" mx="auto">
      <Flex gap="2" align="center" justify="between" px="3" mb="2">
        <Flex align="center" gap="2">
          <Heading size={document.body.clientWidth < 450 ? '4' : '6'}>DEX</Heading>
          <Button variant="surface" size="1" color={ readOnly ? 'red' : 'lime' }>{ baseAddress ? baseAddress.substring(baseAddress.length - 6) : 'Preview' }</Button>
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
                  <Button variant="ghost" size="3" type="submit" loading={loading} disabled={!query.trim().length || !Signing.verifyAddress(query.trim()) } onClick={(e) => {
                    e.preventDefault();
                    navigate(`/portfolio/${query.trim()}?view=assets`);
                    setAssetResync(new Date().getTime());
                    setSearching(false);
                  }}>Find portfolio</Button>
                </Flex>
              </form>
            </Dialog.Content>
          </Dialog.Root>
        </Flex>
      </Flex>
      {
        mobile &&
        <Box>
          <Separator my="4" size="4"></Separator>
        </Box>
      }
      <PortfolioWorth address={baseAddress} assetResync={assetResync} todayProfits={todayProfits} onTodayProfitsChange={setTodayProfits} onAssetsChange={viewer == 'swap' || viewer == 'assets' ? setAssets : undefined}></PortfolioWorth>
      <Box px="2" pt="2">
        <Tabs.Root value={viewer.replace(/(open-)|(closed-)|(best-)/g, '')} onValueChange={(x) => setSearch({
          view: x == 'orders' || x == 'pools' ? 'open-' + x : x
        })} mt="4">
          <Tabs.List size="2" color="lime" justify={mobile ? undefined : 'center'}>
            <Tabs.Trigger value="trade" className="tab-padding-erase">
              <Badge size="3" radius="large">
                <Flex align="center" gap="1">
                  <Icon path={mdiShoppingSearch} size={0.6}></Icon>
                  <Text>Trade</Text>
                </Flex>
              </Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="swap" className="tab-padding-erase">
              <Badge size="3" radius="large">
                <Flex align="center" gap="1">
                  <Icon path={mdiMapMarkerPath} size={0.6}></Icon>
                  <Text>Swap</Text>
                </Flex>
              </Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="assets" className="tab-padding-erase">
              <Badge size="3" radius="large">
                <Flex align="center" gap="1">
                  <Icon path={mdiPaletteSwatchVariant} size={0.6}></Icon>
                  <Text>Balance</Text>
                </Flex>
              </Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="pools" className="tab-padding-erase">
              <Badge size="3" radius="large">
                <Flex align="center" gap="1">
                  <Icon path={mdiWater} size={0.6}></Icon>
                  <Text>LPs</Text>
                </Flex>
              </Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="orders" className="tab-padding-erase">
              <Badge size="3" radius="large">
                <Flex align="center" gap="1">
                  <Icon path={mdiShimmer} size={0.6}></Icon>
                  <Text>Orders</Text>
                </Flex>
              </Badge>
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="trade">
            <TradingPairs></TradingPairs>
          </Tabs.Content>
          <Tabs.Content value="swap">
            <SwapRouter assets={assets}></SwapRouter>
          </Tabs.Content>
          <Tabs.Content value="assets">
            <PortfolioAssets assets={assets} todayProfits={todayProfits} readOnly={readOnly}></PortfolioAssets>
          </Tabs.Content>
          <Tabs.Content value="pools">
            <Box pt="4">
              <Flex justify="between" align="center" pb="4">
                <Text>LP { viewer == 'best-pools' ? 'market' : 'history' }</Text>
                <Select.Root value={viewer.replace('-pools', '')} onValueChange={(e) => setSearch({ view: e + '-pools' })}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Group>
                      <Select.Label>LP filter</Select.Label>
                      <Select.Item value="best">Best LP</Select.Item>
                      <Select.Item value="open">Open LP</Select.Item>
                      <Select.Item value="closed">Closed LP</Select.Item>
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Flex>
              <InfiniteScroll dataLength={pools.length} hasMore={morePools} next={findPools} loader={<div></div>}>
                {
                  pools.map((item) =>
                    <Box key={item.poolId.toString()} mb="4">
                      <PoolView item={item} readOnly={readOnly || viewer == 'best-pools'}></PoolView>
                    </Box>)
                }
              </InfiniteScroll>
              {
                !pools.length &&
                <Flex px="4" justify="center">
                  <Text size="2" align="center">No LPs to show.</Text>
                </Flex>
              }
            </Box>
          </Tabs.Content>
          <Tabs.Content value="orders">
            <Box pt="4">
              <Flex justify="between" align="center" pb="4">
                <Text>Order history</Text>
                <Select.Root value={viewer.replace('-orders', '')} onValueChange={(e) => setSearch({ view: e + '-orders' })}>
                  <Select.Trigger />
                  <Select.Content>
                    <Select.Group>
                      <Select.Label>Order filter</Select.Label>
                      <Select.Item value="open">Open orders</Select.Item>
                      <Select.Item value="closed">Closed orders</Select.Item>
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Flex>
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
                <Flex px="4" justify="center">
                  <Text size="2" align="center">No orders to show.</Text>
                </Flex>
              }
            </Box>
          </Tabs.Content>
        </Tabs.Root>
      </Box>
    </Box>
  );
}