import { mdiArrowBottomLeft, mdiArrowBottomRight, mdiArrowDown, mdiContactlessPayment, mdiCreation, mdiFire, mdiFlash, mdiFlashAlert, mdiFlashOutline, mdiLightbulbOn, mdiLightbulbOutline, mdiLogin, mdiMagnify, mdiMenu, mdiPercent, mdiSale, mdiScaleBalance, mdiSchool } from "@mdi/js";
import { Avatar, Box, Button, DropdownMenu, Flex, Heading, Text } from "@radix-ui/themes";
import { Link, useNavigate } from "react-router";
import { AppData } from "../core/app";
import { useEffectAsync } from "../core/react";
import { useState } from "react";
import { getGPUTier } from "../core/gpu";
import { secondsToDuration } from "../core/utils";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import License from "../components/license";
import DarkVeil from "../components/dark-veil";
import Strands from "../components/strands";
import GlassSurface from "../components/glass-surface";
import Particles from "../components/particles";
import Plasma from "../components/plasma";
import Threads from "../components/threads";
import './hype.css';

type Metrics = { assets: string, pairs: string, accounts: string, actions: string, quantity: string, volume: string };

let cachedMetrics: Metrics | null | false = false; 

function toNiceNumber(number: BigNumber): string {
  const stringify = (value: BigNumber) => value.integerValue().eq(value) ? value.toString() : value.toFixed(1);
  const compress = (rotation: number) => stringify(number.dividedBy(Math.pow(1000.0, rotation)));
  let result = stringify(number);
  if (number.gt(1000000000000000))
    result = compress(5) + 'Q';
  else if (number.gt(1000000000000))
    result = compress(4) + 'T';
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

export default function HypePage() {
  const mobile = document.body.clientWidth < 510;
  const navigate = useNavigate();
  const [unoptimzed, setUnoptimized] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffectAsync(async () => {
    const gpu = await getGPUTier();
    setUnoptimized(gpu.tier == 'BAD');
    if (cachedMetrics === false) {
      try {
        const response = await fetch('https://p2p.tangent.cash:19420/market/metrics');
        const result = (await response.json()).result;
        cachedMetrics = {
          assets: toNiceCount(new BigNumber(result.assets), 'token'),
          pairs: toNiceCount(new BigNumber(result.pairs), 'trading pair'),
          accounts: toNiceCount(new BigNumber(result.accounts), 'user'),
          actions: toNiceCount(new BigNumber(result.actions), 'action'),
          quantity: toNiceAmount(new BigNumber(new BigNumber(result.quantity).toFixed(2))),
          volume: toNiceAmount(new BigNumber(new BigNumber(result.volume).toFixed(2)))
        };
      } catch {
        cachedMetrics = null;
      }
    }
    setMetrics(cachedMetrics);
  }, []);

  return (
    <Box position="relative" className="hype-page">
      <svg style={{ display: 'none' }}>
        <filter id="fancy-icon-filter" x="-50%" y="-50%" width="200%" height="200%">
          <feColorMatrix type="matrix" 
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.5 0"
            result="WhiteSource" />
          <feGaussianBlur stdDeviation="15" result="ColoredBlur" />
          <feMerge>
            <feMergeNode in="ColoredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>
      <Box position="absolute" top="0" bottom="0" left="0" right="0" style={{
        zIndex: -1,
        backgroundImage: 'linear-gradient(var(--line-strong) 1px, transparent 1px), linear-gradient(90deg, var(--line-strong) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        filter: 'drop-shadow(0px 0px 2.5px var(--accent-a3))'
      }}></Box>
      <Box position="absolute" top="0" left="0" right="0" height="300px" style={{
        zIndex: -1,
        backgroundImage: 'linear-gradient(var(--color-background) 0%, transparent 100%)'
      }}></Box>
      <Box position="absolute" bottom="0" left="0" right="0" height="300px" style={{
        zIndex: -1,
        backgroundImage: 'linear-gradient(transparent 0%, var(--color-background) 100%)'
      }}></Box>
      <Box position="absolute" right="0" top="0" bottom="0" width="100px" style={{
        zIndex: -1,
        backgroundImage: 'linear-gradient(to right, transparent 0%, var(--color-background) 100%)'
      }}></Box>
      <Box position="absolute" left="0" top="0" bottom="0" width="100px" style={{
        zIndex: -1,
        backgroundImage: 'linear-gradient(to left, transparent 0%, var(--color-background) 100%)'
      }}></Box>
      <header className="hp-header">
        <div className="hp-header-inner">
          <button className="hp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img className="hp-brand-logo" src="/favicon.svg" alt=""></img>
            <span className="hp-brand-name">TANGENT<span>CASH</span></span>
          </button>
          <div className="hp-header-right">
            <button className="hp-icon-btn hp-theme-btn" title="Toggle theme" onClick={() => AppData.setAppearance(AppData.props.appearance == 'light' ? 'dark' : 'light')}>
              <Icon path={AppData.props.appearance == 'dark' ? mdiLightbulbOutline : mdiLightbulbOn} size={0.75}></Icon>
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button className="hp-icon-btn" aria-label="Menu">
                  <Icon path={mdiMenu} size={1.1}></Icon>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content side="bottom">
                <DropdownMenu.Item>
                  <a className="router-text-link" href="/docs" target="_blank" style={{ textDecoration: 'none' }}>
                    <Flex align="center" gap="2">
                      <Icon path={mdiSchool} size={0.6} /> 
                      <Text size="2">Resources</Text>
                    </Flex>
                  </a>
                </DropdownMenu.Item>
                <DropdownMenu.Item>
                  <Link className="router-text-link" to="/legal" style={{ textDecoration: 'none' }}>
                    <Flex align="center" gap="2">
                      <Icon path={mdiScaleBalance} size={0.6} /> 
                      <Text size="2">Documents</Text>
                    </Flex>
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item>
                  <Link className="router-text-link" to="/explorer" style={{ textDecoration: 'none' }}>
                    <Flex align="center" gap="2">
                      <Icon path={mdiMagnify} size={0.6} /> 
                      <Text size="2">Explorer</Text>
                    </Flex>
                  </Link>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0', paddingTop: '360px', position: 'relative' }}>
        {
          !unoptimzed &&
          <div style={{ width: '100%', height: '900px', position: 'absolute', top: '0', zIndex: -1, mixBlendMode: 'difference' }}>
            <DarkVeil
              hueShift={60}
              noiseIntensity={0}
              scanlineIntensity={0}
              speed={0.25}
              scanlineFrequency={0}
              warpAmount={0.54}
            />
          </div>
        }
        <Box maxWidth="840px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '8' : '9'} className="hp-title-hero">Gain The Control</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '4' : '5'}>Your DeFi staying truly on-chain.</Text>
          </Flex>
          <Flex justify="center" align="center" direction="column" mb="3">
            <Button size="4" variant="surface" style={{
              paddingLeft: '32px',
              paddingRight: '32px',
              WebkitBackdropFilter: "blur(24px)",
              backdropFilter: "blur(24px)",
              backgroundColor: 'var(--lime-solid)', color: 'var(--ink)'
            }} className="shadow-rainbow-animation shadow-blur" onClick={() => navigate('/restore')}>
              { AppData.isWalletExists() ? 'Back to app' : 'Create a wallet' } <Icon path={mdiLogin} size={1}></Icon>
            </Button>
          </Flex>
          <Flex justify="center" align="center" gap="1">
            <Text color="gray" size="2">Benefits</Text>
            <Icon path={mdiArrowDown} size={1} color="var(--gray-11)"></Icon>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '300px 0' }} position="relative">
        <Box maxWidth="840px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '8' : '9'}>True Sovereignty</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '4' : '5'}>Forget about KYC abuse and frozen accounts.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <Flex px="5" py="4" style={{ borderRadius: '999px', backgroundColor: 'var(--lime-solid)' }}>
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--ink)' }}>Driven by Community</Heading>
            </Flex>
            <Flex px="5" py="4" style={{ borderRadius: '999px', backgroundColor: 'var(--elev)' }}>
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--text)' }}>Powered by P2P Network</Heading>
            </Flex>
            <GlassSurface borderRadius={999} width="auto" height="auto" style={{ padding: '10px 16px' }}>
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--gray-12)' }}>Verified by Open Source</Heading>
            </GlassSurface>
          </Flex>
        </Box>
        {
          !unoptimzed &&
          <div style={{ width: '100%', height: '500px', position: 'absolute', bottom: '10px', zIndex: -2 }}>
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', height: '100%' }}>
                <Strands
                  colors={["#B0F406","#8FCC00","#8FC3FF"]}
                  count={3}
                  speed={0.15}
                  amplitude={1}
                  waviness={1}
                  thickness={0.7}
                  glow={2.6}
                  taper={3}
                  spread={1}
                  intensity={0.6}
                  saturation={2}
                  opacity={1}
                  scale={2}
                  glass={false}
                  refraction={1}
                  dispersion={1}
                  glassSize={1}
                  hueShift={0}
                />
                <Box position="absolute" top="0" left="0" right="0" height="100px" style={{
                  backgroundImage: 'linear-gradient(var(--color-background) 0%, transparent 100%)', zIndex: 0
                }}></Box>
                <Box position="absolute" bottom="0" left="0" right="0" height="100px" style={{
                  backgroundImage: 'linear-gradient(transparent 0%, var(--color-background) 100%)', zIndex: 0
                }}></Box>
              </div>
            </div>
          </div>
        }
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0' }} position="relative">
        <Box maxWidth="840px" mx="auto" px="4" py="4">
          <Box position="relative">
            <Flex justify="center" wrap="wrap" align="center" mb="6" gap="6">
              <Heading align="center" size={mobile ? '8' : '9'}>{ blockchains.length } Networks</Heading>
            </Flex>
            <Flex justify="center" mb="8">
              <Text align="center" size={mobile ? '4' : '5'}>Coins, tokens, just works.</Text>
            </Flex>
            <Flex wrap="wrap" justify="center" gap="9" pt="6">
              {
                blockchains.map((chain) =>
                  <Flex key={chain[0]} direction="column" gap="4" align="center" justify="center" width="120px">
                    <Avatar className="fancy-icon-filter" size="5" fallback={chain} src={`/cryptocurrency/${chain[0].toLowerCase().replace(/ /g, '')}.svg`}></Avatar>
                    <Flex gap="1">
                      <Text size="2">{ chain[1] }</Text>
                    </Flex>
                  </Flex>)
              }
            </Flex>
          </Box>
        </Box>
      </Box>
      {
        metrics != null &&
        <Box style={{ padding: mobile ? '120px 0' : '200px 0' }} position="relative">
          {
            !unoptimzed &&
            <div style={{ position: 'absolute', bottom: '0', top: '0', left: '0', right: '0', zIndex: -2 }}>
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <Particles
                  particleColors={["#b0f406"]}
                  particleCount={200}
                  particleSpread={10}
                  speed={0.01}
                  particleBaseSize={150}
                  moveParticlesOnHover={false}
                  disableRotation={false}
                  pixelRatio={1}
                />
                <Box position="absolute" top="0" left="0" right="0" height="100px" style={{
                  backgroundImage: 'linear-gradient(var(--color-background) 0%, transparent 100%)', zIndex: 0
                }}></Box>
                <Box position="absolute" bottom="0" left="0" right="0" height="100px" style={{
                  backgroundImage: 'linear-gradient(transparent 0%, var(--color-background) 100%)', zIndex: 0
                }}></Box>
              </div>
            </div>
          }
          <Box mx="auto" px="4" py="4">
            <Flex justify="center" mb="6">
              <Heading align="center" size={mobile ? '7' : '9'} className="mono num">{ metrics.accounts }</Heading>
            </Flex>
            <Flex justify="center" mb="8">
              <Text align="center" size={mobile ? '4' : '5'}><span style={{ 
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'var(--lime-solid)',
                  borderRadius: '50%',
                  marginRight: '5px',
                  verticalAlign: 'middle',
                  transform: 'translateY(-1.5px)'
                }}></span>{ secondsToDuration((new Date().getTime() - genesisTimeDEX.getTime()) / 1000) } of on-chain metrics.</Text>
            </Flex>
            <Flex mx="auto" maxWidth="620px" wrap="wrap" gap="3" justify="center">
              <GlassSurface borderRadius={999} width="auto" height="auto" style={{ padding: '10px 16px' }}>
                <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--gray-12)' }}><Text weight="bold">{ metrics.actions }</Text> on <Text weight="bold">{ metrics.pairs }</Text></Heading>
              </GlassSurface>
              <Flex px="5" py="4" style={{ borderRadius: '999px', backgroundColor: 'var(--elev)' }}>
                <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--text)' }}><Text weight="bold">{ metrics.quantity }</Text> locked in <Text weight="bold">{ metrics.assets }</Text></Heading>
              </Flex>
              <Flex px="5" py="4" style={{ borderRadius: '999px', backgroundColor: 'var(--lime-solid)' }}>
                <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--ink)' }}><Text weight="bold">{ metrics.volume }</Text> transacted</Heading>
              </Flex>
            </Flex>
          </Box>
        </Box>
      }
      <Box style={{ padding: mobile ? '120px 0' : '200px 0' }}>
        <Box maxWidth="540px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '8' : '9'}>Spot Trading</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '4' : '5'}>Trade on your conditions.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <Flex px="5" py="4" style={{ borderRadius: '999px', backgroundColor: 'var(--lime-solid)' }}>
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--ink)' }}>Tickers by People</Heading>
            </Flex>
            <GlassSurface borderRadius={999} width="auto" height="auto" style={{ padding: '10px 16px' }}>
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--gray-12)' }}>Powered by Order Book</Heading>
            </GlassSurface>
            <Flex px="5" py="4" style={{ borderRadius: '999px', backgroundColor: 'var(--elev)' }}>
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--text)' }}>Liquditity by AMM</Heading>
            </Flex>
            <Flex px="5" py="4" style={{ borderRadius: '999px', backgroundColor: 'var(--accent-9)' }}>
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--ink)' }}>Prices by Oracle</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0' }} position="relative">
        {
          !unoptimzed &&
          <>
            <div style={{ position: 'absolute', bottom: '200px', top: '200px', left: '0', right: '0', zIndex: -2 }}>
              <Plasma
                color="#B0F406"
                speed={0.25}
                direction="reverse"
                scale={1}
                opacity={1}
                mouseInteractive={false}
                renderScale={0.55}
                maxDpr={1.5}
                targetFps={20}
                iterations={60}
              />
            </div>
            <Box position="absolute" top="200px" left="0" right="0" height="100px" style={{
              backgroundImage: 'linear-gradient(var(--color-background) 0%, transparent 100%)', zIndex: -2
            }}></Box>
            <Box position="absolute" bottom="200px" left="0" right="0" height="100px" style={{
              backgroundImage: 'linear-gradient(transparent 0%, var(--color-background) 100%)', zIndex: -2
            }}></Box>
          </>
        }
        <Box maxWidth="840px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '7' : '9'}>Unified Liquidity</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Never pay for a network change.</Text>
          </Flex>
          {
            !mobile &&
            <>
              <Flex justify="center" wrap="wrap" gap="8" mb="4">
                <Avatar size="5" fallback="OP" className="fancy-icon-filter" src={`/cryptocurrency/op.svg`}></Avatar>
                <Avatar size="5" fallback="LI" className="fancy-icon-filter" src={`/cryptocurrency/linea.svg`}></Avatar>
                <Avatar size="5" fallback="MA" className="fancy-icon-filter" src={`/cryptocurrency/matic.svg`}></Avatar>
                <Avatar size="5" fallback="TA" className="fancy-icon-filter" src={`/favicon.svg`}></Avatar>
                <Avatar size="5" fallback="ZK" className="fancy-icon-filter" src={`/cryptocurrency/zk.svg`}></Avatar>
              </Flex>
              <Flex justify="center" wrap="wrap" gap="8" mb="4">
                <Avatar size="5" fallback="AL" className="fancy-icon-filter" src={`/cryptocurrency/algo.svg`}></Avatar>
                <Avatar size="5" fallback="AR" className="fancy-icon-filter" src={`/cryptocurrency/arb.svg`}></Avatar>
                <Avatar size="5" fallback="AV" className="fancy-icon-filter" src={`/cryptocurrency/avax.svg`}></Avatar>
                <Avatar size="5" fallback="BA" className="fancy-icon-filter" src={`/cryptocurrency/base.svg`}></Avatar>
              </Flex>
            </>
          }
          <Flex justify="center" wrap="wrap" gap="8">
            <Avatar size="5" fallback="SO" className="fancy-icon-filter" src={`/cryptocurrency/sol.svg`}></Avatar>
            <Avatar size="5" fallback="ET" className="fancy-icon-filter" src={`/cryptocurrency/eth.svg`}></Avatar>
            <Avatar size="5" fallback="TR" className="fancy-icon-filter" src={`/cryptocurrency/trx.svg`}></Avatar>
          </Flex>
          <Flex justify="center" gap="2" py="4">
            <Icon path={mdiArrowBottomRight} size={3}></Icon>
            <Icon path={mdiArrowDown} size={3}></Icon>
            <Icon path={mdiArrowBottomLeft} size={3}></Icon>
          </Flex>
          <Flex justify="center" gap="4">
            <Avatar size="5" fallback="US" className="fancy-icon-filter" src={`/cryptocurrency/usdc.svg`}></Avatar>
            <Avatar size="5" fallback="US" className="fancy-icon-filter" src={`/cryptocurrency/usdt.svg`}></Avatar>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0', paddingBottom: '100px' }}>
        <Box maxWidth="800px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '8' : '9'}>Effective Bridging</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '4' : '5'}>Pay network fees, not bank fees.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <Flex px="5" py="4" gap="2" style={{ borderRadius: '999px', backgroundColor: 'var(--accent-9)' }}>
              <Icon path={mdiCreation} color="var(--ink)" size={mobile ? 0.9 : 1.2}></Icon> 
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--ink)' }}>Receive Without Fees</Heading>
            </Flex>
            <Flex className="rt-BaseButton rt-variant-surface fancy-pseudo-button" data-accent-color="sky" px="5" py="4" gap="2" style={{
              borderRadius: '999px',
              WebkitBackdropFilter: "blur(14px)",
              backdropFilter: "blur(14px)"
            }}>
              <Icon path={mdiContactlessPayment} size={mobile ? 0.9 : 1.2}></Icon> 
              <Heading size={mobile ? '3' : '5'} weight="regular">Pay & Stake & Trade</Heading>
            </Flex>
            <Flex className="rt-BaseButton rt-variant-surface fancy-pseudo-button" data-accent-color="amber" px="5" py="4" gap="2" style={{
              borderRadius: '999px',
              WebkitBackdropFilter: "blur(14px)",
              backdropFilter: "blur(14px)"
            }}>
              <Icon path={mdiFire} size={mobile ? 0.9 : 1.2}></Icon>
              <Heading size={mobile ? '3' : '5'} weight="regular">Send With Fixed Fee</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0', paddingBottom: '100px' }} position="relative">
        {
          !unoptimzed &&
          <div style={{ position: 'absolute', bottom: '0', top: '0', left: '0', right: '0', zIndex: -2 }}>
            <Threads
              amplitude={1}
              distance={0.5}
              color={[231 / 255, 245 / 255, 196 / 255]}
            />
          </div>
        }
        <Box maxWidth="800px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '8' : '9'}>Trading Fees</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '4' : '5'}>Optimal setup for spot trading.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <GlassSurface backgroundOpacity={0.3} saturation={0} borderRadius={999} width="auto" height="auto" style={{ padding: '10px 16px' }}>
              <Flex gap="2">
                <Icon path={mdiSale} color="var(--gray-12)" size={mobile ? 0.9 : 1.2}></Icon> 
                <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--gray-12)' }}>0.01% Spread</Heading>
              </Flex>
            </GlassSurface>
            <Flex px="5" py="4" gap="2" style={{ borderRadius: '999px', backgroundColor: 'var(--lime-solid)' }}>
              <Icon path={mdiPercent} color="var(--ink)" size={mobile ? 0.9 : 1.2}></Icon> 
              <Heading size={mobile ? '3' : '5'} weight="regular" style={{ color: 'var(--ink)' }}>0.00% Fee</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0', paddingBottom: '100px' }}>
        <Box mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '8' : '9'}>Vault Fees</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '4' : '5'}>Pay the fixed fee of your network.</Text>
          </Flex>
          <Flex maxWidth="680px" mx="auto" wrap="wrap" gap="3" justify="center">
            <Flex className="rt-BaseButton rt-variant-surface fancy-pseudo-button" data-accent-color="green" px="5" py="4" gap="2" style={{
              borderRadius: '999px',
              WebkitBackdropFilter: "blur(14px)",
              backdropFilter: "blur(14px)"
            }}>
              <Icon path={mdiFlashOutline} size={mobile ? 0.9 : 1.2}></Icon> 
              <Heading size={mobile ? '3' : '5'} weight="regular">Modern L1s/L2s &lt; $0.99</Heading>
            </Flex>
            <Flex className="rt-BaseButton rt-variant-surface fancy-pseudo-button" data-accent-color="amber" px="5" py="4" gap="2" style={{
              borderRadius: '999px',
              WebkitBackdropFilter: "blur(14px)",
              backdropFilter: "blur(14px)"
            }}>
              <Icon path={mdiFlash} size={mobile ? 0.9 : 1.2}></Icon> 
              <Heading size={mobile ? '3' : '5'} weight="regular">Standard L1s/L2s &lt; $1.49</Heading>
            </Flex>
            <Flex className="rt-BaseButton rt-variant-surface fancy-pseudo-button" data-accent-color="red" px="5" py="4" gap="2" style={{
              borderRadius: '999px',
              WebkitBackdropFilter: "blur(14px)",
              backdropFilter: "blur(14px)"
            }}>
              <Icon path={mdiFlashAlert} size={mobile ? 0.9 : 1.2}></Icon> 
              <Heading size={mobile ? '3' : '5'} weight="regular">Legacy L1s &lt; $15.99</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <License style={{ marginTop: '140px' }} title={true}></License>
    </Box>
  );
}