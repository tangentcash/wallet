import { Box, Button, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { mdiAlertDecagramOutline, mdiContactlessPaymentCircleOutline, mdiDotsCircle, mdiDownload, mdiMagnifyScan, mdiRulerSquareCompass, mdiScaleBalance, mdiSquareRoundedBadgeOutline } from "@mdi/js";
import { useLocation, useNavigate } from "react-router";
import { AppData } from "../core/app";
import { useMemo } from "react";
import Icon from "@mdi/react";

type Route = {
  path: string | string[],
  name: string,
  tip: string,
  icon: string,
  baseColor?: string,
  activeColor?: string,
  persistent?: boolean,
  deep?: boolean,
  disabled?: (path: string) => boolean
};

const types: Route[] = [
  { path: '/', name: 'Home', tip: 'Account & Balances', icon: mdiSquareRoundedBadgeOutline, persistent: true },
  { path: '/portfolio', name: 'Trade', tip: 'Trade & Analyze', icon: mdiRulerSquareCompass, persistent: true, deep: true },
  { path: ['/interaction', '/restore'], name: 'Pay', tip: 'Pay & Interact', icon: mdiContactlessPaymentCircleOutline, persistent: true, disabled: (path: string) => path.startsWith('/restore') && !AppData.isWalletReady() },
  { path: '/configure', name: 'Configure', tip: 'Settings & Statistics', icon: mdiDotsCircle, persistent: true },
  { path: '/legal', name: 'Legal', tip: 'Legal documents', icon: mdiScaleBalance, activeColor: 'yellow' },
  { path: '/app', name: 'App', tip: 'Get the app', icon: mdiDownload, activeColor: 'yellow' },
  { path: '/explorer', name: 'Explorer', tip: 'Explorer', icon: mdiMagnifyScan, activeColor: 'blue' },
  { path: '/block', name: 'Block', tip: 'Block explorer', icon: mdiMagnifyScan, activeColor: 'blue', deep: true },
  { path: '/transaction', name: 'Txn', tip: 'Transaction explorer', icon: mdiMagnifyScan, activeColor: 'blue', deep: true },
  { path: '/program', name: 'Program', tip: 'Program explorer', icon: mdiMagnifyScan, activeColor: 'blue', deep: true },
  { path: '/account', name: 'Account', tip: 'Account explorer', icon: mdiMagnifyScan, activeColor: 'blue', deep: true },
  { path: '/orderbook/', name: 'Market', tip: 'Market explorer', icon: mdiMagnifyScan, activeColor: 'blue', deep: true },
  { path: '*', name: 'Error', tip: 'Unknown place', icon: mdiAlertDecagramOutline, activeColor: 'red', deep: true }
]

export function Navbar() {
  const enlarge = document.body.clientWidth < 600;
  const location = useLocation();
  const navigate = useNavigate();
  const routes = useMemo((): (Route & { selected: boolean })[] => {
    const toLongestString = (x: string[]) => {
      let target = '';
      for (let i = 0; i < x.length; i++) {
        if (target.length < x[i].length)
          target = x[i];
      }
      return target;
    };
    const sortedSubtypes = [...types].sort((a, b) => {
      if (a.path == '*')
        return Number.MAX_SAFE_INTEGER;
      else if (b.path == '*')
        return Number.MIN_SAFE_INTEGER;

      let aPath = Array.isArray(a.path) ? toLongestString(a.path) : a.path;
      let bPath = Array.isArray(b.path) ? toLongestString(b.path) : b.path;
      return bPath.length - aPath.length
    });
    const selected = (sortedSubtypes.find((item) => {
      const targets = typeof item.path == 'string' ? [item.path] : item.path;
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (item.deep ? location.pathname.startsWith(target) : target == location.pathname) {
          return true;
        }
      }
      return false;
    }) || sortedSubtypes[sortedSubtypes.length - 1]).path;
    return types.map((item) => ({
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
            filter: "saturate(0.7) brightness(1.1)",
            WebkitBackdropFilter: "blur(24px)",
            backdropFilter: "blur(24px)",
            padding: '12px'
          }}>
            <Flex gap="2">
              {
                routes.map((item) =>
                  <Box key={typeof item.path == 'string' ? item.path : item.path[0]}>
                    <Tooltip content={item.tip}>
                      <Box>
                        {
                          item.selected &&
                          <Button size={enlarge ? '3' : '2'} variant="outline" style={{ boxShadow: `inset 0 0 0 1px var(--${item.activeColor || 'lime'}-a7)` }} color={item.activeColor as any} disabled={item.disabled ? item.disabled(location.pathname) : false}>
                            <Icon path={item.icon} size={1} />
                            {item.name}
                          </Button>
                        }
                        {
                          !item.selected &&
                          <IconButton size={enlarge ? '3' : '2'} variant="soft" color={item.baseColor as any} disabled={item.disabled ? item.disabled(location.pathname) : false} onClick={() => navigate(typeof item.path == 'string' ? item.path : item.path[0])}>
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