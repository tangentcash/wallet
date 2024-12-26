import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { AspectRatio, Avatar, Badge, Box, Button, Callout, Card, Dialog, Flex, Heading, IconButton, Link, SegmentedControl, Select, Tabs, Text, TextField, Tooltip } from "@radix-ui/themes";
import { Interface, InterfaceUtil, SummaryState } from "../core/wallet";
import { useEffectAsync } from "../core/extensions/react";
import { AlertBox, AlertType } from "../components/alert";
import { mdiContentCopy, mdiFormatListText, mdiInformationOutline, mdiKeyOutline, mdiQrcodeScan } from "@mdi/js";
import { Readability } from "../core/text";
import { AssetId } from "../core/tangent/algorithm";
import InfiniteScroll from 'react-infinite-scroll-component';
import QRCode from "react-qr-code";
import Icon from "@mdi/react";
import Transaction from "../components/transaction";

function toAddressType(type: string): string {
  switch (type) {
    case 'router':
      return 'Self';
    case 'custodian':
      return 'Deposit';
    case 'contribution':
      return 'Coverage';
    case 'witness':
      return 'Dismissed';
    default:
      return 'Unknown';
  }
}

const TRANSACTION_COUNT = 48;
const Account = forwardRef((props: { ownerAddress: string }, ref) => {
  const ownerAddress = props.ownerAddress;
  const [assets, setAssets] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<number>(-1);
  const [selectedAddressVersion, setSelectedAddressVersion] = useState<number>(0);
  const [control, setControl] = useState('assets');
  const [transactions, setTransactions] = useState<{ transaction: any, receipt?: any, state?: SummaryState }[]>([]);
  const [mempoolTransactions, setMempoolTransactions] = useState<any[]>([]);
  const [moreTransactions, setMoreTransactions] = useState(true);
  const addressPurpose = useCallback((address: any) => {
    const ownerType = address.owner == ownerAddress ? ' (this account)' : '';
    const proposerType = address.proposer == ownerAddress ? ' (this account)' : ' (validator)';
    if (address.purpose == 'witness' && address.proposer == address.owner)
      return <>This is a coverage wallet that has been dismissed and disclosed earlier and is used by <Link href="#">{address.owner}</Link>{ ownerType }</>;
    else if (address.purpose == 'router' && address.proposer == null)
      return <>This is a router wallet that can transfer funds to and receive funds from any bridge wallet and is used exclusively by <Link href="#">{address.owner}</Link>{ ownerType }</>;
    else if (address.purpose == 'custodian' && address.proposer != null)
      return <>This is a custodian wallet that can receive funds from or send funds to any router wallet and is used by <Link href="#">{address.proposer}</Link>{ proposerType }</>;
    else if (address.purpose == 'contribution' && address.proposer == address.owner)
      return <>This is a coverage wallet that can receive funds from any wallet and use them as a collateral for custodian wallets which is used by <Link href="#">{address.owner}</Link>{ ownerType }</>;
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
      setTransactions(refresh ? candidateTransactions : candidateTransactions.concat(transactions));
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
      }
    } catch { }
  }, [ownerAddress]);
  useEffectAsync(async () => {
    try {
      let assetData = await Interface.fetchAll((offset, count) => Interface.getAccountBalances(ownerAddress, offset, count));
      if (Array.isArray(assetData)) {
        assetData = assetData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
        setAssets(assetData.filter((item) => item.balance?.gt(0) || item.reserve?.gt(0) || item.supply?.gt(0)));
      }
    } catch { }
    
    try {
      let addressData = await Interface.fetchAll((offset, count) => Interface.getWitnessAddresses(ownerAddress, offset, count));
      if (Array.isArray(addressData)) {
        addressData = addressData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
        setAddresses(addressData);
      }
    } catch { }

    await Promise.all([findMempoolTransactions(), findTransactions(true)]);
  }, [ownerAddress]);
  if (ref != null) {
    useImperativeHandle(ref, () => ({
      updateFinalizedTransactions: () => findTransactions(),
      updateMempoolTransactions: () => findMempoolTransactions()
    }));
  }
  
  return (
    <Box>
      <SegmentedControl.Root value={control} radius="full" size="2" mt="2" onValueChange={(value) => setControl(value)}>
        <SegmentedControl.Item value="assets">Assets</SegmentedControl.Item>
        <SegmentedControl.Item value="addresses">Addresses</SegmentedControl.Item>
      </SegmentedControl.Root>
      <Box px="2" mb="4">
        <Box mt="4" style={{ border: '1px dashed var(--gray-8)' }}></Box>
      </Box>
      <Tabs.Root value={control}>
        <Box width="100%" px="2">
          <Tabs.Content value="assets">
            <Card mt="3" variant="surface" className="before-clear" style={{
                border: '1px solid var(--gray-7)',
                // @ts-ignore
                backgroundImage: 'linear-gradient(45deg, var(--accent-3), var(--gray-3) 90%)',
                borderRadius: '28px'
              }}>
              {
                !assets.length &&
                <Flex justify="between" align="center">
                  <Icon path={mdiFormatListText} size={1} style={{ color: 'var(--gray-11)' }} />
                  <Text size="3" color="gray" ml="2" my="2" as="div" align="right">Zero balance</Text>
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
          <Tabs.Content value="addresses">
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
            <Box maxWidth="480px" mx="auto" mt="6">
              <Card mt="3" variant="surface" className="before-clear" style={{
                  padding: 0,
                  border: '1px solid var(--gray-7)',
                  backgroundImage: 'linear-gradient(45deg, ' + (selectedAddress == -1 ? 'var(--gray-2)' : Readability.toAssetColor(addresses[selectedAddress].asset)) + ', var(--accent-4) 100%)',
                  borderRadius: '28px'
                }}>
                <AspectRatio ratio={2 / 1.125}>
                  <Flex width="100%" height="100%" gap="2" px="4" py="4" direction="column" justify="between">
                    <Flex justify="between" align="center">
                      <Select.Root value={selectedAddress.toString()} onValueChange={(value) => { setSelectedAddress(parseInt(value)); setSelectedAddressVersion(0); }}>
                        <Select.Trigger />
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
                      <Badge size="3" radius="small" color="gray">{
                        selectedAddress == -1 ? ownerAddress.substring(ownerAddress.length - 6) : (addresses[selectedAddress].addresses[0].substring(addresses[selectedAddress].addresses[0].length - 6))
                      }</Badge>
                    </Flex>
                    <Flex justify="center">
                      <Select.Root size="3" value={selectedAddressVersion.toString()} onValueChange={(value) => setSelectedAddressVersion(parseInt(value))}>
                        <Select.Trigger variant="soft" color="gold" placeholder="Address version" />
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
                    <Flex justify="between" align="center" px="4" py="2" style={{ backgroundImage: 'linear-gradient(90deg, var(--gray-5), var(--gray-3))', borderRadius: '36px' }}>
                      <Text as="div" size="2" weight="light" color="gray" style={{ textTransform: 'uppercase' }}>{
                        selectedAddress == -1 ? 'Account' : (addresses[selectedAddress].purpose)
                      }</Text>
                      <Badge radius="medium" size="2" style={{ textTransform: 'uppercase' }}>{
                        selectedAddress == -1 ? 'Native' : (toAddressType(addresses[selectedAddress].purpose) + Readability.toAddressIndex(addresses[selectedAddress].address_index))
                      }</Badge>
                    </Flex>
                  </Flex>
                </AspectRatio>
              </Card>
              <Dialog.Root>
                <Dialog.Trigger>
                  <Flex width="100%" justify="center" pt="6">
                    <Button mx="auto" size="4" variant="ghost" disabled={selectedAddressVersion == -1}>
                      <Icon path={mdiQrcodeScan} size={1} />
                      { selectedAddress == -1 ? 'Tangent' : Readability.toAssetName(addresses[selectedAddress].asset) } address { selectedAddress == -1 ? 'v1' : ('v' + (addresses[selectedAddress].addresses.length - selectedAddressVersion))}</Button>
                  </Flex>
                </Dialog.Trigger>
                <Dialog.Content minWidth="250px" maxWidth="540px">
                  <Dialog.Title align="center" size="7" mb="2">Address v{(selectedAddress == -1 ? selectedAddressVersion + 1 : (addresses[selectedAddress].addresses.length - selectedAddressVersion))}</Dialog.Title>
                  <Flex justify="center" width="100%">
                    <Box width="80%" maxWidth="260px" px="3" py="3" style={{ borderRadius: '24px', backgroundColor: 'white' }}>
                      <AspectRatio ratio={1}>
                        <QRCode value={ selectedAddress == -1 ? ownerAddress : addresses[selectedAddress].addresses[selectedAddressVersion] } style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                      </AspectRatio>
                    </Box>
                  </Flex>
                  <Dialog.Description size="2" mt="4" align="center" color="gray">This is a QR code representation of address</Dialog.Description>
                  <Box width="100%" mt="4">
                    <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                  </Box>
                  <Box width="100%" mt="4">
                    <TextField.Root value={ selectedAddress == -1 ? ownerAddress : addresses[selectedAddress].addresses[selectedAddressVersion] } size="2" radius="medium" readOnly={true}>
                      <TextField.Slot>
                        <Icon path={mdiKeyOutline} size={0.7} />
                      </TextField.Slot>
                      <TextField.Slot>
                        <IconButton size="1" variant="ghost" color="gray" onClick={() => {
                          navigator.clipboard.writeText(selectedAddress == -1 ? ownerAddress : addresses[selectedAddress].addresses[selectedAddressVersion]);
                          AlertBox.open(AlertType.Info, 'Address v' + (selectedAddress == -1 ? selectedAddressVersion + 1 : (addresses[selectedAddress].addresses.length - selectedAddressVersion)) + ' copied!')
                        }}>
                          <Icon path={mdiContentCopy} size={0.7} />
                        </IconButton>
                      </TextField.Slot>
                    </TextField.Root>
                  </Box>
                </Dialog.Content>
              </Dialog.Root>
            </Box>
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