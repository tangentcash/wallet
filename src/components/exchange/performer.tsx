import { Box, Button, Dialog, Flex, IconButton, Spinner, Text, Tooltip } from "@radix-ui/themes";
import { CSSProperties, useCallback, useEffect, useState } from "react";
import { OrderCondition, OrderPolicy, OrderSide, Exchange, RouterPath, Market, AggregatedPair } from "../../core/exchange";
import { AlertBox, AlertType } from "./../alert";
import { mdiArrowRight, mdiBlur, mdiBlurOff, mdiCancel, mdiCashRefund, mdiClose, mdiCollage, mdiSwapHorizontalVariant, mdiWater, mdiWaterOff } from "@mdi/js";
import { AssetId, Hashsig, Readability, SchemaUtil, Signing, Spot, Stream, Transactions, Uint256 } from "tangentsdk";
import { useNavigate } from "react-router";
import { AppData } from "../../core/app";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

export type BuilderResult = {
  icon: string,
  text: string,
  body: Record<string, any>
};

export type BuilderQueueItem = {
  result: BuilderResult,
  recent: boolean
}

export class Builder {
    static async swap(args: {
      tokenIn: AssetId | null,
      tokenOut: AssetId | null,
      amountIn: string,
      amountOut: string,
      slippage: string,
      path: RouterPath,
      pays: Record<string, string>
      marketId: string,
    }): Promise<BuilderResult[]> {
        const payment = Exchange.parsePayment(args.pays);
        if (!payment) {
            throw new Error('Token in value must be positive');
        } else if (payment.value.lt(args.amountIn)) {
            throw new Error('Not enough balance to build a swap');
        }

        const marketId = typeof args.marketId == 'string' || typeof args.marketId == 'number' ? new BigNumber(args.marketId) : null;
        if (!marketId)
            throw new Error('Market id must be set');

        const market = Exchange.markets.find((v) => v.id.eq(marketId));
        if (!market || !market.account)
            throw new Error('Market ' + args.marketId.toString() + ' account cannot be found');

        const marketAccount = Signing.decodeAddress(market.account || '');
        if (!marketAccount)
            throw new Error('Market ' + market.id.toString() + ' account cannot be found');

        return args.path.map((swap, swapIndex) => {
            const tokenIn = (swap.side == OrderSide.Buy ? swap.pair.secondaryAsset?.hash : swap.pair.primaryAsset?.hash) || null;
            if (!tokenIn)
                throw new Error('Token in must be set');

            const tokenOut = (swap.side == OrderSide.Buy ? swap.pair.primaryAsset?.hash : swap.pair.secondaryAsset?.hash) || null;
            if (!tokenOut)
                throw new Error('Token out must be set');

            const slippagePrice = (swap.side == OrderSide.Buy ? swap.input.max.dividedBy(swap.output.min) : swap.output.min.dividedBy(swap.input.max));
            const primaryAsset = (swap.side == OrderSide.Buy ? tokenOut : tokenIn);
            const secondaryAsset = (swap.side == OrderSide.Buy ? tokenIn : tokenOut);
            return {
                icon: mdiSwapHorizontalVariant,
                text: `Swap ${Readability.toMoney(tokenIn, swap.input.max)} and receive between [${Readability.toMoney(tokenOut, swap.output.min)}; ${Readability.toMoney(tokenOut, swap.output.max)}]`,
                body: {
                    callable: marketAccount,
                    pays: swapIndex == 0 ? payment.pays : [{ asset: tokenIn, value: swap.input.max }],
                    function: (swapIndex > 0 ? '>' : '') + Readability.toFunction(Spot.DEX.marketOrder),
                    args: [primaryAsset?.toUint256(), secondaryAsset?.toUint256(), swap.side, OrderPolicy.Immediate, slippagePrice]
                }
            }
        });
    }
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
        const payment = Exchange.parsePayment(args.pays);
        if (!payment)
            throw new Error('Order value must be positive');
        
        const marketId = typeof args.marketId == 'string' || typeof args.marketId == 'number' ? new BigNumber(args.marketId) : null;
        if (!marketId)
            throw new Error('Market id must be set');

        const market = Exchange.markets.find((v) => v.id.eq(marketId));
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

        let levelPrice: BigNumber | null = null;
        try {
          const levels = await Exchange.marketPairPriceLevels(market.id, pair.id, 1);
          levelPrice = levels[side == OrderSide.Buy ? 'ask' : 'bid'][0]?.price || null;
        } catch { }
        
        let text: string, method: string, parameters: any[];
        const price = typeof args.price == 'string' || typeof args.price == 'number' ? new BigNumber(args.price) : null;
        const stopPrice = typeof args.stopPrice == 'string' || typeof args.stopPrice == 'number' ? new BigNumber(args.stopPrice) : null;
        const targetPrice = price || stopPrice || levelPrice;
        const targetValue = payment.value;
        const toText = (order: { primaryAsset: AssetId, secondaryAsset: AssetId, condition: OrderCondition, side: OrderSide, slippage?: BigNumber, stopPrice?: BigNumber, trailingStep?: BigNumber, trailingDistance?: BigNumber, price?: BigNumber, value: BigNumber }, targetPrice?: BigNumber | null) => {
            const toPercentile = (asset: AssetId, value?: BigNumber | null) => value ? (value.gte(0) ? Readability.toMoney(asset, value) : value.negated().multipliedBy(100).toFixed(2) + '%') : 'N/A';
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

                if (!levelPrice?.gt(0))
                    throw new Error('No last price to calculate slippage price from');

                const distance = slippage.lt(0) ? slippage.multipliedBy(levelPrice.negated()) : slippage;
                const slippagePrice = side == OrderSide.Buy ? levelPrice.plus(distance) : BigNumber.max(levelPrice.minus(distance), 0);
                method = Spot.DEX.marketOrder;
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

                method = Spot.DEX.limitOrder;
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

                method = Spot.DEX.stopOrder;
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

                method = Spot.DEX.stopLimitOrder;
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

                method = Spot.DEX.trailingStopOrder;
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

                method = Spot.DEX.trailingStopLimitOrder;
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
              pays: payment.pays,
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
              function: Readability.toFunction(Spot.DEX.withdrawOrder),
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
    }, ref?: { market: Market, pair: AggregatedPair }): Promise<BuilderResult> {
        if (typeof args.primaryPays != 'object' || typeof args.secondaryPays != 'object')
            throw new Error('Pool value must be set');

        const primaryPayment = Exchange.parsePayment(args.primaryPays);
        if (!primaryPayment)
            throw new Error('Primary pool value must be positive');
        
        const secondaryPayment = Exchange.parsePayment(args.secondaryPays);
        if (!secondaryPayment)
            throw new Error('Secondary pool value must be positive');
        
        const marketId = typeof args.marketId == 'string' || typeof args.marketId == 'number' ? new BigNumber(args.marketId) : null;
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

        const market = Exchange.markets.find((v) => v.id.eq(marketId));
        if (!market || !market.account)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        const marketAccount = Signing.decodeAddress(market.account || '');
        if (!marketAccount)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        const pairId = ref ? ref.pair : await Exchange.marketPair(market.id, primaryAsset, secondaryAsset, true);
        if (!pairId)
            throw new Error('Pair cannot be found');

        const concentrated = minPrice && maxPrice;
        const targetPrimaryValue = primaryPayment.value;
        const targetSecondaryValue = secondaryPayment.value;
        return {
            icon: mdiWater,
            text: `Provide liquidity with ${Readability.toMoney(primaryAsset, targetPrimaryValue)} and ${Readability.toMoney(secondaryAsset, targetSecondaryValue)} as reserves with initial price at ${Readability.toMoney(secondaryAsset, price)} active in ${concentrated ? 'concentrated' : 'uniform'} range [${concentrated ? Readability.toMoney(null, minPrice) : '0'}; ${concentrated ? Readability.toMoney(null, maxPrice) + ']' : '+∞)'} and fee set at ${feeRate.multipliedBy(100).toFixed(2)}%`,
            body: {
              callable: marketAccount,
              pays: [...primaryPayment.pays, ...secondaryPayment.pays],
              function: Readability.toFunction(Spot.DEX.depositPool),
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
              function: Readability.toFunction(Spot.DEX.withdrawPool),
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

        const marketId = typeof args.marketId == 'string' || typeof args.marketId == 'number' ? new BigNumber(args.marketId) : null;
        if (!marketId)
            throw new Error('Market id must be set');

        const market = Exchange.markets.find((v) => v.id.eq(marketId));
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
              function: Readability.toFunction(Spot.DEX.repayAsset),
              args: [repaymentAsset.toUint256()]
            }
        };
    }
    static async depositLiquidity(args: { delegatorId: string, primaryAssetHash: string, secondaryAssetHash: string, primaryValue: string, secondaryValue: string }): Promise<BuilderResult> {
        const primaryAsset = typeof args.primaryAssetHash == 'string' || typeof args.primaryAssetHash == 'number' ? new AssetId(args.primaryAssetHash) : null;
        if (!primaryAsset || !primaryAsset.isValid())
            throw new Error('Primary asset must be set');

        const secondaryAsset = typeof args.secondaryAssetHash == 'string' || typeof args.secondaryAssetHash == 'number' ? new AssetId(args.secondaryAssetHash) : null;
        if (!secondaryAsset || !secondaryAsset.isValid())
            throw new Error('Secondary asset must be set');

        const primaryValue = typeof args.primaryValue == 'string' || typeof args.primaryValue == 'number' ? new BigNumber(args.primaryValue) : null;
        if (!primaryValue?.gte(0))
            throw new Error('Primary value must be set');

        const secondaryValue = typeof args.secondaryValue == 'string' || typeof args.secondaryValue == 'number' ? new BigNumber(args.secondaryValue) : null;
        if (!secondaryValue?.gte(0))
            throw new Error('Secondary value must be set');

        if (!primaryValue.gt(0) && !secondaryValue.gt(0))
            throw new Error('Primary/secondary value must greater than zero');

        const delegatorId = typeof args.delegatorId == 'string' || typeof args.delegatorId == 'number' ? new BigNumber(args.delegatorId) : null;
        if (!delegatorId)
            throw new Error('Market id must be set');

        const delegator = Exchange.delegators.find((v) => v.id.eq(delegatorId));
        if (!delegator || !delegator.account)
            throw new Error('Delegator ' + delegatorId.toString() + ' account cannot be found');

        const delegatorAccount = Signing.decodeAddress(delegator.account || '');
        if (!delegatorAccount)
            throw new Error('Delegator ' + delegatorId.toString() + ' account cannot be found');

        let liquidityText = '';
        if (primaryValue.gt(0)) liquidityText += Readability.toMoney(primaryAsset, primaryValue);
        if (secondaryValue.gt(0)) liquidityText += (liquidityText.length > 0 ? ' + ' : '') + Readability.toMoney(secondaryAsset, secondaryValue);
        return {
            icon: mdiWater,
            text: `Deposit ${liquidityText} liquidity into delegated ${Readability.toAssetSymbol(primaryAsset)}/${Readability.toAssetSymbol(secondaryAsset)} LP`,
            body: {
              callable: delegatorAccount,
              pays: [{ asset: primaryAsset, value: primaryValue }, { asset: secondaryAsset, value: secondaryValue }].filter((v) => v.value.gt(0)),
              function: Readability.toFunction(Spot.DLP.depositLiquidity),
              args: [primaryAsset.toUint256(), secondaryAsset.toUint256()]
            }
        };
    }
    static async withdrawLiquidity(args: { delegatorId: string, primaryAssetHash: string, secondaryAssetHash: string, primaryValue: string, secondaryValue: string }): Promise<BuilderResult> {
        const primaryAsset = typeof args.primaryAssetHash == 'string' || typeof args.primaryAssetHash == 'number' ? new AssetId(args.primaryAssetHash) : null;
        if (!primaryAsset || !primaryAsset.isValid())
            throw new Error('Primary asset must be set');

        const secondaryAsset = typeof args.secondaryAssetHash == 'string' || typeof args.secondaryAssetHash == 'number' ? new AssetId(args.secondaryAssetHash) : null;
        if (!secondaryAsset || !secondaryAsset.isValid())
            throw new Error('Secondary asset must be set');

        const primaryValueFull = typeof args.primaryValue == 'string' && !args.primaryValue.length;
        const primaryValue = typeof args.primaryValue == 'string' || typeof args.primaryValue == 'number' ? new BigNumber(args.primaryValue) : null;
        if (!primaryValueFull && !primaryValue?.gte(0))
            throw new Error('Primary value must be set');

        const secondaryValueFull = typeof args.secondaryValue == 'string' && !args.secondaryValue.length;
        const secondaryValue = typeof args.secondaryValue == 'string' || typeof args.secondaryValue == 'number' ? new BigNumber(args.secondaryValue) : null;
        if (!secondaryValueFull && !secondaryValue?.gte(0))
            throw new Error('Secondary value must be set');

        if (!primaryValueFull && !primaryValue?.gt(0) && !secondaryValueFull && !secondaryValue?.gt(0))
            throw new Error('Primary/secondary value must greater than zero');

        const delegatorId = typeof args.delegatorId == 'string' || typeof args.delegatorId == 'number' ? new BigNumber(args.delegatorId) : null;
        if (!delegatorId)
            throw new Error('Market id must be set');

        const delegator = Exchange.delegators.find((v) => v.id.eq(delegatorId));
        if (!delegator || !delegator.account)
            throw new Error('Delegator ' + delegatorId.toString() + ' account cannot be found');

        const delegatorAccount = Signing.decodeAddress(delegator.account || '');
        if (!delegatorAccount)
            throw new Error('Delegator ' + delegatorId.toString() + ' account cannot be found');

        let liquidityText = '';
        if (primaryValue?.gte(0)) {
          liquidityText += Readability.toMoney(primaryAsset, primaryValue);
        } else if (primaryValueFull) {
          liquidityText += '100% ' + Readability.toAssetSymbol(primaryAsset);
        }
        if (secondaryValue?.gte(0)) {
          liquidityText += (liquidityText.length > 0 ? ' + ' : '') + Readability.toMoney(secondaryAsset, secondaryValue);
        } else {
          liquidityText += (liquidityText.length > 0 ? ' + ' : '') + '100% ' + Readability.toAssetSymbol(secondaryAsset);
        }
        return {
            icon: mdiWater,
            text: `Withdraw ${liquidityText} liquidity delegated to ${Readability.toAssetSymbol(primaryAsset)}/${Readability.toAssetSymbol(secondaryAsset)} LP`,
            body: {
              callable: delegatorAccount,
              pays: [],
              function: Readability.toFunction(Spot.DLP.withdrawLiquidity),
              args: [primaryAsset.toUint256(), secondaryAsset.toUint256(), primaryValueFull ? new BigNumber(NaN) : primaryValue, secondaryValueFull ? new BigNumber(NaN) : secondaryValue]
            }
        };
    }
}

export class BuilderQueue {
  static internal: BuilderQueueItem[] = [];

  static set(newQueue: BuilderQueueItem[]) {
    this.internal = newQueue;
    window.dispatchEvent(new CustomEvent('update:builder'));
  }
  static get(): BuilderQueueItem[] {
    return this.internal;
  }
}

export function PerformerButton(props: { title: string, description: string, disabled?: boolean, variant?: string, color?: string, style?: CSSProperties, onBuild: () => Promise<BuilderResult | BuilderResult[] | null> }) {
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

      const prev = BuilderQueue.get();
      for (let i = 0; i < prev.length; i++)
        prev[i].recent = false;

      if (Array.isArray(result)) {
        BuilderQueue.set([...prev, ...result.map(x => ({ result: x, recent: true }))]);
      } else {
        BuilderQueue.set([...prev, { result: result, recent: true }]);
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
        }, new Transactions.Rollup(), BuilderQueue.get().map((item) => ({
          schema: new Transactions.Call(),
          args: {
            asset: new AssetId(),
            ...item.result.body
          }
        })));
      } else {
        const item = BuilderQueue.get()[0];
        SchemaUtil.store(stream, {
            signature: new Hashsig(),
            asset: new AssetId(),
            nonce: new Uint256(0),
            gasPrice: new BigNumber(0),
            gasLimit: new Uint256(0),
            ...item.result.body
        }, new Transactions.Call());
      }

      navigate(`/interaction?type=approve&transaction=${stream.encode()}&back=${encodeURIComponent(location.pathname + location.search)}`);
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Serialization failed: ' + exception.message);
    }
  }, [loading, props.onBuild]);
  useEffect(() => {
    if (AppData.mayResetBuilder) {
      BuilderQueue.set([]);
      AppData.mayResetBuilder = false;
    }

    const updateState = () => setState(new Date().getTime());
    window.addEventListener('update:builder', updateState);
    return () => window.removeEventListener('update:builder', updateState);
  }, []);

  return (
    <Tooltip content={props.description}>
      <Flex style={props.style}>
        <Dialog.Root>
          <Dialog.Trigger disabled={props.disabled || loading}>
            <Flex style={props.style}>
              <Button style={{ flex: 1, width: '100%', borderTopRightRadius: 0, borderBottomRightRadius: 0 }} variant={props.variant as any || 'soft'} color={props.color as any} disabled={props.disabled || loading} onClick={() => append()}>
                <Spinner loading={loading}>
                  { props.title }
                </Spinner>
              </Button>
              <Button style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} variant={props.variant as any || 'soft'} color={props.color as any} disabled={props.disabled || loading}>
                <Icon path={mdiCollage} size={0.65}></Icon>
              </Button>
            </Flex>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="600px">
            <Dialog.Title>Execution plan</Dialog.Title>
            <Box key={state.toString()}>
              {
                BuilderQueue.get().map((item, index) =>
                  <Box px="2" py="2" position="relative" style={{ backgroundColor: item.recent ? 'var(--accent-a3)' : 'var(--color-panel)', borderRadius: '22px' }} mb={index == BuilderQueue.get().length - 1 ? undefined : '3'} key={item.result.text + index}>
                    <Flex gap="2">
                      <Flex px="4" py="4" justify="center">
                        <Icon path={item.result.icon} size={1.5}></Icon>
                      </Flex>
                      <Box py="1">{ item.result.text }</Box>
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
                <Flex px="2" py="2" width="100%" height="100px" justify="center" align="center" className="rt-Card" style={{ backgroundColor: 'var(--color-panel)', borderRadius: '22px' }}>
                  <Text color="gray">Empty plan</Text>
                </Flex>
              }
            </Box>
            <Flex justify="between" gap="1" mt="4">
              <Button variant={props.variant as any || 'soft'} color="gray" onClick={() => BuilderQueue.set([])} disabled={!BuilderQueue.get().length}>
                Clear all <Icon path={mdiCancel} size={0.65}></Icon>
              </Button>
              <Dialog.Close>
                <Button variant={props.variant as any || 'soft'} onClick={() => BuilderQueue.get().length ? checkout() : undefined} disabled={!BuilderQueue.get().length}>
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