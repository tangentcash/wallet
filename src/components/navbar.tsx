import { Box, Button, Card, Flex, IconButton, Tooltip } from "@radix-ui/themes";
import { mdiContactlessPaymentCircleOutline, mdiDotsCircle, mdiLogin, mdiMagnifyScan, mdiSetRight, mdiSquareRoundedBadgeOutline } from "@mdi/js";
import { useNavigate } from "react-router";
import Icon from "@mdi/react";

const types: { path: string, name: string, tip: string, color: string | undefined, icon: string, persistent: boolean }[] = [
  { path: '/', name: 'Home', tip: 'My account', color: undefined, icon: mdiSquareRoundedBadgeOutline, persistent: true },
  { path: '/depository', name: 'Depository', tip: 'Deposit/withdrawal depositories', color: 'orange', icon: mdiSetRight, persistent: true },
  { path: '/interaction', name: 'Pay', tip: 'Send transaction', color: 'jade', icon: mdiContactlessPaymentCircleOutline, persistent: true },
  { path: '/configure', name: 'Configure', tip: 'App settings', color: 'yellow', icon: mdiDotsCircle, persistent: true },
  { path: '/block', name: 'Block', tip: 'Block details', color: 'blue', icon: mdiMagnifyScan, persistent: false },
  { path: '/transaction', name: 'Txn', tip: 'Transaction details', color: 'blue', icon: mdiMagnifyScan, persistent: false },
  { path: '/account', name: 'Account', tip: 'Account details', color: 'blue', icon: mdiMagnifyScan, persistent: false },
  { path: '/restore', name: 'Lockscreen', tip: 'Wallet management', color: undefined, icon: mdiLogin, persistent: false }
]

export function Navbar(props: { path: string }) {
  const path = props.path;
  const main = types.filter((item) => path.startsWith(item.path)).sort((a, b) => b.path.length - a.path.length)[0]?.path || null;
  const navigate = useNavigate();
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
                types.map((item) => {
                  if (item.path == main) {
                    return (
                      <Tooltip content={item.tip} key={item.path}>
                        <Button size="2" variant="outline" color={item.color as any}>
                          <Icon path={item.icon} size={1} />
                          {item.name}
                        </Button>
                      </Tooltip>
                    );
                  } else if (item.persistent) {
                    return (
                      <Tooltip content={item.tip} key={item.path}>
                        <IconButton size="2" variant="soft" onClick={() => navigate(item.path)}>
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