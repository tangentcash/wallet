import { Avatar, Box, Button, Card, Flex, SegmentedControl, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { AccountTier, OrderCondition, OrderPolicy, OrderSide, Wormhole } from "../../core/wormhole";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mdiCurrencyUsd } from "@mdi/js";
import { AssetId, Readability } from "tangentsdk";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import { Storage } from "../../core/storage";
import PerformerButton, { Authorization } from "./performer";

class ConcentratedPool {
  static toLiquidity0(amount0: BigNumber, price: BigNumber, maxPrice: BigNumber): BigNumber {
    return amount0.multipliedBy(price).multipliedBy(maxPrice).dividedBy(BigNumber.max(0, maxPrice.minus(price))).dp(18);
  }
  static toLiquidity1(amount1: BigNumber, price: BigNumber, minPrice: BigNumber): BigNumber {
    return amount1.dividedBy(BigNumber.max(0, price.minus(minPrice))).dp(18);
  }
  static toAmount0(liquidity: BigNumber, price: BigNumber, maxPrice: BigNumber): BigNumber {
    return liquidity.multipliedBy(BigNumber.max(0, maxPrice.minus(price)).dividedBy(price).dividedBy(maxPrice)).dp(18);
  }
  static toAmount1(liquidity: BigNumber, price: BigNumber, minPrice: BigNumber): BigNumber {
    return liquidity.multipliedBy(BigNumber.max(0, price.minus(minPrice))).dp(18);
  }
}

function toValue(prevValue: string, nextValue: string): string {
  try {
    if (!nextValue.length)
      return nextValue;

    let value = nextValue.trim();
    if (value.endsWith('.'))
      value += '0';

    const numeric = new BigNumber(value, 10);
    if (numeric.isLessThan(0) || numeric.isNaN() || !numeric.isFinite())
      throw false;

    return nextValue;
  } catch {
    return prevValue;
  }
}
function toValueOrPercent(prevValue: string, nextValue: string): string {
  if (nextValue.indexOf('%') == -1)
    return toValue(prevValue, nextValue);
  
  return toValue(prevValue.replace(/%/g, ''), nextValue.replace(/%/g, '')) + '%';
}
function toPercent(prevValue: string, nextValue: string): string {
  if (!nextValue.length)
    return '';

  return toValue(prevValue.replace(/%/g, ''), nextValue.replace(/%/g, '')) + '%';
}
function toNumericValue(value: string): BigNumber {
  return new BigNumber(value.length > 0 ? value.replace(/%/g, '') : 0);
}
function toNumericValueOrPercent(value: string): { relative: BigNumber | null, absolute: BigNumber | null, value: BigNumber } {
  const isAbsolute = value.indexOf('%') == -1;
  const result = isAbsolute ? toNumericValue(value) : toNumericValue(value).dividedBy(100);
  return {
    relative: isAbsolute ? null : result,
    absolute: isAbsolute ? result : null,
    value: result
  }
}

const defaultState = {
  condition: OrderCondition.Market,
  side: OrderSide.Buy,
  fillOrKill: false,
  stopPrice: '',
  price: '',
  basePrice: '',
  minPrice: '',
  maxPrice: '',
  slippage: '1%',
  trailingStep: '',
  trailingDistance: '',
  primaryValue: '',
  secondaryValue: '',
  value: '',
  feeRate: '0.15%',
  pool: false
};

export default function Maker(props: {
  path?: string,
  marketId: BigNumber,
  pairId: BigNumber,
  primaryAsset: AssetId,
  primaryBalance: BigNumber,
  secondaryAsset: AssetId,
  secondaryBalance: BigNumber,
  tiers?: AccountTier,
  preset?: ({ id: number } & Partial<typeof defaultState>) | null
}) {
  const [presetId, setPresetId] = useState<number>(0);
  const [state, setState] = useState(defaultState);
  const isImmediate = useMemo((): boolean => {
    return state.condition == OrderCondition.Market || state.condition == OrderCondition.Stop || state.condition == OrderCondition.TrailingStop;
  }, [state.condition]);
  const isTrailing = useMemo((): boolean => {
    return state.condition == OrderCondition.TrailingStop || state.condition == OrderCondition.TrailingStopLimit;
  }, [state.condition]);
  const hasStopPrice = useMemo((): boolean => {
    return state.condition == OrderCondition.Stop || state.condition == OrderCondition.StopLimit || state.condition == OrderCondition.TrailingStop || state.condition == OrderCondition.TrailingStopLimit;
  }, [state.condition]);
  const hasPrice = useMemo((): boolean => {
    return state.condition == OrderCondition.Limit || state.condition == OrderCondition.StopLimit || state.condition == OrderCondition.TrailingStopLimit;
  }, [state]);
  const hasSlippage = useMemo((): boolean => {
    return state.condition == OrderCondition.Market || state.condition == OrderCondition.Stop || state.condition == OrderCondition.TrailingStop;
  }, [state.condition]);
  const valueAsset = useMemo((): AssetId => {
    return state.side == OrderSide.Buy ? props.secondaryAsset : props.primaryAsset;
  }, [props, state.side]);
  const valueBalance = useMemo((): BigNumber => {
    return state.side == OrderSide.Buy ? props.secondaryBalance : props.primaryBalance;
  }, [props, state.side]);
  const bestPrice = useMemo((): BigNumber => {
    if (hasPrice)
      return new BigNumber(state.price)
    else if (hasStopPrice)
      return new BigNumber(state.stopPrice);

    return Wormhole.priceOf(props.primaryAsset, props.secondaryAsset).close || new BigNumber(0);
  }, [props, state.price, state.stopPrice, hasPrice, hasStopPrice]);
  const policy = useMemo((): OrderPolicy => {
    if (isImmediate) {
      return state.fillOrKill ? OrderPolicy.DeferredAll : OrderPolicy.Deferred;
    } else {
      return state.fillOrKill ? OrderPolicy.ImmediateAll : OrderPolicy.Immediate;
    }
  }, [state.fillOrKill, isImmediate]);
  const orderPayload = useMemo((): {
    marketId: string,
    primaryAssetHash: string,
    secondaryAssetHash: string,
    condition: OrderCondition,
    policy: OrderPolicy,
    side: OrderSide,
    stopPrice?: string,
    price?: string,
    slippage?: string,
    trailingStep?: string,
    trailingDistance?: string,
    value: string
  } | null => {
    if (state.pool)
      return null;

    const finalValueQuantity = toNumericValueOrPercent(state.value);
    if (!finalValueQuantity.value.gt(0))
      return null;

    const finalValue = finalValueQuantity.relative ? valueBalance.multipliedBy(finalValueQuantity.relative) : finalValueQuantity.value;
    if (!finalValue.gt(0) || finalValue.gt(valueBalance))
      return null;

    switch (state.condition) {
      case OrderCondition.Market: {
        const finalSlippage = toNumericValueOrPercent(state.slippage);
        if (!finalSlippage.value.gte(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          slippage: finalSlippage.relative ? finalSlippage.relative.negated().toString() : finalSlippage.value.toString(),
          value: finalValue.toString()
        };
      }
      case OrderCondition.Limit: {
        const finalPrice = toNumericValue(state.price);
        if (!finalPrice.gt(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          price: finalPrice.toString(),
          value: finalValue.toString()
        }
      }
      case OrderCondition.Stop: {
        const finalSlippage = toNumericValueOrPercent(state.slippage);
        if (!finalSlippage.value.gte(0))
          return null;

        const finalStopPrice = toNumericValue(state.stopPrice);
        if (!finalStopPrice.gt(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          stopPrice: finalStopPrice.toString(),
          slippage: finalSlippage.relative ? finalSlippage.relative.negated().toString() : finalSlippage.value.toString(),
          value: finalValue.toString()
        };
      }
      case OrderCondition.StopLimit: {
        const finalPrice = toNumericValue(state.price);
        if (!finalPrice.gt(0))
          return null;

        const finalStopPrice = toNumericValue(state.stopPrice);
        if (!finalStopPrice.gt(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          stopPrice: finalStopPrice.toString(),
          price: finalPrice.toString(),
          value: finalValue.toString()
        };
      }
      case OrderCondition.TrailingStop: {
        const finalSlippage = toNumericValueOrPercent(state.slippage);
        if (!finalSlippage.value.gte(0))
          return null;

        const finalStopPrice = toNumericValue(state.stopPrice);
        if (!finalStopPrice.gt(0))
          return null;

        const finalTrailingStep = toNumericValueOrPercent(state.trailingStep);
        if (!finalTrailingStep.value.gt(0))
          return null;
        
        const finalTrailingDistance = toNumericValueOrPercent(state.trailingDistance);
        if (!finalTrailingDistance.value.gte(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          stopPrice: finalStopPrice.toString(),
          slippage: finalSlippage.relative ? finalSlippage.relative.negated().toString() : finalSlippage.value.toString(),
          trailingStep: finalTrailingStep.value.toString(),
          trailingDistance: finalTrailingDistance.value.toString(),
          value: finalValue.toString()
        };
      }
      case OrderCondition.TrailingStopLimit: {
        const finalPrice = new BigNumber(state.price);
        if (!finalPrice.gt(0))
          return null;

        const finalStopPrice = new BigNumber(state.stopPrice);
        if (!finalStopPrice.gt(0))
          return null;

        const finalTrailingStep = toNumericValueOrPercent(state.trailingStep);
        if (!finalTrailingStep.value.gt(0))
          return null;
        
        const finalTrailingDistance = toNumericValueOrPercent(state.trailingDistance);
        if (!finalTrailingDistance.value.gte(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          stopPrice: finalStopPrice.toString(),
          price: finalPrice.toString(),
          trailingStep: finalTrailingStep.value.toString(),
          trailingDistance: finalTrailingDistance.value.toString(),
          value: finalValue.toString()
        };
      }
      default:
        return null;
    }
  }, [props.marketId, props.primaryAsset, props.secondaryAsset, state, policy, valueBalance]);
  const poolPayload = useMemo((): {
    marketId?: string,
    primaryAssetHash: string,
    secondaryAssetHash: string,
    primaryValue: string,
    secondaryValue: string,
    price: string,
    minPrice?: string;
    maxPrice?: string;
    feeRate: string;
  } | null => {
    if (!state.pool)
      return null;

    const price = toNumericValue(state.basePrice);
    if (!price.gt(0))
      return null;

    const minPrice = toNumericValue(state.minPrice), maxPrice = toNumericValue(state.maxPrice);
    const withPriceRange = minPrice.gt(0) && maxPrice.gt(0);
    if (withPriceRange && (minPrice.gte(price) || maxPrice.lte(price) || minPrice.gte(maxPrice)))
      return null;

    const primary = toNumericValueOrPercent(state.primaryValue), secondary = toNumericValueOrPercent(state.secondaryValue);
    primary.value = primary.relative ? primary.value.multipliedBy(props.primaryBalance) : primary.value;
    secondary.value = secondary.relative ? secondary.value.multipliedBy(props.secondaryBalance) : secondary.value;
    if (!primary.value.gt(0) || !secondary.value.gt(0))
      return null;

    if (primary.value.gt(props.primaryBalance) || secondary.value.gt(props.secondaryBalance))
      return null;

    const feeRate = toNumericValueOrPercent(state.feeRate);
    if (feeRate.absolute || feeRate.value.lt(0) || feeRate.value.gt(1))
      return null;
    
    return {
      marketId: props.marketId.toString(),
      primaryAssetHash: props.primaryAsset.id,
      secondaryAssetHash: props.secondaryAsset.id,
      primaryValue: primary.value.toString(),
      secondaryValue: secondary.value.toString(),
      price: price.toString(),
      minPrice: withPriceRange ? minPrice.toString() : undefined,
      maxPrice: withPriceRange ? maxPrice.toString() : undefined,
      feeRate: feeRate.value.toString()
    };
  }, [props.marketId, props.primaryAsset, props.secondaryAsset, props.primaryBalance, props.secondaryBalance, state]);
  const fee = useMemo(() => {
    const min = (state.side == OrderSide.Buy ? props.tiers?.secondary?.makerFee : props.tiers?.primary?.makerFee) || new BigNumber(0);
    const finalSlippage = hasSlippage ? toNumericValueOrPercent(state.slippage) : null;
    return {
      relativePrice: finalSlippage?.relative || new BigNumber(0),
      absolutePrice: finalSlippage?.absolute || new BigNumber(0),
      min: min,
      max: (state.side == OrderSide.Buy ? props.tiers?.secondary?.takerFee : props.tiers?.primary?.takerFee) || new BigNumber(0),
    }
  }, [props, state.side, state.slippage, hasSlippage]);
  const concentrated = useMemo(() => {
    const minPrice = toNumericValue(state.minPrice), maxPrice = toNumericValue(state.maxPrice);
    return minPrice.isGreaterThan(0) && maxPrice.isGreaterThan(0) && minPrice.isLessThan(maxPrice);
  }, [state.minPrice, state.maxPrice]);
  const updateState = useCallback((change: (prev: typeof defaultState) => typeof defaultState) => {
    setState(prev => {
      const result = change(prev);
      if (props.path != null)
        Storage.set(props.path, result);
      return result;
    });
  }, [props.path]);
  const setPrimaryValue = useCallback((newPrimaryValue: string): void => {
    const primaryValue = toValueOrPercent(state.primaryValue, newPrimaryValue);
    const price = toNumericValue(state.basePrice);
    if (price.gt(0)) {
      const primary = toNumericValueOrPercent(primaryValue);
      primary.value = primary.relative ? primary.value.multipliedBy(props.primaryBalance) : primary.value;
      if (primary.value.gt(0)) {
        primary.value = primary.value.multipliedBy(1 - 0.001);
        if (concentrated) {
          if (primary.value.gt(0)) {
            const sqrtPrice = new BigNumber(Math.sqrt(price.toNumber()));
            const sqrtMinPrice = new BigNumber(Math.sqrt(toNumericValue(state.minPrice).toNumber()));
            const sqrtMaxPrice = new BigNumber(Math.sqrt(toNumericValue(state.maxPrice).toNumber()));
            const liquidity = ConcentratedPool.toLiquidity0(primary.value, sqrtPrice, sqrtMaxPrice);
            const secondary = ConcentratedPool.toAmount1(liquidity, sqrtPrice, sqrtMinPrice);
            return updateState((prev) => ({ ...prev, primaryValue: primaryValue, secondaryValue: secondary.toString() }));
          }
        } else {
          return updateState((prev) => ({ ...prev, primaryValue: primaryValue, secondaryValue: price.multipliedBy(primary.value).toString() }));
        }
      }
    }
    updateState((prev) => ({ ...prev, primaryValue: primaryValue }));
  }, [props.primaryBalance, state.primaryValue, state.basePrice, state.minPrice, state.maxPrice, concentrated]);
  const setSecondaryValue = useCallback((newSecondaryValue: string): void => {
    const secondaryValue = toValueOrPercent(state.secondaryValue, newSecondaryValue);
    const price = toNumericValue(state.basePrice);
    if (price.gt(0)) {
      const secondary = toNumericValueOrPercent(secondaryValue);
      secondary.value = secondary.relative ? secondary.value.multipliedBy(props.secondaryBalance) : secondary.value;
      if (secondary.value.gt(0)) {
        secondary.value = secondary.value.multipliedBy(1 - 0.001);
        if (concentrated) {
          if (secondary.value.gt(0)) {
            const sqrtPrice = new BigNumber(Math.sqrt(price.toNumber()));
            const sqrtMinPrice = new BigNumber(Math.sqrt(toNumericValue(state.minPrice).toNumber()));
            const sqrtMaxPrice = new BigNumber(Math.sqrt(toNumericValue(state.maxPrice).toNumber()));
            const liquidity = ConcentratedPool.toLiquidity1(secondary.value, sqrtPrice, sqrtMinPrice);
            const primary = ConcentratedPool.toAmount0(liquidity, sqrtPrice, sqrtMaxPrice);
            return updateState((prev) => ({ ...prev, primaryValue: primary.toString(), secondaryValue: secondaryValue }));
          }
        } else {
          return updateState((prev) => ({ ...prev, primaryValue: price.dividedBy(secondary.value).toString(), secondaryValue: secondaryValue }));
        }
      }
    }
    updateState((prev) => ({ ...prev, secondaryValue: secondaryValue }));
  }, [props.secondaryBalance, state.secondaryValue, state.basePrice, state.minPrice, state.maxPrice, concentrated]);
  useEffect(() => {
    if (props.preset != null && presetId < props.preset.id) {
      setPresetId(props.preset.id);
      updateState(_ => ({
        condition: props.preset?.condition || OrderCondition.Market,
        side: props.preset?.side || OrderSide.Buy,
        fillOrKill: props.preset?.fillOrKill || false,
        stopPrice: props.preset?.stopPrice || '',
        price: props.preset?.price || '',
        basePrice: props.preset?.basePrice || '',
        minPrice: props.preset?.minPrice || '',
        maxPrice: props.preset?.maxPrice || '',
        slippage: props.preset?.slippage || '1%',
        trailingStep: props.preset?.trailingStep || '',
        trailingDistance: props.preset?.trailingDistance || '',
        primaryValue: props.preset?.primaryValue || '',
        secondaryValue: props.preset?.secondaryValue || '',
        value: props.preset?.value || '',
        feeRate: props.preset?.feeRate || '',
        pool: props.preset?.pool || false
      }));
    } else if (props.path != null) {
      const memorizedState = Storage.get(props.path);
      if (memorizedState != null && typeof memorizedState == 'object') {
        setState(prev => ({ ...prev, ...memorizedState }));
      }
    }
  }, [props.path, presetId, updateState]);
  useEffect(() => {
    if (state.pool) {
      updateState(prev => ({ ...prev, basePrice: Wormhole.priceOf(props.primaryAsset, props.secondaryAsset).close?.toString() || '' }));
    }
  }, [state.pool, updateState]);
  useEffect(() => {
  }, [props.primaryBalance, props.secondaryBalance, state.basePrice, state.primaryValue, state.secondaryValue, concentrated]);

  const makeOrder = () => (
    <Box>
      <Box mb="4">
        <Button variant="surface" color={state.side == OrderSide.Buy ? 'jade' : 'red'} style={{ display: 'block', height: 'auto', width: '100%', borderRadius: '24px' }} onClick={() => updateState(prev => ({ ...prev, value: valueBalance.toString() }))}>
          <Flex align="center" gap="2" px="2" py="3">
            <Avatar size="2" fallback={Readability.toAssetFallback(valueAsset)} src={Readability.toAssetImage(valueAsset)} style={{ width: '40px', height: '40px' }} />
            <Box>
              <Text align="left" style={{ display: 'block' }}>{ Readability.toAssetName(valueAsset) }</Text>
              <Text align="left" weight="bold" size="3" style={{ display: 'block' }}>{ Readability.toMoney(valueAsset, valueBalance) }</Text>
            </Box>
          </Flex>
        </Button>
      </Box>
      <Box mb="2">
        <Select.Root value={state.condition.toString()} onValueChange={(e) => updateState(prev => ({ ...prev, condition: parseInt(e) }))}>
          <Tooltip content="Order matching style">
            <Select.Trigger style={{ width: '100%' }} />
          </Tooltip>
          <Select.Content>
            <Select.Group>
              <Select.Label>Execution type</Select.Label>
              <Select.Item value={OrderCondition.Market.toString()}>Market order</Select.Item>
              <Select.Item value={OrderCondition.Limit.toString()}>Limit order</Select.Item>
              <Select.Item value={OrderCondition.Stop.toString()}>Stop order</Select.Item>
              <Select.Item value={OrderCondition.StopLimit.toString()}>Stop-limit order</Select.Item>
              <Select.Item value={OrderCondition.TrailingStop.toString()}>Trailing-stop order</Select.Item>
              <Select.Item value={OrderCondition.TrailingStopLimit.toString()}>Trailing-stop-limit order</Select.Item>
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </Box>
      <Box mb="2">
          <Select.Root value={state.fillOrKill ? '1' : '0'} onValueChange={(e) => updateState(prev => ({ ...prev, fillOrKill: parseInt(e) > 0 }))}>
            <Tooltip content={`Fill completely/partially${isImmediate ? ' and cancel leftovers' : ''} or fill ${ isImmediate ? 'completely and cancel if not possible to do so' : 'only completely'}`}>
              <Select.Trigger style={{ width: '100%' }}>
              </Select.Trigger>
            </Tooltip>
            <Select.Content>
              <Select.Group>
                <Select.Label>Fill type</Select.Label>
                <Select.Item value="0">May partially fill</Select.Item>
                <Select.Item value="1">Complete fill only</Select.Item>
              </Select.Group>
            </Select.Content>
          </Select.Root>
      </Box>
      {
        hasStopPrice &&
        <Box mb="2">
          <Tooltip content={`${state.side == OrderSide.Buy ? 'Minimal' : 'Maximal'} ${isTrailing ? 'initial ' : ''}price to replace the ${isTrailing ? 'trailing stop' : 'stop'} order with ${isImmediate ? 'market' : 'limit'} order`}>
            <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' stop price'} size="2" value={state.stopPrice} onChange={(e) => updateState(prev => ({ ...prev, stopPrice: toValue(prev.stopPrice, e.target.value) }))}>
              <TextField.Slot>
                <Icon path={mdiCurrencyUsd} size={0.8} />
              </TextField.Slot>
            </TextField.Root>
          </Tooltip>
        </Box>
      }
      {
        hasPrice &&
        <Box mb="2">
          <Tooltip content={`Match ${state.side == OrderSide.Buy ? 'selling' : 'buying'} orders with price ${state.side == OrderSide.Buy ? 'lower' : 'higher'} than or equal to ${state.price.length > 0 ? Readability.toMoney(props.secondaryAsset, state.price) : 'selected'}`}>
            <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' price'} size="2" value={state.price} onChange={(e) => updateState(prev => ({ ...prev, price: toValue(prev.price, e.target.value) }))}>
              <TextField.Slot>
                <Icon path={mdiCurrencyUsd} size={0.8} />
              </TextField.Slot>
            </TextField.Root>
          </Tooltip>
        </Box>
      }
      {
        isTrailing &&
        <>
          <Box mb="2">
            <Tooltip content={`Minimal price ${state.side == OrderSide.Buy ? 'fall' : 'rise'} to trigger stop price change`}>
              <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' step or %'} size="2" value={state.trailingStep} onChange={(e) => updateState(prev => ({ ...prev, trailingStep: toValueOrPercent(prev.trailingStep, e.target.value) }))}>
                <TextField.Slot>
                  <Icon path={mdiCurrencyUsd} size={0.8} />
                </TextField.Slot>
              </TextField.Root>
            </Tooltip>
          </Box>
          <Box mb="2">
            <Tooltip content={`Stop price distance ${state.side == OrderSide.Buy ? 'above' : 'below'} market price`}>
              <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' distance or %'} size="2" value={state.trailingDistance} onChange={(e) => updateState(prev => ({ ...prev, trailingDistance: toValueOrPercent(prev.trailingDistance, e.target.value) }))}>
                <TextField.Slot>
                  <Icon path={mdiCurrencyUsd} size={0.8} />
                </TextField.Slot>
              </TextField.Root>
            </Tooltip>
          </Box>
        </>
      }
      {
        hasSlippage &&
        <Box mb="2">
          <Tooltip content={`Maximal unfavorable deviation from best price`}>
            <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' slippage or %'} size="2" value={state.slippage} onChange={(e) => updateState(prev => ({ ...prev, slippage: toValueOrPercent(prev.slippage, e.target.value) }))}>
              <TextField.Slot>
                <Icon path={mdiCurrencyUsd} size={0.8} />
              </TextField.Slot>
            </TextField.Root>
          </Tooltip>
        </Box>
      }
      <Box mb="2">
        <Tooltip content={`Receive ~${state.side == OrderSide.Buy ? Readability.toMoney(props.primaryAsset, (bestPrice.gt(0) ? new BigNumber(state.value).dividedBy(bestPrice) : new BigNumber(0))) : Readability.toMoney(props.secondaryAsset, bestPrice.multipliedBy(new BigNumber(state.value)))} excluding fees and slippage`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(valueAsset) + ' quantity or %'} size="2" value={state.value} onChange={(e) => updateState(prev => ({ ...prev, value: toValueOrPercent(prev.value, e.target.value) }))}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      {
        props.tiers != null &&
        <Box mb="5" px="2">
          <Flex justify="between">
            <Text size="1" color="gray">Account impact</Text>
            <Text size="1" color="gray">{ Readability.toMoney(state.side == OrderSide.Buy ? props.secondaryAsset : props.primaryAsset, state.side == OrderSide.Buy ? props.tiers.secondary.volume : props.tiers.primary.volume) }</Text>
          </Flex>
          <Flex justify="between">
            <Text size="1" color="gray">Receive minimum</Text>
            <Text size="1" color="gray">~{ state.side == OrderSide.Buy ? Readability.toMoney(props.primaryAsset, (bestPrice.gt(0) ? new BigNumber(state.value).dividedBy(bestPrice.multipliedBy(new BigNumber(1).plus(fee.relativePrice)).plus(fee.absolutePrice)).multipliedBy(new BigNumber(1).minus(fee.max)) : new BigNumber(0)).multipliedBy(new BigNumber(1).minus(fee.max))) : Readability.toMoney(props.secondaryAsset, bestPrice.multipliedBy(new BigNumber(1).minus(fee.relativePrice)).plus(fee.absolutePrice).multipliedBy(new BigNumber(state.value)).multipliedBy(new BigNumber(1).minus(fee.max))) }</Text>
          </Flex>
          <Flex justify="between">
            <Text size="1" color="gray">Exchange fee</Text>
            <Text size="1" color="gray">{ fee.min.multipliedBy(100).toFixed(2) }% — { fee.max.multipliedBy(100).toFixed(2) }%</Text>
          </Flex>
        </Box>
      }
      <Box>
        <PerformerButton title="Place order" color={state.side == OrderSide.Buy ? 'jade' : 'red'} style={{ width: '100%' }} type={Authorization.OrderCreation} disabled={orderPayload == null} onData={() => {
          return orderPayload as Record<string, any>;
        }}></PerformerButton>
      </Box>
    </Box>
  );
  const makePool = () => (
    <Box>
      <Box mb="4">
        <Button variant="surface" style={{ display: 'block', height: 'auto', width: '100%', borderRadius: '24px' }}>
          <Flex align="center" gap="2" px="2" py="3">
            <Box style={{ position: 'relative' }}>
              <Avatar size="2" fallback={Readability.toAssetFallback(props.secondaryAsset)} src={Readability.toAssetImage(props.secondaryAsset)} style={{ position: 'absolute', top: '20px', left: '-6px', width: '26px', height: '26px' }} />
              <Avatar size="2" fallback={Readability.toAssetFallback(props.primaryAsset)} src={Readability.toAssetImage(props.primaryAsset)} style={{ width: '40px', height: '40px' }} />
            </Box>
            <Box>
              <Text align="left" weight="bold" size="3" style={{ display: 'block' }}>{ Readability.toMoney(props.primaryAsset, props.primaryBalance) }</Text>
              <Text align="left" style={{ display: 'block' }}>{ Readability.toMoney(props.secondaryAsset, props.secondaryBalance) }</Text>
            </Box>
          </Flex>
        </Button>
      </Box>
      <Box mb="2">
        <Tooltip content={`Min pool price equal to ${state.minPrice.length > 0 ? Readability.toMoney(props.secondaryAsset, state.minPrice) : 'selected'} which will concentrate liquidity at prices above selected`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' min price or none'} size="2" value={state.minPrice} onChange={(e) => updateState(prev => ({ ...prev, minPrice: toValue(prev.minPrice, e.target.value), primaryValue: '', secondaryValue: '' }))}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box mb="2">
        <Tooltip content={`Starting price equal to ${state.basePrice.length > 0 ? Readability.toMoney(props.secondaryAsset, state.basePrice) : 'selected'} that will gradually adjust to market price as trades are made`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' price'} size="2" value={state.basePrice} onChange={(e) => updateState(prev => ({ ...prev, basePrice: toValue(prev.basePrice, e.target.value), primaryValue: '', secondaryValue: '' }))}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box mb="2">
        <Tooltip content={`Max pool price equal to ${state.maxPrice.length > 0 ? Readability.toMoney(props.secondaryAsset, state.maxPrice) : 'selected'} which will concentrate liquidity at prices below selected`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' max price or none'} size="2" value={state.maxPrice} onChange={(e) => updateState(prev => ({ ...prev, maxPrice: toValue(prev.maxPrice, e.target.value), primaryValue: '', secondaryValue: '' }))}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box mb="2">
        <Tooltip content={`Initial ${Readability.toAssetSymbol(props.primaryAsset)} reserve equal to ${Readability.toMoney(props.primaryAsset, state.primaryValue)} and will adjust as trades are made`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.primaryAsset) + ' reserve or %'} size="2" value={state.primaryValue} onChange={(e) => setPrimaryValue(e.target.value)}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box mb="2">
        <Tooltip content={`Initial ${Readability.toAssetSymbol(props.secondaryAsset)} reserve equal to ${Readability.toMoney(props.secondaryAsset, state.secondaryValue)} and will adjust as trades are made`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' reserve or %'} size="2" value={state.secondaryValue} onChange={(e) => setSecondaryValue(e.target.value)}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box mb="2">
        <Tooltip content={`Pool fee equal to ${state.feeRate ? state.feeRate : 'N/A'} and taken from each trade with this pool`}>
          <TextField.Root placeholder={'Wormhole fee %'} size="2" value={state.feeRate} onChange={(e) => updateState(prev => ({ ...prev, feeRate: toPercent(prev.feeRate, e.target.value) }))}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box>
        <PerformerButton title="Create pool" style={{ width: '100%' }} type={Authorization.PoolCreation} disabled={poolPayload == null} onData={() => {
          return poolPayload as Record<string, any>;
        }}></PerformerButton>
      </Box>
    </Box>
  );
  return (
    <Box>
      <Card>
        <Box mb="2">
          <SegmentedControl.Root size="2" style={{ width: '100%' }} value={state.pool ? 'pool' : state.side.toString()} onValueChange={(e) => updateState(prev => ({ ...prev, side: e == 'pool' ? prev.side : parseInt(e), pool: e == 'pool' }))}>
            <SegmentedControl.Item value={OrderSide.Buy.toString()}>Buy</SegmentedControl.Item>
            <SegmentedControl.Item value={OrderSide.Sell.toString()}>Sell</SegmentedControl.Item>
            <SegmentedControl.Item value="pool">Pool</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Box>
        { state.pool ? makePool() : makeOrder() }
      </Card>
    </Box>
  );
}