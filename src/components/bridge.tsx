import { Badge, Box, Button, Flex, Select, Spinner, Text, TextField } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEffectAsync } from "../core/react";
import { AssetId, RPC, Readability, Whitelist } from "tangentsdk";
import { AppData } from "../core/app";
import { AssetImage, AssetName } from "../components/asset";
import { AddressView } from "../components/address";
import { useNavigate } from "react-router";
import { AlertBox, AlertType } from "../components/alert";
import { mdiSetRight } from "@mdi/js";
import Icon from "@mdi/react";

type ExtendedBlockchainInfo = AssetId & {
  divisibility: BigNumber,
  sync_latency: BigNumber,
  composition_policy: string,
  token_policy: string,
  routing_policy: string,
  ext: { depositTime: number, tokenStandard: string | null }
};

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

export default function Bridge(props: { blockchains: any[], assets: any[] }) {
  const ownerAddress = AppData.getWalletAddress() || '';
  const navigate = useNavigate();
  const [routingAddressValue, setRoutingAddressValue] = useState<string>('');
  const [routingAddressIndex, setRoutingAddressIndex] = useState<number>(-1);
  const [blockchainIndex, setBlockchainIndex] = useState<number>(-1);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [bridges, setBridges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const blockchains = useMemo((): ExtendedBlockchainInfo[] => {
    if (!Array.isArray(props.blockchains))
      return [];

    for (let i = 0; i < props.blockchains.length; i++) {
      const target = props.blockchains[i];
      const ext = ASSET_INFORMATION[target.chain];
      if (ext != null)
          target.ext = ext;
    }
    return props.blockchains.sort((a, b) => new AssetId(a.id).handle.localeCompare(new AssetId(b.id).handle));
  }, [props.blockchains]);
  const blockchain = useMemo((): ExtendedBlockchainInfo | null => {
    return blockchainIndex >= 0 && blockchainIndex < blockchains.length ? blockchains[blockchainIndex] : null;
  }, [blockchainIndex, blockchains]);
  const blockchainAddresses = useMemo((): { routing: any, bridge: any } => {
    const result: { routing: any, bridge: any } = { routing: null, bridge: null };
    if (!blockchain)
      return result;

    const duplicates = new Set<string>();
    const targetedAddresses = addresses.filter((x) => x.asset.chain == blockchain.chain && (x.purpose == 'routing' || x.purpose == 'bridge'));
    for (let i = 0; i < targetedAddresses.length; i++) {
      const target = targetedAddresses[i];
      const listing = result as any;
      if (target.asset.chain == blockchain.chain) {
        target.addresses.forEach((x: any) => duplicates.add(x.tag != null ? x.address + '#' + x.tag : x.address));
        if (listing[target.purpose] != null) {
          listing[target.purpose].addresses = [...listing[target.purpose].addresses, ...target.addresses];
        } else {
          listing[target.purpose] = { ...target };
        }
      }
    }
    if (result.routing) {
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
  }, [blockchain, blockchains, addresses, bridges]);
  const blockchainAddress = useMemo((): string | null => {
    if (blockchainAddresses.routing != null && routingAddressIndex >= 0 && routingAddressIndex < blockchainAddresses.routing.addresses.length)
      return blockchainAddresses.routing.addresses[routingAddressIndex].address

    return routingAddressValue || null;
  }, [routingAddressIndex, routingAddressValue]);
  const blockchainAssets = useMemo((): any[] => props.assets.filter(x => x.asset.chain == blockchain?.chain), [blockchain, props.assets]);
  const claim = useCallback(() => {
    if (!blockchain) {
      AlertBox.open(AlertType.Error, 'Must select a network');
      return;
    }

    const bridge = bridges.sort((a: any, b: any) => {
      const balanceA: BigNumber = a.balances.find((x: any) => x.asset.id == blockchain.id)?.supply || new BigNumber(0);
      const balanceB: BigNumber = b.balances.find((x: any) => x.asset.id == blockchain.id)?.supply || new BigNumber(0);
      return balanceA.comparedTo(balanceB) || 0; 
    })[0];
    if (!bridge) {
      AlertBox.open(AlertType.Error, 'Failed to find a bridge for this claim');
      return;
    }

    navigate(`/interaction?asset=${blockchain.id}&type=register&bridge=${bridge.instance.bridge_hash}&address=${routingAddressValue}&back=/`);
  }, [blockchain, bridges, routingAddressValue]);
  const withdraw = useCallback((assetIndex: number) => {
    const token = blockchainAssets[assetIndex];
    if (!blockchain || !token) {
      AlertBox.open(AlertType.Error, 'Must select a token to withdraw');
      return;
    }

    const feeToken = blockchainAssets.filter((x) => x.asset.id == blockchain.id)[0];
    if (!feeToken) {
      AlertBox.open(AlertType.Error, 'Must have ' + Readability.toAssetName(blockchain) + ' to pay network fees');
      return;
    }

    const bridge = bridges.filter((x: any) => x.withdrawable && feeToken.balance.gte(x.instance.fee_rate)).sort((a: any, b: any) => {
      const balanceA: BigNumber = a.balances.find((x: any) => x.asset.id == token.asset.id)?.supply || new BigNumber(0);
      const balanceB: BigNumber = b.balances.find((x: any) => x.asset.id == token.asset.id)?.supply || new BigNumber(0);
      return balanceB.comparedTo(balanceA) || 0; 
    })[0];
    if (!bridge) {
      AlertBox.open(AlertType.Error, 'Failed to find a bridge to process this withdrawal');
      return;
    }
    
    navigate(`/interaction?asset=${token.asset.id}&type=withdraw&bridge=${bridge.instance.bridge_hash}&address=${blockchainAddress}&fee=${bridge.instance.fee_rate.toString()}&back=/`);
  }, [blockchain, bridges, blockchainAssets, blockchainAddress]);
  useEffectAsync(async () => {
    setLoading(true);
    setRoutingAddressValue('');
    setRoutingAddressIndex(-1);
    try {
      const asset = blockchain;
      if (!asset)
        throw false;

      let [bridgeData, accountData] = await Promise.all([
        RPC.fetchAll((offset, count) => RPC.getBestBridgeInstancesByBalance(new AssetId(asset.id), offset, count)),
        ownerAddress ? RPC.fetchAll((offset, count) => RPC.getWitnessAccounts(ownerAddress, offset, count)) : new Promise<any[]>((resolve) => resolve([]))
      ]);
      if (asset && Array.isArray(bridgeData)) {
        setBridges(bridgeData.map((x) => {
          const balance: BigNumber | null = x.balances.find((v: any) => v.asset.id == asset.id)?.supply || null;
          x.withdrawable = balance ? balance.gte(x.instance.fee_rate) : false;
          x.balances = x.balances.map((y: any) => ({ ...y, whitelist: Whitelist.has(y.asset) })).sort((a: any, b: any) => {
            if ((a.whitelist && !b.whitelist) || (!a.asset.token && b.asset.token)) {
              return -1;
            } else if ((!a.whitelist && b.whitelist) || (a.asset.token && !b.asset.token)) {
              return 1;
            } else {
              const nameA = a.asset.token || a.asset.chain || a.asset.handle;
              const nameB = b.asset.token || b.asset.chain || b.asset.handle;
              const comparison = nameA.localeCompare(nameB);
              return comparison == 0 ? new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle) : comparison;
            }
          });
          return x;
        }));
      } else {
        setBridges([]);
      }

      if (Array.isArray(accountData)) {
        accountData = accountData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle)).map((item) => ({ ...item, addresses: item.addresses.map((address: string) => Readability.toTaggedAddress(address)) }));
        setAddresses(accountData);
      } else {
        setAddresses([]);
      }
    } catch {
      setBridges([]);
      setAddresses([]);
    }
    setLoading(false);
  }, [blockchain]);
  useEffect(() => {
    setRoutingAddressIndex(blockchainAddresses.routing?.addresses.length > 0 ? 0 : -1);
  }, [blockchainAddresses]);

  return (
    <Box>
      <Select.Root size="3" value={blockchainIndex.toString()} onValueChange={(e) => setBlockchainIndex(parseInt(e))}>
        <Select.Trigger style={{ width: '100%' }} />
        <Select.Content>
          <Select.Item value="-1">
            <Flex align="center" gap="2">
              <Icon path={mdiSetRight} size={0.8}></Icon> Deposit & Withdraw
            </Flex>
          </Select.Item>
          {
            blockchains.map((item, index) =>
              <Select.Item value={index.toString()} key={item.id}>
                <Flex gap="2">
                  <AssetImage asset={item} size="1"></AssetImage>
                  <AssetName asset={item} size="3"></AssetName>
                </Flex>
              </Select.Item>
            )
          }
        </Select.Content>
      </Select.Root>
      {
        blockchain != null &&
        <Box>
          <Flex gap="1" mt="2">
            <Select.Root size="3" value={routingAddressIndex.toString()} onValueChange={(e) => setRoutingAddressIndex(parseInt(e))}>
              <Select.Trigger style={routingAddressIndex == -1 ? undefined : { width: '100%' }} />
              <Select.Content>
                {
                  loading &&
                  <Select.Item value="-1">
                    <Flex gap="2" align="center">
                      <Spinner size="2"></Spinner>
                      Loading...
                    </Flex>
                  </Select.Item>
                }
                {
                  !loading &&
                  <Select.Item value="-1">New wallet</Select.Item>
                }
                {
                  blockchainAddresses.routing != null && blockchainAddresses.routing.addresses.map((x: any, index: number) =>
                    <Select.Item value={index.toString()} key={x.address}>
                      <Flex gap="2" align="center">
                        <AssetImage asset={blockchain} size="1"></AssetImage>
                        <Text>{ Readability.toAddress(x.address, 6) }</Text>
                      </Flex>
                    </Select.Item>
                  )
                }
              </Select.Content>
            </Select.Root>
            {
              routingAddressIndex == -1 &&
              <TextField.Root style={{ width: '100%' }} size="3" placeholder="Your address" type="text" readOnly={loading} value={routingAddressValue} onChange={(e) => setRoutingAddressValue(e.target.value)} />
            }
          </Flex>
          <Flex gap="2" mt="2" px="2" wrap="wrap">
            <Badge size="2" color="red">From { blockchain.routing_policy != 'account' ? 'any' : 'this' } address</Badge>
            { blockchain.ext?.tokenStandard ? <Badge size="2" color="jade">Send { Readability.toAssetSymbol(blockchain) }/{ blockchain.ext.tokenStandard }</Badge> : <Badge size="2" color="jade">Send { Readability.toAssetSymbol(blockchain) }</Badge> }
            { blockchain.ext && <Badge size="2" color="yellow">ETA { blockchain.ext.depositTime }-{ blockchain.ext.depositTime + 10 } min.</Badge> }
          </Flex>
          {
            !loading &&
            <>
              {
                blockchainAddresses.bridge && (routingAddressIndex != -1 || blockchain.routing_policy != 'account') &&
                <Box mt="6">
                  <AddressView address={blockchainAddresses.bridge}></AddressView>
                </Box>
              }
              {
                ((routingAddressIndex == -1 && blockchainAddress) || (blockchain.routing_policy != 'account' && !blockchainAddresses.bridge)) &&
                <Flex justify="center" align="center" direction="column" mt="8" mb={blockchainAddress ? '8' : '2'}>
                  <Button size="3" variant="surface" style={{ paddingLeft: '24px', paddingRight: '24px' }} className="shadow-rainbow-animation" onClick={() => claim()}>
                    { blockchainAddress ? <>Claim address <Badge>{ Readability.toAddress(blockchainAddress, 6) }</Badge></> : 'Claim deposit address'}
                  </Button>
                </Flex>
              }
              {
                blockchainAddress &&
                <Box mt="4">
                  <Select.Root size="3" value="-1" onValueChange={(value) => withdraw(parseInt(value))}>
                    <Select.Trigger variant="surface" placeholder="Token to withdraw" style={{ width: '100%' }}>
                    </Select.Trigger>
                    <Select.Content variant="soft">
                      <Select.Group>
                        <Select.Item value="-1" disabled={true}>
                          Withdraw to <Badge>{ Readability.toAddress(blockchainAddress, 6) }</Badge>
                        </Select.Item>
                        {
                          blockchainAssets.map((item, index) =>
                            <Select.Item key={item.asset.id + '_select'} value={index.toString()}>
                              <Flex align="center" gap="2">
                                <AssetImage asset={item.asset} size="1" iconSize="24px"></AssetImage>
                                <Flex gap="2" align="center">
                                  <Text size="4">{ Readability.toMoney(null, item.balance) }</Text>
                                  <AssetName asset={item.asset} size="4" badgeSize={0.8} badgeOffset={-1} symbol={true}></AssetName>
                                </Flex>
                              </Flex>
                            </Select.Item>
                          )
                        }
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </Box>
              }
            </>
          }
        </Box>
      }
    </Box>
  )
}