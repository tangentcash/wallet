import { Badge, Box, Button, Card, DataList, Dialog, Flex, Text } from "@radix-ui/themes";
import { ByteUtil, Readability } from "tangentsdk";
import { Pool, Exchange } from "../../core/exchange";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertBox, AlertType } from "../alert";
import { mdiInformationOutline } from "@mdi/js";
import { AssetImage } from "../asset";
import { PerformerButton, Builder, BuilderResult } from "./performer";
import { LiquidityPool } from "./maker";
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";

export default function PoolView(props: { item: Pool, open?: boolean, flash?: boolean, readOnly?: boolean }) {
  const item = props.item;
  const concentrated = item.minPrice?.gt(0) && item.maxPrice?.gt(0);
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [expanded, setExpanded] = useState(props.open || false);
  const bidPrice = useMemo(() => item.price.multipliedBy(new BigNumber(1).minus(item.feeRate)), [item.price, item.feeRate]);
  const askPrice = useMemo(() => item.price.multipliedBy(new BigNumber(1).plus(item.feeRate)), [item.price, item.feeRate]);
  const inLowerRange = useMemo(() => concentrated ? bidPrice.gte(item.minPrice || 0) : true, [bidPrice]);
  const inUpperRange = useMemo(() => concentrated ? askPrice.lte(item.maxPrice || 0) : true, [askPrice]);
  const state = useMemo(() => {
    const primaryPrice = Exchange.priceOf(item.primaryAsset), secondaryPrice = Exchange.priceOf(item.secondaryAsset);
    const isolatedLiquidity = item.primaryValue.multipliedBy(primaryPrice.close || new BigNumber(0)).plus(item.secondaryValue.multipliedBy(secondaryPrice.close || new BigNumber(0)));
    const revenueLiquidity = item.primaryRevenue.multipliedBy(primaryPrice.close || new BigNumber(0)).plus(item.secondaryRevenue.multipliedBy(secondaryPrice.close || new BigNumber(0)));
    return {
      absoluteRevenue: revenueLiquidity,
      relativeRevenue: isolatedLiquidity.gt(0) ? revenueLiquidity.dividedBy(isolatedLiquidity) : new BigNumber(0),
      liquidity: isolatedLiquidity.plus(revenueLiquidity)
    }
  }, [item]);
  const rebalance = useCallback(async (): Promise<BuilderResult[]> => {
    const price = Exchange.priceOf(item.primaryAsset, item.secondaryAsset).close;
    if (!price)
      throw new Error('Failed to re-balance the pool because no market price found');
    
    let minPrice: BigNumber | null = item.minPrice && item.minPrice.isFinite() ? item.minPrice : null;
    let maxPrice: BigNumber | null = item.maxPrice && item.maxPrice.isFinite() ? item.maxPrice : null;
    if (minPrice?.gt(0) && maxPrice?.gt(0)) {
      const range = maxPrice.minus(minPrice).dividedBy(2);
      minPrice = BigNumber.max(price.minus(range), 0);
      maxPrice = price.plus(range);
    }
    
    const maxSecondaryValue = item.secondaryValue.plus(item.secondaryRevenue);
    const maxPrimaryValue = item.primaryValue.plus(item.primaryRevenue);
    let secondaryValue = LiquidityPool.toSecondaryValue(maxPrimaryValue, price, minPrice, maxPrice);
    if (!secondaryValue)
      throw new Error('Failed to re-balance the pool because of insufficient primary reserve');

    let primaryValue: BigNumber | null = maxPrimaryValue;
    if (secondaryValue.gt(maxSecondaryValue)) {
      primaryValue = LiquidityPool.toPrimaryValue(maxSecondaryValue, price, minPrice, maxPrice);
      if (!primaryValue)
        throw new Error('Failed to re-balance the pool because of insufficient secondary reserve');

      secondaryValue = LiquidityPool.toSecondaryValue(primaryValue, price, minPrice, maxPrice);
      if (!secondaryValue)
        throw new Error('Failed to re-balance the pool because of insufficient primary reserve');
    }

    const primaryPays: Record<string, string> = { };
    const secondaryPays: Record<string, string> = { };
    primaryPays[item.primaryAsset.id] = ByteUtil.bigNumberToString(primaryValue);
    secondaryPays[item.secondaryAsset.id] = ByteUtil.bigNumberToString(secondaryValue);
    return [
      await Builder.withdrawPool({ poolId: item.id.toString() }),
      await Builder.depositPool({
        marketId: item.marketId.toString(),
        primaryAssetHash: item.primaryAsset.id,
        secondaryAssetHash: item.secondaryAsset.id,
        primaryPays: primaryPays,
        secondaryPays: secondaryPays,
        price: ByteUtil.bigNumberToString(price),
        minPrice: minPrice ? ByteUtil.bigNumberToString(minPrice) : undefined,
        maxPrice: maxPrice ? ByteUtil.bigNumberToString(maxPrice) : undefined,
        feeRate: ByteUtil.bigNumberToString(item.feeRate)
      })
    ];
  }, [item]);

  const FullPoolView = (subprops: { open?: boolean }) => (
    <Collapsible.Root open={subprops.open || expanded}>
      <Flex justify="start" align="center" gap="3" className={subprops.open ? undefined : 'card-expander'} onClick={() => subprops.open ? undefined : setExpanded(!expanded)}>
        <Box style={{ position: 'relative' }}>
          <AssetImage asset={item.secondaryAsset} size="2" style={{ position: 'absolute', top: '24px', left: '-6px' }}></AssetImage>
          <AssetImage asset={item.primaryAsset} size="4"></AssetImage>
        </Box>
        <Box width="100%">
          <Flex justify="between" align="center">
            <Flex align="center">
              <Text size="2">{ item.primaryAsset.token || item.primaryAsset.chain }</Text>
              <Text size="2" color="gray">x</Text>
              <Text size="2">{ item.secondaryAsset.token || item.secondaryAsset.chain }</Text>
            </Flex>
            <Flex align="center" style={{ textDecoration: item.active ? undefined : 'line-through' }}>
              <Text size="2">{ Readability.toMoney(Exchange.equityAsset, state.liquidity) }</Text>
            </Flex>
          </Flex>
          <Flex justify="between" align="center">
            <Flex align="center" gap="2" pt="1">
              <Flex gap="1">
                <Badge variant="soft" color={item.active ? 'jade' : 'gray'} size="2">{ Readability.toMoney(Exchange.equityAsset, state.absoluteRevenue, true) }</Badge>
                <Badge variant="soft" color={item.active ? 'jade' : 'gray'} size="2">{ state.relativeRevenue.gt(0) ? '+' : '' }{ state.relativeRevenue.multipliedBy(100).toFixed(2) }%</Badge>
              </Flex>
            </Flex>
            <Badge variant="soft" color="gold" size="2">    
              <Icon path={mdiInformationOutline} size={0.65}></Icon>
              <Text>P&L</Text>
            </Badge>
          </Flex>
        </Box>
      </Flex>
      <Collapsible.Content>
        <Box my="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
        <DataList.Root orientation={orientation}>
          <DataList.Item>
            <DataList.Label>Market account:</DataList.Label>
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(item.marketAccount || 'NULL');
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ Readability.toAddress(item.marketAccount || 'NULL') }</Button>
              <Box ml="2">
                <Link className="router-link" to={'/exchange/' + item.marketAccount}>▒▒</Link>
              </Box>
            </DataList.Value>
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
            <DataList.Value>
              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                navigator.clipboard.writeText(item.poolId.toString(16));
                AlertBox.open(AlertType.Info, 'Reference copied!')
              }}>0x{ item.poolId.toString(16).length > 8 ? Readability.toHash(item.poolId.toString(16), 6) : item.poolId.toString(16) }</Button>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Status:</DataList.Label>
            <DataList.Value>
              <Badge color={item.active ? (inLowerRange && inUpperRange ? 'jade' : 'yellow') : 'gray'}>{ item.active ? (inLowerRange && inUpperRange ? (concentrated ? 'Active (fully in range)' : 'Active') : 'Partially active (out of range)') : 'Inactive' }</Badge>
            </DataList.Value>
          </DataList.Item>
          {
            concentrated &&
            <DataList.Item>
              <DataList.Label>Price range:</DataList.Label>
              <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.minPrice || null) } — { Readability.toMoney(item.secondaryAsset, item.maxPrice || null) }</DataList.Value>
            </DataList.Item>
          }
          <DataList.Item>
            <DataList.Label>Price spread:</DataList.Label>
            <DataList.Value>
              <Flex wrap="wrap" gap="2">
                { inLowerRange && <Badge color="jade">BID { Readability.toMoney(item.secondaryAsset, bidPrice) }</Badge> }
                { inUpperRange && <Badge color="red">ASK { Readability.toMoney(item.secondaryAsset, askPrice) }</Badge> }
              </Flex>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>Price:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.price) }</DataList.Value>
          </DataList.Item>
          {
            (item.primaryRevenue.gt(0) || item.secondaryRevenue.gt(0)) &&
            <DataList.Item>
              <DataList.Label>Fees onhold:</DataList.Label>
              <DataList.Value>
                <Flex wrap="wrap" gap="2">
                  { item.primaryRevenue.gt(0) && <Badge color="jade">{ Readability.toMoney(item.primaryAsset, item.primaryRevenue) }</Badge> }
                  { item.secondaryRevenue.gt(0) && <Badge color="jade">{ Readability.toMoney(item.secondaryAsset, item.secondaryRevenue) }</Badge> }
                </Flex>
              </DataList.Value>
            </DataList.Item>
          }
          <DataList.Item>
            <DataList.Label>{ Readability.toAssetSymbol(item.primaryAsset) } reserve:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.primaryAsset, item.primaryValue) }</DataList.Value>
          </DataList.Item>
          <DataList.Item>
            <DataList.Label>{ Readability.toAssetSymbol(item.secondaryAsset) } reserve:</DataList.Label>
            <DataList.Value>{ Readability.toMoney(item.secondaryAsset, item.secondaryValue) }</DataList.Value>
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
          !props.flash && !props.readOnly && item.active &&
          <Flex justify="between" wrap="wrap" gap="1" mt="4">
              <PerformerButton title="Recreate" description="Smart contract will re-create this pool based on current market price" color="orange" onBuild={() => rebalance()}></PerformerButton>
              <PerformerButton title="Close" description="Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" color="red" onBuild={() => {
                return Builder.withdrawPool({ poolId: item.id.toString() });
              }}></PerformerButton>
          </Flex>
        }
      </Collapsible.Content>
    </Collapsible.Root>
  );
  return (
    <Card variant="surface" style={{ borderRadius: '22px', position: "relative" }}>
      {
        props.flash &&
        <Box>
          <Dialog.Root>
            <Dialog.Trigger>
              <Button variant="surface" color="gray" style={{ display: 'block', width: '100%', height: 'auto', padding: '4px', backgroundColor: 'transparent', boxShadow: 'none' }}>
                <Flex direction="column" gap="2">
                  <Flex justify="between" wrap="wrap" gap="1" style={{ textDecoration: inLowerRange ? undefined : 'line-through', color: 'var(--gray-11)' }}>
                    <Text size="2" color="jade">Buy at</Text>
                    <Text size="2" color="jade">≤ { Readability.toMoney(item.secondaryAsset, bidPrice) }</Text>
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1" style={{ textDecoration: inUpperRange ? undefined : 'line-through', color: 'var(--gray-11)' }}>
                    <Text size="2" color="red">Sell at</Text>
                    <Text size="2" color="red">≥ { Readability.toMoney(item.secondaryAsset, askPrice) }</Text>
                  </Flex>
                  <Flex justify="between" wrap="wrap" gap="1">
                    <Text size="2" color="gray">With</Text>
                    <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toMoney(Exchange.equityAsset, state.liquidity) }</Text>
                  </Flex>
                </Flex>
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <Dialog.Title>Pool #{item.poolId.toString().length > 8 ? Readability.toHash(item.poolId.toString(), 4) : item.poolId.toString()}</Dialog.Title>
              <FullPoolView open={true}></FullPoolView>
            </Dialog.Content>
          </Dialog.Root>
          {
            !props.readOnly && item.active &&
            <Flex justify="between" wrap="wrap" gap="1" mt="1">
              <PerformerButton title="Recreate" description="Smart contract will re-create this pool based on current market price" color="orange" onBuild={() => rebalance()}></PerformerButton>
              <PerformerButton title="Close" description="Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" color="red" onBuild={() => {
                return Builder.withdrawPool({ poolId: item.id.toString() });
              }}></PerformerButton>
            </Flex>
          }
        </Box>
      }
      {
        !props.flash &&
        <Box px="1" py="1">
          <FullPoolView></FullPoolView>
        </Box>
      }
    </Card>
  );
}