import { Box, Button, Card, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { mdiCardsOutline, mdiChartTimelineVariantShimmer, mdiContactlessPaymentCircleOutline, mdiDotsCircle, mdiExitToApp, mdiLogin, mdiMagnifyScan, mdiRulerSquareCompass, mdiSetRight, mdiSquareRoundedBadgeOutline } from "@mdi/js";
import { useNavigate } from "react-router";
import { AppData } from "../core/app";
import { Wormhole } from "../core/wormhole";
import { useMemo } from "react";
import { useEffectAsync } from "../core/react";
import Icon from "@mdi/react";

const types: {
  path: string,
  name: string,
  tip: string,
  icon: string,
  baseColor?: string,
  activeColor?: string,
  persistent?: boolean,
  deep?: boolean,
  disabled?: () => boolean,
  toPath?: () => string
}[] = [
  { path: '/', name: 'Home', tip: 'My account', icon: mdiSquareRoundedBadgeOutline, persistent: true },
  { path: '/depository', name: 'Depository', tip: 'Fund/withdrawal', icon: mdiSetRight, activeColor: 'orange', persistent: true },
  { path: '/interaction', name: 'Pay', tip: 'Send transaction', activeColor: 'jade', icon: mdiContactlessPaymentCircleOutline, persistent: true },
  { path: '/configure', name: 'Configure', tip: 'App settings', activeColor: 'yellow', icon: mdiDotsCircle, persistent: true },
  { path: '/block', name: 'Block', tip: 'Block details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/transaction', name: 'Txn', tip: 'Transaction details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/account', name: 'Account', tip: 'Account details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/restore', name: 'Lockscreen', tip: 'Wallet management', icon: mdiLogin },
  { path: `${Wormhole.subroute}`, name: 'Portfolio', tip: 'My portfolio', icon: mdiCardsOutline, baseColor: 'orange', activeColor: 'orange', persistent: true },
  { path: `${Wormhole.subroute}/explorer`, name: 'Explorer', tip: 'Market explorer', icon: mdiRulerSquareCompass, baseColor: 'orange', activeColor: 'orange', persistent: true },
  { path: `${Wormhole.subroute}/orderbook`, name: 'Trading', tip: 'Current market', icon: mdiChartTimelineVariantShimmer, baseColor: 'orange', activeColor: 'orange', persistent: true, deep: true, disabled: () => !Wormhole.getOrderbook(), toPath: () => `${Wormhole.subroute}/orderbook/${Wormhole.getOrderbook()}` },
  { path: `${Wormhole.subroute}/exit`, name: 'Exit', tip: 'Exit wormhole', icon: mdiExitToApp, baseColor: 'red', activeColor: 'red', persistent: true, toPath: () => '/' }
]

export function Navbar(props: { path: string }) {
  const navigate = useNavigate();
  const wormhole = useMemo(() => props.path.startsWith(Wormhole.subroute), [props.path]);
  const filteredTypes = useMemo(() => {
    return types.filter((item) => item.path.startsWith(Wormhole.subroute) == wormhole);
  }, [wormhole]);
  const locator = useMemo(() => {
    return filteredTypes.filter((item) => props.path.startsWith(item.path)).sort((a, b) => b.path.length - a.path.length)[0]?.path || null;
  }, [filteredTypes, props.path]);
  useEffectAsync(async () => {
    if (wormhole) {
      const account = AppData.getWalletAddress();
      await Wormhole.initialize(account ? [account] : []);
    }
  }, [wormhole]);

  AppData.state.setNavigation = navigate;
  return (
    <Box position="fixed" bottom="0" left="0" right="0" style={{ zIndex: 10000 }}>
      <Flex justify="center">
        <Box maxWidth="640px" pb="2">
          <Card style={{
            display: 'inline-block',
            border: '1px solid var(--gray-7)',
            borderRadius: "100px",
            filter: "saturate(0.5) brightness(1.1)",
            WebkitBackdropFilter: "blur(24px)",
            backdropFilter: "blur(24px)"
          }}>
            <Flex gap="2">
              {
                filteredTypes.map((item) => {
                  if (item.deep ? locator?.startsWith(item.path) : item.path == locator) {
                    return (
                      <Tooltip content={item.tip} key={item.path}>
                        <Button size="2" variant="outline" color={item.activeColor as any} disabled={item.disabled ? item.disabled() : false} >
                          <Icon path={item.icon} size={1} />
                          {item.name}
                        </Button>
                      </Tooltip>
                    );
                  } else if (item.persistent) {
                    return (
                      <Tooltip content={item.tip} key={item.path}>
                        <IconButton size="2" variant="soft" color={item.baseColor as any} disabled={item.disabled ? item.disabled() : false} onClick={() => navigate(item.toPath ? item.toPath() : item.path)}>
                          <Icon path={item.icon} size={1} />
                        </IconButton>
                      </Tooltip>
                    );
                  } else {
                    return <div style={{ display: 'none' }} key={item.path}></div>;
                  }
                })
              }
            </Flex>
          </Card>
        </Box>
      </Flex>
    </Box>
  );
}