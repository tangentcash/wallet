import { mdiArrowDown, mdiArrowRight, mdiCheck, mdiChevronDown, mdiChevronRight, mdiFlash, mdiFlashAlert, mdiFlashOutline, mdiLogin, mdiWeatherNight, mdiWeatherSunny } from "@mdi/js";
import { Avatar, Flex, Text } from "@radix-ui/themes";
import { Link } from "react-router";
import { AppData } from "../core/app";
import { useEffectAsync } from "../core/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import License from "../components/license";
import { secondsToDuration } from "../core/utils";
import './hype.css';

type Metrics = { assets: string, pairs: string, accounts: string, actions: string, quantity: string, volume: string };

let cachedMetrics: Metrics | null | false = false;

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
function toNiceCount(count: BigNumber, label: string): string {
  return toNiceNumber(count) + ' ' + (count.gt(1) ? label + 's' : label);
}
function toNiceAmount(amount: BigNumber): string {
  return '$' + toNiceNumber(amount.integerValue());
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
const bookAsks: [string, string, number][] = [['68,540.00', '0.42', 34], ['68,512.50', '1.15', 62], ['68,489.00', '0.68', 45]];
const bookBids: [string, string, number][] = [['68,467.00', '2.10', 78], ['68,431.20', '0.95', 48], ['68,402.80', '1.60', 63]];
const orderTypes = ['Market', 'Limit', 'Stop', 'Stop-limit', 'Trailing', 'Trailing-limit'];
const hubCoins: [string, string][] = [['btc', 'Bitcoin'], ['eth', 'Ethereum'], ['sol', 'Solana'], ['trx', 'Tron']];
const hubOutcomes = ['One order book', 'One rulebook', 'One settlement'];

export default function HypePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
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
        const response = await fetch('https://p2p.tangent.cash:19420/market/metrics');
        const result = (await response.json()).result;
        cachedMetrics = {
          assets: toNiceCount(new BigNumber(result.assets), 'token'),
          pairs: toNiceCount(new BigNumber(result.pairs), 'trading pair'),
          accounts: toNiceNumber(new BigNumber(result.accounts)),
          actions: toNiceNumber(new BigNumber(result.actions)),
          quantity: toNiceAmount(new BigNumber(new BigNumber(result.quantity).toFixed(2))),
          volume: toNiceAmount(new BigNumber(new BigNumber(result.volume).toFixed(2)).dividedBy(Math.max(1, Math.floor(Math.abs(new Date().getTime() - genesisTimeDEX.getTime()) / 86_400_000))))
        };
      } catch {
        cachedMetrics = null;
      }
    }
    setMetrics(cachedMetrics);
  }, []);
  const heroRef = useRef<HTMLElement>(null);
  const mockRef = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(AppData.props.appearance == 'dark');
  useEffect(() => {
    const hero = heroRef.current;
    const mock = mockRef.current;
    if (!hero || !mock)
      return;
    if (!window.matchMedia('(hover: hover)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    let raf = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = hero.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        mock.style.transform = `perspective(1200px) rotateY(${(x * 6).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      mock.style.transform = '';
    };
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
    };
  }, []);
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

      <section className="aw-hero" ref={heroRef}>
        <div className="aw-inner" style={{ textAlign: 'center' }}>
          <div className="aw-kicker" data-reveal><span className="aw-kicker-dot"></span>Tangent Cash</div>
          <h1 className="aw-h1" data-reveal>One wallet.<br></br>All your money.</h1>
          <p className="aw-sub" style={{ marginInline: 'auto' }} data-reveal>Buy, sell and send crypto — your keys, your coins, no middlemen.</p>
          <div data-reveal style={{ marginTop: 36 }}>
            <Link to="/restore" className="aw-cta">{ AppData.isWalletExists() ? 'Back to app' : 'Create a wallet' } <Icon path={mdiLogin} size={0.9}></Icon></Link>
          </div>
          <div className="aw-hero-mock" data-reveal>
            <div className="aw-mock" ref={mockRef}>
              <div className="aw-mock-head">
                <span className="aw-mock-brand">TANGENT CASH</span>
                <span className="aw-mock-live"><span className="aw-mock-pulse"></span>live</span>
              </div>
              <div className="aw-mock-label">Total balance</div>
              <div className="aw-mock-balance">≈ $1,240.50</div>
              <div className="aw-mock-delta">+ $38.20 today</div>
              <div className="aw-mock-row"><img src="/cryptocurrency/usdc.svg" alt=""></img><div className="aw-mock-name"><div className="aw-mock-n">USDC</div><div className="aw-mock-s">stablecoin</div></div><div className="aw-mock-val"><div className="aw-mock-n">820.00</div><div className="aw-mock-up">+2.4%</div></div></div>
              <div className="aw-mock-row"><img src="/cryptocurrency/sol.svg" alt=""></img><div className="aw-mock-name"><div className="aw-mock-n">SOL</div><div className="aw-mock-s">Solana</div></div><div className="aw-mock-val"><div className="aw-mock-n">12.5</div><div className="aw-mock-up">+5.1%</div></div></div>
              <div className="aw-mock-row"><img src="/cryptocurrency/btc.svg" alt=""></img><div className="aw-mock-name"><div className="aw-mock-n">BTC</div><div className="aw-mock-s">Bitcoin</div></div><div className="aw-mock-val"><div className="aw-mock-n">0.0084</div><div className="aw-mock-up">+1.1%</div></div></div>
              <Flex gap="2" pt="3">
                <div className="aw-mock-btn">Swap</div>
                <div className="aw-mock-btn ghost">Send</div>
              </Flex>
            </div>
          </div>
          <div className="aw-cue" data-reveal>Why Tangent Cash? <Icon path={mdiArrowDown} size={0.8}></Icon></div>
        </div>
      </section>

      <section className="aw-section aw-panel">
        <div className="aw-inner">
          <div className="aw-kicker" data-reveal><span className="aw-kicker-dot"></span>What it is</div>
          <h2 className="aw-h2" data-reveal>Not an exchange.<br></br><span className="aw-accent">A wallet.</span></h2>
          <p className="aw-sub" data-reveal>A self-custody crypto wallet with the market built in. Your coins live on a blockchain only you can spend from — and coins from all over the world can arrive there.</p>
          <div className="aw-cards">
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">Your keys,</span><br></br>your device.</h3>
              <div className="aw-card-text">Credentials are encrypted and stored on this device. Every transaction is signed locally — your key never goes anywhere, not even when you browse the market.</div>
            </div>
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">No sign-up.</span><br></br>No KYC.</h3>
              <div className="aw-card-text">No e-mail, no phone number, no documents, no approval queue. And nobody can freeze, cap or reverse your money — not even us.</div>
            </div>
            <div className="aw-card lime" data-reveal>
              <h3 className="aw-h3" style={{ color: 'var(--aw-ink)' }}>Open code.<br></br>Open market.</h3>
              <div className="aw-card-text">Every trade settles on a public blockchain and the app is open source. Don’t want to trust our servers? Point the wallet at your own node.</div>
            </div>
          </div>
          <a className="aw-link" href="#networks">How { blockchains.length } networks become one balance <Icon path={mdiChevronRight} size={0.85}></Icon></a>
        </div>
      </section>

      <section className="aw-section">
        <div className="aw-inner">
          <div className="aw-kicker" data-reveal><span className="aw-kicker-dot"></span>Swap</div>
          <h2 className="aw-h2" data-reveal>Swap in seconds.<br></br><span className="aw-accent">Zero fees.</span></h2>
          <p className="aw-sub" data-reveal>Trade one coin for another, straight from your wallet. Each swap is routed along the best available path — across liquidity pools or straight over the order book.</p>
          <div className="aw-cards">
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">You pay.</span><br></br>You receive.<br></br>That’s it.</h3>
              <div className="aw-swap">
                <div className="aw-swap-row"><span className="aw-swap-k">You pay</span><span className="aw-swap-v">10.0</span><img src="/cryptocurrency/sol.svg" alt=""></img></div>
                <div className="aw-swap-arrow"><Icon path={mdiArrowDown} size={0.7} color="var(--aw-ink)"></Icon></div>
                <div className="aw-swap-row"><span className="aw-swap-k">You receive</span><span className="aw-swap-v">1,742.10</span><img src="/cryptocurrency/usdc.svg" alt=""></img></div>
                <div className="aw-swap-note">Best route · you control the slippage</div>
              </div>
            </div>
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">The cost of trading:</span></h3>
              <div className="aw-zero">$0.00</div>
              <div className="aw-zero-label">in trading fees. ever.</div>
              <div className="aw-card-text">You only pay the 0.10% market spread — the price of the coin itself. High-volume traders pay even less.</div>
            </div>
          </div>
          <div className="aw-chips" data-reveal>
            <span className="aw-chip">Anyone can open a market</span>
            <span className="aw-chip">Real buyers meet real sellers</span>
            <span className="aw-chip">Every fill settles on-chain</span>
          </div>
          <a className="aw-link" href="#market">See the book behind every price <Icon path={mdiChevronRight} size={0.85}></Icon></a>
        </div>
      </section>

      <section id="market" className="aw-section aw-panel">
        <div className="aw-inner">
          <div className="aw-kicker" data-reveal><span className="aw-kicker-dot"></span>The market</div>
          <h2 className="aw-h2" data-reveal>Prices made by people.<br></br><span className="aw-accent">Not quoted by a bot.</span></h2>
          <p className="aw-sub" data-reveal>Behind every price is a real order book — bids and asks from real people, with the depth and every trade visible. The same desk professional traders use, with no account to open and nobody to approve you.</p>
          <div className="aw-cards">
            <div className="aw-card" data-reveal>
              <div className="aw-book-head"><b>BTC / USDC</b><span>live book</span></div>
              <div className="aw-book">
                {
                  bookAsks.map((row) =>
                    <div className="aw-book-row ask" key={row[0]} style={{ '--w': row[2] + '%' } as CSSProperties}><i></i><span className="p">{ row[0] }</span><span className="q">{ row[1] }</span></div>)
                }
                <div className="aw-book-spread">spread 0.03%</div>
                {
                  bookBids.map((row) =>
                    <div className="aw-book-row bid" key={row[0]} style={{ '--w': row[2] + '%' } as CSSProperties}><i></i><span className="p">{ row[0] }</span><span className="q">{ row[1] }</span></div>)
                }
              </div>
              <div className="aw-card-text" style={{ marginTop: 16 }}>Every level is an order a real person placed. Prices move because people move them.</div>
            </div>
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">Every order type,</span> no membership.</h3>
              <div className="aw-card-text">Market, limit, stop, trailing — the full toolset of a trading desk, with the fee and exactly what you’ll receive shown before you commit to anything.</div>
              <div className="aw-chips" style={{ marginTop: 16 }}>
                { orderTypes.map((type) => <span className="aw-chip" key={type} style={{ padding: '8px 16px', fontSize: 13 }}>{ type }</span>) }
              </div>
            </div>
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">Your balance</span> can be the market.</h3>
              <div className="aw-card-text">Post a liquidity pool at a price range you choose and set the fee it charges. Every swap routed through you pays you — and your coins never leave your wallet.</div>
            </div>
          </div>
          <a className="aw-link" href="#why">The chain underneath it all <Icon path={mdiChevronRight} size={0.85}></Icon></a>
        </div>
      </section>

      <section id="networks" className="aw-section">
        <div className="aw-inner">
          <div className="aw-kicker" data-reveal><span className="aw-kicker-dot"></span>Networks</div>
          <h2 className="aw-h2" data-reveal>{ blockchains.length } networks.<br></br><span className="aw-accent">One balance.</span></h2>
          <p className="aw-sub" data-reveal>The coins you already own all work here. And stablecoins from every supported network arrive as one unified USDC — one balance, one market, no per-chain juggling.</p>
          <div className="aw-chains">
            {
              blockchains.map((chain, i) =>
                <div className="aw-chain" key={chain[0]} data-reveal style={{ transitionDelay: `${ i * 45 }ms` }}>
                  <Avatar size="5" fallback={chain[1]} src={`/cryptocurrency/${chain[0].toLowerCase()}.svg`}></Avatar>
                  <Text size="2">{ chain[1] }</Text>
                </div>)
            }
          </div>
          <div className="aw-flow" data-reveal>
            <div className="aw-flow-src">
              <img src="/cryptocurrency/sol.svg" alt=""></img>
              <img src="/cryptocurrency/eth.svg" alt=""></img>
              <img src="/cryptocurrency/trx.svg" alt=""></img>
              <img src="/cryptocurrency/base.svg" alt=""></img>
              <img src="/cryptocurrency/arb.svg" alt=""></img>
            </div>
            <Icon path={mdiArrowRight} size={1.4} color="var(--aw-lime)"></Icon>
            <div className="aw-flow-dst">
              <img src="/cryptocurrency/usdc.svg" alt=""></img>
              <span>One USDC. Every network.</span>
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="aw-section aw-panel">
        <div className="aw-inner">
          <div className="aw-kicker" data-reveal><span className="aw-kicker-dot"></span>The chain</div>
          <h2 className="aw-h2" data-reveal>Why its own blockchain?<br></br><span className="aw-accent">Someone had to be neutral.</span></h2>
          <p className="aw-sub" data-reveal>Bitcoin can’t host a market. App chains can’t hold Bitcoin. Tangent is a blockchain built for one job: a neutral middle ground where coins from every network — old and new — meet, trade and settle. Under rules no side can bend.</p>
          <div className="aw-hub" data-reveal>
            <div className="aw-hub-col">
              {
                hubCoins.map((coin) =>
                  <div className="aw-hub-node" key={coin[0]}><img src={`/cryptocurrency/${coin[0]}.svg`} alt=""></img>{ coin[1] }</div>)
              }
            </div>
            <div className="aw-hub-core">
              <img src="/cryptocurrency/tan.svg" alt=""></img>
              <b>Tangent</b>
              <small>Layer 1</small>
            </div>
            <div className="aw-hub-col">
              {
                hubOutcomes.map((outcome) =>
                  <div className="aw-hub-node out" key={outcome}><span className="aw-hub-dot"></span>{ outcome }</div>)
              }
            </div>
          </div>
          <div className="aw-chips">
            <span className="aw-chip">Old chains get a market too</span>
            <span className="aw-chip">One network, one set of rules</span>
            <span className="aw-chip">Nothing to trust in between</span>
          </div>
        </div>
      </section>

      <section id="in-out" className="aw-section">
        <div className="aw-inner">
          <div className="aw-kicker" data-reveal><span className="aw-kicker-dot"></span>In and out</div>
          <h2 className="aw-h2" data-reveal>Money in.<br></br><span className="aw-accent">Money out.</span></h2>
          <p className="aw-sub" data-reveal>Bring coins in from any wallet, on any supported chain. Take them back out anytime. No deposits to wait on, no withdrawal queues, no office hours.</p>
          <div className="aw-cards">
            <div className="aw-card lime" data-reveal>
              <div className="aw-check"><Icon path={mdiCheck} size={1.6} color="var(--aw-lime)"></Icon></div>
              <h3 className="aw-h3" style={{ color: 'var(--aw-ink)' }}>Free to receive</h3>
              <div className="aw-card-text">Money arriving in your wallet never costs anything. On any network, from anyone, at any time.</div>
            </div>
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">Flat-fee</span> sending</h3>
              <div className="aw-card-text" style={{ marginBottom: 18 }}>One flat fee per transfer, based on the network:</div>
              <div className="aw-fee"><Icon path={mdiFlashOutline} size={1} color="var(--aw-green)"></Icon> Fast networks <b>&lt; $0.99</b></div>
              <div className="aw-fee"><Icon path={mdiFlash} size={1} color="var(--aw-amber)"></Icon> Popular networks <b>&lt; $1.49</b></div>
              <div className="aw-fee"><Icon path={mdiFlashAlert} size={1} color="var(--aw-red)"></Icon> Older networks <b>&lt; $15.99</b></div>
            </div>
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">Bridged,</span><br></br>not wrapped in trust.</h3>
              <div className="aw-card-text">Coins from Bitcoin, Ethereum and more arrive through on-chain vaults run by public committees — transparent, auditable, and every withdrawal pays straight to your own address.</div>
            </div>
            <div className="aw-card" data-reveal>
              <h3 className="aw-h3"><span className="aw-accent">Spend it.</span><br></br>Save it.<br></br>Trade it.</h3>
              <div className="aw-card-text">Your balance is liquid 24/7 — swap it into anything, hold it, or send it anywhere in the world in seconds.</div>
            </div>
          </div>
          <a className="aw-link" href="#privacy">Why there is nothing to steal <Icon path={mdiChevronRight} size={0.85}></Icon></a>
        </div>
      </section>

      <section id="privacy" className="aw-section aw-panel">
        <div className="aw-inner" style={{ textAlign: 'center' }}>
          <div className="aw-kicker aw-kicker-center" data-reveal><span className="aw-kicker-dot"></span>Privacy</div>
          <h2 className="aw-h2" data-reveal style={{ marginInline: 'auto' }}>Nothing to leak.<br></br><span className="aw-accent">We keep nothing.</span></h2>
          <p className="aw-sub" style={{ marginInline: 'auto' }} data-reveal>Most apps collect data because they need it to work. This one doesn’t. There is no account to breach, no database holding your identity — and signing happens on your device, so there is no server that ever sees your key.</p>
          <div className="aw-zeros" data-reveal>
            <div className="aw-zero-stat"><b>0</b><span>accounts</span></div>
            <div className="aw-zero-stat"><b>0</b><span>e-mails</span></div>
            <div className="aw-zero-stat"><b>0</b><span>cookies</span></div>
            <div className="aw-zero-stat"><b>0</b><span>analytics</span></div>
          </div>
          <div className="aw-privacy-note" data-reveal>Even watching is private — a watch-only mode tracks any address without ever loading a key.</div>
        </div>
      </section>

      <section className="aw-section aw-lime">
        <div className="aw-inner">
          <div className="aw-kicker aw-kicker-dark" data-reveal><span className="aw-kicker-dot"></span>Why it matters</div>
          <h2 className="aw-h2 aw-on-lime" data-reveal>Your keys.<br></br>Your coins.</h2>
          <p className="aw-sub aw-sub-lime" data-reveal>No freezes. No limits. No permission needed. And you don’t have to take our word for it — the code is open, and the market is public:</p>
          {
            metrics != null &&
            <div className="aw-stats" data-reveal>
              <div className="aw-stat"><b>{ metrics.accounts }</b><span>users on the network</span></div>
              <div className="aw-stat"><b>{ metrics.actions }</b><span>actions completed</span></div>
              <div className="aw-stat"><b>{ metrics.quantity }</b><span>held in the market</span></div>
              <div className="aw-stat"><b>{ metrics.volume }</b><span>traded every day</span></div>
            </div>
          }
          {
            metrics != null &&
            <div className="aw-since" data-reveal>{ secondsToDuration((new Date().getTime() - genesisTimeDEX.getTime()) / 1000) } of real trades and payments. Not testnet numbers.</div>
          }
        </div>
      </section>


      <section className="aw-section aw-closer aw-panel">
        <div className="aw-inner" style={{ textAlign: 'center' }}>
          <h2 className="aw-h2" data-reveal style={{ marginInline: 'auto' }}>Your first transaction<br></br>is two minutes <span className="aw-accent">away.</span></h2>
          <p className="aw-sub" style={{ marginInline: 'auto' }} data-reveal>Free in your browser. Free on desktop. Nothing to install just to look around.</p>
          <div data-reveal style={{ marginTop: 40 }}>
            <Link to="/restore" className="aw-cta">{ AppData.isWalletExists() ? 'Back to app' : 'Create a wallet' } <Icon path={mdiLogin} size={0.9}></Icon></Link>
          </div>
          <div className="aw-chips" data-reveal style={{ marginTop: 30, justifyContent: 'center' }}>
            <span className="aw-chip">No e-mail</span>
            <span className="aw-chip">No documents</span>
            <span className="aw-chip">0.00% trading fees</span>
          </div>
        </div>
      </section>

      <section id="faq" className="aw-section">
        <div className="aw-inner">
          <div className="aw-kicker" data-reveal><span className="aw-kicker-dot"></span>FAQ</div>
          <h2 className="aw-h2" data-reveal>Questions?<br></br><span className="aw-accent">Answers.</span></h2>
          <div className="aw-faq" data-reveal>
            <details className="aw-faq-item">
              <summary>What is Tangent Cash?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">A self-custody crypto wallet with a built-in market. Think of it as a neutral middle layer over the classic blockchains: bring coins from Bitcoin, Ethereum, Solana and others, then trade them, send them, or take them back out — without an exchange, a broker, or a permission slip. It runs in your browser and as a desktop app.</div>
            </details>
            <details className="aw-faq-item">
              <summary>Which coins can I use?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">Bitcoin and its variants, Ethereum, Tron, Solana, Ripple — every network listed above — plus the usual tokens on the smart chains (ERC-20 and friends). All of it lands in the same wallet and trades in the same market.</div>
            </details>
            <details className="aw-faq-item">
              <summary>Do I need an account — or verification?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">No. There is no account to register: a wallet is just a key, and you create it on this device. No e-mail, no phone number, no documents. Nobody can freeze, cap, or approve your money — not even us.</div>
            </details>
            <details className="aw-faq-item">
              <summary>How does the wallet actually work?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">The app is a window onto the Tangent network: it reads balances from public peer-to-peer nodes and broadcasts transactions you sign on your own device. Want to trust only your own hardware? Run your own node and point the app at it.</div>
            </details>
            <details className="aw-faq-item">
              <summary>Who actually holds my coins?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">You do. Your key is encrypted on your device, and nothing moves without your password. Coins bridged in from other chains sit in on-chain vaults run by committees of signers, where no single person ever knows a vault’s key — coins move only if the committee agrees. Every vault’s committee size, fees and locked value are public in the app.</div>
            </details>
            <details className="aw-faq-item">
              <summary>How do coins get in and out?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">Tap deposit or withdraw on any coin, pick a bridge, and use the address you’re shown. Deposits arrive once the sending chain confirms; withdrawals pay straight back to your own address. You can even deposit through one bridge and withdraw through another.</div>
            </details>
            <details className="aw-faq-item">
              <summary>How long does a transaction take?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">On Tangent, about 6 seconds. Bridged coins arrive after their chain fully confirms — for Bitcoin that’s 6 blocks, roughly an hour.</div>
            </details>
            <details className="aw-faq-item">
              <summary>What does it actually cost?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">Trading: 0.00% fees — just the 0.10% market spread, and busy markets get even cheaper. Receiving: free. Sending: one flat fee by network, from under $0.99. Bridge withdrawals carry a fee set by each bridge, paid in that chain’s own coin — withdraw USDT from Ethereum, pay it in ETH. That’s the whole price list.</div>
            </details>
            <details className="aw-faq-item">
              <summary>Why can’t I send TAN USDC straight to Solana?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">TAN USDC is the unified stablecoin of the Tangent blockchain — one asset that trades across the whole market. To move it to Solana, tap <b>Unwrap</b> on your Portfolio: it converts 1:1 into native USDC, which you can send anywhere. Wrapping and unwrapping are always free.</div>
            </details>
            <details className="aw-faq-item">
              <summary>What can I do besides swap?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">Send to any address, bundle several transfers into one transaction, trade the full order book, post a liquidity pool that charges a fee you set — even help run the network itself through governance. Your coins, your call.</div>
            </details>
            <details className="aw-faq-item">
              <summary>How do I know what I’m signing?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">The app simulates every transaction before you confirm it. The review screen shows the exact balance changes, events and final fee — nothing is broadcast until you enter your password, and you can dump the finalized transaction to inspect it yourself.</div>
            </details>
            <details className="aw-faq-item">
              <summary>Can I run several wallets — or just watch an address?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">One device can hold any number of accounts: full-control wallets you sign with, and watch-only entries that track balances and history without a key ever being loaded. Switching between them is instant.</div>
            </details>
            <details className="aw-faq-item">
              <summary>What if I lose my password — or my device?<Icon path={mdiChevronDown} size={0.9}></Icon></summary>
              <div className="aw-faq-a">Your password only unlocks the wallet on this device — if it’s lost, nobody can reset it. Your 24-word recovery phrase is the real backup: type it into any copy of the app and everything comes back exactly as it was. Write it down and keep it offline — it cannot be recovered for you.</div>
            </details>
          </div>
        </div>
      </section>

      <div style={{ paddingTop: 60, paddingBottom: 40 }}>
        <License title={true}></License>
      </div>

    </div>
  );
}
