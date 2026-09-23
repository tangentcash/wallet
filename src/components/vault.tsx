import { Badge, Box, Button, Dialog, Flex, IconButton, SegmentedControl, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEffectAsync } from "../core/react";
import { AssetId, ByteUtil, Hashing, Signing } from "tangentsdk/algorithm";
import { RPC } from "tangentsdk/rpc";
import { UiUtil } from "tangentsdk/ui";
import { Whitelist } from "tangentsdk/whitelist";
import { AppData, ASSET_INFORMATION, ExtendedField } from "../core/app";
import { AssetImage } from "../components/asset-image";
import { AssetName } from "../components/asset-name";
import { AddressView, toTextAddress } from "../components/address";
import { Link, useNavigate } from "react-router";
import { AlertBox, AlertType } from "../components/alert";
import { mdiAlertCircleOutline, mdiClose, mdiInformationOutline, mdiPlus } from "@mdi/js";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";
import { WcAsset, WcContext } from "./wc/types";
import { BigStorage } from "../core/storage";
import { TextUtil } from "tangentsdk/text";

type ExtendedBlockchainInfo = AssetId & {
  divisibility: BigNumber,
  sync_latency: BigNumber,
  composition_policy: string,
  token_policy: string,
  routing_policy: string,
  ext: ExtendedField
};

type WcSession = {
  session: {
    address: string,
    tokens: { contractAddress: string, symbol: string }[]
  } | null;
  modal: boolean;
  lazy: boolean;
  custom: boolean;
  symbol: string | null;
  token: string | null;
  amount: string;
};

const WcAdapter = lazy(() => import('./wc/adapter'));

export default function Vault(props: { blockchains: any[], assets: any[], blockchain?: AssetId }) {
  const ownerAddress = AppData.getWalletAddress() || '';
  const navigate = useNavigate();
  const [blockchainIndex, setBlockchainIndex] = useState<number>(-1);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [bridges, setBridges] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'in' | 'out'>('in');
  const [wc, setWc] = useState<WcSession | null>(null);
  const wcContext = useRef<WcContext>(null);
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
        target.addresses.forEach((x: any) => duplicates.add(toTextAddress(x, blockchain.routing_policy)));
        if (listing[target.purpose] != null) {
          listing[target.purpose].addresses = [...listing[target.purpose].addresses, ...target.addresses];
        } else {
          listing[target.purpose] = { ...target };
        }
      }
    }
    if (blockchain != null && blockchain.routing_policy == 'account') {
      for (let i = 0; i < bridges.length; i++) {
        const bridge = bridges[i];
        if (!bridge.master || !Array.isArray(bridge.master.addresses))
          continue;

        const filteredMapping = bridge.master.addresses.filter((x: string) => !duplicates.has(x));
        filteredMapping.forEach((x: string) => duplicates.add(x));

        const mapping = filteredMapping.map((x: string) => UiUtil.toTaggedAddress(x));
        if (result.bridge != null) {
          result.bridge.addresses = [...result.bridge.addresses, ...mapping];
        } else {
          result.bridge = { ...result.routing, purpose: 'bridge', addresses: mapping };
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
  const senderAddresses: any[] = blockchainAddresses.routing?.addresses || [];
  const [senderIndex, setSenderIndex] = useState<number>(0);
  const [senderDialog, setSenderDialog] = useState<boolean>(false);
  const [wcFallback, setWcFallback] = useState<boolean>(false);
  const blockchainAssets = useMemo((): any[] => {
    const results = props.assets.filter(x => x.asset.chain == blockchain?.chain);
    if (!blockchain)
      return results;
    if (!results.some(x => x.asset.id == blockchain.id))
      results.unshift({ asset: blockchain, balance: new BigNumber(0), reserve: new BigNumber(0), supply: new BigNumber(0) });
    return results;
  }, [blockchain, props.assets]);
  const wcMemo = useMemo(() => {
    const raw = Signing.decodeAddress(ownerAddress);
    return raw ? ByteUtil.uint8ArrayToHexString(Uint8Array.from([...Hashing.hash256(raw.data).slice(20, 32), ...raw.data])) : '';
  }, [ownerAddress]);
  const requiresSenderAddress = useMemo(() => blockchain && blockchain.routing_policy == 'account', [blockchain]);
  const wcCacheLoad = useCallback((key: string): Promise<string> => BigStorage.get('WC:' + key), []);
  const wcCacheStore = useCallback((key: string, value: string): Promise<boolean> => BigStorage.set('WC:' + key, value), []);
  const wcConnect = useCallback((address: string, tokens: { contractAddress: string, symbol: string }[] | null) => {
    AlertBox.open(AlertType.Info, Array.isArray(tokens) ? 'Found ' + UiUtil.toCount('token', tokens.length) : ('Connected to ' + address));
    setWc(wc ? {
      ...wc,
      modal: true,
      lazy: !Array.isArray(tokens),
      session: {
        address: address,
        tokens: tokens || []
      }
    } : null);
  }, [wc]);
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
    
    navigate(`/interaction?asset=${token.asset.id}&type=withdraw&vault=${bridge.instance.bridge_hash}&fee=${bridge.instance.fee_rate.toString()}&back=/`);
  }, [blockchain, bridges, blockchainAssets]);
  useEffectAsync(async () => {
    setLoading(true);
    setSenderIndex(0);
    setWcFallback(false);
    setWc(prev => prev ? { modal: false, lazy: false, custom: false, session: null, symbol: null, token: null, amount: '' } : null);
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
        accountData = accountData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle)).map((item) => ({ ...item, addresses: item.addresses.map((address: string) => UiUtil.toTaggedAddress(address)) }));
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
  const autoAppliedAsset = useRef<string | null>(null);
  useEffect(() => {
    if (props.blockchain != null && autoAppliedAsset.current != props.blockchain.id) {
      autoAppliedAsset.current = props.blockchain.id;
      setBlockchainIndex(props.blockchains.sort((a, b) => new AssetId(a.id).handle.localeCompare(new AssetId(b.id).handle)).findIndex((x) => x.id == props.blockchain?.id));
    }
  }, [props.blockchains, props.blockchain]);

  return (
    <Box>
      <Box>
          <Select.Root size="3" value={blockchainIndex.toString()} onValueChange={(e) => {
            setWc(prev => prev ? { modal: false, lazy: false, custom: false, session: null, symbol: null, token: null, amount: '' } : null);
            setBlockchainIndex(parseInt(e));
          }}>
            <Select.Trigger style={{ width: '100%', flexShrink: 'initial' }} placeholder="Network / token standard" />
            <Select.Content color="gray">
              <Select.Group>
                <Select.Label>
                  <Text size="3">Network / token standard</Text>
                </Select.Label>
                <Select.Item value="-1">Bridge in &amp; out</Select.Item>
                {
                  blockchains.map((item, index) =>
                    <Select.Item value={index.toString()} key={item.id}>
                      <Flex gap="1" align="center">
                        <AssetImage asset={item} size="1" iconSize="20px"></AssetImage>
                        <AssetName asset={item} size="3" text={item.ext?.tokenStandard ? '/ ' + item.ext.tokenStandard : undefined} badge={false}></AssetName>
                      </Flex>
                    </Select.Item>
                  )
                }
              </Select.Group>
            </Select.Content>
          </Select.Root>
          {
            blockchain != null &&
            <div style={{ marginTop: 12 }}>
            <SegmentedControl.Root value={mode} radius="full" size="3" onValueChange={(value) => setMode(value as 'in' | 'out')}>
              <SegmentedControl.Item value="in">Bridge in</SegmentedControl.Item>
              <SegmentedControl.Item value="out">Bridge out</SegmentedControl.Item>
            </SegmentedControl.Root>
          </div>
          }
          {
            blockchain != null &&
            <>
          {
            loading &&
            <div className="card" style={{ marginTop: 14 }}>
              <div className="skel" style={{ height: 60 }}></div>
              <div className="skel" style={{ height: 60, marginTop: 10 }}></div>
            </div>
          }
          {
            !loading && mode == 'in' && !requiresSenderAddress && blockchainAddresses.bridge &&
            <>
              <div className="card" style={{ marginTop: 14 }}>
                <AddressView address={blockchainAddresses.bridge} policy={blockchain.routing_policy}></AddressView>
              </div>
              {
                blockchain.routing_policy == 'memo' &&
                <div className="callout warn" style={{ marginTop: 14 }}>
                  <Icon path={mdiAlertCircleOutline} size={1}></Icon>
                  <span>Send both — address <b>and</b> memo. Without the memo a payment can't be attributed to you.</span>
                </div>
              }
              <div className="tiny dim" style={{ marginTop: 14, textAlign: 'center' }}>
                Yours forever · credited when it lands.{' '}
                <Link to={'/explorer?view=vaults&asset=' + AssetId.fromHandle(blockchain.chain || '').toHex()} className="router-link" style={{ color: 'var(--info)', fontWeight: 650 }}>All vaults in explorer →</Link>
              </div>
            </>
          }
          {
            !loading && mode == 'in' && !requiresSenderAddress && !blockchainAddresses.bridge &&
            <>
              <div className="card" style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <AssetImage asset={blockchain} iconSize="34px"></AssetImage>
                  <div>
                    <div style={{ fontWeight: 750, fontSize: 16 }}><AssetName asset={blockchain} badge={false}></AssetName></div>
                    <div className="tiny dim">{ blockchain.routing_policy == 'utxo' ? 'UTXO chain' : 'Chain' } deposit</div>
                  </div>
                </div>
                <p className="small" style={{ color: 'var(--text-2)', lineHeight: 1.55 }}>Claimed with <b style={{ color: 'var(--text)' }}>one free on-chain transaction</b> — then yours forever. Deposits credit automatically.</p>
                <Button className="btn-brand btn-block" style={{ marginTop: 14 }} onClick={() => claim()}>Claim deposit address</Button>
              </div>
              <div className="callout" style={{ marginTop: 14 }}>
                <Icon path={mdiInformationOutline} size={1}></Icon>
                <span>After the claim confirms, return to Bridge — the address appears here.</span>
              </div>
            </>
          }
          {
            !loading && mode == 'in' && requiresSenderAddress &&
            <>
            <div className="card" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <AssetImage asset={blockchain} iconSize="34px"></AssetImage>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 750, fontSize: 16 }}><AssetName asset={blockchain} badge={false}></AssetName></div>
                  <div className="tiny dim">{ wcFallback ? 'Registered sender' : 'via WalletConnect' }</div>
                </div>
                { wc?.session != null && <span className="badge ok">{ UiUtil.toAddress(wc.session.address, 5) }</span> }
              </div>
              {
                !wcFallback &&
                <>
                  <Button className="btn-brand btn-block" loading={wc?.lazy} onClick={() => {
                    setWc(prev => prev ? { ...prev, modal: true } : { modal: true, lazy: true, custom: false, session: null, symbol: null, token: null, amount: '' });
                    if (!wc?.session)
                      wcContext.current?.acquire();
                  }}>Connect wallet &amp; add funds</Button>
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <Link to="#" className="router-link" style={{ color: 'var(--info)', fontWeight: 650, fontSize: 12.5 }} onClick={() => setWcFallback(true)}>Not using WalletConnect? Register a sender address →</Link>
                  </div>
                </>
              }
              {
                wcFallback &&
                <>
                  {
                    senderAddresses.length > 0 ?
                    <>
                      <p className="small" style={{ color: 'var(--text-2)', lineHeight: 1.55 }}>Register the address you send <b style={{ color: 'var(--text)' }}>from</b> with one small on-chain action. Transfers from anyone else are ignored.</p>
                      <div className="dl">
                        <div className="dl-row">
                          <span className="dl-k">Registered senders · { senderAddresses.length }</span>
                          <span className="dl-v mono" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="router-link" style={{ cursor: 'pointer' }} onClick={() => setSenderDialog(true)}>{ UiUtil.toAddress(senderAddresses[Math.min(senderIndex, senderAddresses.length - 1)].address, 6) }</span>
                            <IconButton variant="ghost" color="gray" size="1" aria-label="Add sender" onClick={() => claim()}><Icon path={mdiPlus} size={0.9}></Icon></IconButton>
                          </span>
                        </div>
                      </div>
                      {
                        blockchainAddresses.bridge &&
                        <div style={{ marginTop: 14 }}>
                          <AddressView address={blockchainAddresses.bridge} policy={blockchain.routing_policy}></AddressView>
                        </div>
                      }
                    </> :
                    <>
                      <p className="small" style={{ color: 'var(--text-2)', lineHeight: 1.55 }}>Register the address you send <b style={{ color: 'var(--text)' }}>from</b> with one small on-chain action. Transfers from anyone else are ignored.</p>
                      <Button className="btn-brand btn-block" style={{ marginTop: 14 }} onClick={() => claim()}>Add sender address</Button>
                    </>
                  }
                  <div style={{ marginTop: 12, textAlign: 'center' }}>
                    <Link to="#" className="router-link" style={{ color: 'var(--info)', fontWeight: 650, fontSize: 12.5 }} onClick={() => setWcFallback(false)}>Use WalletConnect →</Link>
                  </div>
                </>
              }
            </div>
            {
              wcFallback && senderAddresses.length == 0 &&
              <div className="callout" style={{ marginTop: 14 }}>
                <Icon path={mdiInformationOutline} size={1}></Icon>
                <span>After the sender registration confirms, return here — the vault master deposit address appears.</span>
              </div>
            }
            {
              wcFallback && senderAddresses.length > 0 &&
              <div className="callout warn" style={{ marginTop: 14 }}>
                <Icon path={mdiAlertCircleOutline} size={1}></Icon>
                <span>Deposits to this address are credited <b>only</b> from a registered sender address.</span>
              </div>
            }
            {
              wcFallback &&
              <div className="tiny dim" style={{ marginTop: 14, textAlign: 'center' }}>
                Shared vault address.{' '}
                <Link to={'/explorer?view=vaults&asset=' + AssetId.fromHandle(blockchain.chain || '').toHex()} className="router-link" style={{ color: 'var(--info)', fontWeight: 650 }}>All vaults in explorer →</Link>
              </div>
            }
            </>
          }
          {
            !loading && mode == 'out' &&
            <div className="card" style={{ marginTop: 14 }}>
              {
                blockchainAssets.filter((x) => x.balance.gt(0) || x.asset.id == blockchain.id).map((item) =>
                  <button className="asset-row" key={item.asset.id + '_out'} onClick={() => send(blockchainAssets.indexOf(item))}>
                    <AssetImage asset={item.asset} iconSize="34px"></AssetImage>
                    <div className="asset-main">
                      <div className="asset-name"><AssetName asset={item.asset} badge={false} symbol={true} tokenOnly={true}></AssetName></div>
                      <div className="asset-sub">{ item.asset.token ? 'Token' : 'Native' } · withdraw to { blockchain.chain }</div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{ UiUtil.toMoney(item.asset, item.balance) }</div>
                      <div className="tiny dim">Withdraw →</div>
                    </div>
                  </button>
                )
              }
            </div>
          }
          {
            blockchain.ext && !loading &&
            <Flex justify="center" mt="4" px="2">
              <Text align="center" size="1" className="dim">
                <Text style={{ color: 'var(--accent-11)' }}>{blockchain.ext.transactionTime}-{blockchain.ext.transactionTime + 5} min</Text> to get, never send to CEXes
                { blockchain.ext.blocking && <Text>, <Text color="yellow">very slow sending</Text></Text> }
                { blockchain.routing_policy == 'memo' && <Text>, <Text color="red">requires memo/dt to get</Text></Text> }
              </Text>
            </Flex>
          }
            </>
          }
        </Box>
      <Dialog.Root open={senderDialog && blockchain != null && senderAddresses.length > 0} onOpenChange={setSenderDialog}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>Registered senders · { senderAddresses.length }</Dialog.Title>
          {
            blockchain != null &&
            <AddressView address={{ ...blockchainAddresses.routing, addresses: senderAddresses }} policy={blockchain.routing_policy} initialVariant={Math.min(senderIndex, senderAddresses.length - 1)} onVariantChange={setSenderIndex}></AddressView>
          }
          <div className="tiny dim" style={{ textAlign: 'center', marginTop: 14 }}>Send only from these addresses · transfers from anyone else are ignored.</div>
        </Dialog.Content>
      </Dialog.Root>
      <Dialog.Root open={!!(wc && wc.session && wc.modal)} onOpenChange={(e) => setWc(prev => prev ? ({ ...prev, modal: e }) : null)}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title>
            <Flex justify="between">
              <Text>Account top-up</Text>
              <Badge color="yellow" size="3">Beta</Badge>
            </Flex>
          </Dialog.Title>
          <Dialog.Description size="2" mb="4">Use a wallet app to add funds</Dialog.Description>
            <Select.Root size="3" value={wc?.custom ? '__$$$custom_token$$$__' : (wc?.token || '__$$$native_token$$$__')} onValueChange={(item) => setWc(prev => {
              const result: { custom: boolean, token: string | null, symbol: string | null } = { custom: false, token: null, symbol: null };
              switch (item) {
                case '__$$$native_token$$$__':
                  result.custom = false;
                  result.token = null;
                  result.symbol = null;
                  break;
                case '__$$$custom_token$$$__':
                  result.custom = true;
                  result.token = null;
                  result.symbol = null;
                  break;
                default: {
                  const target = item ? prev?.session?.tokens.find((v) => v.contractAddress == item) : null;
                  result.custom = false;
                  result.token = target?.contractAddress || null;
                  result.symbol = target?.symbol || null;
                }
              }
              return prev ? { ...prev, ...result } : null;
            })}>
              <Select.Trigger mb="3" style={{ width: '100%', flexShrink: 'initial' }} />
              <Select.Content color="gray">
                <Select.Group>
                  <Select.Label>Tokens found</Select.Label>
                  <Select.Item value="__$$$native_token$$$__">
                    <Flex gap="1" align="center">
                      <AssetImage asset={blockchain || new AssetId()} size="1" iconSize="20px"></AssetImage>
                      <AssetName asset={blockchain || new AssetId()} size="3"></AssetName>
                    </Flex>
                  </Select.Item>
                  {
                    wc?.session?.tokens.map((item) => {
                      const asset = AssetId.fromHandle(blockchain?.chain || '', item.symbol, item.contractAddress);
                      return (
                        <Select.Item key={item.contractAddress} value={item.contractAddress}>
                          <Flex gap="1" align="center">
                            <AssetImage asset={asset} size="1" iconSize="20px"></AssetImage>
                            <AssetName asset={asset} size="3"></AssetName>
                          </Flex>
                        </Select.Item>
                      )
                    })
                  }
                </Select.Group>
                <Select.Separator />
                <Select.Group>
                  <Select.Label>Other options</Select.Label>
                  <Select.Item value="__$$$custom_token$$$__">Custom token</Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
            {
              wc?.custom &&
              <Box width="100%" mb="3">
                <Tooltip content="Enter a custom token contract address to use it for funding current account">
                  <TextField.Root size="3" placeholder="Token contract address" type="text" value={wc?.token || ''} onChange={(e) => setWc(prev => prev ? ({ ...prev, token: e.target.value.trim() || null }) : null)} />
                </Tooltip>
              </Box>
            }
            <Box width="100%">
              <Tooltip content={`Amount in ${wc?.symbol || 'custom token'} to add to current account`}>
                <TextField.Root size="3" placeholder={`${wc?.symbol || (wc?.custom ? 'Custom token' : (blockchain?.chain || 'coin'))} amount`} type="number" value={wc?.amount} onChange={(e) => setWc(prev => prev ? ({ ...prev, amount: TextUtil.toValue(prev.amount, e.target.value) }) : null)} />
              </Tooltip>
            </Box>
            <Flex gap="1" mt="4" justify="center">
              <Dialog.Close>
                <Button loading={wc?.lazy} variant="surface" onClick={() => wcContext.current?.submit(wc?.session?.address || '')}>Add { wc?.symbol || (wc?.custom ? 'custom token' : (blockchain?.chain || 'coin')) } to account</Button>
              </Dialog.Close>
              <IconButton variant="soft" size="2" color="red" disabled={wc?.lazy} onClick={() => {
                setWc(prev => prev ? ({ ...prev, session: null }) : null);
                wcContext.current?.reset();
              }}>
                <Icon path={mdiClose} size={1}></Icon>
              </IconButton>
            </Flex>
        </Dialog.Content>
      </Dialog.Root>
      {
        blockchain != null && blockchainAddresses.bridge?.addresses?.length > 0 && wc !== null &&
        <Suspense fallback={<></>}>
          <WcAdapter
            ref={wcContext}
            network={blockchain.chain as WcAsset}
            to={blockchainAddresses.bridge.addresses[0].address}
            memo={wcMemo}
            amount={wc.amount}
            token={wc.token}
            onCacheLoad={wcCacheLoad}
            onCacheStore={wcCacheStore}
            onInit={(acquire: () => void) => {
              setWc(prev => {
                if (prev?.modal)
                  acquire();
                return prev ? ({ ...prev, lazy: false }) : null;
              });
            }}
            onConnect={wcConnect}
            onStatusChange={(status) => {
              switch (status) {
                case 'idle':
                  AlertBox.open(AlertType.Info, 'Now ready to connect to a wallet');
                  break;
                case 'connecting':
                  AlertBox.open(AlertType.Info, 'Attempting to connect a wallet');
                  break;
                case 'sending':
                  AlertBox.open(AlertType.Info, 'Wallet connection now open');
                  break;
                case 'sent':
                  AlertBox.open(AlertType.Info, 'Wallet transaction sent, connection closed!');
                  break;
                case 'error':
                  AlertBox.open(AlertType.Warning, 'Wallet connection now closed');
                  break;
              }
            }}
            onError={(message) => AlertBox.open(AlertType.Warning, message)}
            onSent={(tx) => AlertBox.open(AlertType.Info, 'Transaction id: ' + tx.txId)}
          />
        </Suspense>
      }
    </Box>
  )
}