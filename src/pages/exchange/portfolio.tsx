import { Box, Button, Dialog, Flex, SegmentedControl, Select, Spinner, Text, TextField, Tooltip } from "@radix-ui/themes";
import { mdiArrowLeft, mdiArrowRight, mdiBankOutline, mdiChartTimelineVariant, mdiChevronDown, mdiContentCopy, mdiEyeOutline, mdiListBoxOutline, mdiLockOutline, mdiPlus, mdiRefresh, mdiSwapVertical, mdiWalletOutline } from "@mdi/js";
import { AssetId, ByteUtil, Signing } from "tangentsdk/algorithm";
import { UiUtil } from 'tangentsdk/ui';
import { Whitelist } from 'tangentsdk/whitelist';
import { Assetlist } from 'tangentsdk/assetlist';
import { TextUtil } from 'tangentsdk/text';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Exchange, Balance, Order, Pool, Cursor, AggregatedPair, OrderSide, RouterPath, Market, PolyAsset, PseudoDelegatedPool, DelegatedPool, ExchangeField } from "../../core/exchange";
import { useEffectAsync } from "../../core/react";
import { AppData } from "../../core/app";
import { mdiMagnify } from "@mdi/js";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AppStorage } from "../../core/storage";
import { AlertBox, AlertType } from "../../components/alert";
import { AssetImage } from "../../components/asset-image";
import { AssetName } from "../../components/asset-name";
import { Builder, PerformerButton } from "./../../components/exchange/performer";
import { DelegatedPoolView, PoolView, PseudoDelegatedPoolView } from "../../components/exchange/pool";
import BigNumber from "bignumber.js";
import OrderView from "../../components/exchange/order";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import AssetSelector from "../../components/exchange/selector";
import AddressAvatar from "../../components/avatar";
import { toFancyMoney, toChainAssetSymbol, toFancyMoneyChain } from "../../core/utils";

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
  return (): (Balance & { type: 'std' | 'wrapped' | 'unwrapped', value: BigNumber, equity: { current: BigNumber | null, previous: BigNumber | null } })[] => {
    const list = assets.map((v: Balance) => {
      const price = Exchange.priceOf(v.asset);
      const value = available ? v.available : v.available.plus(v.unavailable);
      const previousEquity = todayProfits ? (price.open ? new BigNumber(price.open.multipliedBy(value).toFixed(2)) : null) : (v.price ? new BigNumber(v.price.multipliedBy(value).toFixed(2)) : null);
      const currentEquity = price.close ? new BigNumber(price.close.multipliedBy(value).toFixed(2)) : null;
      return {
        asset: v.asset as AssetId,
        poly: v.poly,
        type: (v.poly ? (v.asset.token != null && v.asset.chain == new AssetId().chain ? 'wrapped' : 'unwrapped') : 'std') as 'std' | 'wrapped' | 'unwrapped',
        unavailable: v.unavailable as BigNumber,
        available: v.available as BigNumber,
        price: v.price as BigNumber,
        value: value,
        equity: { previous: previousEquity, current: currentEquity }
      };
    }).sort((a, b) => (b.equity.current || new BigNumber(0)).minus(a.equity.current || 0).toNumber());
    return (available ? list.filter(x => x.value.gt(0)) : list).sort((a, b) => Number(b.poly) - Number(a.poly));
  };
};
let approxEq = (a: BigNumber, b: BigNumber) => a.lte(b.multipliedBy(1.005)) && a.gte(b.multipliedBy(0.995));
let toMarketExplorerType = (viewer: string): 'pairs' | 'router' | 'pools' | 'delegated-pools' => {
  if (viewer == 'market-router')
    return 'router';
  if (viewer == 'market-pools')
    return 'pools';
  if (viewer == 'market-delegated-pools')
    return 'delegated-pools';
  return 'pairs';
};

function RepayableBalanceView(props: { item: Balance & { type: 'std' | 'wrapped' | 'unwrapped', equity: { current: BigNumber | null, previous: BigNumber | null } }, available?: boolean }) {
  const item = props.item;
  const wrapping = item.type == 'unwrapped';
  const baseEquity = item.equity.current || item.equity.previous || new BigNumber(0);
  const previousEquity = item.equity.previous ? item.equity.previous : baseEquity;
  const currentEquity = item.equity.current ? item.equity.current : baseEquity;
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<PolyAsset[] | null>(null);
  const [asset, setAsset] = useState<PolyAsset | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [open, setOpen] = useState(false);
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
        setAssets(assets.filter((v) => wrapping ? v.chain == chain : v.chain != chain));
      } catch {
        setAssets([]);
      }
      setLoading(false);
    }
  }, [assets, loading]);
  const holding = props.available ? item.available : item.available.plus(item.unavailable);
  const max = BigNumber.min(item.available, asset?.liquidity || item.available);
  return (
    <>
      <div className="asset-row balance-row">
        <AssetImage asset={item.asset} size="3" iconSize="42px"></AssetImage>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="name-usd">
            <AssetName asset={item.asset} size="3" style={{ lineHeight: '24px' }}></AssetName>
            <div className={ 'usd' + (item.equity.current == null ? ' na' : '') } style={{ lineHeight: '24px', flex: 'none' }}>{ toFancyMoney(Exchange.equityAsset, item.equity.current) }</div>
          </div>
          <div className="amt-line mono tiny dim" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 28 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', columnGap: 2, rowGap: 0, lineHeight: '20px', flexWrap: 'wrap' }}>
              { item.unavailable.gt(0) && <Tooltip content={ 'Currently locked: ' + toFancyMoney(item.asset, item.unavailable) }><span className="lock"><Icon path={mdiLockOutline} size={0.55}></Icon></span></Tooltip> }
              <span>{ toFancyMoney(null, props.available ? item.available : item.available.plus(item.unavailable)) }</span>
              <span style={{ color: previousEquity.gt(currentEquity) ? 'var(--down)' : (previousEquity.eq(currentEquity) ? 'var(--text-3)' : 'var(--lime)') }}>{ UiUtil.toPercentageDelta(previousEquity, currentEquity) }</span>
            </div>
            <Tooltip content={ wrapping ? 'Wrap 1:1 into the unified ' + (item.asset.token || '') + ' asset to trade on the market' : 'Convert 1:1 into the native ' + (item.asset.token || '') }>
              <button className="settled-toggle" aria-label={ wrapping ? 'Wrap asset' : 'Unwrap asset' } onClick={() => setOpen(true)}>
                { wrapping ? 'Wrap' : 'Unwrap' }
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
      <Dialog.Root open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setAmount(''); } }}>
        <Dialog.Content className="sheet-content" maxWidth="560px">
          <Dialog.Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AssetImage asset={item.asset} size="3" iconSize="42px"></AssetImage>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 750, fontSize: 16 }}>{ Assetlist.toName(item.asset, false, true) }</div>
                <div className="tiny dim">{ wrapping ? 'Native asset — wrap it 1:1 into the unified token to trade on the market.' : 'Synthetic asset — redeem it 1:1 for the native token.' }</div>
              </div>
            </div>
          </Dialog.Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            <Select.Root value={asset?.id} onValueChange={(value) => setAsset(assets?.find(x => x.id == value) || null)}>
              <Select.Trigger variant="surface" placeholder={ wrapping ? 'Wrap into' : 'Receive on' } className="token-select dot" style={{ width: '100%', justifyContent: 'space-between' }}>
              </Select.Trigger>
              <Select.Content variant="soft">
                <Select.Group>
                  {
                    assets && assets.map((option) =>
                      <Select.Item key={option.id + '_select'} value={option.id}>
                        <Flex align="center" gap="1">
                          <AssetImage asset={AssetId.fromHandle(option.chain || '')} size="1" iconSize="16px"></AssetImage>
                          <AssetName asset={option} symbol={true} badgeOffset={3} size="3"></AssetName>
                        </Flex>
                      </Select.Item>
                    )
                  }
                </Select.Group>
              </Select.Content>
            </Select.Root>
            <TextField.Root placeholder={ `≤ ${toFancyMoney(item.asset, max)} or %` } size="3" value={amount} onChange={(e) => setAmount(TextUtil.toValue(amount, e.target.value))}></TextField.Root>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="tiny dim mono">Holding { toFancyMoney(item.asset, holding) }{ asset ? ' · limit ' + toFancyMoney(item.asset, max) : '' }</span>
              <span className="lime-link" onClick={() => setAmount(max.gt(0) ? max.toFixed() : '')}>Max</span>
            </div>
          </div>
          <PerformerButton className="btn-brand" style={{ width: '100%', marginTop: 16 }} title={ wrapping ? (asset ? 'Wrap into ' + Assetlist.toName(asset) : 'Wrap into unified asset') : 'Receive on ' + Assetlist.toName(AssetId.fromHandle(asset?.chain || '')) } description={ wrapping ? 'Selected token will be locked 1:1 into the unified asset of the chosen market' : "Smart contract will re-pay you back the 1:1 value of selected token after this action" } disabled={!assetPayload} onBuild={async () => {
            if (!assetPayload)
              return null;
            return wrapping ? Builder.payUnifiedAsset({
              pays: { [assetPayload.paymentAssetHash]: assetPayload.pays },
              marketId: assetPayload.marketId,
              primaryAssetHash: AssetId.fromHandle(item.asset.chain || '').id,
              secondaryAssetHash: assetPayload.repaymentAssetHash
            }) : Builder.repayAsset(assetPayload);
          }}></PerformerButton>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

function StandardBalanceView(props: { item: Balance & { equity: { current: BigNumber | null, previous: BigNumber | null } }, available?: boolean }) {
  const item = props.item;
  const baseEquity = item.equity.current || item.equity.previous || new BigNumber(0);
  const previousEquity = item.equity.previous ? item.equity.previous : baseEquity;
  const currentEquity = item.equity.current ? item.equity.current : baseEquity;
  return (
    <div className="asset-row balance-row">
      <AssetImage asset={item.asset} size="3" iconSize="42px"></AssetImage>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="name-usd">
          <AssetName asset={item.asset} size="3" style={{ lineHeight: '24px' }}></AssetName>
          <div className={ 'usd' + (item.equity.current == null ? ' na' : '') } style={{ lineHeight: '24px', flex: 'none' }}>{ toFancyMoney(Exchange.equityAsset, item.equity.current) }</div>
        </div>
        <div className="amt-line mono tiny dim" style={{ display: 'flex', alignItems: 'center', columnGap: 2, rowGap: 0, minHeight: 28, lineHeight: '20px', flexWrap: 'wrap' }}>
          { item.unavailable.gt(0) && <Tooltip content={ 'Currently locked: ' + toFancyMoney(item.asset, item.unavailable) }><span className="lock"><Icon path={mdiLockOutline} size={0.55}></Icon></span></Tooltip> }
          <span>{ toFancyMoney(null, props.available ? item.available : item.available.plus(item.unavailable)) }</span>
          <span style={{ color: previousEquity.gt(currentEquity) ? 'var(--down)' : (previousEquity.eq(currentEquity) ? 'var(--text-3)' : 'var(--lime)') }}>{ UiUtil.toPercentageDelta(previousEquity, currentEquity) }</span>
        </div>
      </div>
    </div>
  )
}

function WalletNavigator(props: {
  address: string | null,
  readOnly: boolean,
  todayProfits: boolean,
  available: boolean,
  onTodayProfitsChange: (value: boolean) => any,
  onAssetsChange?: (value: CachedBalance[] | ((prev: CachedBalance[]) => CachedBalance[])) => any
  onSync?: () => any
}) {
  const [assets, setAssets] = useState<CachedBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sync, setSync] = useState(0);
  const lastAddress = useRef<string | null>(null);
  const spinStart = useRef<number>(0);
  const spinTimeout = useRef<number | undefined>(undefined);
  const beginSpin = () => {
    clearTimeout(spinTimeout.current);
    spinStart.current = Date.now();
    setLoading(true);
  };
  const endSpin = () => {
    const period = 900; // must match .hero-refresh-mark.spin animation duration
    const elapsed = Date.now() - spinStart.current;
    const delay = Math.ceil(elapsed / period) * period - elapsed;
    clearTimeout(spinTimeout.current);
    spinTimeout.current = window.setTimeout(() => {
      spinTimeout.current = undefined;
      setLoading(false);
    }, delay);
  };
  useEffect(() => () => {
    clearTimeout(spinTimeout.current);
  }, []);
  const equityAssets = useMemo(toEquityAssets(assets, props.todayProfits, props.available), [assets, props.todayProfits, props.available, sync]);
  const equity = useMemo((): { previous: BigNumber, current: BigNumber } => {
    return {
      previous: equityAssets.reduce((a, b) => a.plus(b.equity.previous || b.equity.current || new BigNumber(0)), new BigNumber(0)),
      current: equityAssets.reduce((a, b) => a.plus(b.equity.current || b.equity.previous || new BigNumber(0)), new BigNumber(0))
    }
  }, [equityAssets]);
  useEffectAsync(async () => {
    const address = props.address;
    if (sync > 0 && lastAddress.current == address) {
      if (props.onAssetsChange)
        props.onAssetsChange([...assets]);
      return;
    }

    const addressChanged = lastAddress.current != address;
    lastAddress.current = address;
    if (address) {
      beginSpin();
      if (addressChanged) {
        setAssets([]);
        if (props.onAssetsChange)
          props.onAssetsChange([]);
      }
      try {
        const process = (data: Balance[]) => (data || []).map((x) => ({ ...x, cached: false }));
        const result = await Exchange.accountBalances({ address, resync: sync == -1 }, (cache) => {
          if (lastAddress.current != address)
            return;
          setAssets(prev => prev.length > 0 ? prev : process(cache));
          if (props.onAssetsChange)
            props.onAssetsChange(prev => prev.length > 0 ? prev : process(cache));
        });
        if (result != null && lastAddress.current == address) {
          setAssets(process(result));
          if (props.onAssetsChange)
            props.onAssetsChange(process(result));
        }
      } catch { }
      if (lastAddress.current == address)
        endSpin();
    } else {
      setAssets([]);
      if (props.onAssetsChange)
        props.onAssetsChange([]);
    }
    setSync(new Date().getTime());
  }, [props.address, sync]);
  useEffect(() => {
    const updateBalances = () => {
      clearTimeout(portfolioSyncTimeoutId ?? undefined);
      portfolioSyncTimeoutId = window.setTimeout(() => {
        portfolioSyncTimeoutId = null;
        setSync(-1);
      }, 500);
    };
    window.addEventListener('update:order', updateBalances);
    window.addEventListener('update:pool', updateBalances);
    window.addEventListener('update:delegated-pool', updateBalances);
    return () => {
      window.removeEventListener('update:order', updateBalances);
      window.removeEventListener('update:pool', updateBalances);
      window.removeEventListener('update:delegated-pool', updateBalances);
    };
  }, [props.address]);
  useEffect(() => {
    const refetchEquity = () => setSync(new Date().getTime());
    window.addEventListener('exchange:ready', refetchEquity);
    return () => window.removeEventListener('exchange:ready', refetchEquity);
  }, []);
  
  return (
    <Box>
      <Tooltip content="Refresh">
        <button className="hero-num hero-refresh" aria-label="Refresh" disabled={loading} onClick={() => {
          setSync(-1);
          if (props.onSync)
            props.onSync();
        }}>
          {
            loading && !assets.length ?
            <span className="skel" style={{ display: 'inline-block', width: 220, height: 42, verticalAlign: 'middle' }}></span> :
            toFancyMoney(Exchange.equityAsset, equity.current)
          }
          <span className={'hero-refresh-mark' + (loading ? ' spin' : '')}><Icon path={mdiRefresh} size="1em"></Icon></span>
        </button>
      </Tooltip>
      <div className="hero-sub-row">
        <button className="page-sub hero-sub-btn" onClick={() => props.onTodayProfitsChange(!props.todayProfits)}>{ toFancyMoney(Exchange.equityAsset, equity.current.minus(equity.previous), true) } ({ UiUtil.toPercentageDelta(equity.previous, equity.current) }) { props.todayProfits ? 'today' : 'total' } · in { Exchange.equityAsset.chain || '?' }</button>
      </div>
    </Box>
  )
}

function WalletAssets(props: {
  assets: CachedBalance[],
  todayProfits: boolean,
  available: boolean,
  readOnly: boolean,
  onAvailableChange: (value: boolean) => any
}) {
  const equityAssets = useMemo(toEquityAssets(props.assets, props.todayProfits, props.available), [props.assets, props.todayProfits, props.available]);
  return (
    <Box>
      <div className="card-head" style={{ margin: `4px 2px 10px` }}>
        <div className="card-title">{ props.available ? 'Available' : 'All' } assets</div>
        <Tooltip content={ props.available ? 'Show all holdings, including balance locked by orders and positions' : 'Show only balance available to spend' }>
          <button className="settled-toggle" onClick={() => props.onAvailableChange(!props.available)}>{ props.available ? 'Total' : 'Available' }</button>
        </Tooltip>
      </div>
      {
        equityAssets.map((item) =>
          <div className="asset-card" key={item.asset.id}>
            { item.type == 'std' ? <StandardBalanceView item={item} available={props.available}></StandardBalanceView> : <RepayableBalanceView item={item} available={props.available}></RepayableBalanceView> }
          </div>
        )
      }
      {
        props.assets.length > 0 && !equityAssets.length &&
        <div className="card">
          <div className="empty">
            <div className="art"><Icon path={mdiBankOutline} size={1.4}></Icon></div>
            <h4>{ props.available ? 'No available assets' : 'No non-zero assets' }</h4>
            <p>{ props.available ? 'Assets available for spending will show up here.' : 'Any non-zero assets will show up here.' }</p>
          </div>
        </div>
      }
    </Box>
  )
}

function MarketRouter(props: {
  assets: CachedBalance[],
  market: Market | null
  pair: { primary: AssetId | null, secondary: AssetId | null }
  setPair: (p: { primary: AssetId | null, secondary: AssetId | null }) => any
  onPair?: (pair: { primary: AssetId | null, secondary: AssetId | null }) => void
  refreshKey?: number
}) {
  const assets = props.assets;
  const superMobile = document.body.clientWidth <= 400;
  const [polyAssets, setPolyAssets] = useState<PolyAsset[]>([]);
  const [secondaryPoly, setSecondaryPoly] = useState<PolyAsset[] | null>(null);
  const [state, setState] = useState<SwapState>({ amountIn: '', amountOut: '', slippage: '0.50%' });
  const [bestPaths, setBestPaths] = useState<RouterPath[] | null>(null);
  const [convervative, setConservative] = useState(false);
  const [loadingPoly, setLoadingPoly] = useState<boolean>(false);
  const [loadingPath, setLoadingPath] = useState<boolean>(false);
  const wrapAction = useMemo((): { direction: 'wrap' | 'unwrap', marketId: BigNumber, unified: AssetId, native: AssetId, from: AssetId, to: AssetId, liquidity: BigNumber | null } | null => {
    const primary = props.pair.primary, secondary = props.pair.secondary;
    if (!primary || !secondary || primary.id == secondary.id || !primary.token || primary.token != secondary.token)
      return null;
    const unifiedChain = new AssetId().chain;
    const primaryUnified = primary.chain == unifiedChain;
    if (primaryUnified == (secondary.chain == unifiedChain))
      return null;
    const unified = primaryUnified ? primary : secondary;
    const native = primaryUnified ? secondary : primary;
    const match = polyAssets.find((v) => v.id == secondary.id || (v.chain == secondary.chain && v.token == secondary.token));
    if (!match || !match.marketId)
      return null;
    return { direction: primaryUnified ? 'unwrap' : 'wrap', marketId: new BigNumber(match.marketId), unified, native, from: primary, to: secondary, liquidity: match.liquidity ? new BigNumber(match.liquidity) : null };
  }, [props.pair.primary, props.pair.secondary, polyAssets]);
  const swapUnwrap = useMemo((): { marketId: BigNumber, unified: AssetId, native: AssetId, liquidity: BigNumber | null } | null => {
    const secondary = props.pair.secondary;
    if (!secondary || !secondary.token || !secondaryPoly)
      return null;
    const unifiedChain = new AssetId().chain;
    if (secondary.chain == unifiedChain)
      return null;
    const entry = secondaryPoly.find((v) => v.chain == unifiedChain && v.token == secondary.token && v.marketId);
    if (!entry || !entry.marketId)
      return null;
    const variant = secondaryPoly.find((v) => v.id == secondary.id);
    return { marketId: new BigNumber(entry.marketId), unified: new AssetId(entry.id), native: secondary, liquidity: variant?.liquidity ? new BigNumber(variant.liquidity) : null };
  }, [props.pair.secondary, secondaryPoly]);
  useEffectAsync(async () => {
    const secondary = props.pair.secondary;
    if (!secondary || !secondary.token || secondary.chain == new AssetId().chain) {
      setSecondaryPoly(null);
      return;
    }
    try {
      setSecondaryPoly(await Exchange.marketAssets(secondary, true));
    } catch {
      setSecondaryPoly(null);
    }
  }, [props.pair.secondary?.id, props.refreshKey]);
  const assetsIn = useMemo((): Balance[] => assets.filter((v) => wrapAction ? v.asset.id == props.pair.primary?.id : (v.asset.id == props.pair.primary?.id || polyAssets.findIndex((i) => i.id == v.asset.id) != -1)), [props.pair.primary, assets, polyAssets, wrapAction]);
  const payableBalances = useMemo((): Balance[] => assets.filter((v) => v.available.gt(0)), [assets]);
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
  const wrapPayload = useMemo((): string | null => {
    if (!wrapAction || !swapInfo.amountIn.gt(0) || swapInfo.amountIn.gt(swapInfo.balanceIn))
      return null;
    if (wrapAction.liquidity && swapInfo.amountIn.gt(wrapAction.liquidity))
      return null;
    return wrapAction.liquidity ? ByteUtil.bigNumberToString(BigNumber.min(swapInfo.amountIn, wrapAction.liquidity)) : swapInfo.amountIn.toString();
  }, [wrapAction, swapInfo.amountIn, swapInfo.balanceIn]);
  const effectiveMax = wrapAction?.liquidity && wrapAction.liquidity.lt(swapInfo.balanceIn) ? wrapAction.liquidity : swapInfo.balanceIn;
  const updateState = useCallback((change: (prev: SwapState) => SwapState) => {
    setState(prev => {
      const result = change(prev);
      AppStorage.set(ExchangeField.PortfolioRouter, {
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
      setPolyAssets(await Exchange.marketAssets(props.pair.primary, true));
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch poly assets: ' + (exception as Error).message);
      setPolyAssets([]);
    }
    setLoadingPoly(false);
  }, [props.pair.primary, props.refreshKey]);
  useEffect(() => {
    props.onPair?.(props.pair);
  }, [props.pair]);
  useEffect(() => {
    if (swapPathTimeoutId != null) {
      clearTimeout(swapPathTimeoutId);
      setLoadingPath(false);
    }

    if (!wrapAction && props.market != null && props.pair.primary != null && props.pair.secondary != null && props.pair.secondary.id != props.pair.primary.id) {
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
        }, 300) as any;
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
  }, [props.market, props.pair.secondary, props.pair.primary, state.amountIn, state.slippage, assetsIn, props.refreshKey, wrapAction]);
  useEffect(() => {
    const prev = AppStorage.get(ExchangeField.PortfolioRouter);
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
      AppStorage.set(ExchangeField.PortfolioRouter, {
        primary: props.pair.primary?.id || null,
        secondary: props.pair.secondary?.id || null,
        amountIn: prev.amountIn,
        amountOut: prev.amountOut,
        slippage: prev.slippage
      })
      return prev;
    });
  }, [props.pair]);
  
  const slipNumeric = new BigNumber(state.slippage.replace('%', ''));
  return (
    <Box>
      <div className="swap-box">
        <div className="swap-lab"><span>Pay · any token</span><span>Balance { toFancyMoney(props.pair.primary, swapInfo.balanceIn) }</span></div>
        <div className="swap-amt">
          <TextField.Root placeholder="0.0" type="text" value={state.amountIn} onChange={(e) => setAmount('amount-in', e.target.value)} />
          <AssetSelector title="token" value={props.pair.primary} balances={payableBalances} onChange={(value) => props.setPair({ primary: value || null, secondary: props.pair.secondary })}>
            <button className={props.pair.primary ? 'token-select' : 'token-select dot'}>
              { props.pair.primary && <AssetImage asset={props.pair.primary} size="2" iconSize="26px"></AssetImage> }
              { props.pair.primary ? toChainAssetSymbol(props.pair.primary) : 'Select' }
              <span>▾</span>
            </button>
          </AssetSelector>
        </div>
        <div className="pct-row">
          <button className={ 'pct' + (approxEq(swapInfo.amountIn, effectiveMax.multipliedBy(0.25)) ? ' hot' : '') } onClick={() => setAmount('amount-in', ByteUtil.bigNumberToString(effectiveMax.multipliedBy(0.25)))}>25%</button>
          <button className={ 'pct' + (approxEq(swapInfo.amountIn, effectiveMax.multipliedBy(0.50)) ? ' hot' : '') } onClick={() => setAmount('amount-in', ByteUtil.bigNumberToString(effectiveMax.multipliedBy(0.50)))}>50%</button>
          { !superMobile && <button className={ 'pct' + (approxEq(swapInfo.amountIn, effectiveMax.multipliedBy(0.75)) ? ' hot' : '') } onClick={() => setAmount('amount-in', ByteUtil.bigNumberToString(effectiveMax.multipliedBy(0.75)))}>75%</button> }
          <button className={ 'pct' + (approxEq(swapInfo.amountIn, effectiveMax) ? ' hot' : '') } onClick={() => setAmount('amount-in', ByteUtil.bigNumberToString(effectiveMax))}>Max</button>
        </div>
      </div>
      <div className="swap-arrow">
        <button disabled={loadingPath || loadingPoly} onClick={() => {
          updateState(prev => ({
            amountIn: prev.amountOut,
            amountOut: prev.amountIn,
            slippage: prev.slippage
          }));
          props.setPair({
            primary: props.pair.secondary,
            secondary: props.pair.primary
          });
        }} aria-label="flip"><Icon path={mdiSwapVertical} size={0.9}></Icon></button>
      </div>
      <div className="swap-box">
        <div className="swap-lab"><span>Receive · any token</span><span>{ toFancyMoney(Exchange.equityAsset, swapInfo.valuationOut) }</span></div>
        <div className="swap-amt">
          <TextField.Root placeholder="0.0" type="text" value={state.amountOut} onChange={(e) => setAmount('amount-out', e.target.value)} />
          <AssetSelector title="token" value={props.pair.secondary} onChange={(value) => props.setPair({ primary: props.pair.primary, secondary: value || null })}>
            <button className={props.pair.secondary ? 'token-select' : 'token-select dot'}>
              { props.pair.secondary && <AssetImage asset={props.pair.secondary} size="2" iconSize="26px"></AssetImage> }
              { props.pair.secondary ? toChainAssetSymbol(props.pair.secondary) : 'Select' }
              <span>▾</span>
            </button>
          </AssetSelector>
        </div>
        {
          bestPaths && bestPaths.length > 0 &&
          <div className="tiny dim" style={{ marginTop: 10 }}>Routed across { bestPaths[0].length } book{ bestPaths[0].length > 1 ? 's' : '' }</div>
        }
      </div>
      {
        !wrapAction && (
      <div className="field-lite" style={{ marginTop: 14 }}>
        <div className="lab"><span>Max slippage</span><span style={{ color: 'var(--text-3)' }}>max value loss { state.slippage || '0%' }</span></div>
        <div className="val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <TextField.Root className="slip-field" placeholder="0.50" value={state.slippage.replace('%', '')} onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9.]/g, '');
              updateState(prev => ({ ...prev, slippage: digits.length ? digits + '%' : '' }));
            }} />
            <span className="dim" style={{ fontWeight: 700, fontSize: 15 }}>%</span>
          </span>
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <button className={ 'pct' + (slipNumeric.eq(0.25) ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, slippage: '0.25%' }))}>0.25</button>
            <button className={ 'pct' + (slipNumeric.eq(0.5) ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, slippage: '0.50%' }))}>0.50</button>
            <button className={ 'pct' + (slipNumeric.eq(1) ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, slippage: '1.00%' }))}>1.00</button>
          </span>
        </div>
      </div>
      ) }
      {
        bestPaths?.map((path: RouterPath, pathIndex: number) => {
          const last = path[path.length - 1];
          const type = convervative ? 'min' : 'max';
          const amountIn = swapInfo.priceIn?.gt(0) && swapInfo.amountIn.gt(0) ? swapInfo.amountIn.multipliedBy(swapInfo.priceIn) : null;
          const amountOut = swapInfo.priceOut?.gt(0) && last.output[type].gt(0) ? last.output[type].multipliedBy(swapInfo.priceOut) : null;
          const repayStep = ((): BigNumber | null => {
            if (!swapUnwrap || path.length == 0)
              return null;
            const finalLeg = path[path.length - 1];
            const finalOut = finalLeg.side == OrderSide.Buy ? finalLeg.pair.primaryAsset?.hash : finalLeg.pair.secondaryAsset?.hash;
            if (!finalOut || finalOut.id != swapUnwrap.unified.id)
              return null;
            const value = swapUnwrap.liquidity && swapUnwrap.liquidity.lt(finalLeg.output.max) ? swapUnwrap.liquidity : finalLeg.output.max;
            return value.gt(0) ? value : null;
          })();
          return (
            <div key={'swap_path_' + pathIndex} className="card" style={{ marginTop: 14 }}>
              <div className="order-head">
                <span className={ 'tag' + (pathIndex == 0 ? ' day' : ' op') }>{ pathIndex == 0 ? 'Best' : (pathIndex == 1 ? '2nd' : (pathIndex == 2 ? '3rd' : ((pathIndex + 1) + 'th'))) } · { UiUtil.toCount('swap', path.length) }</span>
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button className={ 'pct' + (!convervative ? ' hot' : '') } title="Quote from best fills" onClick={() => setConservative(false)}>Max</button>
                  <button className={ 'pct' + (convervative ? ' hot' : '') } title="Quote from worst fills" onClick={() => setConservative(true)}>Min</button>
                </span>
              </div>
              <Box mt="2">
                {
                  path.map((swap, swapIndex: number) =>
                    <div className="q-row" key={'swap_path_' + pathIndex + '_' + swapIndex}>
                      <span className="k" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <AssetImage asset={swap.side == OrderSide.Buy ? swap.pair.secondaryAsset?.hash : swap.pair.primaryAsset?.hash} iconSize="18px"></AssetImage>
                        <Icon path={mdiArrowRight} size={0.55} style={{ color: 'var(--text-3)' }}></Icon>
                        <AssetImage asset={swap.side == OrderSide.Buy ? swap.pair.primaryAsset?.hash : swap.pair.secondaryAsset?.hash} iconSize="18px"></AssetImage>
                        { swap.side == OrderSide.Buy ? 'Buy' : 'Sell' }
                      </span>
                      <span className="v">{ toFancyMoneyChain(swap.side == OrderSide.Buy ? swap.pair.primaryAsset?.hash || null : swap.pair.secondaryAsset?.hash || null, swap.output[type]) }</span>
                    </div>)
                }
                {
                  repayStep != null && swapUnwrap != null &&
                  <div className="q-row">
                    <span className="k" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <AssetImage asset={swapUnwrap.unified} iconSize="18px"></AssetImage>
                      <Icon path={mdiArrowRight} size={0.55} style={{ color: 'var(--text-3)' }}></Icon>
                      <AssetImage asset={swapUnwrap.native} iconSize="18px"></AssetImage>
                      Unwrap
                    </span>
                    <span className="v">{ toFancyMoneyChain(swapUnwrap.native, repayStep) }</span>
                  </div>
                }
                <div className="q-row">
                  <span className="k">{ (amountOut || new BigNumber(0)).gte(amountIn || new BigNumber(0)) ? (convervative ? 'Min gain' : 'Gain') : (convervative ? 'Max loss' : 'Loss') }</span>
                  <span className="v" style={{ color: (amountOut || new BigNumber(0)).gte(amountIn || new BigNumber(0)) ? 'var(--lime)' : 'var(--down)' }}>{ amountIn && amountOut ? amountOut.minus(amountIn).dividedBy(amountIn).multipliedBy(100).toFixed(2) : '0.00' }%</span>
                </div>
              </Box>
              <PerformerButton className={ pathIndex == 0 ? 'btn-brand btn-cta' : undefined } title={ pathIndex == 0 ? 'Review swap' : 'Execute'} description={`Swap involves paying ${UiUtil.toAssetSymbol(props.pair.primary || new AssetId())} to smart contract and placing one or more market orders in a row to receive ${toChainAssetSymbol(props.pair.secondary || new AssetId())} as a result`} variant={ pathIndex == 0 ? undefined : 'soft'} color={pathIndex == 0 ? undefined : 'gray'} style={{ width: '100%', marginTop: 2 }} onBuild={async () => {
                const pays: Record<string, string> = Exchange.toPayment(new BigNumber(swapInfo.amountIn), assetsIn);
                const results = await Builder.swap({
                  ...state,
                  tokenIn: props.pair.primary,
                  tokenOut: props.pair.secondary,
                  marketId: props.market?.id.toString() || '',
                  path: path,
                  pays: pays,
                });
                if (repayStep != null && swapUnwrap != null)
                  results.push(await Builder.repayAsset({ marketId: swapUnwrap.marketId.toString(), repaymentAssetHash: swapUnwrap.native.id, paymentAssetHash: swapUnwrap.unified.id, pays: repayStep.toString() }, true));
                return results;
              }}></PerformerButton>
            </div>
          )
        })
      }
      {
        wrapAction &&
        <div className="card" style={{ marginTop: 14 }}>
          <div className="order-head">
            <span className="tag day">Best · 1 swap</span>
          </div>
          <Box mt="2">
            <div className="q-row">
              <span className="k" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <AssetImage asset={wrapAction.from} iconSize="18px"></AssetImage>
                <Icon path={mdiArrowRight} size={0.55} style={{ color: 'var(--text-3)' }}></Icon>
                <AssetImage asset={wrapAction.to} iconSize="18px"></AssetImage>
                { wrapAction.direction == 'unwrap' ? 'Unwrap' : 'Wrap' }
              </span>
              <span className="v">{ wrapPayload ? toFancyMoneyChain(wrapAction.to, new BigNumber(wrapPayload)) : '—' }</span>
            </div>
            <div className="q-row">
              <span className="k">Gain</span>
              <span className="v" style={{ color: 'var(--lime)' }}>0.00%</span>
            </div>
          </Box>
          <PerformerButton className="btn-brand btn-cta" title="Review swap" description={ `Swap involves paying ${toChainAssetSymbol(wrapAction.from)} to smart contract which re-pays you back the 1:1 value of ${toChainAssetSymbol(wrapAction.to)} as a result` } style={{ width: '100%', marginTop: 2 }} disabled={!wrapPayload} onBuild={async () => {
            if (!wrapPayload)
              return null;
            return wrapAction.direction == 'unwrap' ? Builder.repayAsset({
              marketId: wrapAction.marketId.toString(),
              repaymentAssetHash: wrapAction.native.id,
              paymentAssetHash: wrapAction.unified.id,
              pays: wrapPayload
            }) : Builder.payUnifiedAsset({
              pays: { [wrapAction.native.id]: wrapPayload },
              marketId: wrapAction.marketId.toString(),
              primaryAssetHash: AssetId.fromHandle(wrapAction.native.chain || '').id,
              secondaryAssetHash: wrapAction.unified.id
            });
          }}></PerformerButton>
        </div>
      }
      {
        !loadingPoly && !bestPaths?.length && !wrapAction &&
        (loadingPath ?
          <Flex px="4" pt="4" justify="center"><Text size="2" align="center" className="dim">Optimizing swap routes...</Text></Flex> :
          <button className="btn-block" disabled style={{ marginTop: 14, background: 'var(--elev)', color: 'var(--text-3)', border: 0, borderRadius: 'var(--r-md)', height: 48, fontWeight: 700, fontSize: 14, cursor: 'not-allowed', opacity: 0.6 }}>{ bestPaths ? 'No routes for the swap.' : 'Waiting for details' }</button>)
      }
    </Box>
  )
}

type MockPairEntry = { marketId: string, pair: AggregatedPair };
function loadMockPairs(): MockPairEntry[] {
  const stored = AppStorage.get(ExchangeField.PortfolioMockPairs);
  if (!Array.isArray(stored))
    return [];

  const number = (value: string | null) => value != null ? new BigNumber(value) : null;
  const result: MockPairEntry[] = [];
  const seen = new Set<string>();
  for (const entry of stored) {
    try {
      const marketId = String(entry.marketId);
      const primaryAsset = new AssetId(entry.pair.primaryAsset);
      const secondaryAsset = new AssetId(entry.pair.secondaryAsset);
      const key = marketId + ':' + primaryAsset.id + ':' + secondaryAsset.id;
      if (seen.has(key))
        continue;
      seen.add(key);
      result.push({
        marketId: marketId,
        pair: {
          id: new BigNumber(entry.pair.id),
          primaryAsset: primaryAsset,
          secondaryAsset: secondaryAsset,
          secondaryBase: entry.pair.secondaryBase || null,
          launchTime: entry.pair.launchTime,
          poolFeeRate: number(entry.pair.poolFeeRate),
          price: {
            orderLiquidity: number(entry.pair.price.orderLiquidity),
            poolLiquidity: number(entry.pair.price.poolLiquidity),
            totalLiquidity: number(entry.pair.price.totalLiquidity),
            orderVolume: number(entry.pair.price.orderVolume),
            poolVolume: number(entry.pair.price.poolVolume),
            totalVolume: number(entry.pair.price.totalVolume),
            open: number(entry.pair.price.open),
            low: number(entry.pair.price.low),
            high: number(entry.pair.price.high),
            close: number(entry.pair.price.close)
          }
        }
      });
    } catch { }
  }
  return result;
}
function persistMockPairs(entries: MockPairEntry[]): void {
  AppStorage.set(ExchangeField.PortfolioMockPairs, entries.map((entry) => ({
    marketId: entry.marketId,
    pair: {
      id: entry.pair.id.toString(),
      primaryAsset: entry.pair.primaryAsset.id,
      secondaryAsset: entry.pair.secondaryAsset.id,
      secondaryBase: entry.pair.secondaryBase,
      launchTime: entry.pair.launchTime,
      poolFeeRate: entry.pair.poolFeeRate?.toString() || null,
      price: {
        orderLiquidity: entry.pair.price.orderLiquidity?.toString() || null,
        poolLiquidity: entry.pair.price.poolLiquidity?.toString() || null,
        totalLiquidity: entry.pair.price.totalLiquidity?.toString() || null,
        orderVolume: entry.pair.price.orderVolume?.toString() || null,
        poolVolume: entry.pair.price.poolVolume?.toString() || null,
        totalVolume: entry.pair.price.totalVolume?.toString() || null,
        open: entry.pair.price.open?.toString() || null,
        low: entry.pair.price.low?.toString() || null,
        high: entry.pair.price.high?.toString() || null,
        close: entry.pair.price.close?.toString() || null
      }
    }
  })));
}
function MarketExplorer(props: {
  assets?: CachedBalance[],
  market: Market | null,
  type: 'pairs' | 'router' | 'pools' | 'delegated-pools',
  setType: (type: string) => any
  onPair?: (pair: { primary: AssetId | null, secondary: AssetId | null }) => void
  refreshKey?: number
}) {
  const navigate = useNavigate();
  const [launchablePair, setLaunchablePair] = useState<AggregatedPair | null>(null);
  const [mockPairs, setMockPairs] = useState<MockPairEntry[]>(() => { const loaded = loadMockPairs(); persistMockPairs(loaded); return loaded; });
  const [pairs, setPairs] = useState<{ pair: AggregatedPair, whitelisted: boolean, cached: boolean }[]>([]);
  const [searchPair, setSearchPair] = useState<{ primary: AssetId | null, secondary: AssetId | null }>({ primary: null, secondary: null });
  const [loading, setLoading] = useState(false);
  const [pools, setPools] = useState<Pool[]>([]);
  const [delegatedPools, setDelegatedPools] = useState<PseudoDelegatedPool[]>([]);
  const [morePools, setMorePools] = useState(true);
  const [text, setText] = useState('');
  const textFilter = useMemo(() => {
    const q = text.trim().toLowerCase().replace(/\s+/g, '');
    const slash = q.indexOf('/');
    const left = slash >= 0 ? q.substring(0, slash) : q;
    const right = slash >= 0 ? q.substring(slash + 1) : null;
    const matches = (asset: AssetId, s: string): boolean => {
      if (!s.length)
        return true;
      return [
        UiUtil.toAssetSymbol(asset), asset.token || '', asset.chain || '',
        Assetlist.toName(asset), Assetlist.toName(asset, false, true)
      ].some((name) => name.toLowerCase().includes(s));
    };
    return (item: { pair: AggregatedPair }): boolean => {
      if (!q.length)
        return true;
      return right == null
        ? matches(item.pair.primaryAsset, left) || matches(item.pair.secondaryAsset, left)
        : matches(item.pair.primaryAsset, left) && matches(item.pair.secondaryAsset, right);
    };
  }, [text]);
  const mockView = useMemo((): { pair: AggregatedPair, whitelisted: boolean }[] => {
    if (props.market == null)
      return [];

    const marketId = props.market.id.toString();
    const orientations = new Set(pairs.map((item) => item.pair.primaryAsset.id + ':' + item.pair.secondaryAsset.id));
    return mockPairs.filter((entry) => entry.marketId == marketId && !orientations.has(entry.pair.primaryAsset.id + ':' + entry.pair.secondaryAsset.id)).map((entry) => ({ pair: entry.pair, whitelisted: !!Whitelist.contractAddressOf(entry.pair.primaryAsset) && !!Whitelist.contractAddressOf(entry.pair.secondaryAsset) }));
  }, [mockPairs, props.market, pairs]);
  const pairsFilter = useMemo((): { pair: AggregatedPair, whitelisted: boolean }[] => {
    const seen = new Set<string>();
    let result = [...pairs, ...mockView].filter((item) => {
      const key = item.pair.primaryAsset.id + ':' + item.pair.secondaryAsset.id;
      if (seen.has(key))
        return false;
      seen.add(key);
      return true;
    }).filter(textFilter);
    if (launchablePair != null && !seen.has(launchablePair.primaryAsset.id + ':' + launchablePair.secondaryAsset.id)) {
      result = [{ pair: launchablePair, whitelisted: !!Whitelist.contractAddressOf(launchablePair.primaryAsset) && !!Whitelist.contractAddressOf(launchablePair.secondaryAsset) }, ...result];
    }
    return result.sort((a, b) => (b.pair.price.totalLiquidity || new BigNumber(0)).comparedTo(a.pair.price.totalLiquidity || new BigNumber(0)) || 0);
  }, [pairs, mockView, launchablePair, textFilter]);
  const updateSearchPair = useCallback((change: (prev: { primary: AssetId | null, secondary: AssetId | null }) => { primary: AssetId | null, secondary: AssetId | null }) => {
    setSearchPair(change);
  }, []);
  const launchPair = useCallback(async () => {
    if (loading)
      return;

    setLoading(true);
    try {
      if (!props.market || !searchPair.primary || !searchPair.secondary)
        throw false;

      const primary = searchPair.primary, secondary = searchPair.secondary;
      try {
        const reverse = await Exchange.marketPair(props.market.id, secondary, primary, false);
        if (reverse != null && reverse.price.totalLiquidity != null && reverse.price.totalLiquidity.gt(0)) {
          const mock: AggregatedPair = {
            ...reverse,
            primaryAsset: reverse.secondaryAsset,
            secondaryAsset: reverse.primaryAsset,
            price: {
              ...reverse.price,
              open: reverse.price.open != null && reverse.price.open.gt(0) ? new BigNumber(1).dividedBy(reverse.price.open) : null,
              close: reverse.price.close != null && reverse.price.close.gt(0) ? new BigNumber(1).dividedBy(reverse.price.close) : null
            }
          };
          const marketId = props.market.id.toString();
          const next = [{ marketId: marketId, pair: mock }, ...mockPairs.filter((entry) => entry.marketId != marketId || entry.pair.primaryAsset.id != primary.id || entry.pair.secondaryAsset.id != secondary.id)];
          setMockPairs(next);
          persistMockPairs(next);
          setLoading(false);
          return null;
        }
      } catch { }

      const result = await Exchange.marketPair(props.market.id, primary, secondary, true);
      setLaunchablePair(result);
      setLoading(false);
      return result;
    } catch (exception: unknown) {
      if (exception instanceof Error)
        AlertBox.open(AlertType.Error, 'Failed to launch a market: ' + exception.message);
      setLaunchablePair(null);
      setLoading(false);
      return null;
    }
  }, [props.market, searchPair, mockPairs, loading]);
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
        const process = (data: AggregatedPair[]) => (data || []).map((x) => ({
          pair: x,
          whitelisted: !!Whitelist.contractAddressOf(x.primaryAsset) && !!Whitelist.contractAddressOf(x.secondaryAsset),
          cached: false
        }));
        const data = process(await Exchange.marketPairs(props.market.id, (cache) => setPairs(prev => prev.length > 0 ? prev : process(cache))));
        setPairs(data);
      } catch { }
      setLoading(false);
    } else if (props.type == 'pools' || props.type == 'delegated-pools') {
      await findPools(true);
    }

  }, [props.market, props.type, props.refreshKey]);
  useEffect(() => {
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
      setMockPairs(prev => {
        if (!prev.length)
          return prev;

        return prev.map((entry) => {
          const target = Exchange.priceOf(entry.pair.primaryAsset, entry.pair.secondaryAsset);
          return { ...entry, pair: { ...entry.pair, price: { ...entry.pair.price, open: target.open || entry.pair.price.open, close: target.close || entry.pair.price.close } } };
        });
      });
    };
    window.addEventListener('update:trade', updatePairs);
    return () => window.removeEventListener('update:trade', updatePairs);
  }, []);
  useEffect(() => {
    if (!mockPairs.length)
      return;

    const orientations = new Set(pairs.map((item) => item.pair.primaryAsset.id + ':' + item.pair.secondaryAsset.id));
    const pruned = mockPairs.filter((entry) => !orientations.has(entry.pair.primaryAsset.id + ':' + entry.pair.secondaryAsset.id));
    if (pruned.length != mockPairs.length) {
      setMockPairs(pruned);
      persistMockPairs(pruned);
    }
  }, [pairs, mockPairs]);

  return (
    <Box>
      {
        (props.type == 'pools' || props.type == 'delegated-pools') &&
        <div className="card-head" style={{ margin: '4px 2px 10px' }}>
          <div className="card-title">{ props.type == 'pools' ? 'Liquidity pools' : 'Delegated liquidity' }</div>
          <button className="settled-toggle" onClick={() => props.setType(props.type == 'pools' ? 'delegated-pools' : 'pools')}>{ props.type == 'pools' ? <><Icon path={mdiArrowLeft} size={0.7}></Icon>Delegated liquidity</> : <>Liquidity pools<Icon path={mdiArrowRight} size={0.7}></Icon></> }</button>
        </div>
      }
      {
        props.type == 'pairs' &&
        <>
          <div className="search" style={{ height: 44, margin: '2px 0 14px' }}>
            <Icon path={mdiMagnify} size={0.85}></Icon>
            <input placeholder="Search pairs: BTC / USDC" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="pair-list">
            {
              pairsFilter.map((item) =>
                <button className="pair-row" key={item.pair.id.toString() + ':' + item.pair.primaryAsset.id} onClick={() => navigate(`/orderbook/${Exchange.toOrderbookQuery(props.market?.id || new BigNumber(0), item.pair.primaryAsset, item.pair.secondaryAsset)}`)}>
                  <span style={{ position: 'relative', width: 45, height: 45, flex: 'none' }}>
                    <AssetImage asset={item.pair.primaryAsset} size="3" iconSize="36px"></AssetImage>
                    <AssetImage asset={item.pair.secondaryAsset} size="1" iconSize="22px" style={{ position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--card)', borderRadius: '50%' }}></AssetImage>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="asset-name" style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                      {
                        item.pair.secondaryAsset.chain != 'TAN' && item.pair.primaryAsset.chain == 'TAN' ?
                        <>Inv.<AssetName asset={item.pair.secondaryAsset} size="3" weight="bold"></AssetName></> :
                        <><AssetName asset={item.pair.primaryAsset} size="3" weight="bold"></AssetName>{ item.pair.secondaryBase == null && ' in ' + (item.pair.secondaryAsset.token || item.pair.secondaryAsset.chain) }</>
                      }
                    </div>
                    <div className="asset-sub mono">{ toAssetSymbol(item.pair.primaryAsset) }x{ toAssetSymbol(item.pair.secondaryAsset) }</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{ toFancyMoney(item.pair.secondaryAsset, item.pair.price.close) }</div>
                    <div className="tiny dim num">{ toFancyMoney(item.pair.secondaryAsset, (item.pair.price.close || new BigNumber(0)).minus(item.pair.price.open || new BigNumber(0)), true) } | <span style={{ color: (item.pair.price.open || new BigNumber(0)).gt(item.pair.price.close || new BigNumber(0)) ? 'var(--down)' : ((item.pair.price.open || new BigNumber(0)).eq(item.pair.price.close || new BigNumber(0)) ? undefined : 'var(--lime)') }}>{ UiUtil.toPercentageDelta(item.pair.price.open || new BigNumber(0), item.pair.price.close || new BigNumber(0)) }</span></div>
                  </div>
                </button>)
            }
            {
              loading && !pairsFilter.length &&
              <>
                <div className="pair-row"><span className="skel" style={{ width: 42, height: 42, borderRadius: '50%' }}></span><div style={{ flex: 1 }}><span className="skel" style={{ width: 88, height: 14, display: 'inline-block' }}></span><span className="skel skel-line" style={{ width: '60%' }}></span></div><span className="skel" style={{ width: 92, height: 16 }}></span></div>
                <div className="pair-row"><span className="skel" style={{ width: 42, height: 42, borderRadius: '50%' }}></span><div style={{ flex: 1 }}><span className="skel" style={{ width: 70, height: 14, display: 'inline-block' }}></span><span className="skel skel-line" style={{ width: '45%' }}></span></div><span className="skel" style={{ width: 92, height: 16 }}></span></div>
              </>
            }
            {
              !loading && !pairsFilter.length &&
              <div className="card">
                <div className="empty tight">
                  <div className="art"><Icon path={mdiMagnify} size={1.4}></Icon></div>
                  <h4>No pairs match</h4>
                  <p>Try another search term, or launch a new pair below.</p>
                </div>
                <div className={'pair-launch' + (searchPair.primary && searchPair.secondary ? '' : ' no-btn')}>
                  <div className="pair-launch-cap">New pair</div>
                  <div className="pair-launch-row">
                    <AssetSelector title="base asset" value={searchPair.primary} onChange={(value) => updateSearchPair(prev => ({ primary: value || null, secondary: prev?.secondary || null }))}>
                      <button className={searchPair.primary ? 'token-select' : 'token-select dot'}>
                        { searchPair.primary ? <>{ <AssetImage asset={searchPair.primary} size="3" iconSize="24px"></AssetImage> } { UiUtil.toAssetSymbol(searchPair.primary) }</> : 'Base' } <Icon path={mdiChevronDown} size={0.85} style={{ opacity: 0.6 }}></Icon>
                      </button>
                    </AssetSelector>
                    <span className="dim">×</span>
                    <AssetSelector title="quote asset" value={searchPair.secondary} onChange={(value) => updateSearchPair(prev => ({ primary: prev?.primary || null, secondary: value || null }))}>
                      <button className={searchPair.secondary ? 'token-select' : 'token-select dot'}>
                        { searchPair.secondary ? <>{ <AssetImage asset={searchPair.secondary} size="3" iconSize="24px"></AssetImage> } { UiUtil.toAssetSymbol(searchPair.secondary) }</> : 'Quote' } <Icon path={mdiChevronDown} size={0.85} style={{ opacity: 0.6 }}></Icon>
                      </button>
                    </AssetSelector>
                  </div>
                  {
                    searchPair.primary && searchPair.secondary &&
                    <Button className="btn-brand btn-cta btn-block" color="jade" disabled={loading} onClick={() => launchPair()}>
                      <Icon path={mdiPlus} size={0.8}></Icon> Add { searchPair.primary.token || searchPair.primary.chain }/{ searchPair.secondary.token || searchPair.secondary.chain } pair
                    </Button>
                  }
                </div>
              </div>
            }
          </div>
          <p className="tiny dim" style={{ marginTop: 14, textAlign: 'center' }}>Orders, fills and settlement happen on-chain. This view is served by the DEX indexer.</p>
        </>
      }
      {
        props.type == 'router' && props.assets != null &&
        <MarketRouter market={props.market} assets={props.assets} pair={searchPair} setPair={setSearchPair} onPair={props.onPair} refreshKey={props.refreshKey}></MarketRouter>
      }
      {
        (props.type == 'pools' || props.type == 'delegated-pools') &&
        <Box>
          {
            props.type == 'pools' ?
            <Box>
              <InfiniteScroll dataLength={pools.length} hasMore={morePools} next={findPools} loader={<div></div>}>
                { pools.map((item) => <Box key={item.poolId.toString()} mb="4"><PoolView item={item} readOnly={true}></PoolView></Box>) }
                {
                  !loading && !pools.length &&
                  <div className="card">
                    <div className="empty" style={{ padding: '32px 24px' }}>
                      <div className="art"><Icon path={mdiChartTimelineVariant} size={1.4}></Icon></div>
                      <h4>No pools yet</h4>
                      <p>New liquidity pools will appear here once the market has liquidity.</p>
                    </div>
                  </div>
                }
              </InfiniteScroll>
            </Box> :
            <Box>
              { delegatedPools.map((item) => <Box key={item.delegatorId.toString() + item.marketId.toString() + item.primaryAsset.id + item.secondaryAsset.id} mb="4"><PseudoDelegatedPoolView item={item} assets={props.assets || []}></PseudoDelegatedPoolView></Box>) }
              {
                !loading && !delegatedPools.length &&
                <div className="card">
                  <div className="empty" style={{ padding: '32px 24px' }}>
                    <div className="art"><Icon path={mdiChartTimelineVariant} size={1.4}></Icon></div>
                    <h4>No pools yet</h4>
                      <p>New delegated liquidity will appear here once the market has liquidity.</p>
                  </div>
                </div>
              }
            </Box>
          }
          <p className="tiny dim" style={{ marginTop: 14 }}>{ props.type == 'pools' ? 'You set the range and rebalance yourself. Tap another trader\'s LP to copy its composition.' : 'Fund once — the operator manages the range for you. Tap a vault to add funds.' }</p>
        </Box>
      }
      {
        loading && !pairs.length && !pools.length && !delegatedPools.length &&
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
  const [market, setMarket] = useState<Market | null>(null);
  const [displayAsset, setDisplayAsset] = useState<string>(Exchange.equityAsset.chain || '');
  const [search, setSearch] = useSearchParams();
  const [viewPull, setViewPull] = useState(0);
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<CachedBalance[]>([]);
  const [viewer, setViewer] = useState<'market-pairs' | 'market-router' | 'market-pools' | 'market-delegated-pools' | 'wallet'>('market-pairs');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [todayProfits, setTodayProfits] = useState(true);
  const [settled, setSettled] = useState(false);
  const [historic, setHistoric] = useState<'orders' | 'pools' | 'delegated' | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [swapPair, setSwapPair] = useState<{ primary: AssetId | null, secondary: AssetId | null }>({ primary: null, secondary: null });
  const [orders, setOrders] = useState<Order[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [delegatedPools, setDelegatedPools] = useState<DelegatedPool[]>([]);
  const [moreOrders, setMoreOrders] = useState(true);
  const [morePools, setMorePools] = useState(true);
  const [moreDelegatedPools, setMoreDelegatedPools] = useState(true);
  const inflight = useRef(0);
  const ordersSeq = useRef(0);
  const poolsSeq = useRef(0);
  const delegatedSeq = useRef(0);
  const findOrders = useCallback(async (refresh?: boolean) => {
    if (!baseAddress) {
      setOrders([]);
      setMoreOrders(false);
      return false;
    } else if (loading && !refresh) {
      return true;
    }

    const seq = ++ordersSeq.current;
    inflight.current++;
    setLoading(true);
    try {
      if (refresh && !(historic != null || settled)) {
        const cursor = Cursor.offset(0);
        let all: Order[] = [];
        for (let page = 0; ; page++) {
          const data = await Exchange.accountOrders({ address: baseAddress, page, active: true });
          if (seq != ordersSeq.current)
            return false;
          if (!Array.isArray(data))
            break;
          all = all.concat(data);
          if (data.length < cursor.count)
            break;
        }
        setOrders(all);
        setMoreOrders(false);
        return all.length > 0;
      }
      const cursor = Cursor.offset(refresh ? 0 : orders.length);
      const data = await Exchange.accountOrders({ address: baseAddress, page: Math.floor(cursor.offset / cursor.count), active: !(historic != null || settled) });
      if (seq != ordersSeq.current)
        return false;
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
      if (seq != ordersSeq.current)
        return false;
      AlertBox.open(AlertType.Error, 'Failed to fetch orders: ' + (exception as Error).message);
      if (refresh)
        setOrders([]);
      setMoreOrders(false);
      return false;
    } finally {
      inflight.current--;
      if (!inflight.current)
        setLoading(false);
    }
  }, [baseAddress, orders, settled, historic, loading]);
  const findPools = useCallback(async (refresh?: boolean) => {
    if (!baseAddress) {
      setPools([]);
      setMorePools(false);
      return false;
    } else if (loading && !refresh) {
      return true;
    }

    const seq = ++poolsSeq.current;
    inflight.current++;
    setLoading(true);
    try {
      if (refresh && !(historic != null || settled)) {
        const cursor = Cursor.offset(0);
        let all: Pool[] = [];
        for (let page = 0; ; page++) {
          const data = await Exchange.accountPools({ address: baseAddress, page, active: true });
          if (seq != poolsSeq.current)
            return false;
          if (!Array.isArray(data))
            break;
          all = all.concat(data);
          if (data.length < cursor.count)
            break;
        }
        setPools(all);
        setMorePools(false);
        return all.length > 0;
      }
      const cursor = Cursor.offset(refresh ? 0 : pools.length);
      const data = await Exchange.accountPools({ address: baseAddress, page: Math.floor(cursor.offset / cursor.count), active: !(historic != null || settled) });
      if (seq != poolsSeq.current)
        return false;
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
      if (seq != poolsSeq.current)
        return false;
      AlertBox.open(AlertType.Error, 'Failed to fetch LPs: ' + (exception as Error).message);
      if (refresh)
        setPools([]);
      setMorePools(false);
      return false;
    } finally {
      inflight.current--;
      if (!inflight.current)
        setLoading(false);
    }
  }, [baseAddress, pools, settled, historic, loading]);
  const findDelegatedPools = useCallback(async (refresh?: boolean) => {
    if (!baseAddress) {
      setDelegatedPools([]);
      setMoreDelegatedPools(false);
      return false;
    } else if (loading && !refresh) {
      return true;
    }

    const seq = ++delegatedSeq.current;
    inflight.current++;
    setLoading(true);
    try {
      if (refresh && !(historic != null || settled)) {
        const cursor = Cursor.offset(0);
        let all: DelegatedPool[] = [];
        for (let page = 0; ; page++) {
          const data = await Exchange.accountDelegatedPools({ address: baseAddress, page, active: true });
          if (seq != delegatedSeq.current)
            return false;
          if (!Array.isArray(data))
            break;
          all = all.concat(data);
          if (data.length < cursor.count)
            break;
        }
        setDelegatedPools(all);
        setMoreDelegatedPools(false);
        return all.length > 0;
      }
      const cursor = Cursor.offset(refresh ? 0 : delegatedPools.length);
      const data = await Exchange.accountDelegatedPools({ address: baseAddress, page: Math.floor(cursor.offset / cursor.count), active: !(historic != null || settled) });
      if (seq != delegatedSeq.current)
        return false;
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setDelegatedPools([]);
        setMoreDelegatedPools(false);
        return false;
      }

      setDelegatedPools(refresh ? data : prev => prev.concat(data));
      setMoreDelegatedPools(data.length >= cursor.count);
      return data.length > 0;
    } catch (exception) {
      if (seq != delegatedSeq.current)
        return false;
      AlertBox.open(AlertType.Error, 'Failed to fetch LPs: ' + (exception as Error).message);
      if (refresh)
        setDelegatedPools([]);
      setMoreDelegatedPools(false);
      return false;
    } finally {
      inflight.current--;
      if (!inflight.current)
        setLoading(false);
    }
  }, [baseAddress, delegatedPools, settled, historic, loading]);
  useEffectAsync(async () => {
    if (!readOnly && viewer.startsWith('market'))
      AppStorage.set(ExchangeField.PortfolioMarket, viewer);

    if (viewer == 'wallet') {
      await Promise.all([findOrders(true), findPools(true), findDelegatedPools(true)]);
    }
  }, [viewer, params.account, readOnly, settled, historic, viewPull]);
  useEffectAsync(async () => {
    await Exchange.establish();
    setDisplayAsset(Exchange.equityAsset.chain || '');
    if (Exchange.markets.length > 0) {
      setMarket(Exchange.markets[0]);
    }
  }, []);
  useEffect(() => {
    const view = search.get('view') || AppStorage.get(ExchangeField.PortfolioView) || null;
    const marketView = view != null ? (['market-pairs', 'market-router', 'market-pools', 'market-delegated-pools'] as ('market-pairs' | 'market-router' | 'market-pools' | 'market-delegated-pools')[]).find((x) => x == view) : undefined;
    if (marketView != null) {
      setHistoric(null);
      if (!readOnly) {
        AppStorage.set(ExchangeField.PortfolioView, marketView);
      }
      setSettled(false);
      setViewer(marketView);
    } else if (view != null && view.startsWith('wallet')) {
      if (!readOnly) {
        AppStorage.set(ExchangeField.PortfolioView, 'wallet');
      }
      const hist = view.includes('historic-orders') ? 'orders' : (view.includes('historic-pools') ? 'pools' : (view.includes('historic-delegated-pools') ? 'delegated' : null));
      setSettled(view.includes('closed') || hist != null);
      setHistoric(hist);
      setViewer('wallet');
    } else {
      setHistoric(null);
      if (!readOnly) {
        AppStorage.set(ExchangeField.PortfolioView);
      }
    }
  }, [search, readOnly, params.account]);
  useEffect(() => {
    setAssetsReady(false);
  }, [params.account]);
  useEffect(() => {
    if (viewer != 'wallet')
      return;
    const ordersUpdate = () => findOrders(true);
    const poolsUpdate = () => findPools(true);
    const delegatedUpdate = () => findDelegatedPools(true);
    window.addEventListener('update:orders', ordersUpdate);
    window.addEventListener('update:pool', poolsUpdate);
    window.addEventListener('update:delegated-pool', delegatedUpdate);
    return () => {
      window.removeEventListener('update:orders', ordersUpdate);
      window.removeEventListener('update:pool', poolsUpdate);
      window.removeEventListener('update:delegated-pool', delegatedUpdate);
    };
  }, [baseAddress, viewer, settled, historic]);

  const tab: 'trade' | 'swap' | 'earn' | 'wallet' = (() => {
    if (viewer == 'market-router')
      return 'swap';
    if (viewer == 'market-pools' || viewer == 'market-delegated-pools')
      return 'earn';
    if (viewer.startsWith('wallet'))
      return 'wallet';
    return 'trade';
  })();
  useEffect(() => {
    if (tab == 'swap')
      AppData.setTitle('Swap' + (swapPair.primary != null ? ' ' + UiUtil.toAssetSymbol(swapPair.primary) + ' → ' + (swapPair.secondary != null ? UiUtil.toAssetSymbol(swapPair.secondary) : '?') : ''));
    else if (tab == 'earn')
      AppData.setTitle(viewer == 'market-pools' ? 'Liquidity pools' : 'Delegated liquidity');
    else if (tab == 'wallet')
      AppData.setTitle((historic != null ? (historic == 'orders' ? 'Order history' : historic == 'pools' ? 'Pool history' : 'Vault history') : 'Wallet') + (baseAddress != null ? ' of ' + UiUtil.toAddress(baseAddress, 12) : ''));
    else
      AppData.setTitle('Trading pairs');
  }, [tab, swapPair, viewer, historic, baseAddress]);
  const openTab = useCallback((next: 'trade' | 'swap' | 'earn' | 'wallet') => {
    const marketType = AppStorage.get(ExchangeField.PortfolioMarket);
    if (next == 'swap')
      setSearch({ view: 'market-router' });
    else if (next == 'earn')
      setSearch({ view: marketType == 'market-pools' || marketType == 'market-delegated-pools' ? marketType : 'market-delegated-pools' });
    else if (next == 'wallet')
      setSearch({ view: 'wallet' });
    else
      setSearch({ view: 'market-pairs' });
  }, [setSearch]);
  const equityAssets = useMemo(() => Exchange.getEquityAssets().slice().sort((a, b) => a[1].localeCompare(b[1])), []);
  const displayAssetName = useMemo(() => {
    const entry = equityAssets.find(([symbol]) => symbol == displayAsset);
    return entry ? entry[1] + ' (' + entry[0] + ')' : (displayAsset || 'Unknown');
  }, [displayAsset, equityAssets]);
  return (
    <Box pt="2" minWidth="285px" maxWidth="680px" mx="auto" pb="2">
      <Box>
        <div className="page-head">
          <Dialog.Root onOpenChange={(opened) => {
            setSearching(opened)
            setQuery('');
          }} open={searching}>
            <Dialog.Trigger>
              <button className="acct-chip" style={{ border: 0 }}>
                <span className={'avatar' + (readOnly || !AppData.hasWalletSecretKey() ? ' watch' : '')}>
                  { (!readOnly && AppData.hasWalletSecretKey()) ? <AddressAvatar address={ownerAddress || ''} size="1" style={{ width: '100%', height: '100%' }}></AddressAvatar> : <Icon path={mdiEyeOutline} size={0.62}></Icon> }
                </span>
                <span className="mono">{ UiUtil.toAddress(baseAddress || undefined, 6) }</span>
                <Icon path={mdiChevronDown} size={0.7} style={{ color: 'var(--text-2)' }}></Icon>
              </button>
            </Dialog.Trigger>
            <Dialog.Content className="sheet-content" maxWidth="450px">
              <form action="">
                <Dialog.Title style={{ fontWeight: 750, fontSize: 16, margin: '0 0 12px', color: 'var(--text)' }}>Look up an account</Dialog.Title>
                <div className="search" style={{ height: 44 }}>
                  <Icon path={mdiMagnify} size={0.85}></Icon>
                  <input placeholder="Account address" value={query} onChange={(e) => setQuery(e.target.value)} readOnly={loading} ref={searchInput} />
                </div>
                <Button className="btn-brand btn-block" style={{ marginTop: 14, height: 46, borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 15 }} type="submit" disabled={!query.trim().length || !Signing.verifyAddress(query.trim())} onClick={(e) => {
                  e.preventDefault();
                  navigate(`/portfolio/${query.trim()}?view=wallet`);
                  setSearching(false);
                }}>Search</Button>
              </form>
              <Button className="btn-soft btn-block" style={{ marginTop: 14, height: 44, borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: 14 }} disabled={!baseAddress} onClick={() => {
                navigator.clipboard.writeText(baseAddress || '');
                AlertBox.open(AlertType.Info, 'Address copied!');
              }}><Icon path={mdiContentCopy} size={0.8}></Icon>Copy address</Button>
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
              <div className="menu-cap" style={{ padding: '0 0 8px' }}>Dex market</div>
              <Select.Root value={market ? market.id.toString() : ''} onValueChange={(e) => {
                setMarket(Exchange.markets.find((v) => v.id.toString() == e) || null);
              }} size="3">
                <Select.Trigger style={{ width: '100%' }} placeholder="Unknown">{ market ? Exchange.marketPolicyOf(market) + ' ' + (market.version || market.account.substring(market.account.length - 4)) : 'Unknown' }</Select.Trigger>
                <Select.Content position="popper" side="bottom">
                  <Select.Group>
                    <Select.Label>DEX version</Select.Label>
                    { Exchange.markets.map((item) => <Select.Item key={item.id.toString()} value={item.id.toString()}>{ Exchange.marketPolicyOf(item) } { item.version || item.account.substring(item.account.length - 4) }</Select.Item>) }
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
              <div className="menu-cap" style={{ padding: '0 0 8px' }}>Display asset</div>
              <Select.Root value={displayAsset} onValueChange={async (symbol) => {
                if (!Exchange.setEquityAsset(AssetId.fromHandle(symbol)))
                  return;
                setDisplayAsset(symbol);
                try {
                  await Exchange.synchronize();
                } finally {
                  setDisplayAsset(Exchange.equityAsset.chain || symbol);
                }
              }} size="3">
                <Select.Trigger style={{ width: '100%' }} placeholder="Unknown">{ displayAssetName }</Select.Trigger>
                <Select.Content position="popper" side="bottom">
                  <Select.Group>
                    <Select.Label>Display currency</Select.Label>
                    { equityAssets.map(([symbol, name]) => <Select.Item key={symbol} value={symbol}>{ name }<Text size="1" color="gray" style={{ marginLeft: 6 }}>{ symbol }</Text></Select.Item>) }
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>
            </Dialog.Content>
          </Dialog.Root>
        </div>
      </Box>
      <Box>
        <WalletNavigator address={baseAddress} available={viewer == 'wallet' ? availableOnly : false} readOnly={readOnly} todayProfits={todayProfits} onTodayProfitsChange={setTodayProfits} onSync={() => setViewPull((prev) => prev + 1)} onAssetsChange={(value: CachedBalance[] | ((prev: CachedBalance[]) => CachedBalance[])) => { setAssets(value); setAssetsReady(true); }}></WalletNavigator>
      </Box>
      <Box style={{ marginTop: 2 }}>
        <SegmentedControl.Root value={tab} radius="full" size="3" mb="4" onValueChange={(value) => openTab(value as 'trade' | 'swap' | 'earn' | 'wallet')}>
          <SegmentedControl.Item value="trade"><Text size="2">Trade</Text></SegmentedControl.Item>
          <SegmentedControl.Item value="swap"><Text size="2">Swap</Text></SegmentedControl.Item>
          <SegmentedControl.Item value="earn"><Text size="2">Earn</Text></SegmentedControl.Item>
          <SegmentedControl.Item value="wallet"><Text size="2">Wallet</Text></SegmentedControl.Item>
        </SegmentedControl.Root>
        {
          tab != 'wallet' &&
          <MarketExplorer market={market} assets={viewer == 'market-router' || viewer == 'market-delegated-pools' ? assets : undefined} type={toMarketExplorerType(viewer)} setType={(type) => setSearch({ view: 'market-' + type })} refreshKey={viewPull} onPair={setSwapPair}></MarketExplorer>
        }
        {
          viewer == 'wallet' &&
          <Box>
            { historic == null && <WalletAssets assets={assets} todayProfits={todayProfits} readOnly={readOnly} available={availableOnly} onAvailableChange={setAvailableOnly}></WalletAssets> }
            {
              historic == null && assetsReady && !assets.length &&
              <Box>
                <div className="card">
                  <div className="empty">
                    <div className="art"><Icon path={mdiWalletOutline} size={1.4}></Icon></div>
                    <h4>No assets</h4>
                    <p>Deposit tokens to this account - balances appear here with live USD values.</p>
                  </div>
                </div>
              </Box>
            }
            {
              historic == null &&
              <Box mt="6">
                <div className="card-head" style={{ margin: '0 2px 10px' }}>
                  <div className="card-title">{ settled ? 'Closed delegated liquidity' : 'Delegated liquidity' }</div>
                  { !settled && <button className="settled-toggle" onClick={() => setSearch({ view: 'wallet-historic-delegated-pools' })}>History<Icon path={mdiArrowRight} size={0.7}></Icon></button> }
                </div>
                {
                  delegatedPools.length > 0 ?
                  <div className="wallet-list">
                    <InfiniteScroll dataLength={delegatedPools.length} hasMore={moreDelegatedPools} next={findDelegatedPools} loader={<div></div>}>
                      {
                        delegatedPools.map((item) =>
                          <Box key={item.id.toString()} mb="3">
                            <DelegatedPoolView item={item} assets={assets} readOnly={readOnly}></DelegatedPoolView>
                          </Box>)
                      }
                    </InfiniteScroll>
                  </div>
                  : !moreDelegatedPools &&
                  <div className="card">
                    <div className="empty">
                      <div className="art"><Icon path={mdiChartTimelineVariant} size={1.4}></Icon></div>
                      <h4>{ settled ? 'No closed positions' : 'No delegated liquidity' }</h4>
                      <p>{ settled ? 'Withdrawn vault positions will show up here.' : 'Fund a vault on the Earn tab once - the operator manages the range for you.' }</p>
                    </div>
                  </div>
                }
              </Box>
            }
            {
              historic == null &&
              <Box mt="6">
                <div className="card-head" style={{ margin: '0 2px 10px' }}>
                  <div className="card-title">{ settled ? 'Closed liquidity pools' : 'Liquidity pools' }</div>
                  { !settled && <button className="settled-toggle" onClick={() => setSearch({ view: 'wallet-historic-pools' })}>History<Icon path={mdiArrowRight} size={0.7}></Icon></button> }
                </div>
                {
                  pools.length > 0 ?
                  <div className="wallet-list">
                    <InfiniteScroll dataLength={pools.length} hasMore={morePools} next={findPools} loader={<div></div>}>
                      {
                        pools.map((item) =>
                          <Box key={item.poolId.toString()} mb="3">
                            <PoolView item={item} readOnly={readOnly}></PoolView>
                          </Box>)
                      }
                    </InfiniteScroll>
                  </div>
                  : !morePools &&
                  <div className="card">
                    <div className="empty">
                      <div className="art"><Icon path={mdiChartTimelineVariant} size={1.4}></Icon></div>
                      <h4>{ settled ? 'No closed positions' : 'No liquidity pools' }</h4>
                      <p>{ settled ? 'Settled positions will show up here.' : "Open an LP on the Earn tab - you set the range yourself, or tap another trader's LP to copy its composition." }</p>
                    </div>
                  </div>
                }
              </Box>
            }
            {
              historic == null &&
              <Box mt="6">
                <div className="card-head" style={{ margin: '0 2px 10px' }}>
                  <div className="card-title">{ settled ? 'Order history' : 'Open orders' }</div>
                  { !settled && <button className="settled-toggle" onClick={() => setSearch({ view: 'wallet-historic-orders' })}>History<Icon path={mdiArrowRight} size={0.7}></Icon></button> }
                </div>
                {
                  orders.length > 0 ?
                  <div className="wallet-list">
                    <InfiniteScroll dataLength={orders.length} hasMore={moreOrders} next={findOrders} loader={<div></div>}>
                      {
                        orders.map((item) =>
                          <Box key={item.orderId.toString()} mb="3">
                            <OrderView item={item} readOnly={readOnly}></OrderView>
                          </Box>)
                      }
                    </InfiniteScroll>
                  </div>
                  : !moreOrders &&
                  <div className="card">
                    <div className="empty">
                      <div className="art"><Icon path={mdiListBoxOutline} size={1.4}></Icon></div>
                      <h4>{ settled ? 'No order history' : 'No open orders' }</h4>
                      <p>{ settled ? 'Settled and cancelled orders will show up here.' : 'Place a limit order on the Trade tab or route a swap on the Swap tab - activity lands here.' }</p>
                    </div>
                  </div>
                }
              </Box>
            }
            {
              historic == null && (assets.length > 0 || orders.length > 0 || pools.length > 0 || delegatedPools.length > 0) &&
              <p className="tiny dim" style={{ marginTop: 16, textAlign: 'center' }}>Assets, orders and liquidity are on-chain. USD values and estimates come from the DEX indexer.</p>
            }
            {
              historic != null &&
              <Box>
                <div className="card-head" style={{ margin: '4px 2px 10px' }}>
                  <div className="card-title">{ historic == 'orders' ? 'Order history' : (historic == 'pools' ? 'Liquidity pools history' : 'Delegated liquidity history') }</div>
                  <button className="settled-toggle" onClick={() => setSearch({ view: 'wallet' })}><Icon path={mdiArrowLeft} size={0.7}></Icon>Hide</button>
                </div>
                {
                  historic == 'delegated' &&
                  <Box>
                    <div className="wallet-list">
                      <InfiniteScroll dataLength={delegatedPools.length} hasMore={moreDelegatedPools} next={findDelegatedPools} loader={<div></div>}>
                        {
                          delegatedPools.map((item) =>
                            <Box key={item.id.toString()} mb="3">
                              <DelegatedPoolView item={item} assets={assets} readOnly={readOnly}></DelegatedPoolView>
                            </Box>)
                        }
                      </InfiniteScroll>
                    </div>
                    { !loading && !delegatedPools.length && <div className="card"><div className="empty"><div className="art"><Icon path={mdiChartTimelineVariant} size={1.4}></Icon></div><h4>No delegated liquidity history</h4><p>Withdrawn vault positions will show up here.</p></div></div> }
                  </Box>
                }
                {
                  historic == 'pools' &&
                  <Box>
                    <div className="wallet-list">
                      <InfiniteScroll dataLength={pools.length} hasMore={morePools} next={findPools} loader={<div></div>}>
                        {
                          pools.map((item) =>
                            <Box key={item.poolId.toString()} mb="3">
                              <PoolView item={item} readOnly={readOnly}></PoolView>
                            </Box>)
                        }
                      </InfiniteScroll>
                    </div>
                    { !loading && !pools.length && <div className="card"><div className="empty"><div className="art"><Icon path={mdiChartTimelineVariant} size={1.4}></Icon></div><h4>No liquidity pools history</h4><p>Settled positions will show up here.</p></div></div> }
                  </Box>
                }
                {
                  historic == 'orders' &&
                  <Box>
                    <div className="wallet-list">
                      <InfiniteScroll dataLength={orders.length} hasMore={moreOrders} next={findOrders} loader={<div></div>}>
                        {
                          orders.map((item) =>
                            <Box key={item.orderId.toString()} mb="3">
                              <OrderView item={item} readOnly={readOnly}></OrderView>
                            </Box>)
                        }
                      </InfiniteScroll>
                    </div>
                    { !loading && !orders.length && <div className="card"><div className="empty"><div className="art"><Icon path={mdiListBoxOutline} size={1.4}></Icon></div><h4>No historic orders</h4><p>Settled and cancelled orders will show up here.</p></div></div> }
                  </Box>
                }
              </Box>
            }
          </Box>
        }
      </Box>
    </Box>
  );
}