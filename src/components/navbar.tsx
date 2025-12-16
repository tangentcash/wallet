import { Box, Button, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { mdiCardsOutline, mdiChartTimelineVariantShimmer, mdiContactlessPaymentCircleOutline, mdiDotsCircle, mdiExitToApp, mdiMagnifyScan, mdiRulerSquareCompass, mdiSetRight, mdiSquareRoundedBadgeOutline } from "@mdi/js";
import { useLocation, useNavigate } from "react-router";
import { AppData } from "../core/app";
import { Swap } from "../core/swap";
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
  disabled?: (path: string) => boolean,
  toPath?: () => string
}[] = [
  { path: '/', name: 'Home', tip: 'My account', icon: mdiSquareRoundedBadgeOutline, persistent: true },
  { path: '/bridge', name: 'Bridge', tip: 'Bridge transaction', icon: mdiSetRight, activeColor: 'orange', persistent: true },
  { path: '/interaction', name: 'Pay', tip: 'Send transaction', activeColor: 'jade', icon: mdiContactlessPaymentCircleOutline, persistent: true, disabled: (path: string) => path.startsWith('/restore') && !AppData.isWalletReady() },
  { path: '/configure', name: 'Configure', tip: 'App settings', activeColor: 'yellow', icon: mdiDotsCircle, persistent: true },
  { path: '/block', name: 'Block', tip: 'Block details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/transaction', name: 'Txn', tip: 'Transaction details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/account', name: 'Account', tip: 'Account details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: `${Swap.subroute}`, name: 'Portfolio', tip: 'My portfolio', icon: mdiCardsOutline, baseColor: 'orange', activeColor: 'orange', persistent: true },
  { path: `${Swap.subroute}/explorer`, name: 'Explorer', tip: 'Market explorer', icon: mdiRulerSquareCompass, baseColor: 'orange', activeColor: 'orange', persistent: true },
  { path: `${Swap.subroute}/orderbook`, name: 'Trading', tip: 'Current market', icon: mdiChartTimelineVariantShimmer, baseColor: 'orange', activeColor: 'orange', persistent: true, deep: true, disabled: () => !Swap.getOrderbook(), toPath: () => `${Swap.subroute}/orderbook/${Swap.getOrderbook()}` },
  { path: `${Swap.subroute}/exit`, name: 'Exit', tip: 'Exit trading', icon: mdiExitToApp, baseColor: 'red', activeColor: 'red', persistent: true, toPath: () => '/' }
]

export function Navbar() {
  const enlarge = document.body.clientWidth < 600;
  const location = useLocation();
  const navigate = useNavigate();
  const swap = useMemo(() => location.pathname.startsWith(Swap.subroute), [location.pathname]);
  const filteredTypes = useMemo(() => {
    return types.filter((item) => item.path.startsWith(Swap.subroute) == swap);
  }, [swap]);
  const locator = useMemo(() => {
    return filteredTypes.filter((item) => location.pathname.startsWith(item.path)).sort((a, b) => b.path.length - a.path.length)[0]?.path || null;
  }, [filteredTypes, location.pathname]);
  useEffectAsync(async () => {
    if (swap) {
      const account = AppData.getWalletAddress();
      await Swap.initialize(account ? [account] : []);
    }
  }, [swap]);

  AppData.state.setNavigation = navigate;
  return (
    <Box position="fixed" bottom="0" left="0" right="0" style={{ zIndex: 10000 }}>
      <Flex justify="center">
        <Box maxWidth="640px" pb="4">
          <Box style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-panel)',
            borderRadius: "100px",
            filter: "saturate(0.5) brightness(1.1)",
            WebkitBackdropFilter: "blur(24px)",
            backdropFilter: "blur(24px)",
            padding: '12px'
          }}>
            <Flex gap="2">
              {
                filteredTypes.map((item) => {
                  if (item.deep ? locator?.startsWith(item.path) : item.path == locator) {
                    return (
                      <Tooltip content={item.tip} key={item.path}>
                        <Button size={enlarge ? '3' : '2'} variant="outline" style={{ boxShadow: `inset 0 0 0 1px var(--${item.activeColor || 'jade'}-a7)` }} color={item.activeColor as any} disabled={item.disabled ? item.disabled(location.pathname) : false}>
                          <Icon path={item.icon} size={1} />
                          {item.name}
                        </Button>
                      </Tooltip>
                    );
                  } else if (item.persistent) {
                    return (
                      <Tooltip content={item.tip} key={item.path}>
                        <IconButton size={enlarge ? '3' : '2'} variant="soft" color={item.baseColor as any} disabled={item.disabled ? item.disabled(location.pathname) : false} onClick={() => navigate(item.toPath ? item.toPath() : item.path)}>
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
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}