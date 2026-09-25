import { Badge, Box, Button, Card, Dialog, Flex, Text } from "@radix-ui/themes";
import { Order, OrderCondition, OrderPolicy, OrderSide, Exchange } from "../../core/exchange";
import { AssetId } from "tangentsdk/algorithm";
import { UiUtil } from "tangentsdk/ui";
import { Assetlist } from "tangentsdk/assetlist";
import { useMemo, useState } from "react";
import { AlertBox, AlertType } from "../alert";
import { Link } from "react-router";
import { mdiOpenInNew } from "@mdi/js";
import Icon from "@mdi/react";
import { PerformerButton, Builder } from "./performer";
import * as Collapsible from "@radix-ui/react-collapsible";

export default function OrderView(props: { item: Order, open?: boolean, flash?: boolean, readOnly?: boolean }) {
  const item = props.item;
  const [expanded, setExpanded] = useState(props.open || false);
  const price = useMemo((): BigNumber | null => {
    return item.price || item.stopPrice || item.fillingPrice || null;
  }, [props]);
  const possiblePrice = useMemo((): BigNumber | null => {
    return price || Exchange.priceOf(item.primaryAsset, item.secondaryAsset).close
  }, [props, price]);
  const quantity = useMemo((): BigNumber | null => {
    if (item.side == OrderSide.Sell)
      return item.startingValue;
    return price ? item.startingValue.dividedBy(price) : null;
  }, [price]);
  const leftoverQuantity = useMemo((): BigNumber | null => {
    if (item.side == OrderSide.Sell)
      return item.value;
    return price ? item.value.dividedBy(price) : null;
  }, [price]);
  const paidAsset = useMemo((): AssetId => {
    return item.side == OrderSide.Buy ? item.secondaryAsset : item.primaryAsset;
  }, [props]);
  const condition = useMemo((): string => {
    switch (item.condition) {
      case OrderCondition.Market:
        return 'Market';
      case OrderCondition.Limit:
        return 'Limit';
      case OrderCondition.Stop:
        return 'Stop';
      case OrderCondition.StopLimit:
        return 'Stop limit';
      case OrderCondition.TrailingStop:
        return 'Trailing stop';
      case OrderCondition.TrailingStopLimit:
        return 'Trailing stop limit';
    }
  }, [props]);
  const side = useMemo((): string => {
    switch (item.side) {
      case OrderSide.Buy:
        return 'Buy';
      case OrderSide.Sell:
        return 'Sell';
    }
  }, [props]);
  const policy = useMemo((): string => {
    switch (item.policy) {
      case OrderPolicy.Deferred:
        return 'GTC (deferred)';
      case OrderPolicy.DeferredAll:
        return 'FOK (deferred but all)';
      case OrderPolicy.Immediate:
        return 'IOC (immediate)';
      case OrderPolicy.ImmediateAll:
        return 'FOK (immediate but all)';
    }
  }, [props]);
  const progress = useMemo((): number => {
    if (item.startingValue.lte(0))
      return 100;
    else if (item.startingValue.lt(item.value))
      return 0;  
    return item.startingValue.minus(item.value).dividedBy(item.startingValue).multipliedBy(100).toNumber();
  }, [props]);
  const status = useMemo((): string => {
    if (!item.active)
      return (progress > 0 ? (progress >= 100 ? 'Filled' : 'Partially filled (leftover cancelled)') : 'Cancelled');

    return (progress > 0 ? (progress >= 100 ? 'Filled' : 'Partially filled') : 'No match yet');
  }, [progress]);

  const symP = item.primaryAsset.token || item.primaryAsset.chain;
  const symQ = item.secondaryAsset.token || item.secondaryAsset.chain;
  const FullOrderView = (subprops: { open?: boolean }) => (
    <Collapsible.Root open={subprops.open || expanded}>
      <div className={subprops.open ? undefined : 'card-expander'} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, color: 'inherit', cursor: subprops.open ? undefined : 'pointer' }} onClick={() => subprops.open ? undefined : setExpanded(!expanded)}>
        <div className="order-head">
          <span className={ 'side ' + (item.side == OrderSide.Buy ? 'buy' : 'sell') } style={{ textDecoration: item.active ? undefined : 'line-through' }}>{ side }-{ condition }</span>
          <span className="badge flat mono" style={{ flex: 'none' }}>{ symP }x{ symQ }</span>
        </div>
        <div className="mono tiny dim" style={{ marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          { quantity ? UiUtil.toMoney(null, quantity) : '(N/A)' } × { price ? UiUtil.toMoney(item.secondaryAsset, price) : 'market price' }
        </div>
        <div className="progress"><i style={{ width: Math.min(100, Math.max(0, progress)) + '%', background: progress > 0 ? undefined : 'var(--elev)' }}></i></div>
        <div className="pct-label">
          <span>{ progress.toFixed(1) }% filled</span>
          <span style={{ textAlign: 'right' }}>{ item.active ? (progress > 0 ? UiUtil.toMoney(item.primaryAsset, leftoverQuantity) + ' open' : 'waiting for match') : status.toLowerCase() }</span>
        </div>
      </div>
        {
          !props.flash && !props.readOnly && item.active &&
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PerformerButton className="btn-sm btn-ghost" title="Cancel" description="Smart contract will re-pay you back all unfilled value after this action" variant="classic" color="gray" onBuild={() => {
                return Builder.withdrawOrder({ orderId: item.id.toString() });
              }}></PerformerButton>
            </div>
          </div>
        }
      <Collapsible.Content>
        <div className="dl dl-rule" style={{ marginTop: 16 }}>
          <div className="dl-row"><span className="dl-k">Market account</span><span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(item.marketAccount || 'NULL');
            AlertBox.open(AlertType.Info, 'Address copied!')
          }}>{ UiUtil.toAddress(item.marketAccount || 'NULL') }</span>
          <Link className="dl-open router-link" to={'/portfolio/' + item.marketAccount + '?view=wallet'}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
          <div className="dl-row"><span className="dl-k">Primary asset</span><span className="dl-v">{ Assetlist.toName(item.primaryAsset) }</span></div>
          <div className="dl-row"><span className="dl-k">Secondary asset</span><span className="dl-v">{ Assetlist.toName(item.secondaryAsset) }</span></div>
          <div className="dl-row"><span className="dl-k">Reference</span><span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(item.orderId.toString(16));
            AlertBox.open(AlertType.Info, 'Reference copied!')
          }}>0x{ item.orderId.toString(16).length > 8 ? UiUtil.toHash(item.orderId.toString(16), 6) : item.orderId.toString(16) }</span></span></div>
          <div className="dl-row"><span className="dl-k">Status</span><span className="dl-v"><Badge color={item.active ? (progress > 0 ? (progress >= 100 ? undefined : 'yellow') : 'gray') : 'gray'}>{ status }</Badge></span></div>
          <div className="dl-row"><span className="dl-k">Side</span><span className="dl-v"><Badge color={item.side == OrderSide.Buy ? undefined : 'red'}>{ side } order</Badge></span></div>
          <div className="dl-row"><span className="dl-k">Trigger</span><span className="dl-v"><Badge color="yellow">{ condition } price</Badge></span></div>
          <div className="dl-row"><span className="dl-k">Condition</span><span className="dl-v"><Badge color="blue">{ policy }</Badge></span></div>
          <div className="dl-row"><span className="dl-k">Price</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, price) }</span></div>
          {
            item.price && (!price || !item.price.eq(price)) &&
            <div className="dl-row"><span className="dl-k">Base price</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, item.price) }</span></div>
          }
          {
            item.stopPrice &&
            <div className="dl-row"><span className="dl-k">Stop price</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, item.stopPrice) }</span></div>
          }
          {
            item.trailingStep &&
            <div className="dl-row"><span className="dl-k">Trailing step</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, item.trailingStep) }</span></div>
          }
          {
            item.trailingDistance &&
            <div className="dl-row"><span className="dl-k">Trailing distance</span><span className="dl-v">{ UiUtil.toMoney(item.secondaryAsset, item.trailingDistance) }</span></div>
          }
          {
            item.slippage &&
            <div className="dl-row"><span className="dl-k">{ item.condition == OrderCondition.Market ? 'Slippage price' : 'Price slippage' }</span><span className="dl-v">{ item.slippage.lt(0) ? item.slippage.negated().multipliedBy(100).toFixed(2) + '%' : UiUtil.toMoney(item.secondaryAsset, item.slippage) }</span></div>
          }
          <div className="dl-row"><span className="dl-k">Quantity</span><span className="dl-v">{ UiUtil.toMoney(item.primaryAsset, quantity) }{ quantity && quantity.isFinite() && price && price.isFinite() ? ` / ${UiUtil.toMoney(item.secondaryAsset, quantity.multipliedBy(price))}` : '' }</span></div>
          <div className="dl-row"><span className="dl-k">Leftover</span><span className="dl-v">{ UiUtil.toMoney(paidAsset, item.value) } / { (100 - progress).toFixed(2) }%</span></div>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
  return (
    <Card variant="surface" style={{ padding: '18px 18px 16px', position: "relative" }}>
      {
        props.flash &&
        <Box>
          <Dialog.Root>
            <Dialog.Trigger>
              <Button variant="surface" color="gray" style={{ display: 'block', width: '100%', height: 'auto', padding: '4px', backgroundColor: 'transparent', boxShadow: 'none' }}>
                <Flex direction="column" gap="2">
                  {
                    item.stopPrice &&
                    <Flex justify="between" wrap="wrap" gap="1">
                      <Text size="2" color="gray">Trigger at</Text>
                      <Text size="2" style={{ color: 'var(--gray-12)' }}>{ item.side == OrderSide.Buy ? '≥' : '≤'  } { UiUtil.toMoney(item.secondaryAsset, item.stopPrice) }</Text>
                    </Flex>
                  }
                  <Flex justify="between" wrap="wrap" gap="1">
                    <Text size="2" color="gray">{ item.stopPrice ? 'Then at' : 'At' }</Text>
                    {
                      possiblePrice != null &&
                      <Text size="2" style={{ color: 'var(--gray-12)' }}>{ item.side == OrderSide.Buy ? '≤' : '≥' } { UiUtil.toMoney(item.secondaryAsset, possiblePrice) }</Text>
                    }
                    {
                      !possiblePrice &&
                      <Text size="2" style={{ color: 'var(--gray-12)' }}>Market price</Text>
                    }
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1">
                    <Text size="2" color={ item.side == OrderSide.Buy ? undefined : 'red' }>{ item.side == OrderSide.Buy ? 'Buy' : 'Sell' }</Text>
                    <Text size="2" color={ item.side == OrderSide.Buy ? undefined : 'red' }>{ UiUtil.toMoney(item.primaryAsset, leftoverQuantity) }</Text>
                  </Flex>
                  {
                    leftoverQuantity && leftoverQuantity.isFinite() && possiblePrice && possiblePrice.isFinite() &&
                    <Flex justify="between" wrap="wrap" gap="1">
                      <Text size="2" color="gray">For</Text>
                      <Text size="2" style={{ color: 'var(--gray-12)' }}>{ UiUtil.toMoney(item.secondaryAsset, leftoverQuantity.multipliedBy(possiblePrice)) }</Text>
                    </Flex>
                  }
                </Flex>
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Order #{item.orderId.toString().length > 8 ? UiUtil.toHash(item.orderId.toString(), 4) : item.orderId.toString()}</Dialog.Title>
              <FullOrderView open={true}></FullOrderView>
            </Dialog.Content>
          </Dialog.Root>
          {
            !props.readOnly && item.active &&
            <Flex justify="center" mt="1">
              <PerformerButton title="Close order" description="Smart contract will re-pay you back all unfilled value after this action" color="red" style={{ width: '100%' }} onBuild={() => {
                return Builder.withdrawOrder({ orderId: item.id.toString() });
              }}></PerformerButton>
            </Flex>
          }
        </Box>
      }
      {
        !props.flash &&
        <Box px="1" py="1">
          <FullOrderView></FullOrderView>
        </Box>
      }
    </Card>
  );
}