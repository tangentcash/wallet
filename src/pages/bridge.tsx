import { mdiBackburger, mdiOpenInNew } from "@mdi/js";
import { Badge, Box, Button, Card, DataList, DropdownMenu, Flex, Heading, Text, Tooltip } from "@radix-ui/themes";
import { useNavigate, useSearchParams } from "react-router";
import { useCallback, useMemo, useState } from "react";
import { useEffectAsync } from "../core/react";
import { AlertBox, AlertType } from "../components/alert";
import { AssetId, Chain, RPC, Readability } from "tangentsdk";
import { AppData } from "../core/app";
import { AssetImage, AssetName } from "../components/asset";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import { AddressView } from "../components/address";

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
  const [blockchains, setBlockchains] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [bridges, setBridges] = useState<any[]>([]);
  const [moreBridges, setMoreBridges] = useState(true);
  const navigate = useNavigate();
  const asset = useMemo(() => {
    const target = new AssetId(query.get('asset') || '');
    return target ? blockchains.find((v) => v.chain == target.chain) || null : null;
  }, [query, blockchains]);
  const filteredAddresses = useMemo((): { routing: any, bridge: any } => {
    const result: { routing: any, bridge: any } = { routing: null, bridge: null };
    if (!asset)
      return result;

    const duplicates = new Set<string>();
    const targetedAddresses = addresses.filter((x) => x.asset.chain == asset.chain && (x.purpose == 'routing' || x.purpose == 'bridge'));
    for (let i = 0; i < targetedAddresses.length; i++) {
      const target = targetedAddresses[i];
      const listing = result as any;
      if (target.asset.chain == asset.chain) {
        target.addresses.forEach((x: any) => duplicates.add(x.tag != null ? x.address + '#' + x.tag : x.address));
        if (listing[target.purpose] != null) {
          listing[target.purpose].addresses = [...listing[target.purpose].addresses, ...target.addresses];
        } else {
          listing[target.purpose] = { ...target };
        }
      }
    }
    if (result.routing) {
      const blockchain = blockchains.find((x) => x.chain == asset.chain);
      if (blockchain != null && blockchain.routing_policy == 'account') {
        for (let i = 0; i < bridges.length; i++) {
          const bridge = bridges[i];
          if (!bridge.master || !Array.isArray(bridge.master.addresses))
            continue;

          const filteredMapping = bridge.master.addresses.filter((x: string) => !duplicates.has(x));
          filteredMapping.forEach((x: string) => duplicates.add(x));

          const mapping = filteredMapping.map((x: string) => Readability.toTaggedAddress(x));
          if (result.bridge != null) {
            result.bridge.addresses = [...result.bridge.addresses, ...mapping];
          } else {
            result.bridge = { ...result.routing, purpose: 'bridge', addresses: mapping };
          }
        }
      }
    }
    if (result.bridge && result.bridge.addresses.length > 1) {
      for (let i = result.bridge.addresses.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result.bridge.addresses[i], result.bridge.addresses[j]] = [result.bridge.addresses[j], result.bridge.addresses[i]];
      }
    }
    return result;
  }, [asset, blockchains, addresses, bridges]);
  const senderAddresses = useMemo((): string[] => {
    return filteredAddresses.routing ? filteredAddresses.routing.addresses.map((x: any) => x.address) : [];
  }, [filteredAddresses]);
  const findBridges = useCallback(async (refresh?: boolean) => {
    try {
      if (!asset)
        return null;

      let data = await RPC.getBestBridgeInstancesByBalance(new AssetId(asset.id), refresh ? 0 : bridges.length, BRIDGE_COUNT);
      if (!Array.isArray(data) || !data.length) {
        data = await RPC.getBestBridgeInstancesBySecurity(new AssetId(asset.id), refresh ? 0 : bridges.length, BRIDGE_COUNT);
      }

      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setBridges([]);
        setMoreBridges(false);
        return null;
      }

      const result = refresh ? data : data.concat(bridges);
      setBridges(result.map((x) => {
        const balance: BigNumber | null = x.balances.find((v: any) => v.asset.id == asset.id)?.supply || null;
        x.withdrawable = balance ? balance.gte(x.instance.fee_rate) : false;
        return x;
      }));
      setMoreBridges(data.length >= BRIDGE_COUNT);
      return result;
    } catch {
      if (refresh)
        setBridges([]);
      setMoreBridges(false);
      return null;
    }
  }, [asset, bridges]);
  const toTargetAsset = useCallback((asset: any) => {
    const target = new AssetId(query.get('asset') || '');
    return target && target.chain == asset.chain ? target : asset;
  }, [query]);
  useEffectAsync(async () => {
    if (!asset)
      return;

    try {
      let [addressData] = await Promise.all([RPC.fetchAll((offset, count) => RPC.getWitnessAccounts(ownerAddress, offset, count)), findBridges(true)]);
      if (Array.isArray(addressData)) {
        addressData = addressData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle)).map((item) => ({ ...item, addresses: item.addresses.map((address: string) => Readability.toTaggedAddress(address)) }));
        setAddresses(addressData);
      } else {
        setAddresses([]);
      }
    } catch {
      setAddresses([]);
    }
  }, [asset]);
  useEffectAsync(async () => {
    try {
      if (!blockchains.length) {
        const blockchainData = await RPC.getBlockchains();
        if (Array.isArray(blockchainData)) {
          for (let i = 0; i < blockchainData.length; i++) {
            const target = blockchainData[i];
            const info = ASSET_INFORMATION[target.chain];
            if (info != null)
                target.info = info;
          }
          setBlockchains(blockchainData.sort((a, b) => new AssetId(a.id).handle.localeCompare(new AssetId(b.id).handle)));
        }
      }
    } catch { }
  }, []);

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="640px">
      {
        asset == null &&
        <Box mt="4" maxWidth="480px" mx="auto">
          <Heading align="center" mb="4" size="8">Bridge network</Heading>
          {
            blockchains.map((item, index) =>
              <Button variant="surface" color="gray" mb="4" radius="large" style={{ display: 'block', color: 'initial', width: '100%', height: 'auto', borderRadius: '20px' }} key={item.chain + index} onClick={() => navigate(`/bridge?asset=${item.id}`)}>
                <Flex px="1" py="3" justify="start" align="center" gap="3">
                  <AssetImage asset={item} size="4"></AssetImage>
                  <Box width="100%">
                    <Flex justify="start" align="start" direction="column">
                      <AssetName asset={item} size="2" style={{ color: 'var(--gray-12)' }}></AssetName>
                      <Flex gap="1">
                        <Badge size="1" color="lime">{ Readability.toAssetSymbol(item) }</Badge>
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
          <Box width="100%" mb="4">
            <Flex justify="between" align="center" mb="3">
              <Heading size="6">Bridges</Heading>
              <Button variant="surface" color="gray" onClick={() => navigate('/bridge')}>
                <Icon path={mdiBackburger} size={0.7} />
                <Flex align="center" gap="1">
                  <AssetImage asset={asset} size="1" iconSize="24px"></AssetImage>
                  <AssetName asset={asset} size="2"></AssetName>
                </Flex>
              </Button>
            </Flex>
            <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
          </Box>
          {
            filteredAddresses.bridge != null &&
            <Card mb="4" variant="surface" style={{ borderRadius: '28px' }}>
              <AddressView address={filteredAddresses.bridge}></AddressView>
              <Flex px="4" mt="2" gap="2" align="center" wrap="wrap">
                <Text size="3" color="red">Deposit from</Text>
                {
                  asset.routing_policy == 'utxo' &&
                  <Badge color="lime" size="3">any address</Badge>
                }
                {
                  asset.routing_policy == 'memo' &&
                  <>
                    <Badge color="yellow" size="3">any address</Badge>
                    <Badge color="red" size="3">use { filteredAddresses.bridge.addresses[0].tag || '0' } as dest. tag / memo</Badge>
                  </>
                }
                {
                  asset.routing_policy == 'account' && senderAddresses.map((address: string, index: number) =>
                    <>
                      <Button size="2" variant="soft" color="yellow" onClick={() => {
                        navigator.clipboard.writeText(address);
                        AlertBox.open(AlertType.Info, 'Address copied!')
                      }}>{ Readability.toAddress(address) }</Button>
                      { index < senderAddresses.length - 1 && <Text color="red">or</Text> }
                    </>
                  )
                }
              </Flex>
            </Card>
          }
          {
            !bridges.length &&
            <Flex justify="center" mt="5">
              <Text color="red">{Readability.toAssetName(asset)} blockchain has no bridges</Text>
            </Flex>
          }
          <InfiniteScroll dataLength={bridges.length} hasMore={moreBridges} next={findBridges} loader={<div></div>}>
            {
              bridges.map((item, index) =>
                <Box width="100%" key={item.instance.hash + index} mb="4">
                  <Card variant="surface" style={{ borderRadius: '28px' }}>
                    <Box px="2" py="2">
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
                              <DropdownMenu.Item shortcut="↙" onClick={() => navigate(`/interaction?asset=${toTargetAsset(asset).id}&type=register&bridge=${item.instance.bridge_hash}&back=${encodeURIComponent(location.pathname + location.search)}`)}>Claim an address</DropdownMenu.Item>
                              <Tooltip content={(item.withdrawable ? 'Enough ' : 'Not enough ') + Readability.toAssetSymbol(asset) + ' for a withdrawal'}>
                                <DropdownMenu.Item shortcut="↗" disabled={!item.withdrawable} onClick={() => {
                                  if (item.withdrawable) {
                                    navigate(`/interaction?asset=${toTargetAsset(asset).id}&type=withdraw&bridge=${item.instance.bridge_hash}&fee=${item.instance.fee_rate.toString()}&back=${encodeURIComponent(location.pathname + location.search)}`);
                                  }
                                }}>Queue a withdrawal</DropdownMenu.Item>
                              </Tooltip>
                            </DropdownMenu.Content>
                          </DropdownMenu.Root>
                      </Flex>
                      <DataList.Root orientation={orientation}>
                        {
                          item.master != null && item.master.addresses && filteredAddresses.routing != null &&
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
                        <Tooltip content="Amount of accounts linked to this bridge">
                          <DataList.Item>
                            <DataList.Label>Bridge accounts:</DataList.Label>
                            {
                              (asset.routing_policy == 'account') &&
                              <DataList.Value>
                                <Badge size="1" color="orange">Master account only</Badge>
                              </DataList.Value>
                            }
                            {
                              (asset.routing_policy != 'account') &&
                              <DataList.Value>
                                <Badge size="1" color="blue">{ Readability.toCount('account', item.instance.account_nonce) }</Badge>
                              </DataList.Value>
                            }
                          </DataList.Item>
                        </Tooltip>
                        <Tooltip content="Amount of transactions made from this bridge">
                          <DataList.Item>
                            <DataList.Label>Bridge transactions:</DataList.Label>
                            <DataList.Value>
                              <Badge size="1" color="blue">{ Readability.toCount('transaction', item.instance.transaction_nonce) }</Badge>
                            </DataList.Value>
                          </DataList.Item>
                        </Tooltip>
                        <Tooltip content="Unspent balance of a bridge usable as withdrawal liquidity">
                          <DataList.Item>
                            <DataList.Label>Total value locked:</DataList.Label>
                            <DataList.Value>
                              <Flex wrap="wrap" gap="1">
                                {
                                  item.balances && item.balances.map((next: any) =>
                                    <Badge key={item.instance.hash + index + next.asset.id} size="1" color="lime">{ Readability.toMoney(next.asset, next.supply) }</Badge>)
                                }
                                {
                                  (!item.balances || !item.balances.length) &&
                                  <Badge size="1" color="yellow">{ Readability.toMoney(asset, null) }</Badge>
                                }
                              </Flex>
                            </DataList.Value>
                          </DataList.Item>
                        </Tooltip>
                        <Tooltip content={'Defines how many randomly chosen participants to involve in each created account but no less than ' + Chain.policy.PARTICIPATION_COMMITTEE[0] + ' and no more than ' + Chain.policy.PARTICIPATION_COMMITTEE[1] + ' per account'}>
                          <DataList.Item>
                            <DataList.Label>Participation size:</DataList.Label>
                            <DataList.Value>
                              <Badge size="1" color={speedOverSecurity(item.instance) ? 'red' : 'lime'}>{ Readability.toCount('participant', item.instance.security_level) }</Badge>
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
                    </Box>
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