import { mdiArrowBottomLeft, mdiArrowBottomRight, mdiArrowDown, mdiContactlessPayment, mdiCreation, mdiFire, mdiLightbulbOn, mdiLightbulbOutline, mdiLogin, mdiMenu, mdiScaleBalance, mdiSchool } from "@mdi/js";
import { Avatar, Box, Button, DropdownMenu, Flex, Heading, IconButton, Text } from "@radix-ui/themes";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { AssetId, Readability } from "tangentsdk";
import { AppData } from "../core/app";
import Icon from "@mdi/react";
import License from "../components/license";

export default function HypePage() {
  const mobile = document.body.clientWidth < 510;
  const navigate = useNavigate();
  const [blockchains] = useState([
    'ADA',
    'BTC',
    'ETH',
    'SOL',
    'TRX',
    'XRP',
    'XLM'
  ].sort());
  return (
    <Box position="relative">
      <Box position="absolute" top="0" bottom="0" left="0" right="0" style={{
        zIndex: -1,
        backgroundImage: 'linear-gradient(var(--bronze-a3) 1px, transparent 1px), linear-gradient(90deg, var(--bronze-a3) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        filter: 'drop-shadow(0px 0px 3px var(--bronze-a9))'
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
              <Heading size="5">Tangent<Text color="lime">Cash</Text></Heading>
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
              Create a wallet <Icon path={mdiLogin} size={1}></Icon>
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
            <Text align="center" size={mobile ? '3' : '4'}>Forget about KYC abuse and fronzen accounts.</Text>
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
            <Heading align="center" size={mobile ? '7' : '8'}>Cheap Bridging</Heading>
          </Flex>
          <Flex justify="center" mb="8">
            <Text align="center" size={mobile ? '3' : '4'}>Withdrawal fees are the same no matter the amount.</Text>
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
              <Heading size={mobile ? '2' : '4'} weight="regular" style={{ color: 'white' }}>Fixed Fee Withdrawal</Heading>
            </Flex>
          </Flex>
        </Box>
      </Box>
      <License style={{ marginTop: '140px' }}></License>
    </Box>
  );
}