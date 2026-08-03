import { Badge, Box, Button, Card, Dialog, Flex, Heading, Select, Spinner, Switch, Text, TextField, Tooltip, Separator, Callout, DropdownMenu } from "@radix-ui/themes";
import { mdiAlert, mdiArrowBottomLeft, mdiArrowLeft, mdiArrowRight, mdiArrowTopRight, mdiBriefcaseUpload, mdiChartTimelineVariant, mdiChartTimelineVariantShimmer, mdiChevronDoubleRight, mdiListBox, mdiLockOutline, mdiMapMarkerPath, mdiPaletteSwatchVariant, mdiPlus, mdiSetRight, mdiSwapVertical } from "@mdi/js";
import { AssetId, Readability, ByteUtil, TextUtil, RPC, Signing, Whitelist } from "tangentsdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Exchange, Balance, Order, Pool, Cursor, AggregatedPair, OrderSide, RouterPath, Market, PolyAsset, PseudoDelegatedPool, DelegatedPool } from "../../core/exchange";
import { useEffectAsync } from "../../core/react";
import { AppData } from "../..//core/app";
import { mdiCheckDecagram, mdiMagnify, mdiMagnifyScan, mdiShoppingSearch } from "@mdi/js";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AppStorage } from "../../core/storage";
import { AlertBox, AlertType } from "../../components/alert";
import { AssetImage, AssetName } from "../../components/asset";
import { Builder, PerformerButton } from "./../../components/exchange/performer";
import { DelegatedPoolView, PoolView, PseudoDelegatedPoolView } from "../../components/exchange/pool";
import BigNumber from "bignumber.js";
import OrderView from "../../components/exchange/order";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import AssetSelector from "../../components/exchange/selector";
import AddressAvatar from "../../components/avatar";

type SwapState = {
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
    const list = assets.map((v: Balance) => {
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
    return available ? list.filter(x => x.value.gt(0)) : list;
  };
};
let approxEq = (a: BigNumber, b: BigNumber) => a.lte(b.multipliedBy(1.005)) && a.gte(b.multipliedBy(0.995));

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
        const chain = new AssetId().chain;
        const assets = await Exchange.marketAssets(item.asset, true);
        setAssets(assets.filter((v) => v.chain != chain));
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
              <Badge size="2" variant="soft" color={previousEquity.gt(currentEquity) ? 'red' : (previousEquity.eq(currentEquity) ? 'gray' : undefined)} mt="1">
                <Icon path={mdiSetRight} size={0.7}></Icon>
                <Text size="1">{ Readability.toPercentageDelta(previousEquity, currentEquity) }</Text>
              </Badge>
            </Tooltip>
          </Flex>
        </Box>
      </Flex>
      <Flex justify="between" mt="2" gap="1">
        <Flex width="100%">
          <Select.Root size="2" value={asset?.id || '!'} onValueChange={(value) => setAsset(value == '!' ? null : assets?.find(x => x.id == value) || null)}>
            <Select.Trigger variant="surface" placeholder="Repayable asset" className="select-plain" style={{ borderTopRightRadius: '0', borderBottomRightRadius: '0' }}>
            </Select.Trigger>
            <Select.Content variant="soft">
              <Select.Group>
                <Select.Item value="!" disabled={true}>Chain</Select.Item>
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
          <TextField.Root style={{ width: '100%', borderTopLeftRadius: '0', borderBottomLeftRadius: '0' }} placeholder={`≤ ${Readability.toMoney(item.asset, BigNumber.min(item.available, asset?.liquidity || new BigNumber(0)))} or %`} size="2" value={amount} onChange={(e) => setAmount(e.target.value)}></TextField.Root>   
        </Flex>
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
              <Badge size="2" variant="soft" color={previousEquity.gt(currentEquity) ? 'red' : (previousEquity.eq(currentEquity) ? 'gray' : undefined)} mt="1">
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

function WalletNavigator(props: {
  address: string | null,
  market: Market | null,
  assetResync: number,
  readOnly: boolean,
  todayProfits: boolean,
  available: boolean,
  viewer: 'market' | 'wallet',
  onViewerToggle: () => any, 
  onMarketChange: (value: Market | null) => any,
  onTodayProfitsChange: (value: boolean) => any,
  onAssetsChange?: (value: CachedBalance[] | ((prev: CachedBalance[]) => CachedBalance[])) => any
}) {
  const mobile = document.body.clientWidth <= 600;
  const [assets, setAssets] = useState<CachedBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sync, setSync] = useState(0);
  const equityAssets = useMemo(toEquityAssets(assets, props.todayProfits, props.available), [assets, props.todayProfits, props.available, sync]);
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
    window.addEventListener('update:delegated-pool', updateForced);
    window.addEventListener('exchange:ready', updateNormal);
    return () => {
      window.removeEventListener('update:trade', updateNormal);
      window.removeEventListener('update:order', updateForced);
      window.removeEventListener('update:pool', updateForced);
      window.removeEventListener('update:delegated-pool', updateForced);
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
    <Card mt="2" variant={mobile ? 'ghost' : 'surface'} style={mobile ? { margin: 0, border: 'none', paddingTop: 0 } : { borderRadius: '28px' }}>
      <Box px={mobile ? undefined : '2'} py={mobile ? undefined : '1'}>
        <Box mb="2">
          <Flex justify="between" align="center" mb="1">
            <Text size={mobile ? '4' : '3'} color="gray">{ props.available ? 'Available' : 'Invested' }</Text>
            <Select.Root value={props.market ? props.market.id.toString() : ''} onValueChange={(e) => {
              if (e != 'dex-pull') {
                props.onMarketChange(Exchange.markets.find((v) => v.id.toString() == e) || null);
              } else {
                setSync(-1);
              }
            }} size="2">
              <Select.Trigger variant="soft" style={{ color: 'var(--gray-11)' }}>{ props.market ? Exchange.marketPolicyOf(props.market) + ' ' + (props.market.version || props.market.account.substring(props.market.account.length - 4)) : 'Unknown' }</Select.Trigger>
              <Select.Content position="popper" side="bottom">
                <Select.Group>
                  <Select.Label>DEX version</Select.Label>
                  { Exchange.markets.map((item) => <Select.Item key={item.id.toString()} value={item.id.toString()}>{ Exchange.marketPolicyOf(item) } { item.version || item.account.substring(item.account.length - 4) }</Select.Item>) }
                </Select.Group>
                <Select.Separator />
                <Select.Group>
                  <Select.Label>DEX sync</Select.Label>
                  <Select.Item value="dex-pull">Pull</Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>
          <Heading size="7">{ Readability.toMoney(Exchange.equityAsset, equity.current) }</Heading>
        </Box>
        <Flex gap="2" wrap="wrap" justify="between">
          <Button variant="soft" size="2" loading={loading} color={ equity.previous.gt(equity.current) ? 'red' : (equity.previous.eq(equity.current) ? 'gray' : undefined) } onClick={() => props.onTodayProfitsChange(!props.todayProfits)}>{ Readability.toMoney(Exchange.equityAsset, equity.current.minus(equity.previous), true) } ({ Readability.toPercentageDelta(equity.previous, equity.current) }) { props.todayProfits ? 'today' : 'total' }</Button>
          {
            !props.readOnly &&
            <Button variant="surface" color="yellow" size="2" onClick={props.onViewerToggle}>
              <Flex align="center" gap="1">
                { props.viewer == 'market' && 'Wallet' }
                <Icon path={props.viewer == 'market' ? mdiArrowRight : mdiArrowLeft} size={0.8} style={{ transform: 'translateY(-1px)' }}></Icon>
                { props.viewer == 'wallet' && 'Dex' }
              </Flex>
            </Button>
          }
        </Flex>
      </Box>
    </Card>
  )
}

function WalletAssets(props: {
  assets: CachedBalance[],
  todayProfits: boolean,
  available: boolean,
  readOnly: boolean
}) {
  const equityAssets = useMemo(toEquityAssets(props.assets, props.todayProfits, props.available), [props.assets, props.todayProfits, props.available]);
  const repayableAssets = useMemo(() => equityAssets.filter(x => x.asset.token != null && x.asset.chain == new AssetId().chain), [equityAssets]);
  const nativeAssets = useMemo(() => equityAssets.filter(x => x.asset.token == null || x.asset.chain != new AssetId().chain), [equityAssets]);
  return (
    <Box>
      {
        repayableAssets.length > 0 &&
        <Box mb="4">
          <Callout.Root color="yellow">
            <Callout.Icon>
              <Icon path={mdiAlert} />
            </Callout.Icon>
            <Callout.Text>Trading often gets you synthetic assets, redeem native tokens here.</Callout.Text>
          </Callout.Root>
        </Box>
      }
      { repayableAssets.map((item) => <BalanceView key={item.asset.id} item={item} readOnly={props.readOnly} available={props.available}></BalanceView>) }
      {
        repayableAssets.length > 0 && nativeAssets.length > 0 &&
        <Box my="6" style={{ border: '1px dashed var(--gray-8)' }}></Box>
      }
      { nativeAssets.map((item) => <BalanceView key={item.asset.id} item={item} readOnly={props.readOnly} available={props.available}></BalanceView>) }
      {
        !props.assets.length && 
        <Flex px="4" pt="2" justify="center">
          <Text size="2" align="center">No assets to show.</Text>
        </Flex>
      }
    </Box>
  )
}

function MarketRouter(props: {
  assets: CachedBalance[],
  market: Market | null
  pair: { primary: AssetId | null, secondary: AssetId | null }
  setPair: (p: { primary: AssetId | null, secondary: AssetId | null }) => any
}) {
  const assets = props.assets;
  const superMobile = document.body.clientWidth <= 400;
  const [polyAssets, setPolyAssets] = useState<AssetId[]>([]);
  const [state, setState] = useState<SwapState>({ amountIn: '', amountOut: '', slippage: '0.50%' });
  const [bestPaths, setBestPaths] = useState<RouterPath[] | null>(null);
  const [convervative, setConservative] = useState(false);
  const [loadingPoly, setLoadingPoly] = useState<boolean>(false);
  const [loadingPath, setLoadingPath] = useState<boolean>(false);
  const assetsIn = useMemo((): Balance[] => assets.filter((v) => v.asset.id == props.pair.primary?.id || polyAssets.findIndex((i) => i.id == v.asset.id) != -1), [props.pair.primary, assets, polyAssets]);
  const swapInfo = useMemo((): { balanceIn: BigNumber, balanceOut: BigNumber, amountIn: BigNumber, amountOut: BigNumber, priceIn: BigNumber | null, priceOut: BigNumber | null, valuationIn: BigNumber | null, valuationOut: BigNumber | null, slippage: BigNumber } => {
    const assetIn = assetsIn.reduce((a, b) => a.plus(b.available), new BigNumber(0));
    const assetOut = props.pair.secondary ? assets.find((x) => x.asset.id == props.pair.secondary?.id) : null;
    const finalAmountIn = TextUtil.toNumericValueOrPercent(state.amountIn);
    const finalAmountOut = TextUtil.toNumericValue(state.amountOut);
    const priceIn = props.pair.primary ? Exchange.priceOf(props.pair.primary).close : null;
    const priceOut = props.pair.secondary ? Exchange.priceOf(props.pair.secondary).close : null;
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
  }, [state, assets, assetsIn, props.pair]);
  const updateState = useCallback((change: (prev: SwapState) => SwapState) => {
    setState(prev => {
      const result = change(prev);
      AppStorage.set('__market_router__', {
        primary: props.pair.primary?.id || null,
        secondary: props.pair.secondary?.id || null,
        amountIn: result.amountIn,
        amountOut: result.amountOut,
        slippage: result.slippage
      })
      return result;
    });
  }, [props.pair]);
  const setAmount = useCallback((type: 'amount-in' | 'amount-out', value: string) => {
    if (type == 'amount-in') {
      const amountIn = TextUtil.toNumericValueOrPercent(value); let amountOut = '';
      if (amountIn.relative) {
        const assetIn = props.pair.secondary ? assets.find((x) => x.asset.id == props.pair.secondary?.id) : null;
        amountIn.absolute = amountIn.relative.multipliedBy(assetIn?.available || new BigNumber(0));
      }
      if (amountIn.absolute && amountIn.absolute.gte(0) && amountIn.absolute.isFinite()) {
        const priceIn = props.pair.primary ? Exchange.priceOf(props.pair.primary).close : null;
        const priceOut = props.pair.secondary ? Exchange.priceOf(props.pair.secondary).close : null;
        if (priceIn?.gt(0) && priceOut?.gt(0)) {
          amountOut = ByteUtil.bigNumberToString(amountIn.absolute.dividedBy(priceOut.dividedBy(priceIn)));
        }
      }
      updateState(prev => ({ ...prev, amountIn: value, amountOut: amountOut }));
    } else if (type == 'amount-out') {
      const amountOut = TextUtil.toNumericValue(value); let amountIn = '';
      if (amountOut.gte(0) && amountOut.isFinite()) {
        const priceIn = props.pair.primary ? Exchange.priceOf(props.pair.primary).close : null;
        const priceOut = props.pair.secondary ? Exchange.priceOf(props.pair.secondary).close : null;
        if (priceIn?.gt(0) && priceOut?.gt(0)) {
          amountIn = ByteUtil.bigNumberToString(amountOut.multipliedBy(priceOut.dividedBy(priceIn)));
        }
      }
      updateState(prev => ({ ...prev, amountIn: amountIn, amountOut: value }))
    }
  }, [state, assets, props.pair]);
  useEffectAsync(async () => {
    if (!props.pair.primary) {
      setPolyAssets([]);
      return;
    }

    setLoadingPoly(true);
    try {
      setPolyAssets(await Exchange.marketAssets(props.pair.primary));
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch poly assets: ' + (exception as Error).message);
      setPolyAssets([]);
    }
    setLoadingPoly(false);
  }, [props.pair.primary]);
  useEffect(() => {
    if (swapPathTimeoutId != null) {
      clearTimeout(swapPathTimeoutId);
      setLoadingPath(false);
    }

    if (props.market != null && props.pair.primary != null && props.pair.secondary != null && props.pair.secondary.id != props.pair.primary.id) {
      const balanceIn = assetsIn.reduce((a, b) => a.plus(b.available), new BigNumber(0));
      const finalAmountIn = TextUtil.toNumericValueOrPercent(state.amountIn);
      const amountIn = finalAmountIn.relative?.gt(0) ? finalAmountIn.relative.multipliedBy(balanceIn) : (finalAmountIn.absolute?.gt(0) ? finalAmountIn.absolute : new BigNumber(0));
      const slippage = BigNumber.min(1, BigNumber.max(0, TextUtil.toNumericValueOrPercent(state.slippage).relative || new BigNumber(0)))
      if (amountIn.lte(balanceIn) && amountIn.gt(0) && slippage.gte(0) && slippage.lte(1)) {
        setLoadingPath(true);
        swapPathTimeoutId = setTimeout(async () => {
          try {
            const paths = (await Exchange.marketPaths(props.market?.id || '', props.pair.primary || new AssetId(), props.pair.secondary || new AssetId(), amountIn, slippage)).filter(x => x.length > 0);
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
      } else {
        setBestPaths(null);
      }
    } else {
      setBestPaths(null);
    }
    
    return () => {
      if (swapPathTimeoutId != null)
        clearTimeout(swapPathTimeoutId);
    };
  }, [props.market, props.pair.secondary, props.pair.primary, state.amountIn, state.slippage]);
  useEffect(() => {
    const prev = AppStorage.get('__market_router__');
    if (prev != null) {
      setState({
        amountIn: prev.amountIn || '',
        amountOut: prev.amountOut || '',
        slippage: prev.slippage || ''
      });
      props.setPair({
        primary: prev.primary ? new AssetId(prev.primary) : null,
        secondary: prev.secondary ? new AssetId(prev.secondary) : null,
      });
    }
  }, []);
  useEffect(() => {
    setState(prev => {
      AppStorage.set('__market_router__', {
        primary: props.pair.primary?.id || null,
        secondary: props.pair.secondary?.id || null,
        amountIn: prev.amountIn,
        amountOut: prev.amountOut,
        slippage: prev.slippage
      })
      return prev;
    });
  }, [props.pair]);
  
  return (
    <Box>
      <Box px="5" pt="2" pb="5" position="relative" style={{
        borderRadius: '28px',
        border: '1px solid var(--gray-6)'
      }}>
        <Flex>
          <Flex align="center" gap="1">
            <Text size="4">Pay</Text>
            <Icon path={mdiArrowTopRight} size={0.8}></Icon>
          </Flex>
          <Flex justify="end" align="center" gap="2" width="100%">
            <TextField.Root style={{ width: '100%', backgroundColor: 'transparent', border: 'none', textAlign: 'right', boxShadow: 'none', outline: 'none' }} size="3" placeholder="Out" type="text" value={state.amountIn} onChange={(e) => setAmount('amount-in', e.target.value)} />
            { props.pair.primary && <AssetImage asset={props.pair.primary} size="2" iconSize="24px"></AssetImage> }
          </Flex>
        </Flex>
        <Flex justify="between" style={{ padding: '0 2px' }}>
          <Text size="1" color="gray">{ Readability.toMoney(Exchange.equityAsset, swapInfo.valuationIn) }</Text>
          <Text size="1" color="gray">{ Readability.toMoney(props.pair.primary, swapInfo.balanceIn) }</Text>
        </Flex>
        <Flex mt="3">
          <Flex align="center" gap="1">
            <Text size="4">Get</Text>
            <Icon path={mdiArrowBottomLeft} size={0.8}></Icon>
          </Flex>
          <Flex justify="end" align="center" gap="2" width="100%">
            <TextField.Root style={{ width: '100%', backgroundColor: 'transparent', border: 'none', textAlign: 'right', boxShadow: 'none', outline: 'none' }} size="3" placeholder="In" type="text" value={state.amountOut} onChange={(e) => setAmount('amount-out', e.target.value)} />
            { props.pair.secondary && <AssetImage asset={props.pair.secondary} size="2" iconSize="24px"></AssetImage> }
          </Flex>
        </Flex>
        <Flex justify="between" style={{ padding: '0 2px' }}>
          <Text size="1" color="gray">{ Readability.toMoney(Exchange.equityAsset, swapInfo.valuationOut) }</Text>
          <Text size="1" color="gray">{ Readability.toMoney(props.pair.secondary, swapInfo.balanceOut) }</Text>
        </Flex>
        <Flex align="center" justify="between" px="1" position="absolute" style={{ left: 0, right: 0, bottom: '-42px' }}>
          <Tooltip side="top" content={`Slippage: maximal unfavorable deviation from best price`}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="ghost" size="1" color="gray">
                  Slippage { state.slippage }
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item onClick={() => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, '0.01%') }))} shortcut="<= 0.01%">Min</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, '0.05%') }))} shortcut="<= 0.05%">Lowest</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, '0.15%') }))} shortcut="<= 0.15%">Low</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, '0.30%') }))} shortcut="<= 0.30%">Medium</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, '0.50%') }))} shortcut="<= 0.50%">Standard</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, '1.00%') }))} shortcut="<= 1.00%">High</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, '2.50%') }))} shortcut="<= 2.50%">Highest</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => updateState(prev => ({ ...prev, slippage: TextUtil.toPercent(prev.slippage, '5.00%') }))} shortcut="<= 5.00%">Max</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Tooltip>
          <Flex justify="end" align="center" gap="1">
            <Button variant="soft" size="1" style={{ fontSize: '0.925rem', padding: '10px' }} onClick={() => setAmount('amount-in', ByteUtil.bigNumberToString(swapInfo.balanceIn.multipliedBy(0.25)))} color={approxEq(swapInfo.amountIn, swapInfo.balanceIn.multipliedBy(0.25)) ? undefined : 'gray'}>25%</Button>
            <Button variant="soft" size="1" style={{ fontSize: '0.925rem', padding: '10px' }} onClick={() => setAmount('amount-in', ByteUtil.bigNumberToString(swapInfo.balanceIn.multipliedBy(0.50)))} color={approxEq(swapInfo.amountIn, swapInfo.balanceIn.multipliedBy(0.50)) ? undefined : 'gray'}>50%</Button>
            { !superMobile && <Button variant="soft" size="1" style={{ fontSize: '0.925rem', padding: '10px' }} onClick={() => setAmount('amount-in', ByteUtil.bigNumberToString(swapInfo.balanceIn.multipliedBy(0.75)))} color={approxEq(swapInfo.amountIn, swapInfo.balanceIn.multipliedBy(0.75)) ? undefined : 'gray'}>75%</Button> }
            <Button variant="soft" size="1" style={{ fontSize: '0.925rem', padding: '10px' }} onClick={() => setAmount('amount-in', ByteUtil.bigNumberToString(swapInfo.balanceIn.multipliedBy(1.00)))} color={approxEq(swapInfo.amountIn, swapInfo.balanceIn.multipliedBy(1.00)) ? undefined : (swapInfo.balanceIn.gte(swapInfo.amountIn) ? 'gray' : 'red')}>Max</Button>
          </Flex>
        </Flex>
      </Box>
      <Box position="relative" px="5">
        <Separator mt="9" mb="8" size="4"></Separator>
        <Flex justify="center" px="2" py="2" align="center" position="absolute" className="rt-Card" style={{ backgroundColor: 'var(--color-panel-solid)', borderRadius: '16px', top: '-20px', left: '50%', transform: 'translateX(-50%)' }}>
          <Button variant="ghost" style={{ height: 'auto' }} onClick={() => {
            updateState(prev => ({
              amountIn: prev.amountOut,
              amountOut: prev.amountIn,
              slippage: prev.slippage
            }));
            props.setPair({
              primary: props.pair.secondary,
              secondary: props.pair.primary
            });
          }} loading={loadingPath || loadingPoly}>
            <Icon path={mdiSwapVertical} size={0.9}></Icon>
          </Button>
        </Flex>
      </Box>
      {
        bestPaths?.map((path: RouterPath, pathIndex: number) => {
          const last = path[path.length - 1];
          const type = convervative ? 'min' : 'max';
          const amountIn = swapInfo.priceIn?.gt(0) && swapInfo.amountIn.gt(0) ? swapInfo.amountIn.multipliedBy(swapInfo.priceIn) : null;
          const amountOut = swapInfo.priceOut?.gt(0) && last.output[type].gt(0) ? last.output[type].multipliedBy(swapInfo.priceOut) : null;
          return (
            <Card key={'swap_path_' + pathIndex} mt="4" style={{ borderRadius: '28px' }}>
              <Box px="2" py="1">
                <Flex justify="between" align="center">
                  <Flex gap="2">
                    <Badge size="3" color={pathIndex == 0 ? undefined : 'gray'}>{ pathIndex == 0 ? 'Best' : (pathIndex == 1 ? '2nd' : (pathIndex == 2 ? '3rd' : ((pathIndex + 1) + 'th'))) }</Badge>
                    <Badge size="3" color="gray">{ Readability.toCount('swap', path.length) }</Badge>
                  </Flex>
                  <Text as="label" size="3">Min <Switch size="2" color="red" checked={convervative} onCheckedChange={(e) => setConservative(e)} /></Text>
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
                  <PerformerButton title="Execute" description={`Swap involves paying ${Readability.toAssetSymbol(props.pair.primary || new AssetId())} to smart contract and placing one or more market orders in a row to receive ${Readability.toAssetSymbol(props.pair.secondary || new AssetId())} as a result`} color={pathIndex == 0 ? undefined : 'gray'} onBuild={async () => {
                    const pays: Record<string, string> = Exchange.toPayment(new BigNumber(swapInfo.amountIn), assetsIn);
                    return Builder.swap({
                      ...state,
                      tokenIn: props.pair.primary,
                      tokenOut: props.pair.secondary,
                      marketId: props.market?.id.toString() || '',
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
      {
        !loadingPoly && !bestPaths?.length &&
        <Flex px="4" justify="center">
          <Text size="2" align="center">{ loadingPath ? 'Optimizing swap routes...' : (bestPaths ? 'No routes for the swap.' : 'Invalid swap action.') }</Text>
        </Flex>
      }
    </Box>
  )
}

function MarketExplorer(props: {
  assets?: CachedBalance[],
  market: Market | null,
  type: 'pairs' | 'router' | 'pools' | 'delegated-pools',
  setType: (type: string) => any
}) {
  const navigate = useNavigate();
  const mobile = document.body.clientWidth <= 600;
  const [launchablePair, setLaunchablePair] = useState<AggregatedPair | null>(null);
  const [pairs, setPairs] = useState<{ pair: AggregatedPair, whitelisted: boolean, cached: boolean }[]>([]);
  const [searchPair, setSearchPair] = useState<{ primary: AssetId | null, secondary: AssetId | null }>({ primary: null, secondary: null });
  const [loading, setLoading] = useState(false);
  const [pools, setPools] = useState<Pool[]>([]);
  const [delegatedPools, setDelegatedPools] = useState<PseudoDelegatedPool[]>([]);
  const [morePools, setMorePools] = useState(true);
  const pairsFilter = useMemo((): { pair: AggregatedPair, whitelisted: boolean }[] => {
    let result = [...pairs].filter((item) => {
      let primaryMatches = !searchPair.primary, secondaryMatches = !searchPair.secondary;
      if (searchPair.primary) {
        if (!searchPair.primary.token && !searchPair.secondary) {
          primaryMatches = item.pair.primaryAsset.chain == searchPair.primary.chain;
        } else {
          primaryMatches = item.pair.primaryAsset.id == searchPair.primary.id;
        }
      }
      if (searchPair.secondary) {
        if (!searchPair.secondary.token && !searchPair.primary) {
          secondaryMatches = item.pair.secondaryAsset.chain == searchPair.secondary.chain;
        } else {
          secondaryMatches = item.pair.secondaryAsset.id == searchPair.secondary.id;
        }
      }
      return primaryMatches && secondaryMatches;
    });
    if (launchablePair != null) {
      result = [{ pair: launchablePair, whitelisted: !!Whitelist.contractAddressOf(launchablePair.primaryAsset) && !!Whitelist.contractAddressOf(launchablePair.secondaryAsset), cached: false }, ...result];
    }
    return result;
  }, [pairs, searchPair, launchablePair]);
  const updateSearchPair = useCallback((change: (prev: { primary: AssetId | null, secondary: AssetId | null }) => { primary: AssetId | null, secondary: AssetId | null }) => {
    setSearchPair(prev => {
      const result = change(prev);
      AppStorage.set('__market_filter__', {
        primary: result.secondary?.id || null,
        secondary: result.primary?.id || null
      })
      return result;
    });
  }, []);
  const launchPair = useCallback(async () => {
    if (loading)
      return;

    setLoading(true);
    try {
      if (!props.market || !searchPair.primary || !searchPair.secondary)
        throw false;

      const result = await Exchange.marketPair(props.market.id, searchPair.primary, searchPair.secondary, true);
      setLaunchablePair(result);
      setLoading(false);
      return result;
    } catch (exception: any) {
      if (exception instanceof Error)
        AlertBox.open(AlertType.Error, 'Failed to launch a market: ' + exception.message);
      setLaunchablePair(null);
      setLoading(false);
      return null;
    }
  }, [props.market, searchPair, loading]); 
  const findPools = useCallback(async (refresh?: boolean) => {
    setLoading(true);
    if (props.type == 'pools') {
      setDelegatedPools([]);
      try {
        const cursor = Cursor.offset(refresh ? 0 : pools.length);
        const page = Math.floor(cursor.offset / cursor.count);
        const data = await Exchange.marketPools({ page: page });
        if (!Array.isArray(data) || !data.length) {
          if (refresh)
            setPools([]);
          setMorePools(false);
          setLoading(false);
          return false;
        }

        setPools(refresh ? data : prev => prev.concat(data));
        setMorePools(data.length >= cursor.count);
        setLoading(false);
        return data.length > 0;
      } catch (exception) {
        AlertBox.open(AlertType.Error, 'Failed to fetch LPs: ' + (exception as Error).message);
        if (refresh)
          setPools([]);
        setMorePools(false);
        setLoading(false);
        return false;
      }
    } else if (props.type == 'delegated-pools') {
      let data: PseudoDelegatedPool[] = [];
      try {
        data = await Exchange.marketDelegatedPools();
      } catch (exception) {
        AlertBox.open(AlertType.Error, 'Failed to fetch LPs: ' + (exception as Error).message);
      }

      const extra: PseudoDelegatedPool[] = [];
      for (let i = 0; i < Exchange.delegators.length; i++) {
        const delegator = Exchange.delegators[i];
        const market = Exchange.markets.find((v) => v.id.eq(delegator.marketId));
        for (let j = 0; j < delegator.permissions.length; j++) {
          const permission = delegator.permissions[j];
          if (!data.find((v) => v.primaryAsset.id == permission.primaryAsset.id && v.secondaryAsset.id == permission.secondaryAsset.id)) {
            extra.push({
                marketId: delegator.marketId,
                pairId: new BigNumber(0),
                delegatorId: delegator.id,
                marketAccount: market?.account || '',
                delegatorAccount: delegator.account,
                primaryAsset: permission.primaryAsset,
                secondaryAsset: permission.secondaryAsset,
                initialValue: new BigNumber(0),
                currentValue: new BigNumber(0),
                volume: new BigNumber(0)
            });
          }
        }
      }

      setPools([]);
      setDelegatedPools([...data, ...extra]);
      setMorePools(false);
      setLoading(false);
      return false;
    }
  }, [props.type, pools]);
  useEffectAsync(async () => {
    if (props.market && props.type == 'pairs') {
      setLoading(true);
      try {
        setPairs(prev => {
          if (prev.length > 0)
            return prev;

          return (RPC.fetchObject(AppStorage.get('__market_pairs__')) || []).map((x: any) => {
            if (x.pair != null && x.pair.primaryAsset != null && x.pair.secondaryAsset != null) {
              x.pair.primaryAsset = new AssetId(x.pair.primaryAsset.id);
              x.pair.secondaryAsset = new AssetId(x.pair.secondaryAsset.id);
            }
            x.cached = true;
            return x;
          });
        });
        const data = ((await Exchange.marketPairs(props.market.id)) || []).map((x) => ({
          pair: x,
          whitelisted: !!Whitelist.contractAddressOf(x.primaryAsset) && !!Whitelist.contractAddressOf(x.secondaryAsset),
          cached: false
        }));
        AppStorage.set('__market_pairs__', data);
        setPairs(data);
      } catch { }
      setLoading(false);
    } else if (props.type == 'pools' || props.type == 'delegated-pools') {
      await findPools(true);
    }

    if (props.type != 'router') {
      const prev = AppStorage.get('__market_filter__');
      updateSearchPair(() => ({
        primary: prev?.primary ? new AssetId(prev.primary) : null,
        secondary: prev?.secondary ? new AssetId(prev.secondary) : null,
      }));
    }
  }, [props.market, props.type]);
  useEffect(() => {
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
    <Box pt="5">
      <Flex justify="between" align="center" wrap="wrap" direction={mobile ? 'column' : undefined} gap="2" pb={mobile ? '5' : '4'} pt={mobile ? '1' : undefined}>
        <Flex gap="2">
          <Button variant="soft" size="2" disabled={props.type == 'pairs'} onClick={() => props.setType('pairs')}><Icon path={mdiShoppingSearch} size={0.65}></Icon> Trade</Button>
          <Button variant="soft" size="2" disabled={props.type == 'router'} onClick={() => props.setType('router')}><Icon path={mdiMapMarkerPath} size={0.65}></Icon> Swap</Button>
          <Button variant="soft" size="2" disabled={props.type == 'pools' || props.type == 'delegated-pools'} onClick={() => props.setType('delegated-pools')}><Icon path={mdiBriefcaseUpload} size={0.65}></Icon> Earn</Button>
        </Flex>
        {
          props.type != 'pools' && props.type != 'delegated-pools' ?
          <Flex gap="2" pr={mobile ? undefined : '1'}>
            { props.type == 'router' && <Text size="4">Swap</Text> }
            <AssetSelector title="token" value={searchPair.primary} onChange={(value) => updateSearchPair(prev => ({ primary: value, secondary: prev?.secondary || null }))}>
              <Button variant="ghost" size="3">
                {
                  searchPair.primary != null &&
                  <Flex align="center" gap="2">
                    <AssetImage asset={searchPair.primary} size="2" iconSize="20px"></AssetImage>
                    <Text size="4">{ Readability.toAssetSymbol(searchPair.primary) }</Text>
                  </Flex>
                }
                { searchPair.primary == null && <Text size="4">ANY</Text> }
              </Button>
            </AssetSelector>
            <Text size="4">{ props.type == 'router' ? 'to' : '/' }</Text>
            <AssetSelector title="token" value={searchPair.secondary} onChange={(value) => updateSearchPair(prev => ({ primary: prev?.primary || null, secondary: value }))}>
              <Button variant="ghost" size="3">
                {
                  searchPair.secondary != null &&
                  <Flex align="center" gap="2">
                    <AssetImage asset={searchPair.secondary} size="2" iconSize="20px"></AssetImage>
                    <Text size="4">{ Readability.toAssetSymbol(searchPair.secondary) }</Text>
                  </Flex>
                }
                { searchPair.secondary == null && <Text size="4">ANY</Text> }
              </Button>
            </AssetSelector>
          </Flex> :
          <Button variant="soft" size="2" color={props.type == 'pools' ? 'yellow' : 'jade'} onClick={() => props.setType(props.type == 'pools' ? 'delegated-pools' : 'pools')}><Icon path={props.type == 'pools' ? mdiChartTimelineVariant : mdiChartTimelineVariantShimmer} size={0.8}></Icon>{ props.type == 'pools' ? 'Manual LPs' : 'Auto LPs' }</Button>
        }
      </Flex>
      {
        props.type == 'router' && props.assets != null &&
        <MarketRouter market={props.market} assets={props.assets} pair={searchPair} setPair={setSearchPair}></MarketRouter>
      }
      {
        props.type == 'pairs' && pairsFilter.map((item, index) =>
          <Button variant="ghost" color="gray" radius="none" style={{ display: 'block', width: '100%', borderRadius: '24px' }} mb={index < pairsFilter.length - 1 ? '4' : undefined} key={item.pair.id.toString()} onClick={() => navigate(`/orderbook/${Exchange.toOrderbookQuery(props.market?.id || new BigNumber(0), item.pair.primaryAsset, item.pair.secondaryAsset)}`)}>
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
                        <Badge radius="full" size="1" color="purple">{ Exchange.toAPY(item.pair.poolFeeRate || props.market?.maxPoolFeeRate || new BigNumber(0), item.pair.price.poolLiquidity, item.pair.price.poolVolume).toFixed(2) }% APY</Badge>
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
      {
        props.type == 'pairs' && !pairsFilter.length &&
        <Flex pt="2" px="4" justify="center">
          <Box>
            { !loading && <Text size="2" align="center" mb="6" style={{ display: 'block' }}>No pairs to show.</Text> }
            {
              searchPair.primary && searchPair.secondary &&
              <Button variant="ghost" size="2" onClick={() => launchPair()}><Icon path={mdiPlus} size={0.8}></Icon> Add { searchPair.primary.token || searchPair.primary.chain }/{ searchPair.secondary.token || searchPair.secondary.chain } pair?</Button>
            }
          </Box>
        </Flex>
      }
      {
        (props.type == 'pools' || props.type == 'delegated-pools') &&
        <Box>
          {
            props.type == 'pools' ?
            <InfiniteScroll dataLength={pools.length} hasMore={morePools} next={findPools} loader={<div></div>}>
              {
                pools.map((item) =>
                  <Box key={item.poolId.toString()} mb="4">
                    <PoolView item={item} readOnly={true}></PoolView>
                  </Box>)
              }
            </InfiniteScroll> : delegatedPools.map((item) =>
            <Box key={item.delegatorId.toString() + item.marketId.toString() + item.primaryAsset.id + item.secondaryAsset.id} mb="4">
              <PseudoDelegatedPoolView item={item} assets={props.assets || []}></PseudoDelegatedPoolView>
            </Box>)
          }
          {
            !loading && !pools.length && !delegatedPools.length &&
            <Flex px="4" pt="2" justify="center">
              <Text size="2" align="center">No { props.type == 'pools' ? '' : 'D' }LPs to show.</Text>
            </Flex>
          }
        </Box>
      }
      {
        loading &&
        <Flex px="4" pt="4" justify="center">
          <Spinner></Spinner>
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
  const [market, setMarket] = useState<Market | null>(null);
  const [search, setSearch] = useSearchParams();
  const [assetResync, setAssetResync] = useState(0);
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<CachedBalance[]>([]);
  const [viewer, setViewer] = useState<'market-pairs' | 'market-router' | 'market-pools' | 'market-delegated-pools' | 'wallet-closed-assets' | 'wallet-open-assets' | 'wallet-open-orders' | 'wallet-closed-orders' | 'wallet-open-pools' | 'wallet-closed-pools' | 'wallet-open-delegated-pools' | 'wallet-closed-delegated-pools'>('market-pairs');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [todayProfits, setTodayProfits] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [delegatedPools, setDelegatedPools] = useState<DelegatedPool[]>([]);
  const [moreOrders, setMoreOrders] = useState(true);
  const [morePools, setMorePools] = useState(true);
  const findOrders = useCallback(async (refresh?: boolean) => {
    if (!baseAddress) {
      setOrders([]);
      setMoreOrders(false);
      return false;
    } else if (loading) {
      return true;
    }
    
    setLoading(true);
    try {
      const cursor = Cursor.offset(refresh ? 0 : orders.length);
      const data = await Exchange.accountOrders({ address: baseAddress, page: Math.floor(cursor.offset / cursor.count), active: viewer == 'wallet-open-orders' });
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
    } finally {
      setLoading(false);
    }
  }, [params.account, pools, viewer]);
  const findPools = useCallback(async (refresh?: boolean) => {
    if (!baseAddress) {
      setPools([]);
      setDelegatedPools([]);
      setMorePools(false);
      return false;
    } else if (loading) {
      return true;
    }

    if (viewer == 'wallet-open-pools' || viewer == 'wallet-closed-pools') {
      setLoading(true);
      setDelegatedPools([]);
      try {
        const cursor = Cursor.offset(refresh ? 0 : pools.length);
        const page = Math.floor(cursor.offset / cursor.count);
        const data = await Exchange.accountPools({ address: baseAddress || '', page: page, active: viewer == 'wallet-open-pools' });
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
      } finally {
        setLoading(false);
      }
    } else if (viewer == 'wallet-open-delegated-pools' || viewer == 'wallet-closed-delegated-pools') {
      setLoading(true);
      setPools([]);
      try {
        const cursor = Cursor.offset(refresh ? 0 : pools.length);
        const page = Math.floor(cursor.offset / cursor.count);
        const data = await Exchange.accountDelegatedPools({ address: baseAddress || '', page: page, active: viewer == 'wallet-open-delegated-pools' });
        if (!Array.isArray(data) || !data.length) {
          if (refresh)
            setDelegatedPools([]);
          setMorePools(false);
          return false;
        }

        setDelegatedPools(refresh ? data : prev => prev.concat(data));
        setMorePools(data.length >= cursor.count);
        return data.length > 0;
      } catch (exception) {
        AlertBox.open(AlertType.Error, 'Failed to fetch LPs: ' + (exception as Error).message);
        if (refresh)
          setDelegatedPools([]);
        setMorePools(false);
        return false;
      } finally {
        setLoading(false);
      }
    }
  }, [params.account, pools, viewer, loading]);
  useEffectAsync(async () => {
    if (!readOnly) {
      if (viewer.startsWith('market')) {
        AppStorage.set('__portfolio_market__', viewer);
      } else if (viewer.startsWith('wallet')) {
        AppStorage.set('__portfolio_wallet__', viewer);
      }
    }

    if (viewer == 'wallet-open-orders' || viewer == 'wallet-closed-orders') {
      await findOrders(true);
    } else if (viewer == 'wallet-open-pools' || viewer == 'wallet-closed-pools' || viewer == 'wallet-open-delegated-pools' || viewer == 'wallet-closed-delegated-pools') {
      if (viewer.includes('delegated') && !AppData.tip)
        await AppData.sync();

      await findPools(true);
    } else if (viewer == 'wallet-closed-assets' || viewer == 'wallet-open-assets' || viewer == 'market-router' || viewer == 'market-delegated-pools') {
      setAssetResync(new Date().getTime());
    }
  }, [viewer, params.account, readOnly]);
  useEffectAsync(async () => {
    await Exchange.connectSocket();
    if (Exchange.markets.length > 0) {
      setMarket(Exchange.markets[0]);
    }
  }, []);
  useEffect(() => {
    const view = search.get('view') || AppStorage.get('__portfolio_view__') || null;
    if (view != null && ['market-pairs', 'market-router', 'market-pools', 'market-delegated-pools', 'wallet-closed-assets', 'wallet-open-assets', 'wallet-open-orders', 'wallet-closed-orders', 'wallet-open-pools', 'wallet-closed-pools', 'wallet-open-delegated-pools', 'wallet-closed-delegated-pools'].includes(view)) {
      if (!readOnly) {
        AppStorage.set('__portfolio_view__', view);
      }
      setViewer(view as any);
    } else if (!readOnly) {
      AppStorage.set('__portfolio_view__');
    }
  }, [search, readOnly]);
  useEffect(() => {
    switch (viewer) {
      case 'wallet-open-orders': {
        const update = () => findOrders(true);
        window.addEventListener('update:orders', update);
        return () => { window.removeEventListener('update:orders', update); };
      }
      case 'wallet-open-pools': {
        const update = () => findPools(true);
        window.addEventListener('update:pool', update);
        return () => { window.removeEventListener('update:pool', update); };
      }
      case 'wallet-open-delegated-pools': {
        const update = () => findPools(true);
        window.addEventListener('update:delegated-pool', update);
        return () => { window.removeEventListener('update:delegated-pool', update); };
      }
    }
  }, [baseAddress, viewer]);

  return (
    <Box pt="2" minWidth="285px" maxWidth="680px" mx="auto">
      <Box px={mobile ? '2' : undefined}>
        <Dialog.Root onOpenChange={(opened) => {
          setSearching(opened)
          setQuery('');
        }} open={searching}>
          <Dialog.Trigger>
            <Button variant="ghost" color="gray" style={{ width: '100%', height: 'auto', minHeight: 'initial', lineHeight: 'initial', textAlign: 'initial', borderRadius: '12px', margin: 0, padding: 0, display: 'block' }}>
              <Flex gap="2" align="center" justify="between" px="2" py="2">
                <Flex align="center" gap="2">
                  <AddressAvatar address={baseAddress || ''} size="3"></AddressAvatar>
                  <Flex direction="column">
                    { !readOnly && AppData.isWalletReady() ? <Text color="red" size="2">Full control</Text> : <Text color="gray" size="2">Watch only</Text> }
                    <Text style={{ color: 'var(--gray-12)' }} weight="bold" size="2">{ Readability.toAddress(baseAddress || undefined, 6) }</Text>
                  </Flex>
                </Flex>
                <Icon path={mdiMagnifyScan} style={{ color: 'var(--gray-11)' }} size={1}></Icon>
              </Flex>
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
              <Flex justify="center" gap="4" mt="4">
                <Button variant="ghost" size="3" type="submit" loading={loading} disabled={!query.trim().length || !Signing.verifyAddress(query.trim()) } onClick={(e) => {
                  e.preventDefault();
                  navigate(`/portfolio/${query.trim()}?view=wallet-open-assets`);
                  setAssetResync(new Date().getTime());
                  setSearching(false);
                }}>Search</Button>
              </Flex>
            </form>
          </Dialog.Content>
        </Dialog.Root>
      </Box>
      {
        mobile &&
        <Box>
          <Separator my="4" size="4"></Separator>
        </Box>
      }
      <WalletNavigator address={baseAddress} available={viewer == 'wallet-closed-assets'} assetResync={assetResync} readOnly={readOnly} todayProfits={todayProfits} market={market} viewer={viewer.substring(0, viewer.indexOf('-')) as any} onMarketChange={setMarket} onTodayProfitsChange={setTodayProfits} onAssetsChange={viewer == 'market-router' || viewer == 'market-delegated-pools' || viewer == 'wallet-closed-assets' || viewer == 'wallet-open-assets' ? setAssets : undefined} onViewerToggle={() => {
        if (viewer.startsWith('market')) {
          const type = AppStorage.get('__portfolio_wallet__') || 'wallet-open-assets';
          setSearch({ view: ['wallet-closed-assets', 'wallet-open-assets', 'wallet-open-orders', 'wallet-closed-orders', 'wallet-open-pools', 'wallet-closed-pools', 'wallet-open-delegated-pools', 'wallet-closed-delegated-pools'].includes(type) ? type : 'wallet-open-assets' });
        } else if (viewer.startsWith('wallet')) {
          const type = AppStorage.get('__portfolio_market__') || 'market-pairs';
          setSearch({ view: ['market-pairs', 'market-router', 'market-pools', 'market-delegated-pools'].includes(type) ? type : 'market-pairs' });
        }
      }}></WalletNavigator>
      {
        mobile &&
        <Box>
          <Separator mt="3" size="4"></Separator>
        </Box>
      }
      <Box px={mobile ? '3' : undefined}>
        {
          viewer.startsWith('market-') &&
          <MarketExplorer market={market} assets={viewer == 'market-router' || viewer == 'market-delegated-pools' ? assets : undefined} type={viewer.replace('market-', '') as any} setType={(type) => setSearch({ view: 'market-' + type })}></MarketExplorer>
        }
        {
          viewer.startsWith('wallet-') &&
          <Box pt="5">
            <Flex justify={mobile ? 'start' : 'start'} align="center" wrap="wrap" pb="4" gap="2">
              {
                (viewer.includes('open') || viewer.includes('closed')) &&
                <Text as="label" size="3" mr="1">
                  <Flex gap="2" align="center">
                    <Switch size="3" checked={viewer.includes('open')} onCheckedChange={() => setSearch({ view: viewer.includes('open') ? viewer.replace('open', 'closed') : viewer.replace('closed', 'open') })} />
                  </Flex>
                </Text>
              }
              <Button variant="soft" size="2" disabled={viewer == 'wallet-open-assets' || viewer == 'wallet-closed-assets'} onClick={() => setSearch({ view: viewer.includes('closed') ? 'wallet-closed-assets' : 'wallet-open-assets' })}><Icon path={mdiPaletteSwatchVariant} size={0.65}></Icon> Assets</Button>
              <Button variant="soft" size="2" disabled={viewer == 'wallet-open-orders' || viewer == 'wallet-closed-orders'} onClick={() => setSearch({ view: viewer.includes('closed') ? 'wallet-closed-orders' : 'wallet-open-orders' })}><Icon path={mdiListBox} size={0.65}></Icon> Orders</Button>
              <Button variant="soft" size="2" disabled={viewer == 'wallet-open-delegated-pools' || viewer == 'wallet-closed-delegated-pools'} onClick={() => setSearch({ view: viewer.includes('closed') ? 'wallet-closed-delegated-pools' : 'wallet-open-delegated-pools' })}><Icon path={mdiChartTimelineVariantShimmer} size={0.65}></Icon> DLPs</Button>
              <Button variant="soft" size="2" disabled={viewer == 'wallet-open-pools' || viewer == 'wallet-closed-pools'} onClick={() => setSearch({ view: viewer.includes('closed') ? 'wallet-closed-pools' : 'wallet-open-pools' })}><Icon path={mdiChartTimelineVariant} size={0.65}></Icon> LPs</Button>
            </Flex>
            {
              (viewer == 'wallet-closed-assets' || viewer == 'wallet-open-assets') &&
              <WalletAssets assets={assets} todayProfits={todayProfits} readOnly={readOnly} available={viewer == 'wallet-closed-assets'}></WalletAssets>
            }
            {
              (viewer == 'wallet-open-orders' || viewer == 'wallet-closed-orders') &&
              <>
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
                  <Flex px="4" pt="2" justify="center">
                    <Text size="2" align="center">No { viewer.includes('open') ? 'active ' : '' }orders to show.</Text>
                  </Flex>
                }
              </>
            }
            {
              (viewer == 'wallet-open-pools' || viewer == 'wallet-closed-pools' || viewer == 'wallet-open-delegated-pools' || viewer == 'wallet-closed-delegated-pools') &&
              <>
                <InfiniteScroll dataLength={pools.length} hasMore={morePools} next={findPools} loader={<div></div>}>
                  {
                    (viewer == 'wallet-open-pools' || viewer == 'wallet-closed-pools') ? pools.map((item) =>
                      <Box key={item.poolId.toString()} mb="4">
                        <PoolView item={item} readOnly={readOnly}></PoolView>
                      </Box>) : delegatedPools.map((item) =>
                      <Box key={item.id.toString()} mb="4">
                        <DelegatedPoolView item={item} readOnly={readOnly}></DelegatedPoolView>
                      </Box>)
                  }
                </InfiniteScroll>
                {
                  !pools.length && !delegatedPools.length &&
                  <Flex px="4" pt="2" justify="center">
                    <Text size="2" align="center">No { viewer.includes('open') ? 'active ' : '' }{ (viewer == 'wallet-open-pools' || viewer == 'wallet-closed-pools') ? '' : 'D' }LPs to show.</Text>
                  </Flex>
                }
              </>
            }
          </Box>
        }
      </Box>
    </Box>
  );
}