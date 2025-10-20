import { Avatar, Badge, Box, Button, DataList, Dialog, DropdownMenu, Flex, Text } from "@radix-ui/themes";
import { Readability } from "tangentsdk";
import { Pool } from "../../core/wormhole";
import * as Collapsible from "@radix-ui/react-collapsible";
import PerformerButton, { Authorization } from "./performer";

function FullPoolView(props: { item: Pool, open?: boolean, concentrated?: boolean, inRange?: boolean }) {
  const item = props.item;
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';

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
            <Text size="2">{ Readability.toMoney(null, item.price) }</Text>
          </Flex>
        </Flex>
        <Flex justify="between" align="center">
          <Flex align="center" gap="2" pt="1">
            <Badge variant="soft" radius="medium" color={'gray'} size="1">
              <Flex align="center" style={{ textDecoration: item.active ? undefined : 'line-through' }}>
                <Text size="1">{ Readability.toMoney(null, item.primaryValue.plus(item.primaryRevenue)) }</Text>
                <Text size="1" color="gray">x</Text>
                <Text size="1">{ Readability.toMoney(null, item.secondaryValue.plus(item.secondaryRevenue)) }</Text>
              </Flex>
            </Badge>
          </Flex>
          <Collapsible.Trigger asChild={true}>
            <Button size="1" radius="large" variant="soft" mt="1">
              <Text size="1">Details</Text>
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
          <DataList.Value>0x{ item.poolId.toString(16) }</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Status:</DataList.Label>
          <DataList.Value>
            <Badge color={item.active ? 'jade' : (props.inRange ? 'gray' : 'red')}>{ item.active ? 'Active' + (props.concentrated ? ' in range' : '') : (props.inRange ? 'Inactive' : 'Inactive out of range') }</Badge>
          </DataList.Value>
        </DataList.Item>
        {
          props.concentrated &&
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
          props.concentrated &&
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
          <PerformerButton title="Close this pool" variant="surface" color="red" type={Authorization.PoolDeletion} onData={() => {
            return { poolId: item.id.toString() }
          }}></PerformerButton>
        </Flex>
      }
    </Collapsible.Content>
  </Collapsible.Root>
  );
}

export default function PoolView(props: { item: Pool, open?: boolean, flash?: boolean }) {
  const item = props.item;
  const concentrated = item.minPrice?.gt(0) && item.maxPrice?.gt(0);
  const inRange = concentrated ? item.price.gt(item.minPrice || 0) && item.price.lt(item.maxPrice || 0) : true;
  return (
    <>
      {
        props.flash &&
        <Dialog.Root>
          <Dialog.Trigger>
            <Button style={{ display: 'block', width: '100%', height: 'auto', padding: '0', backgroundColor: 'var(--color-panel)', border: '1px solid var(--gray-5)', borderRadius: '12px' }}>
              <Flex direction="column" gap="2" style={{ padding: '12px' }}>

              </Flex>
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Pool #{item.poolId.toString()}</Dialog.Title>
            <FullPoolView item={props.item} open={true} concentrated={concentrated} inRange={inRange}></FullPoolView>
          </Dialog.Content>
        </Dialog.Root>
      }
      {
        !props.flash &&
        <Box px="4" py="4" style={{ backgroundColor: 'var(--gray-3)', borderRadius: '24px' }}>
          <FullPoolView item={props.item} open={props.open} concentrated={concentrated} inRange={inRange}></FullPoolView>
        </Box>
      }
    </>
  );
}