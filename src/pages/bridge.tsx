import { mdiBackburger } from "@mdi/js";
import { Avatar, Badge, Box, Button, Card, DataList, Dialog, DropdownMenu, Flex, Heading, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { Link, useNavigate } from "react-router";
import { Interface, Wallet } from "../core/wallet";
import { useCallback, useState } from "react";
import { AssetId, Chain, Signing } from "../core/tangent/algorithm";
import { useEffectAsync } from "../core/extensions/react";
import { AlertBox, AlertType } from "../components/alert";
import { Readability } from "../core/text";
import { Transactions } from "../core/tangent/schema";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";

const BRIDGE_COUNT = 48;

function toDepositoryIndex(policy: any): string {
  const index = policy.security_level / (Chain.props.MPC_COMMITTEE[1] * 0.83);
  return index.toFixed(3) + (index > 0.5 ? ' prefers security' : ' prefers speed')
}
function toDepositoryStatus(policy: any): string {
  let status = '';
  if (!policy.accepts_account_requests)
    status += 'Registrations halted, ';
  if (!policy.accepts_withdrawal_requests)
    status += 'Withdrawals halted, ';
  return status.length > 0 ? status.substring(0, status.length - 2) : 'Functional';
}

export default function BridgePage() {
  const ownerAddress = Wallet.getAddress() || '';
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [mode, setMode] = useState<'bridges' | 'register' | 'deposit'>('bridges');
  const [preference, setPreference] = useState<'security' | 'cost'>('security');
  const [routingAddress, setRoutingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [asset, setAsset] = useState(-1);
  const [proposer, setProposer] = useState<string | null>(null);
  const [bridgeAddress, setBridgeAddress] = useState<any | null>(null);
  const [walletAddresses, setWalletAddresses] = useState<any[]>([]);
  const [cachedAddresses, setCachedAddresses] = useState<any[] | null>(null);
  const [acquiredBridges, setAcquiredBridges] = useState<{ [key: string]: any }>({ });
  const [candidateBridges, setCandidateBridges] = useState<any[]>([]);
  const [moreBridges, setMoreBridges] = useState(true);
  const navigate = useNavigate();
  const findBridges = useCallback(async (refresh?: boolean) => {
    try {
      if (asset == -1)
        return null;

      let data;
      switch (preference) {
        case 'security':
          data = await Interface.getBestDepositoryBalancesForSelection(new AssetId(assets[asset].id), refresh ? 0 : candidateBridges.length, BRIDGE_COUNT);
          break;
        case 'cost':
          data = await Interface.getBestDepositoryRewardsForSelection(new AssetId(assets[asset].id), refresh ? 0 : candidateBridges.length, BRIDGE_COUNT);
          break;
        default:
          return null;
      }
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setCandidateBridges([]);
        setMoreBridges(false);
        return null;
      }

      const values = data.map((v) => {
        const honest = v.work && v.work.flags.find((a: string) => a == 'outlaw') != -1;
        const founder = v.work && v.work.flags.findIndex((a: string) => a == 'founder') != -1;
        return {
          ...v,
          threshold: honest && founder ? 0.0 : 1.0,
          founder: founder,
          honest: honest
        }
      });
      const result = refresh ? values : values.concat(candidateBridges);
      setCandidateBridges(result);
      setMoreBridges(data.length >= BRIDGE_COUNT);
      return result;
    } catch {
      if (refresh)
        setCandidateBridges([]);
      setMoreBridges(false);
      return null;
    }
  }, [asset, preference, candidateBridges]);
  const findBridgeAddress = useCallback(async (owner: string) => {
    try {
      if (loading)
        return null;

      setLoading(true);
      const data = await Interface.getWitnessAccountsByPurpose(owner, 'depository', 0, 1);
      if (!Array.isArray(data) || !data.length) {
        throw null;
      }

      setBridgeAddress(data[0]);
      setLoading(false);
      return data[0];
    } catch {
      setBridgeAddress(null);
      setLoading(false);
      return null;
    }
  }, [loading]);
  const useBridge = useCallback((owner: string | null, type: 'bridges' | 'register' | 'deposit') => {
    setProposer(owner);
    setMode(type);
    switch (type) {
      case 'deposit':
        if (owner != null && asset != -1 && assets[asset].routing_policy == 'account')
          findBridgeAddress(owner);
        else
          setBridgeAddress(null);
        break;
      default:
        break;
    }
  }, [asset, assets]);
  const submitRegistrationTransaction = useCallback(async () => {
    if (loading)
      return;

    setLoading(true);
    try {
      const output = await Wallet.buildTransactionWithAutoGasLimit({
        asset: new AssetId(assets[asset].id),
        method: {
          type: new Transactions.RoutingAccount(),
          args: {
            address: routingAddress
          }
        }
      });
      const hash = await Interface.submitTransaction(output.data, true);
      if (hash != null) {
        AlertBox.open(AlertType.Info, 'Transaction ' + hash + ' sent!');
        navigate('/');
      } else {
        AlertBox.open(AlertType.Error, 'Failed to send transaction!');
      }  
      setLoading(false);
      return output;
    } catch (exception) {
      AlertBox.open(AlertType.Error, (exception as Error).message);
      setLoading(false);
      return null;
    }
  }, [assets, asset, routingAddress]);
  const submitDepositTransaction = useCallback(async () => {
    if (loading)
      return;

    setLoading(true);
    try {
      const output = await Wallet.buildTransactionWithAutoGasLimit({
        asset: new AssetId(assets[asset].id),
        method: {
          type: new Transactions.DepositoryAccount(),
          args: {
            proposer: Signing.decodeAddress(proposer || '')
          }
        }
      });
      const hash = await Interface.submitTransaction(output.data, true);
      if (hash != null) {
        AlertBox.open(AlertType.Info, 'Transaction ' + hash + ' sent!');
        navigate('/');
      } else {
        AlertBox.open(AlertType.Error, 'Failed to send transaction!');
      }  
      setLoading(false);
      return output;
    } catch (exception) {
      AlertBox.open(AlertType.Error, (exception as Error).message);
      setLoading(false);
      return null;
    }
  }, [assets, asset, proposer]);
  useEffectAsync(async () => {
    try {
      if (!assets.length) {
        const assetData = await Interface.getBlockchains();
        if (Array.isArray(assetData)) {
          setAssets(assetData.sort((a, b) => new AssetId(a.id).handle.localeCompare(new AssetId(b.id).handle)));
        }
      }
    } catch { }
  }, []);
  useEffectAsync(async () => {
    if (asset == -1)
      return;

    await findBridges(true);
    try {
      const addressData = cachedAddresses ? cachedAddresses : await Interface.fetchAll((offset, count) => Interface.getWitnessAccounts(ownerAddress, offset, count));
      if (!cachedAddresses && Array.isArray(addressData)) {
        setCachedAddresses(addressData);
      }
      if (!addressData)
        throw false;

      const bridges = addressData.filter((item) => item.asset.id.toString() == assets[asset].id.toString() && item.purpose == 'depository').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
      const addresses = addressData.filter((item) => item.asset.id.toString() == assets[asset].id.toString() && item.purpose == 'routing').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
      const mapping: any = { };
      for (let item in bridges) {
        let input = bridges[item];
        let output = mapping[input.proposer];
        if (output != null) {
          output.addresses = [...input.addresses, ...output.addresses];
        } else {
          mapping[input.proposer] = input;
        }
      }
      
      setAcquiredBridges(mapping);
      setWalletAddresses(addresses);  
    } catch {
      setAcquiredBridges([]);
      setWalletAddresses([]);
    }
  }, [asset, preference, cachedAddresses]);

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="640px">
      {
        asset == -1 &&
        <Box mt="4">
          <Heading align="center" mb="4" size="8">Blockchain bridge</Heading>
          <Flex justify="center" maxWidth="380px" mx="auto">
            <Select.Root size="3" value={asset.toString()} onValueChange={(value) => setAsset(parseInt(value))}>
              <Select.Trigger variant="surface" placeholder="Select blockchain" style={{ width: '100%' }}>
              </Select.Trigger>
              <Select.Content variant="soft">
                <Select.Group>
                  <Select.Item value="-1" disabled={true}>Select blockchain</Select.Item>
                  {
                    assets.map((item, index) =>
                      <Select.Item key={item.id + '_select'} value={index.toString()}>
                        <Flex align="center" gap="1">
                          <Avatar mr="1" size="1" radius="full" fallback={(item.token || item.chain)[0]} src={'/cryptocurrency/' + (item.token || item.chain).toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                          <Text size="2" weight="light">{Readability.toAssetName(item)}</Text>
                        </Flex>
                      </Select.Item>
                    )
                  }
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Box>
      }
      {
        asset != -1 &&
        <Box>
          {
            mode == 'bridges' &&
            <Box>
              <Box width="100%" mb="6">
                <Box width="100%" mb="4">
                  <Flex justify="between" align="center" mb="3">
                    <Heading size="6">Registrations</Heading>
                    <Button variant="surface" color="gray" onClick={() => setAsset(-1)}>
                      <Icon path={mdiBackburger} size={0.7} />
                      <Flex align="center" gap="1">
                        <Avatar size="1" radius="full" fallback={(assets[asset].token || assets[asset].chain)[0]} src={'/cryptocurrency/' + (assets[asset].token || assets[asset].chain).toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                        <Text size="2" style={{ color: 'var(--gray-12)' }} weight="light">{Readability.toAssetName(assets[asset])}</Text>
                      </Flex>
                    </Button>
                  </Flex>
                  <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                </Box>
                {
                  <Card>
                    <Heading size="4" mb="2">Withdrawal addresses</Heading>
                    <DataList.Root orientation={orientation}>
                      {
                        walletAddresses.map((wallet, walletIndex: number) => {
                          return wallet.addresses.map((walletAddress: string, addressIndex: number) =>
                            <DataList.Item key={walletAddress}>
                              <DataList.Label>{ assets[asset].routing_policy == 'account' ? 'Sender/withdrawal' : 'Withdrawal' } address v{wallet.addresses.length - addressIndex} of {walletIndex + 1}:</DataList.Label>
                              <DataList.Value>
                                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                  navigator.clipboard.writeText(walletAddress);
                                  AlertBox.open(AlertType.Info, 'Address copied!')
                                }}>{ Readability.toAddress(walletAddress) }</Button>
                              </DataList.Value>
                            </DataList.Item>
                          )
                        })
                      }
                    </DataList.Root>
                    {
                      walletAddresses.length > 0 &&
                      <Box width="100%" mt="4" my="3">
                        <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                      </Box>
                    }
                    <Text size="1" weight="light"><Text color="yellow">Register</Text> more {Readability.toAssetName(assets[asset])} addresses through bridges to have more {assets[asset].routing_policy == 'account' ? 'deposit/' : ''}withdrawal options</Text>
                  </Card>
                }
                {
                  Object.keys(acquiredBridges).map((item: string) => {
                    const bridge = acquiredBridges[item];
                    return (
                      <Box key={bridge.hash} mt="4">
                        <Card>
                          <Flex align="center" gap="2" mb="3">
                            <Heading size="4">Deposit bridge</Heading>
                            <Badge radius="medium" variant="surface" size="2">{ bridge.proposer.substring(bridge.proposer.length - 6).toUpperCase() }</Badge>
                          </Flex>
                          <DataList.Root orientation={orientation}>
                            <DataList.Item>
                              <DataList.Label>Holder account:</DataList.Label>
                              <DataList.Value>
                                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                  navigator.clipboard.writeText(bridge.proposer);
                                  AlertBox.open(AlertType.Info, 'Address copied!')
                                }}>{ Readability.toAddress(bridge.proposer) }</Button>
                                <Box ml="2">
                                  <Link className="router-link" to={'/account/' + bridge.proposer}>▒▒</Link>
                                </Box>
                              </DataList.Value>
                            </DataList.Item>
                            {
                              bridge.addresses.map((address: string, addressIndex: number) =>
                                <DataList.Item key={address}>
                                  <DataList.Label>Deposit address v{bridge.addresses.length - addressIndex}:</DataList.Label>
                                  <DataList.Value>
                                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                      navigator.clipboard.writeText(address);
                                      AlertBox.open(AlertType.Info, 'Address copied!')
                                    }}>{ Readability.toAddress(address) }</Button>
                                  </DataList.Value>
                                </DataList.Item>
                              )
                            }
                            <DataList.Item>
                              <DataList.Label>Deposit method:</DataList.Label>
                              <DataList.Value>
                                {
                                  assets[asset].routing_policy == 'utxo' &&
                                  <Badge color="green">Deposit from any wallet</Badge>
                                }
                                {
                                  assets[asset].routing_policy == 'memo' &&
                                  <Flex gap="2" wrap="wrap">
                                    <Badge color="yellow">Deposit from any wallet with memo</Badge>
                                    <Badge color="red">Memo — { bridge.address_index.toString() }</Badge>
                                  </Flex>
                                }
                                {
                                  assets[asset].routing_policy == 'account' &&
                                  <Box>
                                    {
                                      !walletAddresses.length &&
                                      <Badge color="red">No wallet addresses</Badge>
                                    }
                                    {
                                      walletAddresses.map((wallet, walletAddressIndex: number) => {
                                        return wallet.addresses.map((walletAddress: string, addressIndex: number) =>
                                          <Flex gap="1" pb={walletAddressIndex < walletAddresses.length - 1 ? '2' : '0'} key={walletAddress}>
                                            <Text size="2">Deposit from</Text>
                                            <Button size="1" radius="medium" variant="soft" color="yellow" onClick={() => {
                                              navigator.clipboard.writeText(walletAddress);
                                              AlertBox.open(AlertType.Info, 'Address copied!')
                                            }}>{ Readability.toAddress(walletAddress) }</Button>
                                            { addressIndex < wallet.addresses.length - 1 && <Text>OR</Text> }
                                          </Flex>
                                        )
                                      })
                                    }
                                  </Box>
                                }
                              </DataList.Value>
                            </DataList.Item>
                          </DataList.Root>
                          <Flex justify="end">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger>
                                <Button size="2" variant="surface" color="yellow">
                                  Request
                                  <DropdownMenu.TriggerIcon />
                                </Button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content>
                                <DropdownMenu.Item shortcut="→" onClick={() => useBridge(bridge.proposer, 'register')}>Registration</DropdownMenu.Item>
                                <DropdownMenu.Item shortcut="↙" disabled={true} onClick={() => !acquiredBridges[bridge.proposer] && useBridge(bridge.proposer, 'deposit')}>Deposit</DropdownMenu.Item>
                                <DropdownMenu.Item shortcut="↗" onClick={() => navigate(`/interaction?asset=${new AssetId(assets[asset].id).toHex()}&type=withdrawal&proposer=${bridge.proposer}`)}>Withdrawal</DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Root>
                          </Flex>
                        </Card>
                      </Box>
                    )
                  })
                }
              </Box>
              <Box width="100%" mb="4">
                <Flex justify="between" align="center" mb="3">
                  <Heading size="6">Bridges</Heading>
                  <Select.Root value={preference} onValueChange={(value) => setPreference(value as ('security' | 'cost'))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Group>
                        <Select.Label>Bridge preference</Select.Label>
                        <Select.Item value="security">Security</Select.Item>
                        <Select.Item value="cost">Cost</Select.Item>
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
              </Box>
              {
                !candidateBridges.length &&
                <Flex justify="center" mt="4">
                  <Text color="red">❌ No active bridges for {Readability.toAssetName(assets[asset])} blockchain ❌</Text>
                </Flex>
              }
              <InfiniteScroll dataLength={candidateBridges.length} hasMore={moreBridges} next={findBridges} loader={<div></div>}>
                {
                  candidateBridges.map((item, index) =>
                    <Box width="100%" key={item.policy.hash + index} mb="4">
                      <Card>
                        <Flex justify="between" align="center" mb="4">
                          <Flex align="center" gap="2">
                            <Heading size="4">{ item.founder ? 'Founder bridge' : 'Bridge' }</Heading>
                            <Badge radius="medium" variant="surface" size="2">{ item.policy.owner.substring(item.policy.owner.length - 6).toUpperCase() }</Badge>
                          </Flex>
                          <Badge size="2" radius="medium" color={item.work && item.work.online ? 'jade' : 'red'}>{ item.work && item.work.online ? 'ONLINE' : 'OFFLINE' }</Badge>
                        </Flex>
                        <DataList.Root orientation={orientation}>
                          <DataList.Item>
                            <DataList.Label>Depository account:</DataList.Label>
                            <DataList.Value>
                              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                navigator.clipboard.writeText(item.policy.owner);
                                AlertBox.open(AlertType.Info, 'Address copied!')
                              }}>{ Readability.toAddress(item.policy.owner) }</Button>
                              <Box ml="2">
                                <Link className="router-link" to={'/account/' + item.policy.owner}>▒▒</Link>
                              </Box>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item>
                            <DataList.Label>Depository status:</DataList.Label>
                            <DataList.Value>
                              <Badge size="1" radius="medium" color={!item.policy.accepts_account_requests || !item.policy.accepts_withdrawal_requests ? 'red' : 'green'}>{ toDepositoryStatus(item.policy) }</Badge>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item>
                            <DataList.Label>Total locked value:</DataList.Label>
                            <DataList.Value>
                              <Badge size="1" radius="medium" color="yellow">{ Readability.toMoney(item.policy.asset, item.balance.supply) }</Badge>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item>
                            <DataList.Label>Security to speed index:</DataList.Label>
                            <DataList.Value>
                              <Badge size="1" radius="medium" color="tomato">{ toDepositoryIndex(item.policy) }</Badge>
                            </DataList.Value>
                          </DataList.Item>
                          {
                            item.reward != null && (item.reward.incoming_relative_fee.gt(0) || item.reward.incoming_absolute_fee.gt(0)) &&
                            <DataList.Item>
                              <DataList.Label>Deposit cost:</DataList.Label>
                              <DataList.Value>
                                <Text>{ (100 * item.reward.incoming_relative_fee.toNumber()).toFixed(2) }% + { Readability.toMoney(new AssetId(assets[asset].id), item.reward.incoming_absolute_fee) }</Text>
                              </DataList.Value>
                            </DataList.Item>
                          }
                          {
                            item.reward != null && (item.reward.outgoing_relative_fee.gt(0) || item.reward.outgoing_absolute_fee.gt(0)) &&
                            <DataList.Item>
                              <DataList.Label>Withdrawal cost:</DataList.Label>
                              <DataList.Value>
                                <Text color={item.policy.accepts_withdrawal_requests ? undefined : 'red'}>{ (100 * item.reward.outgoing_relative_fee.toNumber()).toFixed(2) }% + { Readability.toMoney(new AssetId(assets[asset].id), item.reward.outgoing_absolute_fee) }</Text>
                              </DataList.Value>
                            </DataList.Item>
                          }
                        </DataList.Root>
                        <Flex justify="end" align="center" mt="4">
                          {
                            item.honest &&
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger>
                                <Button size="2" variant="surface" color="yellow">
                                  Request
                                  <DropdownMenu.TriggerIcon />
                                </Button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content>
                                <DropdownMenu.Item shortcut="→" onClick={() => useBridge(item.policy.owner, 'register')} disabled={!item.policy.accepts_account_requests}>Registration</DropdownMenu.Item>
                                <DropdownMenu.Item shortcut="↙" disabled={acquiredBridges[item.policy.owner] != null || !item.policy.accepts_account_requests} onClick={() => !acquiredBridges[item.policy.owner] && useBridge(item.policy.owner, 'deposit')}>Deposit</DropdownMenu.Item>
                                <DropdownMenu.Item shortcut="↗" onClick={() => navigate(`/interaction?asset=${new AssetId(assets[asset].id).toHex()}&type=depository_withdrawal&proposer=${item.policy.owner}`)} disabled={!item.policy.accepts_withdrawal_requests}>Withdrawal</DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Root>
                          }
                          {
                            !item.honest &&
                            <Badge size="3" color="red">PERMANENT BAN</Badge>
                          }
                        </Flex>
                      </Card>
                    </Box>
                  )
                }
              </InfiniteScroll>
            </Box>
          }
          {
            mode == 'register' && proposer != null &&
            <Box>
              <Box width="100%" mb="4">
                <Flex justify="between" align="center" mb="3">
                  <Flex align="center" gap="2">
                    <Heading size="6">Bridge</Heading>
                    <Badge radius="medium" variant="surface" size="2">{ proposer.substring(proposer.length - 6).toUpperCase() }</Badge>
                  </Flex>
                  <Button variant="surface" color="gray" onClick={() => useBridge(null, 'bridges')}>
                    <Icon path={mdiBackburger} size={0.7} />
                    <Flex align="center" gap="1">
                      <Avatar size="1" radius="full" fallback={(assets[asset].token || assets[asset].chain)[0]} src={'/cryptocurrency/' + (assets[asset].token || assets[asset].chain).toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                      <Text size="2" style={{ color: 'var(--gray-12)' }} weight="light">{Readability.toAssetName(assets[asset])}</Text>
                    </Flex>
                  </Button>
                </Flex>
                <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
              </Box>
              <Card>
                <Box mb="4">
                  <Heading size="5">Address registration</Heading>
                  <Text size="2" color="gray">Register Your wallet address to {assets[asset].routing_policy == 'account' ? 'deposit or ' : ''}withdraw assets</Text>
                </Box>
                <Box>
                  <Tooltip content="Your wallet's address">
                    <TextField.Root mb="3" size="3" placeholder="Wallet address" value={routingAddress} onChange={(e) => setRoutingAddress(e.target.value)} />
                  </Tooltip>
                </Box>
              </Card>
              <Flex justify="center" mt="4">
                <Dialog.Root>
                  <Dialog.Trigger>
                    <Button variant="outline" size="3" color="jade" loading={loading} disabled={!routingAddress.length}>Submit transaction</Button>
                  </Dialog.Trigger>
                  <Dialog.Content maxWidth="450px">
                    <Dialog.Title mb="0">Confirmation</Dialog.Title>
                    <Dialog.Description mb="3" size="2" color="gray">This transaction will be sent to one of the nodes</Dialog.Description>
                    <Box>
                      <Text as="div" weight="light" size="4" mb="1">— Register <Text color="red">{ Readability.toAddress(routingAddress) }</Text> as a Your { Readability.toAssetName(assets[asset]) } address</Text>
                      <Text as="div" weight="light" size="4" mb="1">— Delegate work to <Badge radius="medium" variant="surface" size="2">{ proposer.substring(proposer.length - 6).toUpperCase() }</Badge> node</Text>
                    </Box>
                    <Flex gap="3" mt="4" justify="between">
                      <Dialog.Close>
                        <Button variant="soft" color="gray">Cancel</Button>
                      </Dialog.Close>
                      <Dialog.Close>
                        <Button color="red" loading={loading} onClick={() => submitRegistrationTransaction()}>Submit</Button>
                      </Dialog.Close>
                    </Flex>
                  </Dialog.Content>
                </Dialog.Root>
              </Flex>
            </Box>
          }
          {
            mode == 'deposit' && proposer != null &&
            <Box>
              <Box width="100%" mb="4">
                <Flex justify="between" align="center" mb="3">
                  <Flex align="center" gap="2">
                    <Heading size="6">Bridge</Heading>
                    <Badge radius="medium" variant="surface" size="2">{ proposer.substring(proposer.length - 6).toUpperCase() }</Badge>
                  </Flex>
                  <Button variant="surface" color="gray" onClick={() => useBridge(null, 'bridges')}>
                    <Icon path={mdiBackburger} size={0.7} />
                    <Flex align="center" gap="1">
                      <Avatar size="1" radius="full" fallback={(assets[asset].token || assets[asset].chain)[0]} src={'/cryptocurrency/' + (assets[asset].token || assets[asset].chain).toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                      <Text size="2" style={{ color: 'var(--gray-12)' }} weight="light">{Readability.toAssetName(assets[asset])}</Text>
                    </Flex>
                  </Button>
                </Flex>
                <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
              </Box>
              <Card>
                <Heading size="5" mb="1">Asset deposit address claim</Heading>
                <Text size="2" color="gray">Create a deposit address for Your assets{assets[asset].routing_policy == 'account' ? ' to be able to fund it from Your registered wallet addresses' : ''} through</Text>
                <Badge radius="medium" variant="surface" size="2" mx="1">{ proposer.substring(proposer.length - 6).toUpperCase() }</Badge>
                <Text size="2" color="gray">node</Text>
              </Card>
              {
                bridgeAddress != null &&
                <Box mt="4">
                  <Card>
                    <Flex align="center" gap="2" mb="3">
                      <Heading size="4">Bridge</Heading>
                      <Badge radius="medium" variant="surface" size="2">{ proposer.substring(proposer.length - 6).toUpperCase() }</Badge>
                    </Flex>
                    <DataList.Root orientation={orientation}>
                      <DataList.Item>
                        <DataList.Label>Holder account:</DataList.Label>
                        <DataList.Value>
                          <Button size="2" variant="ghost" color="indigo" onClick={() => {
                            navigator.clipboard.writeText(proposer);
                            AlertBox.open(AlertType.Info, 'Address copied!')
                          }}>{ Readability.toAddress(proposer) }</Button>
                          <Box ml="2">
                            <Link className="router-link" to={'/account/' + proposer}>▒▒</Link>
                          </Box>
                        </DataList.Value>
                      </DataList.Item>
                      {
                        bridgeAddress.addresses.map((address: string, addressIndex: number) =>
                          <DataList.Item key={address}>
                            <DataList.Label>Deposit address v{bridgeAddress.addresses.length - addressIndex}:</DataList.Label>
                            <DataList.Value>
                              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                navigator.clipboard.writeText(address);
                                AlertBox.open(AlertType.Info, 'Address copied!')
                              }}>{ Readability.toAddress(address) }</Button>
                            </DataList.Value>
                          </DataList.Item>
                        )
                      }
                      <DataList.Item>
                        <DataList.Label>Deposit method:</DataList.Label>
                        <DataList.Value>
                          {
                            assets[asset].routing_policy == 'utxo' &&
                            <Badge color="green">Deposit from any wallet</Badge>
                          }
                          {
                            assets[asset].routing_policy == 'memo' &&
                            <Flex gap="2" wrap="wrap">
                              <Badge color="yellow">Deposit from any wallet with memo</Badge>
                              <Badge color="red">Memo — { bridgeAddress.address_index.toString() }</Badge>
                            </Flex>
                          }
                          {
                            assets[asset].routing_policy == 'account' &&
                            <Box>
                              {
                                !walletAddresses.length &&
                                <Badge color="red">No wallet addresses</Badge>
                              }
                              {
                                walletAddresses.map((wallet, walletAddressIndex: number) => {
                                  return wallet.addresses.map((walletAddress: string, addressIndex: number) =>
                                    <Flex gap="1" pb={walletAddressIndex < walletAddresses.length - 1 ? '2' : '0'} key={walletAddress}>
                                      <Text size="2">Deposit from</Text>
                                      <Button size="1" radius="medium" variant="soft" color="yellow" onClick={() => {
                                        navigator.clipboard.writeText(walletAddress);
                                        AlertBox.open(AlertType.Info, 'Address copied!')
                                      }}>{ Readability.toAddress(walletAddress) }</Button>
                                      { addressIndex < wallet.addresses.length - 1 && <Text>OR</Text> }
                                    </Flex>
                                  )
                                })
                              }
                            </Box>
                          }
                        </DataList.Value>
                      </DataList.Item>
                    </DataList.Root>
                  </Card>
                </Box>
              }
              {
                (!bridgeAddress || loading) &&
                <Flex justify="center" mt="4">
                  <Dialog.Root>
                    <Dialog.Trigger>
                      <Button variant="outline" size="3" color="jade" loading={loading} disabled={bridgeAddress != null}>Submit transaction</Button>
                    </Dialog.Trigger>
                    <Dialog.Content maxWidth="450px">
                      <Dialog.Title mb="0">Confirmation</Dialog.Title>
                      <Dialog.Description mb="3" size="2" color="gray">This transaction will be sent to one of the nodes</Dialog.Description>
                      <Box>
                        <Text as="div" weight="light" size="4" mb="1">— Claim { Readability.toAssetName(assets[asset]) } deposit address</Text>
                        <Text as="div" weight="light" size="4" mb="1">— Delegate work to <Badge radius="medium" variant="surface" size="2">{ proposer.substring(proposer.length - 6).toUpperCase() }</Badge> node</Text>
                      </Box>
                      <Flex gap="3" mt="4" justify="between">
                        <Dialog.Close>
                          <Button variant="soft" color="gray">Cancel</Button>
                        </Dialog.Close>
                        <Dialog.Close>
                          <Button color="red" loading={loading} onClick={() => submitDepositTransaction()}>Submit</Button>
                        </Dialog.Close>
                      </Flex>
                    </Dialog.Content>
                  </Dialog.Root>
                </Flex>
              }
            </Box>
          }
        </Box>
      }
    </Box>
  )
}