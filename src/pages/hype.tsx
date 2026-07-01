import { mdiArrowBottomLeft, mdiArrowBottomRight, mdiArrowDown, mdiContactlessPayment, mdiCreation, mdiFire, mdiFlash, mdiFlashAlert, mdiFlashOutline, mdiLightbulbOn, mdiLightbulbOutline, mdiLogin, mdiMagnify, mdiMenu, mdiPercent, mdiSale, mdiScaleBalance, mdiSchool } from "@mdi/js";
import { Avatar, Box, Button, DropdownMenu, Flex, Heading, IconButton, Text } from "@radix-ui/themes";
import { Link, useNavigate } from "react-router";
import { AssetId, Readability } from "tangentsdk";
import { AppData } from "../core/app";
import { useEffectAsync } from "../core/react";
import { useState } from "react";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import License from "../components/license";

type Metrics = { assets: string, pairs: string, accounts: string, actions: string, quantity: string, volume: string };

let cachedMetrics: Metrics | null | false = false; 

function secondsToDuration(baseSeconds: number): string {
  if (!baseSeconds)
    return "0 seconds";

  const SEC_PER_MIN = 60.0;
  const SEC_PER_HOUR = 60.0 * SEC_PER_MIN;
  const SEC_PER_DAY = 24.0 * SEC_PER_HOUR;
  const SEC_PER_WEEK = 7.0 * SEC_PER_DAY;
  const SEC_PER_MONTH = (365.2425 / 12.0) * SEC_PER_DAY;
  const SEC_PER_YEAR = 365.2425 * SEC_PER_DAY;
  const toDuration = (value: number, duration: string): string => `${Math.round(value)} ${duration}${value > 1 ? "s" : ""}`;
  const seconds = Math.round(baseSeconds);
  if (seconds >= SEC_PER_YEAR)
    return toDuration(seconds / SEC_PER_YEAR, "year");
  else if (seconds >= SEC_PER_MONTH)
    return toDuration(seconds / SEC_PER_MONTH, "month");
  else if (seconds >= SEC_PER_WEEK)
    return toDuration(seconds / SEC_PER_WEEK, "week");
  else if (seconds >= SEC_PER_DAY)
    return toDuration(seconds / SEC_PER_DAY, "day");
  else if (seconds >= SEC_PER_HOUR)
    return toDuration(seconds / SEC_PER_HOUR, "hour");
  else if (seconds >= SEC_PER_MIN)
    return toDuration(seconds / SEC_PER_MIN, "minute");
  return toDuration(seconds, "second");
}
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
  'ADA',
  'BTC',
  'ETH',
  'SOL',
  'TRX',
  'XRP',
  'XLM',
  'BCH',
  'LTC',
  'DOGE',
  'XMR'
].sort();

export default function HypePage() {
  const mobile = document.body.clientWidth < 510;
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffectAsync(async () => {
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
    <Box position="relative">
      <Box position="absolute" top="0" bottom="0" left="0" right="0" style={{
        zIndex: -1,
        backgroundImage: 'linear-gradient(var(--gray-a3) 1px, transparent 1px), linear-gradient(90deg, var(--gray-a3) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        filter: 'drop-shadow(0px 0px 3px var(--gray-a9))'
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
      <Box position="fixed" top="0" left="0" right="0" px="2" py="4" style={{ zIndex: 9999 }}>
        <Box maxWidth="840px" mx="auto" px="4" py="3" style={{
            backgroundColor: 'var(--color-panel)',
            border: '1px solid var(--gray-a5)',
            borderRadius: "24px",
            filter: "brightness(1.1)",
            WebkitBackdropFilter: "blur(24px)",
            backdropFilter: "blur(24px)"
          }}>
          <Flex justify="between" align="center">
            <Flex align="center" gap="3">
              <Avatar size="3" radius="none" fallback="TC" src="/favicon.svg"></Avatar>
              <Heading size="5" weight="bold" style={{ letterSpacing: '1.25px' }}>TANGENT<Text color="lime">CASH</Text></Heading>
            </Flex>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton size="3" variant="ghost">
                  <Icon path={mdiMenu} size={1.5}></Icon>
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content side="bottom">
                <DropdownMenu.Item>
                  <a className="router-text-link" href="/docs" target="_blank" style={{ textDecoration: 'none' }}>
                    <Flex align="center" gap="2">
                      <Icon path={mdiSchool} size={0.6} /> 
                      <Text size="2">Resouces</Text>
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
                <DropdownMenu.Item onClick={() => AppData.setAppearance(AppData.props.appearance == 'light' ? 'dark' : 'light')}>
                  <Flex align="center" gap="2">
                    <Icon path={AppData.props.appearance == 'dark' ? mdiLightbulbOutline : mdiLightbulbOn} size={0.6}></Icon>
                    Theme
                  </Flex>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0', paddingTop: '360px' }}>
        <Box maxWidth="840px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '7' : '8'}>Gain The Control</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Trade, stake, bridge, pay staying truly on-chain.</Text>
          </Flex>
          <Flex justify="center" align="center" direction="column" mb="3">
            <Button size="4" variant="surface" style={{ paddingLeft: '24px', paddingRight: '24px' }} className="shadow-rainbow-animation shadow-blur" onClick={() => navigate('/restore')}>
              { AppData.isWalletExists() ? 'Back to app' : 'Create a wallet' } <Icon path={mdiLogin} size={1}></Icon>
            </Button>
          </Flex>
          <Flex justify="center" align="center" gap="1">
            <Text color="gray">Benefits</Text>
            <Icon path={mdiArrowDown} size={0.8} color="var(--gray-11)"></Icon>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0' }}>
        <Box maxWidth="840px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '7' : '8'}>True Sovereignty</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Forget about KYC abuse and frozen accounts.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <Flex px="4" py="4" style={{ borderRadius: '28px', backgroundColor: 'var(--blue-9)' }}>
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>Driven by Community</Heading>
            </Flex>
            <Flex px="4" py="4" style={{ borderRadius: '28px', backgroundColor: 'var(--gray-12)' }}>
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'var(--gray-1)' }}>Powered by P2P Network</Heading>
            </Flex>
            <Flex px="4" py="4" style={{ borderRadius: '28px', backgroundColor: 'var(--lime-9)' }}>
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'black' }}>Verified by Open Source</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0' }}>
        <Box maxWidth="840px" mx="auto" px="4" py="4">
          <Box position="relative">
            <Flex justify="center" wrap="wrap" align="center" mb="6" gap="6">
              <Heading align="center" size={mobile ? '7' : '8'}>Bridging { blockchains.length } Networks</Heading>
            </Flex>
            <Flex justify="center" mb="8">
              <Text align="center" size={mobile ? '3' : '4'}>Coins, tokens, just works.</Text>
            </Flex>
            <Flex wrap="wrap" justify="center" gap="9" pt="6">
              {
                blockchains.map((chain) =>
                  <Flex key={chain} direction="column" gap="4" align="center" justify="center" width="120px">
                    <Avatar size="5" fallback={chain} src={`/cryptocurrency/${chain.toLowerCase().replace(/ /g, '')}.svg`}></Avatar>
                    <Flex gap="1">
                      <Text size="1">{ Readability.toAssetName(AssetId.fromHandle(chain)) }</Text>
                    </Flex>
                  </Flex>)
              }
            </Flex>
          </Box>
        </Box>
      </Box>
      {
        metrics != null &&
        <Box style={{ padding: mobile ? '120px 0' : '200px 0' }}>
          <Box maxWidth="540px" mx="auto" px="4" py="4">
            <Flex justify="center" mb="6">
              <Heading align="center" size={mobile ? '7' : '8'}>Serving { metrics.accounts }</Heading>
            </Flex>
            <Flex justify="center" mb="8">
              <Text align="center" size={mobile ? '3' : '4'}><span style={{ 
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'var(--lime-11)',
                  borderRadius: '50%',
                  marginRight: '8px',
                  verticalAlign: 'middle'
                }}></span>{ secondsToDuration((new Date().getTime() - genesisTimeDEX.getTime()) / 1000) } of on-chain metrics.</Text>
            </Flex>
            <Flex wrap="wrap" gap="3" justify="center">
              <Flex px="5" py="4" style={{ borderRadius: '36px', backgroundColor: 'var(--gray-12)' }}>
                <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'var(--gray-1)' }}><Text weight="bold">{ metrics.actions }</Text> on <Text weight="bold">{ metrics.pairs }</Text></Heading>
              </Flex>
              <Flex px="5" py="4" style={{ borderRadius: '36px', backgroundColor: 'var(--blue-9)' }}>
                <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}><Text weight="bold">{ metrics.quantity }</Text> locked in <Text weight="bold">{ metrics.assets }</Text></Heading>
              </Flex>
              <Flex px="5" py="4" style={{ borderRadius: '36px', backgroundColor: 'var(--indigo-10)' }}>
                <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}><Text weight="bold">{ metrics.volume }</Text> transacted</Heading>
              </Flex>
            </Flex>
          </Box>
        </Box>
      }
      <Box style={{ padding: mobile ? '120px 0' : '200px 0' }}>
        <Box maxWidth="540px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '7' : '8'}>Spot Trading</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Trade on your conditions.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <Flex px="4" py="4" style={{ borderRadius: '28px', backgroundColor: 'var(--blue-9)' }}>
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>Tickers by People</Heading>
            </Flex>
            <Flex px="4" py="4" style={{ borderRadius: '28px', backgroundColor: 'var(--gray-12)' }}>
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'var(--gray-1)' }}>Powered by Order Book</Heading>
            </Flex>
            <Flex px="4" py="4" style={{ borderRadius: '28px', backgroundColor: 'var(--indigo-10)' }}>
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>Liquditity by AMM</Heading>
            </Flex>
            <Flex px="4" py="4" style={{ borderRadius: '28px', backgroundColor: 'var(--lime-9)' }}>
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'black' }}>Prices by Oracle</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0' }}>
        <Box maxWidth="840px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '7' : '8'}>Unified Liquidity</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Never pay for a network change.</Text>
          </Flex>
          {
            !mobile &&
            <>
              <Flex justify="center" wrap="wrap" gap="8" mb="4">
                <Avatar size="5" fallback="US" src={`/cryptocurrency/op.svg`}></Avatar>
                <Avatar size="5" fallback="US" src={`/cryptocurrency/linea.svg`}></Avatar>
                <Avatar size="5" fallback="US" src={`/cryptocurrency/matic.svg`}></Avatar>
                <Avatar size="5" fallback="US" src={`/favicon.svg`}></Avatar>
                <Avatar size="5" fallback="US" src={`/cryptocurrency/zk.svg`}></Avatar>
              </Flex>
              <Flex justify="center" wrap="wrap" gap="8" mb="4">
                <Avatar size="5" fallback="US" src={`/cryptocurrency/algo.svg`}></Avatar>
                <Avatar size="5" fallback="US" src={`/cryptocurrency/arb.svg`}></Avatar>
                <Avatar size="5" fallback="US" src={`/cryptocurrency/avax.svg`}></Avatar>
                <Avatar size="5" fallback="US" src={`/cryptocurrency/base.svg`}></Avatar>
              </Flex>
            </>
          }
          <Flex justify="center" wrap="wrap" gap="8">
            <Avatar size="5" fallback="US" src={`/cryptocurrency/sol.svg`}></Avatar>
            <Avatar size="5" fallback="US" src={`/cryptocurrency/eth.svg`}></Avatar>
            <Avatar size="5" fallback="US" src={`/cryptocurrency/trx.svg`}></Avatar>
          </Flex>
          <Flex justify="center" gap="2" py="4">
            <Icon path={mdiArrowBottomRight} size={3}></Icon>
            <Icon path={mdiArrowDown} size={3}></Icon>
            <Icon path={mdiArrowBottomLeft} size={3}></Icon>
          </Flex>
          <Flex justify="center" gap="4">
            <Avatar size="5" fallback="US" src={`/cryptocurrency/usdc.svg`}></Avatar>
            <Avatar size="5" fallback="US" src={`/cryptocurrency/usdt.svg`}></Avatar>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0', paddingBottom: '100px' }}>
        <Box maxWidth="800px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '7' : '8'}>Effective Bridging</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Pay network fees, not bank transfer fees.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <Flex px="4" py="4" gap="2" style={{ borderRadius: '28px', backgroundColor: 'var(--lime-9)' }}>
              <Icon path={mdiCreation} color="black" size={mobile ? 0.7 : 1}></Icon> 
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'black' }}>No Fee Deposit</Heading>
            </Flex>
            <Flex px="4" py="4" gap="2" style={{ borderRadius: '28px', backgroundColor: 'var(--blue-9)' }}>
              <Icon path={mdiContactlessPayment} color="white" size={mobile ? 0.7 : 1}></Icon> 
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>Pay & Stake & Trade</Heading>
            </Flex>
            <Flex px="4" py="4" gap="2" style={{ borderRadius: '28px', backgroundColor: 'var(--ruby-9)' }}>
              <Icon path={mdiFire} color="white" size={mobile ? 0.7 : 1}></Icon>
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>Fixed Withdrawal Fee</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0', paddingBottom: '100px' }}>
        <Box maxWidth="800px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '7' : '8'}>Trading Fees</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Optimal setup for spot trading.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <Flex px="4" py="4" gap="2" style={{ borderRadius: '28px', backgroundColor: 'var(--gray-12)' }}>
              <Icon path={mdiSale} color="var(--gray-1)" size={mobile ? 0.7 : 1}></Icon> 
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'var(--gray-1)' }}>0.01% Spread</Heading>
            </Flex>
            <Flex px="4" py="4" gap="2" style={{ borderRadius: '28px', backgroundColor: 'var(--indigo-10)' }}>
              <Icon path={mdiPercent} color="white" size={mobile ? 0.7 : 1}></Icon> 
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>0.00% Fee</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <Box style={{ padding: mobile ? '120px 0' : '200px 0', paddingBottom: '100px' }}>
        <Box maxWidth="500px" mx="auto" px="4" py="4">
          <Flex justify="center" mb="6">
            <Heading align="center" size={mobile ? '7' : '8'}>Withdrawal Fees</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Pay the cost of the network you are using.</Text>
          </Flex>
          <Flex wrap="wrap" gap="3" justify="center">
            <Flex px="4" py="4" gap="2" style={{ borderRadius: '28px', backgroundColor: 'var(--grass-9)' }}>
              <Icon path={mdiFlashOutline} color="white" size={mobile ? 0.7 : 1}></Icon> 
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>Modern L1s/L2s &lt; $0.90</Heading>
            </Flex>
            <Flex px="4" py="4" gap="2" style={{ borderRadius: '28px', backgroundColor: 'var(--amber-9)' }}>
              <Icon path={mdiFlash} color="black" size={mobile ? 0.7 : 1}></Icon> 
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'black' }}>Standard L1s/L2s &lt; $1.50</Heading>
            </Flex>
            <Flex px="4" py="4" gap="2" style={{ borderRadius: '28px', backgroundColor: 'var(--red-9)' }}>
              <Icon path={mdiFlashAlert} color="white" size={mobile ? 0.7 : 1}></Icon> 
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>Legacy L1s &lt; $20.00</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <License style={{ marginTop: '140px' }}></License>
    </Box>
  );
}