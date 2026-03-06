import { Button, DropdownMenu, Flex, Spinner, Tooltip } from "@radix-ui/themes";
import { CSSProperties, useCallback, useEffect, useState } from "react";
import { OrderCondition, OrderPolicy, OrderSide, Swap } from "../../core/swap";
import { AlertBox, AlertType } from "./../alert";
import { mdiCollage, mdiSetRight } from "@mdi/js";
import { AssetId, DEX, Hashsig, Readability, SchemaUtil, Signing, Stream, Transactions, Uint256 } from "tangentsdk";
import { useNavigate } from "react-router";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

export enum BuildAction {
  ImmediateBuild,
  DeferredAdd,
  DeferredBuild
}

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
    }): Promise<Record<string, any>> {
        const pays: { asset: AssetId, value: BigNumber }[] = [];
        for (let assetId of Object.keys(args.pays)) {
            const asset = new AssetId(assetId);
            const paying = args.pays[assetId];
            const value = typeof paying == 'string' || typeof paying == 'number' ? new BigNumber(paying) : null;
            if (!value || !value.gt(0) || !asset.isValid())
                throw new Error('Order value must be positive');

            pays.push({ asset: asset, value: value });
        }
        
        const market = await Swap.market(args.marketId);
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

        const pair = await Swap.marketPair(market.id, primaryAsset, secondaryAsset, true);
        if (!pair)
            throw new Error('Pair cannot be found');

        let method: string, parameters: any[];
        const price = typeof args.price == 'string' || typeof args.price == 'number' ? new BigNumber(args.price) : null;
        const stopPrice = typeof args.stopPrice == 'string' || typeof args.stopPrice == 'number' ? new BigNumber(args.stopPrice) : null;
        switch (condition) {
            case OrderCondition.Market: {
                const slippage = typeof args.slippage == 'string' || typeof args.slippage == 'number' ? new BigNumber(args.slippage) : null;
                if (!slippage)
                    throw new Error('Order slippage must be set');

                if (!pair.price.close || !pair.price.close.gt(0))
                    throw new Error('No last price to calculate slippage price from');

                const distance = slippage.lt(0) ? slippage.multipliedBy(pair.price.close.negated()) : slippage;
                const slippagePrice = side == OrderSide.Buy ? pair.price.close.plus(distance) : BigNumber.max(pair.price.close.minus(distance), 0);
                method = DEX.Spot.marketOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, slippagePrice];
                break;
            }
            case OrderCondition.Limit: {
                if (!price || !price.gt(0))
                    throw new Error('Order price must be positive');

                method = DEX.Spot.limitOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, price];
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
                break;
            }
            case OrderCondition.StopLimit: {
                if (!stopPrice || !stopPrice.gt(0))
                    throw new Error('Order stop price must be positive');

                if (!price || !price.gt(0))
                    throw new Error('Order price must be positive');

                method = DEX.Spot.stopLimitOrder;
                parameters = [primaryAsset.toUint256(), secondaryAsset.toUint256(), side, policy, stopPrice, price];
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
                break;
            }
            default:
                throw new Error('Invalid order condition');
        }
        
        return {
          callable: marketAccount,
          pays: pays,
          function: Readability.toFunction(method),
          args: parameters
        };
    }
    static async withdrawOrder(args: { orderId: number | string }): Promise<Record<string, any>> {
        const id = typeof args.orderId == 'string' || typeof args.orderId == 'number' ? new Uint256(args.orderId) : null;
        if (!id)
            throw new Error('Order id not found');

        const order = await Swap.marketOrder(id.toString());
        if (!order)
            throw new Error('Order ' + id.toString() + ' not found');

        const marketAccount = Signing.decodeAddress(order.marketAccount || '');
        if (!marketAccount)
            throw new Error('Order ' + id.toString() + ' market account cannot be found');
      
        return {
          callable: marketAccount,
          pays: [],
          function: Readability.toFunction(DEX.Spot.withdrawOrder),
          args: [new Uint256(order.orderId.toString())]
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
    }): Promise<Record<string, any>> {
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

        const market = await Swap.market(marketId.toString());
        if (!market || !market.account)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        const marketAccount = Signing.decodeAddress(market.account || '');
        if (!marketAccount)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        const pairId = await Swap.marketPair(market.id, primaryAsset, secondaryAsset, true);
        if (!pairId)
            throw new Error('Pair cannot be found');

        const concentrated = minPrice && maxPrice;
        return {
          callable: marketAccount,
          pays: [...primaryPays, ...secondaryPays],
          function: Readability.toFunction(DEX.Spot.depositPool),
          args: [primaryAsset.toUint256(), secondaryAsset.toUint256(), price, concentrated ? minPrice : new BigNumber(-1), concentrated ? maxPrice : new BigNumber(-1), feeRate]
        };
    }
    static async withdrawPool(args: { poolId: number | string }): Promise<Record<string, any>> {
        const id = typeof args.poolId == 'string' || typeof args.poolId == 'number' ? new Uint256(args.poolId) : null;
        if (!id)
            throw new Error('Pool id not found');

        const pool = await Swap.marketPool(id.toString());
        if (!pool)
            throw new Error('Pool ' + id.toString() + ' not found');

        const marketAccount = Signing.decodeAddress(pool.marketAccount || '');
        if (!marketAccount)
            throw new Error('Pool ' + id.toString() + ' market account cannot be found');

        return {
          callable: marketAccount,
          pays: [],
          function: Readability.toFunction(DEX.Spot.withdrawPool),
          args: [new Uint256(pool.poolId.toString())]
        };
    }
    static async repayAsset(args: { marketId: string, repaymentAssetHash: string, paymentAssetHash: string, pays: string }): Promise<Record<string, any>> {
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

        const market = await Swap.market(marketId.toString());
        if (!market || !market.account)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        const marketAccount = Signing.decodeAddress(market.account || '');
        if (!marketAccount)
            throw new Error('Market ' + marketId.toString() + ' account cannot be found');

        return {
          callable: marketAccount,
          pays: [{ asset: paymentAsset, value: value }],
          function: Readability.toFunction(DEX.Spot.repayAsset),
          args: [repaymentAsset.toUint256()]
        };
    }
}

export class BuilderQueue {
  static internal: Record<string, any>[] = [];

  static set(newQueue: Record<string, any>[]) {
    this.internal = newQueue;
    window.dispatchEvent(new CustomEvent('update:builder'));
  }
  static get(): Record<string, any>[] {
    return this.internal;
  }
}

export function PerformerButton(props: { title: string, description: string, disabled?: boolean, variant?: string, color?: string, style?: CSSProperties, onBuild: () => Promise<Record<string, any> | null> }) {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState(0);
  const navigate = useNavigate();
  const interact = useCallback((stream: Stream) => {
    return navigate(`/interaction?type=approve&transaction=${stream.encode()}&back=${encodeURIComponent(location.pathname + location.search)}`);
  }, [navigate]);
  const build = useCallback(async (type: BuildAction) => {
    if (loading)
      return;

    setLoading(true);
    try {
      switch (type) {
        case BuildAction.ImmediateBuild: {
          const body = await props.onBuild();
          if (!body)
            throw new Error('Immediate action build failed');

          const stream = new Stream();
          SchemaUtil.store(stream, {
              signature: new Hashsig(),
              asset: new AssetId(),
              nonce: new Uint256(0),
              gasPrice: new BigNumber(0),
              gasLimit: new Uint256(0),
              ...body
          }, new Transactions.Call());
          interact(stream);
          break;
        }
        case BuildAction.DeferredAdd: {
          const body = await props.onBuild();
          if (!body)
            throw new Error('Deferred action build failed');

          BuilderQueue.set([...BuilderQueue.get(), body])
          break;
        }
        case BuildAction.DeferredBuild: {
          if (!BuilderQueue.get().length)
            throw new Error('Must have deferred actions');

          const stream = new Stream();
          if (BuilderQueue.get().length > 1) {
            SchemaUtil.storeRollup(stream, {
                signature: new Hashsig(),
                asset: new AssetId(),
                nonce: new Uint256(0),
                gasPrice: new BigNumber(0),
                gasLimit: new Uint256(0)
            }, new Transactions.Rollup(), BuilderQueue.get().map((body) => ({
              schema: new Transactions.Call(),
              args: {
                asset: new AssetId(),
                ...body
              }
            })));
          } else {
            const body = BuilderQueue.get()[0];
            SchemaUtil.store(stream, {
                signature: new Hashsig(),
                asset: new AssetId(),
                nonce: new Uint256(0),
                gasPrice: new BigNumber(0),
                gasLimit: new Uint256(0),
                ...body
            }, new Transactions.Call());
          }
          interact(stream);
          BuilderQueue.set([]);
          break;
        }
      }
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Build failed: ' + exception.message);
    }
    setLoading(false);
  }, [loading, props.onBuild]);
  useEffect(() => {
    const updateState = () => setState(new Date().getTime());
    window.addEventListener('update:builder', updateState);
    return () => window.removeEventListener('update:builder', updateState);
  }, []);

  return (
    <Tooltip content={props.description}>
      <Flex style={props.style}>
        <Button style={{ flex: 1, width: '100%', borderTopRightRadius: 0, borderBottomRightRadius: 0 }} variant={props.variant as any || 'soft'} color={props.color as any} disabled={props.disabled || loading} onClick={() => build(BuildAction.ImmediateBuild)}>
          <Spinner loading={loading}>
            <Icon path={mdiSetRight} size={0.75}></Icon>
          </Spinner>
          { loading ? 'Building...' : props.title }
        </Button>
        <DropdownMenu.Root key={state.toString()}>
          <DropdownMenu.Trigger disabled={props.disabled || loading}>
            <Button style={{ borderLeft: '2px solid var(--gray-a5)', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} variant={props.variant as any || 'soft'} color={props.color as any}>
              <Icon path={mdiCollage} size={0.65}></Icon>
              { BuilderQueue.get().length > 0 ? 'Multi (' + BuilderQueue.get().length + ')' : 'Multi' }
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item color="yellow" onClick={() => build(BuildAction.DeferredAdd)}>Add: { props.title }</DropdownMenu.Item>
            {
              BuilderQueue.get().length > 0 &&
              <>
                <DropdownMenu.Item color="jade" onClick={() => BuilderQueue.get().length ? build(BuildAction.DeferredBuild) : undefined} disabled={!BuilderQueue.get().length}>Execute { Readability.toCount('action', BuilderQueue.get().length) }</DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item color="red" onClick={() => BuilderQueue.set([])}>Cleanup { Readability.toCount('action', BuilderQueue.get().length) }</DropdownMenu.Item>
              </>
            }
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>
    </Tooltip>
  );
}