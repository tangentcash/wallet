import { Badge, Box, Button, Card, DataList, Dialog, Flex, Select, Text, Tooltip } from "@radix-ui/themes";
import { AssetId, ByteUtil, Readability } from "tangentsdk";
import { Pool, Exchange, Balance } from "../../core/exchange";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertBox, AlertType } from "../alert";
import { mdiClose, mdiRotate3dVariant, mdiRotateOrbit, mdiScaleBalance, mdiScaleUnbalanced } from "@mdi/js";
import { AssetImage } from "../asset";
import { PerformerButton, Builder, BuilderResult } from "./performer";
import { LiquidityPool } from "./maker";
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";
import { AppData } from "../../core/app";

export default function PoolView(props: { item: Pool, open?: boolean, flash?: boolean, readOnly?: boolean }) {
  const item = props.item;
  const concentrated = item.minPrice?.gt(0) && item.maxPrice?.gt(0);
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [expanded, setExpanded] = useState(props.open || false);
  const [mode, setMode] = useState<'isolated-rebalancer' | 'cross-rebalancer' | 'closure'>('closure');
  const bidPrice = useMemo(() => item.price.multipliedBy(new BigNumber(1).minus(item.feeRate)), [item.price, item.feeRate]);
  const askPrice = useMemo(() => item.price.multipliedBy(new BigNumber(1).plus(item.feeRate)), [item.price, item.feeRate]);
  const inLowerRange = useMemo(() => concentrated ? bidPrice.gte(item.minPrice || 0) : true, [bidPrice]);
  const inUpperRange = useMemo(() => concentrated ? askPrice.lte(item.maxPrice || 0) : true, [askPrice]);
  const state = useMemo(() => {
    const primaryPrice = Exchange.priceOf(item.primaryAsset), secondaryPrice = Exchange.priceOf(item.secondaryAsset);
    const isolatedLiquidity = item.primaryValue.multipliedBy(primaryPrice.close || new BigNumber(0)).plus(item.secondaryValue.multipliedBy(secondaryPrice.close || new BigNumber(0)));
    const revenueLiquidity = item.primaryRevenue.multipliedBy(primaryPrice.close || new BigNumber(0)).plus(item.secondaryRevenue.multipliedBy(secondaryPrice.close || new BigNumber(0)));
    let stale = false;
    if (item.active && item.price) {
      const marketPrice = Exchange.priceOf(item.primaryAsset, item.secondaryAsset);
      if (marketPrice.close != null && (!item.minPrice || item.minPrice.lte(marketPrice.close)) && (!item.maxPrice || item.maxPrice.gte(marketPrice.close))) {
        const marketDelta = marketPrice.close.minus(item.price).dividedBy(item.price).abs();
        stale = marketDelta.gt(item.feeRate.plus(0.01));
      } else {
        stale = !!marketPrice.close;
      }
    }
    return {
      absoluteRevenue: revenueLiquidity,
      relativeRevenue: isolatedLiquidity.gt(0) ? revenueLiquidity.dividedBy(isolatedLiquidity) : new BigNumber(0),
      liquidity: isolatedLiquidity.plus(revenueLiquidity),
      stale: stale
    }
  }, [item]);
  const rebalance = useCallback(async (cross: boolean): Promise<BuilderResult[]> => {
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
    
    let crossPoly: { primary: AssetId[], secondary: AssetId[] } | null = null, crossBalances: Balance[] | null = null;
    let maxSecondaryValue = item.secondaryValue.plus(item.secondaryRevenue);
    let maxPrimaryValue = item.primaryValue.plus(item.primaryRevenue);
    let baseMaxSecondaryValue = maxSecondaryValue;
    let baseMaxPrimaryValue = maxPrimaryValue;
    if (cross) {
      try {
        const account = AppData.getWalletAddress();
        if (account != null) {
          const [poly, balances] = await Promise.all([Exchange.marketPairAssets(item.marketId, item.pairId), Exchange.accountBalances({ address: account })]);
          if (Array.isArray(balances)) {
            const primaryBalance = balances?.filter((v) => v.asset.id == item.primaryAsset.id || (poly?.primary ? poly.primary.findIndex((i) => i.id == v.asset.id) != -1 : false)).reduce((p, c) => p.plus(c.available), new BigNumber(0));
            const secondaryBalance = balances?.filter((v) => v.asset.id == item.secondaryAsset.id || (poly?.secondary ? poly.secondary.findIndex((i) => i.id == v.asset.id) != -1 : false)).reduce((p, c) => p.plus(c.available), new BigNumber(0));
            maxPrimaryValue = maxPrimaryValue.plus(primaryBalance);
            maxSecondaryValue = maxSecondaryValue.plus(secondaryBalance);
            crossBalances = balances;
            crossPoly = poly;
          }
        }
      } catch (exception) {
        AlertBox.open(AlertType.Error, 'Failed to fetch current balances: ' + (exception as Error)?.message || '')
      }
    }

    let secondaryValue = LiquidityPool.toSecondaryValue(maxPrimaryValue, price, minPrice, maxPrice);
    if (!secondaryValue)
      throw new Error('Failed to re-balance the pool because of insufficient primary reserve');

    let primaryValue: BigNumber | null = maxPrimaryValue;
    if (secondaryValue.gt(maxSecondaryValue)) {
      secondaryValue = maxSecondaryValue;
      primaryValue = LiquidityPool.toPrimaryValue(maxSecondaryValue, price, minPrice, maxPrice);
      if (!primaryValue)
        throw new Error('Failed to re-balance the pool because of insufficient secondary reserve');
    }

    const primaryPays: Record<string, string> = { };
    const secondaryPays: Record<string, string> = { };
    if (crossPoly && crossBalances) {
      baseMaxPrimaryValue = BigNumber.min(baseMaxPrimaryValue, primaryValue);
      const primaryBalances = crossBalances.filter((v) => v.asset.id == item.primaryAsset.id || (crossPoly ? crossPoly.primary.findIndex((i) => i.id == v.asset.id) != -1 : false));
      let primaryLeftover = new BigNumber(primaryValue.minus(baseMaxPrimaryValue));
      primaryPays[item.primaryAsset.id] = ByteUtil.bigNumberToString(baseMaxPrimaryValue);
      if (primaryLeftover.gt(0)) {
        for (let i = 0; i < primaryBalances.length; i++) {
          const balance = primaryBalances[i];
          const change = BigNumber.min(balance.available, primaryLeftover);
          primaryLeftover = primaryLeftover.minus(change);
          primaryPays[balance.asset.id] = ByteUtil.bigNumberToString(primaryPays[balance.asset.id] ? new BigNumber(primaryPays[balance.asset.id]).plus(change) : change);
          if (!primaryLeftover.gt(0))
              break;
        }
      }

      baseMaxSecondaryValue = BigNumber.min(baseMaxSecondaryValue, secondaryValue);
      const secondaryBalances = crossBalances.filter((v) => v.asset.id == item.secondaryAsset.id || (crossPoly ? crossPoly.secondary.findIndex((i) => i.id == v.asset.id) != -1 : false));
      let secondaryLeftover = new BigNumber(secondaryValue.minus(baseMaxSecondaryValue));
      secondaryPays[item.secondaryAsset.id] = ByteUtil.bigNumberToString(baseMaxSecondaryValue);
      if (secondaryLeftover.gt(0)) {
        for (let i = 0; i < secondaryBalances.length; i++) {
          const balance = secondaryBalances[i];
          const change = BigNumber.min(balance.available, secondaryLeftover);
          secondaryLeftover = secondaryLeftover.minus(change);
          secondaryPays[balance.asset.id] = ByteUtil.bigNumberToString(secondaryPays[balance.asset.id] ? new BigNumber(secondaryPays[balance.asset.id]).plus(change) : change);
          if (!secondaryLeftover.gt(0))
              break;
        }
      }
    } else {
      primaryPays[item.primaryAsset.id] = ByteUtil.bigNumberToString(primaryValue);
      secondaryPays[item.secondaryAsset.id] = ByteUtil.bigNumberToString(secondaryValue);
    }
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
                <Badge variant="soft" color={item.active ? 'lime' : 'gray'} size="2">{ Readability.toMoney(Exchange.equityAsset, state.absoluteRevenue, true) }</Badge>
                <Badge variant="soft" color={item.active ? 'lime' : 'gray'} size="2">{ state.relativeRevenue.gt(0) ? '+' : '' }{ state.relativeRevenue.multipliedBy(100).toFixed(2) }%</Badge>
              </Flex>
            </Flex>
            <Tooltip content={`LP is balanced if its current price is within ${item.feeRate.plus(0.01).multipliedBy(100).toFixed(2)}% market price, otherwise its unbalanced and can be optimized using reopen/refill options`}>
              <Badge variant="soft" color={state.stale ? 'red' : (item.active ? 'jade' : 'gray')} size="2">    
                <Icon path={state.stale ? mdiScaleUnbalanced : (item.active ? mdiScaleBalance : mdiClose)} size={0.65}></Icon>
                <Text>{ state.stale ? 'Stale' : 'Fine' }</Text>
              </Badge>
            </Tooltip>
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
              <Badge color={item.active ? (inLowerRange && inUpperRange ? 'lime' : 'yellow') : 'gray'}>{ item.active ? (inLowerRange && inUpperRange ? (concentrated ? 'Active (fully in range)' : 'Active') : 'Partially active (out of range)') : 'Inactive' }</Badge>
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
                { inLowerRange && <Badge color="lime">BID { Readability.toMoney(item.secondaryAsset, bidPrice) }</Badge> }
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
                  { item.primaryRevenue.gt(0) && <Badge color="lime">{ Readability.toMoney(item.primaryAsset, item.primaryRevenue) }</Badge> }
                  { item.secondaryRevenue.gt(0) && <Badge color="lime">{ Readability.toMoney(item.secondaryAsset, item.secondaryRevenue) }</Badge> }
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
          <Flex justify="end" align="center" wrap="wrap" gap="4" mt="1">
            <Select.Root value={mode} onValueChange={(e) => setMode(e as any)}>
              <Select.Trigger variant="ghost" />
              <Select.Content>
                <Select.Group>
                  <Select.Label>Action</Select.Label>
                  <Select.Item value="closure">
                    <Box style={{ transform: 'translateY(3px)' }}>
                      <Icon path={mdiClose} size={0.9}></Icon>
                    </Box>
                  </Select.Item>
                  <Select.Item value="isolated-rebalancer">
                    <Box style={{ transform: 'translateY(3px)' }}>
                      <Icon path={mdiRotate3dVariant} size={0.9}></Icon>
                    </Box>
                  </Select.Item>
                  <Select.Item value="cross-rebalancer">
                    <Box style={{ transform: 'translateY(3px)' }}>
                      <Icon path={mdiRotateOrbit} size={0.9}></Icon>
                    </Box>
                  </Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
            {
              mode == 'closure' &&
              <PerformerButton title="Close" description="Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" color="red" onBuild={() => {
                return Builder.withdrawPool({ poolId: item.id.toString() });
              }}></PerformerButton>
            }
            {
              mode == 'isolated-rebalancer' &&
              <PerformerButton title="Reopen" description="Smart contract will re-balance this pool based on current market price and pool liquidity" color="yellow" onBuild={() => rebalance(false)}></PerformerButton>
            }
            {
              mode == 'cross-rebalancer' &&
              <PerformerButton title="Refill" description="Smart contract will re-balance this pool based on current market price and pool liquidity plus available balance" color="jade" onBuild={() => rebalance(true)}></PerformerButton>
            }
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
                    <Text size="2" color="lime">Buy at</Text>
                    <Text size="2" color="lime">≤ { Readability.toMoney(item.secondaryAsset, bidPrice) }</Text>
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
            <Flex justify="end" align="center" wrap="wrap" gap="4" mt="1">
              <Select.Root value={mode} onValueChange={(e) => setMode(e as any)}>
                <Select.Trigger variant="ghost" />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Action</Select.Label>
                    <Select.Item value="closure">
                      <Box style={{ transform: 'translateY(3px)' }}>
                        <Icon path={mdiClose} size={0.9}></Icon>
                      </Box>
                    </Select.Item>
                    <Select.Item value="isolated-rebalancer">
                      <Box style={{ transform: 'translateY(3px)' }}>
                        <Icon path={mdiRotate3dVariant} size={0.9}></Icon>
                      </Box>
                    </Select.Item>
                    <Select.Item value="cross-rebalancer">
                      <Box style={{ transform: 'translateY(3px)' }}>
                        <Icon path={mdiRotateOrbit} size={0.9}></Icon>
                      </Box>
                    </Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              {
                mode == 'closure' &&
                <PerformerButton title="Close" description="Smart contract will re-pay you back the liquidity left in pool along with accumulated fees minus the exit fee" color="red" onBuild={() => {
                  return Builder.withdrawPool({ poolId: item.id.toString() });
                }}></PerformerButton>
              }
              {
                mode == 'isolated-rebalancer' &&
                <PerformerButton title="Reopen" description="Smart contract will re-balance this pool based on current market price and pool liquidity" color="yellow" onBuild={() => rebalance(false)}></PerformerButton>
              }
              {
                mode == 'cross-rebalancer' &&
                <PerformerButton title="Refill" description="Smart contract will re-balance this pool based on current market price and pool liquidity plus available balance" color="jade" onBuild={() => rebalance(true)}></PerformerButton>
              }
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