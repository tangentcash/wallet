import { Avatar, Badge, Box, Button, Card, DataList, Dialog, DropdownMenu, Flex, Text } from "@radix-ui/themes";
import { Order, OrderCondition, OrderPolicy, OrderSide, Swap } from "../../core/swap";
import { AssetId, Readability } from "tangentsdk";
import { useMemo } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import PerformerButton, { Authorization } from "./performer";

function FullOrderView(props: { item: Order, open?: boolean, price: BigNumber | null, quantity: BigNumber | null, paidAsset: AssetId }) {
  const item = props.item;
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
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
      return (progress > 0 ? (progress >= 100 ? 'Filled' : 'Partially filled (cancelled)') : 'Cancelled');

    return (progress > 0 ? (progress >= 100 ? 'Filled' : 'Partially filled') : 'No match yet');
  }, [progress]);
  
  return (
    <Collapsible.Root open={props.open}>
      <Flex justify="start" align="center" gap="3">
        <Box style={{ position: 'relative' }}>
          <Avatar size="2" fallback={Readability.toAssetFallback(item.secondaryAsset)} src={Readability.toAssetImage(item.secondaryAsset)} style={{ position: 'absolute', top: '24px', left: '-6px' }} />
          <Avatar size="4" fallback={Readability.toAssetFallback(item.primaryAsset)} src={Readability.toAssetImage(item.primaryAsset)} />
        </Box>
        <Box width="100%">
          <Flex justify="between" align="center">
            <Flex align="center">
              <Text size="2">{ item.primaryAsset.token || item.primaryAsset.chain }</Text>
              <Text size="2" color="gray">x</Text>
              <Text size="2">{ item.secondaryAsset.token || item.secondaryAsset.chain }</Text>
            </Flex>
            <Flex align="center" style={{ textDecoration: item.active ? undefined : 'line-through' }}>
              <Text size="2">{ props.quantity ? Readability.toMoney(null, props.quantity) : '(N/A)' }</Text>
              <Text size="2" color="gray">x</Text>
              <Text size="2">{ props.price ? Readability.toMoney(null, props.price) : '(N/A)' }</Text>
            </Flex>
          </Flex>
          <Flex justify="between" align="center">
            <Flex align="center" gap="2" pt="1">
              <Badge variant="soft" radius="medium" color={item.active ? (item.side == OrderSide.Buy ? 'jade' : 'red') : 'gray'} size="1">{ side } — { condition }</Badge>
            </Flex>
            <Collapsible.Trigger asChild={true}>
              <Button size="1" radius="large" variant="soft" color={item.active ? (progress > 0 ? (progress >= 100 ? 'jade' : 'orange') : 'gray') : 'gray'} mt="1">
                <Text size="1">{ progress.toFixed(1) }% fill</Text>
                <Box ml="1">
                  <DropdownMenu.TriggerIcon />
                </Box>
              </Button>
            </Collapsible.Trigger>
          </Flex>
        </Box>
      </Flex>
      <Collapsible.Content>
        <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
        <DataList.Root orientation={orientation}>
          <DataList.Item>
            <DataList.Label>Market account:</DataList.Label>
            <DataList.Value>{ Readability.toAddress(item.marketAccount) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Primary asset:</DataList.Label>
            <DataList.Value>{ Readability.toAssetName(item.primaryAsset) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Secondary asset:</DataList.Label>
            <DataList.Value>{ Readability.toAssetName(item.secondaryAsset) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Reference:</DataList.Label>
            <DataList.Value>0x{ item.orderId.toString(16) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Status:</DataList.Label>
            <DataList.Value>
              <Badge color={item.active ? (progress > 0 ? (progress >= 100 ? 'jade' : 'orange') : 'gray') : 'gray'}>{ status }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Side:</DataList.Label>
            <DataList.Value>
              <Badge color={item.side == OrderSide.Buy ? 'jade' : 'red'}>{ side } order</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Trigger:</DataList.Label>
            <DataList.Value>
              <Badge color="orange">{ condition } price</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Condition:</DataList.Label>
            <DataList.Value>
              <Badge color="blue">{ policy }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Price:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.secondaryAsset, props.price) }</DataList.Value>
          </DataList.Item>
          {
            item.price && (!props.price || !item.price.eq(props.price)) &&
            <DataList.Item>
              <DataList.Label>Base price:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.price) }</DataList.Value>
            </DataList.Item>
          }
          {
            item.stopPrice &&
            <DataList.Item>
              <DataList.Label>Stop price:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.stopPrice) }</DataList.Value>
            </DataList.Item>
          }
          {
            item.trailingStep &&
            <DataList.Item>
              <DataList.Label>Trailing step:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.trailingStep) }</DataList.Value>
            </DataList.Item>
          }
          {
            item.trailingDistance &&
            <DataList.Item>
              <DataList.Label>Trailing distance:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.trailingDistance) }</DataList.Value>
            </DataList.Item>
          }
          {
            item.slippage &&
            <DataList.Item>
              <DataList.Label>Price slippage:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.slippage) }</DataList.Value>
            </DataList.Item>
          }
          <DataList.Item>
            <DataList.Label>Quantity:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.primaryAsset, props.quantity) } { props.quantity && props.quantity.isFinite() && props.price && props.price.isFinite() ? `/ ${Readability.toMoney(item.secondaryAsset, props.quantity.multipliedBy(props.price))}` : '' }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Leftover:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(props.paidAsset, item.value) } / { (100 - progress).toFixed(2) }%</DataList.Value>
          </DataList.Item>
        </DataList.Root>
        {
          item.active &&
          <Flex justify="center" mt="4">
            <PerformerButton title="Cancel this order" description="Smart contract will re-pay you back all unfilled value after this action" variant="surface" color="red" type={Authorization.OrderDeletion} onData={() => {
              return { orderId: item.id.toString() }
            }}></PerformerButton>
          </Flex>
        }
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export default function OrderView(props: { item: Order, open?: boolean, flash?: boolean }) {
  const item = props.item;
  const price = useMemo((): BigNumber | null => {
    return item.fillingPrice || item.price || item.stopPrice || null;
  }, [props]);
  const possiblePrice = useMemo((): BigNumber | null => {
    return price || Swap.priceOf(item.primaryAsset, item.secondaryAsset).close
  }, [props, price]);
  const quantity = useMemo((): BigNumber | null => {
    if (item.side == OrderSide.Sell)
      return item.startingValue;
    return price ? item.startingValue.dividedBy(price) : null;
  }, [price]);
  const paidAsset = useMemo((): AssetId => {
    return item.side == OrderSide.Buy ? item.secondaryAsset : item.primaryAsset;
  }, [props]);

  return (
    <>
      {
        props.flash &&
        <Dialog.Root>
          <Dialog.Trigger>
            <Button style={{ display: 'block', width: '100%', height: 'auto', padding: '0', backgroundColor: 'var(--color-panel)', border: '1px solid var(--gray-5)', borderRadius: '12px' }}>
              <Flex direction="column" gap="2" style={{ padding: '12px' }}>
                {
                  item.stopPrice &&
                  <Flex justify="between" wrap="wrap" gap="1">
                    <Text size="2" color="gray">Trigger at</Text>
                    <Text size="2" style={{ color: 'var(--gray-12)' }}>{ item.side == OrderSide.Buy ? '≤' : '≥' } { Readability.toMoney(item.secondaryAsset, item.stopPrice) }</Text>
                  </Flex>
                }
                <Flex justify="between" wrap="wrap" gap="1">
                  <Text size="2" color="gray">{ item.stopPrice ? 'Then at' : 'At' }</Text>
                  {
                    possiblePrice != null &&
                    <Text size="2" style={{ color: 'var(--gray-12)' }}>{ item.side == OrderSide.Buy ? '≤' : '≥' } { Readability.toMoney(item.secondaryAsset, possiblePrice) }</Text>
                  }
                  {
                    !possiblePrice &&
                    <Text size="2" style={{ color: 'var(--gray-12)' }}>Market price</Text>
                  }
                </Flex>
                <Flex justify="between" wrap="wrap" gap="1">
                  <Text size="2" color={ item.side == OrderSide.Buy ? 'jade' : 'red' }>{ item.side == OrderSide.Buy ? 'Buy' : 'Sell' }</Text>
                  <Text size="2" color={ item.side == OrderSide.Buy ? 'jade' : 'red' }>{ Readability.toMoney(item.primaryAsset, quantity) }</Text>
                </Flex>
                {
                  quantity && quantity.isFinite() && possiblePrice && possiblePrice.isFinite() &&
                  <Flex justify="between" wrap="wrap" gap="1">
                    <Text size="2" color="gray">For</Text>
                    <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(item.secondaryAsset, quantity.multipliedBy(possiblePrice)) }</Text>
                  </Flex>
                }
                <Flex justify="between" wrap="wrap" gap="1">
                  <Text size="2" color="yellow">Left</Text>
                  <Text size="2" color="yellow">{ Readability.toMoney(item.primaryAsset, quantity) }</Text>
                </Flex>
              </Flex>
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Order #{item.orderId.toString()}</Dialog.Title>
            <FullOrderView item={props.item} open={true} price={price} quantity={quantity} paidAsset={paidAsset}></FullOrderView>
          </Dialog.Content>
        </Dialog.Root>
      }
      {
        !props.flash &&
        <Card variant="surface" style={{
            border: '1px solid var(--gray-7)',
            borderRadius: '24px'
          }}>
          <Box px="1" py="1">
            <FullOrderView item={props.item} open={props.open} price={price} quantity={quantity} paidAsset={paidAsset}></FullOrderView>
          </Box>
        </Card>
      }
    </>
  );
}