import { mdiBackburger } from "@mdi/js";
import { Avatar, Badge, Box, Button, Card, DataList, DropdownMenu, Flex, Heading, Select, Text } from "@radix-ui/themes";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCallback, useMemo, useState } from "react";
import { useEffectAsync } from "../core/react";
import { AlertBox, AlertType } from "../components/alert";
import { AssetId, Chain, RPC, Readability } from "tangentsdk";
import { AppData } from "../core/app";
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";

const DEPOSITORY_COUNT = 48;

function toBridgeIndex(policy: any): [boolean, string] {
  const index = policy.security_level / (Chain.policy.PARTICIPATION_COMMITTEE[1] * 0.83);
  const speedOverSecurity = index <= 0.5;
  return [speedOverSecurity, index.toFixed(3) + (speedOverSecurity ? ' prefers speed' : ' prefers security')];
}
function toBridgeStatus(policy: any): string {
  let status = '';
  if (!policy.accepts_account_requests)
    status += 'Registrations halted, ';
  if (!policy.accepts_withdrawal_requests)
    status += 'Withdrawals halted, ';
  return status.length > 0 ? status.substring(0, status.length - 2) : 'Functional';
}

export default function BridgePage() {
  const ownerAddress = AppData.getWalletAddress() || '';
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [query] = useSearchParams();
  const [preference, setPreference] = useState<'stake' | 'balance'>('balance');
  const [assets, setAssets] = useState<any[]>([]);
  const [walletAddresses, setWalletAddresses] = useState<any[]>([]);
  const [cachedAddresses, setCachedAddresses] = useState<any[] | null>(null);
  const [acquiredBridges, setAcquiredBridges] = useState<{ [key: string]: any }>({ });
  const [candidateBridges, setCandidateBridges] = useState<any[]>([]);
  const [moreBridges, setMoreBridges] = useState(true);
  const navigate = useNavigate();
  const asset = useMemo(() => {
    const target = new AssetId(query.get('asset') || '');
    return target ? assets.find((v) => v.chain == target.chain) || null : null;
  }, [query, assets]);
  const findBridges = useCallback(async (refresh?: boolean) => {
    try {
      if (!asset)
        return null;

      let data;
      switch (preference) {
        case 'stake':
          data = await RPC.getBestValidatorAttestationsForSelection(new AssetId(asset.id), refresh ? 0 : candidateBridges.length, DEPOSITORY_COUNT);
          break;
        case 'balance':
          data = await RPC.getBestBridgeBalancesForSelection(new AssetId(asset.id), refresh ? 0 : candidateBridges.length, DEPOSITORY_COUNT);
          if (!data || !data.length)
            data = await RPC.getBestValidatorAttestationsForSelection(new AssetId(asset.id), refresh ? 0 : candidateBridges.length, DEPOSITORY_COUNT);
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

      const result = refresh ? data : data.concat(candidateBridges);
      setCandidateBridges(result);
      setMoreBridges(data.length >= DEPOSITORY_COUNT);
      return result;
    } catch {
      if (refresh)
        setCandidateBridges([]);
      setMoreBridges(false);
      return null;
    }
  }, [asset, preference, candidateBridges]);
  const toTargetAsset = useCallback((asset: any) => {
    const target = new AssetId(query.get('asset') || '');
    return target && target.chain == asset.chain ? target : asset;
  }, [query]);
  useEffectAsync(async () => {
    try {
      if (!assets.length) {
        const assetData = await RPC.getBlockchains();
        if (Array.isArray(assetData)) {
          setAssets(assetData.sort((a, b) => new AssetId(a.id).handle.localeCompare(new AssetId(b.id).handle)));
        }
      }
    } catch { }
  }, []);
  useEffectAsync(async () => {
    if (!asset)
      return;

    await findBridges(true);
    try {
      const addressData = cachedAddresses ? cachedAddresses : await RPC.fetchAll((offset, count) => RPC.getWitnessAccounts(ownerAddress, offset, count));
      if (!cachedAddresses && Array.isArray(addressData)) {
        setCachedAddresses(addressData);
      }
      if (!addressData)
        throw false;

      const bridgeAddresses = addressData.filter((item) => item.asset.id.toString() == asset.id.toString() && item.purpose == 'bridge').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
      const mapping: any = { };
      for (let item in bridgeAddresses) {
        let input = bridgeAddresses[item];
        let output = mapping[input.manager];
        if (output != null) {
          output.addresses = [...new Set([...input.addresses, ...output.addresses])];
        } else {
          mapping[input.manager] = input;
        }
      }
      
      const routingAddresses = addressData.filter((item) => item.asset.id.toString() == asset.id.toString() && item.purpose == 'routing').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
      setWalletAddresses(routingAddresses);  
      setAcquiredBridges(mapping);
    } catch {
      setAcquiredBridges([]);
      setWalletAddresses([]);
    }
  }, [asset, preference, cachedAddresses]);

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="640px">
      {
        asset == null &&
        <Box mt="4" maxWidth="480px" mx="auto">
          <Heading align="center" mb="4" size="8">Bridge network</Heading>
          {
            assets.map((item, index) =>
              <Button variant="surface" color="gray" mb="4" radius="large" style={{ display: 'block', color: 'initial', width: '100%', height: 'auto', borderRadius: '20px' }} key={item.chain + index} onClick={() => navigate(`/bridge?asset=${item.id}`)}>
                <Flex px="1" py="3" justify="start" align="center" gap="3">
                  <Avatar size="4" fallback={Readability.toAssetFallback(item)} src={Readability.toAssetImage(item)} />
                  <Box width="100%">
                    <Flex justify="start" align="start" direction="column">
                      <Text size="2" style={{ color: 'var(--gray-12)' }}>{ Readability.toAssetName(item) }</Text>
                      <Flex gap="1">
                        <Badge size="1" color="jade">{ Readability.toAssetSymbol(item) }</Badge>
                        {
                          item.token_policy != 'none' &&
                          <Badge size="1" color="orange">{ item.token_policy[0].toUpperCase() + item.token_policy.substring(1) } tokens</Badge>
                        }
                      </Flex>
                    </Flex>
                  </Box>
                </Flex>
              </Button>
            )
          }
        </Box>
      }
      {
        asset != null &&
        <Box>
          <Box width="100%" mb="6">
            <Box width="100%" mb="4">
              <Flex justify="between" align="center" mb="3">
                <Heading size="6">Registrations</Heading>
                <Button variant="surface" color="gray" onClick={() => navigate('/bridge')}>
                  <Icon path={mdiBackburger} size={0.7} />
                  <Flex align="center" gap="1">
                    <Avatar size="1" radius="full" fallback={Readability.toAssetFallback(asset)} src={Readability.toAssetImage(asset)} style={{ width: '24px', height: '24px' }} />
                    <Text size="2" style={{ color: 'var(--gray-12)' }} weight="light">{Readability.toAssetName(asset)}</Text>
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
                      Object.keys(acquiredBridges).length > 0 &&
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
                    Object.keys(acquiredBridges).map((item: string) => {
                      const bridge = acquiredBridges[item];
                      return (
                        <Box key={bridge.hash} mt="4">
                          <DataList.Root orientation={orientation}>
                            <DataList.Item>
                              <DataList.Label>Bridge account:</DataList.Label>
                              <DataList.Value>
                                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                  navigator.clipboard.writeText(bridge.manager);
                                  AlertBox.open(AlertType.Info, 'Address copied!')
                                }}>{ Readability.toAddress(bridge.manager) }</Button>
                                <Box ml="2">
                                  <Link className="router-link" to={'/account/' + bridge.manager}>▒▒</Link>
                                </Box>
                              </DataList.Value>
                            </DataList.Item>
                            <DataList.Item>
                              <DataList.Label>Deposit instruction:</DataList.Label>
                              <DataList.Value>
                                {
                                  asset.routing_policy == 'utxo' &&
                                  <Badge color="jade">Any sender</Badge>
                                }
                                {
                                  asset.routing_policy == 'memo' && bridge.addresses.map((walletAddress: string, walletAddressIndex: number) =>
                                    <Flex gap="2" wrap="wrap" pb={walletAddressIndex < bridge.addresses.length - 1 ? '2' : '0'} key={walletAddress}>
                                      <Badge color="red">Any sender but include memo — { Readability.toTaggedAddress(walletAddress).tag || '0' }</Badge>
                                    </Flex>
                                  )
                                }
                                {
                                  asset.routing_policy == 'account' && walletAddresses.map((wallet, walletAddressIndex: number) => {
                                    return wallet.addresses.map((walletAddress: string, addressIndex: number) =>
                                      <Flex gap="1" pb={walletAddressIndex < walletAddresses.length - 1 ? '2' : '0'} key={walletAddress}>
                                        <Text size="2">Send from</Text>
                                        <Button size="1" radius="medium" variant="soft" color="yellow" onClick={() => {
                                          navigator.clipboard.writeText(walletAddress);
                                          AlertBox.open(AlertType.Info, 'Address copied!')
                                        }}>{ Readability.toAddress(walletAddress) }</Button>
                                        { addressIndex < wallet.addresses.length - 1 && <Text>OR</Text> }
                                      </Flex>
                                    )
                                  })
                                }
                              </DataList.Value>
                            </DataList.Item>
                            {
                              bridge.addresses.map((address: string, addressIndex: number) =>
                                <DataList.Item key={address}>
                                  <DataList.Label>Deposit address v{bridge.addresses.length - addressIndex}:</DataList.Label>
                                  <DataList.Value>
                                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                      navigator.clipboard.writeText(Readability.toTaggedAddress(address).address);
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
              <Text size="1" weight="light"><Text color="yellow">Deposit</Text> to register your deposit and personal {Readability.toAssetName(asset)} address </Text>
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
                              <DataList.Label>{ asset.routing_policy == 'account' ? 'Sender/withdrawal' : 'Withdrawal' } address v{wallet.addresses.length - addressIndex}:</DataList.Label>
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
              <Text size="1" weight="light"><Text color="yellow">Withdraw</Text> to register your personal {Readability.toAssetName(asset)} address</Text>
            </Card>
          </Box>
          <Box width="100%" mb="4">
            <Flex justify="between" align="center" mb="3">
              <Heading size="6">Bridges</Heading>
              <Select.Root value={preference} onValueChange={(value) => setPreference(value as ('stake' | 'balance'))}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Bridge preference</Select.Label>
                    <Select.Item value="stake">Stake</Select.Item>
                    <Select.Item value="balance">Balance</Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Flex>
            <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
          </Box>
          {
            !candidateBridges.length &&
            <Text color="red">No active bridges for {Readability.toAssetName(asset)} blockchain</Text>
          }
          <InfiniteScroll dataLength={candidateBridges.length} hasMore={moreBridges} next={findBridges} loader={<div></div>}>
            {
              candidateBridges.map((item, index) =>
                <Box width="100%" key={item.attestation.hash + index} mb="4">
                  <Card>
                    <Flex justify="between" align="center" mb="4">
                      <Flex align="center" gap="2">
                        <Heading size="4">{ item.founder ? 'Founder bridge' : 'Bridge' }</Heading>
                        <Badge radius="medium" variant="surface" size="2">{ item.attestation.owner.substring(item.attestation.owner.length - 6).toUpperCase() }</Badge>
                      </Flex>
                      <Badge size="2" radius="medium" color={item.attestation && item.attestation.stake != null ? 'jade' : 'red'}>{ item.attestation && item.attestation.stake != null ? 'ONLINE' : 'OFFLINE' }</Badge>
                    </Flex>
                    <DataList.Root orientation={orientation}>
                      <DataList.Item>
                        <DataList.Label>Bridge account:</DataList.Label>
                        <DataList.Value>
                          <Button size="2" variant="ghost" color="indigo" onClick={() => {
                            navigator.clipboard.writeText(item.attestation.owner);
                            AlertBox.open(AlertType.Info, 'Address copied!')
                          }}>{ Readability.toAddress(item.attestation.owner) }</Button>
                          <Box ml="2">
                            <Link className="router-link" to={'/account/' + item.attestation.owner}>▒▒</Link>
                          </Box>
                        </DataList.Value>
                      </DataList.Item>
                      <DataList.Item>
                        <DataList.Label>Bridge status:</DataList.Label>
                        <DataList.Value>
                          <Badge size="1" radius="medium" color={!item.attestation.accepts_account_requests || !item.attestation.accepts_withdrawal_requests ? 'red' : 'jade'}>{ toBridgeStatus(item.attestation) }</Badge>
                        </DataList.Value>
                      </DataList.Item>
                      <DataList.Item>
                        <DataList.Label>Total locked value:</DataList.Label>
                        <DataList.Value>
                          <Flex wrap="wrap" gap="1">
                            {
                              item.balances && item.balances.map((next: any) =>
                                <Badge key={item.attestation.hash + index + next.asset.id} size="1" radius="medium" color="yellow">{ Readability.toMoney(next.asset, next.supply) }</Badge>)
                            }
                            {
                              !item.balances &&
                              <Badge size="1" radius="medium" color="yellow">{ Readability.toMoney(asset, null) }</Badge>
                            }
                          </Flex>
                        </DataList.Value>
                      </DataList.Item>
                      <DataList.Item>
                        <DataList.Label>Security to speed index:</DataList.Label>
                        <DataList.Value>
                          <Badge size="1" radius="medium" color={toBridgeIndex(item.attestation)[0] ? 'tomato' : 'jade'}>{ toBridgeIndex(item.attestation)[1] }</Badge>
                        </DataList.Value>
                      </DataList.Item>
                      <DataList.Item>
                        <DataList.Label>Deposit cost:</DataList.Label>
                        <DataList.Value>
                          {
                            item.attestation && item.attestation.incoming_fee.gt(0) &&
                            <Text>{ Readability.toMoney(new AssetId(asset.id), item.attestation.incoming_fee) }</Text>
                          }
                          {
                            (!item.attestation || item.attestation.incoming_fee.lte(0)) &&
                            <Badge size="1" radius="medium" color="jade">Free</Badge>
                          }
                        </DataList.Value>
                      </DataList.Item>
                      <DataList.Item>
                        <DataList.Label>Withdrawal cost:</DataList.Label>
                        <DataList.Value>
                          {
                            item.attestation && item.attestation.outgoing_fee.gt(0) &&
                            <Text>{ Readability.toMoney(new AssetId(asset.id), item.attestation.outgoing_fee) }</Text>
                          }
                          {
                            (!item.attestation || item.attestation.outgoing_fee.lte(0)) &&
                            <Badge size="1" radius="medium" color="jade">Free</Badge>
                          }
                        </DataList.Value>
                      </DataList.Item>
                    </DataList.Root>
                    {
                      item.attestation && item.attestation.stake != null &&
                      <Flex justify="end" align="center" mt="4">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger>
                              <Button size="2" variant="surface" color="yellow">
                                Through this bridge
                                <DropdownMenu.TriggerIcon />
                              </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content>
                              <DropdownMenu.Item shortcut="↙" onClick={() => {
                                if (item.attestation.accepts_account_requests)
                                  navigate(`/interaction?asset=${toTargetAsset(asset).id}&type=register&manager=${item.attestation.owner}`)
                              }} disabled={!item.attestation.accepts_account_requests}>Deposit into account</DropdownMenu.Item>
                              <DropdownMenu.Item shortcut="↗" onClick={() => {
                                if (item.attestation.accepts_withdrawal_requests)
                                  navigate(`/interaction?asset=${toTargetAsset(asset).id}&type=withdraw&manager=${item.attestation.owner}`)
                              }} disabled={!item.attestation.accepts_withdrawal_requests}>Withdraw from account</DropdownMenu.Item>
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
    </Box>
  )
}