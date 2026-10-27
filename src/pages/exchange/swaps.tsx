import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AssetId, ByteUtil, Chain, Hashing, Seckey, Signing, Uint256 } from 'tangentsdk/algorithm';
import { Stream, Viewable } from 'tangentsdk/serialization';
import { RPC } from 'tangentsdk/rpc';
import { UiUtil } from 'tangentsdk/ui';
import { mdiAlertCircleOutline, mdiArrowRight, mdiCheck, mdiCheckDecagram, mdiClockOutline, mdiCloudUpload, mdiCog, mdiContentCopy, mdiContactlessPayment, mdiHistory, mdiLockOutline, mdiOpenInNew, mdiPlus, mdiProgressDownload, mdiStarFourPoints, mdiSwapVertical } from '@mdi/js';
import { Button, Dialog, Select, Text } from '@radix-ui/themes';
import { AlertBox, AlertType } from '../../components/alert';
import { Booking, SwapPreview, SwapLeg, Exchange } from '../../core/exchange';
import { BigStorage } from '../../core/storage';
import { AppData } from '../../core/app';
import { useEffectAsync } from '../../core/react';
import { toFancyMoney } from '../../core/utils';
import { addressToMemo, type WcAsset, type WcContext } from '../../components/wc/types';
import { AssetImage } from '../../components/asset-image';
import { Whitelist } from 'tangentsdk/whitelist';
import BigNumber from 'bignumber.js';
import QRCode from 'react-qr-code';
import AssetSelector from '../../components/exchange/selector';
import Icon from '@mdi/react';
import InfiniteScroll from 'react-infinite-scroll-component';
import './swaps.css';

const WcAdapter = lazy(() => import('../../components/wc/adapter'));
const chainRoutingPolicies: Record<string, string> = {};
const STEPPER_NODES = ['Booked', 'Deposited', 'Executed'];
const HISTORY_PAGE_SIZE = 32;
const HISTORY_PULSE = ['awaiting_deposit', 'finalizing_deposit', 'awaiting_execution', 'awaiting_withdrawal', 'finalizing_withdrawal', 'failing_withdrawal'];
const STATUS_STEPS: Record<string, { step: number, tone: 'progress' | 'success' | 'danger' | 'muted', label: string }> = {
  awaiting_deposit: { step: 1, tone: 'progress', label: 'Booked' },
  finalizing_deposit: { step: 1, tone: 'progress', label: 'Payment seen' },
  awaiting_execution: { step: 2, tone: 'progress', label: 'Deposited' },
  awaiting_withdrawal: { step: 3, tone: 'progress', label: 'Swapped' },
  finalizing_withdrawal: { step: 3, tone: 'progress', label: 'Withdrawing' },
  failing_withdrawal: { step: 3, tone: 'danger', label: 'Withdrawal failed' },
  finalized: { step: 3, tone: 'success', label: 'Done' },
  expired: { step: -1, tone: 'muted', label: 'Expired' },
  lost: { step: -1, tone: 'danger', label: 'Lost on-chain' }
};

type SigningContext = {
  contract: string;
  asset: string;
  amount: string;
  seckey: string;
  bridgeHash: string;
  routingAddress: string;
  tokenPath: SwapLeg[];
  feePath: SwapLeg[];
};

type Bridge = {
  hash: string,
  name: string,
  chain: string,
  feeRate: BigNumber,
  simulated: boolean
};

function netAfterFee(gross: string | null, feeLegs: SwapLeg[], feeRate: BigNumber | string | null | undefined, worst: boolean = false): BigNumber | null {
  if (gross == null)
    return null;
  const first = feeLegs[0];
  const feeCost = first != null ? (first.buying ? new BigNumber(first.amount).times(first.price).times(worst ? new BigNumber(first.slippage || '0').plus(1) : 1) : new BigNumber(first.amount).div(new BigNumber(first.price).times(worst ? new BigNumber(1).minus(first.slippage || '0') : 1))) : new BigNumber(feeRate ?? 0);
  const net = new BigNumber(gross).minus(feeCost);
  return net.gt(0) ? net : new BigNumber(0);
}

type DepositDestination =
  | { mode: 'address', to: string, chain: string | null, vault: boolean }
  | { mode: 'wc', network: WcAsset, to: string, memo: string, chain: string }
  | { mode: 'manual', to: string, memo: string, chain: string }
  | { mode: 'notice', text: string };

class AmsKeyring {
  private static readonly storageKey = 'ams.keys';

  private static async load(): Promise<Record<string, SigningContext>> {
    const stored = await BigStorage.get(AmsKeyring.storageKey);
    return stored != null && typeof stored == 'object' && !Array.isArray(stored) ? stored : {};
  }
  static async get(handle: string): Promise<SigningContext | null> {
    return (await AmsKeyring.load())[handle] ?? null;
  }
  static async save(context: SigningContext): Promise<void> {
    const stored = await AmsKeyring.load();
    stored[bookingHandle(context.asset, context.amount)] = context;
    await BigStorage.set(AmsKeyring.storageKey, stored);
  }
  static async publicKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (const context of Object.values(await AmsKeyring.load())) {
      try {
        keys.push(ByteUtil.uint8ArrayToHexString(Signing.derivePublicKey(new Seckey(context.seckey)).data).toLowerCase());
      } catch { }
    }

    return keys;
  }
}

function bookingHandle(asset: string, amount: string): string {
  try {
    return `${asset.toLowerCase()}|${new BigNumber(amount).toString()}`;
  } catch {
    return `${asset}|${amount}`;
  }
}
function contextMatches(context: SigningContext, publicKey: string | null | undefined): boolean {
  try {
    return publicKey != null && ByteUtil.uint8ArrayToHexString(Signing.derivePublicKey(new Seckey(context.seckey)).data).toLowerCase() == publicKey.toLowerCase();
  } catch {
    return false;
  }
}
function bookingQuery(asset: string, amount: string): string {
  const query = new Stream();
  query.writeInteger(new AssetId(asset).toUint256());
  query.writeDecimal(new BigNumber(amount));
  return query.encode();
}
function hashRef(hash: string | null): any {
  if (hash == null)
    return <span className="dim mono">—</span>;

  return <>
    <span className="copyable" title={hash} onClick={() => { navigator.clipboard.writeText(hash); AlertBox.open(AlertType.Info, 'Transaction hash copied!') }}>{UiUtil.toAddress(hash)}</span>
    <a className="dl-open" href={'/transaction/' + hash} target="_blank" rel="noreferrer"><Icon path={mdiOpenInNew} size={0.6}></Icon></a>
  </>;
}
function writeAddress(message: Stream, address: string): void {
  const decoded = Signing.decodeAddress(address);
  if (!decoded)
    throw new Error('invalid address: ' + address);

  message.writeBinaryStringOptimized(decoded.data);
}
function signMessage(message: Uint8Array, seckeyHex: string): string {
  const signature = Signing.sign(new Uint256(Hashing.hash256(message)), new Seckey(seckeyHex));
  if (!signature)
    throw new Error('Failed to sign the message');

  return ByteUtil.uint8ArrayToHexString(signature.data).toLowerCase();
}
function assetIdOf(value: any): string {
  return typeof value == 'object' && value != null ? String(value.id) : String(value);
}
function symbolOf(assetId: string | null | undefined): string {
  if (assetId == null || assetId.length < 1)
    return '?';

  try {
    const asset = new AssetId(assetId);
    return asset.token || asset.chain || asset.id;
  } catch {
    return assetId.substring(0, 6);
  }
}
function useEquity(): string {
  const [equity, setEquity] = useState(Exchange.equityAsset.chain || 'USD');
  useEffect(() => {
    const update = () => setEquity(Exchange.equityAsset.chain || 'USD');

    window.addEventListener('ams:display-asset', update);
    return () => window.removeEventListener('ams:display-asset', update);
  }, []);

  return equity;
}
function fiatValue(equity: string, assetId: string | null | undefined, amount: string | BigNumber | null | undefined): string | null {
  if (assetId == null || amount == null)
    return null;

  try {
    const price = Exchange.priceOf(new AssetId(assetId)).close;
    if (price == null || !price.gt(0))
      return null;

    const value = new BigNumber(amount).times(price);
    return value.isFinite() ? equity + ' ' + value.toFormat(2) : null;
  } catch {
    return null;
  }
}
function baseOfAsset(assetId: string): string | null {
  try {
    const asset = new AssetId(assetId);
    return AssetId.fromHandle(asset.chain != null && asset.chain.length > 0 ? asset.chain : Chain.policy.TOKEN_NAME).id;
  } catch {
    return null;
  }
}
function routingError(chain: string | null | undefined, value: string): string | null {
  const address = value.trim();
  if (address.length < 1)
    return null;

  switch ((chain ?? '').toUpperCase()) {
    case 'BTC':
      if (/^(bcrt1|tb1|bc1)[a-z0-9]{14,90}$/.test(address) || /^[13mn][a-km-zA-HJ-NP-Z1-9]{25,41}$/.test(address))
        return null;

      return 'not a valid BTC address (bech32 bc1…/tb1…/bcrt1… or legacy)';
    case 'ETH':
      if (/^0x[0-9a-fA-F]{40}$/.test(address))
        return null;

      return 'not a valid ETH address (0x followed by 40 hex characters)';
    case 'TRON': case 'TRX':
      if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address))
        return null;

      return 'not a valid TRON address (T followed by 33 base58 characters)';
    default:
      return null;
  }
}
function receiverPlaceholder(chain: string | null | undefined): string {
  return chain != null && chain.length > 0 ? `${chain} receiver address` : 'receiver address';
}
function stepDot(reached: boolean, current: boolean, failed: boolean): string {
  if (reached && !(current && failed))
    return '✓';
  if (current && failed)
    return '!';
  return '';
}
async function unifiedSymbolOf(assetId: string): Promise<string> {
  try {
    const polys = await Exchange.marketAssets(new AssetId(assetId));
    const match = polys.find((poly) => poly.id.toLowerCase() == assetId.toLowerCase());
    return match?.token ?? '';
  } catch {
    return '';
  }
}
async function quoteSwapPath(inAsset: string, outAsset: AssetId, amountIn: string, slippage: string): Promise<{ legs: SwapLeg[], received: string | null }> {
  const fraction = new BigNumber(slippage || '0').div(100).toFixed();
  const paths = await Exchange.marketPathsDirect(inAsset, outAsset.id, amountIn, fraction);
  const best = Array.isArray(paths) && paths.length > 0 ? paths[0] : null;
  if (best == null)
    return { legs: [], received: null };

  const legs: SwapLeg[] = (best as any[]).map((leg: any) => {
    const buying = Number(leg.side) == 0;
    const received = leg.pair?.[buying ? 'primaryAsset' : 'secondaryAsset']?.hash?.id ?? '';
    const paid = new BigNumber(leg.input?.max ?? 0);
    const expected = new BigNumber(leg.output?.max ?? leg.output?.min ?? 0);
    const floor = new BigNumber(leg.output?.min ?? leg.output?.max ?? 0);
    let price: string;
    if (buying)
      price = expected.gt(0) ? paid.div(expected).toFixed(18) : '0';
    else
      price = paid.gt(0) ? expected.div(paid).toFixed(18) : '0';
    return {
      symbol: '',
      asset: received,
      price,
      amount: floor.toFixed(),
      expected: expected.toFixed(),
      slippage: fraction,
      buying
    };
  });
  if (legs.length > 0 && legs[legs.length - 1].asset != outAsset.id) {
    legs[legs.length - 1].symbol = await unifiedSymbolOf(outAsset.id);
    legs[legs.length - 1].asset = outAsset.id;
  }

  const lastGot = new BigNumber((best[(best as any[]).length - 1] as any).output?.max ?? (best[(best as any[]).length - 1] as any).output?.min ?? 0);
  return { legs, received: legs.length > 0 ? lastGot.toFixed() : null };
}
const bridgeRowsCache: Record<string, { time: number, rows: any[] }> = { };
async function selectBridge(target: AssetId, amountOut: BigNumber | null): Promise<Bridge> {
  try {
    const cached = bridgeRowsCache[target.id];
    const rows = cached != null && Date.now() - cached.time < 30_000 ? cached.rows : await RPC.getBestBridgeInstancesByBalance(new AssetId(target.id), 0, 8);
    if (Array.isArray(rows))
      bridgeRowsCache[target.id] = { time: Date.now(), rows };
    const list = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      instance: row.instance ?? row,
      supply: row.balances?.[target.id] != null ? new BigNumber(row.balances[target.id].supply ?? row.balances[target.id]) : null
    }));
    const funded = amountOut != null ? list.filter((v) => v.supply != null && v.supply.gte(amountOut)) : list;
    const chosen = funded.length > 0 ? funded[0] : list[0];
    if (chosen != null) {
      const instance = chosen.instance;
      return {
        hash: String(instance.bridge_hash ?? instance.bridgeHash ?? ''),
        name: String(instance.name ?? `${target.token ?? target.chain ?? ''} bridge`),
        chain: String(instance.asset?.chain ?? instance.chain ?? target.chain ?? ''),
        feeRate: new BigNumber(instance.fee_rate ?? 0),
        simulated: false
      };
    }
  } catch { }

  const seed = Hashing.hash256(new TextEncoder().encode(`ams-regtest-simulated:${target.id}`));
  const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
  let hash = '0x';
  for (let i = 0; i < 8; i++)
    hash += view.getUint32(i * 4).toString(16).padStart(8, '0');

  return { hash, name: 'simulated bridge (regtest)', chain: target.chain ?? '', feeRate: new BigNumber(0), simulated: true };
}
async function quoteFeeLeg(outAssetId: string, bridge: Bridge | null, received: string | null, slippage: string): Promise<SwapLeg[] | null> {
  const base = baseOfAsset(outAssetId);
  if (base == null)
    return null;

  if (base == outAssetId)
    return [];

  const fee = bridge?.feeRate ?? null;
  if (fee == null || !fee.gt(0) || received == null || !new BigNumber(received).gt(0) || !/^\d*\.?\d+$/.test(slippage))
    return null;

  const fraction = new BigNumber(slippage).div(100).toFixed();
  const legOf = (leg: any): { price: BigNumber, buying: boolean, asset: string } | null => {
    const buying = Number(leg.side) == 0;
    const paid = new BigNumber(leg.input?.max ?? 0);
    const got = new BigNumber(leg.output?.max ?? leg.output?.min ?? 0);
    const asset = leg.pair?.[buying ? 'primaryAsset' : 'secondaryAsset']?.hash?.id ?? '';
    let price: BigNumber;
    if (buying)
      price = got.gt(0) ? paid.div(got) : new BigNumber(0);
    else
      price = paid.gt(0) ? got.div(paid) : new BigNumber(0);
    return asset.length > 0 && price.gt(0) ? { price, buying, asset } : null;
  };

  try {
    const first = await Exchange.marketPathsDirect(outAssetId, base, received, fraction);
    const firstPath = Array.isArray(first) && first.length > 0 ? first[0] as any[] : null;
    if (firstPath == null || firstPath.length < 1)
      return [];

    const firstIn = new BigNumber(firstPath[0]?.input?.max ?? 0);
    const firstOut = new BigNumber(firstPath[firstPath.length - 1]?.output?.max ?? firstPath[firstPath.length - 1]?.output?.min ?? 0);
    if (!firstIn.gt(0) || !firstOut.gt(0))
      return [];

    const second = await Exchange.marketPathsDirect(outAssetId, base, fee.times(firstIn).div(firstOut).toFixed(), fraction);
    const path = Array.isArray(second) && second.length > 0 ? second[0] as any[] : null;
    if (path == null || path.length < 1)
      return [];

    const legs: SwapLeg[] = (path as any[]).map((leg: any) => {
      const priced = legOf(leg);
      return {
        symbol: '',
        asset: priced?.asset ?? '',
        price: priced?.price.toFixed(18) ?? '0',
        amount: '0', slippage: fraction, buying: priced?.buying ?? true
      };
    });

    if (legs.some((leg) => leg.asset.length < 1 || !new BigNumber(leg.price).gt(0)))
      return [];

    let need = fee;
    for (let i = legs.length - 1; i >= 0; i--) {
      const price = new BigNumber(legs[i].price);
      legs[i].amount = (legs[i].buying ? need : need.div(price)).toFixed();
      need = legs[i].buying ? need.times(price) : need.div(price);
    }

    return legs;
  } catch {
    return [];
  }
}

function SlippageGear({ slippage, setSlippage, error }: { slippage: string, setSlippage: (value: string) => void, error?: string | null }) {
  return <Dialog.Root>
    <Dialog.Trigger><button className="ams-gear" title="Slippage"><Icon path={mdiCog} size={1.1}></Icon></button></Dialog.Trigger>
    <Dialog.Content className="sheet-content" maxWidth="360px">
      <Dialog.Title style={{ fontWeight: 750, fontSize: 16, margin: '0 0 14px', color: 'var(--text)' }}>Max slippage</Dialog.Title>
      <div className="ams-new-slip">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input className="ams-slip" value={slippage} placeholder="0.50" inputMode="decimal" onChange={(event) => setSlippage(event.target.value.replace(/[^0-9.]/g, ''))} />
          <span className="dim tiny">%</span>
        </span>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          {['0.25', '0.50', '1.00'].map((preset) => <button key={preset} className={'pct' + (slippage == preset ? ' hot' : '')} onClick={() => setSlippage(preset)}>{preset}</button>)}
        </span>
      </div>
      {error != null ? <div className="ams-error">{error}</div> : null}
      <Dialog.Close>
        <Button className="btn-brand btn-block" color="jade" style={{ marginTop: 16, height: 42, fontWeight: 700 }}>Done</Button>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Root>;
}
function SwapHistory() {
  const navigate = useNavigate();
  const equity = useEquity();
  const [mode, setMode] = useState<'all' | 'mine'>('all');
  const [rows, setRows] = useState<Booking[]>([]);
  const [more, setMore] = useState(true);
  const page = useRef(0);
  const busy = useRef(false);
  const myKeys = useRef<string[] | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const find = useCallback(async () => {
    if (busy.current)
      return;

    busy.current = true;
    const keys = myKeys.current != null ? myKeys.current : (myKeys.current = await AmsKeyring.publicKeys());
    const next = await Exchange.swapsHistory(page.current, mode == 'mine' ? keys : undefined, mode == 'all' ? ['finalized'] : undefined);
    if (next.length < HISTORY_PAGE_SIZE)
      setMore(false);

    if (next.length > 0) {
      page.current += 1;
      setRows((list) => [...list, ...next]);
    }

    busy.current = false;
  }, [mode]);
  useEffectAsync(async () => {
    page.current = 0;
    setMore(true);
    setRows([]);
    await find();
  }, [mode]);
  useEffect(() => {
    const onChain = (event: Event) => {
      const block = Number((event as CustomEvent).detail?.tip);
      if (Number.isFinite(block))
        setTip(block);
    };

    window.addEventListener('update:chain', onChain);
    return () => window.removeEventListener('update:chain', onChain);
  }, []);
  useEffectAsync(async () => {
    const block = await RPC.getBlockTipNumber();
    if (typeof block == 'string')
      setTip(new BigNumber(block, 16).toNumber());
    else if (BigNumber.isBigNumber(block))
      setTip(block.toNumber());
  }, []);
  if (rows.length < 1 && mode == 'all')
    return null;

  const leftOf = (row: Booking): string => {
    if (row.status == 'finalized' || row.status == 'expired')
      return '0m left';

    const blocksLeft = tip != null ? Number(row.expiresBlock) - tip : null;
    if (blocksLeft == null)
      return '…';

    if (blocksLeft <= 0)
      return '0m left';

    return (blocksLeft >= 60 ? `${Math.floor(blocksLeft / 60)}h ${blocksLeft % 60}m` : `${blocksLeft}m`) + ' left';
  };
  return <div className="ams-hist">
    <div className="ams-hist-head"><Icon path={mdiHistory} size={0.8}></Icon>{mode == 'mine' ? 'My swaps' : 'Recent swaps'}<span className="ams-hist-switch"><button className={'ams-hist-seg' + (mode == 'all' ? ' on' : '')} onClick={() => setMode('all')}>All</button><button className={'ams-hist-seg' + (mode == 'mine' ? ' on' : '')} onClick={() => setMode('mine')}>Mine</button></span></div>
    <InfiniteScroll dataLength={rows.length} hasMore={more} next={find} loader={<div className="dim tiny" style={{ padding: '10px 14px' }}>loading more…</div>}>
      {rows.length < 1 ? <div className="ams-hist-empty">No swaps found for this wallet yet</div> : null}
      <div className="ams-hist-list">
        {rows.map((row) => {
          const tone = STATUS_STEPS[row.status]?.tone ?? 'muted';
          const label = STATUS_STEPS[row.status]?.label ?? row.status;
          const pulse = HISTORY_PULSE.includes(row.status);
          const pay = assetIdOf(row.asset);
          const out = row.outAsset != null ? assetIdOf(row.outAsset) : null;
          const fiat = fiatValue(equity, pay, row.amount);
          return <div className="card ams-hist-row" key={row.id} onClick={() => setTimeout(() => navigate(`/swaps/${bookingQuery(pay, row.amount)}`), 100)}>
            <div className="ams-hist-icons">
              <AssetImage asset={new AssetId(pay)} size="2" style={{ width: 40, height: 40 }}></AssetImage>
              {out != null ? <span className="ams-hist-badge"><AssetImage asset={new AssetId(out)} size="1" style={{ width: 18, height: 18 }}></AssetImage></span> : null}
            </div>
            <div className="ams-hist-text">
              <div className="ams-hist-main">{toFancyMoney(null, row.amount)} {symbolOf(pay)}{out != null ? <><Icon path={mdiArrowRight} size={0.7}></Icon>{toFancyMoney(null, row.outAmount ?? '0')} {symbolOf(out)}</> : null}</div>
              <div className="ams-hist-sub">{leftOf(row)}{fiat != null ? <span> · {fiat}</span> : null}</div>
            </div>
            <span className={'ams-chip ams-chip-' + tone}>{pulse ? <span className="ams-chip-dot pulse"></span> : null}{label}</span>
          </div>;
        })}
      </div>
    </InfiniteScroll>
  </div>;
}
function NewSwap() {
  const navigate = useNavigate();
  const equity = useEquity();
  const [contract, setContract] = useState<{ account: string } | null>(null);
  const [payAsset, setPayAsset] = useState<AssetId | null>(null);
  const [receiveAsset, setReceiveAsset] = useState<AssetId | null>(null);
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState('0.50');
  const slippageOk = useMemo(() => /^\d*\.?\d+$/.test(slippage) && new BigNumber(slippage).gte(0), [slippage]);
  const [routing, setRouting] = useState('');
  const [quote, setQuote] = useState<{ legs: SwapLeg[], feeLegs: SwapLeg[], received: string | null, error: string | null } | null>(null);
  const [bridge, setBridge] = useState<Bridge | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setPriceTick] = useState(0);
  const quoteRun = useRef(0);
  const bridgeRun = useRef(0);
  const feeRun = useRef(0);
  const sameAsset = useMemo(() => payAsset != null && receiveAsset != null && payAsset.id == receiveAsset.id, [payAsset, receiveAsset]);
  const destinationChain = useMemo(() => bridge?.chain ?? receiveAsset?.chain ?? null, [bridge, receiveAsset]);
  const baseAsset = useMemo(() => receiveAsset != null ? baseOfAsset(receiveAsset.id) : null, [receiveAsset]);
  const baseSymbol = useMemo(() => symbolOf(baseAsset), [baseAsset]);
  const netReceived = useMemo(() => {
    const net = netAfterFee(quote?.received ?? null, quote?.feeLegs ?? [], bridge?.feeRate);
    return net != null ? net.decimalPlaces(18, BigNumber.ROUND_DOWN).toFixed() : null;
  }, [quote, bridge?.feeRate]);
  const addressError = useMemo(() => routingError(destinationChain, routing), [destinationChain, routing]);
  const feeError = useMemo((): string | null => {
    if (receiveAsset == null || quote == null || quote.received == null || bridge == null)
      return null;

    const base = baseOfAsset(receiveAsset.id);
    if (base == null || base == receiveAsset.id)
      return null;

    return quote.feeLegs.length < 1 ? 'no market route to pay the bridge fee for this output' : null;
  }, [receiveAsset, quote, bridge]);
  const ready = useMemo(() => contract != null && payAsset != null && receiveAsset != null && !sameAsset && new BigNumber(amountIn || '0').gt(0) && quote != null && quote.received != null && new BigNumber(netReceived ?? '0').gt(0) && routing.length > 0 && bridge != null && !quoting && feeError == null && addressError == null && !booking && slippageOk, [contract, payAsset, receiveAsset, sameAsset, amountIn, quote, netReceived, routing, bridge, quoting, feeError, addressError, booking, slippageOk]);
  const submit = useCallback(async () => {
    if (contract == null || payAsset == null || receiveAsset == null || quote == null || quote.received == null)
      return;

    setBooking(true);
    setError(null);
    try {
      const exact = new BigNumber(amountIn);
      const seckey = Signing.keygen();
      const booked = await Exchange.swapsBook(payAsset.id, exact.toFixed(), ByteUtil.uint8ArrayToHexString(Signing.derivePublicKey(seckey).data).toLowerCase());
      const amount = booked?.amount != null && booked.amount.length > 0 ? booked.amount : exact.toFixed();
      await AmsKeyring.save({
        contract: contract.account,
        asset: payAsset.id,
        amount,
        seckey: ByteUtil.uint8ArrayToHexString(seckey.data).toLowerCase(),
        bridgeHash: bridge?.hash ?? '',
        routingAddress: routing,
        tokenPath: quote.legs,
        feePath: quote.feeLegs
      });
      navigate(`/swaps/${bookingQuery(payAsset.id, amount)}`, { replace: true });
    } catch (exception: any) {
      setError(exception?.message != null ? String(exception.message) : 'booking failed');
      setBooking(false);
    }
  }, [contract, payAsset, receiveAsset, quote, amountIn, bridge, routing, navigate]);
  useEffectAsync(async () => {
    await Exchange.establish();
    const info = Exchange.amsContract();
    setContract(info);
    if (info != null)
      Exchange.channel([info.account]);

    try {
      await Exchange.synchronize();
      setPriceTick((value) => value + 1);
    } catch { }
  }, []);
  useEffectAsync(async () => {
    const run = ++quoteRun.current;
    if (payAsset == null || receiveAsset == null || sameAsset || !slippageOk || !new BigNumber(amountIn || '0').gt(0)) {
      setQuote(null);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    if (run != quoteRun.current)
      return;

    setQuoting(true);
    try {
      const { legs, received } = await quoteSwapPath(payAsset.id, receiveAsset, amountIn, slippage);
      if (run == quoteRun.current)
        setQuote({ legs, feeLegs: [], received, error: legs.length > 0 ? null : 'no route between these assets' });
    } catch (exception: any) {
      if (run == quoteRun.current)
        setQuote({ legs: [], feeLegs: [], received: null, error: exception?.message ?? 'quote failed' });
    }

    if (run == quoteRun.current)
      setQuoting(false);
  }, [payAsset, receiveAsset, amountIn, slippage, slippageOk, sameAsset]);
  useEffectAsync(async () => {
    const run = ++bridgeRun.current;
    if (receiveAsset == null) {
      setBridge(null);
      return;
    }

    const bridge = await selectBridge(receiveAsset, quote?.received != null ? new BigNumber(quote.received) : null);
    if (run == bridgeRun.current)
      setBridge(bridge);
  }, [receiveAsset, quote?.received]);
  useEffectAsync(async () => {
    const run = ++feeRun.current;
    if (receiveAsset == null || quote == null || bridge == null)
      return;

    const base = baseOfAsset(receiveAsset.id);
    if (base == null || base == receiveAsset.id) {
      if (quote.feeLegs.length > 0)
        setQuote({ ...quote, feeLegs: [] });
      return;
    }

    const feeLegs = await quoteFeeLeg(receiveAsset.id, bridge, quote.received, slippage);
    if (run != feeRun.current)
      return;

    const next = feeLegs ?? [];
    if (next.length != quote.feeLegs.length) {
      setQuote({ ...quote, feeLegs: next });
      return;
    }

    const changed = next.some((leg, i) => leg.amount != quote.feeLegs[i].amount || leg.price != quote.feeLegs[i].price);
    if (changed)
      setQuote({ ...quote, feeLegs: next });
  }, [receiveAsset, bridge?.hash, quote?.received, slippage]);
  if (contract == null)
    return <div className="ams-empty">
      <div className="ams-empty-title">No AMS contract registered</div>
      <div className="ams-empty-body">The exchange has not published an atomic swap contract.</div>
    </div>;
  
  return <div className="ams-new"><div className="card">
    <div className="ams-head ams-new-head">
      <div className="ams-title">Cross-chain swap</div>
      <SlippageGear slippage={slippage} setSlippage={setSlippage} error={slippageOk ? null : 'set a slippage value, e.g. 0.50'} />
    </div>
    <div style={{ marginTop: 10 }}>
      <div className="ams-new-lab"><span>Pay</span></div>
      <div className="ams-new-row">
        <input className="ams-amount" value={amountIn} placeholder='0.00' inputMode='decimal'
          onChange={(event) => setAmountIn(event.target.value.replace(/[^0-9.]/g, ''))} />
        <AssetSelector title="Pay asset" value={payAsset} onChange={(asset) => { setPayAsset(asset); setError(null); }} offchain>
          <button className="token-select">{payAsset != null ? <><AssetImage asset={payAsset} size="2" iconSize="22px"></AssetImage> {payAsset.token || payAsset.chain || 'token'}</> : 'Select'}</button>
        </AssetSelector>
      </div>
      {payAsset != null && fiatValue(equity, payAsset.id, amountIn.length > 0 ? amountIn : '0') != null ? <div className="ams-new-fiat">{fiatValue(equity, payAsset.id, amountIn.length > 0 ? amountIn : '0')}</div> : null}
    </div>
    <div className="ams-new-flip"><button onClick={() => { setPayAsset(receiveAsset); setReceiveAsset(payAsset); setAmountIn(''); }} title="Flip direction"><Icon path={mdiSwapVertical} size={0.8}></Icon></button></div>
    <div>
      <div className="ams-new-lab">
        <span>Receive</span>
        {quoting ? <span className="dim tiny">quoting…</span> : null}
      </div>
      <div className="ams-new-row">
        <div className="ams-new-quote">{netReceived != null ? toFancyMoney(null, netReceived) : '0.00'}</div>
        <AssetSelector title="Receive asset" value={receiveAsset} onChange={(asset) => { setReceiveAsset(asset); setError(null); }} offchain>
          <button className="token-select">{receiveAsset != null ? <><AssetImage asset={receiveAsset} size="2" iconSize="22px"></AssetImage> {receiveAsset.token || receiveAsset.chain || 'token'}</> : 'Select'}</button>
        </AssetSelector>
      </div>
      {receiveAsset != null && fiatValue(equity, receiveAsset.id, netReceived ?? '0') != null ? <div className="ams-new-fiat">{fiatValue(equity, receiveAsset.id, netReceived ?? '0')}</div> : null}
    </div>
    <div className="ams-inner">
      <input className="ams-input mono" value={routing} placeholder={receiverPlaceholder(destinationChain)}
        onChange={(event) => setRouting(event.target.value.trim())} />
      {addressError != null ? <div className="ams-error">{addressError}</div> : null}
    </div>
    {sameAsset ? <div className="ams-error">choose two different assets</div> : null}
    {quote?.error != null ? <div className="ams-error">{quote.error}</div> : null}
    {feeError != null ? <div className="ams-error">{feeError}</div> : null}
    {error != null ? <div className="ams-error">{error}</div> : null}
    <Button className="btn-brand btn-cta btn-block" color="jade" style={{ marginTop: 12 }} disabled={!ready} onClick={submit}>
      {booking ? 'Booking…' : 'Book swap'}
    </Button>
    {quote?.received != null && !quoting && new BigNumber(amountIn || '0').gt(0) && payAsset != null && receiveAsset != null ? <div className="ams-fee-line" style={{ marginTop: 12 }}>1 {payAsset.token || payAsset.chain} ≈ {toFancyMoney(null, new BigNumber(quote.received).div(amountIn))} {receiveAsset.token || receiveAsset.chain}{bridge != null ? <span className="dim tiny"> · {toFancyMoney(null, bridge.feeRate)} {baseSymbol} gas fee{fiatValue(equity, baseAsset, bridge.feeRate) != null ? ` (${fiatValue(equity, baseAsset, bridge.feeRate)})` : ''}</span> : null}</div> : null}
  </div>
    <SwapHistory />
  </div>;
}
function TechQr({ seed }: { seed: string }) {
  const grid = useMemo(() => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); h >>>= 0; }
    const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    const n = 25, cells: number[] = [];
    for (let i = 0; i < n * n; i++)
      if (rnd() < 0.45)
        cells.push(i);
    return { n, cells };
  }, [seed]);
  const s = 100 / grid.n;
  const finder = (x: number, y: number) => <rect key={`f${x}-${y}`} x={x + s} y={y + s} width={s * 5} height={s * 5} fill="none" stroke="currentColor" strokeWidth={s} />;
  return <svg className="ams-techqr" viewBox="0 0 100 100" aria-hidden="true">
    {grid.cells.map((i) => {
      const x = (i % grid.n) * s, y = Math.floor(i / grid.n) * s;
      if ((x < 8 * s && y < 8 * s) || (x > (grid.n - 8) * s && y < 8 * s) || (x < 8 * s && y > (grid.n - 8) * s))
        return null;
      return <rect key={i} x={x} y={y} width={s} height={s} fill="currentColor" />;
    })}
    {finder(0, 0)}
    {finder((grid.n - 7) * s, 0)}
    {finder(0, (grid.n - 7) * s)}
  </svg>;
}
function DepositCard({ booking, contract, status }: { booking: Booking, contract: string, status?: string }) {
  const [destination, setDestination] = useState<DepositDestination | null>(null);
  const equity = useEquity();
  const adapter = useRef<WcContext>(null);
  const [wcStatus, setWcStatus] = useState<string>('idle');
  const [wcToken, setWcToken] = useState<string | null>(null);
  const [submitTick, setSubmitTick] = useState(0);
  const submitPending = useRef<{ address: string, token: string | null } | null>(null);
  useEffect(() => {
    const pending = submitPending.current;
    if (pending != null && pending.token === wcToken) {
      submitPending.current = null;
      adapter.current?.submit(pending.address);
    }
  }, [submitTick, wcToken]);
  const [fallback, setFallback] = useState(false);
  const destRun = useRef(0);
  const asset = useMemo(() => assetIdOf(booking.asset), [booking.asset]);
  const chain = useMemo((): string => {
    try {
      return new AssetId(asset).chain ?? '';
    } catch {
      return '';
    }
  }, [asset]);
  const symbol = useMemo(() => symbolOf(asset), [asset]);
  useEffectAsync(async () => {
    if (contract.length < 1)
      return;

    const run = ++destRun.current;
    setDestination(null);
    setFallback(false);
    if (chain.length < 1) {
      setDestination({ mode: 'address', to: contract, chain: null, vault: false });
      return;
    }

    if (chainRoutingPolicies[chain] == null) {
      try {
        for (const row of await RPC.getBlockchains() || []) {
          if (row?.chain != null)
            chainRoutingPolicies[String(row.chain)] = String(row.routing_policy);
        }
      } catch { }
    }

    if (run != destRun.current)
      return;

    if (chainRoutingPolicies[chain] == 'account') {
      let master: string | null = null;
      try {
        const instances = await RPC.getBestBridgeInstancesByBalance(new AssetId(asset), 0, 4) || [];
        for (const entry of instances) {
          const instance = entry?.instance;
          if (instance?.master == null)
            continue;

          const rows = await RPC.getWitnessAccountsByPurpose(instance.master, 'bridge', 0, 32) || [];
          const match = rows.find((row: any) => row?.asset?.chain === chain && (instance.bridge_hash == null || row?.bridge_hash == null || row.bridge_hash === instance.bridge_hash) && Array.isArray(row.addresses) && row.addresses.length > 0);
          if (match != null) {
            master = String(match.addresses[0]);
            break;
          }
        }
      } catch { }
      if (run != destRun.current)
        return;

      if (master == null) {
        setDestination({ mode: 'notice', text: `${symbolOf(asset)} deposits must come from an external wallet on the ${chain} network — but no ${chain} bridge with a master deposit address is registered on this node, so this swap cannot be funded.` });
        return;
      }

      const network: WcAsset | null = ({ ETH: 'ETH', SOL: 'SOL', SOLANA: 'SOL', TRX: 'TRX', TRON: 'TRX' } as Record<string, WcAsset>)[chain.toUpperCase()] ?? null;
      setDestination(network != null ? { mode: 'wc', network, to: master, memo: addressToMemo(contract), chain } : { mode: 'manual', to: master, memo: addressToMemo(contract), chain });
    } else {
      let witness: string | null = null;
      try {
        const rows = await RPC.getWitnessAccounts(contract, 0, 64) || [];
        const match = rows.find((row: any) => row?.asset?.chain === chain && (row?.purpose == null || row.purpose == 'routing') && Array.isArray(row.addresses) && row.addresses.length > 0);
        witness = match != null ? String(match.addresses[0]) : null;
      } catch { }
      if (run != destRun.current)
        return;

      setDestination(witness != null ? { mode: 'address', to: witness, chain, vault: true } : { mode: 'address', to: contract, chain: null, vault: false });
    }
  }, [chain, contract, asset]);

  if (destination == null)
    return <div className="dim ams-inner">{chain.length > 0 ? `checking the ${chain} deposit address…` : 'preparing the deposit…'}</div>;
  else if (destination.mode == 'notice')
    return <div className="ams-notice ams-inner">{destination.text}</div>;

  const seen = (status ?? booking.status) == 'finalizing_deposit' || booking.depositStatus == 'pending';
  const rolledBack = booking.depositHash != null && booking.depositStatus == null && (status ?? booking.status) != 'finalizing_deposit';
  const depositStatusLine = () => {
    if (seen && booking.depositHash != null)
      return <div className="ams-pulse on"><span>Confirming your payment {hashRef(booking.depositHash)}</span></div>;
    if (rolledBack)
      return <div className="ams-pulse">Payment was reorganized out — send again if it never returns</div>;
    if (seen)
      return <div className="ams-pulse on">Payment received, awaiting confirmations</div>;
    return <div className="ams-pulse warn">Watching for your payment…</div>;
  };
  const bottomLine = <div>{depositStatusLine()}</div>;
  const fiat = fiatValue(equity, asset, booking.amount);
  const amountSize = booking.amount.length <= 10 ? 38 : Math.max(19, Math.round(380 / booking.amount.length));
  const heroIconSize = Math.round(amountSize * 1.53);
  const amountLine = <div className="ams-pay-hero mono" title="Copy the exact deposit amount" onClick={() => { navigator.clipboard.writeText(booking.amount); AlertBox.open(AlertType.Info, 'Amount copied!'); }}>
    <AssetImage asset={new AssetId(asset)} size="1" iconSize={heroIconSize + 'px'} style={{ width: heroIconSize, height: heroIconSize }}></AssetImage>
    <div>
      <div className="ams-pay-amount" style={{ fontSize: amountSize }}>{booking.amount}<span>{symbol}</span></div>
      <div className="ams-pay-sub">{fiat != null ? fiat : 'tap to copy'}<Icon path={mdiContentCopy} size={0.7}></Icon></div>
    </div>
  </div>;

  const payField = (label: string, value: string, message: string, copyable: boolean) => {
    const body = <>
      <div className="ams-pay-field-label">{label}</div>
      <div className="ams-pay-field-row">
        <span className="ams-pay-field-value mono">{UiUtil.toAddress(value)}</span>
        {copyable ? <Icon path={mdiContentCopy} size={0.9}></Icon> : null}
      </div>
    </>;
    return copyable ? <button className="ams-pay-field ams-pay-field-btn" title={'Copy the ' + message} onClick={() => { navigator.clipboard.writeText(value); AlertBox.open(AlertType.Info, message.charAt(0).toUpperCase() + message.slice(1) + ' copied!'); }}>
      {body}
    </button> : <div className="ams-pay-field">{body}</div>;
  };
  const fallbackable = (status ?? booking.status) == 'awaiting_deposit' && (destination.mode == 'wc' || destination.mode == 'manual');
  const fb = fallback && fallbackable;
  const overline = fb
    ? <>on-chain TAN payment</>
    : destination.mode == 'address'
      ? <>pay exactly once</>
      : <>pay from your {destination.chain} wallet</>;
  const modeToggle = fallbackable ? <button className={'ams-pay-mode' + (fb ? ' on' : '')} aria-label={fb ? 'Switch to standard payment' : 'Switch to on-chain fallback payment'} title={fb ? 'Switch to standard payment' : 'Pay on-chain to the swap contract instead'} onClick={() => setFallback(!fallback)}>
    <Icon path={mdiSwapVertical} size={0.8}></Icon>{fb ? 'Pay off-chain' : 'Pay on-chain'}
  </button> : null;
  const finalizing = (status ?? booking.status) == 'finalizing_deposit';
  const paySquare = fb || destination.mode != 'wc' ? <div className={'ams-qr' + (finalizing ? ' dim' : '')}>
    <QRCode value={fb ? `pay?to=${contract}&asset=${asset}&amount=${booking.amount}` : destination.mode == 'address' ? `pay?to=${destination.to}&asset=${asset}&amount=${booking.amount}` : destination.to} size={140} bgColor="transparent" fgColor="currentColor" />
  </div> : <button className="ams-pay-connect" disabled={wcStatus != 'idle' || finalizing} onClick={() => adapter.current?.acquire()}>
    <TechQr seed={contract} />
    <Icon path={mdiContactlessPayment} size={1.9}></Icon><b>{finalizing ? 'Payment seen…' : wcStatus == 'sending' ? 'Sending…' : wcStatus == 'connecting' ? 'Connecting…' : 'Connect wallet'}</b>
  </button>;
  return <div className="ams-inner ams-pay">
    <div className="ams-pay-grid">
      {paySquare}
      <div className="ams-pay-main">
        <div className="ams-pay-overline">{overline}</div>
        {amountLine}
        {payField(fb ? 'Swap contract address' : destination.mode == 'address' ? (destination.vault ? 'Swap vault address' : 'Deposit address') : 'Pay to address', fb ? contract : destination.to, 'address', (fb || destination.mode != 'wc') && !finalizing)}
        {!fb && destination.mode == 'manual' ? payField('Memo · required', destination.memo, 'memo', true) : null}
      </div>
    </div>
    <div className="ams-pay-status">{bottomLine}{modeToggle}</div>
    {destination.mode == 'wc' && !fb ? <Suspense fallback={<></>}>
      <WcAdapter
        ref={adapter}
        network={destination.network}
        to={destination.to}
        amount={booking.amount}
        memo={destination.memo}
        token={wcToken}
        onAfterConnect={(address: string, tokens: { contractAddress: string, symbol: string }[] | null) => {
          let picked: string | null | undefined;
          try {
            const booked = new AssetId(asset);
            if (!AssetId.fromHandle(destination.network).equals(booked)) {
              for (const t of tokens ?? []) {
                if (AssetId.fromHandle(destination.network, t.symbol, t.contractAddress).equals(booked)) {
                  picked = t.contractAddress;
                  break;
                }
              }   
              if (picked === undefined) {
                const known = Whitelist.contractAddressOf(booked);
                if (typeof known == 'string' && known.length > 0)
                  picked = known;
              }
            } else {
              picked = null;
            }
          } catch {
            picked = undefined;
          }
          if (picked === undefined) {
            AlertBox.open(AlertType.Error, `The selected account has no ${symbol}.`);
            adapter.current?.reset();
            setWcStatus('idle');
            return;
          }
          submitPending.current = { address, token: picked };
          setWcToken(picked);
          setSubmitTick((v) => v + 1);
        }}
        onStatusChange={(value) => setWcStatus(value)}
        onError={(message: string) => { AlertBox.open(AlertType.Error, message); setWcStatus('idle'); }}
        onSent={() => setWcStatus('idle')}
      />
    </Suspense> : null}
  </div>;
}
function Authorize({ booking, context, sequencer, onDone, onOut, onError }: {
  booking: Booking, context: SigningContext | null, sequencer: string | null,
  onDone: () => Promise<void> | void, onOut: (symbol: string | null) => void, onError: (message: string | null) => void
}) {
  const [error, setError] = useState<string | null>(null);
  const equity = useEquity();
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState<string | null>(null);
  const [routing, setRouting] = useState(context?.routingAddress ?? '');
  const initialized = useRef(false);
  const [outAsset, setOutAsset] = useState<AssetId | null>(null);
  const [slippage, setSlippage] = useState('0.50');
  const [route, setRoute] = useState<{ legs: SwapLeg[], feeLegs: SwapLeg[], received: string | null, bridge: Bridge | null } | null>(null);
  const [requoting, setRequoting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const routeRun = useRef(0);
  const [preview, setPreview] = useState<SwapPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewRun = useRef(0);
  const original = useMemo(() => {
    if (context == null)
      return null;

    const last = context.tokenPath.length > 0 ? context.tokenPath[context.tokenPath.length - 1] : null;
    return { outAssetId: last?.asset ?? '', slippage: last?.slippage ?? '0.50' };
  }, [context]);
  const outAssetId = useMemo(() => outAsset?.id ?? '', [outAsset]);
  const reclaim = useMemo(() => outAsset != null && context != null && outAsset.id == context.asset, [outAsset, context]);
  const modified = useMemo(() => context != null && original != null && outAsset != null && (reclaim || outAsset.id != original.outAssetId || slippage != original.slippage), [context, original, outAsset, reclaim, slippage]);
  const outLabel = useMemo(() => outAsset != null ? (outAsset.token || outAsset.chain || '?') : symbolOf(assetIdOf(booking.asset)), [outAsset, booking.asset]);
  const active = useMemo(() => {
    if (context == null)
      return null;

    if (modified && route != null)
      return { tokenPath: route.legs, feePath: route.feeLegs, bridgeHash: route.bridge?.hash ?? context.bridgeHash, received: route.received };

    const last = context.tokenPath.length > 0 ? context.tokenPath[context.tokenPath.length - 1] : null;
    return { tokenPath: context.tokenPath, feePath: context.feePath, bridgeHash: context.bridgeHash, received: last != null ? (last.expected ?? last.amount) : booking.amount };
  }, [context, route, modified, booking.amount]);
  const message = useMemo((): Uint8Array | null => {
    if (context == null || sequencer == null || booking.depositHash == null || active == null)
      return null;

    try {
      const message = new Stream();
      message.writeInteger(new Uint256(booking.depositHash));
      message.writeInteger(new Uint256(active.bridgeHash));
      message.writeInteger(new AssetId(context.asset).toUint256());
      message.writeDecimal(new BigNumber(booking.amount), true);
      writeAddress(message, context.contract);
      writeAddress(message, sequencer);
      message.writeString(routing);
      const orders = active.tokenPath.concat(active.feePath);
      message.writeInteger(orders.length);
      for (const order of orders) {
        message.writeString(order.symbol);
        message.writeInteger(new Uint256(order.asset));
        message.writeDecimal(new BigNumber(order.price));
        message.writeDecimal(new BigNumber(order.amount));
        message.writeDecimal(new BigNumber(order.slippage));
        message.writeBoolean(order.buying);
      }
      return message.data;
    } catch {
      return null;
    }
  }, [booking, context, sequencer, routing, active]);
  const addressError = useMemo(() => routingError(outAsset?.chain, routing), [outAsset, routing]);
  const noRoute = useMemo(() => routeError != null || (modified && route == null), [routeError, modified, route]);
  const needAddress = useMemo(() => routing.trim().length < 1, [routing]);
  const feeLeg = useMemo(() => active != null && active.feePath.length > 0 ? active.feePath[active.feePath.length - 1] : null, [active]);
  const feeAmount = useMemo(() => route?.bridge?.feeRate ?? null, [route]);
  const feeFirst = useMemo(() => active != null && active.feePath.length > 0 ? active.feePath[0] : null, [active]);
  const feeBudget = useMemo(() => feeFirst != null ? (feeFirst.buying ? new BigNumber(feeFirst.amount).times(feeFirst.price).times(new BigNumber(feeFirst.slippage || '0').plus(1)) : new BigNumber(feeFirst.amount).div(new BigNumber(feeFirst.price).times(new BigNumber(1).minus(feeFirst.slippage || '0')))) : null, [feeFirst]);
  const simOut = useMemo(() => preview?.successful === true && preview.outAmount != null ? new BigNumber(preview.outAmount) : null, [preview]);
  const bridgeFeeShown = useMemo(() => feeAmount != null ? feeAmount : feeLeg == null && simOut != null && active != null ? new BigNumber(active.received ?? 0).minus(simOut) : null, [feeAmount, feeLeg, simOut, active]);
  const feeCost = useMemo(() => feeBudget != null ? feeBudget : (feeAmount ?? bridgeFeeShown), [feeBudget, feeAmount, bridgeFeeShown]);
  const worstNet = useMemo((): BigNumber | null => {
    if (active == null)
      return null;

    const path = active.tokenPath;
    let worstGross = new BigNumber(path.length > 0 ? path[path.length - 1].amount : booking.amount);
    for (let i = 0; i < path.length; i++) {
      const legSlip = new BigNumber(path[i].slippage || '0');
      worstGross = path[i].buying ? worstGross.div(new BigNumber(1).plus(legSlip)) : worstGross.times(new BigNumber(1).minus(legSlip));
    }
    return worstGross.minus(feeCost ?? 0);
  }, [active, booking.amount, feeCost]);
  const expectedNet = useMemo((): BigNumber | null => {
    if (simOut != null)
      return simOut;
    if (active != null)
      return netAfterFee(active.received, active.feePath, feeAmount);
    return null;
  }, [simOut, active, feeAmount]);
  const grossReceived = useMemo(() => expectedNet != null ? expectedNet.plus(feeCost ?? 0) : null, [expectedNet, feeCost]);
  const rate = useMemo(() => grossReceived != null ? grossReceived.div(new BigNumber(booking.amount)) : null, [grossReceived, booking.amount]);
  const feeNative = useMemo(() => feeAmount != null ? new BigNumber(feeAmount) : feeLeg != null ? new BigNumber(feeLeg.amount) : null, [feeAmount, feeLeg]);
  const feeNativeSymbol = useMemo(() => symbolOf(outAsset != null ? baseOfAsset(outAsset.id) : null), [outAsset]);
  const feeUsd = useMemo(() => feeCost != null ? new BigNumber(feeCost) : feeNative != null && feeLeg != null ? feeNative.times(feeLeg.price) : null, [feeCost, feeNative, feeLeg]);
  const feeTooBig = useMemo(() => worstNet != null && !worstNet.gt(0), [worstNet]);
  const blocked = useMemo(() => requoting || noRoute || addressError != null || feeTooBig, [requoting, noRoute, addressError, feeTooBig]);
  const shownError = useMemo((): string | null => {
    if (error != null)
      return error;
    if (preview?.successful === false)
      return preview.error ?? 'the spend transaction failed to simulate';
    if (routeError != null)
      return routeError;
    if (addressError != null)
      return addressError;
    if (feeTooBig)
      return 'the fees consume the entire payout — nothing would come back';
    return null;
  }, [error, preview, routeError, addressError, feeTooBig]);
  const confirmLabel = (): string => {
    if (context == null)
      return 'No control keys';
    if (posted)
      return 'Confirming…';
    if (submitting)
      return 'Sending…';
    if (previewing)
      return 'Simulating…';
    if (preview?.successful === false)
      return 'Simulation failed';
    if (requoting)
      return 'Re-routing…';
    if (needAddress)
      return 'Enter destination';
    if (addressError != null)
      return 'Invalid destination';
    if (noRoute)
      return 'No route';
    if (feeTooBig)
      return 'Fee exceeds payout';
    return 'Confirm swap';
  };
  const sign = useCallback(async () => {
    if (message == null || context == null || sequencer == null || active == null)
      return;

    if (routing.trim().length < 1) {
      setError('enter a destination address first');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const submission = await Exchange.swapsSpend(booking.depositHash ?? '', active.bridgeHash, routing, active.tokenPath, active.feePath, signMessage(message, context.seckey));
      await AmsKeyring.save({ ...context, bridgeHash: active.bridgeHash, tokenPath: active.tokenPath, feePath: active.feePath, routingAddress: routing });
      setPosted(submission.transaction ?? 'simulated');
      setTimeout(() => onDone(), 1200);
    } catch (exception: any) {
      setError(exception?.message != null ? String(exception.message) : 'spend rejected');
    }
    setSubmitting(false);
  }, [message, context, sequencer, active, routing, booking.depositHash, onDone]);
  useEffect(() => {
    if (context == null || initialized.current)
      return;

    initialized.current = true;
    setSlippage(new BigNumber(original?.slippage ?? '0.005').times(100).toFixed(2));
    if (original != null && original.outAssetId.length > 0) {
      try {
        setOutAsset(new AssetId(original.outAssetId));
      } catch { }
    }
  }, [context, original]);
  useEffect(() => {
    if (context != null && context.routingAddress.length > 0)
      setRouting(context.routingAddress);
  }, [context]);
  useEffectAsync(async () => {
    const run = ++routeRun.current;
    if (context == null || !modified || outAssetId.length < 1) {
      setRoute(null);
      setRouteError(null);
      setRequoting(false);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    if (run != routeRun.current)
      return;

    setRequoting(true);
    setRouteError(null);
    try {
      if (!new BigNumber(slippage || '0').gt(0)) {
        if (run == routeRun.current) {
          setRoute(null);
          setRouteError('slippage must be a positive percentage');
          setRequoting(false);
        }
        return;
      }

      if (outAssetId == context.asset) {
        const reclaimBridge = await selectBridge(outAsset!, new BigNumber(booking.amount));
        if (run == routeRun.current)
          setRoute({ legs: [], feeLegs: [], received: booking.amount, bridge: reclaimBridge });
      } else {
        const quoted = await quoteSwapPath(context.asset, outAsset!, booking.amount, slippage);
        if (quoted.legs.length < 1) {
          if (run == routeRun.current) {
            setRoute(null);
            setRouteError('no market route to the chosen receive asset');
            setRequoting(false);
          }
          return;
        }

        const newBridge = await selectBridge(outAsset!, quoted.received != null ? new BigNumber(quoted.received) : null);
        const feeLegs = await quoteFeeLeg(outAsset!.id, newBridge, quoted.received, slippage) ?? [];
        const base = baseOfAsset(outAsset!.id);
        if (base != null && base != outAsset!.id && feeLegs.length < 1) {
          if (run == routeRun.current) {
            setRoute(null);
            setRouteError('no market route to pay the bridge fee for this output');
            setRequoting(false);
          }
          return;
        }

        if (run == routeRun.current)
          setRoute({ legs: quoted.legs, feeLegs, received: quoted.received, bridge: newBridge });
      }
    } catch (exception: any) {
      if (run == routeRun.current)
        setRouteError(exception?.message ?? 're-route failed');
    }
    if (run == routeRun.current)
      setRequoting(false);
  }, [context, modified, outAssetId, slippage, booking.amount]);
  useEffect(() => {
    onOut(modified ? outLabel : null);
  }, [modified, outLabel, onOut]);
  useEffectAsync(async () => {
    const run = ++previewRun.current;
    if (context == null || sequencer == null || booking.depositHash == null || active == null || message == null || routing.trim().length < 1) {
      setPreview(null);
      setPreviewing(false);
      return;
    }

    setPreviewing(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (run != previewRun.current)
      return;
    
    try {
      (window as any).__dbg = { message: ByteUtil.uint8ArrayToHexString(message), bridgeHash: active.bridgeHash, routing, tokenPath: active.tokenPath, feePath: active.feePath };
      const result = await Exchange.swapsPreview(booking.depositHash!, active.bridgeHash, routing, active.tokenPath, active.feePath, signMessage(message, context.seckey));
      if (run == previewRun.current)
        setPreview(result);
    } catch (exception: any) {
      if (run == previewRun.current)
        setPreview({ successful: false, outAmount: null, error: String(exception?.message ?? 'preview failed') });
    }

    if (run == previewRun.current)
      setPreviewing(false);
  }, [context, sequencer, booking.depositHash, active, message, routing]);
  useEffect(() => {
    onError(shownError);
    return () => { onError(null); };
  }, [shownError]);

  if (booking.depositHash == null)
    return <div className="ams-inner ams-exec"><span className="dim tiny">payment still confirming…</span></div>;

  const fmt = (value: BigNumber | null | undefined): string => value != null && value.gt(0) ? toFancyMoney(null, value) : '—';
  return <div className="ams-inner ams-exec">
    <div className="ams-exec-top">
      <div className="ams-exec-amounts">
        <div className="ams-exec-main">{fmt(expectedNet)} {outLabel}{fiatValue(equity, outAssetId, expectedNet) != null ? <span className="dim"> · {fiatValue(equity, outAssetId, expectedNet)}</span> : null}</div>
        <span className="dim tiny" style={{ color: 'var(--text-3)' }}>Min receive {fmt(worstNet)} {outLabel}</span>
      </div>
      <SlippageGear slippage={slippage} setSlippage={setSlippage} />
    </div>
    <div className="ams-exec-addr">
      <input className="ams-input mono" value={routing} placeholder={receiverPlaceholder(outAsset?.chain)} onChange={(event) => setRouting(event.target.value.trim())} />
      <AssetSelector title="Receive asset" value={outAsset} onChange={(asset) => { setOutAsset(asset); setError(null); }} offchain>
        <button className="ams-input ams-tokenbtn">{outAsset != null ? <><AssetImage asset={outAsset} size="2" iconSize="22px"></AssetImage> {outAsset.token || outAsset.chain || 'token'}</> : 'Select'}</button>
      </AssetSelector>
    </div>
    <Button className={'btn-cta btn-block ' + (preview?.successful === false ? 'btn-simfail' : 'btn-brand')} color={preview?.successful === false ? 'red' : 'jade'} disabled={context == null || submitting || blocked || needAddress || message == null || previewing || preview?.successful !== true || posted != null} onClick={sign}>
      {confirmLabel()}
    </Button>
    {rate != null && !reclaim ? <div className="ams-fee-line">1 {symbolOf(assetIdOf(booking.asset))} ≈ {toFancyMoney(null, rate)} {outLabel}{feeNative != null && !feeNative.isNaN() && feeNative.gt(0) ? <span className="dim tiny"> · {toFancyMoney(null, feeNative)} {feeNativeSymbol} gas fee{feeUsd != null && !feeUsd.isNaN() ? ` (USD ${toFancyMoney(null, feeUsd)})` : ''}</span> : null}</div> : null}
  </div>;
}
function Respend({ booking, context, sequencer, onDone }: {
  booking: Booking, context: SigningContext | null, sequencer: string | null,
  onDone: () => Promise<void> | void
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [routing, setRouting] = useState(context?.routingAddress ?? '');
  const outChain = useMemo((): string | null => {
    try {
      return new AssetId(String(booking.outAsset)).chain ?? null;
    } catch {
      return null;
    }
  }, [booking.outAsset]);
  const addressError = useMemo(() => routingError(outChain, routing), [outChain, routing]);
  const retry = useCallback(async () => {
    if (context == null || sequencer == null || booking.broadcastHash == null || booking.outAsset == null)
      return;

    setSubmitting(true);
    setError(null);
    try {
      const message = new Stream();
      message.writeInteger(new Uint256(booking.depositHash ?? ''));
      message.writeInteger(new Uint256(booking.broadcastHash));
      message.writeInteger(new Uint256(context.bridgeHash));
      message.writeInteger(new AssetId(assetIdOf(booking.outAsset)).toUint256());
      const precision = Number(Exchange.amsContract()?.parameters?.depositPrecision ?? 6) || 6;
      message.writeDecimal(new BigNumber(String(booking.outAmount ?? '0')).decimalPlaces(precision, BigNumber.ROUND_DOWN), true);
      writeAddress(message, context.contract);
      writeAddress(message, sequencer);
      message.writeString(routing);
      await Exchange.swapsRespend(booking.depositHash ?? '', booking.broadcastHash, context.bridgeHash, routing, signMessage(message.data, context.seckey));
      setTimeout(() => onDone(), 1200);
    } catch (exception: any) {
      setError(exception?.message != null ? String(exception.message) : 'respend rejected');
    }
    setSubmitting(false);
  }, [context, sequencer, booking, routing, onDone]);

  const retryLabel = (): string => {
    if (context == null)
      return 'Control keys required';
    if (submitting)
      return 'Signing…';
    return 'Re-sign & retry withdrawal';
  };

  return <div className="ams-inner ams-respend">
    <div className="ams-respend-head">Withdrawal attempt failed</div>
    {booking.relayError != null ? <div className="ams-error">{booking.relayError}</div> : null}
    {error != null ? <div className="ams-error">{error}</div> : null}
    <input className="ams-input mono" value={routing} placeholder={receiverPlaceholder(outChain)} onChange={(event) => setRouting(event.target.value.trim())} />
    <div className="dim tiny">You may correct the destination — the respend signature covers the new address.</div>
    {addressError != null ? <div className="ams-error">{addressError}</div> : null}
    <Button className="btn-brand btn-cta btn-block" color="jade" disabled={context == null || submitting || addressError != null || booking.broadcastHash == null} onClick={retry}>{retryLabel()}</Button>
  </div>;
}
function AmsNav() {
  const navigate = useNavigate();
  const params = useParams();
  const concrete = params.booking != null && params.booking.length > 0;
  const [displayAsset, setDisplayAsset] = useState<string>(Exchange.equityAsset.chain || '');
  const equityAssets = useMemo(() => Exchange.getEquityAssets().slice().sort((a, b) => a[1].localeCompare(b[1])), []);
  useEffectAsync(async () => {
    await Exchange.synchronize();
    setDisplayAsset(Exchange.equityAsset.chain || '');
    window.dispatchEvent(new CustomEvent('ams:display-asset'));
  }, []);

  return <div className="ams-nav">
    <button className="ams-nav-back" onClick={() => navigate(concrete ? '/swaps' : '/')}><Icon path={concrete ? mdiPlus : mdiStarFourPoints} size={0.9} style={{ transform: 'translateY(1px)' }}></Icon>{concrete ? 'New swap' : 'Trade and earn'}</button>
    <Select.Root value={displayAsset} onValueChange={async (symbol) => {
      if (!Exchange.setEquityAsset(AssetId.fromHandle(symbol)))
        return;
      setDisplayAsset(symbol);
      window.dispatchEvent(new CustomEvent('ams:display-asset'));
      try {
        await Exchange.synchronize();
      } finally {
        setDisplayAsset(Exchange.equityAsset.chain || symbol);
        window.dispatchEvent(new CustomEvent('ams:display-asset'));
      }
    }} size="1">
      <Select.Trigger className="ams-nav-select" placeholder="Unknown">{displayAsset || 'Unknown'}</Select.Trigger>
      <Select.Content position="popper" side="bottom">
        <Select.Group>
          <Select.Label>Display currency</Select.Label>
          {equityAssets.map(([symbol, name]) => <Select.Item key={symbol} value={symbol}>{name}<Text size="1" color="gray" style={{ marginLeft: 6 }}>{symbol}</Text></Select.Item>)}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  </div>;
}
export default function SwapsPage() {
  const params = useParams();
  const equity = useEquity();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [context, setContext] = useState<SigningContext | null>(null);
  const [sequencer, setSequencer] = useState<string | null>(null);
  const [tipBlock, setTipBlock] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [viewStep, setViewStep] = useState<number | null>(null);
  const [execOut, setExecOut] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const contract = useRef<string | null>(null);
  const loadRun = useRef(0);
  const target = useMemo((): { asset: string, amount: string } | null => {
    if (params.booking == null || params.booking.length < 1)
      return null;

    try {
      const query = Stream.decode(params.booking);
      const asset = query.readInteger(query.readType() || Viewable.Invalid);
      const amount = query.readDecimal(query.readType() || Viewable.Invalid);
      if (asset != null && amount != null)
        return { asset: new AssetId(asset.toHex()).id, amount: amount.toString() };
    } catch { }
    return null;
  }, [params.booking]);
  const swapId = useMemo(() => booking != null ? `AMS-${booking.id}-${bookingQuery(assetIdOf(booking.asset), booking.amount).replace(/^0x/, '')}` : '', [booking]);
  const live = useMemo(() => booking != null && booking.status != 'finalized' && booking.status != 'expired', [booking]);
  const outSymbol = useMemo((): string => {
    if (execOut != null)
      return execOut;
    if (booking?.outAsset != null)
      return symbolOf(assetIdOf(booking.outAsset));
    if (context == null)
      return '?';
    const path = context.tokenPath;
    return symbolOf(path.length > 0 ? path[path.length - 1].asset : context.asset);
  }, [execOut, booking, context]);
  const expiry = useMemo((): { blocksLeft: number | null, text: string | null } => {
    const untilBlock = Number(booking?.expiresBlock);
    const blocksLeft = Number.isFinite(untilBlock) && tipBlock != null ? untilBlock - tipBlock : null;
    if (blocksLeft == null || blocksLeft <= 0)
      return { blocksLeft, text: null };
    if (blocksLeft >= 60)
      return { blocksLeft, text: `${Math.floor(blocksLeft / 60)}h ${blocksLeft % 60}m` };
    return { blocksLeft, text: `${blocksLeft}m` };
  }, [booking, tipBlock]);
  const asset = target?.asset ?? '';
  const amount = target?.amount ?? '';
  const expiryBadge = () => {
    if (expiry.blocksLeft == null)
      return <span className="dim">—</span>;
    if (expiry.blocksLeft <= 0)
      return <span className="ams-chip ams-chip-danger">expired</span>;
    return <span className="mono">{expiry.text} left, </span>;
  };
  const refresh = useCallback(async () => {
    if (asset.length < 1 || amount.length < 1)
      return;

    const found = await Exchange.swapsBooking(asset, amount, true);
    setBooking(found);
    if (found != null) {
      const stored = await AmsKeyring.get(bookingHandle(asset, amount));
      setContext(stored != null && contextMatches(stored, found.publicKey) ? stored : null);
    }
  }, [asset, amount]);
  const backupKeys = useCallback(() => {
    if (context == null || booking == null)
      return;

    const payload = {
      id: swapId,
      version: 1,
      exportedAt: new Date().toISOString(),
      booking: {
        asset, amount, status: booking.status,
        depositHash: booking.depositHash,
        withdrawHash: booking.withdrawHash,
        broadcastHash: booking.broadcastHash,
        expiresBlock: booking.expiresBlock
      },
      signing: context
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${swapId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [context, booking, asset, amount, swapId]);
  const loadBackup = useCallback(async (event: any) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file == null || booking == null)
      return;

    try {
      const payload = JSON.parse(await file.text());
      const loaded: SigningContext = payload?.signing;
      if (loaded?.seckey == null || loaded.asset == null || loaded.amount == null)
        throw new Error('not a swap backup file');

      if (bookingHandle(loaded.asset, loaded.amount) != bookingHandle(asset, booking.amount))
        throw new Error('this backup belongs to a different swap');

      if (!contextMatches(loaded, booking.publicKey))
        throw new Error('this backup key does not match the current booking on this handle');

      await AmsKeyring.save(loaded);
      setContext(loaded);
      AlertBox.open(AlertType.Info, 'Signing key restored — you control this swap again');
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, String(exception?.message ?? 'could not read backup'));
    }
  }, [booking, asset]);
  useEffect(() => {
    setViewStep(null);
    setLoading(true);
  }, [asset, amount]);
  useEffectAsync(async () => {
    if (asset.length < 1 || amount.length < 1)
      return;

    const run = ++loadRun.current;
    AppData.sync().then(() => {
      if (run == loadRun.current && AppData.tip != null)
        setTipBlock(Number(AppData.tip));
    });

    try {
      await Exchange.establish();
      const info = Exchange.amsContract();
      if (run != loadRun.current)
        return;

      setSequencer(info?.parameters?.sequencer ?? null);
      if (info != null) {
        contract.current = info.account;
        Exchange.channel([info.account]);
      }

      const found = await Exchange.swapsBooking(asset, amount);
      if (run != loadRun.current)
        return;

      setLoading(false);
      setBooking(found);
      if (found != null) {
        const stored = await AmsKeyring.get(bookingHandle(asset, amount));
        setContext(stored != null && contextMatches(stored, found.publicKey) ? stored : null);
      }
    } catch (exception: any) {
      if (run == loadRun.current)
        setError(exception?.message != null ? String(exception.message) : 'relay unreachable');
    }
  }, [asset, amount]);
  useEffect(() => {
    const update = (event: Event) => {
      if (asset.length < 1 || amount.length < 1)
        return;

      const data: any = (event as CustomEvent).detail;
      if (data == null || data.asset == null || (String(data.asset) == asset && new BigNumber(String(data.amount ?? '0')).eq(amount)))
        refresh().catch((exception: any) => setError(exception?.message != null ? String(exception.message) : 'relay unreachable'));
    };
    const onChain = (event: Event) => {
      const tip = Number((event as CustomEvent).detail?.tip);
      if (Number.isFinite(tip))
        setTipBlock(tip);
    };
    window.addEventListener('update:booking', update);
    window.addEventListener('update:chain', onChain);
    return () => {
      window.removeEventListener('update:booking', update);
      window.removeEventListener('update:chain', onChain);
    };
  }, [refresh, asset, amount]);
  useEffect(() => {
    if (!live)
      return;

    const timer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [live]);
  useEffect(() => {
    if (!loading) {
      setStale(false);
      return;
    }

    const timer = setTimeout(() => setStale(true), 90_000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (params.booking == null || params.booking.length < 1) {
    return <div className="ams-app"><AmsNav /><NewSwap /></div>;
  } else if (target == null) {
    return <div className="ams-app"><AmsNav />
      <div className="ams-empty">
        <div className="ams-empty-title">Malformed swap link</div>
        <div className="ams-empty-body">This swap link does not encode a valid booking (asset and amount).</div>
      </div>
    </div>;
  } else if (loading) {
    return <div className="ams-app"><AmsNav /><div className="card dim">loading booking…</div></div>;
  } else if (booking === null) {
    return <div className="ams-app"><AmsNav />{stale
      ? <div className="ams-empty">
        <div className="ams-empty-title">Booking not found</div>
        <div className="ams-empty-body">No swap booking exists for {amount} {symbolOf(asset)}{error != null ? ` (${error})` : ''}.</div>
      </div>
      : <div className="card ams-waiting">
        <div className="hero-num">{amount} <span className="dim">{symbolOf(asset)}</span></div>
        {fiatValue(equity, asset, amount) != null ? <div className="tiny dim">{fiatValue(equity, asset, amount)}</div> : null}
        <div className="dim">Booking submitted — waiting for on-chain confirmation…</div>
      </div>}</div>;
  }

  const status = booking.status;
  const meta = STATUS_STEPS[status] ?? { step: 0, tone: 'muted' as const, label: status };
  const currentStep = meta.step;
  const viewing = viewStep != null ? viewStep : currentStep;
  const failed = meta.tone === 'danger';
  const expired = status === 'expired';
  const outId = booking.outAsset != null ? assetIdOf(booking.outAsset) : null;
  const outFiat = fiatValue(equity, outId, booking.outAmount);
  const extId = () => booking.proofTransactionId != null
    ? <span className="copyable" title={booking.proofTransactionId} onClick={() => { navigator.clipboard.writeText(booking.proofTransactionId ?? ''); AlertBox.open(AlertType.Info, 'Proof id copied!') }}>{UiUtil.toAddress(booking.proofTransactionId)}</span>
    : <span className="dim mono">—</span>;
  const copySwapId = () => { navigator.clipboard.writeText(swapId); AlertBox.open(AlertType.Info, 'Swap id copied!'); };
  return <div className="ams-app"><AmsNav /><div className="ams-booking">
    <div className="card">
      <div className="ams-head">
        <div className="ams-title"><span className="dim">Swapping</span> {toFancyMoney(null, booking.amount)} <span className="dim">{symbolOf(asset)}</span></div>
        {status != 'finalized' && status != 'expired' ? <>
          <div className="ams-expiry-pill">
            <Icon path={mdiClockOutline} size={0.62}></Icon>
            {expiryBadge()}
            <span className="dim tiny mono">block {booking.expiresBlock}</span>
          </div>
          <div className="dim tiny ams-stay">Stay here to keep the swap going</div>
        </> : null}
      </div>
      <div className={`ams-stepper ${expired ? 'ams-stepper-expired' : ''}`}>
        {STEPPER_NODES.map((node, index) => {
          const reached = !expired && meta.step >= index + 1;
          const current = !expired && meta.step === index + 1;
          const cls = ['ams-step'];
          if (currentStep >= 1) cls.push('ams-step-click');
          if (reached) cls.push(current && failed ? 'ams-step-danger' : 'ams-step-reached');
          if (current && !failed) cls.push('ams-step-current');
          if (current && failed) cls.push('ams-step-current-danger');
          if (viewing === index + 1) cls.push('ams-step-view');
          return <div key={node} className={cls.join(' ')} role={currentStep >= 1 ? 'button' : undefined}
            title={currentStep >= 1 ? `${viewing === index + 1 ? 'viewing' : 'view'} the ${node} stage` : undefined}
            onClick={currentStep >= 1 ? () => setViewStep(index + 1 === currentStep ? null : index + 1) : undefined}>
            <div className="ams-step-dot">{stepDot(reached, current, failed)}</div>
            <div className="ams-step-label">{node}</div>
            {index < 2 ? <div className={`ams-step-line ${meta.step > index + 1 && !expired ? 'ams-step-line-on' : ''}`} /> : null}
          </div>;
        })}
      </div>
      {viewing == 1 ? (currentStep > 1
        ? <div className="ams-hero">
          <span className="tx-ico in" style={{ width: 52, height: 52, margin: '0 auto 12px' }}><Icon path={mdiCheck} size={1.5}></Icon></span>
          <div className="hero-num" style={{ fontSize: 32, color: 'var(--up)', whiteSpace: 'nowrap' }}>+{toFancyMoney(null, booking.amount)} <span style={{ fontSize: '0.5em', color: 'var(--text-2)' }}>{symbolOf(asset)}</span></div>
          <div className="tiny dim" style={{ marginTop: 6 }}>deposit received{fiatValue(equity, asset, booking.amount) != null ? ` · ${fiatValue(equity, asset, booking.amount)}` : ''}</div>
          <div className="ams-hero-hash">{hashRef(booking.depositHash)}</div>
        </div>
        : <DepositCard booking={booking} contract={contract.current ?? ''} status={status} />) : null}
      {viewing == 2 && currentStep < 2 ? <div className="ams-hero ams-stage ams-stage-wait">
        <span className="ams-stage-ico"><Icon path={mdiLockOutline} size={1.4}></Icon></span>
        <div className="ams-stage-title">Authorize execution</div>
        <div className="ams-stage-rows"><div className="dim tiny">unlocks when your deposit confirms</div></div>
      </div> : null}
      {status == 'awaiting_execution' && viewing == 2 ? <Authorize booking={booking} context={context} sequencer={sequencer} onDone={refresh} onOut={setExecOut} onError={setAuthError} /> : null}
      {viewing == 2 && currentStep > 2 ? <div className="ams-hero">
        <span className="tx-ico in" style={{ width: 52, height: 52, margin: '0 auto 12px' }}><Icon path={mdiCheckDecagram} size={1.5}></Icon></span>
        <div className="hero-num" style={{ fontSize: 32, color: 'var(--up)', whiteSpace: 'nowrap' }}>{booking.outAmount != null ? `+${toFancyMoney(null, booking.outAmount)}` : '—'} <span style={{ fontSize: '0.5em', color: 'var(--text-2)' }}>{outSymbol}</span></div>
        <div className="tiny dim" style={{ marginTop: 6 }}>swap executed{outFiat != null ? ` · ${outFiat}` : ''}</div>
        <div className="ams-hero-hash">{hashRef(booking.withdrawHash)}</div>
      </div> : null}
      {viewing == 3 ? (currentStep < 3
        ? <div className="ams-hero ams-stage ams-stage-wait">
          <span className="ams-stage-ico"><Icon path={mdiClockOutline} size={1.4}></Icon></span>
          <div className="ams-stage-title">Finalization</div>
          <div className="ams-stage-rows"><div className="dim tiny">runs automatically after your authorization</div></div>
        </div>
        : status == 'failing_withdrawal' ? <Respend booking={booking} context={context} sequencer={sequencer} onDone={refresh} />
          : status == 'finalized'
            ? <div className="ams-hero ams-stage ams-stage-done">
              <span className="ams-stage-ico"><Icon path={mdiCheckDecagram} size={1.4}></Icon></span>
              <div className="ams-stage-title">Swap complete</div>
              <div className="tiny dim" title={booking.routingAddress ?? undefined} style={{ marginTop: 2 }}>sent {booking.outAmount != null ? toFancyMoney(null, booking.outAmount) : '—'} {outSymbol}{outFiat != null ? ` (${outFiat})` : ''}{booking.routingAddress != null ? ` to ${booking.routingAddress.slice(0, 7)}…${booking.routingAddress.slice(-4)}` : ''}</div>
              <div className="ams-hero-hash">{extId()}{booking.attestateHash != null ? <a className="dl-open" href={'/transaction/' + booking.attestateHash} target="_blank" rel="noreferrer"><Icon path={mdiOpenInNew} size={0.6}></Icon></a> : null}</div>
            </div>
            : status == 'awaiting_withdrawal' ? <div className="ams-hero ams-stage ams-stage-live">
              <span className="ams-stage-ico"><Icon path={mdiProgressDownload} size={1.4}></Icon></span>
              <div className="ams-stage-title">Withdrawal in flight</div>
              <div className="tiny dim" style={{ marginTop: 2 }}>Swap executed, {booking.outAmount != null ? toFancyMoney(null, booking.outAmount) : '—'} {outSymbol}{outFiat != null ? ` (${outFiat}) payout` : ' payout'} queued.</div>
              <div className="ams-hero-hash">{hashRef(booking.withdrawHash)}</div>
            </div>
              : <div className="ams-hero ams-stage ams-stage-live">
                <span className="ams-stage-ico"><Icon path={mdiCloudUpload} size={1.4}></Icon></span>
                <div className="ams-stage-title">Funds on their way</div>
                <div className="tiny dim" style={{ marginTop: 2 }}>Waiting for the destination network to confirm.</div>
                <div className="ams-hero-hash">{extId()}{booking.broadcastHash != null ? <a className="dl-open" href={'/transaction/' + booking.broadcastHash} target="_blank" rel="noreferrer"><Icon path={mdiOpenInNew} size={0.6}></Icon></a> : null}</div>
              </div>) : null}
      {status == 'expired' ? <div className="ams-hero ams-stage ams-stage-bad">
        <span className="ams-stage-ico"><Icon path={mdiAlertCircleOutline} size={1.4}></Icon></span>
        <div className="ams-stage-title">Booking expired</div>
        <div className="ams-stage-rows">
          <div className="dim tiny">recovery via operator repay only — open a support ticket and share:</div>
          <div className="ams-swapid copyable" title="Copy swap id" onClick={copySwapId}>{swapId} <Icon path={mdiContentCopy} size={0.62}></Icon></div>
        </div>
      </div> : null}
      {status == 'lost' ? <div className="ams-hero ams-stage ams-stage-bad">
        <span className="ams-stage-ico"><Icon path={mdiAlertCircleOutline} size={1.4}></Icon></span>
        <div className="ams-stage-title">Lost on-chain</div>
        <div className="ams-stage-rows">
          <div className="dim tiny">settlement failure — open a support ticket and share:</div>
          <div className="ams-swapid copyable" title="Copy swap id" onClick={copySwapId}>{swapId} <Icon path={mdiContentCopy} size={0.62}></Icon></div>
        </div>
      </div> : null}
    </div>
    {authError != null ? <div className="callout err" style={{ marginTop: 14 }}>
      <Icon path={mdiAlertCircleOutline} size={1}></Icon>
      <span>{authError}</span>
    </div> : null}
    <div className="ams-keyfoot">
      {context != null
        ? <button className="ams-keybtn" onClick={backupKeys}><span className="warn">Avoid the risk.</span> Save control keys</button>
        : <label className="ams-keybtn">
          <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={loadBackup} />
          Load control keys
        </label>}
    </div>
  </div></div>;
}