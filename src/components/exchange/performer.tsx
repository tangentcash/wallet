import { Box, Button, Dialog, Flex, IconButton, Spinner, Text, Tooltip } from "@radix-ui/themes";
import { CSSProperties, useCallback, useEffect, useState } from "react";
import { OrderCondition, OrderPolicy, OrderSide, Exchange } from "../../core/exchange";
import { AlertBox, AlertType } from "./../alert";
import { mdiArrowRight, mdiBlur, mdiBlurOff, mdiCancel, mdiCashRefund, mdiClose, mdiCollage, mdiWater, mdiWaterOff } from "@mdi/js";
import { AssetId, DEX, Hashsig, Readability, SchemaUtil, Signing, Stream, Transactions, Uint256 } from "tangentsdk";
import { useNavigate, useSearchParams } from "react-router";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

export type BuilderResult = {
  icon: string,
  text: string,
  body: Record<string, any>
};

export class Builder {
    static async depositOrder(args: {
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
    }): Promise<BuilderResult> {
        const pays: { asset: AssetId, value: BigNumber }[] = [];
        for (let assetId of Object.keys(args.pays)) {
            const asset = new AssetId(assetId);
            const paying = args.pays[assetId];
            const value = typeof paying == 'string' || typeof paying == 'number' ? new BigNumber(paying) : null;
            if (!value || !value.gt(0) || !asset.isValid())
                throw new Error('Order value must be positive');

            pays.push({ asset: asset, value: value });
        }
        
        const market = await Exchange.market(args.marketId);
        if (!market || !market.account)
            throw new Error('Market ' + args.marketId.toString() + ' account cannot be found');

        const primaryAsset = typeof args.primaryAssetHash == 'string' || typeof args.primaryAssetHash == 'number' ? new AssetId(args.primaryAssetHash) : null;
        if (!primaryAsset)
            throw new Error('Primary asset must be set');

        const secondaryAsset = typeof args.secondaryAssetHash == 'string' || typeof args.secondaryAssetHash == 'number' ? new AssetId(args.secondaryAssetHash) : null;
        if (!secondaryAsset)
            throw new Error('Secondary asset must be set');

        const condition: OrderCondition | null = typeof args.condition == 'string' || typeof args.condition == 'number' ? parseInt(args.condition.toString()) : null;
        if (condition == null)
            throw new Error('Order condition must be set');

        const policy: OrderPolicy | null = typeof args.policy == 'string' || typeof args.policy == 'number' ? parseInt(args.policy.toString()) : null;
        if (policy == null)
            throw new Error('Order policy must be set');

        const side: OrderSide | null = typeof args.side == 'string' || typeof args.side == 'number' ? parseInt(args.side.toString()) : null;
        if (side == null)
            throw new Error('Order side must be set');

        if (typeof args.pays != 'object')
            throw new Error('Order value must be set');

        const marketAccount = Signing.decodeAddress(market.account || '');
        if (!marketAccount)
            throw new Error('Market ' + market.id.toString() + ' account cannot be found');

        const pair = await Exchange.marketPair(market.id, primaryAsset, secondaryAsset, true);
        if (!pair)
            throw new Error('Pair cannot be found');

        let text: string, method: string, parameters: any[];
        const price = typeof args.price == 'string' || typeof args.price == 'number' ? new BigNumber(args.price) : null;
        const stopPrice = typeof args.stopPrice == 'string' || typeof args.stopPrice == 'number' ? new BigNumber(args.stopPrice) : null;
        const closePrice = Exchange.priceOf(pair.primaryAsset, pair.secondaryAsset).close;
        const targetPrice = price || stopPrice || closePrice;
        const targetValue = pays.reduce((t, i) => t.plus(i.value), new BigNumber(0));
        const toText = (order: { primaryAsset: AssetId, secondaryAsset: AssetId, condition: OrderCondition, side: OrderSide, slippage?: BigNumber, stopPrice?: BigNumber, trailingStep?: BigNumber, trailingDistance?: BigNumber, price?: BigNumber, value: BigNumber }, targetPrice?: BigNumber | null) => {
            const toPercentile = (asset: AssetId, value?: BigNumber | null) => value ? (value.gte(0) ? value.toString() + ' ' + asset.handle : value.negated().multipliedBy(100).toFixed(2) + '%') : 'N/A';
            const buying = order.side == OrderSide.Buy;
            const primaryValue = buying ? (targetPrice ? order.value.dividedBy(targetPrice) : null) : order.value;
            const secondaryValue = buying ? order.value : (targetPrice ? order.value.multipliedBy(targetPrice) : null);
            const orderDescription = `${buying ? 'Buy' : 'Sell'} ${Readability.toMoney(order.primaryAsset, primaryValue)} for ${Readability.toMoney(order.secondaryAsset, secondaryValue)} at price no ${buying ? 'higher' : 'lower'} than`;
            const marketOrderDescription = `${orderDescription} market price + ${toPercentile(order.secondaryAsset, order.slippage)}`;
            const limitOrderDescription = `${orderDescription} ${Readability.toMoney(order.secondaryAsset, order.price || null)}`;
            const triggerDescription = `if market price ${buying ? 'falls below' : 'rises above'}`;
            const trailingDescription = `dynamic stop price (step: ${toPercentile(order.secondaryAsset, order.trailingStep)}, distance: ${toPercentile(order.secondaryAsset, order.trailingDistance)})${order.stopPrice != null ? ' initially set to ' + Readability.toMoney(order.secondaryAsset, order.stopPrice) : ''}`
            switch (order.condition) {
                case OrderCondition.Market:
                    return marketOrderDescription;
                case OrderCondition.Limit:
                    return limitOrderDescription;
                case OrderCondition.Stop:
                    return `${marketOrderDescription} ${triggerDescription} ${Readability.toMoney(order.secondaryAsset, order.stopPrice || null)}`;
                case OrderCondition.StopLimit:
                    return `${limitOrderDescription} ${triggerDescription} ${Readability.toMoney(order.secondaryAsset, order.stopPrice || null)}`;
                case OrderCondition.TrailingStop:
                    return `${marketOrderDescription} ${triggerDescription} ${trailingDescription}`;
                case OrderCondition.TrailingStopLimit:
                    return `${limitOrderDescription} ${triggerDescription} ${trailingDescription}`;
                default:
                    return 'Invalid order condition';
            }
        }
        switch (condition) {
            case OrderCondition.Market: {
                const slippage = typeof args.slippage == 'string' || typeof args.slippage == 'number' ? new BigNumber(args.slippage) : null;
                if (!slippage)
                    throw new Error('Order slippage must be set');

                if (!closePrice?.gt(0))
                    throw new Error('No last price to calculate slippage price from');

                const distance = slippage.lt(0) ? slippage.multipliedBy(closePrice.negated()) : slippage;
                const slippagePrice = side == OrderSide.Buy ? closePrice.plus(distance) : BigNumber.max(closePrice.minus(distance), 0);
                method = DEX.Spot.marketOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, slippagePrice];
                text = toText({
                    primaryAsset: primaryAsset,
                    secondaryAsset: secondaryAsset,
                    condition: condition,
                    side: side,
                    slippage: slippage,
                    value: targetValue
                }, targetPrice);
                break;
            }
            case OrderCondition.Limit: {
                if (!price || !price.gt(0))
                    throw new Error('Order price must be positive');

                method = DEX.Spot.limitOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, price];
                text = toText({
                    primaryAsset: primaryAsset,
                    secondaryAsset: secondaryAsset,
                    condition: condition,
                    side: side,
                    price: price,
                    value: targetValue
                }, targetPrice);
              break;
            }
            case OrderCondition.Stop: {
                if (!stopPrice || !stopPrice.gt(0))
                    throw new Error('Order stop price must be positive');

                const slippage = typeof args.slippage == 'string' || typeof args.slippage == 'number' ? new BigNumber(args.slippage) : null;
                if (!slippage)
                    throw new Error('Order slippage must be set');

                method = DEX.Spot.stopOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, stopPrice, slippage];
                text = toText({
                    primaryAsset: primaryAsset,
                    secondaryAsset: secondaryAsset,
                    condition: condition,
                    side: side,
                    stopPrice: stopPrice,
                    slippage: slippage,
                    value: targetValue
                }, targetPrice);
                break;
            }
            case OrderCondition.StopLimit: {
                if (!stopPrice || !stopPrice.gt(0))
                    throw new Error('Order stop price must be positive');

                if (!price || !price.gt(0))
                    throw new Error('Order price must be positive');

                method = DEX.Spot.stopLimitOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, stopPrice, price];
                text = toText({
                    primaryAsset: primaryAsset,
                    secondaryAsset: secondaryAsset,
                    condition: condition,
                    side: side,
                    stopPrice: stopPrice,
                    price: price,
                    value: targetValue
                }, targetPrice);
                break;
            }
            case OrderCondition.TrailingStop: {
                if (!stopPrice || !stopPrice.gt(0))
                    throw new Error('Order stop price must be positive');

                const trailingStep = typeof args.trailingStep == 'string' || typeof args.trailingStep == 'number' ? new BigNumber(args.trailingStep) : null;
                if (!trailingStep)
                    throw new Error('Order trailing step must be set');

                const trailingDistance = typeof args.trailingDistance == 'string' || typeof args.trailingDistance == 'number' ? new BigNumber(args.trailingDistance) : null;
                if (!trailingDistance)
                    throw new Error('Order trailing distance must be set');

                const slippage = typeof args.slippage == 'string' || typeof args.slippage == 'number' ? new BigNumber(args.slippage) : null;
                if (!slippage)
                    throw new Error('Order slippage must be set');

                method = DEX.Spot.trailingStopOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, stopPrice, slippage, trailingStep, trailingDistance];
                text = toText({
                    primaryAsset: primaryAsset,
                    secondaryAsset: secondaryAsset,
                    condition: condition,
                    side: side,
                    stopPrice: stopPrice,
                    trailingStep: trailingStep,
                    trailingDistance: trailingDistance,
                    slippage: slippage,
                    value: targetValue
                }, targetPrice);
                break;
            }
            case OrderCondition.TrailingStopLimit: {
                if (!stopPrice || !stopPrice.gt(0))
                    throw new Error('Order stop price must be positive');

                if (!price || !price.gt(0))
                    throw new Error('Order price must be positive');

                const trailingStep = typeof args.trailingStep == 'string' || typeof args.trailingStep == 'number' ? new BigNumber(args.trailingStep) : null;
                if (!trailingStep)
                    throw new Error('Order trailing step must be set');

                const trailingDistance = typeof args.trailingDistance == 'string' || typeof args.trailingDistance == 'number' ? new BigNumber(args.trailingDistance) : null;
                if (!trailingDistance)
                    throw new Error('Order trailing distance must be set');

                method = DEX.Spot.trailingStopLimitOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, stopPrice, price, trailingStep, trailingDistance];
                text = toText({
                    primaryAsset: primaryAsset,
                    secondaryAsset: secondaryAsset,
                    condition: condition,
                    side: side,
                    stopPrice: stopPrice,
                    trailingStep: trailingStep,
                    trailingDistance: trailingDistance,
                    price: price,
                    value: targetValue
                }, targetPrice);
                break;
            }
            default:
                throw new Error('Invalid order condition');
        }
        
        return {
            icon: mdiBlur,
            text: text,
            body: {
              callable: marketAccount,
              pays: pays,
              function: Readability.toFunction(method),
              args: parameters
            }
        };
    }
    static async withdrawOrder(args: { orderId: number | string }): Promise<BuilderResult> {
        const id = typeof args.orderId == 'string' || typeof args.orderId == 'number' ? new Uint256(args.orderId) : null;
        if (!id)
            throw new Error('Order id not found');

        const order = await Exchange.marketOrder(id.toString());
        if (!order)
            throw new Error('Order ' + id.toString() + ' not found');

        const marketAccount = Signing.decodeAddress(order.marketAccount || '');
        if (!marketAccount)
            throw new Error('Order ' + id.toString() + ' market account cannot be found');
      
        return {
            icon: mdiBlurOff,
            text: 'Withdraw order #' + id.toString(),
            body: {
              callable: marketAccount,
              pays: [],
              function: Readability.toFunction(DEX.Spot.withdrawOrder),
              args: [new Uint256(order.orderId.toString())]
            }
        };
    }
    static async depositPool(args: {
        primaryPays: Record<string, string>,
        secondaryPays: Record<string, string>,
        marketId: string,
        primaryAssetHash: string,
        secondaryAssetHash: string,
        feeRate: string;
        price: string,
        minPrice?: string;
        maxPrice?: string;
    }): Promise<BuilderResult> {
      console.log(args);
        if (typeof args.primaryPays != 'object' || typeof args.secondaryPays != 'object')
            throw new Error('Pool value must be set');

        const primaryPays: { asset: AssetId, value: BigNumber }[] = [];
        for (let assetId of Object.keys(args.primaryPays)) {
            const asset = new AssetId(assetId);
            const paying = args.primaryPays[assetId];
            const value = typeof paying == 'string' || typeof paying == 'number' ? new BigNumber(paying) : null;
            if (!value || !value.gt(0) || !asset.isValid())
                throw new Error('Pool value must be positive');

            primaryPays.push({ asset: asset, value: value });
        }
        
        const secondaryPays: { asset: AssetId, value: BigNumber }[] = [];
        for (let assetId of Object.keys(args.secondaryPays)) {
            const asset = new AssetId(assetId);
            const paying = args.secondaryPays[assetId];
            const value = typeof paying == 'string' || typeof paying == 'number' ? new BigNumber(paying) : null;
            if (!value || !value.gt(0) || !asset.isValid())
                throw new Error('Pool value must be positive');

            secondaryPays.push({ asset: asset, value: value });
        }
        
        const marketId = typeof args.marketId == 'string' || typeof args.marketId == 'number' ? new Uint256(args.marketId) : null;
        if (!marketId)
            throw new Error('Market id must be set');

        const primaryAsset = typeof args.primaryAssetHash == 'string' || typeof args.primaryAssetHash == 'number' ? new AssetId(args.primaryAssetHash) : null;
        if (!primaryAsset)
            throw new Error('Primary asset must be set');

        const secondaryAsset = typeof args.secondaryAssetHash == 'string' || typeof args.secondaryAssetHash == 'number' ? new AssetId(args.secondaryAssetHash) : null;
        if (!secondaryAsset)
            throw new Error('Secondary asset must be set');

        const feeRate = typeof args.feeRate == 'string' || typeof args.feeRate == 'number' ? new BigNumber(args.feeRate) : null;
        if (!feeRate || !feeRate.gte(0))
            throw new Error('Pool fee rate must be set');

        const price = typeof args.price == 'string' || typeof args.price == 'number' ? new BigNumber(args.price) : null;
        if (!price || !price.gt(0))
            throw new Error('Pool price must be positive');

        const minPrice = typeof args.minPrice == 'string' || typeof args.minPrice == 'number' ? new BigNumber(args.minPrice) : null;
        if (minPrice && minPrice.gt(price))
            throw new Error('Pool min price must be lower or equal to price');

        const maxPrice = typeof args.maxPrice == 'string' || typeof args.maxPrice == 'number' ? new BigNumber(args.maxPrice) : null;
        if (maxPrice && minPrice && (maxPrice.lt(price) || maxPrice.eq(minPrice)))
            throw new Error('Pool max price must be lower or equal to price');

        const market = await Exchange.market(marketId.toString());
        if (!market || !market.account)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        const marketAccount = Signing.decodeAddress(market.account || '');
        if (!marketAccount)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        const pairId = await Exchange.marketPair(market.id, primaryAsset, secondaryAsset, true);
        if (!pairId)
            throw new Error('Pair cannot be found');

        const concentrated = minPrice && maxPrice;
        const targetPrimaryValue = primaryPays.reduce((t, i) => t.plus(i.value), new BigNumber(0));
        const targetSecondaryValue = secondaryPays.reduce((t, i) => t.plus(i.value), new BigNumber(0));
        return {
            icon: mdiWater,
            text: `Provide liquidity with ${Readability.toMoney(primaryAsset, targetPrimaryValue)} and ${Readability.toMoney(secondaryAsset, targetSecondaryValue)} as reserves with initial price at ${Readability.toMoney(secondaryAsset, price)} active in ${concentrated ? 'concentrated' : 'uniform'} range [${concentrated ? Readability.toMoney(null, minPrice) : '0'}; ${concentrated ? Readability.toMoney(null, maxPrice) + ']' : '+∞)'} and fee set at ${feeRate.multipliedBy(100).toFixed(2)}%`,
            body: {
              callable: marketAccount,
              pays: [...primaryPays, ...secondaryPays],
              function: Readability.toFunction(DEX.Spot.depositPool),
              args: [primaryAsset.toUint256(), secondaryAsset.toUint256(), price, concentrated ? minPrice : new BigNumber(-1), concentrated ? maxPrice : new BigNumber(-1), feeRate]
            }
        };
    }
    static async withdrawPool(args: { poolId: number | string }): Promise<BuilderResult> {
        const id = typeof args.poolId == 'string' || typeof args.poolId == 'number' ? new Uint256(args.poolId) : null;
        if (!id)
            throw new Error('Pool id not found');

        const pool = await Exchange.marketPool(id.toString());
        if (!pool)
            throw new Error('Pool ' + id.toString() + ' not found');

        const marketAccount = Signing.decodeAddress(pool.marketAccount || '');
        if (!marketAccount)
            throw new Error('Pool ' + id.toString() + ' market account cannot be found');

        return {
            icon: mdiWaterOff,
            text: 'Withdraw pool #' + id.toString(),
            body: {
              callable: marketAccount,
              pays: [],
              function: Readability.toFunction(DEX.Spot.withdrawPool),
              args: [new Uint256(pool.poolId.toString())]
            }
        };
    }
    static async repayAsset(args: { marketId: string, repaymentAssetHash: string, paymentAssetHash: string, pays: string }): Promise<BuilderResult> {
        const repaymentAsset = typeof args.repaymentAssetHash == 'string' || typeof args.repaymentAssetHash == 'number' ? new AssetId(args.repaymentAssetHash) : null;
        if (!repaymentAsset || !repaymentAsset.isValid())
            throw new Error('Repayment asset must be set');

        const paymentAsset = typeof args.paymentAssetHash == 'string' || typeof args.paymentAssetHash == 'number' ? new AssetId(args.paymentAssetHash) : null;
        if (!paymentAsset || !paymentAsset.isValid())
            throw new Error('Payment asset must be set');

        const value = typeof args.pays == 'string' || typeof args.pays == 'number' ? new BigNumber(args.pays) : null;
        if (!value || !value.gt(0))
            throw new Error('Value must be positive');

        const marketId = typeof args.marketId == 'string' || typeof args.marketId == 'number' ? new Uint256(args.marketId) : null;
        if (!marketId)
            throw new Error('Market id must be set');

        const market = await Exchange.market(marketId.toString());
        if (!market || !market.account)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        const marketAccount = Signing.decodeAddress(market.account || '');
        if (!marketAccount)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        return {
            icon: mdiCashRefund,
            text: `Repay ${Readability.toMoney(repaymentAsset, value)} from unified ${Readability.toAssetName(paymentAsset)}`,
            body: {
              callable: marketAccount,
              pays: [{ asset: paymentAsset, value: value }],
              function: Readability.toFunction(DEX.Spot.repayAsset),
              args: [repaymentAsset.toUint256()]
            }
        };
    }
}

export class BuilderQueue {
  static internal: BuilderResult[] = [];

  static set(newQueue: BuilderResult[]) {
    this.internal = newQueue;
    window.dispatchEvent(new CustomEvent('update:builder'));
  }
  static get(): BuilderResult[] {
    return this.internal;
  }
}

export function PerformerButton(props: { title: string, description: string, disabled?: boolean, variant?: string, color?: string, style?: CSSProperties, onBuild: () => Promise<BuilderResult | BuilderResult[] | null> }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(0);
  const navigate = useNavigate();
  const append = useCallback(async () => {
    if (loading)
      return;

    setLoading(true);
    try {
      const result = await props.onBuild();
      if (!result)
        throw new Error('Failed to receive action data');

      if (Array.isArray(result)) {
        BuilderQueue.set([...BuilderQueue.get(), ...result]);
      } else {
        BuilderQueue.set([...BuilderQueue.get(), result]);
      }
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Build failed: ' + exception.message);
    }
    setLoading(false);
  }, [loading, props.onBuild]);
  const checkout = useCallback(() => {
    try {
      if (!BuilderQueue.get().length)
        throw new Error('No actions to checkout');

      const stream = new Stream();
      if (BuilderQueue.get().length > 1) {
        SchemaUtil.storeRollup(stream, {
            signature: new Hashsig(),
            asset: new AssetId(),
            nonce: new Uint256(0),
            gasPrice: new BigNumber(0),
            gasLimit: new Uint256(0)
        }, new Transactions.Rollup(), BuilderQueue.get().map((result) => ({
          schema: new Transactions.Call(),
          args: {
            asset: new AssetId(),
            ...result.body
          }
        })));
      } else {
        const result = BuilderQueue.get()[0];
        SchemaUtil.store(stream, {
            signature: new Hashsig(),
            asset: new AssetId(),
            nonce: new Uint256(0),
            gasPrice: new BigNumber(0),
            gasLimit: new Uint256(0),
            ...result.body
        }, new Transactions.Call());
      }

      navigate(`/interaction?type=approve&transaction=${stream.encode()}&back=${encodeURIComponent(location.pathname + location.search + (location.search.indexOf('?') == -1 ? '?' : '') + 'cleanup=1')}`);
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Serialization failed: ' + exception.message);
    }
  }, [loading, props.onBuild]);
  useEffect(() => {
    const updateState = () => setState(new Date().getTime());
    window.addEventListener('update:builder', updateState);
    return () => window.removeEventListener('update:builder', updateState);
  }, []);
  useEffect(() => {
    if (searchParams.has('cleanup')) {
      const copy = new URLSearchParams(searchParams);
      copy.delete('cleanup');
      BuilderQueue.set([]);
      setSearchParams(copy);
    }
  }, [searchParams]);

  return (
    <Tooltip content={props.description}>
      <Flex style={props.style}>
        <Dialog.Root>
          <Dialog.Trigger disabled={props.disabled || loading}>
            <Flex style={props.style}>
              <Button style={{ flex: 1, width: '100%', borderTopRightRadius: 0, borderBottomRightRadius: 0 }} variant={props.variant as any || 'soft'} color={props.color as any} disabled={props.disabled || loading} onClick={() => append()}>
                { loading ? 'Building...' : props.title }
                <Spinner loading={loading}>
                  <Icon path={mdiArrowRight} size={0.75}></Icon>
                </Spinner>
              </Button>
              <Button style={{ borderLeft: '2px solid var(--gray-a5)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} variant={props.variant as any || 'soft'} color={props.color as any} disabled={props.disabled || loading}>
                <Icon path={mdiCollage} size={0.65}></Icon>
              </Button>
            </Flex>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="600px">
            <Dialog.Title>Execution plan</Dialog.Title>
            <Box key={state.toString()}>
              {
                BuilderQueue.get().map((item, index) =>
                  <Box px="2" py="2" position="relative" style={{ backgroundColor: 'var(--color-panel)', borderRadius: '22px' }} mb={index == BuilderQueue.get().length - 1 ? undefined : '3'} key={item.text + index}>
                    <Flex gap="2">
                      <Flex px="4" py="4" justify="center">
                        <Icon path={item.icon} size={1.5}></Icon>
                      </Flex>
                      <Box py="1">{ item.text }</Box>
                    </Flex>
                    <Box position="absolute" style={{ top: '-12px', right: '-12px' }}>
                      <IconButton variant="soft" size="3" color="red" onClick={() => {
                        const queue = BuilderQueue.get()
                        queue.splice(index, 1);
                        BuilderQueue.set(queue);
                      }}>
                        <Icon path={mdiClose} size={0.5}></Icon>
                      </IconButton>
                    </Box>
                  </Box>
                )
              }
              {
                !BuilderQueue.get().length &&
                <Flex px="2" py="2" width="100%" height="100px" justify="center" align="center" style={{ backgroundColor: 'var(--color-panel)', borderRadius: '22px' }}>
                  <Text color="gray">Empty plan</Text>
                </Flex>
              }
            </Box>
            <Flex justify="between" gap="1" mt="4">
              <Button variant={props.variant as any || 'soft'} color="gray" onClick={() => BuilderQueue.set([])} disabled={!BuilderQueue.get().length}>
                Clear all <Icon path={mdiCancel} size={0.65}></Icon>
              </Button>
              <Dialog.Close>
                <Button variant={props.variant as any || 'soft'} color="orange" onClick={() => BuilderQueue.get().length ? checkout() : undefined} disabled={!BuilderQueue.get().length}>
                  Checkout <Icon path={mdiArrowRight} size={0.65}></Icon>
                </Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
    </Tooltip>
  );
}