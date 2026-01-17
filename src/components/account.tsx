import { useCallback, useState } from "react";
import { AspectRatio, Avatar, Badge, Box, Button, Callout, Card, Flex, Heading, IconButton, Link, SegmentedControl, Select, Spinner, Tabs, Text, TextField, Tooltip } from "@radix-ui/themes";
import { RPC, EventResolver, SummaryState, AssetId, Readability } from 'tangentsdk';
import { useEffectAsync } from "../core/react";
import { AlertBox, AlertType } from "../components/alert";
import { mdiArrowRightBoldHexagonOutline, mdiBridge, mdiCellphoneKey, mdiClose, mdiCoffin, mdiInformationOutline, mdiKeyOutline, mdiQrcodeScan, mdiRulerSquareCompass, mdiSetLeft, mdiSourceCommitLocal, mdiSourceCommitStartNextLocal, mdiTagOutline, mdiTransitConnectionVariant } from "@mdi/js";
import { AppData } from "../core/app";
import { useNavigate } from "react-router";
import { Swap } from "../core/swap";
import BigNumber from "bignumber.js";
import InfiniteScroll from 'react-infinite-scroll-component';
import QRCode from "react-qr-code";
import Icon from "@mdi/react";
import Transaction from "../components/transaction";

function toAddressType(type: string): string {
  switch (type) {
    case 'routing':
      return 'Withdrawal receiver / deposit sender';
    case 'bridge':
      return 'Deposit receiver';
    case 'witness':
      return 'Dismissed witness';
    default:
      return 'Tangent wallet';
  }
}

const TRANSACTION_COUNT = 16;
export default function Account(props: { ownerAddress: string, self?: boolean, nonce?: number }) {
  const ownerAddress = props.ownerAddress;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [participation, setParticipation] = useState<any>([]);
  const [production, setProduction] = useState<any>(null);
  const [selectedAddress, setSelectedAddress] = useState<number>(-1);
  const [selectedAddressVersion, setSelectedAddressVersion] = useState<number>(0);
  const [control, setControl] = useState<'balance' | 'address' | 'validator'>('balance');
  const [transactions, setTransactions] = useState<{ transaction: any, receipt?: any, state?: SummaryState }[]>([]);
  const [mempoolTransactions, setMempoolTransactions] = useState<any[]>([]);
  const [moreTransactions, setMoreTransactions] = useState(true);
  const addressPurpose = useCallback((address: any) => {
    if (!address || !address.purpose)
      return <>Tangent wallet with cross-chain capabilities.</>;

    const ownerType = address.owner == ownerAddress ? ' (this account)' : '';
    const managerType = address.manager == ownerAddress ? ' (this account)' : ' (validator)';
    if (address.purpose == 'witness' && address.manager == address.owner)
      return <>Witness wallet → dismissed.</>;
    else if (address.purpose == 'routing' && address.manager == null)
      return <>Routing wallet → receive/pay to bridge wallets.</>;
    else if (address.purpose == 'bridge' && address.manager != null)
      return <>Bridge wallet → receive/pay to routing wallets.</>;
    else if (address.manager != null)
      return <>Unknown wallet. Linked to <Link href="#">{address.owner}</Link>{ ownerType }, managed by <Link href="#">{address.manager}</Link>{ managerType }</>;
    return <>Unknown wallet. Linked to <Link href="#">{address.owner}</Link>{ ownerType }</>;
  }, [ownerAddress]);
  const findTransactions = useCallback(async (refresh?: boolean) => {
    try {
      const data = await RPC.getTransactionsByOwner(ownerAddress, refresh ? 0 : transactions.length, TRANSACTION_COUNT, 0, 2);
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setTransactions([]);
        setMoreTransactions(false);
        return false;
      }

      const candidateTransactions = data.map((value) => { return { ...value, state: EventResolver.calculateSummaryState(value?.receipt?.events) } });
      setTransactions(refresh ? candidateTransactions : prev => prev.concat(candidateTransactions));
      setMoreTransactions(candidateTransactions.length >= TRANSACTION_COUNT);
      return candidateTransactions.length > 0;
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch transactions: ' + (exception as Error).message);
      if (refresh)
        setTransactions([]);
      setMoreTransactions(false);
      return false;
    }
  }, [ownerAddress, transactions]);
  const findMempoolTransactions = useCallback(async () => {
    try {
      const data = await RPC.getMempoolTransactionsByOwner(ownerAddress, 0, TRANSACTION_COUNT, 0, 1);
      if (Array.isArray(data)) {
        setMempoolTransactions(data);
        return data.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }, [ownerAddress]);
  const updateFullAccountData = useCallback(async () => { 
    await Promise.all([
      (async () => {
        try {
          let assetData = await RPC.fetchAll((offset, count) => RPC.getAccountBalances(ownerAddress, offset, count));
          if (Array.isArray(assetData)) {
            assetData = assetData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
            assetData = assetData.filter((item) => item.balance?.gt(0) || item.reserve?.gt(0) || item.supply?.gt(0));
            setAssets(assetData);
            if (AppData.getWalletAddress() == ownerAddress && !assetData.length)
              setControl('address');
          } else {
            setAssets([]);
          }
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account balances: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        const defaultAddress = { asset: new AssetId(), addresses: [{ address: ownerAddress }] };
        try {
          let addressData = await RPC.fetchAll((offset, count) => RPC.getWitnessAccounts(ownerAddress, offset, count));
          if (Array.isArray(addressData) && addressData.length > 0) {
            addressData = addressData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle)).map((item) => ({ ...item, addresses: item.addresses.map((address: string) => Readability.toTaggedAddress(address)) }));
            setAddresses([defaultAddress, ...addressData]);
          } else {
            setAddresses([defaultAddress]);
            setSelectedAddress(0);
          }
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account addresses: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          const attestationData = await RPC.getValidatorAttestationsWithRewards(ownerAddress);
          setAttestations(Array.isArray(attestationData) ? attestationData : []);
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account attestations: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          const participationData = await RPC.getValidatorParticipationWithRewards(ownerAddress);
          setParticipation(participationData || null);
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account participations: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          const productionData = await RPC.getValidatorProductionWithRewards(ownerAddress);
          setProduction(productionData || null);
        } catch { }
      })(),
      findMempoolTransactions(),
      findTransactions(true)
    ]);
  }, [ownerAddress]);
  useEffectAsync(async () => {
    if (!AppData.tip)
      await AppData.sync();
    
    await updateFullAccountData();
    setLoading(false);
  }, [ownerAddress, props.nonce]);
  if (loading) {
    return (
      <Flex justify="center" pt="6">
        <Spinner size="3" />
      </Flex>
    )
  }

  const mobile = document.body.clientWidth < 500;
  return (
    <Box>
      <Card mt="3" variant="surface" style={{ borderRadius: '28px' }}>
        <Flex justify={mobile ? 'center' : 'start'} gap="2" py="1">
          <SegmentedControl.Root value={control} radius="full" size={mobile ? '2' : '3'} mb="2" onValueChange={(value) => setControl(value as any)}>
            <SegmentedControl.Item value="address">Fund</SegmentedControl.Item>
            <SegmentedControl.Item value="balance">Balance</SegmentedControl.Item>
            <SegmentedControl.Item value="validator">Node</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Flex>
        <Tabs.Root value={control}>
          <Tabs.Content value="balance">
            {
              !assets.length &&
              <Tooltip content="Account does not have any non-zero asset balances">
                <Flex px="2" py="3" gap="3" align="center">
                  <Avatar size="3" radius="large" fallback="NA" color="gray" />
                  <Box width="100%">
                    <Flex justify="between" align="center">
                      <Text as="div" size="2" weight="light">N/A</Text>
                      <Badge size="1">0.00%</Badge>
                    </Flex>
                    <Text as="div" size="2" weight="medium">0.0</Text>
                  </Box>
                </Flex>
              </Tooltip>
            }
            { 
              assets.map((item) =>
                <Flex key={item.asset.id + '_balance'} px="2" py="3" gap="3" align="center">
                  <Avatar size="3" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
                  <Box width="100%">
                    <Flex justify="between" align="center">
                      <Tooltip content={ Readability.toAssetName(item.asset, true) + ' blockchain' }>
                        <Text as="div" size="3" weight="light">{Readability.toAssetName(item.asset)}</Text>
                      </Tooltip>
                      <Tooltip content={
                        <>
                          <Text style={{ display: 'block' }}>Locked value: { new BigNumber(item.reserve).toString() } { Readability.toAssetSymbol(item.asset) }</Text>
                          <Text style={{ display: 'block' }}>Unlocked value: { new BigNumber(item.balance).toString() } { Readability.toAssetSymbol(item.asset) }</Text>
                          <Text style={{ display: 'block' }} mt="1">Total value: { new BigNumber(item.supply).toString() } { Readability.toAssetSymbol(item.asset) }</Text>
                        </>
                        }>
                        <Badge size="1" color={item.reserve.gt(0) ? 'yellow' : 'jade'}>{ (Math.floor(10000 - item.reserve.dividedBy(item.supply).toNumber() * 10000) / 100).toFixed(1) }%</Badge>
                      </Tooltip>
                    </Flex>
                    <Text as="div" size="2" weight="medium">{ Readability.toMoney(item.asset, item.supply) }</Text>
                  </Box>
                </Flex>
              )
            }
          </Tabs.Content>
          <Tabs.Content value="address">
            {
              selectedAddress >= 0 && selectedAddress < addresses.length &&
              <Box px="2" py="2">
                <Flex justify="center" mb="4">
                  <Callout.Root size="1">
                    <Callout.Icon>
                      <Icon path={mdiInformationOutline} size={1} />
                    </Callout.Icon>
                    <Callout.Text wrap="balance" style={{ wordBreak: 'break-word' }}>
                      { addressPurpose(addresses[selectedAddress]) } 
                    </Callout.Text>
                  </Callout.Root>
                </Flex>
                <Flex justify="center" width="100%">
                  <Box width="80%" maxWidth="280px" px="3" py="3" style={{ borderRadius: '16px', backgroundColor: 'white' }}>
                    <AspectRatio ratio={1}>
                      <QRCode value={ addresses[selectedAddress].addresses[selectedAddressVersion].address } style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                    </AspectRatio>
                  </Box>
                </Flex>
                <Flex align="center" justify="center" mt="3" gap="2">
                  <Badge size="2" color={addresses[selectedAddress].purpose != 'witness' ? 'orange' : 'red'} style={{ textTransform: 'uppercase' }}>{ toAddressType(addresses[selectedAddress].purpose) }</Badge>
                  {
                    addresses[selectedAddress].purpose != 'bridge' &&
                    <Badge size="2" color="red" style={{ textTransform: 'uppercase' }}>Your wallet</Badge>
                  }
                </Flex>
                <Box mt="6">
                  <Flex gap="2">
                    <TextField.Root size="3" style={{ width: '100%' }} variant="soft" readOnly={true} value={ Readability.toAddress(addresses[selectedAddress].addresses[selectedAddressVersion].address, mobile ? 6 : 12) } onClick={() => {
                        navigator.clipboard.writeText(addresses[selectedAddress].addresses[selectedAddressVersion].address);
                        AlertBox.open(AlertType.Info, 'Address v' + (addresses[selectedAddress].addresses.length - selectedAddressVersion) + ' copied!')
                      }}>
                      <TextField.Slot color="gray">
                        <Icon path={mdiKeyOutline} size={0.7} style={{ paddingLeft: '4px' }} />
                      </TextField.Slot>
                    </TextField.Root>
                    <IconButton variant="soft" size="3" color="red" onClick={() => { setSelectedAddress(-1); setSelectedAddressVersion(0); }}>
                      <Icon path={mdiClose} size={1}></Icon>
                    </IconButton>
                  </Flex>
                  {
                    addresses[selectedAddress].addresses[selectedAddressVersion].tag != null &&
                    <TextField.Root mt="3" size="3" color="red" variant="soft" readOnly={true} value={ 'Destination tag (memo) #' + addresses[selectedAddress].addresses[selectedAddressVersion].tag } onClick={() => {
                        navigator.clipboard.writeText(addresses[selectedAddress].addresses[selectedAddressVersion].tag);
                        AlertBox.open(AlertType.Info, 'Destination tag / memo copied!')
                      }}>
                      <TextField.Slot color="red">
                        <Icon path={mdiTagOutline} size={0.7} style={{ paddingLeft: '4px' }} />
                      </TextField.Slot>
                    </TextField.Root>
                  }
                  <Box width="100%" mt="3">
                    <Select.Root size="3" value={selectedAddressVersion.toString()} onValueChange={(value) => setSelectedAddressVersion(parseInt(value))}>
                      <Select.Trigger variant="soft" color="gray" style={{ width: '100%' }}>
                        <Flex as="span" align="center" gap="2">
                          <Icon path={mdiQrcodeScan} size={0.7} style={{ color: 'var(--gray-11)' }} />
                          <Text color="gray">{ Readability.toAssetName(addresses[selectedAddress].asset) } address v{ addresses[selectedAddress].addresses.length - selectedAddressVersion }</Text>
                        </Flex>
                      </Select.Trigger>
                      <Select.Content variant="soft">
                        <Select.Group>
                          <Select.Label>Address version</Select.Label>
                          {
                            addresses[selectedAddress].addresses.map((address: any, index: number) =>
                              <Select.Item value={index.toString()} key={address + '_address'}>
                                <Flex align="center" gap="1">
                                  <Text>Version {addresses[selectedAddress].addresses.length - index}</Text>
                                </Flex>
                              </Select.Item>
                            )
                          }
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </Box>
                </Box>
              </Box>
            }
            {
              (selectedAddress < 0 || selectedAddress >= addresses.length) &&
              <Box px="2" py="2">
                {
                  addresses.map((item, index) =>
                    <Box key={item.hash + '_address_select'} mb={ index == addresses.length - 1 ? undefined : '4' }>
                      <Button variant="soft" color="gray" size="3" style={{ display: 'block', height: 'auto', width: '100%' }} onClick={() => { setSelectedAddress(index); setSelectedAddressVersion(0); }}>
                        <Flex gap="3" align="center" py="3">
                          <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} style={{ width: '40px', height: '40px' }} />
                          <Flex justify="between" align="center" width="100%">
                            <Flex direction="column" align="start">
                              <Text size="3" style={{ color: 'var(--gray-12)' }}>{ Readability.toAssetName(item.asset) }</Text>
                              <Text size="1" color="gray">{ Readability.toAddress(item.addresses[0].address, 6) }{ item.addresses.length > 1 ? ' + ' + Readability.toCount('variant', item.addresses.length) : '' }</Text>
                            </Flex>
                            {
                              item.purpose == null &&
                              <Box className="rt-reset rt-BaseButton rt-r-size-2 rt-variant-surface rt-IconButton" data-accent-color="jade">
                                <Icon path={mdiSourceCommitStartNextLocal} size={1}></Icon>
                              </Box>
                            }
                            {
                              item.purpose == 'bridge' && 
                              <Box className="rt-reset rt-BaseButton rt-r-size-2 rt-variant-surface rt-IconButton" data-accent-color="blue">
                                <Icon path={mdiBridge} size={1}></Icon>
                              </Box>
                            }
                            {
                              item.purpose == 'routing' && 
                              <Box className="rt-reset rt-BaseButton rt-r-size-2 rt-variant-surface rt-IconButton" data-accent-color="jade">
                                <Icon path={mdiSourceCommitLocal} size={1}></Icon>
                              </Box>
                            }
                            {
                              item.purpose == 'witness' && 
                              <Box className="rt-reset rt-BaseButton rt-r-size-2 rt-variant-surface rt-IconButton" data-accent-color="red">
                                <Icon path={mdiCoffin} size={1}></Icon>
                              </Box>
                            }
                          </Flex>
                        </Flex>
                      </Button>
                    </Box>
                  )
                }
              </Box>
            }
          </Tabs.Content>
          <Tabs.Content value="validator">
            <Flex px="2" py="2" gap="3">
              <Icon path={mdiArrowRightBoldHexagonOutline} size={1.5} style={{ color: 'var(--red-10)' }} />
              <Box width="100%">
                <Flex justify="between" align="center">
                  <Text as="div" size="2" weight="light">Block production</Text>
                </Flex>
                <Badge size="1" color={production ? (production.stake != null ? 'jade' : 'red') : 'orange'}>PRODUCER { production ? (production.stake != null ? 'ACTIVE' : 'OFFLINE') : 'STANDBY' }{ production != null ? production.stake != null ? ' IN BLOCK ' + production.block_number.toNumber() : (' FROM BLOCK ' + production.block_number.toNumber()) : '' }</Badge>
              </Box>
            </Flex>
            {
              production && (production.stake.gte(0) || production.rewards.length > 0) &&
              <Box pl="5">
                {
                  production.stake != null && production.stake.gte(0) &&
                  <Flex pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                    <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(new AssetId())} src={Readability.toAssetImage(new AssetId())} />
                    <Box width="100%" style={{ marginLeft: '2px' }}>
                      <Tooltip content={Readability.toAssetSymbol(new AssetId()) + " fees received by block producer, when unlocked block producer will lose half of their gas production"}>
                        <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(new AssetId(), production.stake) }</Text>
                      </Tooltip>
                    </Box>
                  </Flex>
                }
                {
                  production.rewards.map((item: any) => {
                    return (
                      <Flex key={item.asset.id + '_production'} pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                        <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
                        <Box width="100%" style={{ marginLeft: '2px' }}>
                          <Tooltip content={Readability.toAssetSymbol(item.asset) + " fees received by block producer, when unlocked block producer will lose half of their gas production"}>
                            <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(item.asset, item.reward) }</Text>
                          </Tooltip>
                        </Box>
                      </Flex>
                    )
                  })
                }
              </Box>
            }
            {
              participation &&
              <>
                <Flex px="2" py="2" gap="3">
                  <Icon path={mdiCellphoneKey} size={1.5} style={{ color: 'var(--yellow-9)' }} />
                  <Box width="100%">
                    <Flex justify="between" align="center">
                      <Text as="div" size="2" weight="light">Bridge participation</Text>
                    </Flex>
                    <Badge size="1" color={participation.stake != null ? 'jade' : 'red'}>PARTICIPANT { (participation.stake != null ? 'ACTIVE' : 'OFFLINE') }{ participation.stake != null ? ' IN BLOCK ' + participation.block_number.toNumber() : (' FROM BLOCK ' + participation.block_number.toNumber()) }</Badge>
                  </Box>
                </Flex>
                <Box pl="5">
                  {
                    participation.stake != null && participation.stake.gte(0) &&
                    <Flex pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                      <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(new AssetId())} src={Readability.toAssetImage(new AssetId())} />
                      <Box width="100%" style={{ marginLeft: '2px' }}>
                        <Tooltip content={Readability.toAssetSymbol(new AssetId()) + " stake and fees received by bridge participation as a signer of withdrawal transactions"}>
                          <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(new AssetId(), participation.stake) }</Text>
                        </Tooltip>
                      </Box>
                    </Flex>
                  }
                  {
                    participation.rewards.map((item: any) => {
                      return (
                        <Flex key={item.asset.id + '_participation'} pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                          <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
                          <Box width="100%" style={{ marginLeft: '2px' }}>
                            <Tooltip content={Readability.toAssetSymbol(item.asset) + ' stake and fees received by bridge participation as a signer of withdrawal transactions'}>
                              <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(item.asset, item.reward) }</Text>
                            </Tooltip>
                          </Box>
                        </Flex>
                      )
                    })
                  }
                </Box>
              </>
            }
            { 
              attestations.map((attestation) =>
                <Box key={attestation.asset.id + '_attestation'}>
                  <Flex px="2" py="2" gap="3">
                    <Icon path={mdiTransitConnectionVariant} size={1.5} style={{ color: 'var(--jade-10)' }} />
                    <Box width="100%">
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">Bridge attestation — { Readability.toAssetName(new AssetId(attestation.asset.id)) }</Text>
                      </Flex>
                      <Badge size="1" color={attestation ? (attestation.stake != null ? 'jade' : 'red') : 'orange'}>ATTESTATION { attestation ? (attestation.stake != null ? 'ACTIVE' : 'OFFLINE') : 'STANDBY' }{ attestation != null ? attestation.stake != null ? ' IN BLOCK ' + attestation.block_number.toNumber() : (' FROM BLOCK ' + attestation.block_number.toNumber()) : '' }</Badge>
                    </Box>
                  </Flex>
                  <Box pl="5">
                    {
                      attestation.stake != null && attestation.stake.gte(0) &&
                      <Flex pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                        <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(new AssetId())} src={Readability.toAssetImage(new AssetId())} />
                        <Box width="100%" style={{ marginLeft: '2px' }}>
                          <Tooltip content={Readability.toAssetSymbol(new AssetId()) + " stake and fees received by bridge attestation as a deposit/withdrawal transaction notifications and participant coordination"}>
                            <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(new AssetId(), attestation.stake) }</Text>
                          </Tooltip>
                        </Box>
                      </Flex>
                    }
                    {
                      attestation.rewards.map((item: any) => {
                        return (
                          <Flex key={item.asset.id + '_attestation'} pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                            <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
                            <Box width="100%" style={{ marginLeft: '2px' }}>
                              <Tooltip content={Readability.toAssetSymbol(item.asset) + ' stake and fees received by bridge attestation as a deposit/withdrawal transaction notifications and participant coordination'}>
                                <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(item.asset, item.reward) }</Text>
                              </Tooltip>
                            </Box>
                          </Flex>
                        )
                      })
                    }
                  </Box>
                </Box>
              )
            }
          </Tabs.Content>
        </Tabs.Root>
      </Card>
      {
        props.self &&
        <Flex justify={mobile ? 'center' : 'end'} pt="3" gap="2">
          <Select.Root size="3" defaultValue="-1" onValueChange={(value) => {
            const index = parseInt(value);
            if (index >= 0) {
              navigate(`/bridge?asset=${assets[index].asset.id}`);
            }
          }}>
            <Select.Trigger variant="soft" color="blue">
            </Select.Trigger>
            <Select.Content variant="soft">
              <Select.Group>
                <Select.Item value="-1">
                  <Flex align="center" gap="2">
                    <Box style={{ transform: 'translateY(2px)' }}>
                      <Icon path={mdiSetLeft} size={0.9} color="var(--blue-11)"></Icon>
                    </Box>
                    <Text size="3" weight="light" color="blue">Bridge</Text>
                  </Flex>
                </Select.Item>
                {
                  assets.filter((v) => v.asset.chain != new AssetId().chain).map((item, index) =>
                    <Select.Item key={item.asset.id + '_select'} value={index.toString()} disabled={item.asset.chain == new AssetId().chain}>
                      <Flex align="center" gap="1">
                        <Avatar mr="1" size="1" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} style={{ width: '24px', height: '24px' }} />
                        <Text size="2" weight="light">{Readability.toAssetName(item.asset)}</Text>
                      </Flex>
                    </Select.Item>
                  )
                }
              </Select.Group>
            </Select.Content>
          </Select.Root>
          <Button color="jade" size="3" variant="soft" className="shadow-rainbow-hover" onClick={() => navigate(Swap.subroute)}>
            <Flex align="center" gap="2">
              <Box style={{ transform: 'translateY(2px)' }}>
                <Icon path={mdiRulerSquareCompass} size={0.9} color="var(--jade-11)"></Icon>
              </Box>
              <Text size="3" weight="light" color="jade">Trade</Text>
            </Flex>
          </Button>
        </Flex>
      }
      {
        (transactions.length > 0 || mempoolTransactions.length > 0) &&
        <Box width="100%" my="8">
          <Box px="2">
            <Heading size={document.body.clientWidth < 450 ? '5' : '6'} mb="0">Transactions</Heading>
          </Box>
          {
            mempoolTransactions.length > 0 &&
            <Box width="100%">
              <Box px="2">
                <Text as="div" size="2" mb="1" align="right">Queue</Text>
                <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
              </Box>
              {
                mempoolTransactions.map((item, index) =>
                  <Box mb="4" key={item.hash + index + '_mempool'}>
                    <Transaction ownerAddress={ownerAddress} transaction={item}></Transaction>
                  </Box>
                )
              }
            </Box>
          }
          <InfiniteScroll dataLength={transactions.length} hasMore={moreTransactions} next={findTransactions} loader={<div></div>}>
            {
              transactions.map((item, index) =>
                <Box width="100%" key={item.transaction.hash + index + '_tx'}>
                  {
                    (!index || !item.receipt || new Date(transactions[index - 1].receipt.block_time?.toNumber()).setHours(0, 0, 0, 0) != new Date(item.receipt.block_time?.toNumber()).setHours(0, 0, 0, 0)) &&
                    <Box px="2">
                      <Text as="div" size="2" mb="1" align="right">{ item.receipt ? (new Date(item.receipt.block_time?.toNumber()).setHours(0, 0, 0, 0) == new Date().setHours(0, 0, 0, 0) ? 'Today' : new Date(item.receipt.block_time?.toNumber()).toLocaleDateString()) : 'Today' }</Text>
                      <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                    </Box>
                  }
                  <Box mb="4">
                    <Transaction ownerAddress={ownerAddress} transaction={item.transaction} receipt={item.receipt} state={item.state}></Transaction>
                  </Box>
                </Box>
              )
            }
          </InfiniteScroll>
        </Box>
      }
    </Box>
  );
}