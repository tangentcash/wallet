import { Box, Button, Flex, Avatar, Badge, Card, SegmentedControl, Spinner, Tabs, Text, Tooltip, DropdownMenu } from "@radix-ui/themes";
import { useNavigate, useParams, Link } from "react-router";
import { mdiAlertDecagram, mdiCheckDecagram, mdiChevronDown, mdiLock, mdiLockOpen, mdiMagnifyScan, mdiQrcode, mdiQrcodeScan } from "@mdi/js";
import { useCallback, useState, useMemo, useRef } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData } from "../core/app";
import { Authorizer, RPC, EventResolver, SummaryState, AssetId, Readability, Chain, Whitelist } from "tangentsdk";
import { useEffectAsync } from "../core/react";
import { mdiArrowRightBoldHexagonOutline, mdiBridge, mdiCellphoneKey, mdiCoffin, mdiConsole, mdiOpenInNew, mdiSourceCommitLocal, mdiSourceCommitStartNextLocal, mdiTransitConnectionVariant } from "@mdi/js";
import { AssetImage, AssetName } from "../components/asset";
import { AddressView } from "../components/address";
import { TransactionView } from "../components/transaction";
import { AppStorage } from "../core/storage";
import BigNumber from "bignumber.js";
import InfiniteScroll from 'react-infinite-scroll-component';
import Icon from "@mdi/react";
import Vault from "../components/vault";
import AddressAvatar from "../components/avatar";

const TRANSACTION_COUNT = 16;

export default function AccountPage() {
  const mobile = document.body.clientWidth < 500;
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
  const tryPrompt = useCallback(async () => {
    if (loading)
      return;
    
    setLoading(true);
    try {
      const { scan, Format } = await import('@tauri-apps/plugin-barcode-scanner');
      const result = await scan({ windowed: true, formats: [Format.QRCode] });
      try {
        const request: { url?: string } = JSON.parse(result.content);
        if (typeof request.url != 'string' || !new URL(request.url).href.length)
          throw false;
        
        Authorizer.try(request);
      } catch {
        throw new Error('Not an approval prompt');
      }
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Approval reverted: ' + (typeof exception == 'string' ? exception : exception.message));
    }
    setLoading(false);
  }, [loading]);
  const switchWallet = useCallback(async (index: number) => {
    const status = await AppData.switchWallet(index);
    if (status) {
      setWalletAddresses(await AppData.getWalletAddresses());
      AlertBox.open(AlertType.Info, 'Switched to wallet ' + (AppData.getWalletAddress() || (index + 1).toString()));
    } else {
      AlertBox.open(AlertType.Error, 'Failed to switch to wallet ' + (index + 1).toString());
    }
  }, []);
  const resolveTransactions = useCallback((offset: number, resolve: (tx: any) => boolean): any => {  
    for (let i = 0; i < 1024; i++) {
      const index = offset - i;
      const top = index >= 0 && index < finalizedTransactions.length ? finalizedTransactions[index].transaction : null;
      if (!top) {
        return null;
      } else if (resolve(top)) {
        return top;
      }
    }
    return null;
  }, [finalizedTransactions]);
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
              addressData = addressData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle)).map((item) => ({ ...item, addresses: item.addresses.map((address: string) => Readability.toTaggedAddress(address)) }));
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
    setVerifiedAssetsOnly(!!AppStorage.get('__verified_assets_only__'));
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
          const type = Readability.toTransactionType(target.transaction.type);
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
    RPC.onNodeMessage = (event) => {
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
    return () => { RPC.onNodeMessage = null; };
  }, [ownerAddress, ownerBaseAddress]);

  return (
    <Box pt="2" maxWidth="680px" mx="auto">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <Box px={mobile ? '2' : undefined}>
            <Button variant="ghost" color="gray" style={{ width: '100%', height: 'auto', minHeight: 'initial', lineHeight: 'initial', textAlign: 'initial', borderRadius: '12px', margin: 0, padding: 0, display: 'block' }}>
              <Flex gap="2" align="center" justify="between" px="2" py="2">
                <Flex align="center" gap="2">
                  <AddressAvatar address={ownerAddress} size="3"></AddressAvatar>
                  <Flex direction="column">
                    { self && AppData.isWalletReady() ? <Text color="red" size="2">Full control</Text> : <Text color="gray" size="2">Watch only</Text> }
                    <Text style={{ color: 'var(--gray-12)' }} weight="bold" size="2">{ Readability.toAddress(ownerAddress, 6) }</Text>
                  </Flex>
                </Flex>
                <Icon path={mdiChevronDown} style={{ color: 'var(--gray-11)' }} size={1}></Icon>
              </Flex>
            </Button>
          </Box>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="bottom">
          {
            self && AppData.isWalletReady() && walletAddresses.map((item, index) =>
              <DropdownMenu.Item key={item || '' + '_select'} disabled={item != null && item == ownerAddress} onClick={() => switchWallet(index)}>
                <AddressAvatar address={item || ''} size="1" style={{ width: '16px', height: '16px', filter: item != null && item == ownerAddress ? 'brightness(0.5)' : undefined }}></AddressAvatar> Use { Readability.toAddress(item || undefined, 6) }
              </DropdownMenu.Item>
            )
          }
          { self && AppData.isWalletReady() && walletAddresses.length > 0 && <DropdownMenu.Separator /> }
          {
            self &&
            <DropdownMenu.Item onClick={() => {
              if (AppData.isWalletReady()) {
                AppData.clearWallet();
              } else {
                navigate('/restore');
              }
            }}>
              <Icon path={AppData.isWalletReady() ? mdiLock : mdiLockOpen} size={0.8} />
              <Text>{ AppData.isWalletReady() ? 'Lock wallet account' : 'Unlock wallet account' }</Text>    
            </DropdownMenu.Item>
          }
          <DropdownMenu.Item onClick={() => {
            const value = !verifiedAssetsOnly;
            AppStorage.set('__verified_assets_only__', value);
            setVerifiedAssetsOnly(value);
          }}>
            <Icon path={verifiedAssetsOnly ? mdiAlertDecagram : mdiCheckDecagram } size={0.8} />
            <Text>{ verifiedAssetsOnly ? 'Show unverified assets' : 'Show verified assets' }</Text>
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => {
              navigator.clipboard.writeText(ownerAddress);
              AlertBox.open(AlertType.Info, (self ? 'Your ' : '') + ownerAddress + ' address copied!')
            }}>
            <Icon path={mdiQrcode} size={0.8} />
            <Text>Copy { self ? 'my ' : ''}address</Text>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onClick={() => navigate('/explorer')}>
            <Icon path={mdiMagnifyScan} size={0.8} />
            <Text>Search blockchain</Text>
          </DropdownMenu.Item>
          {
            AppData.platform == 'mobile' &&
            <DropdownMenu.Item onClick={() => tryPrompt()}>
              <Icon path={mdiQrcodeScan} size={0.8} />
              <Text>Approve QR action</Text>    
            </DropdownMenu.Item>
          }
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <Card mt="2" variant={mobile ? 'ghost' : 'surface'} style={mobile ? { borderRadius: '0', border: 'none', borderBottom: 'none', margin: 0, paddingBottom: '32px' } : { borderRadius: '28px' }}>
        <Flex justify={mobile ? 'center' : 'start'} gap="2" pb="1" pt={mobile ? '0' : '1'}>
          <SegmentedControl.Root value={control} radius="full" size="3" mb="2" onValueChange={(value) => setControl(value as any)}>
            <SegmentedControl.Item value="address">
              <Flex gap="2" align="center">
                { loading && control == 'address' && <Spinner /> }
                <Text size="4">Fund</Text>
              </Flex>
            </SegmentedControl.Item>
            <SegmentedControl.Item value="balance">
              <Flex gap="2" align="center">
                { loading && control == 'balance' && <Spinner /> }
                <Text size="4">Balance</Text>
              </Flex>
            </SegmentedControl.Item>
            <SegmentedControl.Item value="storage">
              <Flex gap="2" align="center">
                { loading && control == 'storage' && <Spinner /> }
                <Text size="4">Data</Text>
              </Flex>
            </SegmentedControl.Item>
          </SegmentedControl.Root>
        </Flex>
        <Tabs.Root value={control}>
          <Tabs.Content value="address">
            {
              filteredAddress != null &&
              <Box px="2" pt="4" pb="2">
                <AddressView address={filteredAddress} onExit={() => setSelectedAddress(-1)}></AddressView>
              </Box>
            }
            {
              !filteredAddress &&
              <Box px="2" py="2">
                {
                  filteredAddresses.map((item, index) =>
                    <Box key={item.hash + '_address_select'} mb={ index == filteredAddresses.length - 1 ? undefined : '4' }>
                      <Button variant="surface" color="gray" size="3" style={{ display: 'block', height: 'auto', width: '100%' }} onClick={() => {
                        if (item.addresses != null) {
                          setSelectedAddress(index);
                        } else {
                          navigate(`/explorer?view=vaults&asset=${item.asset.id}`);
                        }
                      }}>
                        <Flex gap="3" align="center" py="3">
                          <AssetImage asset={item.asset} size="2" iconSize="40px"></AssetImage>
                          <Flex justify="between" align="center" width="100%">
                            <Flex direction="column" align="start">
                              <AssetName asset={item.asset}></AssetName>
                              {
                                item.addresses != null &&
                                <Text size="1" color="gray">{ Readability.toAddress(item.addresses[0].address, 6) }{ item.addresses.length > 1 ? ' + ' + Readability.toCount('variant', item.addresses.length - 1) : '' }</Text>
                              }
                              {
                                !item.addresses &&
                                <Flex align="center" gap="1">
                                  <Icon path={mdiOpenInNew} size={0.6} color="var(--sky-11)"></Icon> 
                                  <Text size="1" color="sky">View vaults</Text>
                                </Flex>
                              }
                            </Flex>
                            {
                              item.purpose == null &&
                              <Box className="rt-reset rt-BaseButton rt-r-size-2 rt-variant-surface rt-IconButton">
                                <Icon path={mdiSourceCommitStartNextLocal} size={1}></Icon>
                              </Box>
                            }
                            {
                              item.purpose == 'bridge' && 
                              <Box className="rt-reset rt-BaseButton rt-r-size-2 rt-variant-surface rt-IconButton" data-accent-color="blue">
                                <Icon path={mdiBridge} size={1}></Icon>
                              </Box>
                            }
                            {
                              item.purpose == 'routing' && 
                              <Box className="rt-reset rt-BaseButton rt-r-size-2 rt-variant-surface rt-IconButton">
                                <Icon path={mdiSourceCommitLocal} size={1}></Icon>
                              </Box>
                            }
                            {
                              item.purpose == 'witness' && 
                              <Box className="rt-reset rt-BaseButton rt-r-size-2 rt-variant-surface rt-IconButton" data-accent-color="red">
                                <Icon path={mdiCoffin} size={1}></Icon>
                              </Box>
                            }
                          </Flex>
                        </Flex>
                      </Button>
                    </Box>
                  )
                }
              </Box>
            }
          </Tabs.Content>
          <Tabs.Content value="balance">
            {
              !assets.length &&
              <Tooltip content="Account does not have any non-zero asset balances">
                <Flex px="2" py="3" gap="3" align="center">
                  <Avatar size="3" radius="large" fallback="NA" color="gray" />
                  <Box width="100%">
                    <Flex justify="between" align="center">
                      <Text as="div" size="2" weight="light">N/A</Text>
                      <Badge size="1">0.00%</Badge>
                    </Flex>
                    <Text as="div" size="2" weight="medium">0.0</Text>
                  </Box>
                </Flex>
              </Tooltip>
            }
            { 
              assets.map((item) =>
                <Flex key={item.asset.id + '_balance'} px="2" py="3" gap="3" align="center">
                  <AssetImage asset={item.asset}></AssetImage>
                  <Box width="100%">
                    <Flex justify="between" align="center">
                      <AssetName asset={item.asset}></AssetName>
                      <Tooltip content={
                        <>
                          { typeof item.contractAddress == 'string' && <Text style={{ display: 'block' }} mb="1">Contract address: { Readability.toAddress(item.contractAddress, 8) }</Text> }
                          <Text style={{ display: 'block' }}>Locked value: { new BigNumber(item.reserve).toString() } { Readability.toAssetSymbol(item.asset) }</Text>
                          <Text style={{ display: 'block' }}>Unlocked value: { new BigNumber(item.balance).toString() } { Readability.toAssetSymbol(item.asset) }</Text>
                          <Text style={{ display: 'block' }} mt="1">Total value: { new BigNumber(item.supply).toString() } { Readability.toAssetSymbol(item.asset) }</Text>
                        </>
                        }>
                        <Badge size="1" color={item.reserve.gt(0) ? 'yellow' : undefined}>{ (Math.floor(10000 - item.reserve.dividedBy(item.supply).toNumber() * 10000) / 100).toFixed(1) }%</Badge>
                      </Tooltip>
                    </Flex>
                    <Text as="div" size="2" weight="medium">{ Readability.toMoney(item.asset, item.supply) }</Text>
                  </Box>
                </Flex>
              )
            }
            {
              self &&
              <Box mt="2">
                <Vault blockchains={blockchains} blockchain={vaultBlockchain || undefined} assets={allAssets}></Vault>
              </Box>
            }
          </Tabs.Content>
          <Tabs.Content value="storage">
            {
              program != null &&
              <Flex px="2" py="2" gap="3">
                <Icon path={mdiConsole} size={1.5} style={{ color: 'var(--bronze-10)' }} />
                <Box width="100%">
                  <Flex justify="between" align="center">
                    <Text as="div" size="2" weight="light">Smart contract</Text>
                  </Flex>
                  <Flex align="center">
                    <Button size="2" variant="ghost" color="indigo" onClick={() => {
                      navigator.clipboard.writeText(program);
                      AlertBox.open(AlertType.Info, 'Program hashcode copied!')
                    }}>{ Readability.toAddress(program) }</Button>
                    <Box ml="2">
                      <Link className="router-link" to={'/program/' + program}>▒▒</Link>
                    </Box>
                  </Flex>
                </Box>
              </Flex>
            }
            <Flex px="2" py="2" gap="3">
              <Icon path={mdiArrowRightBoldHexagonOutline} size={1.5} style={{ color: 'var(--red-10)' }} />
              <Box width="100%">
                <Flex justify="between" align="center">
                  <Text as="div" size="2" weight="light">Block production</Text>
                </Flex>
                <Badge size="1" color={production ? (production.stake != null ? undefined : 'red') : 'gray'}>PRODUCER { production ? (production.stake != null ? 'ACTIVE' : 'OFFLINE') : 'STANDBY' }{ production != null ? production.stake != null ? ' IN BLOCK ' + production.block_number.toNumber() : (' FROM BLOCK ' + production.block_number.toNumber()) : '' }</Badge>
              </Box>
            </Flex>
            {
              production && (production.stake.gte(0) || production.rewards.length > 0) &&
              <Box pl="5">
                {
                  production.stake != null && production.stake.gte(0) &&
                  <Flex pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                    <AssetImage asset={new AssetId()} size="2"></AssetImage>
                    <Box width="100%" style={{ marginLeft: '2px' }}>
                      <Tooltip content={Readability.toAssetSymbol(new AssetId()) + " rewards received by block producer"}>
                        <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(new AssetId(), production.stake) }</Text>
                      </Tooltip>
                    </Box>
                  </Flex>
                }
                {
                  production.rewards.map((item: any) => {
                    return (
                      <Flex key={item.asset.id + '_production'} pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                        <AssetImage asset={item.asset} size="2"></AssetImage>
                        <Box width="100%" style={{ marginLeft: '2px' }}>
                          <Tooltip content={Readability.toAssetSymbol(item.asset) + " fees received by block producer"}>
                            <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(item.asset, item.reward) }</Text>
                          </Tooltip>
                        </Box>
                      </Flex>
                    )
                  })
                }
              </Box>
            }
            {
              participation &&
              <>
                <Flex px="2" py="2" gap="3">
                  <Icon path={mdiCellphoneKey} size={1.5} style={{ color: 'var(--yellow-9)' }} />
                  <Box width="100%">
                    <Flex justify="between" align="center">
                      <Text as="div" size="2" weight="light">Vault participation</Text>
                    </Flex>
                    <Badge size="1" color={participation.stake != null ? undefined : 'red'}>PARTICIPANT { (participation.stake != null ? 'ACTIVE' : 'OFFLINE') }{ participation.stake != null ? ' IN BLOCK ' + participation.block_number.toNumber() : (' FROM BLOCK ' + participation.block_number.toNumber()) }</Badge>
                  </Box>
                </Flex>
                <Box pl="5">
                  {
                    participation.stake != null && participation.stake.gte(0) &&
                    <Flex pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                      <AssetImage asset={new AssetId()} size="2"></AssetImage>
                      <Box width="100%" style={{ marginLeft: '2px' }}>
                        <Tooltip content={Readability.toAssetSymbol(new AssetId()) + " stake locked by vault participation as a signer of withdrawal transactions"}>
                          <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(new AssetId(), participation.stake) }</Text>
                        </Tooltip>
                      </Box>
                    </Flex>
                  }
                  {
                    participation.rewards.map((item: any) => {
                      return (
                        <Flex key={item.asset.id + '_participation'} pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                          <AssetImage asset={item.asset} size="2"></AssetImage>
                          <Box width="100%" style={{ marginLeft: '2px' }}>
                            <Tooltip content={Readability.toAssetSymbol(item.asset) + ' fees received by vault participation as a signer of withdrawal transactions'}>
                              <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(item.asset, item.reward) }</Text>
                            </Tooltip>
                          </Box>
                        </Flex>
                      )
                    })
                  }
                </Box>
              </>
            }
            { 
              attestations.map((attestation) =>
                <Box key={attestation.asset.id + '_attestation'}>
                  <Flex px="2" py="2" gap="3">
                    <Icon path={mdiTransitConnectionVariant} size={1.5} style={{ color: 'var(--accent-11)' }} />
                    <Box width="100%">
                      <Flex justify="between" align="center">
                        <Text as="div" size="2" weight="light">Vault attestation — { Readability.toAssetName(new AssetId(attestation.asset.id)) }</Text>
                      </Flex>
                      <Badge size="1" color={attestation ? (attestation.stake != null ? undefined : 'red') : 'gray'}>ATTESTATION { attestation ? (attestation.stake != null ? 'ACTIVE' : 'OFFLINE') : 'STANDBY' }{ attestation != null ? attestation.stake != null ? ' IN BLOCK ' + attestation.block_number.toNumber() : (' FROM BLOCK ' + attestation.block_number.toNumber()) : '' }</Badge>
                    </Box>
                  </Flex>
                  <Box pl="5">
                    {
                      attestation.stake != null && attestation.stake.gte(0) &&
                      <Flex pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                        <AssetImage asset={new AssetId()} size="2"></AssetImage>
                        <Box width="100%" style={{ marginLeft: '2px' }}>
                          <Tooltip content={Readability.toAssetSymbol(new AssetId()) + " stake locked by vault attestation as a off-chain transaction notification and participant coordination"}>
                            <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(new AssetId(), attestation.stake) }</Text>
                          </Tooltip>
                        </Box>
                      </Flex>
                    }
                    {
                      attestation.rewards.map((item: any) => {
                        return (
                          <Flex key={item.asset.id + '_attestation'} pl="5" pr="2" py="2" gap="3" align="center" style={{ borderLeft: '1px solid var(--gray-8)' }}>
                            <AssetImage asset={item.asset} size="2"></AssetImage>
                            <Box width="100%" style={{ marginLeft: '2px' }}>
                              <Tooltip content={Readability.toAssetSymbol(item.asset) + ' fees received by vault attestation as a off-chain transaction notification and participant coordination'}>
                                <Text as="div" size="2" weight="medium">Staking { Readability.toMoney(item.asset, item.reward) }</Text>
                              </Tooltip>
                            </Box>
                          </Flex>
                        )
                      })
                    }
                  </Box>
                </Box>
              )
            }
          </Tabs.Content>
        </Tabs.Root>
      </Card>
      {
        transactions.length > 0 &&
        <Box width="100%" my="6" px={mobile ? '2' : undefined}>
          <InfiniteScroll dataLength={transactions.length} hasMore={moreTransactions} next={findTransactions} loader={<div></div>}>
            {
              transactions.map((item, index) => {
                const prev = index ? transactions[index - 1] : null;
                return (
                  <Box width="100%" key={item.transaction.hash + index + '_tx'}>
                    {
                      (!prev || (prev.receipt && item.receipt && new Date(prev.receipt?.block_time?.toNumber() || 0).setHours(0, 0, 0, 0) != new Date(item.receipt?.block_time?.toNumber() || 0).setHours(0, 0, 0, 0))) &&
                      <Box px="2" mt="4">
                        <Text as="div" size="2" mb="1" align="right">{ item.receipt ? (new Date(item.receipt.block_time?.toNumber()).setHours(0, 0, 0, 0) == new Date().setHours(0, 0, 0, 0) ? 'Today' : new Date(item.receipt.block_time?.toNumber()).toLocaleDateString()) : 'Today' }</Text>
                        <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                      </Box>
                    }
                    <Box mt="4">
                      <TransactionView ownerAddress={ownerAddress} transaction={item.transaction} receipt={item.receipt} state={item.state} resolveTransaction={(resolve: (tx: any) => boolean) => resolveTransactions(index, resolve)}></TransactionView>
                    </Box>
                  </Box>
                )
              })
            }
          </InfiniteScroll>
        </Box>
      }
    </Box>
  );
}