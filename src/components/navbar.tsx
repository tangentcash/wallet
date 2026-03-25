import { Box, Button, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { mdiContactlessPaymentCircleOutline, mdiDotsCircle, mdiMagnifyScan, mdiRulerSquareCompass, mdiSetRight, mdiSquareRoundedBadgeOutline } from "@mdi/js";
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
  { path: '/', name: 'Home', tip: 'My account', icon: mdiSquareRoundedBadgeOutline, persistent: true },
  { path: '/dex/account', name: 'Trade', tip: 'Trading account', icon: mdiRulerSquareCompass, persistent: true },
  { path: ['/interaction', '/restore'], name: 'Pay', tip: 'Send transaction', icon: mdiContactlessPaymentCircleOutline, persistent: true, disabled: (path: string) => path.startsWith('/restore') && !AppData.isWalletReady() },
  { path: '/bridge', name: 'Bridge', tip: 'Deposits and withdrawals', icon: mdiSetRight, persistent: true },
  { path: '/configure', name: 'Configure', tip: 'App settings', icon: mdiDotsCircle },
  { path: '/block', name: 'Block', tip: 'Block details', icon: mdiMagnifyScan },
  { path: '/transaction', name: 'Txn', tip: 'Transaction details', icon: mdiMagnifyScan },
  { path: '/program', name: 'Program', tip: 'Program details', icon: mdiMagnifyScan },
  { path: '/account', name: 'Account', tip: 'Account details', icon: mdiMagnifyScan },
  { path: '/dex/', name: 'Market', tip: 'Market terminal', icon: mdiMagnifyScan, deep: true }
]

export function Navbar() {
  const enlarge = document.body.clientWidth < 600;
  const location = useLocation();
  const navigate = useNavigate();
  const routes = useMemo((): (Route & { selected: boolean })[] => {
    const sortedSubtypes = [...types].sort((a, b) => b.path.length - a.path.length);
    const locator = sortedSubtypes.filter((item) => {
      if (typeof item.path != 'string') {
        for (let i = 0; i < item.path.length; i++) {
          if (location.pathname.startsWith(item.path[i]))
            return true;
        }
        return false;
      } else {
        return location.pathname.startsWith(item.path);
      }
    })[0]?.path || null;
    const locators = locator ? (typeof locator == 'string' ? [locator] : locator) : null;
    const selected = sortedSubtypes.find((item) => {
      if (!locators)
        return false;

      const targets = typeof item.path == 'string' ? [item.path] : item.path;
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        for (let j = 0; j < locators.length; j++) {
          const sublocator = locators[j];
          if (item.deep ? sublocator.startsWith(target) : target == sublocator)
            return true;
        }
      }
      return false;
    })?.path;
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
            filter: "saturate(0.5) brightness(1.1)",
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