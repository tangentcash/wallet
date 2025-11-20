import { useCallback, useState } from "react";
import { AspectRatio, Avatar, Badge, Box, Callout, Card, Flex, Heading, Link, SegmentedControl, Select, Spinner, Tabs, Text, TextField, Tooltip } from "@radix-ui/themes";
import { RPC, EventResolver, SummaryState, AssetId, Readability } from 'tangentsdk';
import { useEffectAsync } from "../core/react";
import { AlertBox, AlertType } from "../components/alert";
import { mdiArrowLeftBoldHexagonOutline, mdiArrowRightBoldHexagonOutline, mdiInformationOutline, mdiKeyOutline, mdiLocationEnter, mdiQrcodeScan, mdiRulerSquareCompass } from "@mdi/js";
import { AppData } from "../core/app";
import { useNavigate } from "react-router";
import { Swap } from "../core/swap";
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
      return 'Unknown';
  }
}

const TRANSACTION_COUNT = 48;
export default function Account(props: { ownerAddress: string, self?: boolean, nonce?: number }) {
  const ownerAddress = props.ownerAddress;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [participations, setParticipations] = useState<any[]>([]);
  const [production, setProduction] = useState<any>(null);
  const [selectedAddress, setSelectedAddress] = useState<number>(-1);
  const [selectedAddressVersion, setSelectedAddressVersion] = useState<number>(0);
  const [control, setControl] = useState<'balance' | 'address' | 'validator'>('balance');
  const [transactions, setTransactions] = useState<{ transaction: any, receipt?: any, state?: SummaryState }[]>([]);
  const [mempoolTransactions, setMempoolTransactions] = useState<any[]>([]);
  const [moreTransactions, setMoreTransactions] = useState(true);
  const addressPurpose = useCallback((address: any) => {
    if (!address)
      return <>None</>;

    const ownerType = address.owner == ownerAddress ? ' (this account)' : '';
    const managerType = address.manager == ownerAddress ? ' (this account)' : ' (validator)';
    if (address.purpose == 'witness' && address.manager == address.owner)
      return <>Witness wallet → dismissed. Linked to <Link href="#">{address.owner}</Link>{ ownerType }</>;
    else if (address.purpose == 'routing' && address.manager == null)
      return <>Routing wallet → receive/pay to bridge wallets. Linked to <Link href="#">{address.owner}</Link>{ ownerType }</>;
    else if (address.purpose == 'bridge' && address.manager != null)
      return <>Bridge wallet → receive/pay to routing wallets. Linked to <Link href="#">{address.manager}</Link>{ managerType }</>;
    else if (address.manager != null)
      return <>Unknown wallet. Linked to <Link href="#">{address.owner}</Link>{ ownerType }, managed by <Link href="#">{address.manager}</Link>{ managerType }</>;
    return <>Unknown wallett. Linked to <Link href="#">{address.owner}</Link>{ ownerType }</>;
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
        try {
          let addressData = await RPC.fetchAll((offset, count) => RPC.getWitnessAccounts(ownerAddress, offset, count));
          if (Array.isArray(addressData)) {
            addressData = addressData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
            setAddresses(addressData);
          } else {
            setAddresses([]);
          }
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account addresses: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          const attestationData = await RPC.fetchAll((offset, count) => RPC.getValidatorAttestations(ownerAddress, offset, count));
          setAttestations(Array.isArray(attestationData) ? attestationData : []);
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account attestations: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          const participationData = await RPC.fetchAll((offset, count) => RPC.getValidatorParticipations(ownerAddress, offset, count));
          setParticipations(Array.isArray(participationData) ? participationData : []);
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account participations: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          const productionData = await RPC.getValidatorProduction(ownerAddress);
          setProduction(productionData || null);
        } catch { }
      })(),
      findMempoolTransactions(),
      findTransactions(true)
    ]);
  }, [ownerAddress]);
  useEffectAsync(async () => {
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
  const magicButton = () => (
    <Select.Root size="2" defaultValue="-2" onValueChange={(value) => {
      if (value == '-1') {
        navigate(Swap.subroute);
      } else if (value != '-2') {
        navigate(`/bridge?asset=${AssetId.fromHandle(assets[parseInt(value)].asset.chain).id}`);
      }
    }}>
      <Select.Trigger variant="surface">
      </Select.Trigger>
      <Select.Content variant="soft">
        <Select.Group>
          <Select.Item value="-2">
            <Flex align="center" gap="2">
              <Box style={{ transform: 'translateY(2px)' }}>
                <Icon path={mdiRulerSquareCompass} size={0.8} color="var(--bronze-11)"></Icon>
              </Box>
              <Text size="2" weight="light" color="bronze">DeFi</Text>
            </Flex>
          </Select.Item>
          <Select.Item value="-1">
            <Flex align="center" gap="2">
              <Icon path={mdiLocationEnter} size={1.05} color="var(--jade-11)"></Icon>
              <Text size="2" weight="light" color="jade">Tangent swap</Text>
            </Flex>
          </Select.Item>
          {
            assets.map((item, index) =>
              <Select.Item key={item.asset.id + '_select'} value={index.toString()} disabled={!item.asset.handle}>
                <Flex align="center" gap="1">
                  <Avatar mr="1" size="1" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} style={{ width: '24px', height: '24px' }} />
                  <Text size="2" weight="light">{Readability.toAssetName(item.asset)} bridge</Text>
                </Flex>
              </Select.Item>
            )
          }
        </Select.Group>
      </Select.Content>
    </Select.Root>
  );
  return (
    <Box>
      <Box width="100%" px="2">
        <Card mt="3" variant="surface" style={{
            border: '1px solid var(--gray-7)',
            borderRadius: '28px'
          }}>
          <Flex justify={mobile ? 'center' : 'between'} gap="2" py="1">
            <SegmentedControl.Root value={control} radius="full" size="2" mb="2" onValueChange={(value) => setControl(value as any)}>
              <SegmentedControl.Item value="address">Fund</SegmentedControl.Item>
              <SegmentedControl.Item value="balance">Balance</SegmentedControl.Item>
              <SegmentedControl.Item value="validator">Node</SegmentedControl.Item>
            </SegmentedControl.Root>
            { props.self && !mobile && magicButton() }
          </Flex>
          <Tabs.Root value={control}>
            <Tabs.Content value="balance">
              {
                !assets.length &&
                <Tooltip content="Account does not have any non-zero asset balances">
                  <Flex px="2" py="2" gap="3" align="center">
                    <Avatar size="2" radius="large" fallback="NA" color="gray" />
                    <Box width="100%">
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">N/A</Text>
                        <Badge size="1" radius="medium">0.00%</Badge>
                      </Flex>
                      <Text as="div" size="2" weight="medium">0.0</Text>
                    </Box>
                  </Flex>
                </Tooltip>
              }
              { 
                assets.map((item) =>
                  <Flex key={item.asset.id + '_balance'} px="2" py="2" gap="3" align="center">
                    <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
                    <Box width="100%">
                      <Flex justify="between" align="center">
                        <Tooltip content={ Readability.toAssetName(item.asset, true) + ' blockchain' }>
                          <Text as="div" size="2" weight="light">{Readability.toAssetName(item.asset)}</Text>
                        </Tooltip>
                        <Tooltip content={
                          <>
                            <Text style={{ display: 'block' }}>Locked value: { Readability.toMoney(item.asset, item.reserve) }</Text>
                            <Text style={{ display: 'block' }}>Unlocked value: { Readability.toMoney(item.asset, item.balance) }</Text>
                            <Text style={{ display: 'block' }} mt="1">Total value: { Readability.toMoney(item.asset, item.supply) }</Text>
                          </>
                          }>
                          <Badge size="1" radius="medium" color={item.reserve.gt(0) ? 'yellow' : 'jade'}>{ (Math.floor(10000 - item.reserve.dividedBy(item.supply).toNumber() * 10000) / 100).toFixed(2) }%</Badge>
                        </Tooltip>
                      </Flex>
                      <Text as="div" size="2" weight="medium">{ Readability.toMoney(item.asset, item.supply) }</Text>
                    </Box>
                  </Flex>
                )
              }
            </Tabs.Content>
            <Tabs.Content value="address">
              <Box px="2" py="2">
                <Flex justify="center" mb="4">
                  {
                    selectedAddress == -1 &&
                    <Callout.Root size="1">
                      <Callout.Icon>
                        <Icon path={mdiInformationOutline} size={1} />
                      </Callout.Icon>
                      <Callout.Text>Tangent wallet with cross-chain capabilities.</Callout.Text>
                    </Callout.Root>
                  }
                  {
                    selectedAddress != -1 &&
                    <Callout.Root size="1">
                      <Callout.Icon>
                        <Icon path={mdiInformationOutline} size={1} />
                      </Callout.Icon>
                      <Callout.Text wrap="balance" style={{ wordBreak: 'break-word' }}>
                        { addressPurpose(addresses[selectedAddress]) } 
                      </Callout.Text>
                    </Callout.Root>
                  }
                </Flex>
                <Flex justify="center" width="100%">
                  <Box width="80%" maxWidth="280px" px="3" py="3" style={{ borderRadius: '16px', backgroundColor: 'white' }}>
                    <AspectRatio ratio={1}>
                      <QRCode value={ selectedAddress == -1 ? ownerAddress : addresses[selectedAddress].addresses[selectedAddressVersion] } style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                    </AspectRatio>
                  </Box>
                </Flex>
                {
                  selectedAddress != -1 &&
                  <Flex justify="center" mt="3">
                    <Badge size="2" color={addresses[selectedAddress].purpose != 'witness' ? 'orange' : 'red'} radius="medium" style={{ textTransform: 'uppercase' }}>{ toAddressType(addresses[selectedAddress].purpose) }</Badge>
                  </Flex>
                }
                <Box width="100%" mt="6">
                  <TextField.Root size={document.body.clientWidth < 450 ? '2' : '3'} variant="soft" readOnly={true} value={ Readability.toAddress(selectedAddress == -1 ? ownerAddress : addresses[selectedAddress].addresses[selectedAddressVersion], 12) } onClick={() => {
                      navigator.clipboard.writeText(selectedAddress == -1 ? ownerAddress : addresses[selectedAddress].addresses[selectedAddressVersion]);
                      AlertBox.open(AlertType.Info, 'Address v' + (selectedAddress == -1 ? selectedAddressVersion + 1 : (addresses[selectedAddress].addresses.length - selectedAddressVersion)) + ' copied!')
                    }}>
                    <TextField.Slot color="gray">
                      <Icon path={mdiKeyOutline} size={0.7} style={{ paddingLeft: '4px' }} />
                    </TextField.Slot>
                  </TextField.Root>
                  <Flex width="100%" mt="3">
                    <Select.Root size={document.body.clientWidth < 450 ? '2' : '3'} value={selectedAddressVersion.toString()} onValueChange={(value) => setSelectedAddressVersion(parseInt(value))}>
                      <Select.Trigger variant="soft" color="gray" style={{ width: '100%' }}>
                        <Flex as="span" align="center" gap="2">
                          <Icon path={mdiQrcodeScan} size={0.7} style={{ color: 'var(--gray-11)' }} />
                          <Text color="gray">{ selectedAddress == -1 ? 'Tangent' : Readability.toAssetName(addresses[selectedAddress].asset) } address { selectedAddress == -1 ? 'v1' : ('v' + (addresses[selectedAddress].addresses.length - selectedAddressVersion))}</Text>
                        </Flex>
                      </Select.Trigger>
                      <Select.Content variant="soft">
                        <Select.Group>
                          <Select.Label>Address version</Select.Label>
                          {
                            selectedAddress == -1 &&
                              <Select.Item value="0">
                                <Flex align="center" gap="1">
                                  <Text>Version 1</Text>
                                </Flex>
                              </Select.Item>
                          }
                          {
                            selectedAddress != -1 &&
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
                  </Flex>
                </Box>
              </Box>
              <Flex justify="center" mt="4">
                <Select.Root size="3" value={selectedAddress.toString()} onValueChange={(value) => { setSelectedAddress(parseInt(value)); setSelectedAddressVersion(0); }}>
                  <Select.Trigger variant="soft" />
                  <Select.Content variant="soft">
                    <Select.Group>
                      <Select.Label>Account addresses</Select.Label>
                      <Select.Item value="-1">
                        <Flex align="center" gap="1">
                          <Text style={{ color: 'var(--accent-9)' }}>{ ownerAddress.substring(ownerAddress.length - 2).toUpperCase() }</Text>
                          <Text>TANGENT</Text>
                        </Flex>
                      </Select.Item>
                      {
                        addresses.map((item, index) => {
                          const base = item.addresses[0].split(':')[0];
                          const tag = base.substring(base.length - 2).toUpperCase();
                          return (
                            <Select.Item key={item.hash + '_address_select'} value={index.toString()}>
                              <Flex align="center" gap="1">
                                <Avatar mr="1" size="1" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} style={{ width: '20px', height: '20px' }} />
                                <Text style={{ color: 'var(--accent-9)' }}>{ tag }</Text>
                                <Text>{ Readability.toAssetName(item.asset).toUpperCase() }</Text>
                              </Flex>
                            </Select.Item>
                          );
                        })
                      }
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Flex>
            </Tabs.Content>
            <Tabs.Content value="validator">
              <Flex px="2" py="2" gap="3">
                <Icon path={mdiArrowRightBoldHexagonOutline} size={1.5} style={{ color: 'var(--red-10)' }} />
                <Box width="100%">
                  <Flex justify="between" align="center">
                    <Text as="div" size="2" weight="light">Block production</Text>
                  </Flex>
                  <Tooltip content="Gas accumulated from every produced block">
                    <Badge size="1" color={production ? (production.active ? 'jade' : 'red') : 'orange'}>PRODUCER { production ? (production.active ? 'ONLINE' : 'OFFLINE') : 'STANDBY' }</Badge>
                  </Tooltip>
                </Box>
              </Flex>
              {
                production && production.stakes.length > 0 &&
                <Box pl="5">
                  {
                    production.stakes.map((item: any) => {
                      return (
                        <Flex key={item.asset.id + '_production'} pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                          <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
                          <Box width="100%" style={{ marginLeft: '2px' }}>
                            <Tooltip content={Readability.toAssetSymbol(item.asset) + " fees received by block producer, when unlocked block producer will lose half of their gas production"}>
                              <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(item.asset, item.stake) }</Text>
                            </Tooltip>
                          </Box>
                        </Flex>
                      )
                    })
                  }
                </Box>
              }
              {
                production &&
                <Flex px="2" py="2" gap="3" align="center">
                  <Icon path={mdiArrowLeftBoldHexagonOutline} size={1.5} style={{ color: 'var(--jade-10)' }} />
                  <Box width="100%">
                    <Flex justify="between" align="center">
                      <Text as="div" size="2" weight="light">{ production.active ? 'Activity' : 'Downtime' }</Text>
                    </Flex>
                    <Tooltip content="Block in which producer's state has been affected">
                      <Text as="div" size="2" weight="medium">{ production.active ? 'In' : 'From'} block { production.block_number.toNumber() }</Text>
                    </Tooltip>
                  </Box>
                </Flex>
              }
              {
                participations.length > 0 &&
                <Box px="2" my="2">
                  <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                </Box>
              }
              { 
                participations.map((item) =>
                  <Flex key={item.asset.id + '_participation'} px="2" py="2" gap="3" align="center">
                    <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
                    <Box width="100%" style={{ marginLeft: '2px' }}>
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">{ Readability.toAssetName(item.asset) } bridge participation</Text>
                      </Flex>
                      {
                        item.stakes.map((stake: any, index: number) =>
                          <Tooltip key={item.asset.id + index.toString() + '_participation_index'} content={stake.asset.chain + ' stake and fees received by bridge participation as a signer of withdrawal transactions'}>
                            <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(stake.asset, stake.stake) } for { Readability.toCount('participation', item.participations) }</Text>
                          </Tooltip>)
                      }
                      {
                        !item.stakes.length && !item.participations &&
                        <Badge size="1" radius="medium" color="red">OFFLINE</Badge>
                      }
                    </Box>
                  </Flex>
                )
              }
              {
                attestations.length > 0 &&
                <Box px="2" my="2">
                  <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                </Box>
              }
              { 
                attestations.map((item) =>
                  <Flex key={item.asset.id + '_attestation'} px="2" py="2" gap="3" align="center">
                    <Avatar size="2" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} />
                    <Box width="100%" style={{ marginLeft: '2px' }}>
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">{ Readability.toAssetName(item.asset) } bridge attestation</Text>
                      </Flex>
                      {
                        item.stakes.map((stake: any, index: number) =>
                          <Tooltip key={item.asset.id + index.toString() + '_attestation_index'} content={stake.asset.chain + ' stake and fees received by bridge attestation as a deposit/withdrawal transaction notifications'}>
                            <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(stake.asset, stake.stake) }</Text>
                          </Tooltip>)
                      }
                      {
                        !item.stakes.length &&
                        <Badge size="1" radius="medium" color="red">OFFLINE</Badge>
                      }
                    </Box>
                  </Flex>
                )
              }
            </Tabs.Content>
          </Tabs.Root>
        </Card>
        {
          props.self && mobile &&
          <Flex justify="end" pt="3">
            { magicButton() }
          </Flex>
        }
      </Box>
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
                    <Box px="2" mb="4" key={item.hash + index + '_mempool'}>
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
                  <Box px="2" mb="4">
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