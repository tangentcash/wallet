import { Box, Button, Flex, SegmentedControl, Select, Tooltip } from "@radix-ui/themes";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData, ASSET_INFORMATION, ExtendedField } from "../core/app";
import { AssetId, Chain, Signing, Uint256 } from "tangentsdk/algorithm";
import { EventResolver, RPC, SummaryState } from "tangentsdk/rpc";
import { UiUtil } from "tangentsdk/ui";
import { Whitelist } from "tangentsdk/whitelist";
import { mdiArrowUpBoldCircleOutline, mdiCubeOutline, mdiEye, mdiEyeOff, mdiLayersOutline, mdiMagnify, mdiWeb } from "@mdi/js";
import { useEffectAsync } from "../core/react";
import { TransactionView } from "../components/transaction";
import { AssetImage } from "../components/asset-image";
import { AssetName } from "../components/asset-name";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import BigNumber from "bignumber.js";

const BLOCK_COUNT = 64;
const TRANSACTION_COUNT = 16;
const VAULT_COUNT = 16;

export default function ExplorerPage() {
  const [search, setSearch] = useSearchParams();
  const [counter, setCounter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [asset, setAsset] = useState<AssetId | null>(null);
  const [blockchains, setBlockchains] = useState<any[]>([]);
  const [tab, setTab] = useState<'blocks' | 'transactions' | 'vaults'>('blocks');
  const [blocks, setBlocks] = useState<{ blockNumber: number, blockHash: string }[]>([]);
  const [transactions, setTransactions] = useState<{ transaction: any, receipt?: any, state?: SummaryState }[]>([]);
  const [vaults, setVaults] = useState<any[]>([]);
  const [moreBlocks, setMoreBlocks] = useState(true);
  const [moreTransactions, setMoreTransactions] = useState(true);
  const [moreVaults, setMoreVaults] = useState(true);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const blockNumber = useMemo((): BigNumber | null => {
    return AppData.tip;
  }, [counter]);
  const blockchainExt = useMemo((): ExtendedField | null => {
    if (!asset)
      return null;

    const ext = ASSET_INFORMATION[asset.chain || ''];
    return ext ? ext : null;
  }, [asset]);
  const navigateToSearch = useCallback(async () => {
    if (loading || !subject.trim().length)
      return;

    setLoading(true);
    const jump = (target: string) => {
      setLoading(false);
      navigate(target);
    };
    const value = subject.trim().toLowerCase();
    const publicKeyHash = Signing.decodeAddress(value);
    if (publicKeyHash != null && publicKeyHash.data.length == 20) {
      return jump('/account/' + value);
    }
  
    const blockNumber = parseInt(value, 10);
    if (!isNaN(blockNumber) && blockNumber > 0) {
      return jump('/block/' + value);
    }

    try {
      const hash = new Uint256(value, 16);
      if (hash.toHex() != value && hash.toCompactHex() != value) {
        throw false;
      }
    } catch {
      AlertBox.open(AlertType.Error, 'Must be an address, a hash or a number');
      return setLoading(false);
    }
    
    try {
      const block = await RPC.getBlockByHash(value);
      if (block != null) {     
        return jump('/block/' + value);
      }
    } catch { }

    jump('/transaction/' + value);
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

      const offset = (refresh ? 0 : blocks.length);
      const candidateBlocks = data.map((value, index: number) => { return { blockNumber: Math.max(1, tip - offset - index), blockHash: value } });
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
  const findVaults = useCallback(async (refresh?: boolean) => {
    try {
      if (!asset)
        return null;

      let data = await RPC.getBestBridgeInstancesByBalance(new AssetId(asset.id), refresh ? 0 : vaults.length, VAULT_COUNT);
      if (!Array.isArray(data) || !data.length) {
        data = await RPC.getBestBridgeInstancesBySecurity(new AssetId(asset.id), refresh ? 0 : vaults.length, VAULT_COUNT);
      }

      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setVaults([]);
        setMoreVaults(false);
        return null;
      }

      const showQueue = search.has('queue');
      const result = refresh ? data : data.concat(vaults);
      setVaults(result.map((x) => {
        const balance: BigNumber | null = x.balances.find((v: any) => v.asset.id == asset.id)?.supply || null;
        x.sendable = balance ? balance.gte(x.instance.fee_rate) : false;
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
        x.queue = x.queue.sort((a: any, b: any) => new BigNumber(a.index).minus(b.index).toNumber());
        x.showQueue = showQueue;
        return x;
      }));
      setMoreVaults(data.length >= VAULT_COUNT);
      return result;
    } catch {
      if (refresh)
        setVaults([]);
      setMoreVaults(false);
      return null;
    }
  }, [asset, vaults, search]);
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
      case 'vaults': {
        if (asset != null) {
          await findVaults(true);
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
  useEffect(() => {
    const view = search.get('view');
    if (view != null && ['blocks', 'transactions', 'vaults'].includes(view)) {
      setTab(view as any);
    }

    const id = search.get('asset');
    if (id != null) {
      setAsset(new AssetId(id));
    }
  }, [search]);

  return (
    <Box pt="4" pb="8" maxWidth="680px" mx="auto">
      <div className="page-head">
        <div className="page-title">Explorer</div>
      </div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
        <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, background: 'var(--lime-dim)', display: 'grid', placeItems: 'center' }}>
          <Icon path={mdiLayersOutline} size={1.2} style={{ color: 'var(--lime)' }}></Icon>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>Height { UiUtil.toValue(null, blockNumber, false, false) }</div>
          <div className="tiny dim">live chain state</div>
        </div>
        <span className="badge ok">LIVE</span>
      </div>
      <form action="" onSubmit={(e) => { e.preventDefault(); navigateToSearch(); }}>
        <div className="search" style={{ height: 52, marginTop: 14 }}>
          <Icon path={mdiMagnify} size={1}></Icon>
          <input className="mono" placeholder="Address, hash or block" value={subject} onChange={(e) => setSubject(e.target.value)} readOnly={loading} ref={searchInput} onKeyDown={(e) => {
            if (e.key == 'Enter') {
              e.preventDefault();
              navigateToSearch();
            }
          }}></input>
        </div>
      </form>
      <SegmentedControl.Root value={ tab } radius="full" size="3" my="4" onValueChange={(v) => setSearch({ view: v })}>
        <SegmentedControl.Item value="blocks">Blocks</SegmentedControl.Item>
        <SegmentedControl.Item value="transactions">Transactions</SegmentedControl.Item>
        <SegmentedControl.Item value="vaults">Vaults</SegmentedControl.Item>
      </SegmentedControl.Root>
      {
        tab == 'blocks' &&
        <InfiniteScroll dataLength={blocks.length} hasMore={moreBlocks} next={findBlocks} loader={<div></div>}>
          {
            blocks.length > 0 ?
            <div className="card rows">
              {
                blocks.map((item, index) =>
                  <Link key={item.blockHash + index + '_block'} to={'/block/' + item.blockNumber} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
                    <div className="tx-row">
                      <span className="tx-ico"><Icon path={mdiCubeOutline} size={1} style={{ color: index == 0 ? 'var(--lime)' : undefined }}></Icon></span>
                      <div className="tx-main">
                        <div className="tx-title num" style={{ fontWeight: 750, fontSize: 15.5 }}>Block #{ UiUtil.toValue(null, item.blockNumber, false, false) }</div>
                        <div className="tx-meta mono" style={{ fontSize: 11 }}>{ UiUtil.toAddress(item.blockHash) }</div>
                      </div>
                      <div className="tx-time">{ index == 0 ? <span className="badge ok">HEAD</span> : <span className="badge ok">FINALIZED</span> }</div>
                    </div>
                  </Link>
                )
              }
            </div> :
            <div className="card empty">
              <div className="art"><Icon path={mdiCubeOutline} size={1.6}></Icon></div>
              <h4>No blocks yet</h4>
              <p>The chain tip hasn't produced anything yet.</p>
            </div>
          }
        </InfiniteScroll>
      }
      {
        tab == 'transactions' &&
        <InfiniteScroll dataLength={transactions.length} hasMore={moreTransactions} next={findTransactions} loader={<div></div>}>
          {
            transactions.length > 0 ?
            <div className="card rows">
              {
                transactions.map((item, index) =>
                  <TransactionView key={item.transaction.hash + index + '_tx'} variant="row" ownerAddress="" transaction={item.transaction} receipt={item.receipt} state={item.state} explorerMode={true}></TransactionView>
                )
              }
            </div> :
            <div className="card empty">
              <div className="art"><Icon path={mdiArrowUpBoldCircleOutline} size={1.6}></Icon></div>
              <h4>No transactions yet</h4>
              <p>Nothing has moved on this chain.</p>
            </div>
          }
        </InfiniteScroll>
      }
      {
        tab == 'vaults' &&
        <>
          <Box mb="4">
            <Select.Root size="3" value={asset ? asset.id : '!'} onValueChange={(e) => setAsset(e.length > 0 && e != '!' ? new AssetId(e) : null)}>
              <Select.Trigger style={{ width: '100%' }} placeholder="Select network" />
              <Select.Content>
                <Select.Item value="!">Select network</Select.Item>
                {
                  blockchains.map((item) =>
                    <Select.Item value={item.id} key={item.id}>
                      <Flex gap="2" align="center">
                        <AssetImage asset={item} size="1"></AssetImage>
                        <AssetName asset={item} size="3" badge={false}></AssetName>
                      </Flex>
                    </Select.Item>
                  )
                }
              </Select.Content>
            </Select.Root>
          </Box>
          {
            !asset &&
            <div className="card empty">
              <div className="art"><Icon path={mdiWeb} size={1.6}></Icon></div>
              <h4>Select a network</h4>
              <p>Choose an external chain to inspect its bridge vault and minting queue.</p>
            </div>
          }
          {
            asset &&
            <InfiniteScroll dataLength={vaults.length} hasMore={moreVaults} next={findVaults} loader={<div></div>}>
              {
                vaults.map((item, index) =>
                  <div className="card" style={{ marginTop: index > 0 ? 14 : 0 }} key={item.instance.hash + index}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <AssetImage asset={item.instance.asset || { chain: asset.chain }} iconSize="28px"></AssetImage>
                      <div style={{ fontWeight: 750, fontSize: 15 }}>Vault { UiUtil.toHash(item.instance.bridge_hash, 4) }</div>
                    </div>
                    <div className="dl">
                      <div className="dl-row">
                        <span className="dl-k">Vault hash</span>
                        <span className="dl-v copyable" onClick={() => {
                          navigator.clipboard.writeText(item.instance.bridge_hash);
                          AlertBox.open(AlertType.Info, 'Vault hash copied!');
                        }}>{ UiUtil.toAddress(item.instance.bridge_hash) }</span>
                      </div>
                      {
                        item.master != null && item.master.addresses &&
                        <div className="dl-row">
                          <span className="dl-k">Vault address</span>
                          <span className="dl-v copyable" onClick={() => {
                            navigator.clipboard.writeText(item.master.addresses[0]);
                            AlertBox.open(AlertType.Info, 'Address copied!');
                          }}>{ UiUtil.toAddress(item.master.addresses[0]) }</span>
                        </div>
                      }
                      <div className="dl-row">
                        <span className="dl-k">Public params</span>
                        <span className="dl-v" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <Tooltip content={'Participants (signers) to involve in each created account but no less than ' + Chain.policy.PARTICIPATION_COMMITTEE[0] + ' and no more than ' + Chain.policy.PARTICIPATION_COMMITTEE[1] + ' per account, txn/account nonces and the redeem fee to be deduced from each outgoing tx to cover cross-chain network fees and to pay to vault attesters and participants'}>
                            <span className="badge flat">{ UiUtil.toCount('signer', item.instance.security_level) }</span>
                          </Tooltip>
                          <span className="badge flat">{ UiUtil.toCount('txn', item.instance.transaction_nonce) }</span>
                          <span className="badge flat">{ UiUtil.toCount(new BigNumber(item.instance.account_nonce).gt(1) ? 'addresse' : 'address', item.instance.account_nonce) }</span>
                          <span className="badge flat">{ UiUtil.toMoney(new AssetId(asset.id), item.instance.fee_rate) } fee</span>
                        </span>
                      </div>
                      <div className="dl-row" style={{ alignItems: 'center' }}>
                        <span className="dl-k">In queue</span>
                        <span className="dl-v" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button className="chip-quiet sm" onClick={() => {
                            let copy = [...vaults];
                            copy[index].showQueue = !copy[index].showQueue;
                            setVaults(copy);
                          }}>
                            <Icon path={item.showQueue ? mdiEye : mdiEyeOff} size={1}></Icon>{ ' ' + (Array.isArray(item.queue) ? item.queue.length : 0) + ' TRANSACTIONS' }
                          </button>
                        </span>
                      </div>
                      <div className="dl-row">
                        <span className="dl-k">Asset TVL</span>
                        <span className="dl-v" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {
                            item.balances && item.balances.map((next: any) =>
                              <Tooltip key={item.instance.hash + index + next.asset.id} content={next.whitelist ? 'Whitelisted asset' : 'Non-whitelisted asset'}>
                                <span className={'badge ' + (next.whitelist ? 'ok' : 'flat')}>{ UiUtil.toMoney(next.asset, next.supply) }</span>
                              </Tooltip>)
                          }
                          {
                            (!item.balances || !item.balances.length) &&
                            <span className="badge warn">{ UiUtil.toMoney(asset, null) }</span>
                          }
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <Tooltip content="Claim an address and/or sender address">
                        <Button className="btn-brand btn-block" onClick={() => {
                          navigate(`/interaction?asset=${asset.id}&type=register&vault=${item.instance.bridge_hash}&back=${encodeURIComponent(location.pathname + location.search)}`);
                        }}>↙ Mint tokens</Button>
                      </Tooltip>
                      <Tooltip content={(item.sendable ? 'Vault has enough ' : 'Vault doesn\'t have enough ') + UiUtil.toAssetSymbol(asset) + ' to send a transaction'}>
                        <Button className="btn-ghost btn-block" disabled={!item.sendable} onClick={() => {
                          if (item.sendable) {
                            navigate(`/interaction?asset=${asset.id}&type=withdraw&vault=${item.instance.bridge_hash}&fee=${item.instance.fee_rate.toString()}&back=${encodeURIComponent(location.pathname + location.search)}`);
                          }
                        }}>↗ Redeem tokens</Button>
                      </Tooltip>
                    </div>
                    {
                      item.showQueue &&
                      <>
                        <div className="dl" style={{ marginTop: 6 }}>
                          {
                            Array.isArray(item.queue) && item.queue.map((tx: any, queueIndex: number) =>
                              <div className="dl-row" key={tx.hash.toString()}>
                                <span className="dl-k">
                                  { blockchainExt != null ? <span className="badge warn">in { (blockchainExt.blocking ? blockchainExt.transactionTime * (queueIndex + 1) + '-' + (blockchainExt.transactionTime * (queueIndex + 1) + 5).toString() : 5 * (queueIndex + 1)) } min</span> : <span className="badge flat">P{UiUtil.toValue(null, queueIndex + 1, false, false)}</span> }
                                </span>
                                <Link className="dl-v mono router-link" style={{ color: 'var(--info)', fontSize: 12 }} to={'/transaction/' + tx.transaction_hash}>{ UiUtil.toAddress(tx.transaction_hash) }</Link>
                              </div>
                            )
                          }
                          {
                            !(Array.isArray(item.queue) && item.queue.length > 0) &&
                            <div className="tiny dim" style={{ padding: '8px 0', textAlign: 'center' }}>Queue is empty — redemptions are processed immediately.</div>
                          }
                        </div>
                        <div className="tiny dim" style={{ textAlign: 'center', marginTop: 10 }}>
                          Max outgoing ETA: <span className="num" style={{ color: blockchainExt ? (blockchainExt.blocking ? 'var(--warn)' : 'var(--lime)') : undefined }}>
                            { blockchainExt ? (blockchainExt.blocking ? (blockchainExt.transactionTime * (2 + item.queue?.length || 0) + '-' + (blockchainExt.transactionTime * (2 + item.queue?.length || 0) + 5)) : (5 * ((item.queue?.length || 0) + 1))) + ' min.' : 'unknown' }
                          </span>
                        </div>
                      </>
                    }
                  </div>
                )
              }
              {
                vaults.length == 0 &&
                <div className="card empty">
                  <div className="art"><Icon path={mdiWeb} size={1.6}></Icon></div>
                  <h4>No vaults found</h4>
                  <p>This network has no active bridge vault yet.</p>
                </div>
              }
            </InfiniteScroll>
          }
        </>
      }
    </Box>
  );
}