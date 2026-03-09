import { Box, Button, Card, Flex, SegmentedControl, Select, Spinner, Text, TextField, Tooltip } from "@radix-ui/themes";
import { AccountTier, Balance, OrderCondition, OrderPolicy, OrderSide } from "../../core/exchange";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mdiCurrencyUsd } from "@mdi/js";
import { AssetId, ByteUtil, Readability, TextUtil } from "tangentsdk";
import { AssetImage, AssetName } from "../asset";
import { Storage } from "../../core/storage";
import { PerformerButton, Builder } from "./performer";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

export class PoolFormula {
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

export class LiquidityPool {
  static toPrimaryValue(secondaryValue: BigNumber, price: BigNumber, minPrice: BigNumber | null, maxPrice: BigNumber | null): BigNumber | null {
    if (!secondaryValue.gt(0))
      return null;

    if (minPrice?.gt(0) && maxPrice?.gt(0)) {
      const sqrtPrice = price.sqrt();
      const sqrtMinPrice = minPrice.sqrt();
      const sqrtMaxPrice = maxPrice.sqrt();
      const liquidity = PoolFormula.toLiquidity1(secondaryValue, sqrtPrice, sqrtMinPrice);
      return PoolFormula.toAmount0(liquidity, sqrtPrice, sqrtMaxPrice);
    } else {
      return secondaryValue.dividedBy(price);
    }
  }
  static toSecondaryValue(primaryValue: BigNumber, price: BigNumber, minPrice: BigNumber | null, maxPrice: BigNumber | null): BigNumber | null { 
    if (!primaryValue.gt(0))
      return null;

    if (minPrice?.gt(0) && maxPrice?.gt(0)) {
      const sqrtPrice = price.sqrt();
      const sqrtMinPrice = minPrice.sqrt();
      const sqrtMaxPrice = maxPrice.sqrt();
      const liquidity = PoolFormula.toLiquidity0(primaryValue, sqrtPrice, sqrtMaxPrice);
      return PoolFormula.toAmount1(liquidity, sqrtPrice, sqrtMinPrice);
    } else {
      return price.multipliedBy(primaryValue);
    }
  }
}

export type MakerState = {
  condition: OrderCondition,
  side: OrderSide,
  fillOrKill: boolean,
  stopPrice: string,
  price: string,
  basePrice: string,
  rangePrice: string,
  slippage: string,
  trailingStep: string,
  trailingDistance: string,
  primaryValue: string,
  secondaryValue: string,
  value: string,
  feeRate: string,
  pool: boolean
};

const defaultState: MakerState = {
  condition: OrderCondition.Market,
  side: OrderSide.Buy,
  fillOrKill: false,
  stopPrice: '',
  price: '',
  basePrice: '',
  rangePrice: '',
  slippage: '1%',
  trailingStep: '',
  trailingDistance: '',
  primaryValue: '',
  secondaryValue: '',
  value: '',
  feeRate: '0.15%',
  pool: false
};

export function Maker(props: {
  path?: string,
  marketId: BigNumber,
  pairId: BigNumber,
  primaryAsset: AssetId,
  secondaryAsset: AssetId,
  balances?: { primary: Balance[], secondary: Balance[] },
  prices?: { ask: BigNumber | null, bid: BigNumber | null }
  tiers?: AccountTier,
  preset?: ({ id: number } & Partial<typeof defaultState>) | null,
  onStateChange?: (state: MakerState) => any
}) {
  const [presetId, setPresetId] = useState<number>(0);
  const [state, setState] = useState<MakerState>(defaultState);
  const balances = useMemo((): { primary: BigNumber, secondary: BigNumber } | null => {
    if (!props.balances)
      return null;

    const primaryBalance = props.balances.primary.reduce((p, n) => p.plus(n.available), new BigNumber(0));
    const secondaryBalance = props.balances.secondary.reduce((p, n) => p.plus(n.available), new BigNumber(0));
    return { primary: primaryBalance, secondary: secondaryBalance };
  }, [props.balances]);
  const isImmediate = useMemo((): boolean => {
    return state.condition == OrderCondition.Market;
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
  }, [props.primaryAsset, props.secondaryAsset, state.side]);
  const valueBalance = useMemo((): BigNumber | null => {
    return state.side == OrderSide.Buy ? balances?.secondary || null : balances?.primary || null;
  }, [balances, state.side]);
  const bestPrice = useMemo((): BigNumber => {
    if (hasPrice)
      return new BigNumber(state.price)
    else if (hasStopPrice)
      return new BigNumber(state.stopPrice);

    return (state.side == OrderSide.Buy ? props.prices?.ask : props.prices?.bid) || new BigNumber(0);
  }, [props.prices, state.side, state.price, state.stopPrice, hasPrice, hasStopPrice]);
  const payingValue = useMemo((): BigNumber => {
    const finalValueQuantity = TextUtil.toNumericValueOrPercent(state.value);
    if (!finalValueQuantity.value.gt(0))
      return new BigNumber(NaN);

    const finalValue = finalValueQuantity.relative ? valueBalance?.multipliedBy(finalValueQuantity.relative) : finalValueQuantity.value;
    if (!finalValue || !valueBalance || !finalValue.gt(0) || finalValue.gt(valueBalance))
      return new BigNumber(NaN);

    return finalValue;
  }, [state.value, valueBalance]);
  const policy = useMemo((): OrderPolicy => {
    if (isImmediate) {
      return state.fillOrKill ? OrderPolicy.ImmediateAll : OrderPolicy.Immediate;
    } else {
      return state.fillOrKill ? OrderPolicy.DeferredAll : OrderPolicy.Deferred;
    }
  }, [state.fillOrKill, isImmediate]);
  const concentratedRange = useMemo((): { min: BigNumber, max: BigNumber } | null => {
    const rangePrice = TextUtil.toNumericValue(state.rangePrice);
    const price = TextUtil.toNumericValue(state.basePrice);
    return rangePrice.gt(0) && price.gt(0) ? {
      min: price.minus(rangePrice),
      max: price.plus(rangePrice)
    } : null;
  }, [state.basePrice, state.rangePrice]);
  const fee = useMemo(() => {
    const min = (state.side == OrderSide.Buy ? props.tiers?.secondary?.makerFee : props.tiers?.primary?.makerFee) || new BigNumber(0);
    const finalSlippage = hasSlippage ? TextUtil.toNumericValueOrPercent(state.slippage) : null;
    return {
      relativePrice: finalSlippage?.relative || new BigNumber(0),
      absolutePrice: finalSlippage?.absolute || new BigNumber(0),
      min: min,
      max: (state.side == OrderSide.Buy ? props.tiers?.secondary?.takerFee : props.tiers?.primary?.takerFee) || new BigNumber(0),
    }
  }, [props.tiers, state.side, state.slippage, hasSlippage]);
  const orderPayload = useMemo((): {
    pays: Record<string, string>,
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
    trailingDistance?: string
  } | null => {
    if (state.pool)
      return null;

    const finalValueQuantity = TextUtil.toNumericValueOrPercent(state.value);
    if (!finalValueQuantity.value.gt(0))
      return null;

    const finalValue = finalValueQuantity.relative ? valueBalance?.multipliedBy(finalValueQuantity.relative) : finalValueQuantity.value;
    if (!props.balances || !finalValue || !valueBalance || !finalValue.gt(0) || finalValue.gt(valueBalance))
      return null;

    let leftover = new BigNumber(finalValue);
    const pays: Record<string, string> = { };
    const available = state.side == OrderSide.Buy ? props.balances.secondary : props.balances.primary;
    for (let i = 0; i < available.length; i++) {
      const balance = available[i];
      const change = BigNumber.min(balance.available, leftover);
      leftover = leftover.minus(change);
      pays[balance.asset.id] = ByteUtil.bigNumberToString(change);
      if (!leftover.gt(0))
          break;
    }

    switch (state.condition) {
      case OrderCondition.Market: {
        const finalSlippage = TextUtil.toNumericValueOrPercent(state.slippage);
        if (!finalSlippage.value.gte(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          slippage: ByteUtil.bigNumberToString(finalSlippage.relative ? finalSlippage.relative.negated() : finalSlippage.value),
          pays: pays
        };
      }
      case OrderCondition.Limit: {
        const finalPrice = TextUtil.toNumericValue(state.price);
        if (!finalPrice.gt(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          price: ByteUtil.bigNumberToString(finalPrice),
          pays: pays
        }
      }
      case OrderCondition.Stop: {
        const finalSlippage = TextUtil.toNumericValueOrPercent(state.slippage);
        if (!finalSlippage.value.gte(0))
          return null;

        const finalStopPrice = TextUtil.toNumericValue(state.stopPrice);
        if (!finalStopPrice.gt(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          stopPrice: ByteUtil.bigNumberToString(finalStopPrice),
          slippage: ByteUtil.bigNumberToString(finalSlippage.relative ? finalSlippage.relative.negated() : finalSlippage.value),
          pays: pays
        };
      }
      case OrderCondition.StopLimit: {
        const finalPrice = TextUtil.toNumericValue(state.price);
        if (!finalPrice.gt(0))
          return null;

        const finalStopPrice = TextUtil.toNumericValue(state.stopPrice);
        if (!finalStopPrice.gt(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          stopPrice: ByteUtil.bigNumberToString(finalStopPrice),
          price: ByteUtil.bigNumberToString(finalPrice),
          pays: pays
        };
      }
      case OrderCondition.TrailingStop: {
        const finalSlippage = TextUtil.toNumericValueOrPercent(state.slippage);
        if (!finalSlippage.value.gte(0))
          return null;

        const finalStopPrice = TextUtil.toNumericValue(state.stopPrice);
        if (!finalStopPrice.gt(0))
          return null;

        const finalTrailingStep = TextUtil.toNumericValueOrPercent(state.trailingStep);
        if (!finalTrailingStep.value.gt(0))
          return null;
        
        const finalTrailingDistance = TextUtil.toNumericValueOrPercent(state.trailingDistance);
        if (!finalTrailingDistance.value.gte(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          stopPrice: ByteUtil.bigNumberToString(finalStopPrice),
          slippage: ByteUtil.bigNumberToString(finalSlippage.relative ? finalSlippage.relative.negated() : finalSlippage.value),
          trailingStep: ByteUtil.bigNumberToString(finalTrailingStep.value),
          trailingDistance: ByteUtil.bigNumberToString(finalTrailingDistance.value),
          pays: pays
        };
      }
      case OrderCondition.TrailingStopLimit: {
        const finalPrice = new BigNumber(state.price);
        if (!finalPrice.gt(0))
          return null;

        const finalStopPrice = new BigNumber(state.stopPrice);
        if (!finalStopPrice.gt(0))
          return null;

        const finalTrailingStep = TextUtil.toNumericValueOrPercent(state.trailingStep);
        if (!finalTrailingStep.value.gt(0))
          return null;
        
        const finalTrailingDistance = TextUtil.toNumericValueOrPercent(state.trailingDistance);
        if (!finalTrailingDistance.value.gte(0))
          return null;

        return {
          marketId: props.marketId.toString(),
          primaryAssetHash: props.primaryAsset.id,
          secondaryAssetHash: props.secondaryAsset.id,
          condition: state.condition,
          policy: policy,
          side: state.side,
          stopPrice: ByteUtil.bigNumberToString(finalStopPrice),
          price: ByteUtil.bigNumberToString(finalPrice),
          trailingStep: ByteUtil.bigNumberToString(finalTrailingStep.value),
          trailingDistance: ByteUtil.bigNumberToString(finalTrailingDistance.value),
          pays: pays
        };
      }
      default:
        return null;
    }
  }, [props.marketId, props.primaryAsset, props.secondaryAsset, state, policy, valueBalance]);
  const poolPayload = useMemo((): {
    marketId: string,
    primaryAssetHash: string,
    secondaryAssetHash: string,
    primaryPays: Record<string, string>,
    secondaryPays: Record<string, string>,
    feeRate: string;
    price: string,
    minPrice?: string;
    maxPrice?: string;
  } | null => {
    if (!state.pool)
      return null;

    const price = TextUtil.toNumericValue(state.basePrice);
    if (!price.gt(0))
      return null;

    if (concentratedRange && concentratedRange.min.lte(0))
      return null;
    
    if (!props.balances || !balances)
      return null;

    const primary = TextUtil.toNumericValueOrPercent(state.primaryValue), secondary = TextUtil.toNumericValueOrPercent(state.secondaryValue);
    primary.value = primary.relative ? primary.value.multipliedBy(balances.primary) : primary.value;
    secondary.value = secondary.relative ? secondary.value.multipliedBy(balances.secondary) : secondary.value;
    if (!primary.value.gt(0) || !secondary.value.gt(0))
      return null;

    if (primary.value.gt(balances.primary) || secondary.value.gt(balances.secondary))
      return null;

    const feeRate = TextUtil.toNumericValueOrPercent(state.feeRate);
    if (feeRate.absolute || feeRate.value.lt(0) || feeRate.value.gt(1))
      return null;
    
    let primaryLeftover = new BigNumber(primary.value);
    const primaryPays: Record<string, string> = { };
    for (let i = 0; i < props.balances.primary.length; i++) {
      const balance = props.balances.primary[i];
      const change = BigNumber.min(balance.available, primaryLeftover);
      primaryLeftover = primaryLeftover.minus(change);
      primaryPays[balance.asset.id] = ByteUtil.bigNumberToString(change);
      if (!primaryLeftover.gt(0))
          break;
    }

    let secondaryLeftover = new BigNumber(secondary.value);
    const secondaryPays: Record<string, string> = { };
    for (let i = 0; i < props.balances.secondary.length; i++) {
      const balance = props.balances.secondary[i];
      const change = BigNumber.min(balance.available, secondaryLeftover);
      secondaryLeftover = secondaryLeftover.minus(change);
      secondaryPays[balance.asset.id] = ByteUtil.bigNumberToString(change);
      if (!secondaryLeftover.gt(0))
          break;
    }

    return {
      marketId: props.marketId.toString(),
      primaryAssetHash: props.primaryAsset.id,
      secondaryAssetHash: props.secondaryAsset.id,
      primaryPays: primaryPays,
      secondaryPays: secondaryPays,
      price: ByteUtil.bigNumberToString(price),
      minPrice: concentratedRange ? ByteUtil.bigNumberToString(concentratedRange.min) : undefined,
      maxPrice: concentratedRange ? ByteUtil.bigNumberToString(concentratedRange.max) : undefined,
      feeRate: ByteUtil.bigNumberToString(feeRate.value)
    };
  }, [props.marketId, props.primaryAsset, props.secondaryAsset, balances, state, concentratedRange]);
  const updateState = useCallback((change: (prev: MakerState) => MakerState) => {
    setState(prev => {
      const result = change(prev);
      if (props.path != null)
        Storage.set(props.path, result);
      return result;
    });
  }, [props.path]);
  const setPrimaryValue = useCallback((newPrimaryValue: string): void => {
    const primaryValue = TextUtil.toValueOrPercent(state.primaryValue, newPrimaryValue);
    const price = TextUtil.toNumericValue(state.basePrice);
    if (price.gt(0)) {
      const primary = TextUtil.toNumericValueOrPercent(primaryValue);
      primary.value = balances ? (primary.relative ? primary.value.multipliedBy(balances.primary) : primary.value) : new BigNumber(0);

      if (!concentratedRange || concentratedRange.min.gt(0)) {
        const secondary = concentratedRange ? LiquidityPool.toSecondaryValue(primary.value.multipliedBy(1.00005), price, concentratedRange.min || null, concentratedRange.max || null) : LiquidityPool.toSecondaryValue(primary.value, price, null, null);
        if (secondary != null) {
          return updateState((prev) => ({ ...prev, primaryValue: primaryValue, secondaryValue: secondary.toString() }));
        }
      }
    }
    updateState((prev) => ({ ...prev, primaryValue: primaryValue }));
  }, [balances, state.primaryValue, state.basePrice, state.rangePrice, concentratedRange]);
  const setSecondaryValue = useCallback((newSecondaryValue: string): void => {
    const secondaryValue = TextUtil.toValueOrPercent(state.secondaryValue, newSecondaryValue);
    const price = TextUtil.toNumericValue(state.basePrice);
    if (price.gt(0)) {
      const secondary = TextUtil.toNumericValueOrPercent(secondaryValue);
      secondary.value = balances ? (secondary.relative ? secondary.value.multipliedBy(balances.secondary) : secondary.value) : new BigNumber(0);
 
      if (!concentratedRange || concentratedRange.min.gt(0)) {
        const primary = concentratedRange ? LiquidityPool.toPrimaryValue(secondary.value.dividedBy(1.00005), price, concentratedRange.min || null, concentratedRange.max || null) : LiquidityPool.toSecondaryValue(secondary.value, price, null, null);
        if (primary != null) {
          return updateState((prev) => ({ ...prev, primaryValue: primary.toString(), secondaryValue: secondaryValue }));
        }
      }
    }
    updateState((prev) => ({ ...prev, secondaryValue: secondaryValue }));
  }, [balances, state.secondaryValue, state.basePrice, state.rangePrice, concentratedRange]);
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
        rangePrice: props.preset?.rangePrice || '',
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
    if (props.onStateChange)
      props.onStateChange(state);
  }, [state, props.onStateChange]);

  const makeOrder = () => (
    <Box>
      <Box mb="4">
        <Button variant="soft" color={state.side == OrderSide.Buy ? 'jade' : 'red'} style={{ display: 'block', height: 'auto', width: '100%', borderRadius: '24px' }} onClick={() => {
          if (valueBalance != null)
            updateState(prev => ({ ...prev, value: valueBalance.toString() }));
        }}>
          <Flex align="center" gap="2" px="2" py="3">
            <AssetImage asset={valueAsset} size="2" iconSize="40px"></AssetImage>
            <Box>
              <AssetName asset={valueAsset}></AssetName>
              {
                valueBalance && 
                <Text align="left" weight="bold" size="3" style={{ display: 'block' }}>{ Readability.toMoney(valueAsset, valueBalance) }</Text>
              }
              {
                !valueBalance &&
                <Box pt="1">
                  <Spinner size="3"></Spinner>
                </Box>
              }
            </Box>
          </Flex>
        </Button>
      </Box>
      <Box mb="2">
        <Select.Root value={state.condition.toString()} onValueChange={(e) => updateState(prev => ({ ...prev, condition: parseInt(e) }))}>
          <Tooltip side="left" content="Condition: order matching style">
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
          <Tooltip side="left" content={`Policy: fill completely/partially${isImmediate ? ' and cancel leftovers' : ''} or fill ${ isImmediate ? 'completely and cancel if not possible to do so' : 'only completely'}`}>
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
          <Tooltip side="left" content={`Stop price: ${state.side == OrderSide.Buy ? 'maximal' : 'minimal'} ${isTrailing ? 'initial ' : ''}price to replace the ${isTrailing ? 'trailing stop' : 'stop'} order with ${isImmediate ? 'market' : 'limit'} order`}>
            <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' stop price'} size="2" value={state.stopPrice} onChange={(e) => updateState(prev => ({ ...prev, stopPrice: TextUtil.toValue(prev.stopPrice, e.target.value) }))}>
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
          <Tooltip side="left" content={`Price: match ${state.side == OrderSide.Buy ? 'selling' : 'buying'} orders with price ${state.side == OrderSide.Buy ? 'lower' : 'higher'} than or equal to ${state.price.length > 0 ? Readability.toMoney(props.secondaryAsset, state.price) : 'selected'}`}>
            <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' price'} size="2" value={state.price} onChange={(e) => updateState(prev => ({ ...prev, price: TextUtil.toValue(prev.price, e.target.value) }))}>
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
            <Tooltip side="left" content={`Trailing stop: minimal price ${state.side == OrderSide.Buy ? 'fall' : 'rise'} to trigger stop price change`}>
              <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' step or %'} size="2" value={state.trailingStep} onChange={(e) => updateState(prev => ({ ...prev, trailingStep: TextUtil.toValueOrPercent(prev.trailingStep, e.target.value) }))}>
                <TextField.Slot>
                  <Icon path={mdiCurrencyUsd} size={0.8} />
                </TextField.Slot>
              </TextField.Root>
            </Tooltip>
          </Box>
          <Box mb="2">
            <Tooltip side="left" content={`Trailing distance: stop price distance ${state.side == OrderSide.Buy ? 'above' : 'below'} market price`}>
              <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' distance or %'} size="2" value={state.trailingDistance} onChange={(e) => updateState(prev => ({ ...prev, trailingDistance: TextUtil.toValueOrPercent(prev.trailingDistance, e.target.value) }))}>
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
          <Tooltip side="left" content={`Slippage: maximal unfavorable deviation from best price`}>
            <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' slippage or %'} size="2" value={state.slippage} onChange={(e) => updateState(prev => ({ ...prev, slippage: TextUtil.toValueOrPercent(prev.slippage, e.target.value) }))}>
              <TextField.Slot>
                <Icon path={mdiCurrencyUsd} size={0.8} />
              </TextField.Slot>
            </TextField.Root>
          </Tooltip>
        </Box>
      }
      <Box mb="2">
        <Tooltip side="left" content={`Quantity: receive ~${state.side == OrderSide.Buy ? Readability.toMoney(props.primaryAsset, (bestPrice.gt(0) ? payingValue.dividedBy(bestPrice) : new BigNumber(0))) : Readability.toMoney(props.secondaryAsset, bestPrice.multipliedBy(payingValue))} excluding fees and slippage`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(valueAsset) + ' quantity or %'} size="2" value={state.value} onChange={(e) => updateState(prev => ({ ...prev, value: TextUtil.toValueOrPercent(prev.value, e.target.value) }))}>
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
            <Text size="1" color="gray">Volume</Text>
            <Text size="1" color="gray">{ Readability.toMoney(state.side == OrderSide.Buy ? props.secondaryAsset : props.primaryAsset, state.side == OrderSide.Buy ? props.tiers.secondary.volume : props.tiers.primary.volume) }</Text>
          </Flex>
          <Flex justify="between">
            <Text size="1" color="gray">Amount</Text>
            <Text size="1" color="gray">~{ state.side == OrderSide.Buy ? Readability.toMoney(props.primaryAsset, (bestPrice.gt(0) ? payingValue.dividedBy(bestPrice) : new BigNumber(0)).multipliedBy(new BigNumber(1).minus(fee.max))) : Readability.toMoney(props.secondaryAsset, bestPrice.multipliedBy(payingValue)) }</Text>
          </Flex>
          <Flex justify="between">
            <Text size="1" color="gray">Fee</Text>
            <Text size="1" color="gray">{ fee.min.multipliedBy(100).toFixed(2) }% — { fee.max.multipliedBy(100).toFixed(2) }%</Text>
          </Flex>
        </Box>
      }
      <Box>
        <PerformerButton title="Place order" description={`Order placement involves paying ${Readability.toAssetSymbol(valueAsset)} to smart contract that can re-pay it back by withdrawal otherwise it will pay ${Readability.toAssetSymbol(state.side == OrderSide.Buy ? props.primaryAsset : props.secondaryAsset)} as it executes the order`} color={state.side == OrderSide.Buy ? 'jade' : 'red'} style={{ width: '100%' }} disabled={!orderPayload} onBuild={async () => {
          return orderPayload ? Builder.depositOrder(orderPayload) : null;
        }}></PerformerButton>
      </Box>
    </Box>
  );
  const makePool = () => (
    <Box>
      <Box mb="4">
        <Button variant="soft" color="orange" style={{ display: 'block', height: 'auto', width: '100%', borderRadius: '24px' }}>
          <Flex align="center" gap="2" px="2" py="3">
            <Box style={{ position: 'relative' }}>
              <AssetImage asset={props.secondaryAsset} size="2" iconSize="26px" style={{ position: 'absolute', top: '20px', left: '-6px' }}></AssetImage>
              <AssetImage asset={props.primaryAsset} size="2" iconSize="40px"></AssetImage>
            </Box>
            {
              balances &&
              <Box>
                <Text align="left" weight="bold" size="3" style={{ display: 'block' }}>{ Readability.toMoney(props.primaryAsset, balances.primary) }</Text>
                <Text align="left" style={{ display: 'block' }}>{ Readability.toMoney(props.secondaryAsset, balances.secondary) }</Text>
              </Box>
            }
            {
              !balances &&
              <Box pt="3" pb="3">
                <Spinner size="3"></Spinner>
              </Box>
            }
          </Flex>
        </Button>
      </Box>
      <Box mb="2">
        <Tooltip side="left" content={`Price: starting price equal to ${state.basePrice.length > 0 ? Readability.toMoney(props.secondaryAsset, state.basePrice) : 'selected'} that will gradually adjust to market price as trades are made`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' price'} size="2" value={state.basePrice} onChange={(e) => updateState(prev => ({ ...prev, basePrice: TextUtil.toValue(prev.basePrice, e.target.value), primaryValue: '', secondaryValue: '' }))}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box mb="2">
        <Tooltip side="left" content={`Price range: lower/upper distance from inital price equal to ${state.rangePrice.length > 0 ? Readability.toMoney(props.secondaryAsset, state.rangePrice) : 'selected'} plus fee rate which will concentrate liquidity at prices below selected`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' price range or none'} size="2" value={state.rangePrice} onChange={(e) => updateState(prev => ({ ...prev, rangePrice: TextUtil.toValue(prev.rangePrice, e.target.value), primaryValue: '', secondaryValue: '' }))}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      {
        concentratedRange &&
        <Tooltip side="left" content="Minimal to maximal price range">
          <Flex justify="between" wrap="wrap" gap="1" my="3" px="2">
            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toValue(null, concentratedRange.min, false, true) }</Text>
            <Text size="2" color="gray">—</Text>
            <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toValue(null, concentratedRange.max, false, true) }</Text>
          </Flex>
        </Tooltip>
      }
      <Box mb="2">
        <Tooltip side="left" content={`Primary reserve: initial ${Readability.toAssetSymbol(props.primaryAsset)} reserve equal to ${Readability.toMoney(props.primaryAsset, state.primaryValue)} and will adjust as trades are made`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.primaryAsset) + ' reserve or %'} size="2" value={state.primaryValue} onChange={(e) => setPrimaryValue(e.target.value)}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box mb="2">
        <Tooltip side="left" content={`Secondary reserve: initial ${Readability.toAssetSymbol(props.secondaryAsset)} reserve equal to ${Readability.toMoney(props.secondaryAsset, state.secondaryValue)} and will adjust as trades are made`}>
          <TextField.Root placeholder={Readability.toAssetSymbol(props.secondaryAsset) + ' reserve or %'} size="2" value={state.secondaryValue} onChange={(e) => setSecondaryValue(e.target.value)}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box mb="2">
        <Tooltip side="left" content={`Fee rate: pool fee equal to ${state.feeRate ? state.feeRate : 'N/A'} and taken from each trade with this pool`}>
          <TextField.Root placeholder={'Exchange fee %'} size="2" value={state.feeRate} onChange={(e) => updateState(prev => ({ ...prev, feeRate: TextUtil.toPercent(prev.feeRate, e.target.value) }))}>
            <TextField.Slot>
              <Icon path={mdiCurrencyUsd} size={0.8} />
            </TextField.Slot>
          </TextField.Root>
        </Tooltip>
      </Box>
      <Box>
        <PerformerButton title="Create pool" description={`Pool creation involves paying ${Readability.toAssetSymbol(props.primaryAsset)} and ${Readability.toAssetSymbol(props.secondaryAsset)} to smart contract that will re-pay it back by withdrawal otherwise it will use it to provide liquidity for taker orders`} style={{ width: '100%' }} disabled={!poolPayload}  onBuild={async () => {
          return poolPayload ? Builder.depositPool(poolPayload) : null;
        }}></PerformerButton>
      </Box>
    </Box>
  );
  return (
    <Box>
      <Card variant="surface" style={{ borderRadius: '22px' }}>
        <Box mb="2">
          <SegmentedControl.Root size="2" style={{ width: '100%' }} value={state.pool ? 'pool' : state.side.toString()} onValueChange={(e) => updateState(prev => ({ ...prev, side: e == 'pool' ? prev.side : parseInt(e), pool: e == 'pool' }))}>
            <SegmentedControl.Item value={OrderSide.Buy.toString()}>Buy</SegmentedControl.Item>
            <SegmentedControl.Item value={OrderSide.Sell.toString()}>Sell</SegmentedControl.Item>
            <SegmentedControl.Item value="pool">LP</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Box>
        { state.pool ? makePool() : makeOrder() }
      </Card>
    </Box>
  );
}