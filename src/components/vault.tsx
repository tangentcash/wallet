import { Box, Button, DropdownMenu, Flex, Select, Separator, Text } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEffectAsync } from "../core/react";
import { AssetId, RPC, Readability, Whitelist } from "tangentsdk";
import { AppData, ASSET_INFORMATION, ExtendedField } from "../core/app";
import { AssetImage, AssetName } from "../components/asset";
import { AddressView } from "../components/address";
import { Link, useNavigate } from "react-router";
import { AlertBox, AlertType } from "../components/alert";
import { mdiArrowBottomLeft, mdiArrowTopRight, mdiSafeSquare, mdiSetRight } from "@mdi/js";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";

type ExtendedBlockchainInfo = AssetId & {
  divisibility: BigNumber,
  sync_latency: BigNumber,
  composition_policy: string,
  token_policy: string,
  routing_policy: string,
  ext: ExtendedField
};

export default function Vault(props: { blockchains: any[], assets: any[], blockchain?: AssetId }) {
  const ownerAddress = AppData.getWalletAddress() || '';
  const mobile = document.body.clientWidth < 500;
  const navigate = useNavigate();
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
    const routingAddress = blockchainAddresses.routing != null && routingAddressIndex >= 0 && routingAddressIndex < blockchainAddresses.routing.addresses.length;
    return routingAddress ? blockchainAddresses.routing.addresses[routingAddressIndex].address : null;
  }, [routingAddressIndex, blockchainAddresses]);
  const blockchainAssets = useMemo((): any[] => {
    const results = props.assets.filter(x => x.asset.chain == blockchain?.chain);
    return !blockchain || results.length > 0 ? results : [{
      asset: blockchain,
      balance: new BigNumber(0),
      reserve: new BigNumber(0),
      supply: new BigNumber(0)
    }];
  }, [blockchain, props.assets]);
  const requiresSenderAddress = useMemo(() => blockchain && blockchain.routing_policy == 'account', [blockchain]);
  const hasReceiveButton = useMemo(() => requiresSenderAddress ? true : (blockchain && !blockchainAddresses.bridge), [requiresSenderAddress, blockchain, blockchainAddresses]);
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
      AlertBox.open(AlertType.Error, 'Failed to find a vault for this claim');
      return;
    }

    navigate(`/interaction?asset=${blockchain.id}&type=register&vault=${bridge.instance.bridge_hash}&back=/`);
  }, [blockchain, bridges]);
  const send = useCallback((assetIndex: number) => {
    const token = blockchainAssets[assetIndex];
    if (!blockchain || !token) {
      AlertBox.open(AlertType.Error, 'Must select a token to send');
      return;
    }

    const feeToken = blockchainAssets.filter((x) => x.asset.chain == blockchain.chain)[0];
    const sortedBridges = bridges.sort((a: any, b: any) => {
      const balanceA: BigNumber = a.balances.find((x: any) => x.asset.id == token.asset.id)?.supply || new BigNumber(0);
      const balanceB: BigNumber = b.balances.find((x: any) => x.asset.id == token.asset.id)?.supply || new BigNumber(0);
      return balanceB.comparedTo(balanceA) || 0; 
    });
    const bridge = sortedBridges.filter((x: any) => feeToken && feeToken.balance.gt(0) ? feeToken.balance.gte(x.instance.fee_rate) : false)[0] || sortedBridges[0];
    if (!bridge) {
      AlertBox.open(AlertType.Error, 'Failed to find a vault to send from');
      return;
    }
    
    navigate(`/interaction?asset=${token.asset.id}&type=withdraw&vault=${bridge.instance.bridge_hash}&address=${blockchainAddress || ''}&fee=${bridge.instance.fee_rate.toString()}&back=/`);
  }, [blockchain, bridges, blockchainAssets, blockchainAddress]);
  useEffectAsync(async () => {
    setLoading(true);
    setRoutingAddressIndex(-1);
    try {
      const asset = blockchain;
      if (!asset)
        throw false;

      let [bridgeData, accountData] = await Promise.all([
        RPC.fetchAll((offset, count) => RPC.getBestBridgeInstancesByBalance(new AssetId(asset.id), offset, count)),
        ownerAddress ? RPC.fetchAll((offset, count) => RPC.getWitnessAccounts(ownerAddress, offset, count)) : new Promise<any[]>((resolve) => resolve([]))
      ]);
      if (!Array.isArray(bridgeData) || !bridgeData.length) {
        bridgeData = await RPC.fetchAll((offset, count) => RPC.getBestBridgeInstancesBySecurity(new AssetId(asset.id), offset, count));
      }
      if (asset && Array.isArray(bridgeData)) {
        setBridges(bridgeData.map((x) => {
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
    if (props.blockchain != null)
      setBlockchainIndex(props.blockchains.sort((a, b) => new AssetId(a.id).handle.localeCompare(new AssetId(b.id).handle)).findIndex((x) => x.id == props.blockchain?.id))
  }, [props.blockchains, props.blockchain]);
  useEffect(() => {
    setRoutingAddressIndex(blockchainAddresses.routing?.addresses.length > 0 ? 0 : -1);
  }, [blockchainAddresses]);

  return (
    <Box px={mobile ? '2' : undefined}>
      <Select.Root size="3" value={blockchainIndex.toString()} onValueChange={(e) => setBlockchainIndex(parseInt(e))}>
        <Select.Trigger style={{ width: '100%', flexShrink: 'initial' }} />
        <Select.Content color="gray">
          <Select.Item value="-1">
            <Flex align="center" gap="2">
              <Icon path={mdiSetRight} size={0.8}></Icon> Cross-chain transfer
            </Flex>
          </Select.Item>
          <Select.Group>
            <Select.Label>
              <Text size="3">Network / token standard</Text>
            </Select.Label>
            {
              blockchains.map((item, index) =>
                <Select.Item value={index.toString()} key={item.id}>
                  <Flex gap="2">
                    <AssetImage asset={item} size="1"></AssetImage>
                    <AssetName asset={item} size="3" text={item.ext?.tokenStandard ? '/ ' + item.ext.tokenStandard : undefined} badge={false}></AssetName>
                  </Flex>
                </Select.Item>
              )
            }
          </Select.Group>
        </Select.Content>
      </Select.Root>
      {
        blockchain != null && !loading &&
        <Box>
          {
            blockchainAddresses.bridge && (routingAddressIndex != -1 || blockchain.routing_policy != 'account') &&
            <Box mt="6">
              <AddressView address={blockchainAddresses.bridge}></AddressView>
            </Box>
          }
          <Flex mt="2" gap="2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button variant="surface" size="3" color="gray" className="rt-r-gap-2" style={{ flex: 'auto', width: hasReceiveButton ? '50%' : '100%', color: 'var(--gray-12)', backgroundColor: 'var(--gray-2)' }}>
                  <Icon path={mdiArrowTopRight} size={0.8}></Icon> Send
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content color="gray">
                {
                  blockchainAssets.map((item, index) =>
                    <DropdownMenu.Item key={item.asset.id + '_select'} onClick={() => send(index)}>
                      <Flex align="center" gap="2">
                        <AssetImage asset={item.asset} size="1" iconSize="24px"></AssetImage>
                        <Text size="4">Send</Text>
                        <Flex gap="2" align="center">
                          <Text size="4">{ Readability.toMoney(null, item.balance) }</Text>
                          <AssetName asset={item.asset} size="4" badgeSize={0.8} badgeOffset={2} symbol={true} tokenOnly={true}></AssetName>
                        </Flex>
                      </Flex>
                    </DropdownMenu.Item>
                  )
                }
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => navigate('/explorer?view=vaults&asset=' + AssetId.fromHandle(blockchain.chain || '').toHex())}>
                  <Icon path={mdiSafeSquare} size={1}></Icon>
                  <Text size="4">Vault list</Text>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            {
              hasReceiveButton && (!requiresSenderAddress || !blockchainAddresses.routing) &&
              <Button size="3" variant="surface" className="rt-r-gap-2" style={{ width: '50%', paddingLeft: '24px', paddingRight: '24px' }} onClick={() => claim()}>
                <Icon path={mdiArrowBottomLeft} size={0.8}></Icon> Receive
              </Button>
            }
            {
              hasReceiveButton && requiresSenderAddress && blockchainAddresses.routing &&
              <Select.Root size="3" value={routingAddressIndex.toString()} onValueChange={(e) => {
                const index = parseInt(e);
                if (index == -2) {
                  claim();
                } else {
                  setRoutingAddressIndex(index);
                }
              }}>
                <Select.Trigger className="rt-r-gap-2 select-plain" style={{ width: '50%', paddingLeft: '24px', paddingRight: '24px', justifyContent: 'center' }} />
                <Select.Content color="gray">
                  <Select.Item value="-1">
                    <Flex align="center" justify="center" gap="2" width="100%"><Icon path={mdiArrowBottomLeft} size={0.8}></Icon> Receive</Flex>
                  </Select.Item>
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
                  <Box px="3">
                    <Separator my="3" size="4" />
                  </Box>
                  <Select.Item value="-2">
                    <Flex align="center" justify="center" gap="2" width="100%">New sender address</Flex>
                  </Select.Item>
                </Select.Content>
              </Select.Root>
            }
          </Flex>
        </Box>
      }
      {
        blockchain?.ext &&
        <Flex justify="center" mt="4" px="2">
          <Text align="center" size="1">
            <Text>Confirmation in <Text style={{ color: 'var(--accent-11)' }}>{blockchain.ext.transactionTime}-{blockchain.ext.transactionTime + 5} min</Text>, never send to CEXes</Text>
            { blockchain.ext.blocking && ', very slow outgoing queue' }
            { blockchain.routing_policy == 'memo' && <Text>, <Text color="red">requires memo to receive</Text></Text> }
            {
              requiresSenderAddress && blockchainAddress &&
              <Text>, <Text color="red">receives only from</Text> <Link to="#" onClick={() => {
                navigator.clipboard.writeText(blockchainAddress);
                AlertBox.open(AlertType.Info, 'Your address copied!')
              }}>{Readability.toAddress(blockchainAddress, 6)}</Link></Text>
            }
          </Text>
        </Flex>
      }
    </Box>
  )
}