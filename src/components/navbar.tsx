import { Box, Button, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { mdiCardsOutline, mdiContactlessPaymentCircleOutline, mdiDotsCircle, mdiExitToApp, mdiMagnifyScan, mdiRulerSquareCompass, mdiSetRight, mdiSquareRoundedBadgeOutline } from "@mdi/js";
import { useLocation, useNavigate } from "react-router";
import { AppData } from "../core/app";
import { Exchange } from "../core/exchange";
import { useMemo } from "react";
import Icon from "@mdi/react";

type Route = {
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
};

const types: Route[] = [
  { path: '/', name: 'Home', tip: 'My account', icon: mdiSquareRoundedBadgeOutline, persistent: true },
  { path: '/bridge', name: 'Bridge', tip: 'Bridge transaction', icon: mdiSetRight, activeColor: 'orange', persistent: true },
  { path: '/interaction', name: 'Pay', tip: 'Send transaction', activeColor: 'jade', icon: mdiContactlessPaymentCircleOutline, persistent: true, disabled: (path: string) => path.startsWith('/restore') && !AppData.isWalletReady() },
  { path: '/configure', name: 'Configure', tip: 'App settings', activeColor: 'yellow', icon: mdiDotsCircle, persistent: true },
  { path: '/block', name: 'Block', tip: 'Block details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/transaction', name: 'Txn', tip: 'Transaction details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/program', name: 'Program', tip: 'Program details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/account', name: 'Account', tip: 'Account details', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: `${Exchange.subroute}`, name: 'Trading', tip: 'Market trading', icon: mdiRulerSquareCompass, baseColor: 'orange', activeColor: 'orange', persistent: true, deep: true },
  { path: `${Exchange.subroute}/portfolio`, name: 'Portfolio', tip: 'My portfolio', icon: mdiCardsOutline, baseColor: 'orange', activeColor: 'orange', persistent: true },
  { path: `${Exchange.subroute}/exit`, name: 'Exit', tip: 'Exit exchange', icon: mdiExitToApp, baseColor: 'red', activeColor: 'red', persistent: true, toPath: () => '/' }
]

export function Navbar() {
  const enlarge = document.body.clientWidth < 600;
  const location = useLocation();
  const navigate = useNavigate();
  const routes = useMemo((): (Route & { selected: boolean })[] => {
    const exchange = location.pathname.startsWith(Exchange.subroute);
    const subtypes = types.filter((item) => item.path.startsWith(Exchange.subroute) == exchange);
    const sortedSubtypes = [...subtypes].sort((a, b) => b.path.length - a.path.length);
    const locator = sortedSubtypes.filter((item) => location.pathname.startsWith(item.path))[0]?.path || null;
    const selected = sortedSubtypes.find((item) => item.deep ? locator?.startsWith(item.path) : item.path == locator)?.path;
    return subtypes.map((item) => ({
      ...item,
      selected: item.path == selected
    })).filter((item) => item.selected || item.persistent);
  }, [location.pathname]);

  AppData.state.setNavigation = navigate;
  return (
    <Box position="fixed" bottom="0" left="0" right="0" style={{ zIndex: 10000 }}>
      <Flex justify="center">
        <Box maxWidth="640px" pb="4">
          <Box style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-panel)',
            border: '1px solid var(--gray-a5)',
            borderRadius: "100px",
            filter: "saturate(0.5) brightness(1.1)",
            WebkitBackdropFilter: "blur(24px)",
            backdropFilter: "blur(24px)",
            padding: '12px'
          }}>
            <Flex gap="2">
              {
                routes.map((item) =>
                  <Box key={item.path}>
                    <Tooltip content={item.tip}>
                      <Box>
                        {
                          item.selected &&
                          <Button size={enlarge ? '3' : '2'} variant="outline" style={{ boxShadow: `inset 0 0 0 1px var(--${item.activeColor || 'jade'}-a7)` }} color={item.activeColor as any} disabled={item.disabled ? item.disabled(location.pathname) : false}>
                            <Icon path={item.icon} size={1} />
                            {item.name}
                          </Button>
                        }
                        {
                          !item.selected &&
                          <IconButton size={enlarge ? '3' : '2'} variant="soft" color={item.baseColor as any} disabled={item.disabled ? item.disabled(location.pathname) : false} onClick={() => navigate(item.toPath ? item.toPath() : item.path)}>
                            <Icon path={item.icon} size={1} />
                          </IconButton>
                        }
                      </Box>
                    </Tooltip>
                  </Box>
                )
              }
            </Flex>
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}