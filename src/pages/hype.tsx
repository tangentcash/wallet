import { mdiArrowLeftRight, mdiCash, mdiCheck, mdiChevronRight, mdiCodeBraces, mdiLightningBoltOutline, mdiLogout, mdiOpenInNew, mdiPickaxe, mdiRocketLaunch, mdiSafe, mdiShieldCheck, mdiTune, mdiVoteOutline, mdiWeatherNight, mdiWeatherSunny } from "@mdi/js";
import { Link, useNavigate } from "react-router";
import { AppData } from "../core/app";
import { Exchange } from "../core/exchange";
import { useEffectAsync } from "../core/react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import { AssetId } from "tangentsdk/algorithm";
import AssetSelector from "../components/exchange/selector";
import { AssetImage } from "../components/asset-image";
import License from "../components/license";
import { secondsToDuration } from "../core/utils";
import './hype.css';


type Metrics = { accounts: string, actions: string, quantity: string, volume: string };

let cachedMetrics: Metrics | null | false = false;
let cachedPrices: Record<string, number> | null | false = false;

function toNiceNumber(number: BigNumber): string {
  const stringify = (value: BigNumber) => value.integerValue().eq(value) ? value.toString() : value.toFixed(1);
  const compress = (rotation: number) => stringify(number.dividedBy(Math.pow(1000.0, rotation)));
  let result = stringify(number);
  if (number.gt(1000000000000000))
    result = compress(5) + 'Q';
  else if (number.gt(1000000000))
    result = compress(3) + 'B';
  else if (number.gt(1000000))
    result = compress(2) + 'M';
  else if (number.gt(1000))
    result = compress(1) + 'K';
  return result;
}
function toNiceAmount(amount: BigNumber): string {
  return '$' + toNiceNumber(amount.integerValue());
}
function toNiceRate(rate: BigNumber): string {
  if (rate.gte(1000))
    return rate.toFormat(0);
  if (rate.gte(1))
    return rate.toFixed(rate.gte(100) ? 1 : 4);
  return parseFloat(rate.toPrecision(4)).toString();
}

const genesisTimeDEX = new Date(1772732892203);
const blockchains = [
  ['ADA', 'Cardano'],
  ['BTC', 'Bitcoin'],
  ['ETH', 'Ethereum'],
  ['SOL', 'Solana'],
  ['TRX', 'Tron'],
  ['XRP', 'Ripple'],
  ['XLM', 'Stellar'],
  ['BCH', 'Bitcoin Cash'],
  ['LTC', 'Litecoin'],
  ['DOGE', 'Dogecoin'],
  ['XMR', 'Monero']
].sort();
type MarketRow = { icon: string, quoteIcon: string, label: string, price: string, change: number, volume: BigNumber };
let cachedPairs: MarketRow[] | null | false = false;


function assetQueryKey(asset: AssetId): string {
  const chain = (asset.chain || '').toUpperCase();
  const token = (asset.token || '').toUpperCase();
  return token.length > 0 ? `${chain}:${token}` : chain;
}
function priceKey(asset: AssetId): string {
  return ((asset.token && asset.token.length > 0 ? asset.token : asset.chain) || '').toUpperCase();
}
function assetLabel(asset: AssetId): string {
  return asset.token || asset.chain || 'token';
}

function BookingWidget(props: { prices: Record<string, number> | null }) {
  const navigate = useNavigate();
  const [payAsset, setPayAsset] = useState<AssetId | null>(() => { try { return AssetId.fromHandle('BTC'); } catch { return null; } });
  const [receiveAsset, setReceiveAsset] = useState<AssetId | null>(() => { try { return AssetId.fromHandle('ETH'); } catch { return null; } });
  const [amount, setAmount] = useState('');
  const values = useMemo(() => {
    const value = new BigNumber(amount);
    const priceIn = payAsset != null ? props.prices?.[priceKey(payAsset)] ?? null : null;
    const priceOut = receiveAsset != null ? props.prices?.[priceKey(receiveAsset)] ?? null : null;
    if (!value.isFinite() || value.lte(0) || priceIn == null || priceOut == null || priceOut === 0)
      return null;
    const out = value.times(priceIn).dividedBy(priceOut);
    return { out: parseFloat(out.toPrecision(6)).toString(), rate: priceIn / priceOut };
  }, [props.prices, payAsset, receiveAsset, amount]);
  const bookSwap = () => {
    if (payAsset == null || receiveAsset == null)
      return;
    const query = new URLSearchParams({ pay: assetQueryKey(payAsset), recv: assetQueryKey(receiveAsset) });
    if (amount.trim().length > 0 && new BigNumber(amount).isFinite() && new BigNumber(amount).gt(0))
      query.set('amount', amount);
    navigate(`/swaps?${query.toString()}`);
  };
  return (
    <div className="bk" data-reveal>
      <div className="bk-head">
        <b>Atomic swap</b>
        <span className="bk-live"><span className="bk-pulse"></span>live rate</span>
      </div>
      <div className="bk-row">
        <AssetSelector title="You pay" value={payAsset} onChange={setPayAsset} offchain>
          <button className="token-select bk-select">{ payAsset != null ? <><AssetImage asset={payAsset} size="2" iconSize="22px"></AssetImage> { assetLabel(payAsset) }</> : 'Select' }</button>
        </AssetSelector>
        <input className="bk-amount" aria-label="Amount" type="text" inputMode="decimal" placeholder="0.0" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}></input>
      </div>
      <div className="bk-flip-holder">
        <button className="bk-flip" aria-label="Flip direction" onClick={() => { const next = payAsset; setPayAsset(receiveAsset); setReceiveAsset(next); }}><Icon path={mdiArrowLeftRight} size={0.95}></Icon></button>
      </div>
      <div className="bk-row">
        <AssetSelector title="You receive" value={receiveAsset} onChange={setReceiveAsset} offchain>
          <button className="token-select bk-select">{ receiveAsset != null ? <><AssetImage asset={receiveAsset} size="2" iconSize="22px"></AssetImage> { assetLabel(receiveAsset) }</> : 'Select' }</button>
        </AssetSelector>
        { values != null ? <span className="bk-est">~{ values.out }</span> : <span className={props.prices == null ? 'bk-est dim' : 'bk-est'}>{ props.prices == null ? 'loading rate…' : '0.0' }</span> }
      </div>
      <div className="bk-rate"><span>Indicative rate</span><b>{ values != null && payAsset != null && receiveAsset != null ? `1 ${assetLabel(payAsset)} ≈ ${toNiceRate(new BigNumber(values.rate))} ${assetLabel(receiveAsset)}` : '·' }</b></div>
      <div className="bk-exclude">Market price only, P2P network gas fees are not included</div>
      <button className="sg-btn bk-btn" disabled={payAsset == null || receiveAsset == null} onClick={bookSwap}>Swap now <Icon path={mdiChevronRight} size={0.9}></Icon></button>
      <div className="bk-note">Non-custodial. Opens in your wallet.</div>
    </div>
  );
}

export default function HypePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [pairs, setPairs] = useState<MarketRow[] | null>(null);
  useEffect(() => {
    AppData.setTitle();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const countUp = (target: Element) => {
      if (reduced)
        return;
      target.querySelectorAll('.aw-stat b').forEach((stat) => {
        const match = /^(\$?)([\d.,]+)(.*)$/.exec(stat.textContent || '');
        if (!match)
          return;
        const value = parseFloat(match[2].replace(/,/g, ''));
        const decimals = (match[2].split('.')[1] || '').length;
        const start = performance.now();
        stat.textContent = match[1] + (0).toFixed(decimals) + match[3];
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / 1200);
          stat.textContent = match[1] + (value * (1 - Math.pow(1 - progress, 3))).toFixed(decimals) + match[3];
          if (progress < 1)
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          if (entry.target.classList.contains('aw-stats'))
            countUp(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.hype-page [data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [metrics]);
  useEffectAsync(async () => {
    if (cachedMetrics === false) {
      try {
        const metrics = await Exchange.marketMetrics();
        cachedMetrics = {
          accounts: toNiceNumber(new BigNumber(metrics.accounts)),
          actions: toNiceNumber(new BigNumber(metrics.actions)),
          quantity: toNiceAmount(new BigNumber(metrics.quantity.toFixed(2))),
          volume: toNiceAmount(new BigNumber(metrics.volume.toFixed(2)).dividedBy(Math.max(1, Math.floor(Math.abs(new Date().getTime() - genesisTimeDEX.getTime()) / 86_400_000))))
        };
      } catch {
        cachedMetrics = null;
      }
    }
    setMetrics(cachedMetrics);
  }, []);
  useEffectAsync(async () => {
    if (cachedPrices === false) {
      try {
        const descriptors = await Exchange.assetPrices();
        const map: Record<string, number> = { };
        for (const key in descriptors) {
          const close = descriptors[key]?.price?.close;
          if (close != null && close.isFinite() && close.gt(0))
            map[key] = close.toNumber();
        }
        cachedPrices = Object.keys(map).length > 1 ? map : null;
      } catch {
        cachedPrices = null;
      }
    }
    setPrices(cachedPrices);
  }, []);
  useEffectAsync(async () => {
    if (cachedPairs === false) {
      try {
        const pairs = await Exchange.marketPairs();
        const rows: MarketRow[] = pairs.map((pair) => {
          const primary = pair.primaryAsset.token || pair.primaryAsset.chain || '';
          const secondary = pair.secondaryAsset.token || pair.secondaryAsset.chain || '';
          const close = new BigNumber(pair.price.close ?? 0);
          const open = new BigNumber(pair.price.open ?? 0);
          return {
            icon: primary.toLowerCase(),
            quoteIcon: secondary.toLowerCase(),
            label: `${primary} / ${secondary}`,
            price: toNiceRate(close),
            change: open.gt(0) ? close.minus(open).dividedBy(open).times(100).toNumber() : 0,
            volume: new BigNumber(pair.price.totalVolume || 0)
          };
        });
        rows.sort((a, b) => b.volume.minus(a.volume).toNumber());
        cachedPairs = rows.length > 0 ? rows.slice(0, 5) : null;
      } catch {
        cachedPairs = null;
      }
    }
    setPairs(cachedPairs);
  }, []);
  const [dark, setDark] = useState(AppData.props.appearance == 'dark');
  const maxVolume = pairs != null && pairs.length > 0 ? pairs[0].volume : null;
  const barWidth = (row: MarketRow) => maxVolume == null || maxVolume.lte(0) ? 4 : Math.max(4, Math.round(100 * Math.sqrt(Math.min(1, row.volume.dividedBy(maxVolume).toNumber()))));
  return (
    <div className="hype-page">
      <header className="aw-topbar">
        <div className="aw-bar-inner">
          <a className="aw-bar-brand" href="#"><img src="/cryptocurrency/tan.svg" alt=""></img>Tangent Cash</a>
          <div className="aw-bar-links">
            <a className="aw-bar-link" href="https://tangent.cash/docs" target="_blank" rel="noopener noreferrer">Docs</a>
            <Link className="aw-bar-link" to="/legal">Legal</Link>
            <Link className="aw-bar-link" to="/explorer">Explorer</Link>
            <button className="aw-bar-theme" aria-label="Switch theme" onClick={() => { const next = dark ? 'light' : 'dark'; AppData.setAppearance(next); setDark(next == 'dark'); }}>
              <Icon path={dark ? mdiWeatherSunny : mdiWeatherNight} size={1.05}></Icon>
            </button>
          </div>
        </div>
      </header>

      <section className="sg sg-hero">
        <div className="aw-inner sg-center" style={{ textAlign: 'center', width: '100%' }}>
          <h1 className="sg-h1" data-reveal>One wallet.<br></br>All your money.</h1>
          <p className="sg-sub" style={{ marginInline: 'auto', marginBottom: 0 }} data-reveal>Cross-chain swaps. Open market. Instant payments.</p>
          <div className="sg-cta-row" style={{ justifyContent: 'center' }} data-reveal>
            <Link to="/restore" className="sg-btn">{ AppData.isWalletExists() ? 'Back to app' : 'Create a wallet' }</Link>
            <Link to="/explorer" className="sg-btn ghost">Just look around</Link>
          </div>
          <div style={{ marginTop: 'clamp(40px, 5.5vh, 56px)' }}>
            <BookingWidget prices={prices}></BookingWidget>
          </div>
        </div>
      </section>

      <section className="sg sg-trade sg-alt">
        <div className="aw-inner">
          <div className="sg-head">
            <div>
              <div className="sg-kicker" data-reveal><span className="sg-kicker-num">01</span>Trading</div>
              <h2 className="sg-h2" data-reveal>Prices made by <span className="sg-accent">people.</span></h2>
            </div>
            <p className="sg-sub" data-reveal>The crowd sets the price. Market, limit, stop, trailing. Zero fees, fills settled on-chain.</p>
          </div>
          <div className="mk-card" data-reveal>
            {
              pairs == null ? [0, 1, 2, 3, 4].map((index) =>
                <div className={'mk-row' + (index == 0 ? ' feature' : '')} key={index}>
                  <span className="mk-pair mk-wait">Fetching market data</span>
                  <span className="mk-bar"></span>
                  <span className="mk-price mk-wait">·······</span>
                  <span className="mk-chg">·</span>
                </div>) :
              pairs.map((row, index) =>
                <div className={'mk-row' + (index == 0 ? ' feature' : '')} key={row.label}>
                  <span className="mk-pair"><span className="mk-ico"><img src={`/cryptocurrency/${row.icon}.svg`} alt=""></img><img src={`/cryptocurrency/${row.quoteIcon}.svg`} alt=""></img></span>{ row.label }</span>
                  <span className="mk-bar"><i className={row.change >= 0 ? 'up' : 'down'} style={{ '--w': barWidth(row) + '%' } as CSSProperties}></i></span>
                  <span className="mk-price">{ row.price }</span>
                  <span className={'mk-chg ' + (row.change >= 0 ? 'up' : 'down')}>{ (row.change >= 0 ? '+' : '') + row.change.toFixed(2) + '%' }</span>
                </div>)
            }
          </div>
          <div className="sg-pills" data-reveal>
            <span className="sg-pill"><Icon path={mdiCash} size={0.85}></Icon>0.00% trading fees</span>
            <span className="sg-pill"><Icon path={mdiLightningBoltOutline} size={0.85}></Icon>~12 s settlement</span>
            <span className="sg-pill"><Icon path={mdiCheck} size={0.85}></Icon>No membership</span>
            <span className="sg-pill"><Icon path={mdiTune} size={0.85}></Icon>Market · limit · stop · trailing</span>
          </div>
          <div className="sg-cta-row" data-reveal><Link to="/markets" className="sg-btn">Open the market <Icon path={mdiChevronRight} size={0.85}></Icon></Link></div>
        </div>
      </section>

      <section className="sg sg-earn">
        <div className="aw-inner">
          <div className="en-grid">
            <div>
              <div className="sg-kicker" data-reveal><span className="sg-kicker-num">02</span>Earn</div>
              <h2 className="sg-h2" data-reveal>Idle money,<br></br><span className="sg-accent">clocked in.</span></h2>
              <p className="sg-sub" data-reveal>Post liquidity. Set the fee. Collect on every trade.</p>
              <div className="sg-pills" data-reveal>
                <span className="sg-pill"><Icon path={mdiCash} size={0.85}></Icon>Fees on every fill</span>
                <span className="sg-pill"><Icon path={mdiShieldCheck} size={0.85}></Icon>Non-custodial</span>
                <span className="sg-pill"><Icon path={mdiLogout} size={0.85}></Icon>Exit anytime</span>
              </div>
              <div className="sg-cta-row" data-reveal><Link to="/markets" className="sg-btn dark">Open a pool <Icon path={mdiChevronRight} size={0.85}></Icon></Link></div>
            </div>
            <div className="en-stack" data-reveal>
              <div className="en-ghost"></div>
              <div className="en-card">
                <div className="en-card-head"><b>BTC / USDT pool</b><span>live</span></div>
                <div className="en-row"><span>Your share of the pool</span><b>12.4%</b></div>
                <div className="en-row"><span>Fees earned, 24 h</span><b className="up">+ $18.40</b></div>
                <div className="en-row"><span>Pool volume, 24 h</span><b>$146.9K</b></div>
                <div className="en-row"><span>Trading fee you set</span><b>0.25%</b></div>
                <div className="en-bar"><i></i></div>
                <div className="en-foot">Withdraw any part at any time.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sg sg-pay sg-alt">
        <div className="aw-inner">
          <div className="py-grid">
            <div className="py-visual" data-reveal>
              <div className="py-chat">
                <div className="chat">
                  <div className="chat-bubble out">Rent’s here. <span className="mono">tc1x9f…4kcq</span></div>
                  <div className="chat-bubble in">Received. No fee, about 12 seconds.</div>
                  <div className="chat-bubble out">Salary batch of 40, one transaction.</div>
                  <div className="chat-bubble in">All forty landed. Twelve seconds?</div>
                </div>
                <div className="py-status"><span className="bk-pulse"></span>Delivered · 12 s · fee $0.41</div>
              </div>
            </div>
            <div>
              <div className="sg-kicker" data-reveal><span className="sg-kicker-num">03</span>Payments</div>
              <h2 className="sg-h2" data-reveal>Money moves at<br></br><span className="sg-accent">texting speed.</span></h2>
              <p className="sg-sub" data-reveal>Any chain. About twelve seconds. Receiving is free.</p>
              <div className="sg-list" data-reveal>
                <div className="sg-mini"><Icon path={mdiCheck} size={1}></Icon>Receive from any chain<b>free</b></div>
                <div className="sg-mini"><Icon path={mdiLightningBoltOutline} size={1}></Icon>Settlement time<b>~12 s</b></div>
              </div>
              <div className="sg-cta-row" data-reveal><Link to="/interaction" className="sg-btn">Send a payment <Icon path={mdiChevronRight} size={0.85}></Icon></Link></div>
            </div>
          </div>
        </div>
      </section>

      <section className="sg sg-run">
        <div className="aw-inner">
          <div className="rn-grid">
            <div className="rn-head">
              <div className="sg-kicker" data-reveal><span className="sg-kicker-num">04</span>Governance</div>
              <h2 className="sg-h2" data-reveal>Run and use<br></br><span className="sg-accent">the network.</span></h2>
              <p className="sg-sub" data-reveal>The rules are code. The jobs are open. Operators keep the fees.</p>
              <div className="sg-pills" data-reveal>
                <span className="sg-pill"><Icon path={mdiVoteOutline} size={0.85}></Icon>Rules enforced by code, not staff</span>
                <span className="sg-pill"><Icon path={mdiRocketLaunch} size={0.85}></Icon>Permissionless onboarding</span>
              </div>
            </div>
            <div className="rn-board" data-reveal>
              <Link className="rn-job" to="/interaction?type=configure">
                <span className="rn-idx">J1</span>
                <div className="rn-job-body"><b><Icon path={mdiPickaxe} size={0.95}></Icon>Mine</b><p>Produce blocks on a chain that finalizes in ~12 seconds.</p></div>
                <span className="rn-open">Open <Icon path={mdiChevronRight} size={0.7}></Icon></span>
              </Link>
              <Link className="rn-job" to="/interaction?type=configure">
                <span className="rn-idx">J2</span>
                <div className="rn-job-body"><b><Icon path={mdiShieldCheck} size={0.95}></Icon>Bridge attestation</b><p>Stake against bridge deposits. Attest honestly, collect fees.</p></div>
                <span className="rn-open">Open <Icon path={mdiChevronRight} size={0.7}></Icon></span>
              </Link>
              <Link className="rn-job" to="/interaction?type=configure">
                <span className="rn-idx">J3</span>
                <div className="rn-job-body"><b><Icon path={mdiSafe} size={0.95}></Icon>Bridge participation</b><p>Co-sign a public vault committee. No single key holder.</p></div>
                <span className="rn-open">Open <Icon path={mdiChevronRight} size={0.7}></Icon></span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sg sg-build">
        <div className="aw-inner">
          <div className="bd-head">
            <div>
              <div className="sg-kicker" data-reveal><span className="sg-kicker-num">05</span>Development</div>
              <h2 className="sg-h2" data-reveal>Ship on <span className="sg-accent">Layer 1.</span></h2>
            </div>
            <p className="sg-sub" data-reveal>Deploy programs to a public chain. Twelve-second blocks, open SDK.</p>
          </div>
          <div className="sg-term bd-term" data-reveal>
            <div><code><span className="k">import</span> &#123; RPC, AssetId &#125; <span className="k">from</span> <span className="s">"tangentsdk"</span>;</code></div>
            <div><code>RPC.<span className="f">applyValidator</span>(<span className="s">'localhost:18419'</span>);</code></div>
            <div><code></code></div>
            <div><code><span className="k">const</span> from = <span className="s">'tc1yllllllllllllllllllllllllllllllllapqkuv'</span>;</code></div>
            <div><code><span className="k">const</span> to = <span className="s">'tc1yqvhd2yz2a0amnluq0z9m8kstujdhsg4l6ps0vd'</span>;</code></div>
            <div><code><span className="k">const</span> base = AssetId.<span className="f">fromHandle</span>(<span className="s">'BTC'</span>);</code></div>
            <div><code><span className="k">const</span> quote = AssetId.<span className="f">fromHandle</span>(<span className="s">'TAN'</span>, <span className="s">'USDC'</span>, to);</code></div>
            <div><code><span className="k">const</span> args = [<span className="s">'best_price_of'</span>, [base.<span className="f">toUint256</span>(), quote.<span className="f">toUint256</span>(), <span className="c">0</span>]];</code></div>
            <div><code><span className="k">const</span> receipt = <span className="k">await</span> RPC.<span className="f">callTransaction</span>(base, from, to, args[<span className="c">0</span>], args[<span className="c">1</span>]);</code></div>
            <div><code><span className="k">const</span> price = receipt.result.<span className="f">toString</span>();</code></div>
            <div><code>console.<span className="f">log</span>(price);</code></div>
          </div>
          <div className="sg-cta-row" data-reveal><a className="sg-btn ghost" href="https://tangent.cash/docs" target="_blank" rel="noopener noreferrer">Developer docs <Icon path={mdiOpenInNew} size={0.85}></Icon></a><Link to="/explorer" className="sg-btn ghost">Browse programs <Icon path={mdiCodeBraces} size={0.85}></Icon></Link></div>
        </div>
      </section>

      <section className="sg sg-lime">
        <div className="aw-inner">
          <div className="sg-kicker" data-reveal><span className="sg-kicker-num">06</span>Proof</div>
          <h2 className="sg-h2" data-reveal>Real money,<br></br>right now.</h2>
          {
            metrics != null &&
            <div className="aw-stats" data-reveal>
              <div className="aw-stat"><b>{ metrics.accounts }</b><span>users on the network</span></div>
              <div className="aw-stat"><b>{ metrics.actions }</b><span>actions completed</span></div>
              <div className="aw-stat"><b>{ metrics.quantity }</b><span>held in the market</span></div>
              <div className="aw-stat"><b>{ metrics.volume }</b><span>traded every day</span></div>
            </div>
          }
          <div className="nl-strip" data-reveal>
            <span className="nl-chip feat">{ blockchains.length } networks · one balance</span>
            {
              blockchains.map((chain) =>
                <span className="nl-chip" key={chain[0]}><img src={`/cryptocurrency/${chain[0].toLowerCase()}.svg`} alt=""></img>{ chain[1] }</span>)
            }
          </div>
          {
            metrics != null &&
            <div className="aw-since" data-reveal>{ secondsToDuration((new Date().getTime() - genesisTimeDEX.getTime()) / 1000) } live. Bridged, not wrapped. Not testnet.</div>
          }
        </div>
      </section>

      <section className="sg sg-closer">
        <div className="aw-inner" style={{ textAlign: 'center' }}>
          <h2 className="sg-h2 sg-h2-closer" data-reveal style={{ marginInline: 'auto' }}>Your first transaction<br></br>is two minutes <span className="sg-accent">away.</span></h2>
          <div className="aw-chips" data-reveal>
            <span className="aw-chip">No e-mail</span>
            <span className="aw-chip">No documents</span>
            <span className="aw-chip">0.00% trading fees</span>
            <span className="aw-chip">Keys never leave this device</span>
          </div>
          <div data-reveal style={{ marginTop: 40 }}>
            <Link to="/restore" className="sg-btn">{ AppData.isWalletExists() ? 'Back to app' : 'Create a wallet' } <Icon path={mdiChevronRight} size={0.9}></Icon></Link>
          </div>
        </div>
        <div style={{ paddingTop: 80 }}>
          <License title={true}></License>
        </div>
      </section>
    </div>
  );
}
