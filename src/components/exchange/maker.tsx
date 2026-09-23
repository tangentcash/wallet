import { Box, SegmentedControl, Select, TextField } from "@radix-ui/themes";
import { AccountTier, Balance, Exchange, OrderCondition, OrderPolicy, OrderSide } from "../../core/exchange";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AssetId, ByteUtil, LiquidityPool } from "tangentsdk/algorithm";
import { UiUtil } from "tangentsdk/ui";
import { TextUtil } from "tangentsdk/text";
import { AppStorage } from "../../core/storage";
import { PerformerButton, Builder } from "./performer";
import BigNumber from "bignumber.js";

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

export const defaultMakerState: MakerState = {
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
  preset?: ({ id: number } & Partial<typeof defaultMakerState>) | null,
  onStateChange?: (state: MakerState) => any
}) {
  const [presetId, setPresetId] = useState<number>(0);
  const [state, setState] = useState<MakerState>(defaultMakerState);
  const balances = useMemo((): {
    primary: {
      value: BigNumber,
      assets: Balance[]
    },
    secondary: {
      value: BigNumber,
      assets: Balance[]
    }
  } | null => {
    return props.balances ? {
      primary: {
        value: props.balances.primary.reduce((p, n) => p.plus(n.available), new BigNumber(0)),
        assets: props.balances.primary
      },
      secondary: {
        value: props.balances.secondary.reduce((p, n) => p.plus(n.available), new BigNumber(0)),
        assets: props.balances.secondary
      }
    } : null;
  }, [props.balances]);
  const isImmediate = useMemo((): boolean => {
    return state.condition == OrderCondition.Market;
  }, [state.condition]);
  const priceHint = useMemo((): string => {
    const opposite = state.side == OrderSide.Buy ? props.prices?.ask : props.prices?.bid;
    return opposite != null && opposite.gt(0) ? UiUtil.toValue(null, opposite, false, true) : '0.0';
  }, [props.prices, state.side]);
  const poolPriceHint = useMemo((): string => {
    const ask = props.prices?.ask;
    const bid = props.prices?.bid;
    const mid = ask != null && bid != null && ask.gt(0) && bid.gt(0) ? ask.plus(bid).dividedBy(2) : ask != null && ask.gt(0) ? ask : bid != null && bid.gt(0) ? bid : null;
    return mid != null ? UiUtil.toValue(null, mid, false, true) : '0.0';
  }, [props.prices]);
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
    return state.side == OrderSide.Buy ? balances?.secondary.value || null : balances?.primary.value || null;
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

    const pays = Exchange.toPayment(new BigNumber(finalValue), state.side == OrderSide.Buy ? props.balances.secondary : props.balances.primary);
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
    swappingAssetHash?: string,
    swappingPays?: Record<string, string>,
    swappingSlippage?: string,
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
    
    if (!balances)
      return null;

    const primary = TextUtil.toNumericValueOrPercent(state.primaryValue), secondary = TextUtil.toNumericValueOrPercent(state.secondaryValue);
    primary.value = primary.relative ? primary.value.multipliedBy(balances.primary.value) : primary.value;
    secondary.value = secondary.relative ? secondary.value.multipliedBy(balances.secondary.value) : secondary.value;
    if (!primary.value.gt(0) || !secondary.value.gt(0))
      return null;
    if (primary.value.gt(balances.primary.value) || secondary.value.gt(balances.secondary.value))
      return null;

    const feeRate = TextUtil.toNumericValueOrPercent(state.feeRate);
    if (feeRate.absolute || feeRate.value.lt(0) || feeRate.value.gt(1))
      return null;
    
    const primaryPays: Record<string, string> = Exchange.toPayment(new BigNumber(primary.value), balances.primary.assets);
    const secondaryPays: Record<string, string> = Exchange.toPayment(new BigNumber(secondary.value), balances.secondary.assets);
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
        AppStorage.set(props.path, result);
      return result;
    });
  }, [props.path]);
  const setPrimaryValue = useCallback((newPrimaryValue: string): void => {
    const primaryValue = TextUtil.toValueOrPercent(state.primaryValue, newPrimaryValue);
    const price = TextUtil.toNumericValue(state.basePrice);
    if (price.gt(0)) {
      const primary = TextUtil.toNumericValueOrPercent(primaryValue);
      primary.value = balances ? (primary.relative ? primary.value.multipliedBy(balances.primary.value) : primary.value) : new BigNumber(0);

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
      secondary.value = balances ? (secondary.relative ? secondary.value.multipliedBy(balances.secondary.value) : secondary.value) : new BigNumber(0);
 
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
      const memorizedState = AppStorage.get(props.path);
      if (memorizedState != null && typeof memorizedState == 'object') {
        memorizedState.value = '';
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div className="type-select" style={{ flex: 1, minWidth: 0 }}>
          <Select.Root value={state.condition.toString()} onValueChange={(value) => updateState(prev => ({ ...prev, condition: parseInt(value) as OrderCondition }))}>
            <Select.Trigger style={{ width: '100%', height: 36, fontSize: 14 }} aria-label="Order type" />
            <Select.Content position="popper">
              <Select.Item value={OrderCondition.Market.toString()}>Market</Select.Item>
              <Select.Item value={OrderCondition.Limit.toString()}>Limit</Select.Item>
              <Select.Item value={OrderCondition.Stop.toString()}>Stop</Select.Item>
              <Select.Item value={OrderCondition.StopLimit.toString()}>Stop-limit</Select.Item>
              <Select.Item value={OrderCondition.TrailingStop.toString()}>Trailing</Select.Item>
              <Select.Item value={OrderCondition.TrailingStopLimit.toString()}>Trailing-limit</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
        <button type="button" className={ 'fill-toggle' + (state.fillOrKill ? ' hot' : '') } aria-pressed={state.fillOrKill} onClick={() => updateState(prev => ({ ...prev, fillOrKill: !prev.fillOrKill }))}>100% fill only</button>
      </div>
      {
        hasStopPrice &&
        <div className="field-lite">
          <div className="lab"><span>Stop price · { UiUtil.toAssetSymbol(props.secondaryAsset) }</span><span style={{ color: 'var(--text-3)' }}>{ isTrailing ? 'arms the trailing stop' : 'triggers the order' }</span></div>
          <div className="val">
            <TextField.Root placeholder={ priceHint } type="text" value={state.stopPrice} onChange={(e) => updateState(prev => ({ ...prev, stopPrice: TextUtil.toValue(prev.stopPrice, e.target.value) }))} />
          </div>
        </div>
      }
      {
        hasPrice &&
        <div className="field-lite">
          <div className="lab">
            <span>Limit price · { UiUtil.toAssetSymbol(props.secondaryAsset) } per { UiUtil.toAssetSymbol(props.primaryAsset) }</span>
            { bestPrice.gt(0) && <span style={{ color: 'var(--lime)', fontWeight: 700, cursor: 'pointer' }} onClick={() => updateState(prev => ({ ...prev, price: ByteUtil.bigNumberToString(bestPrice) }))}>{ state.side == OrderSide.Buy ? 'Best ask' : 'Best bid' }</span> }
          </div>
          <div className="val">
            <TextField.Root placeholder={ priceHint } type="text" value={state.price} onChange={(e) => updateState(prev => ({ ...prev, price: TextUtil.toValue(prev.price, e.target.value) }))} />
          </div>
        </div>
      }
      {
        isTrailing &&
        <>
          <div className="field-lite">
            <div className="lab"><span>Trailing step · { UiUtil.toAssetSymbol(props.secondaryAsset) } or %</span><span style={{ color: 'var(--text-3)' }}>{ state.side == OrderSide.Buy ? 'price fall' : 'price rise' } to move stop</span></div>
            <div className="val">
              <TextField.Root placeholder="0.0" type="text" value={state.trailingStep} onChange={(e) => updateState(prev => ({ ...prev, trailingStep: TextUtil.toValueOrPercent(prev.trailingStep, e.target.value) }))} />
            </div>
          </div>
          <div className="field-lite">
            <div className="lab"><span>Trailing distance · { UiUtil.toAssetSymbol(props.secondaryAsset) } or %</span><span style={{ color: 'var(--text-3)' }}>{ state.side == OrderSide.Buy ? 'above' : 'below' } market price</span></div>
            <div className="val">
              <TextField.Root placeholder="0.0" type="text" value={state.trailingDistance} onChange={(e) => updateState(prev => ({ ...prev, trailingDistance: TextUtil.toValueOrPercent(prev.trailingDistance, e.target.value) }))} />
            </div>
          </div>
        </>
      }
      {
        hasSlippage &&
        <div className="field-lite">
          <div className="lab"><span>Max slippage</span><span style={{ color: 'var(--text-3)' }}>walks the book to this deviation</span></div>
          <div className="val" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}><TextField.Root placeholder="0.5%" type="text" value={state.slippage} onChange={(e) => updateState(prev => ({ ...prev, slippage: TextUtil.toValueOrPercent(prev.slippage, e.target.value) }))} /></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={ 'pct' + (state.slippage == '0.1%' ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, slippage: '0.1%' }))}>0.1</button>
              <button className={ 'pct' + (state.slippage == '0.5%' ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, slippage: '0.5%' }))}>0.5</button>
              <button className={ 'pct' + (state.slippage == '1%' ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, slippage: '1%' }))}>1.0</button>
            </div>
          </div>
        </div>
      }
      <div className="field-lite">
        <div className="lab">
          <span>Amount · { UiUtil.toAssetSymbol(valueAsset) }</span>
          { valueBalance != null && <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>≤ { UiUtil.toMoney(valueAsset, valueBalance) }</span> }
        </div>
        <div className="val">
          <TextField.Root placeholder="0.0" type="text" value={state.value} onChange={(e) => updateState(prev => ({ ...prev, value: TextUtil.toValueOrPercent(prev.value, e.target.value) }))} />
        </div>
        {
          valueBalance != null &&
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button className={ 'pct' + (state.value == '25%' ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, value: '25%' }))}>25%</button>
            <button className={ 'pct' + (state.value == '50%' ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, value: '50%' }))}>50%</button>
            <button className={ 'pct' + (state.value == '75%' ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, value: '75%' }))}>75%</button>
            <button className={ 'pct' + (state.value == '100%' || state.value == 'Max' ? ' hot' : '') } onClick={() => updateState(prev => ({ ...prev, value: '100%' }))}>Max</button>
          </div>
        }
      </div>
      <PerformerButton className="btn-brand btn-cta" title={ 'Review ' + (state.side == OrderSide.Buy ? 'buy' : 'sell') + ' order' } description={`Order placement involves paying ${UiUtil.toAssetSymbol(valueAsset)} to smart contract that can re-pay it back by withdrawal otherwise it will pay ${UiUtil.toAssetSymbol(state.side == OrderSide.Buy ? props.primaryAsset : props.secondaryAsset)} as it executes the order`} style={{ width: '100%' }} disabled={!orderPayload} onBuild={async () => {
        return orderPayload ? Builder.depositOrder(orderPayload) : null;
      }}></PerformerButton>
      {
        props.tiers != null &&
        <p className="dim" style={{ textAlign: 'center', fontSize: 13, margin: '10px 0 0' }}>Receive ~{ state.side == OrderSide.Buy ? UiUtil.toMoney(props.primaryAsset, (bestPrice.gt(0) ? payingValue.dividedBy(bestPrice) : new BigNumber(0)).multipliedBy(new BigNumber(1).minus(fee.max))) : UiUtil.toMoney(props.secondaryAsset, bestPrice.multipliedBy(payingValue)) } · { fee.min.isEqualTo(fee.max) ? fee.min.multipliedBy(100).toFixed(2) : fee.min.multipliedBy(100).toFixed(2) + '-' + fee.max.multipliedBy(100).toFixed(2) }% fee</p>
      }
    </Box>
  );
  const makePool = () => (
    <Box>
      <div className="field-lite">
        <div className="lab"><span>Base price · { UiUtil.toAssetSymbol(props.secondaryAsset) }</span><span style={{ color: 'var(--text-3)' }}>drifts with the market</span></div>
        <div className="val">
          <TextField.Root placeholder={ poolPriceHint } type="text" value={state.basePrice} onChange={(e) => updateState(prev => ({ ...prev, basePrice: TextUtil.toValue(prev.basePrice, e.target.value), primaryValue: '', secondaryValue: '' }))} />
        </div>
      </div>
      <div className="field-lite">
        <div className="lab"><span className="nowrap">Concentration range</span><span className="nowrap" style={{ color: 'var(--text-3)' }}>tighter = deeper book</span></div>
        <div className="val">
          <TextField.Root placeholder="full range" type="text" value={state.rangePrice} onChange={(e) => updateState(prev => ({ ...prev, rangePrice: TextUtil.toValue(prev.rangePrice, e.target.value), primaryValue: '', secondaryValue: '' }))} />
        </div>
        {
          concentratedRange &&
          <div className="rng" style={{ marginTop: 9 }}>
            <i style={{ left: 0, width: '100%', background: 'var(--lime-solid)' }}></i>
            <b style={{ left: 'calc(50% - 3px)' }}></b>
          </div>
        }
        {
          concentratedRange &&
          <div className="tiny dim num" style={{ marginTop: 7, textAlign: 'center' }}>{ UiUtil.toValue(null, concentratedRange.min, false, true) } – { UiUtil.toValue(null, concentratedRange.max, false, true) }</div>
        }
      </div>
      <div className="field-lite">
        <div className="lab"><span>Pool fee rate</span><span style={{ color: 'var(--text-3)' }}>taken from every fill</span></div>
        <div className="val">
          <TextField.Root placeholder="0.05%" type="text" value={state.feeRate} onChange={(e) => updateState(prev => ({ ...prev, feeRate: TextUtil.toPercent(prev.feeRate, e.target.value) }))} />
        </div>
      </div>
      <div className="field-lite">
        <div className="lab"><span className="nowrap">Reserve · { UiUtil.toAssetSymbol(props.primaryAsset) }</span>{ balances != null && <span className="nowrap" style={{ color: 'var(--text-3)', fontWeight: 500 }}>≤ { UiUtil.toMoney(props.primaryAsset, balances.primary.value) }</span> }</div>
        <div className="val">
          <TextField.Root placeholder="0.0" type="text" value={state.primaryValue} onChange={(e) => setPrimaryValue(e.target.value)} />
        </div>
      </div>
      <div className="field-lite">
        <div className="lab"><span className="nowrap">Reserve · { UiUtil.toAssetSymbol(props.secondaryAsset) }</span>{ balances != null && <span className="nowrap" style={{ color: 'var(--text-3)', fontWeight: 500 }}>≤ { UiUtil.toMoney(props.secondaryAsset, balances.secondary.value) }</span> }</div>
        <div className="val">
          <TextField.Root placeholder="0.0" type="text" value={state.secondaryValue} onChange={(e) => setSecondaryValue(e.target.value)} />
        </div>
      </div>
      <PerformerButton className="btn-brand btn-cta" title="Review LP order" description={`Pool creation involves paying ${UiUtil.toAssetSymbol(props.primaryAsset)} and ${UiUtil.toAssetSymbol(props.secondaryAsset)} to smart contract that will re-pay it back by withdrawal otherwise it will use it to provide liquidity for taker orders`} style={{ width: '100%' }} disabled={!poolPayload} onBuild={async () => {
        return poolPayload ? Builder.depositPool(poolPayload) : null;
      }}></PerformerButton>
    </Box>
  );
  return (
    <>
      <div className="card" style={{ marginTop: 14 }}>
        <SegmentedControl.Root value={ state.pool ? 'lp' : (state.side == OrderSide.Buy ? 'buy' : 'sell') } radius="full" size="3" mb="3" onValueChange={(v) => {
          if (v == 'lp')
            updateState(prev => ({ ...prev, pool: true }));
          else
            updateState(prev => ({ ...prev, pool: false, side: v == 'buy' ? OrderSide.Buy : OrderSide.Sell, value: v == 'buy' && valueBalance != null ? valueBalance.toString() : prev.value }));
        }}>
          <SegmentedControl.Item value="buy">Buy</SegmentedControl.Item>
          <SegmentedControl.Item value="sell">Sell</SegmentedControl.Item>
          <SegmentedControl.Item value="lp">LP</SegmentedControl.Item>
        </SegmentedControl.Root>
        { state.pool ? makePool() : makeOrder() }
      </div>
      { state.pool ? <p className="tiny dim" style={{ textAlign: 'center', marginTop: 10 }}>Pools settle on-chain · exit fee applies on withdrawal</p> : <p className="tiny dim" style={{ textAlign: 'center', marginTop: 10 }}>The book lives on-chain · this view is served by the DEX indexer</p> }
    </>
  );
}