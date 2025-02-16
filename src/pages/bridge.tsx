import { mdiBackburger, mdiInformationOutline } from "@mdi/js";
import { Avatar, Badge, Box, Button, Card, DataList, Dialog, DropdownMenu, Flex, Heading, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { Link, useNavigate } from "react-router";
import { Interface, Wallet } from "../core/wallet";
import { useCallback, useMemo, useState } from "react";
import { AssetId, Signing, Uint256 } from "../core/tangent/algorithm";
import { useEffectAsync } from "../core/extensions/react";
import { AlertBox, AlertType } from "../components/alert";
import { Readability } from "../core/text";
import { SchemaUtil, Stream } from "../core/tangent/serialization";
import { Messages, Transactions } from "../core/tangent/schema";
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import BigNumber from "bignumber.js";

const BRIDGE_COUNT = 48;

export default function BridgePage() {
  const ownerAddress = Wallet.getAddress() || '';
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [mode, setMode] = useState<'bridges' | 'register' | 'deposit'>('bridges');
  const [preference, setPreference] = useState<'security' | 'cost'>('security');
  const [registrationType, setRegistrationType] = useState<'address' | 'pubkey'>('address');
  const [registrationTarget, setRegistrationTarget] = useState('');
  const [registrationSignature, setRegistrationSignature] = useState('');
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
  const registrationMessage = useMemo((): string => {
    if (asset == -1 || registrationType != 'pubkey' || !registrationTarget.length)
      return '';

    const stream = new Stream();
    SchemaUtil.store(stream, {
      asset: new AssetId(assets[asset].id),
      gasPrice: new BigNumber(NaN),
      gasLimit: new Uint256(0),
      sequence: 0,
      conservative: false,
      pubkey: registrationTarget.trim(),
      sighash: ''
    }, Messages.asSigningSchema(new Transactions.PubkeyAccount()));
    return stream.encode();
  }, [registrationType, registrationTarget]);
  const findBridges = useCallback(async (refresh?: boolean) => {
    try {
      if (asset == -1)
        return null;

      let data;
      switch (preference) {
        case 'security':
          data = await Interface.getBestAccountDepositoriesForSelection(new AssetId(assets[asset].id), refresh ? 0 : candidateBridges.length, BRIDGE_COUNT);
          break;
        case 'cost':
          data = await Interface.getBestAccountRewardsForSelection(new AssetId(assets[asset].id), refresh ? 0 : candidateBridges.length, BRIDGE_COUNT);
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
      const data = await Interface.getWitnessAddressesByPurpose(owner, 'custodian', 0, 1);
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
        method: registrationType == 'pubkey' ? {
          type: new Transactions.PubkeyAccount(),
          args: {
            pubkey: registrationTarget,
            sighash: registrationSignature
          }
        } : {
          type: new Transactions.AddressAccount(),
          args: {
            address: registrationTarget
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
  }, [assets, asset, registrationType, registrationTarget, registrationSignature]);
  const submitDepositTransaction = useCallback(async () => {
    if (loading)
      return;

    setLoading(true);
    try {
      const output = await Wallet.buildTransactionWithAutoGasLimit({
        asset: new AssetId(assets[asset].id),
        method: {
          type: new Transactions.DelegationAccount(),
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
      const addressData = cachedAddresses ? cachedAddresses : await Interface.fetchAll((offset, count) => Interface.getWitnessAddresses(ownerAddress, offset, count));
      if (!cachedAddresses && Array.isArray(addressData)) {
        setCachedAddresses(addressData);
      }
      if (!addressData)
        throw false;

      const bridges = addressData.filter((item) => item.asset.id.toString() == assets[asset].id.toString() && item.purpose == 'custodian').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
      const addresses = addressData.filter((item) => item.asset.id.toString() == assets[asset].id.toString() && item.purpose == 'router').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
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
                    <Box width="100%" key={item.depository.hash + index} mb="4">
                      <Card>
                        <Flex justify="between" align="center" mb="4">
                          <Flex align="center" gap="2">
                            <Heading size="4">{ item.founder ? 'Founder bridge' : 'Bridge' }</Heading>
                            <Badge radius="medium" variant="surface" size="2">{ item.depository.owner.substring(item.depository.owner.length - 6).toUpperCase() }</Badge>
                          </Flex>
                          <Badge size="2" radius="medium" color={item.work && item.work.online ? 'jade' : 'red'}>{ item.work && item.work.online ? 'ONLINE' : 'OFFLINE' }</Badge>
                        </Flex>
                        <DataList.Root orientation={orientation}>
                          <DataList.Item align="center">
                            <DataList.Label>Deposit capacity:</DataList.Label>
                            <DataList.Value>
                              <Badge radius="small" size="2" color={item.depository.coverage.gt(0) ? 'green' : 'red'}>MAX — { Readability.toMoney(new AssetId(assets[asset].id), item.depository.coverage) }</Badge>
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
                        </DataList.Root>
                        <Box width="100%" my="4">
                          <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                        </Box>
                        <DataList.Root orientation={orientation}>
                          <DataList.Item align="center">
                            <DataList.Label>Withdrawal capacity:</DataList.Label>
                            <DataList.Value>
                              <Badge radius="small" size="2" color={item.depository.custody.gt(0) ? 'green' : 'red'}>MAX — { Readability.toMoney(new AssetId(assets[asset].id), item.depository.custody) }</Badge>
                            </DataList.Value>
                          </DataList.Item>
                          {
                            item.reward != null && (item.reward.outgoing_relative_fee.gt(0) || item.reward.outgoing_absolute_fee.gt(0)) &&
                            <DataList.Item>
                              <DataList.Label>Withdrawal cost:</DataList.Label>
                              <DataList.Value>
                                <Text>{ (100 * item.reward.outgoing_relative_fee.toNumber()).toFixed(2) }% + { Readability.toMoney(new AssetId(assets[asset].id), item.reward.outgoing_absolute_fee) }</Text>
                              </DataList.Value>
                            </DataList.Item>
                          }
                        </DataList.Root>
                        <Collapsible.Root>
                          <Flex justify="between" align="center" mt="4">
                            <Collapsible.Trigger asChild={true}>
                              <Button size="2" variant="surface" color="blue">
                                <Flex align="center" gap="1">
                                  <Icon path={mdiInformationOutline} size={0.8} />
                                  <Text>Security</Text>
                                </Flex>
                              </Button>
                            </Collapsible.Trigger>
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
                                  <DropdownMenu.Item shortcut="→" onClick={() => useBridge(item.depository.owner, 'register')}>Registration</DropdownMenu.Item>
                                  <DropdownMenu.Item shortcut="↙" disabled={acquiredBridges[item.depository.owner] != null} onClick={() => !acquiredBridges[item.depository.owner] && useBridge(item.depository.owner, 'deposit')}>Deposit</DropdownMenu.Item>
                                  <DropdownMenu.Item shortcut="↗" onClick={() => navigate(`/interaction?asset=${new AssetId(assets[asset].id).toHex()}&type=withdrawal&proposer=${item.depository.owner}`)}>Withdrawal</DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu.Root>
                            }
                            {
                              !item.honest &&
                              <Badge size="3" color="red">PERMANENT BAN</Badge>
                            }
                          </Flex>
                          <Collapsible.Content>
                            <Box width="100%" my="4">
                              <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                            </Box>
                            <Card mb="1">
                              <DataList.Root orientation={orientation}>
                                <DataList.Item>
                                  <DataList.Label>Holder account:</DataList.Label>
                                  <DataList.Value>
                                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                      navigator.clipboard.writeText(item.depository.owner);
                                      AlertBox.open(AlertType.Info, 'Address copied!')
                                    }}>{ Readability.toAddress(item.depository.owner) }</Button>
                                    <Box ml="2">
                                      <Link className="router-link" to={'/account/' + item.depository.owner}>▒▒</Link>
                                    </Box>
                                  </DataList.Value>
                                </DataList.Item>
                                <DataList.Item>
                                  <DataList.Label>Custodial balance:</DataList.Label>
                                  <DataList.Value>
                                    <Flex gap="2">
                                      <Text>{ Readability.toMoney(new AssetId(assets[asset].id), item.depository.custody) }</Text>
                                      <Badge size="1" radius="medium" color={ item.depository.contribution.lte(0) || !item.depository.custody.dividedBy(item.depository.contribution).lt(item.threshold) ? 'red' : 'green' }>FULLNESS: { ((item.depository.contribution.gt(0) ? item.depository.custody.multipliedBy(item.threshold).dividedBy(item.depository.contribution).toNumber() : 0) * 100).toFixed(2) }%</Badge>
                                    </Flex>
                                  </DataList.Value>
                                </DataList.Item>
                                <DataList.Item>
                                  <DataList.Label>Locked balance:</DataList.Label>
                                  <DataList.Value>
                                    <Flex gap="2">
                                      { Readability.toMoney(new AssetId(assets[asset].id), item.depository.contribution) }
                                      <Badge size="1" radius="medium" color={ item.depository.custody.lte(0) || item.depository.contribution.dividedBy(item.depository.custody).gte(item.threshold) ? 'green' : 'red' }>COVERAGE: { ((item.depository.custody.gt(0) ? item.depository.contribution.dividedBy(item.depository.custody).toNumber() : 1) * 100).toFixed(2) }%</Badge>
                                    </Flex>
                                  </DataList.Value>
                                </DataList.Item>
                                <DataList.Item>
                                  <DataList.Label>Balance at risk:</DataList.Label>
                                  <DataList.Value>
                                    { Readability.toMoney(new AssetId(assets[asset].id), item.depository.reservation.plus(BigNumber.max(BigNumber.min(item.depository.custody.multipliedBy(item.threshold).minus(item.depository.contribution), item.depository.custody), 0))) }
                                  </DataList.Value>
                                </DataList.Item>
                                <DataList.Item>
                                  <DataList.Label>Coverage threshold:</DataList.Label>
                                  <DataList.Value>
                                  { ((item.depository.custody.gt(0) ? item.depository.contribution.dividedBy(item.depository.custody).toNumber() : 1) * 100).toFixed(2) }% ≥ { (item.threshold * 100).toFixed(2) }%
                                  </DataList.Value>
                                </DataList.Item>
                              </DataList.Root>
                            </Card>
                          </Collapsible.Content>
                        </Collapsible.Root>
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
                  <Flex mb="1" justify="between" align="center">
                    <Heading size="5">{ registrationType == 'address' ? 'Address' : 'Pubkey' } registration</Heading>
                    <Select.Root value={registrationType} onValueChange={(value) => setRegistrationType(value as ('address' | 'pubkey'))}>
                      <Select.Trigger />
                      <Select.Content>
                        <Select.Group>
                          <Select.Label>Registration type</Select.Label>
                          <Select.Item value="address">Address</Select.Item>
                          <Select.Item value="pubkey">Pubkey</Select.Item>
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </Flex>
                  <Text size="2" color="gray">Register Your wallet address to {assets[asset].routing_policy == 'account' ? 'deposit or ' : ''}withdraw assets</Text>
                </Box>
                {
                  registrationType == 'address' &&
                  <Box>
                    <Tooltip content="Your wallet's address">
                      <TextField.Root mb="3" size="3" placeholder="Wallet address" value={registrationTarget} onChange={(e) => setRegistrationTarget(e.target.value)} />
                    </Tooltip>
                  </Box>
                }
                {
                  registrationType == 'pubkey' &&
                  <Box>
                    <Tooltip content="Your wallet's public key">
                      <TextField.Root mb="3" size="3" placeholder="Public key of wallet address" value={registrationTarget} onChange={(e) => setRegistrationTarget(e.target.value)} />
                    </Tooltip>
                    <Tooltip content="Message that should be signed with a private key">
                      <TextField.Root mb="3" size="3" placeholder="Message to sign" readOnly={true} value={registrationMessage} onClick={() => {
                        navigator.clipboard.writeText(registrationMessage);
                        AlertBox.open(AlertType.Info, 'Message copied!')
                      }}/>
                    </Tooltip>
                    <Tooltip content="Signature of a message signed with Your wallet's private key">
                      <TextField.Root mb="3" size="3" placeholder="Message signature" value={registrationSignature} onChange={(e) => setRegistrationSignature(e.target.value)} />
                    </Tooltip>
                  </Box>
                }
                <Flex justify="end" py="1" px="2">
                  <Text align="right" size="1" color={registrationType == 'pubkey' ? 'green' : 'orange'}>{ registrationType == 'pubkey' ? 'One or more addresses derived from pubkey will be permanently linked to this account' : 'Address may be re-taken by another account using pubkey registration' }</Text>
                </Flex>
              </Card>
              <Flex justify="center" mt="4">
                <Dialog.Root>
                  <Dialog.Trigger>
                    <Button variant="outline" size="3" color="jade" loading={loading} disabled={!registrationTarget.length || (registrationType == 'pubkey' ? !registrationSignature.length : false)}>Submit transaction</Button>
                  </Dialog.Trigger>
                  <Dialog.Content maxWidth="450px">
                    <Dialog.Title mb="0">Confirmation</Dialog.Title>
                    <Dialog.Description mb="3" size="2" color="gray">This transaction will be sent to one of the nodes</Dialog.Description>
                    <Box>
                      <Text as="div" weight="light" size="4" mb="1">— Register <Text color="red">{ Readability.toAddress(registrationTarget) }</Text> as a Your { Readability.toAssetName(assets[asset]) } { registrationType }</Text>
                      <Text as="div" weight="light" size="4" mb="1">— { registrationType == 'pubkey' ? 'Permanently linked to this account' : 'Pubkey registration overrides ownership' }</Text>
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