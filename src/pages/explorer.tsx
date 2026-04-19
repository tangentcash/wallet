import { Badge, Box, Button, Card, DataList, DropdownMenu, Flex, Heading, Select, Tabs, TextField, Tooltip } from "@radix-ui/themes";
import { Link, useNavigate } from "react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData } from "../core/app";
import { AssetId, Chain, EventResolver, Readability, RPC, Signing, Stream, SummaryState, Whitelist } from "tangentsdk";
import { mdiMagnify, mdiOpenInNew } from "@mdi/js";
import { useEffectAsync } from "../core/react";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import Transaction from "../components/transaction";
import { AssetImage, AssetName } from "../components/asset";

const BLOCK_COUNT = 64;
const TRANSACTION_COUNT = 16;
const BRIDGE_COUNT = 16;

export default function ExplorerPage() {
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [counter, setCounter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [asset, setAsset] = useState<AssetId | null>(null);
  const [blockchains, setBlockchains] = useState<any[]>([]);
  const [tab, setTab] = useState<'blocks' | 'transactions' | 'bridges'>('blocks');
  const [blocks, setBlocks] = useState<{ blockNumber: number, blockHash: string }[]>([]);
  const [transactions, setTransactions] = useState<{ transaction: any, receipt?: any, state?: SummaryState }[]>([]);
  const [bridges, setBridges] = useState<any[]>([]);
  const [moreBlocks, setMoreBlocks] = useState(true);
  const [moreTransactions, setMoreTransactions] = useState(true);
  const [moreBridges, setMoreBridges] = useState(true);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const blockNumber = useMemo((): BigNumber | null => {
    return AppData.tip;
  }, [counter]);
  const search = useCallback(async (mode: 'block' | 'transaction' | false) => {
    if (loading)
      return;

    setLoading(true);
    const jump = (target: string) => {
      setLoading(false);
      navigate(target);
    };
    const value = subject.trim();
    const publicKeyHash = Signing.decodeAddress(value);
    if (publicKeyHash != null && publicKeyHash.data.length == 20) {
      jump('/account/' + value);
      return;
    }
    
    if (!mode || mode == 'block') {
      const blockNumber = parseInt(value, 10);
      if (!isNaN(blockNumber) && blockNumber > 0) {
        try {
          const block = await RPC.getBlockByNumber(blockNumber);
          if (block != null) {
            jump('/block/' + value);
            return;
          }
        } catch { }
      }
    }

    if (!mode || mode == 'transaction') {
      try {
        const transaction = await RPC.getTransactionByHash(value);
        if (transaction != null) {
          jump('/transaction/' + value);
          return;
        }
      } catch { }

      try {
        const aliasTransaction = await RPC.getTransactionByHash(new Stream().writeString(value).hash().toHex());
        if (aliasTransaction != null) {
          jump('/transaction/' + value);
          return;
        }
      } catch { }

      try {
        const mempoolTransaction = await RPC.getMempoolTransactionByHash(value);
        if (mempoolTransaction != null) {
          jump('/transaction/' + value);
          return;
        }
      } catch { }

      if (mode) {
        jump('/transaction/' + value);
        return;
      }
    }

    if (!mode || mode == 'block') {
      try {
        const block = await RPC.getBlockByHash(value);
        if (block != null) {
          jump('/block/' + value);
          return;
        }
      } catch { }

      if (mode) {
        jump('/block/' + value);
        return;
      }
    }

    AlertBox.open(AlertType.Error, 'Nothing found');
    setLoading(false);
  }, [subject, loading]);
  const findBlocks = useCallback(async (refresh?: boolean) => {
    const tip = AppData.tip?.toNumber() || 0;
    try {
      const data = await RPC.getBlocks(Math.max(1, tip - (refresh ? BLOCK_COUNT : blocks.length)), BLOCK_COUNT);
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setBlocks([]);
        setMoreBlocks(false);
        return false;
      }

      const candidateBlocks = data.map((value, index: number) => { return { blockNumber: tip - index, blockHash: value } });
      setBlocks(refresh ? candidateBlocks : prev => prev.concat(candidateBlocks));
      setMoreBlocks(candidateBlocks.length >= BLOCK_COUNT);
      return candidateBlocks.length > 0;
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch blocks: ' + (exception as Error).message);
      if (refresh)
        setBlocks([]);
      setMoreBlocks(false);
      return false;
    }
  }, [blocks, blockNumber]);
  const findTransactions = useCallback(async (refresh?: boolean) => {
    try {
      const data = await RPC.getFinalizedTransactions(refresh ? 0 : transactions.length, TRANSACTION_COUNT, 2);
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setTransactions([]);
        setMoreTransactions(false);
        return false;
      }

      const candidateTransactions = data.map((value) => { return { ...value, state: EventResolver.calculateSummaryState(value?.receipt?.events) } });
      setTransactions(refresh ? candidateTransactions : prev => prev.concat(candidateTransactions));
      setMoreTransactions(candidateTransactions.length >= TRANSACTION_COUNT);
      return candidateTransactions.length > 0;
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch transactions: ' + (exception as Error).message);
      if (refresh)
        setTransactions([]);
      setMoreTransactions(false);
      return false;
    }
  }, [transactions]);
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
      setMoreBridges(data.length >= BRIDGE_COUNT);
      return result;
    } catch {
      if (refresh)
        setBridges([]);
      setMoreBridges(false);
      return null;
    }
  }, [asset, bridges]);
  useEffectAsync(async () => {
    await AppData.sync();
    switch (tab) {
      case 'blocks': {
        await findBlocks(true);
        break;
      }
      case 'transactions': {
        await findTransactions(true);
        break;
      }
      case 'bridges': {
        if (asset != null) {
          await findBridges(true);
        }
        break;
      }
      default:
        break;
    }
    setCounter(new Date().getTime());
  }, [tab, asset]);
  useEffectAsync(async () => {
    const blockchainData = await RPC.getBlockchains();
    if (Array.isArray(blockchainData))
      setBlockchains(blockchainData.sort((a, b) => new AssetId(a.id).handle.localeCompare(new AssetId(b.id).handle)));   
  }, []);

  return (
    <Box px="4" pt="4" maxWidth="680px" mx="auto">
      <Box px="1" py="2">
        <Flex justify="center" align="center" mb="3">
          <Button size="4" variant="ghost" onClick={() => {
            setSubject(blockNumber?.toString() || '');
          }}>Height { Readability.toValue(null, blockNumber, false, false) }</Button>
        </Flex>
        <TextField.Root style={{ width: '100%' }} placeholder="Address, hash or number…" size="3" variant="soft" value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={loading} ref={searchInput}>
          <TextField.Slot>
            <Icon path={mdiMagnify} size={0.9} color="var(--accent-8)"/>
          </TextField.Slot>
        </TextField.Root>
      </Box>
      {
        subject.trim().length > 0 &&
        <Flex px="2" gap="1" mt="4" wrap="wrap">   
          <Button size="2" variant="soft" disabled={loading} onClick={() => search(false)}>In anything</Button>
          <Button size="2" variant="soft" disabled={loading} onClick={() => search('transaction')}>In transaction</Button>
          <Button size="2" variant="soft" disabled={loading} onClick={() => search('block')}>In block</Button>
        </Flex>
      }
      <Tabs.Root mt="4" value={tab} onValueChange={(e) => setTab(e as any)}>
        <Tabs.List>
          <Tabs.Trigger value="blocks">Blocks</Tabs.Trigger>
          <Tabs.Trigger value="transactions">Transactions</Tabs.Trigger>
          <Tabs.Trigger value="bridges">Bridges</Tabs.Trigger>
        </Tabs.List>
        <Box pt="3">
          <Tabs.Content value="blocks">
            <InfiniteScroll dataLength={blocks.length} hasMore={moreBlocks} next={findBlocks} loader={<div></div>}>
              {
                blocks.map((item, index) =>
                  <Box width="100%" key={item.blockHash + index + '_block'}>
                    <Card variant="surface" mt="4" style={{ borderRadius: '22px', position: 'relative' }}>
                      <Flex gap="2" wrap="wrap" justify="between">
                        <Badge size="3">H { Readability.toValue(null, item.blockNumber, false, false) }</Badge>
                        <Flex gap="2" align="center">
                          <Badge size="3">{ Readability.toHash(item.blockHash, 8) }</Badge>
                          <Link className="router-link" to={'/block/' + item.blockNumber}>▒▒</Link>
                        </Flex>
                      </Flex>
                    </Card>
                  </Box>
                )
              }
            </InfiniteScroll>
          </Tabs.Content>
          <Tabs.Content value="transactions">
            <InfiniteScroll dataLength={transactions.length} hasMore={moreTransactions} next={findTransactions} loader={<div></div>}>
              {
                transactions.map((item, index) =>
                  <Box width="100%" key={item.transaction.hash + index + '_tx'}>
                    <Box mb="4">
                      <Transaction ownerAddress={''} transaction={item.transaction} receipt={item.receipt} state={item.state}></Transaction>
                    </Box>
                  </Box>
                )
              }
            </InfiniteScroll>
          </Tabs.Content>
          <Tabs.Content value="bridges">
            <Box my="4">
              <Select.Root size="3" value={asset ? asset.id : '!'} onValueChange={(e) => setAsset(e.length > 0 ? new AssetId(e) : null)}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>
                  <Select.Item value="!">Select network</Select.Item>
                  {
                    blockchains.map((item) =>
                      <Select.Item value={item.id} key={item.id}>
                        <Flex gap="2">
                          <AssetImage asset={item} size="1"></AssetImage>
                          <AssetName asset={item} size="3"></AssetName>
                        </Flex>
                      </Select.Item>
                    )
                  }
                </Select.Content>
              </Select.Root>
            </Box>
            {
              asset &&
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
                                  <Button size="2" variant="soft" color="yellow" className={index == 0 ? 'shadow-rainbow-animation' : undefined}>Mint/redeem <Icon path={mdiOpenInNew} size={0.6}></Icon></Button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content side="left">
                                  <Tooltip content="Claim a deposit address and/or sender address">
                                    <DropdownMenu.Item shortcut="↙" onClick={() => navigate(`/interaction?asset=${asset.id}&type=register&bridge=${item.instance.bridge_hash}&back=${encodeURIComponent(location.pathname + location.search)}`)}>Mint tokens</DropdownMenu.Item>
                                  </Tooltip>
                                  <Tooltip content={(item.withdrawable ? 'Bridge has enough ' : 'Bridge doesn\'t have enough ') + Readability.toAssetSymbol(asset) + ' for a withdrawal'}>
                                    <DropdownMenu.Item shortcut="↗" disabled={!item.withdrawable} onClick={() => {
                                      if (item.withdrawable)
                                        navigate(`/interaction?asset=${asset.id}&type=withdraw&bridge=${item.instance.bridge_hash}&fee=${item.instance.fee_rate.toString()}&back=${encodeURIComponent(location.pathname + location.search)}`);
                                    }}>Reedem tokens</DropdownMenu.Item>
                                  </Tooltip>
                                </DropdownMenu.Content>
                              </DropdownMenu.Root>
                          </Flex>
                          <DataList.Root orientation={orientation}>
                            {
                              item.master != null && item.master.addresses &&
                              <DataList.Item>
                                <DataList.Label>Bridge address:</DataList.Label>
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
                              <DataList.Label>Bridge hash:</DataList.Label>
                              <DataList.Value>
                                <Button size="2" variant="ghost" color="indigo" onClick={() => {
                                  navigator.clipboard.writeText(item.instance.bridge_hash);
                                  AlertBox.open(AlertType.Info, 'Bridge hash copied!')
                                }}>{ Readability.toAddress(item.instance.bridge_hash) }</Button>
                              </DataList.Value>
                            </DataList.Item>
                            <Tooltip content={'Participants to involve in each created account but no less than ' + Chain.policy.PARTICIPATION_COMMITTEE[0] + ' and no more than ' + Chain.policy.PARTICIPATION_COMMITTEE[1] + ' per account, txn/account nonces'}>
                              <DataList.Item>
                                <DataList.Label>Public params:</DataList.Label>
                                <DataList.Value>
                                  <Flex gap="1" wrap="wrap">
                                    <Badge size="1" color="lime">{ Readability.toCount('participant', item.instance.security_level) }</Badge>
                                    <Badge size="1" color="blue">{ Readability.toCount('txn', item.instance.transaction_nonce) }</Badge>
                                    <Badge size="1" color="blue">{ Readability.toCount('account', item.instance.account_nonce) }</Badge>
                                  </Flex>
                                </DataList.Value>
                              </DataList.Item>
                            </Tooltip>
                            <Tooltip content="This amount of fee will be deduced from each withdrawal to cover off-chain network fees and to pay to bridge attesters and participants">
                              <DataList.Item>
                                <DataList.Label>Redeem fee:</DataList.Label>
                                <DataList.Value>{ Readability.toMoney(new AssetId(asset.id), item.instance.fee_rate) }</DataList.Value>
                              </DataList.Item>
                            </Tooltip>
                            <Tooltip content="Unspent balance of a bridge usable as withdrawal liquidity">
                              <DataList.Item>
                                <DataList.Label>Asset TVL:</DataList.Label>
                                <DataList.Value>
                                  <Flex wrap="wrap" gap="1">
                                    {
                                      item.balances && item.balances.map((next: any) =>
                                        <Badge key={item.instance.hash + index + next.asset.id} size="1" color={next.whitelist ? 'jade' : 'gray'}>{ Readability.toMoney(next.asset, next.supply) }</Badge>)
                                    }
                                    {
                                      (!item.balances || !item.balances.length) &&
                                      <Badge size="1" color="yellow">{ Readability.toMoney(asset, null) }</Badge>
                                    }
                                  </Flex>
                                </DataList.Value>
                              </DataList.Item>
                            </Tooltip>
                          </DataList.Root>
                        </Box>
                      </Card>
                    </Box>
                  )
                }
              </InfiniteScroll>
            }
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
}