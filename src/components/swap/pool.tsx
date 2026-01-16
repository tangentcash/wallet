import { Avatar, Badge, Box, Button, Card, DataList, Dialog, Flex, Text } from "@radix-ui/themes";
import { Readability } from "tangentsdk";
import { Pool, Swap } from "../../core/swap";
import { useMemo, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import PerformerButton, { Authorization } from "./performer";

export default function PoolView(props: { item: Pool, open?: boolean, flash?: boolean }) {
  const item = props.item;
  const concentrated = item.minPrice?.gt(0) && item.maxPrice?.gt(0);
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const inRange = concentrated ? item.price.gt(item.minPrice || 0) && item.price.lt(item.maxPrice || 0) : true;
  const [expanded, setExpanded] = useState(props.open || false);
  const revenue = useMemo(() => {
    const primaryPrice = Swap.priceOf(props.item.primaryAsset);
    const secondaryPrice = Swap.priceOf(props.item.secondaryAsset);
    if (!primaryPrice.close || !secondaryPrice.close)
      return null;

    const absolute = primaryPrice.close.multipliedBy(props.item.primaryRevenue).plus(secondaryPrice.close.multipliedBy(props.item.secondaryRevenue));
    const relative = absolute.dividedBy(primaryPrice.close.multipliedBy(props.item.primaryValue).plus(secondaryPrice.close.multipliedBy(props.item.secondaryValue)));
    return { absolute: absolute, relative: relative };
  }, [props.item]);

  const FullPoolView = (subprops: { open?: boolean }) => (
    <Collapsible.Root open={subprops.open || expanded}>
      <Flex justify="start" align="center" gap="3" className={subprops.open ? undefined : 'card-expander'} onClick={() => subprops.open ? undefined : setExpanded(!expanded)}>
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
              <Text size="2">{ Readability.toMoney(null, item.price) }</Text>
            </Flex>
          </Flex>
          <Flex justify="between" align="center">
            <Flex align="center" gap="2" pt="1">
              {
                revenue != null &&
                <Flex gap="1">
                  <Badge variant="soft" color="jade" size="2">{ Readability.toMoney(Swap.equityAsset, revenue.absolute, true) }</Badge>
                  <Badge variant="soft" color="jade" size="2">{ revenue.relative.gt(0) ? '+' : '' }{ revenue.relative.multipliedBy(100).toFixed(2) }%</Badge>
                </Flex>
              }
              {
                !revenue &&
                <Badge variant="soft" color={'gray'} size="1">
                  <Flex align="center" style={{ textDecoration: item.active ? undefined : 'line-through' }}>
                    <Text size="1">{ Readability.toMoney(null, item.primaryValue.plus(item.primaryRevenue)) }</Text>
                    <Text size="1" color="gray">x</Text>
                    <Text size="1">{ Readability.toMoney(null, item.secondaryValue.plus(item.secondaryRevenue)) }</Text>
                  </Flex>
                </Badge>
              }
            </Flex>
            <Badge variant="soft" color="gold" size="2">P&L</Badge>
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
            <DataList.Value>0x{ item.poolId.toString(16) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Status:</DataList.Label>
            <DataList.Value>
              <Badge color={item.active ? 'jade' : (inRange ? 'gray' : 'red')}>{ item.active ? 'Active' + (concentrated ? ' in range' : '') : (inRange ? 'Inactive' : 'Inactive out of range') }</Badge>
            </DataList.Value>
          </DataList.Item>
          {
            concentrated &&
            <DataList.Item>
              <DataList.Label>Lowest price:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.minPrice || null) }</DataList.Value>
            </DataList.Item>
          }
          <DataList.Item>
            <DataList.Label>Current price:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.price) }</DataList.Value>
          </DataList.Item>
          {
            concentrated &&
            <DataList.Item>
              <DataList.Label>Highest price:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.maxPrice || null) }</DataList.Value>
            </DataList.Item>
          }
          <DataList.Item>
            <DataList.Label>{ Readability.toAssetSymbol(item.primaryAsset) } reserve:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.primaryAsset, item.primaryValue) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>{ Readability.toAssetSymbol(item.primaryAsset) } revenue:</DataList.Label>
            <DataList.Value>
              <Text color={item.primaryRevenue.gt(0) ? 'jade' : undefined}>{ Readability.toMoney(item.primaryAsset, item.primaryRevenue, true) }</Text>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>{ Readability.toAssetSymbol(item.secondaryAsset) } reserve:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.secondaryValue) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>{ Readability.toAssetSymbol(item.secondaryAsset) } revenue:</DataList.Label>
            <DataList.Value>
              <Text color={item.secondaryRevenue.gt(0) ? 'jade' : undefined}>{ Readability.toMoney(item.secondaryAsset, item.secondaryRevenue, true) }</Text>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Fee rate:</DataList.Label>
            <DataList.Value>{ item.feeRate.multipliedBy(100).toFixed(2) }%</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Exit fee:</DataList.Label>
            <DataList.Value>{ item.exitFee.multipliedBy(100).toFixed(2) }%</DataList.Value>
          </DataList.Item>
        </DataList.Root>
        {
          item.active &&
          <Flex justify="center" mt="4">
            <PerformerButton title="Close this pool" description="Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" variant="surface" color="red" type={Authorization.PoolDeletion} onData={() => {
              return { poolId: item.id.toString() }
            }}></PerformerButton>
          </Flex>
        }
      </Collapsible.Content>
    </Collapsible.Root>
  );
  return (
    <>
      {
        props.flash &&
        <Dialog.Root>
          <Dialog.Trigger>
            <Button style={{ display: 'block', width: '100%', height: 'auto', padding: '0', backgroundColor: 'var(--color-panel)', borderRadius: '22px' }}>
              <Flex direction="column" gap="2" style={{ padding: '12px' }}>

              </Flex>
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Pool #{item.poolId.toString()}</Dialog.Title>
            <FullPoolView open={true}></FullPoolView>
          </Dialog.Content>
        </Dialog.Root>
      }
      {
        !props.flash &&
        <Card variant="surface" style={{ borderRadius: '24px' }}>
          <Box px="1" py="1">
            <FullPoolView></FullPoolView>
          </Box>
        </Card>
      }
    </>
  );
}