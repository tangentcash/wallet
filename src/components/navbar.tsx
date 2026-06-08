import { Box, Button, Flex, Text, Tooltip } from "@radix-ui/themes";
import { mdiContactlessPaymentCircleOutline, mdiDotsCircle, mdiRulerSquareCompass, mdiSquareRoundedBadgeOutline } from "@mdi/js";
import { useLocation, useNavigate } from "react-router";
import { AppData } from "../core/app";
import { useMemo } from "react";
import Icon from "@mdi/react";

type Route = {
  path: string | string[],
  name: string,
  tip: string,
  icon: string,
  disabled?: (path: string) => boolean
};

const types: Route[] = [
  { path: ['/', '/explorer', '/block', '/transaction', '/account', '/program'], name: 'Hub', tip: 'Account & Blockchain', icon: mdiSquareRoundedBadgeOutline },
  { path: ['/portfolio', '/orderbook'], name: 'Swap', tip: 'Trade & Analyze', icon: mdiRulerSquareCompass },
  { path: ['/interaction', '/restore'], name: 'Pay', tip: 'Pay & Interact', icon: mdiContactlessPaymentCircleOutline, disabled: (path: string) => path.startsWith('/restore') && !AppData.isWalletReady() },
  { path: ['/configure', '/legal', '/app'], name: 'App', tip: 'Info & Settings', icon: mdiDotsCircle }
]

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const routes = useMemo((): (Route & { selected: boolean, inner: boolean })[] => {
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
        if (target != '/' ? location.pathname.startsWith(target) : target == location.pathname) {
          return true;
        }
      }
      return false;
    }) || sortedSubtypes[sortedSubtypes.length - 1]).path;
    return types.map((item) => ({
      ...item,
      selected: item.path == selected,
      inner: item.path == selected ? (typeof item.path == 'string' || (item.path[0] == '/' ? location.pathname != '/' : !location.pathname.startsWith(item.path[0]))) : false
    }));
  }, [location.pathname]);

  AppData.state.setNavigation = navigate;
  return (
    <Box position="fixed" bottom="0" left="0" right="0" style={{ zIndex: 10000 }}>
      <Flex justify="center">
        <Box maxWidth="640px" pb="4">
          <Box className="rt-Card" style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-panel)',
            border: '1px solid var(--gray-6)',
            borderRadius: "100px",
            filter: "saturate(0.7) brightness(1.1)",
            WebkitBackdropFilter: "blur(24px)",
            backdropFilter: "blur(24px)",
            padding: '6px 8px'
          }}>
            <Flex gap="1">
              {
                routes.map((item) =>
                  <Box key={typeof item.path == 'string' ? item.path : item.path[0]}>
                    <Tooltip content={item.tip}>
                      <Button size="3" variant="outline" style={{ boxShadow: item.inner ? undefined : 'none', backgroundColor: item.selected && !item.inner ? 'var(--lime-a3)' : undefined, height: 'auto' }} color="lime" disabled={item.disabled ? item.disabled(location.pathname) : false} onClick={() => {
                        if (!item.selected || item.inner) {
                          navigate(typeof item.path == 'string' ? item.path : item.path[0]);
                        }
                      }}>
                        <Flex direction="column" align="center" py="2" px="1">
                          <Icon path={item.icon} size={1} />
                          <Text size="1">{item.name}</Text>
                        </Flex>
                      </Button>
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