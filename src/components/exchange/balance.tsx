import { Badge, Box, Button, Card, Flex, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { Exchange, Balance, Market } from "../../core/exchange";
import { AssetId, Readability, TextUtil } from "tangentsdk";
import { mdiCurrencyUsd, mdiLockOutline, mdiSetRight } from "@mdi/js";
import { useMemo, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import { PerformerButton, Builder } from "./performer";
import { AssetImage, AssetName } from "../asset";
import AssetSelector from "./selector";

function RepayableBalanceView(props: { item: Balance & { equity: { current: BigNumber | null, previous: BigNumber | null } } }) {
  const item = props.item;
  const baseEquity = item.equity.current || item.equity.previous || new BigNumber(0);
  const previousEquity = item.equity.previous ? item.equity.previous : baseEquity;
  const currentEquity = item.equity.current ? item.equity.current : baseEquity;
  const [expanded, setExpanded] = useState(false);
  const [market, setMarket] = useState<Market | null>(Exchange.contracts[0] || null);
  const [asset, setAsset] = useState<AssetId | null>(null);
  const [amount, setAmount] = useState<string>('');
  const assetPayload = useMemo((): {
    marketId: string,
    repaymentAssetHash: string,
    paymentAssetHash: string,
    pays: string
  } | null => {
    if (!market || !asset || asset.chain == item.asset.chain || asset.token != item.asset.token)
      return null;

    const valueQuantity = TextUtil.toNumericValueOrPercent(amount.trim());
    if (!valueQuantity.value.gt(0))
      return null;

    const value = valueQuantity.relative ? item.available.multipliedBy(valueQuantity.relative) : valueQuantity.value;
    if (!value.gt(0) || value.gt(item.available))
      return null;

    return {
      marketId: market.id.toString(),
      repaymentAssetHash: asset.id,
      paymentAssetHash: item.asset.id,
      pays: value.toString()
    }
  }, [asset, amount]);
  return (
    <Collapsible.Root open={expanded}>
      <Card mb="4" variant="surface" style={{ borderRadius: '24px', position: "relative", overflow: 'visible' }}>
        <Flex justify="start" align="center" gap="3" px="1" py="1" className="card-expander" onClick={() => setExpanded(!expanded)}>
          <AssetImage asset={item.asset} size="4"></AssetImage>
          <Box width="100%">
            <Flex justify="between">
              <AssetName asset={item.asset} size="2"></AssetName>
              <Text size="2">{ Readability.toMoney(Exchange.equityAsset, item.equity.current) }</Text>
            </Flex>
            <Flex justify="between" align="center">
              <Tooltip content={ 'Currently locked: ' + Readability.toMoney(item.asset, item.unavailable) }>
                <Flex align="center" gap="1">
                  { item.unavailable.gt(0) && <Icon path={mdiLockOutline} size={0.575} color="var(--gray-11)" style={{ transform: 'translateY(-1px)' }}></Icon> }
                  <Text size="2" color="gray">{ Readability.toMoney(null, item.available.plus(item.unavailable)) }</Text>
                </Flex>
              </Tooltip>
              <Tooltip content={ Readability.toMoney(Exchange.equityAsset, currentEquity.minus(previousEquity), true) }>
                <Badge size="2" variant="soft" color={previousEquity.gt(currentEquity) ? 'red' : (previousEquity.eq(currentEquity) ? 'gray' : 'jade')} mt="1">
                  <Icon path={mdiSetRight} size={0.7}></Icon>
                  <Text size="1">{ Readability.toPercentageDelta(previousEquity, currentEquity) }</Text>
                </Badge>
              </Tooltip>
            </Flex>
          </Box>
        </Flex>
        <Collapsible.Content>
          <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
          <Flex justify="between" mt="4" gap="2">
            <TextField.Root placeholder={Readability.toAssetSymbol(item.asset) + ' amount or %'} size="2" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: '100%' }}>
              <TextField.Slot>
                <Icon path={mdiCurrencyUsd} size={0.8} />
              </TextField.Slot>
            </TextField.Root>
            <AssetSelector title={item.asset.token + " variant to repay"} value={asset} onChange={(value) => setAsset(value)}>
              <Button size="2" variant="soft" color="orange">{ asset ? asset.chain + (asset.token != null ? ' ' + asset.token : '') : 'Of token' }</Button>
            </AssetSelector>
          </Flex>
          <Flex justify="between" mt="2" gap="2">
            <Box width="100%">
              <Select.Root value={market ? market.id.toString() : ''} onValueChange={(e) => setMarket(Exchange.contracts.find((v) => v.id.toString() == e) || null)} size="2">
                <Select.Trigger variant="soft" color="gray" style={{ width: '100%' }}>{ market ? market.account.substring(market.account.length - 6) : 'no market' }</Select.Trigger>
                <Select.Content position="popper" side="bottom">
                  <Select.Group>
                    <Select.Label>Market contract</Select.Label>
                    { Exchange.contracts.map((item) => <Select.Item key={item.id.toString()} value={item.id.toString()}>{ Exchange.marketPolicyOf(item) } contract — { item.account.substring(item.account.length - 6) }</Select.Item>) }
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Box>
            <PerformerButton title="Repay" description="Smart contract will re-pay you back the 1:1 value of selected token after this action" variant="soft" color="yellow" disabled={!assetPayload} onBuild={async () => {
              return assetPayload ? Builder.repayAsset(assetPayload) : null;
            }}></PerformerButton>
          </Flex>
        </Collapsible.Content>
      </Card>
    </Collapsible.Root>
  );
}
function DefaultBalanceView(props: { item: Balance & { equity: { current: BigNumber | null, previous: BigNumber | null } } }) {
  const item = props.item;
  const baseEquity = item.equity.current || item.equity.previous || new BigNumber(0);
  const previousEquity = item.equity.previous ? item.equity.previous : baseEquity;
  const currentEquity = item.equity.current ? item.equity.current : baseEquity;
  return (
    <Card mb="4" variant="surface" style={{ borderRadius: '24px', position: "relative", overflow: 'visible' }}>
      <Flex justify="start" align="center" gap="3" px="1" py="1">
        <AssetImage asset={item.asset} size="4"></AssetImage>
        <Box width="100%">
          <Flex justify="between">
            <AssetName asset={item.asset} size="2"></AssetName>
            <Text size="2">{ Readability.toMoney(Exchange.equityAsset, item.equity.current) }</Text>
          </Flex>
          <Flex justify="between" align="center">
            <Tooltip content={ 'Currently locked: ' + Readability.toMoney(item.asset, item.unavailable) }>
              <Flex align="center" gap="1">
                { item.unavailable.gt(0) && <Icon path={mdiLockOutline} size={0.575} color="var(--gray-11)" style={{ transform: 'translateY(-1px)' }}></Icon> }
                <Text size="2" color="gray">{ Readability.toMoney(null, item.available.plus(item.unavailable)) }</Text>
              </Flex>
            </Tooltip>
            <Tooltip content={ Readability.toMoney(Exchange.equityAsset, currentEquity.minus(previousEquity), true) }>
              <Badge size="2" variant="soft" color={previousEquity.gt(currentEquity) ? 'red' : (previousEquity.eq(currentEquity) ? 'gray' : 'jade')} mt="1">
                <Text size="1">{ Readability.toPercentageDelta(previousEquity, currentEquity) }</Text>
              </Badge>
            </Tooltip>
          </Flex>
        </Box>
      </Flex>
    </Card>
  );
}
export default function BalanceView(props: { item: Balance & { equity: { current: BigNumber | null, previous: BigNumber | null } }, readOnly?: boolean }) {
  const repayable = props.item.asset.token != null && props.item.asset.chain == new AssetId().chain;
  return repayable && !props.readOnly ? RepayableBalanceView(props) : DefaultBalanceView(props);
}