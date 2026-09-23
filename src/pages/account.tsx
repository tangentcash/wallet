import './account.css';
import { Box, Button, Card, Dialog, Flex, SegmentedControl, Spinner, Tabs, Text } from "@radix-ui/themes";
import { useNavigate, useParams, Link } from "react-router";
import { mdiAlertCircleOutline, mdiAlertDecagram, mdiBankOutline, mdiCheckBold, mdiCheckDecagram, mdiChevronDown, mdiContentCopy, mdiDatabaseOutline, mdiImport, mdiLock, mdiLockOpen, mdiMagnify, mdiOpenInNew, mdiPlus, mdiRefresh } from "@mdi/js";
import { useCallback, useState, useMemo, useRef } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData } from "../core/app";
import { RPC, EventResolver, SummaryState } from "tangentsdk/rpc";
import { AssetId, Chain } from "tangentsdk/algorithm";
import { Whitelist } from "tangentsdk/whitelist";
import { UiUtil } from "tangentsdk/ui";
import { Assetlist } from "tangentsdk/assetlist";
import { useEffectAsync } from "../core/react";
import { AssetImage } from "../components/asset-image";
import { AssetName } from "../components/asset-name";
import { AddressView } from "../components/address";
import { TransactionView } from "../components/transaction";
import AddressAvatar from "../components/avatar";
import type { ActivityEntry, BalanceRecord, RewardRecord } from "../core/types";
import { AppStorage, StorageField } from "../core/storage";
import BigNumber from "bignumber.js";
import InfiniteScroll from 'react-infinite-scroll-component';
import Icon from "@mdi/react";
import Vault from "../components/vault";

const TRANSACTION_COUNT = 16;

export default function AccountPage() {
  const ownerBaseAddress = AppData.getWalletAddress() || '';
  const ownerAddress = useParams().id || ownerBaseAddress;
  const self = ownerAddress == ownerBaseAddress;
  const navigate = useNavigate();
  const prevState = useRef<{ control: any, ownerAddress: any, nonce: any }>({ control: undefined, ownerAddress: undefined, nonce: undefined });
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [walletAddresses, setWalletAddresses] = useState<(string | null)[]>([]);
  const [vaultBlockchain, setVaultBlockchain] = useState<AssetId | null>(null);
  const [verifiedAssetsOnly, setVerifiedAssetsOnly] = useState<boolean>(false);
  const [blockchains, setBlockchains] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [program, setProgram] = useState<string | null>(null);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [participation, setParticipation] = useState<any>(null);
  const [production, setProduction] = useState<any>(null);
  const [selectedAddress, setSelectedAddress] = useState<number>(0);
  const [control, setControl] = useState<'balance' | 'address' | 'storage'>('balance');
  const [finalizedTransactions, setFinalizedTransactions] = useState<{ transaction: any, receipt?: any, state?: SummaryState }[]>([]);
  const [mempoolTransactions, setMempoolTransactions] = useState<any[]>([]);
  const [moreTransactions, setMoreTransactions] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rpcError, setRpcError] = useState<string | null>(null);
  const transactions = useMemo((): { transaction: any, receipt?: any, state?: SummaryState }[] => {
    return [...mempoolTransactions.map((x) => ({ transaction: x })), ...finalizedTransactions];
  }, [finalizedTransactions, mempoolTransactions]);
  const filteredAddresses = useMemo((): any[] => {
    const routes = addresses.filter((x) => x.purpose == 'routing');
    const vaults = addresses.filter((x) => x.asset.chain == Chain.policy.TOKEN_NAME || x.purpose == 'bridge');
    const results: Record<string, any> = { };
    const filteredResults = [{ asset: new AssetId(), addresses: [{ address: ownerAddress }] }];
    const merge = (item: any) => {
      const key = item.asset.chain + item.purpose;
      const target = results[key];
      if (target != null) {
        target.addresses = [...target.addresses, ...item.addresses];
      } else {
        results[key] = { ...item };
      }
    };
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const vault = vaults.find((x) => x.asset.chain == route.asset.chain);
      const blockchain = vault ? null : blockchains.find((x) => x.chain == route.asset.chain);
      if (!vault && blockchain != null && blockchain.routing_policy == 'account')
        vaults.push({ ...route, purpose: 'bridge', addresses: null });
      merge(route);
    }
    for (let i = 0; i < vaults.length; i++) {
      merge(vaults[i]);
    }
    for (let chain in results) {
      filteredResults.push(results[chain]);
    }
    return filteredResults;
  }, [blockchains, addresses]);
  const filteredAddress = useMemo((): any => {
    return selectedAddress >= 0 && selectedAddress < filteredAddresses.length ? filteredAddresses[selectedAddress] : null;
  }, [filteredAddresses, selectedAddress]);
  const assets = useMemo((): any[] => {
    const result = verifiedAssetsOnly ? [] : allAssets;
    for (let i = 0; i < allAssets.length; i++) {
      const item = allAssets[i];
      const contractAddress = Whitelist.contractAddressOf(item.asset);
      const verified = contractAddress && !Whitelist.fake(item.asset, contractAddress);
      if (verified && verifiedAssetsOnly) {
        result.push(item);
      }
    }
    return result;
  }, [allAssets, verifiedAssetsOnly]);
  const switchWallet = useCallback(async (index: number) => {
    const status = await AppData.switchWallet(index);
    if (status) {
      setWalletAddresses(await AppData.getWalletAddresses());
      AlertBox.open(AlertType.Info, 'Switched to wallet ' + (AppData.getWalletAddress() || (index + 1).toString()));
    } else {
      AlertBox.open(AlertType.Error, 'Failed to switch to wallet ' + (index + 1).toString());
    }
  }, []);
  const findTransactions = useCallback(async (refresh?: boolean) => {
    try {
      const data = await RPC.getTransactionsByOwner(ownerAddress, refresh ? 0 : finalizedTransactions.length, TRANSACTION_COUNT, 0, 2);
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setFinalizedTransactions([]);
        setMoreTransactions(false);
        return false;
      }

      const candidateTransactions = data.map((value) => { return { ...value, state: EventResolver.calculateSummaryState(value?.receipt?.events) } });
      setFinalizedTransactions(refresh ? candidateTransactions : prev => prev.concat(candidateTransactions));
      setMoreTransactions(candidateTransactions.length >= TRANSACTION_COUNT);
      return candidateTransactions.length > 0;
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch transactions: ' + (exception as Error).message);
      if (refresh)
        setFinalizedTransactions([]);
      setMoreTransactions(false);
      return false;
    }
  }, [ownerAddress, finalizedTransactions]);
  const findMempoolTransactions = useCallback(async () => {
    try {
      const data = await RPC.getMempoolTransactionsByOwner(ownerAddress, 0, TRANSACTION_COUNT, 0, 1);
      if (Array.isArray(data)) {
        setMempoolTransactions(data);
        return data.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  }, [ownerAddress]);
  const updateAccountData = useCallback(async () => {
    const tasks: Promise<any>[] = [];
    switch (control) {
      case 'address':
        tasks.push((async () => {
          try {
            let addressData = await RPC.fetchAll((offset, count) => RPC.getWitnessAccounts(ownerAddress, offset, count));
            if (Array.isArray(addressData) && addressData.length > 0) {
              addressData = addressData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle)).map((item) => ({ ...item, addresses: item.addresses.map((address: string) => UiUtil.toTaggedAddress(address)) }));
              setAddresses(addressData);
            } else {
              setAddresses([]);
              setSelectedAddress(0);
            }
          } catch (exception) {
            AlertBox.open(AlertType.Error, 'Failed to fetch account addresses: ' + (exception as Error).message);
            setAddresses([]);
            setSelectedAddress(0);
          }
        })());
        break;
      case 'balance':
        tasks.push((async () => {
          try {
            setRpcError(null);
            let assetData = await RPC.fetchAll((offset, count) => RPC.getAccountBalances(ownerAddress, offset, count));
            if (Array.isArray(assetData)) {
              assetData = assetData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
              assetData = assetData.filter((item) => item.balance?.gt(0) || item.reserve?.gt(0) || item.supply?.gt(0));
              setAllAssets(assetData.map(x => ({ ...x, contractAddress: Whitelist.contractAddressOf(x.asset) })));
            } else {
              setAllAssets([]);
            }
            } catch (exception) {
              AlertBox.open(AlertType.Error, 'Failed to fetch account balances: ' + (exception as Error).message);
              setAllAssets([]);
              setRpcError((exception as Error).message);
          }
        })());
        break;
      case 'storage':
        tasks.push((async () => {
          try {
            const attestationData = await RPC.getValidatorAttestationsWithRewards(ownerAddress);
            if (Array.isArray(attestationData)) {
              for (let i = 0; i< attestationData.length; i++) {
                const data = attestationData[i];
                data.block_number = BigNumber.max(data.block_number, ...(data.rewards || []).map((x: any) => x.block_number || new BigNumber(0)));
              }
            }
            setAttestations(Array.isArray(attestationData) ? attestationData : []);
          } catch (exception) {
            AlertBox.open(AlertType.Error, 'Failed to fetch account attestations: ' + (exception as Error).message);
            setAttestations([]);
          }
        })());
        tasks.push((async () => {
          try {
            const participationData = await RPC.getValidatorParticipationWithRewards(ownerAddress);
            if (participationData != null) {
              participationData.block_number = BigNumber.max(participationData.block_number, ...(participationData.rewards || []).map((x: any) => x.block_number || new BigNumber(0)));
            }
            setParticipation(participationData || null);
          } catch (exception) {
            AlertBox.open(AlertType.Error, 'Failed to fetch account participations: ' + (exception as Error).message)
            setParticipation(null);
          }
        })());
        tasks.push((async () => {
          try {
            const productionData = await RPC.getValidatorProductionWithRewards(ownerAddress);
            if (productionData != null) {
              productionData.block_number = BigNumber.max(productionData.block_number, ...(productionData.rewards || []).map((x: any) => x.block_number || new BigNumber(0)));
            }
            setProduction(productionData || null);
          } catch {
            setProduction(null);
          }
        })());
        tasks.push((async () => {
          try {
            const program = await RPC.getAccountProgram(ownerAddress);
            setProgram(program?.hashcode || null);
          } catch {
            setProgram(null);
          }
        })());
        break;
      default:
        break;
    }
    await Promise.all(tasks);
  }, [ownerAddress, control]);
  useEffectAsync(async () => {
    if (!AppData.tip)
      await AppData.sync();
    
    const nextState = { control: control, ownerAddress: ownerAddress, nonce: nonce };
    const tasks = nextState.ownerAddress != prevState.current.ownerAddress || nextState.nonce != prevState.current.nonce ? [
      updateAccountData(),
      findMempoolTransactions(),
      findTransactions(true)
    ] : [updateAccountData()];
    prevState.current = nextState;
    await Promise.all(tasks);
    setLoading(false);
  }, [control, ownerAddress, nonce]);
  useEffectAsync(async () => {
    setVerifiedAssetsOnly(!!AppStorage.get(StorageField.VerifiedAssetsOnly));
    try {
      if (!blockchains.length)
        setBlockchains((await RPC.getBlockchains()) || []);
    } catch { }
  }, []);
  useEffectAsync(async () => {
    if (self) {
      let asset: AssetId | null = null;
      if (finalizedTransactions.length > 0) {
        const target = finalizedTransactions[0];
        const blockchain = blockchains.find((x) => x.chain == target.transaction.asset.chain);
        if (blockchain != null) {
          const type = UiUtil.toTransactionType(target.transaction.type);
          if (blockchain.routing_policy == 'account' ? (type == 'route' || type == 'bind' || type == 'imbind') : (type == 'bind' || type == 'imbind')) {
            asset = AssetId.fromHandle(target.transaction.asset.chain);
          }
        }
      }
      setVaultBlockchain(asset);
      setWalletAddresses(await AppData.getWalletAddresses());
    }
  }, [self, blockchains, finalizedTransactions]);
  useEffectAsync(async () => {
    const state: { blockId: any, transactionId: any } = { blockId: null, transactionId: null };
    RPC.onNodeEvent = (event) => {
      switch (event.type) {
        case 'block': {
          if (state.blockId != null)
            clearTimeout(state.blockId);
          state.blockId = setTimeout(() => {
            AppData.sync().then(() => setNonce(prev => prev + 1));
            state.blockId = null;
          }, 1000);
          break;
        }
        case 'transaction': {
          if (state.transactionId != null)
            clearTimeout(state.transactionId);
          state.transactionId = setTimeout(() => {
            AppData.sync().then(() => setNonce(prev => prev + 1));
            state.transactionId = null;
          }, 1000);
          break;
        }
        default:
          break;
      }
    };

    await RPC.subscribeTopics(ownerAddress ? [ownerAddress] : []);
    return () => {
      RPC.onNodeEvent = null;
      if (state.blockId != null)
        clearTimeout(state.blockId);
      if (state.transactionId != null)
        clearTimeout(state.transactionId);
    };
  }, [ownerAddress, ownerBaseAddress]);

  const nativeAsset = useMemo(() => new AssetId(), []);
  const tanMoney = useMemo((): [string, string] => {
    const target = assets.find((x) => x.asset.id == nativeAsset.id);
    const money = UiUtil.toMoney(nativeAsset, target ? target.supply : new BigNumber(0));
    const index = money.lastIndexOf(' ');
    return index > 0 ? [money.substring(0, index), money.substring(index + 1)] : [money, 'TAN'];
  }, [assets, nativeAsset]);
  const tanFee = useMemo((): string | null => {
    const chain = blockchains.find((x) => x.chain == nativeAsset.chain);
    return chain?.gas_price != null ? UiUtil.toMoney(nativeAsset, chain.gas_price) : null;
  }, [blockchains, nativeAsset]);
  const assetContext = (item: BalanceRecord): string => {
    if (item.asset.id == nativeAsset.id)
      return 'Network token';
    if (item.asset.chain == 'TAN')
      return 'Token · ' + (item.contractAddress != null && !Whitelist.fake(item.asset, item.contractAddress) ? 'verified' : 'unverified');
    return item.asset.chain + (item.asset.token ? ' ' + UiUtil.toAssetSymbol(item.asset) : '') + ' · ' + (item.contractAddress != null && !Whitelist.fake(item.asset, item.contractAddress) ? 'verified' : 'bridged');
  };
  const unlockedShare = (item: BalanceRecord): string => {
    if (item.supply == null || item.supply.lte(0))
      return '—';
    return Math.min(100, Math.round(item.balance.dividedBy(item.supply).toNumber() * 100)).toString() + '%';
  };
  const dayGroups = useMemo((): { day: number, label: string, entries: ActivityEntry[] }[] => {
    const groups: { day: number, label: string, entries: ActivityEntry[] }[] = [];
    transactions.forEach((item) => {
      const timestamp = item.receipt?.block_time?.toNumber() || Date.now();
      const day = new Date(timestamp).setHours(0, 0, 0, 0);
      const label = day == new Date().setHours(0, 0, 0, 0) ? 'Today' : new Date(day).toLocaleDateString();
      const last = groups[groups.length - 1];
      if (last != null && last.day == day)
        last.entries.push(item);
      else
        groups.push({ day, label, entries: [item] });
    });
    return groups;
  }, [transactions]);

  return (
    <Box>
      <div className="page-head">
        <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <Dialog.Trigger>
            <button className="acct-chip" style={{ border: 0 }}>
              <span className={'avatar' + (self && AppData.hasWalletSecretKey() ? '' : ' watch')}>
                <AddressAvatar address={ownerAddress || ''} size="1" style={{ width: '100%', height: '100%' }}></AddressAvatar>
              </span>
              <span className="mono">{ UiUtil.toAddress(ownerAddress, 6) }</span>
              { self && !AppData.isWalletReady() && <span className="lock">LOCKED</span> }
              <Icon path={mdiChevronDown} size={0.7} style={{ color: 'var(--text-2)' }}></Icon>
            </button>
          </Dialog.Trigger>
            <Dialog.Content className="sheet-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
                <Dialog.Title style={{ fontWeight: 750, fontSize: 16, color: 'var(--text)', margin: 0 }}>Your accounts</Dialog.Title>
                <span className="token-select dot" style={{ height: 32, fontSize: 12 }} title="Current network">
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lime-solid)' }}></span>
                  { (String(AppStorage.get(StorageField.Network) || AppData.defaultNetwork()) || '').replace(/^\w/, (c) => c.toUpperCase()) }
                </span>
              </div>
              {
                walletAddresses.map((item, index) =>
                  <button key={item || 'add-' + index} onClick={() => {
                    setSheetOpen(false);
                    switchWallet(index);
                  }} className={ 'acct-row' + (item != null && item == ownerAddress ? ' sel' : '') }>
                    <span className="ava">
                      { item != null ? <AddressAvatar address={item} size="1" style={{ width: '100%', height: '100%' }}></AddressAvatar> : <Icon path={mdiPlus} size={0.75}></Icon> }
                    </span>
                    <span className="bd">
                      <span className="mono nm">
                        { item ? UiUtil.toAddress(item, 6) : 'Add account' }
                      </span>
                      <span className="tiny dim sb">
                        { item == null ? 'next unused key' : (item == ownerAddress ? (AppData.hasWalletSecretKey() ? 'full control · current' : 'watch control · current') : 'switch account · full control') }
                      </span>
                    </span>
                    { item != null && item == ownerAddress && <Icon path={mdiCheckBold} size={0.8} style={{ color: 'var(--lime)', flex: 'none' }}></Icon> }
                  </button>
                )
              }
              <div style={{ height: 1, background: 'var(--line)', margin: '12px 8px' }}></div>
              {
                self &&
                <button onClick={() => {
                  setSheetOpen(false);
                  if (AppData.isWalletReady()) {
                    AppData.clearWallet();
                  } else {
                    navigate('/restore');
                  }
                }} className="sheet-action">
                  <span className="sa-ico"><Icon path={AppData.isWalletReady() ? mdiLock : mdiLockOpen} size={0.78}></Icon></span>
                  <span style={{ fontWeight: 650, fontSize: 14 }}>{ AppData.isWalletReady() ? 'Lock wallet account' : 'Unlock wallet account' }</span>
                  <span className="tiny dim" style={{ marginLeft: 'auto' }}>{ AppData.isWalletReady() ? 'remove key from this device' : 'restore from this device' }</span>
                </button>
              }
              <button onClick={() => {
                const value = !verifiedAssetsOnly;
                AppStorage.set(StorageField.VerifiedAssetsOnly, value);
                setVerifiedAssetsOnly(value);
              }} className="sheet-action">
                <span className="sa-ico"><Icon path={verifiedAssetsOnly ? mdiAlertDecagram : mdiCheckDecagram} size={0.78}></Icon></span>
                <span style={{ fontWeight: 650, fontSize: 14 }}>{ verifiedAssetsOnly ? 'Show unverified assets' : 'Show verified assets' }</span>
              </button>
              <button onClick={() => {
                navigator.clipboard.writeText(ownerAddress);
                AlertBox.open(AlertType.Info, (self ? 'Your ' : '') + ownerAddress + ' address copied!');
              }} className="sheet-action">
                <span className="sa-ico"><Icon path={mdiContentCopy} size={0.78}></Icon></span>
                <span style={{ fontWeight: 650, fontSize: 14 }}>Copy { self ? 'my ' : ''}address</span>
              </button>
              {
                !self &&
                <button onClick={() => { setSheetOpen(false); navigate('/restore'); }} className="sheet-action">
                  <span className="sa-ico"><Icon path={mdiImport} size={0.78}></Icon></span>
                  <span style={{ fontWeight: 650, fontSize: 14 }}>Import or watch account</span>
                </button>
              }
              <div className="tiny dim" style={{ textAlign: 'center', marginTop: 14, padding: '0 8px' }}>Selecting an account switches balances, history and signing keys.</div>
            </Dialog.Content>
        </Dialog.Root>
        <button className="icon-btn" title="Search blockchain" onClick={() => navigate('/explorer')}><Icon path={mdiMagnify} size={1}></Icon></button>
      </div>

      {
        loading && !assets.length && !transactions.length &&
        <>
          <div className="skel" style={{ height: 44, width: 180 }}></div>
          <div className="segmented" style={{ marginTop: 18 }}><button></button><button></button><button></button></div>
          <Card style={{ padding: '6px 18px' }}>
            <div className="asset-row"><span className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }}></span><div style={{ flex: 1 }}><div className="skel skel-line" style={{ width: '46%', margin: 0 }}></div><div className="skel skel-line" style={{ width: '70%' }}></div></div><div className="skel skel-line" style={{ width: 88, margin: 0 }}></div></div>
            <div className="asset-row"><span className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }}></span><div style={{ flex: 1 }}><div className="skel skel-line" style={{ width: '52%', margin: 0 }}></div><div className="skel skel-line" style={{ width: '64%' }}></div></div><div className="skel skel-line" style={{ width: 96, margin: 0 }}></div></div>
            <div className="asset-row"><span className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }}></span><div style={{ flex: 1 }}><div className="skel skel-line" style={{ width: '40%', margin: 0 }}></div><div className="skel skel-line" style={{ width: '72%' }}></div></div><div className="skel skel-line" style={{ width: 80, margin: 0 }}></div></div>
          </Card>
        </>
      }

      {
        !(loading && !assets.length && !transactions.length) &&
        <>
          {
            rpcError != null &&
            <>
              <div className="callout err">
                <Icon path={mdiAlertCircleOutline} size={1}></Icon>
                <span><b>Node offline.</b> { rpcError } Your funds are safe on-chain — balances update once the node reconnects.</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <Button className="btn-soft" style={{ flex: 1 }} onClick={() => setNonce((prev) => prev + 1)}><Icon path={mdiRefresh} size={0.85}></Icon>Retry now</Button>
                <Button className="btn-soft" style={{ flex: 1 }} onClick={() => navigate('/configure')}>Change RPC</Button>
              </div>
            </>
          }
          <div className="hero-num num" style={{ marginTop: rpcError != null ? 18 : 0 }}>
            { tanMoney[0] } <span style={{ fontSize: '0.5em', fontWeight: 700, color: 'var(--text-2)' }}>{ tanMoney[1] }</span>
          </div>
          <div className="page-sub" style={{ marginTop: 6 }}>
            { assets.length ? UiUtil.toCount('asset', assets.length) : 'No assets yet' }
            { AppData.tip != null && <> · block <span className="mono num">#{ AppData.tip.toString() }</span></> }
            { tanFee != null && <> · fee { tanFee }</> }
          </div>

          <SegmentedControl.Root value={control} radius="full" size="3" mt="4" mb="4" onValueChange={(value) => setControl(value as 'balance' | 'address' | 'storage')}>
            <SegmentedControl.Item value="address">
              <Flex gap="2" align="center">
                { loading && control == 'address' && <Spinner /> }
                <Text size="2">Fund</Text>
              </Flex>
            </SegmentedControl.Item>
            <SegmentedControl.Item value="balance">
              <Flex gap="2" align="center">
                { loading && control == 'balance' && <Spinner /> }
                <Text size="2">Balance</Text>
              </Flex>
            </SegmentedControl.Item>
            <SegmentedControl.Item value="storage">
              <Flex gap="2" align="center">
                { loading && control == 'storage' && <Spinner /> }
                <Text size="2">Data</Text>
              </Flex>
            </SegmentedControl.Item>
          </SegmentedControl.Root>

          <Tabs.Root value={control}>
            <Tabs.Content value="address">
              {
                filteredAddress != null &&
                <Card style={{ padding: 20 }}>
                  <AddressView address={filteredAddress} onExit={() => setSelectedAddress(-1)}></AddressView>
                </Card>
              }
              {
                !filteredAddress &&
                <Card style={{ padding: '6px 18px' }}>
                  {
                    filteredAddresses.map((item, index) =>
                      <div key={item.asset.id + '_address_select_' + index.toString()} className="asset-row" style={{ cursor: 'pointer' }} onClick={() => {
                        if (item.addresses != null) {
                          setSelectedAddress(index);
                        } else {
                          navigate(`/explorer?view=vaults&asset=${item.asset.id}`);
                        }
                      }}>
                        <AssetImage asset={item.asset} iconSize="40px"></AssetImage>
                        <div className="asset-main">
                          <div className="asset-name"><AssetName asset={item.asset} size="3" badge={false}></AssetName></div>
                          <div className="asset-sub">
                            { item.purpose == 'bridge' ? 'Vault funding address' : item.purpose == 'routing' ? 'Routing address' : item.purpose == 'witness' ? 'Archive address' : 'Network address' }
                          </div>
                        </div>
                        {
                          item.addresses != null ?
                            <span className={'badge ' + (item.purpose == 'bridge' ? 'info' : 'flat')}>{ item.purpose == 'bridge' ? 'VAULT' : item.purpose == 'routing' ? 'ROUTING' : 'ADDRESS' }</span> :
                            <span className="badge info"><Icon path={mdiOpenInNew} size={0.55}></Icon>VAULTS</span>
                        }
                      </div>
                    )
                  }
                </Card>
              }
            </Tabs.Content>
            <Tabs.Content value="balance">
              {
                !assets.length && !loading &&
                <Card style={{ padding: 0 }}>
                  <div className="empty">
                    <div className="art"><Icon path={mdiBankOutline} size={1.75}></Icon></div>
                    <h4>{ self ? 'Your wallet is ready' : 'Nothing here yet' }</h4>
                    <p>{ self ? 'Receive TAN from a friend or bridge in from another network to get started.' : 'This account has no non-zero asset balances.' }</p>
                  </div>
                </Card>
              }
              {
                assets.length > 0 &&
                <Card style={{ padding: '6px 18px' }}>
                  {
                    assets.map((item) =>
                      <div key={item.asset.id + '_balance'} className="asset-row">
                        <AssetImage asset={item.asset} iconSize="40px"></AssetImage>
                        <div className="asset-main">
                          <div className="asset-name"><AssetName asset={item.asset} size="3"></AssetName></div>
                          <div className="asset-sub">{ assetContext(item) }</div>
                        </div>
                        <div className="asset-amt" title={
                          (typeof item.contractAddress == 'string' ? 'Contract address: ' + UiUtil.toAddress(item.contractAddress, 8) + '\n' : '') +
                          'Locked value: ' + new BigNumber(item.reserve).toString() + ' ' + UiUtil.toAssetSymbol(item.asset) + '\n' +
                          'Unlocked value: ' + new BigNumber(item.balance).toString() + ' ' + UiUtil.toAssetSymbol(item.asset) + '\n' +
                          'Total value: ' + new BigNumber(item.supply).toString() + ' ' + UiUtil.toAssetSymbol(item.asset)
                        }>
                          { UiUtil.toMoney(item.asset, item.supply) }
                          <span className="sub">{ unlockedShare(item) } unlocked</span>
                        </div>
                      </div>
                    )
                  }
                </Card>
              }
              {
                self && (
                  <Box id="tg-bridge-panel" style={{ marginTop: 18 }}>
                    <Vault blockchains={blockchains} blockchain={vaultBlockchain || undefined} assets={allAssets}></Vault>
                  </Box>
                )
              }
            </Tabs.Content>
            <Tabs.Content value="storage">
              {
                (program != null || production != null || participation != null || attestations.length > 0) ?
                <>
                  {
                    program != null &&
                    <Card style={{ padding: 20 }}>
                      <div className="card-title">Smart contract</div>
                      <div className="dl">
                        <div className="dl-row">
                          <span className="dl-k">Attached program</span>
                          <span className="dl-v"><Link className="router-link mono" style={{ textDecoration: 'none' }} to={'/program/' + program}>{ UiUtil.toAddress(program, 8) }</Link></span>
                        </div>
                      </div>
                    </Card>
                  }
                  {
                    production != null && production.stake != null &&
                  <Card style={{ padding: 20, marginTop: program != null ? 14 : undefined }}>
                    <div className="card-title">Block production</div>
                    <span className="badge ok">
                      PRODUCER ACTIVE IN BLOCK { production.block_number.toNumber() }
                    </span>
                    <div className="dl">
                      <div className="dl-row">
                        <span className="dl-k">Staking</span>
                        <span className="dl-v num">{ UiUtil.toMoney(new AssetId(), production.stake) }</span>
                      </div>
                      {
                        production?.rewards != null && production.rewards.length > 0 ?
                        production.rewards.map((item: RewardRecord, index: number) =>
                          <div className="dl-row" key={(item.asset.id || 'reward') + '_production_reward_' + index}>
                            <span className="dl-k">{ item.asset.chain } locked reward</span>
                            <span className="dl-v num">{ UiUtil.toMoney(item.asset, item.reward) }</span>
                          </div>
                        ) :
                        <div className="dl-row">
                          <span className="dl-k">TAN locked reward</span>
                          <span className="dl-v num">—</span>
                        </div>
                      }
                    </div>
                  </Card>
                  }
                  {
                    participation != null &&
                    <Card style={{ padding: 20, marginTop: 14 }}>
                      <div className="card-title">Vault participation</div>
                      <span className={participation.stake != null ? 'badge ok' : 'badge err'}>
                        PARTICIPANT { participation.stake != null ? 'ACTIVE' : 'OFFLINE' }{ participation.stake != null ? ' IN BLOCK ' + participation.block_number.toNumber() : (' FROM BLOCK ' + participation.block_number.toNumber()) }
                      </span>
                      <div className="dl">
                        <div className="dl-row">
                          <span className="dl-k">Stake · signer of outgoing transactions</span>
                          <span className="dl-v num">{ participation.stake != null && participation.stake.gte(0) ? UiUtil.toMoney(new AssetId(), participation.stake) : '—' }</span>
                        </div>
                        {
                          participation.rewards.map((item: RewardRecord, index: number) =>
                            <div className="dl-row" key={item.asset.id + '_participation_' + index}>
                              <span className="dl-k">{ item.asset.chain } locked reward</span>
                              <span className="dl-v num">{ UiUtil.toMoney(item.asset, item.reward) }</span>
                            </div>
                          )
                        }
                      </div>
                    </Card>
                  }
                  {
                    attestations.map((attestation, ai) =>
                      <Card key={attestation.asset.id + '_attestation_' + ai} style={{ padding: 20, marginTop: 14 }}>
                        <div className="card-title">Vault attestation — { Assetlist.toName(new AssetId(attestation.asset.id)) }</div>
                        <span className={attestation.stake != null ? 'badge ok' : 'badge err'}>
                          ATTESTATION { attestation.stake != null ? 'ACTIVE' : 'OFFLINE' }{ attestation.stake != null ? ' IN BLOCK ' + attestation.block_number.toNumber() : (' FROM BLOCK ' + attestation.block_number.toNumber()) }
                        </span>
                        <div className="dl">
                          <div className="dl-row">
                            <span className="dl-k">Stake · cross-chain coordination</span>
                            <span className="dl-v num">{ attestation.stake != null && attestation.stake.gte(0) ? UiUtil.toMoney(new AssetId(), attestation.stake) : '—' }</span>
                          </div>
                          {
                            attestation.rewards.map((item: RewardRecord, index: number) =>
                              <div className="dl-row" key={item.asset.id + '_attestation_reward_' + index}>
                                <span className="dl-k">{ item.asset.chain } locked reward</span>
                                <span className="dl-v num">{ UiUtil.toMoney(item.asset, item.reward) }</span>
                              </div>
                            )
                          }
                        </div>
                      </Card>
                    )
                  }
                </> :
                <Card style={{ padding: 0 }}>
                  <div className="empty">
                    <div className="art"><Icon path={mdiDatabaseOutline} size={1.75}></Icon></div>
                    <h4>No on-chain data</h4>
                    <p>This account has no smart contract, block production or vault participation records yet.</p>
                  </div>
                </Card>
              }
            </Tabs.Content>
          </Tabs.Root>
        </>
      }

      {
        transactions.length > 0 &&
        <Box width="100%" mt="6">
          <InfiniteScroll dataLength={transactions.length} hasMore={moreTransactions} next={findTransactions} loader={<div></div>}>
            {
              dayGroups.map((group) =>
                <div key={group.label}>
                  <div className="day-label">{ group.label }</div>
                  <Card style={{ padding: '4px 18px' }}>
                    {
                      group.entries.map((item, index) =>
                        <TransactionView key={item.transaction.hash + '_' + index} variant="row" ownerAddress={ownerAddress} transaction={item.transaction} receipt={item.receipt} state={item.state}></TransactionView>
                      )
                    }
                  </Card>
                </div>
              )
            }
          </InfiniteScroll>
        </Box>
      }
    </Box>
  );
}