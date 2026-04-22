import { Badge, Box, Button, Card, Dialog, Flex, Select, Slider, Spinner, Switch, Text, TextField, Tooltip } from "@radix-ui/themes";
import { mdiArrowRight, mdiChevronDoubleRight, mdiCog, mdiPercent, mdiSwapVertical } from "@mdi/js";
import { Balance, Exchange, Market, OrderSide, RouterPath } from "../../core/exchange";
import { AssetId, ByteUtil, Readability, TextUtil } from "tangentsdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AssetImage, AssetName } from "../asset";
import { Storage } from "../../core/storage";
import { Builder, PerformerButton } from "./performer";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import AssetSelector from "./selector";
import { useEffectAsync } from "../../core/react";
import { AlertBox, AlertType } from "../alert";

type SwapState = {
  tokenIn: AssetId | null,
  tokenOut: AssetId | null,
  amountIn: string,
  amountOut: string,
  slippage: string
};

let swapPathTimeoutId: number | null = null;

export default function SwapMaker(props: {
  assets: Balance[],
  market: Market | null,
  onMarketChange: (e: Market | null) => any
}) {
  const market = props.market;
  const assets = props.assets;
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
      Storage.set('__portfolio_swap__', {
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
    if (!market || !state.tokenIn) {
      setPolyAssets([]);
      return;
    }

    setLoadingPoly(true);
    try {
      setPolyAssets(await Exchange.marketAssets(market.id, state.tokenIn));
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch poly assets: ' + (exception as Error).message);
      setPolyAssets([]);
    }
    setLoadingPoly(false);
  }, [market, state.tokenIn]);
  useEffect(() => {
    if (swapPathTimeoutId != null) {
      clearTimeout(swapPathTimeoutId);
      setLoadingPath(false);
    }

    const tokenIn = state.tokenIn, tokenOut = state.tokenOut;
    if (market != null && tokenIn != null && tokenOut != null) {
      const balanceIn = assets.find((x) => x.asset.id == tokenIn.id)?.available || new BigNumber(0);
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
  useEffect(() => {
    const prev = Storage.get('__portfolio_swap__');
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
                <Select.Root value={market ? market.id.toString() : ''} onValueChange={(e) => props.onMarketChange(Exchange.contracts.find((v) => v.id.toString() == e) || null)} size="2">
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
            <Button variant="soft" size="4" style={{ backgroundColor: 'var(--color-background)' }}>
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
                  <AssetName asset={state.tokenIn} symbol={true} tokenOnly={true} size="4" badgeOffset={0.1}></AssetName>
                </Flex>
              }
              {
                state.tokenIn == null &&
                <Text size="4">Token ↗</Text>
              }
            </Button>
          </AssetSelector>
        </Flex>
        <Flex align="center" gap="2" px="2" mt="2">
          <Slider variant="soft" color={swapInfo.balanceIn.gte(swapInfo.amountIn) ? undefined : 'red'} step={5} size="3" value={[swapInfo.balanceIn.gt(0) ? Math.min(100, Math.max(0, swapInfo.amountIn.dividedBy(swapInfo.balanceIn).multipliedBy(100).toNumber())) : 0]} onValueChange={(e) => setAmount('amount-in', ByteUtil.bigNumberToString(swapInfo.balanceIn.multipliedBy(e[0] / 100)))} />
          <Badge size="1" color={swapInfo.balanceIn.gte(swapInfo.amountIn) ? undefined : 'red'}>{ (swapInfo.balanceIn.gt(0) ? Math.min(100, Math.max(0, swapInfo.amountIn.dividedBy(swapInfo.balanceIn).multipliedBy(100).toNumber())) : 0).toFixed(2) }%{ swapInfo.balanceIn.lt(swapInfo.amountIn) ? '+' : '' }</Badge>
        </Flex>
        <Flex justify="between" px="3" mt="2" mb="1">
          <Text size="2" color="gray">{ Readability.toMoney(Exchange.equityAsset, swapInfo.valuationIn) }</Text>
          <Flex align="center" gap="1">
            { loadingPoly && <Spinner size="1"></Spinner> }
            <Text size="2" color="gray">{ Readability.toMoney(state.tokenIn, swapInfo.balanceIn) }</Text>
          </Flex>
        </Flex>
      </Card>
      <Box mt="2" position="relative">
        <Card variant="surface" style={{ borderRadius: '28px', position: 'relative' }}>
          <Flex justify="between" align="center" px="3" mb="2">
            <Text color="gray" size="2">Receiving ↙</Text>
            { loadingPath && <Spinner size="3"></Spinner> }
          </Flex>
          <Flex justify="between" align="center">
            <TextField.Root style={{ width: '100%', backgroundColor: 'var(--color-background)' }} size="3" placeholder="Amount in" type="text" value={state.amountOut} onChange={(e) => setAmount('amount-out', e.target.value)} />
            <AssetSelector title="token to buy" value={state.tokenOut} onChange={(value) => updateState(prev => ({ ...prev, tokenOut: value }))}>
              <Button variant="soft" size="4" style={{ backgroundColor: 'var(--color-background)' }}>
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
                    <AssetName asset={state.tokenOut} symbol={true} tokenOnly={true} size="4" badgeOffset={0.1}></AssetName>
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
        <Flex justify="center" px="3" py="3" align="center" position="absolute" className="rt-Card" style={{ backgroundColor: 'var(--gray-6)', border: '6px solid var(--color-background)', borderRadius: '16px', top: '-32px', left: '50%', transform: 'translateX(-50%)' }}>
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
      {
        bestPaths.map((path: RouterPath, pathIndex: number) => {
          const last = path[path.length - 1];
          const type = convervative ? 'min' : 'max';
          const amountIn = swapInfo.priceIn?.gt(0) && swapInfo.amountIn.gt(0) ? swapInfo.amountIn.multipliedBy(swapInfo.priceIn) : null;
          const amountOut = swapInfo.priceOut?.gt(0) && last.output[type].gt(0) ? last.output[type].multipliedBy(swapInfo.priceOut) : null;
          return (
            <Card key={'swap_path_' + pathIndex} mt="2" style={{ borderRadius: '28px' }}>
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
                    let leftover = new BigNumber(swapInfo.amountIn);
                    const pays: Record<string, string> = { };
                    for (let i = 0; i < assetsIn.length; i++) {
                      const balance = assetsIn[i];
                      const change = BigNumber.min(balance.available, leftover);
                      leftover = leftover.minus(change);
                      pays[balance.asset.id] = ByteUtil.bigNumberToString(change);
                      if (!leftover.gt(0))
                        break;
                    }
                  
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