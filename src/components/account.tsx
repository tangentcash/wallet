import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { AspectRatio, Avatar, Badge, Box, Button, Callout, Card, DropdownMenu, Flex, Heading, Link, SegmentedControl, Select, Spinner, Tabs, Text, TextField, Tooltip } from "@radix-ui/themes";
import { Interface, InterfaceUtil, SummaryState } from "../core/wallet";
import { useEffectAsync } from "../core/extensions/react";
import { AlertBox, AlertType } from "../components/alert";
import { mdiAlertOctagonOutline, mdiArrowLeftBoldHexagonOutline, mdiArrowRightBoldHexagonOutline, mdiInformationOutline, mdiKeyOutline, mdiQrcodeScan } from "@mdi/js";
import { Readability } from "../core/text";
import { AssetId } from "../core/tangent/algorithm";
import InfiniteScroll from 'react-infinite-scroll-component';
import QRCode from "react-qr-code";
import Icon from "@mdi/react";
import Transaction from "../components/transaction";
import { useNavigate } from "react-router";

function toAddressType(type: string): string {
  switch (type) {
    case 'routing':
      return 'Withdrawal receiver / deposit sender';
    case 'depository':
      return 'Deposit receiver';
    case 'witness':
      return 'Dismissed witness';
    default:
      return 'Unknown';
  }
}

const TRANSACTION_COUNT = 48;
const Account = forwardRef((props: { ownerAddress: string, owns?: boolean }, ref) => {
  const ownerAddress = props.ownerAddress;
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [observers, setObservers] = useState<any[]>([]);
  const [work, setWork] = useState<any>(null);
  const [selectedAddress, setSelectedAddress] = useState<number>(-1);
  const [selectedAddressVersion, setSelectedAddressVersion] = useState<number>(0);
  const [control, setControl] = useState<'balance' | 'address' | 'validator'>('balance');
  const [transactions, setTransactions] = useState<{ transaction: any, receipt?: any, state?: SummaryState }[]>([]);
  const [mempoolTransactions, setMempoolTransactions] = useState<any[]>([]);
  const [moreTransactions, setMoreTransactions] = useState(true);
  const navigate = useNavigate();
  const addressPurpose = useCallback((address: any) => {
    if (!address)
      return <>None</>;

    const ownerType = address.owner == ownerAddress ? ' (this account)' : '';
    const proposerType = address.proposer == ownerAddress ? ' (this account)' : ' (validator)';
    if (address.purpose == 'witness' && address.proposer == address.owner)
      return <>This is a coverage wallet that has been dismissed and disclosed earlier and is used by <Link href="#">{address.owner}</Link>{ ownerType }</>;
    else if (address.purpose == 'routing' && address.proposer == null)
      return <>This is a routing wallet that can transfer funds to and receive funds from any depository wallet and is used exclusively by <Link href="#">{address.owner}</Link>{ ownerType }</>;
    else if (address.purpose == 'depository' && address.proposer != null)
      return <>This is a depository wallet that can receive funds from or send funds to any router wallet and is used by <Link href="#">{address.proposer}</Link>{ proposerType }</>;
    else if (address.proposer != null)
      return <>This is an unknown wallet which is used by <Link href="#">{address.owner}</Link>{ ownerType } and is operated by <Link href="#">{address.proposer}</Link>{ proposerType }</>;
    return <>This is an unknown wallet which is used by <Link href="#">{address.owner}</Link>{ ownerType }</>;
  }, [ownerAddress]);
  const findTransactions = useCallback(async (refresh?: boolean) => {
    try {
      const data = await Interface.getTransactionsByOwner(ownerAddress, refresh ? 0 : transactions.length, TRANSACTION_COUNT, 0, 2);
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setTransactions([]);
        setMoreTransactions(false);
        return false;
      }

      const candidateTransactions = data.map((value) => { return { ...value, state: InterfaceUtil.calculateSummaryState(value?.receipt?.events) } });
      setTransactions(refresh ? candidateTransactions : transactions.concat(candidateTransactions));
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
      const data = await Interface.getMempoolTransactionsByOwner(ownerAddress, 0, TRANSACTION_COUNT, 0, 1);
      if (Array.isArray(data)) {
        setMempoolTransactions(data);
        return data.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }, [ownerAddress]);
  useEffectAsync(async () => {
    await Promise.all([
      (async () => {
        try {
          let assetData = await Interface.fetchAll((offset, count) => Interface.getAccountBalances(ownerAddress, offset, count));
          if (Array.isArray(assetData)) {
            assetData = assetData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
            assetData = assetData.filter((item) => item.balance?.gt(0) || item.reserve?.gt(0) || item.supply?.gt(0));
            setAssets(assetData);
            if (props.owns && !assetData.length)
              setControl('address');
          }
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account balances: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          let addressData = await Interface.fetchAll((offset, count) => Interface.getWitnessAccounts(ownerAddress, offset, count));
          if (Array.isArray(addressData)) {
            addressData = addressData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
            setAddresses(addressData);
          }
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account addresses: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          const observerData = await Interface.fetchAll((offset, count) => Interface.getAccountObservers(ownerAddress, offset, count));
          if (Array.isArray(observerData)) {
            setObservers(observerData);
          }
        } catch (exception) {
          AlertBox.open(AlertType.Error, 'Failed to fetch account observers: ' + (exception as Error).message)
        }
      })(),
      (async () => {
        try {
          const workData = await Interface.getAccountWork(ownerAddress);
          if (workData != null)
            setWork(workData);
        } catch { }
      })(),
      findMempoolTransactions(),
      findTransactions(true)
    ]);
    setLoading(false);
  }, [ownerAddress]);
  if (ref != null) {
    useImperativeHandle(ref, () => ({
      updateFinalizedTransactions: () => findTransactions(),
      updateMempoolTransactions: () => findMempoolTransactions()
    }));
  }
  if (loading) {
    return (
      <Flex justify="center" pt="6">
        <Spinner size="3" />
      </Flex>
    )
  }

  return (
    <Box>
      <SegmentedControl.Root value={control} radius="full" size="2" mt="2" onValueChange={(value) => setControl(value as any)}>
        <SegmentedControl.Item value="balance">Balance</SegmentedControl.Item>
        <SegmentedControl.Item value="address">Address</SegmentedControl.Item>
        <SegmentedControl.Item value="validator">Validator</SegmentedControl.Item>
      </SegmentedControl.Root>
      <Box px="2" mb="4">
        <Box mt="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
      </Box>
      <Tabs.Root value={control}>
        <Box width="100%" px="2">
          <Tabs.Content value="balance">
            <Card mt="3" variant="surface" className="before-clear" style={{
                border: '1px solid var(--gray-7)',
                // @ts-ignore
                backgroundImage: 'linear-gradient(45deg, var(--accent-3), var(--gray-3) 90%)',
                borderRadius: '28px'
              }}>
              {
                !assets.length &&
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
              }
              { 
                assets.map((item) =>
                  <Flex key={item.asset.id} px="2" py="2" gap="3" align="center">
                    <Avatar size="2" radius="full" fallback={(item.asset.token || item.asset.chain)[0]} src={'/cryptocurrency/' + (item.asset.token || item.asset.chain).toLowerCase() + '.svg'} />
                    <Box width="100%">
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">{Readability.toAssetName(item.asset)}</Text>
                        {
                          item.balance.gt(0) &&
                          <Tooltip content={ 'Reservation: ' + Readability.toMoney(item.asset, item.reserve) }>
                            <Badge size="1" radius="medium">{ (100 - item.reserve.dividedBy(item.supply).toNumber() * 100).toFixed(2) }%</Badge>
                          </Tooltip>
                        }
                      </Flex>
                      <Text as="div" size="2" weight="medium">{ Readability.toMoney(item.asset, item.balance) }</Text>
                    </Box>
                  </Flex>
                )
              }
            </Card>
          </Tabs.Content>
          <Tabs.Content value="address">
            {
              selectedAddress == -1 &&
              <Callout.Root size="1">
                <Callout.Icon>
                  <Icon path={mdiInformationOutline} size={1} />
                </Callout.Icon>
                <Callout.Text>This is a wallet that is used within Tangent Chain transactions</Callout.Text>
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
            <Box mt="4">
              <Card mt="3" variant="surface" className="before-clear" style={{
                  border: '1px solid var(--gray-7)',
                  // @ts-ignore
                  backgroundImage: 'linear-gradient(45deg, var(--gray-2), var(--accent-4) 100%)',
                  borderRadius: '28px'
                }}>
                <Box px="2" py="2">
                  <Flex justify="center" mb="4">
                    <Heading size="4" align="center">{ selectedAddress == -1 ? 'Tangent' : Readability.toAssetName(addresses[selectedAddress].asset) } address QR code</Heading>
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
                    <TextField.Root size="3" variant="soft" readOnly={true} value={ Readability.toAddress(selectedAddress == -1 ? ownerAddress : addresses[selectedAddress].addresses[selectedAddressVersion], 12) } onClick={() => {
                        navigator.clipboard.writeText(selectedAddress == -1 ? ownerAddress : addresses[selectedAddress].addresses[selectedAddressVersion]);
                        AlertBox.open(AlertType.Info, 'Address v' + (selectedAddress == -1 ? selectedAddressVersion + 1 : (addresses[selectedAddress].addresses.length - selectedAddressVersion)) + ' copied!')
                      }}>
                      <TextField.Slot color="gray">
                        <Icon path={mdiKeyOutline} size={0.7} style={{ paddingLeft: '4px' }} />
                      </TextField.Slot>
                    </TextField.Root>
                    <Flex width="100%" mt="3">
                      <Select.Root size="3" value={selectedAddressVersion.toString()} onValueChange={(value) => setSelectedAddressVersion(parseInt(value))}>
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
                                <Select.Item value={index.toString()} key={address}>
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
              </Card>
              <Flex justify="center" mt="4">
                <Select.Root size="3" value={selectedAddress.toString()} onValueChange={(value) => { setSelectedAddress(parseInt(value)); setSelectedAddressVersion(0); }}>
                  <Select.Trigger variant="soft" />
                  <Select.Content variant="soft">
                    <Select.Group>
                      <Select.Label>Witness addresses</Select.Label>
                      <Select.Item value="-1">
                        <Flex align="center" gap="1">
                          <Text style={{ color: 'var(--accent-9)' }}>{ ownerAddress.substring(ownerAddress.length - 2).toUpperCase() }</Text>
                          <Text>TANGENT</Text>
                        </Flex>
                      </Select.Item>
                      {
                        addresses.map((item, index) => {
                          const tag = item.addresses[0].substring(item.addresses[0].length - 2).toUpperCase();
                          return (
                            <Select.Item key={item.hash + '_select'} value={index.toString()}>
                              <Flex align="center" gap="1">
                                <Avatar mr="1" size="1" radius="full" fallback={(item.asset.token || item.asset.chain)[0]} src={'/cryptocurrency/' + (item.asset.token || item.asset.chain).toLowerCase() + '.svg'} style={{ width: '20px', height: '20px' }} />
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
            </Box>
          </Tabs.Content>
          <Tabs.Content value="validator">
            <Card mt="3" variant="surface" className="before-clear" style={{
                border: '1px solid var(--gray-7)',
                // @ts-ignore
                backgroundImage: 'linear-gradient(45deg, var(--accent-3), var(--gray-3) 90%)',
                borderRadius: '28px'
              }}>
              <Box position="absolute" top="14px" right="14px">
                {
                  props.owns &&
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <Button variant="ghost" color={work ? (work.online ? 'jade' : 'red') : 'orange'}>
                        <Badge size="2" color={work ? (work.online ? 'jade' : 'red') : 'orange'}>{ work ? (work.online ? 'VALIDATOR ONLINE' : 'VALIDATOR OFFLINE') : 'NOT A VALIDATOR' }</Badge>
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content side="left">
                      <Tooltip content="Change validator and/or observer status(-es)">
                        <DropdownMenu.Item shortcut="⟳ ₿" color={ work && work.online ? 'red' : undefined } onClick={() => navigate('/interaction?type=commitment')}>{ work && work.online ? 'Disable' : 'Enable' } validator</DropdownMenu.Item>
                      </Tooltip>
                      <DropdownMenu.Separator />
                      <Tooltip content="Configure fee policy for a bridge">
                        <DropdownMenu.Item shortcut="⇌ ₿" onClick={() => navigate('/interaction?type=depository_adjustment')}>Configure bridge</DropdownMenu.Item>
                      </Tooltip>
                      <Tooltip content="Migrate bridge's custodial funds to another bridge for deallocation">
                        <DropdownMenu.Item shortcut="→ ₿" color="red" onClick={() => navigate('/interaction?type=depository_migration')}>Migrate bridge</DropdownMenu.Item>
                      </Tooltip>
                      <DropdownMenu.Separator />
                      <Tooltip content="Contribute to a bridge by locking coverage funds">
                        <DropdownMenu.Item shortcut="↘ ₿" onClick={() => navigate('/interaction?type=contribution_allocation')}>Lock bridge contribution</DropdownMenu.Item>
                      </Tooltip>
                      <Tooltip content="Deallocate bridge and unlock contributed coverage funds">
                        <DropdownMenu.Item shortcut="↖ ₿" color="red" onClick={() => navigate('/interaction?type=contribution_deallocation')}>Unlock bridge contribution</DropdownMenu.Item>
                      </Tooltip>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                }
                {
                  !props.owns && <Badge size="2" color={work ? (work.online ? 'jade' : 'red') : 'orange'}>VALIDATOR { work ? (work.online ? 'ONLINE' : 'OFFLINE') : 'STANDBY' }</Badge>
                }
              </Box>
              <Flex px="2" py="2" gap="3">
                <Icon path={mdiArrowRightBoldHexagonOutline} size={1.5} style={{ color: 'var(--red-10)' }} />
                <Box width="100%">
                  <Flex justify="between" align="center">
                    <Text as="div" size="2" weight="light">Gas</Text>
                  </Flex>
                  <Text as="div" size="2" weight="medium">{ Readability.toGas(work ? work.gas_use : 0) }</Text>
                </Box>
              </Flex>
              {
                work &&
                <>
                  <Flex px="2" py="2" gap="3" align="center">
                    <Icon path={mdiAlertOctagonOutline} size={1.5} style={{ color: 'var(--yellow-11)' }} />
                    <Box width="100%">
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">Reliability</Text>
                      </Flex>
                      <Text as="div" size="2" weight="medium">{ work.flags.findIndex((a: string) => a == 'founder') ? 'Founder' : (work.flags.findIndex((a: string) => a == 'outlaw') ? 'Unreliable' : 'Normal') }</Text>
                    </Box>
                  </Flex>
                  <Flex px="2" py="2" gap="3" align="center">
                    <Icon path={mdiArrowLeftBoldHexagonOutline} size={1.5} style={{ color: 'var(--jade-10)' }} />
                    <Box width="100%">
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">{ work.online ? 'Activity' : 'Downtime' }</Text>
                      </Flex>
                      <Text as="div" size="2" weight="medium">{ work.online ? 'In' : 'From'} block { Math.max(work.block_number.toNumber(), work.penalty.toNumber()) }</Text>
                    </Box>
                  </Flex>
                </>
              }
              {
                observers.length > 0 &&
                <Box px="2" my="2">
                  <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                </Box>
              }
              { 
                observers.map((item) =>
                  <Flex key={item.asset.id} px="2" py="2" gap="3" align="center">
                    <Avatar size="2" radius="full" fallback={(item.asset.token || item.asset.chain)[0]} src={'/cryptocurrency/' + (item.asset.token || item.asset.chain).toLowerCase() + '.svg'} />
                    <Box width="100%" style={{ marginLeft: '2px' }}>
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">{ Readability.toAssetName(item.asset) } observer</Text>
                      </Flex>
                      <Badge size="1" radius="medium" color={item.observing ? 'jade' : 'red'}>{ item.observing ? 'ONLINE' : 'OFFLINE' }</Badge>
                    </Box>
                  </Flex>
                )
              }
            </Card>
          </Tabs.Content>
        </Box>
      </Tabs.Root>
      {
        (transactions.length > 0 || mempoolTransactions.length > 0) &&
        <Box width="100%" my="6">
          <Heading size="6" mb="0">Transactions</Heading>
          {
            mempoolTransactions.length > 0 &&
            <Box width="100%">
              <Box px="2">
                <Text as="div" size="2" mb="1" align="right">Queue</Text>
                <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
              </Box>
              {
                mempoolTransactions.map((item, index) =>
                    <Box px="2" mb="4" key={item.hash + index}>
                      <Transaction ownerAddress={ownerAddress} transaction={item}></Transaction>
                    </Box>
                )
              }
            </Box>
          }
          <InfiniteScroll dataLength={transactions.length} hasMore={moreTransactions} next={findTransactions} loader={<div></div>}>
            {
              transactions.map((item, index) =>
                <Box width="100%" key={item.transaction.hash + index}>
                  {
                    (!index || !item.receipt || new Date(transactions[index - 1].receipt.finalization_time?.toNumber()).setHours(0, 0, 0, 0) != new Date(item.receipt.finalization_time?.toNumber()).setHours(0, 0, 0, 0)) &&
                    <Box px="2">
                      <Text as="div" size="2" mb="1" align="right">{ item.receipt ? (new Date(item.receipt.finalization_time?.toNumber()).setHours(0, 0, 0, 0) == new Date().setHours(0, 0, 0, 0) ? 'Today' : new Date(item.receipt.finalization_time?.toNumber()).toLocaleDateString()) : 'Today' }</Text>
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
});
export default Account;