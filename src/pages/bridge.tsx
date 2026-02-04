import { mdiBackburger, mdiOpenInNew } from "@mdi/js";
import { Avatar, Badge, Box, Button, Card, DataList, DropdownMenu, Flex, Heading, Select, Text, Tooltip } from "@radix-ui/themes";
import { useNavigate, useSearchParams } from "react-router";
import { useCallback, useMemo, useState } from "react";
import { useEffectAsync } from "../core/react";
import { AlertBox, AlertType } from "../components/alert";
import { AssetId, Chain, RPC, Readability } from "tangentsdk";
import { AppData } from "../core/app";
import * as Collapsible from "@radix-ui/react-collapsible";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";

const BRIDGE_COUNT = 48;
const ASSET_INFORMATION: Record<string, { depositTime: number, tokenStandard: string | null }> = {
  "ADA": {
    depositTime: 22,
    tokenStandard: 'Native'
  },
  "ARB": {
    depositTime: 1,
    tokenStandard: 'ERC20'
  },
  "AVAX": {
    depositTime: 3,
    tokenStandard: 'ERC20'
  },
  "BASE": {
    depositTime: 1,
    tokenStandard: 'ERC20'
  },
  "BCH": {
    depositTime: 60,
    tokenStandard: null
  },
  "BLAST": {
    depositTime: 3,
    tokenStandard: 'ERC20'
  },
  "BNB": {
    depositTime: 1,
    tokenStandard: 'BEP20'
  },
  "BSV": {
    depositTime: 12,
    tokenStandard: null
  },
  "BTC": {
    depositTime: 60,
    tokenStandard: null
  },
  "BTG": {
    depositTime: 60,
    tokenStandard: null
  },
  "CELO": {
    depositTime: 2,
    tokenStandard: 'ERC20'
  },
  "DASH": {
    depositTime: 15,
    tokenStandard: null
  },
  "DGB": {
    depositTime: 2,
    tokenStandard: null
  },
  "DOGE": {
    depositTime: 6,
    tokenStandard: null
  },
  "ETC": {
    depositTime: 14,
    tokenStandard: 'ERC20'
  },
  "ETH": {
    depositTime: 14,
    tokenStandard: 'ERC20'
  },
  "GNO": {
    depositTime: 6,
    tokenStandard: 'ERC20'
  },
  "LTC": {
    depositTime: 15,
    tokenStandard: null
  },
  "LINEA": {
    depositTime: 3,
    tokenStandard: 'ERC20'
  },
  "MATIC": {
    depositTime: 3,
    tokenStandard: 'ERC20'
  },
  "OP": {
    depositTime: 3,
    tokenStandard: 'ERC20'
  },
  "S": {
    depositTime: 1,
    tokenStandard: 'ERC20'
  },
  "SOL": {
    depositTime: 1,
    tokenStandard: 'SPL'
  },
  "TRX": {
    depositTime: 2,
    tokenStandard: 'TRC20'
  },
  "XEC": {
    depositTime: 60,
    tokenStandard: null
  },
  "XLM": {
    depositTime: 1,
    tokenStandard: null
  },
  "XMR": {
    depositTime: 30,
    tokenStandard: null
  },
  "XRP": {
    depositTime: 1,
    tokenStandard: null
  },
  "ZEC": {
    depositTime: 20,
    tokenStandard: null
  },
  "ZK": {
    depositTime: 3,
    tokenStandard: 'ERC20'
  },
}

function speedOverSecurity(policy: any): boolean {
  return policy.security_level / (Chain.policy.PARTICIPATION_COMMITTEE[1] * 0.83) <= 0.5;
}

export default function BridgePage() {
  const ownerAddress = AppData.getWalletAddress() || '';
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [query] = useSearchParams();
  const [preference, setPreference] = useState<'security' | 'balance'>('balance');
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
        case 'security':
          data = await RPC.getBestBridgeInstancesBySecurity(new AssetId(asset.id), refresh ? 0 : candidateBridges.length, BRIDGE_COUNT);
          break;
        case 'balance':
          data = await RPC.getBestBridgeInstancesByBalance(new AssetId(asset.id), refresh ? 0 : candidateBridges.length, BRIDGE_COUNT);
          if (!data || !data.length)
            data = await RPC.getBestBridgeInstancesBySecurity(new AssetId(asset.id), refresh ? 0 : candidateBridges.length, BRIDGE_COUNT);
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
      setMoreBridges(data.length >= BRIDGE_COUNT);
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
          for (let i = 0; i < assetData.length; i++) {
            const target = assetData[i];
            const info = ASSET_INFORMATION[target.chain];
            if (info != null)
                target.info = info;
          }
          setAssets(assetData.sort((a, b) => new AssetId(a.id).handle.localeCompare(new AssetId(b.id).handle)));
        }
      }
    } catch { }
  }, []);
  useEffectAsync(async () => {
    if (!asset)
      return;

    const possibleBridges = await findBridges(true);
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
        let output = mapping[input.bridge_hash];
        if (output != null) {
          output.addresses = [...new Set([...input.addresses, ...output.addresses])];
        } else {
          mapping[input.bridge_hash] = input;
        }
      }

      const routingAddresses = addressData.filter((item) => item.asset.id.toString() == asset.id.toString() && item.purpose == 'routing').sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
      if (possibleBridges != null && routingAddresses.length > 0) {
        for (let i = 0; i < possibleBridges.length; i++) {
          const possibleBridge = possibleBridges[i];
          if (possibleBridge && possibleBridge.master && possibleBridge.master.addresses.length > 0 && !mapping[possibleBridge.instance.bridge_hash]) {
            mapping[possibleBridge.instance.bridge_hash] = possibleBridge.master;
          }
        }
      }
      
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
                          item.info != null &&
                          <>
                            <Badge size="1" color="gold">ETA { item.info.depositTime }-{ item.info.depositTime + 10 } min.</Badge>
                            {
                              item.info.tokenStandard != null &&
                              <Badge size="1" color="orange">{ item.info.tokenStandard } tokens</Badge>
                            }
                          </>
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
                      <Button size="1" radius="large" variant="soft" color="jade" className="shadow-rainbow-animation">
                        Bindings
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
                              <DataList.Label>Bridge hash:</DataList.Label>
                              <DataList.Value>
                                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                  navigator.clipboard.writeText(bridge.bridge_hash);
                                  AlertBox.open(AlertType.Info, 'Bridge hash copied!')
                                }}>{ Readability.toHash(bridge.bridge_hash) }</Button>
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
                                      <Badge color="red">Any sender with destination tag (memo): { Readability.toTaggedAddress(walletAddress).tag || '0' }</Badge>
                                    </Flex>
                                  )
                                }
                                {
                                  asset.routing_policy == 'account' && walletAddresses.map((wallet, walletAddressIndex: number) => {
                                    return wallet.addresses.map((walletAddress: string, addressIndex: number) =>
                                      <Flex gap="1" pb={walletAddressIndex < walletAddresses.length - 1 ? '2' : '0'} key={walletAddress}>
                                        <Text size="2">Send from</Text>
                                        <Button size="1" variant="soft" color="yellow" onClick={() => {
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
              <Select.Root value={preference} onValueChange={(value) => setPreference(value as ('security' | 'balance'))}>
                <Select.Trigger />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Bridge preference</Select.Label>
                    <Select.Item value="security">Security</Select.Item>
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
                <Box width="100%" key={item.instance.hash + index} mb="4">
                  <Card>
                    <Flex justify="between" align="center" mb="3">
                      <Flex align="center" gap="2">
                        <Heading size="5">Bridge</Heading>
                        <Badge variant="surface" size="3">{ Readability.toHash(item.instance.bridge_hash, 4) }</Badge>
                      </Flex>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger>
                            <Button size="2" variant="soft" color="yellow">Engage <Icon path={mdiOpenInNew} size={0.6}></Icon></Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content side="left">
                            <DropdownMenu.Item shortcut="↙" onClick={() => navigate(`/interaction?asset=${toTargetAsset(asset).id}&type=register&bridge=${item.instance.bridge_hash}&back=${encodeURIComponent(location.pathname + location.search)}`)}>Deposit into account</DropdownMenu.Item>
                            <DropdownMenu.Item shortcut="↗" onClick={() => navigate(`/interaction?asset=${toTargetAsset(asset).id}&type=withdraw&bridge=${item.instance.bridge_hash}&back=${encodeURIComponent(location.pathname + location.search)}`)}>Withdraw from account</DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                    </Flex>
                    <DataList.Root orientation={orientation}>
                      {
                        item.master != null && item.master.addresses && walletAddresses.length > 0 &&
                        <DataList.Item>
                          <DataList.Label>Deposit address:</DataList.Label>
                          <DataList.Value>
                            <Tooltip content="This is a deposit address shared by all users (master deposit address), send only from addresses you explicitly registered">
                              <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                navigator.clipboard.writeText(item.master.addresses[0]);
                                AlertBox.open(AlertType.Info, 'Address copied!')
                              }}>{ Readability.toAddress(item.master.addresses[0]) }</Button>
                            </Tooltip>
                          </DataList.Value>
                        </DataList.Item>
                      }
                      <DataList.Item>
                        <DataList.Label>Bridge ref hash:</DataList.Label>
                        <DataList.Value>
                          <Button size="2" variant="ghost" color="indigo" onClick={() => {
                            navigator.clipboard.writeText(item.instance.bridge_hash);
                            AlertBox.open(AlertType.Info, 'Bridge hash copied!')
                          }}>{ Readability.toAddress(item.instance.bridge_hash) }</Button>
                        </DataList.Value>
                      </DataList.Item>
                      <Tooltip content="Unspent balance of a bridge usable as withdrawal liquidity">
                        <DataList.Item>
                          <DataList.Label>Total value locked:</DataList.Label>
                          <DataList.Value>
                            <Flex wrap="wrap" gap="1">
                              {
                                item.balances && item.balances.map((next: any) =>
                                  <Badge key={item.instance.hash + index + next.asset.id} size="1" color="yellow">{ Readability.toMoney(next.asset, next.supply) }</Badge>)
                              }
                              {
                                (!item.balances || !item.balances.length) &&
                                <Badge size="1" color="yellow">{ Readability.toMoney(asset, null) }</Badge>
                              }
                            </Flex>
                          </DataList.Value>
                        </DataList.Item>
                      </Tooltip>
                      <Tooltip content={'Defines how many randomly chosen participants to involve in each created account but no more than ' + Chain.policy.PARTICIPATION_COMMITTEE[1] + ' per account'}>
                        <DataList.Item>
                          <DataList.Label>Participation size:</DataList.Label>
                          <DataList.Value>
                            <Badge size="1" color={speedOverSecurity(item.instance) ? 'red' : 'jade'}>{ Readability.toCount('participant', item.instance.security_level) }</Badge>
                          </DataList.Value>
                        </DataList.Item>
                      </Tooltip>
                      <Tooltip content="This amount of fee will be deduced from each withdrawal to cover off-chain network fees and to pay to bridge attesters and participants">
                        <DataList.Item>
                          <DataList.Label>Transactional cost:</DataList.Label>
                          <DataList.Value>{ Readability.toMoney(new AssetId(asset.id), item.instance.fee_rate) }</DataList.Value>
                        </DataList.Item>
                      </Tooltip>
                    </DataList.Root>
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