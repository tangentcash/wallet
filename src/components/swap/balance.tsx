import { Avatar, Badge, Box, Card, Flex, Text, Tooltip } from "@radix-ui/themes";
import { Swap, Balance } from "../../core/swap";
import { Readability } from "tangentsdk";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import { mdiLockOutline } from "@mdi/js";

export default function BalanceView(props: { item: Balance & { equity: { current: BigNumber | null, previous: BigNumber | null } } }) {
  const item = props.item;
  const baseEquity = item.equity.current || item.equity.previous || new BigNumber(0);
  const previousEquity = item.equity.previous ? item.equity.previous : baseEquity;
  const currentEquity = item.equity.current ? item.equity.current : baseEquity;
  return (
    <Card mb="4" variant="surface" style={{
        border: '1px solid var(--gray-7)',
        borderRadius: '24px'
      }}>
      <Flex justify="start" align="center" gap="3" px="1" py="1">
        <Avatar size="4" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
        <Box width="100%">
          <Flex justify="between">
            <Text size="2">{ Readability.toAssetName(item.asset) }</Text>
            <Text size="2">{ Readability.toMoney(Swap.equityAsset, item.equity.current) }</Text>
          </Flex>
          <Flex justify="between" align="center">
            <Tooltip content={ 'Currently locked: ' + Readability.toMoney(item.asset, item.unavailable) }>
              <Flex align="center" gap="1">
                { item.unavailable.gt(0) && <Icon path={mdiLockOutline} size={0.575} color="var(--gray-11)" style={{ transform: 'translateY(-1px)' }}></Icon> }
                <Text size="2" color="gray">{ Readability.toMoney(item.asset, item.available.plus(item.unavailable)) }</Text>
              </Flex>
            </Tooltip>
            <Tooltip content={ Readability.toMoney(Swap.equityAsset, currentEquity.minus(previousEquity), true) }>
              <Badge radius="small" size="1" color={ previousEquity.gt(currentEquity) ? 'red' : (previousEquity.eq(currentEquity) ? 'gray' : 'jade') }>{ Readability.toPercentageDelta(previousEquity, currentEquity) }</Badge>
            </Tooltip>
          </Flex>
        </Box>
      </Flex>
    </Card>
  );
}