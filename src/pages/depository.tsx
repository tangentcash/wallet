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
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";

const DEPOSITORY_COUNT = 48;

function toDepositoryIndex(policy: any): [boolean, string] {
  const index = policy.security_level / (Chain.props.PARTICIPATION_COMMITTEE[1] * 0.83);
  const speedOverSecurity = index <= 0.5;
  return [speedOverSecurity, index.toFixed(3) + (speedOverSecurity ? ' prefers speed' : ' prefers security')];
}
function toDepositoryStatus(policy: any): string {
  let status = '';
  if (!policy.accepts_account_requests)
    status += 'Registrations halted, ';
  if (!policy.accepts_withdrawal_requests)
    status += 'Withdrawals halted, ';
  return status.length > 0 ? status.substring(0, status.length - 2) : 'Functional';
}

export default function DepositoryPage() {
  const ownerAddress = Wallet.getAddress() || '';
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [mode, setMode] = useState<'depositories' | 'register' | 'deposit'>('depositories');
  const [preference, setPreference] = useState<'security' | 'cost'>('security');
  const [routingAddress, setRoutingAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<any[]>([]);
  const [asset, setAsset] = useState(-1);
  const [manager, setManager] = useState<string | null>(null);
  const [depositoryAddress, setDepositoryAddress] = useState<any | null>(null);
  const [walletAddresses, setWalletAddresses] = useState<any[]>([]);
  const [cachedAddresses, setCachedAddresses] = useState<any[] | null>(null);
  const [acquiredDepositories, setAcquiredDepositories] = useState<{ [key: string]: any }>({ });
  const [candidateDepositories, setCandidateDepositories] = useState<any[]>([]);
  const [moreDepositories, setMoreDepositories] = useState(true);
  const navigate = useNavigate();
  const findDepositories = useCallback(async (refresh?: boolean) => {
    try {
      if (asset == -1)
        return null;

      let data;
      switch (preference) {
        case 'security':
          data = await Interface.getBestDepositoryBalancesForSelection(new AssetId(assets[asset].id), refresh ? 0 : candidateDepositories.length, DEPOSITORY_COUNT);
          break;
        case 'cost':
          data = await Interface.getBestDepositoryRewardsForSelection(new AssetId(assets[asset].id), refresh ? 0 : candidateDepositories.length, DEPOSITORY_COUNT);
          break;
        default:
          return null;
      }
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setCandidateDepositories([]);
        setMoreDepositories(false);
        return null;
      }

      const result = refresh ? data : data.concat(candidateDepositories);
      setCandidateDepositories(result);
      setMoreDepositories(data.length >= DEPOSITORY_COUNT);
      return result;
    } catch {
      if (refresh)
        setCandidateDepositories([]);
      setMoreDepositories(false);
      return null;
    }
  }, [asset, preference, candidateDepositories]);
  const findDepositoryAddress = useCallback(async (owner: string) => {
    try {
      if (loading)
        return null;

      setLoading(true);
      const data = await Interface.getWitnessAccountsByPurpose(owner, 'depository', 0, 1);
      if (!Array.isArray(data) || !data.length) {
        throw null;
      }

      setDepositoryAddress(data[0]);
      setLoading(false);
      return data[0];
    } catch {
      setDepositoryAddress(null);
      setLoading(false);
      return null;
    }
  }, [loading]);
  const useDepository = useCallback((owner: string | null, type: 'depositories' | 'register' | 'deposit') => {
    setManager(owner);
    setMode(type);
    switch (type) {
      case 'deposit':
        if (owner != null && asset != -1 && assets[asset].routing_policy == 'account')
          findDepositoryAddress(owner);
        else
          setDepositoryAddress(null);
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
            manager: Signing.decodeAddress(manager || '')
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
  }, [assets, asset, manager]);
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

    await findDepositories(true);
    try {
      const addressData = cachedAddresses ? cachedAddresses : await Interface.fetchAll((offset, count) => Interface.getWitnessAccounts(ownerAddress, offset, count));
      if (!cachedAddresses && Array.isArray(addressData)) {
        setCachedAddresses(addressData);
      }
      if (!addressData)
        throw false;

      const depositoryAddresses = addressData.filter((item) => item.asset.id.toString() == assets[asset].id.toString() && item.purpose == 'depository').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
      const mapping: any = { };
      for (let item in depositoryAddresses) {
        let input = depositoryAddresses[item];
        let output = mapping[input.manager];
        if (output != null) {
          output.addresses = [...new Set([...input.addresses, ...output.addresses])];
        } else {
          mapping[input.manager] = input;
        }
      }
      
      const routingAddresses = addressData.filter((item) => item.asset.id.toString() == assets[asset].id.toString() && item.purpose == 'routing').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
      setWalletAddresses(routingAddresses);  
      setAcquiredDepositories(mapping);
    } catch {
      setAcquiredDepositories([]);
      setWalletAddresses([]);
    }
  }, [asset, preference, cachedAddresses]);

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="640px">
      {
        asset == -1 &&
        <Box mt="4">
          <Heading align="center" mb="4" size="8">Blockchain depository</Heading>
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
            mode == 'depositories' &&
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
                <Card mb="4">
                  <Collapsible.Root>
                    <Collapsible.Trigger asChild={true}>
                      <Flex justify="between" align="center" mb="2">
                        <Heading size="4">Deposit addresses</Heading>
                        {
                          Object.keys(acquiredDepositories).length > 0 &&
                          <Button size="1" radius="large" variant="soft" color="yellow">
                            Preview
                            <Box ml="1">
                              <DropdownMenu.TriggerIcon />
                            </Box>
                          </Button>
                        }
                      </Flex>
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                      {
                        Object.keys(acquiredDepositories).map((item: string) => {
                          const depository = acquiredDepositories[item];
                          return (
                            <Box key={depository.hash} mt="4">
                              <DataList.Root orientation={orientation}>
                                <DataList.Item>
                                  <DataList.Label>Depository account:</DataList.Label>
                                  <DataList.Value>
                                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                      navigator.clipboard.writeText(depository.manager);
                                      AlertBox.open(AlertType.Info, 'Address copied!')
                                    }}>{ Readability.toAddress(depository.manager) }</Button>
                                    <Box ml="2">
                                      <Link className="router-link" to={'/account/' + depository.manager}>▒▒</Link>
                                    </Box>
                                  </DataList.Value>
                                </DataList.Item>
                                <DataList.Item>
                                  <DataList.Label>Deposit instruction:</DataList.Label>
                                  <DataList.Value>
                                    {
                                      assets[asset].routing_policy == 'utxo' &&
                                      <Badge color="jade">Deposit from any wallet</Badge>
                                    }
                                    {
                                      assets[asset].routing_policy == 'memo' &&
                                      <Flex gap="2" wrap="wrap">
                                        <Badge color="yellow">Deposit from any wallet with memo</Badge>
                                        <Badge color="red">Memo — { depository.address_index.toString() }</Badge>
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
                                {
                                  depository.addresses.map((address: string, addressIndex: number) =>
                                    <DataList.Item key={address}>
                                      <DataList.Label>Deposit address v{depository.addresses.length - addressIndex}:</DataList.Label>
                                      <DataList.Value>
                                        <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                          navigator.clipboard.writeText(address);
                                          AlertBox.open(AlertType.Info, 'Address copied!')
                                        }}>{ Readability.toAddress(address) }</Button>
                                      </DataList.Value>
                                    </DataList.Item>
                                  )
                                }
                              </DataList.Root>
                              <Box width="100%" mt="4" my="3">
                                <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                              </Box>
                            </Box>
                          )
                        })
                      }
                    </Collapsible.Content>
                  </Collapsible.Root>
                  <Text size="1" weight="light"><Text color="yellow">Register</Text> more {Readability.toAssetName(assets[asset])} addresses through depositories to have more deposit options</Text>
                </Card>
                <Card>
                  <Collapsible.Root>
                    <Collapsible.Trigger asChild={true}>
                      <Flex justify="between" align="center" mb="2">
                        <Heading size="4">Withdrawal addresses</Heading>
                        {
                          walletAddresses.length > 0 &&
                          <Button size="1" radius="large" variant="soft" color="yellow">
                            Preview
                            <Box ml="1">
                              <DropdownMenu.TriggerIcon />
                            </Box>
                          </Button>
                        }
                      </Flex>
                    </Collapsible.Trigger>
                    <Collapsible.Content>
                      <Box mt="4">
                        <DataList.Root orientation={orientation}>
                          {
                            walletAddresses.map((wallet) => {
                              return wallet.addresses.map((walletAddress: string, addressIndex: number) =>
                                <DataList.Item key={walletAddress}>
                                  <DataList.Label>{ assets[asset].routing_policy == 'account' ? 'Sender/withdrawal' : 'Withdrawal' } address v{wallet.addresses.length - addressIndex}:</DataList.Label>
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
                      </Box>
                      {
                        walletAddresses.length > 0 &&
                        <Box width="100%" mt="4" my="3">
                          <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                        </Box>
                      }
                    </Collapsible.Content>
                  </Collapsible.Root>
                  <Text size="1" weight="light"><Text color="yellow">Register</Text> more {Readability.toAssetName(assets[asset])} addresses through depositories to have more {assets[asset].routing_policy == 'account' ? 'deposit/' : ''}withdrawal options</Text>
                </Card>
              </Box>
              <Box width="100%" mb="4">
                <Flex justify="between" align="center" mb="3">
                  <Heading size="6">Depositories</Heading>
                  <Select.Root value={preference} onValueChange={(value) => setPreference(value as ('security' | 'cost'))}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Group>
                        <Select.Label>Depository preference</Select.Label>
                        <Select.Item value="security">Security</Select.Item>
                        <Select.Item value="cost">Cost</Select.Item>
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
              </Box>
              {
                !candidateDepositories.length &&
                <Flex justify="center" mt="4">
                  <Text color="red">❌ No active depositories for {Readability.toAssetName(assets[asset])} blockchain ❌</Text>
                </Flex>
              }
              <InfiniteScroll dataLength={candidateDepositories.length} hasMore={moreDepositories} next={findDepositories} loader={<div></div>}>
                {
                  candidateDepositories.map((item, index) =>
                    <Box width="100%" key={item.policy.hash + index} mb="4">
                      <Card>
                        <Flex justify="between" align="center" mb="4">
                          <Flex align="center" gap="2">
                            <Heading size="4">{ item.founder ? 'Founder depository' : 'Depository' }</Heading>
                            <Badge radius="medium" variant="surface" size="2">{ item.policy.owner.substring(item.policy.owner.length - 6).toUpperCase() }</Badge>
                          </Flex>
                          <Badge size="2" radius="medium" color={item.attestation && item.attestation.active ? 'jade' : 'red'}>{ item.attestation && item.attestation.active ? 'ONLINE' : 'OFFLINE' }</Badge>
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
                              <Badge size="1" radius="medium" color={!item.policy.accepts_account_requests || !item.policy.accepts_withdrawal_requests ? 'red' : 'jade'}>{ toDepositoryStatus(item.policy) }</Badge>
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
                              <Badge size="1" radius="medium" color={toDepositoryIndex(item.policy)[0] ? 'tomato' : 'jade'}>{ toDepositoryIndex(item.policy)[1] }</Badge>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item>
                            <DataList.Label>Deposit cost:</DataList.Label>
                            <DataList.Value>
                              {
                                item.reward && item.reward.incoming_fee.gt(0) &&
                                <Text>{ Readability.toMoney(new AssetId(assets[asset].id), item.reward.incoming_fee) }</Text>
                              }
                              {
                                (!item.reward || item.reward.incoming_fee.lte(0)) &&
                                <Badge size="1" radius="medium" color="jade">Free</Badge>
                              }
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item>
                            <DataList.Label>Withdrawal cost:</DataList.Label>
                            <DataList.Value>
                              {
                                item.reward && item.reward.outgoing_fee.gt(0) &&
                                <Text>{ Readability.toMoney(new AssetId(assets[asset].id), item.reward.outgoing_fee) }</Text>
                              }
                              {
                                (!item.reward || item.reward.outgoing_fee.lte(0)) &&
                                <Badge size="1" radius="medium" color="jade">Free</Badge>
                              }
                            </DataList.Value>
                          </DataList.Item>
                        </DataList.Root>
                        {
                          item.attestation && item.attestation.active &&
                          <Flex justify="end" align="center" mt="4">
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger>
                                  <Button size="2" variant="surface" color="yellow">
                                    Request
                                    <DropdownMenu.TriggerIcon />
                                  </Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content>
                                  <DropdownMenu.Item shortcut="→" onClick={() => useDepository(item.policy.owner, 'register')} disabled={!item.policy.accepts_account_requests}>Registration</DropdownMenu.Item>
                                  <DropdownMenu.Item shortcut="↙" disabled={acquiredDepositories[item.policy.owner] != null || !item.policy.accepts_account_requests} onClick={() => !acquiredDepositories[item.policy.owner] && useDepository(item.policy.owner, 'deposit')}>Deposit</DropdownMenu.Item>
                                  <DropdownMenu.Item shortcut="↗" onClick={() => navigate(`/interaction?asset=${new AssetId(assets[asset].id).toHex()}&type=withdrawal&manager=${item.policy.owner}`)} disabled={!item.policy.accepts_withdrawal_requests}>Withdrawal</DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu.Root>
                          </Flex>
                        }
                      </Card>
                    </Box>
                  )
                }
              </InfiniteScroll>
            </Box>
          }
          {
            mode == 'register' && manager != null &&
            <Box>
              <Box width="100%" mb="4">
                <Flex justify="between" align="center" mb="3">
                  <Flex align="center" gap="2">
                    <Heading size="6">Depository</Heading>
                    <Badge radius="medium" variant="surface" size="2">{ manager.substring(manager.length - 6).toUpperCase() }</Badge>
                  </Flex>
                  <Button variant="surface" color="gray" onClick={() => useDepository(null, 'depositories')}>
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
                      <Text as="div" weight="light" size="4" mb="1">— Delegate work to <Badge radius="medium" variant="surface" size="2">{ manager.substring(manager.length - 6).toUpperCase() }</Badge> node</Text>
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
            mode == 'deposit' && manager != null &&
            <Box>
              <Box width="100%" mb="4">
                <Flex justify="between" align="center" mb="3">
                  <Flex align="center" gap="2">
                    <Heading size="6">Depository</Heading>
                    <Badge radius="medium" variant="surface" size="2">{ manager.substring(manager.length - 6).toUpperCase() }</Badge>
                  </Flex>
                  <Button variant="surface" color="gray" onClick={() => useDepository(null, 'depositories')}>
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
                <Badge radius="medium" variant="surface" size="2" mx="1">{ manager.substring(manager.length - 6).toUpperCase() }</Badge>
                <Text size="2" color="gray">node</Text>
              </Card>
              {
                depositoryAddress != null &&
                <Box mt="4">
                  <Card>
                    <Flex align="center" gap="2" mb="3">
                      <Heading size="4">Depository</Heading>
                      <Badge radius="medium" variant="surface" size="2">{ manager.substring(manager.length - 6).toUpperCase() }</Badge>
                    </Flex>
                    <DataList.Root orientation={orientation}>
                      <DataList.Item>
                        <DataList.Label>Holder account:</DataList.Label>
                        <DataList.Value>
                          <Button size="2" variant="ghost" color="indigo" onClick={() => {
                            navigator.clipboard.writeText(manager);
                            AlertBox.open(AlertType.Info, 'Address copied!')
                          }}>{ Readability.toAddress(manager) }</Button>
                          <Box ml="2">
                            <Link className="router-link" to={'/account/' + manager}>▒▒</Link>
                          </Box>
                        </DataList.Value>
                      </DataList.Item>
                      {
                        depositoryAddress.addresses.map((address: string, addressIndex: number) =>
                          <DataList.Item key={address}>
                            <DataList.Label>Deposit address v{depositoryAddress.addresses.length - addressIndex}:</DataList.Label>
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
                        <DataList.Label>Deposit instruction:</DataList.Label>
                        <DataList.Value>
                          {
                            assets[asset].routing_policy == 'utxo' &&
                            <Badge color="jade">Deposit from any wallet</Badge>
                          }
                          {
                            assets[asset].routing_policy == 'memo' &&
                            <Flex gap="2" wrap="wrap">
                              <Badge color="yellow">Deposit from any wallet with memo</Badge>
                              <Badge color="red">Memo — { depositoryAddress.address_index.toString() }</Badge>
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
                (!depositoryAddress || loading) &&
                <Flex justify="center" mt="4">
                  <Dialog.Root>
                    <Dialog.Trigger>
                      <Button variant="outline" size="3" color="jade" loading={loading} disabled={depositoryAddress != null}>Submit transaction</Button>
                    </Dialog.Trigger>
                    <Dialog.Content maxWidth="450px">
                      <Dialog.Title mb="0">Confirmation</Dialog.Title>
                      <Dialog.Description mb="3" size="2" color="gray">This transaction will be sent to one of the nodes</Dialog.Description>
                      <Box>
                        <Text as="div" weight="light" size="4" mb="1">— Claim { Readability.toAssetName(assets[asset]) } deposit address</Text>
                        <Text as="div" weight="light" size="4" mb="1">— Delegate work to <Badge radius="medium" variant="surface" size="2">{ manager.substring(manager.length - 6).toUpperCase() }</Badge> node</Text>
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