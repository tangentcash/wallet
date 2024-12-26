import { mdiBackburger, mdiBugOutline, mdiCached, mdiLocationExit, mdiReloadAlert } from "@mdi/js";
import { Badge, Box, Button, Card, DataList, Flex, Heading, Separator, Switch, Tabs, Text } from "@radix-ui/themes";
import { useNavigate } from "react-router";
import { AppData } from "../app";
import { useCallback, useState } from "react";
import { Interface, Wallet } from "../core/wallet";
import { AlertBox, AlertType } from "../components/alert";
import { Readability } from "../core/text";
import { ByteUtil, Hashing } from "../core/tangent/algorithm";
import Icon from "@mdi/react";

export default function ConfigurePage() {
  const [tab, setTab] = useState('client');
  const [loadingStreaming, setLoadingStreaming] = useState(false);
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const navigate = useNavigate();
  const setWsStreaming = useCallback(async (streaming: boolean) => {
    if (loadingStreaming)
      return false;

    const props = Interface.getProps();
    props.streaming = streaming;
    setLoadingStreaming(true);
    if (props.streaming) {
      const result = await Interface.connectSocket();
      if (result != null && result > 0) {
        AlertBox.open(AlertType.Info, 'Connected to ' + (Interface.socket?.url || '[unknown]'));
      }
    } else {
      const url = Interface.socket?.url || '[unknown]';
      const result = await Interface.disconnectSocket();
      if (result) {
        AlertBox.open(AlertType.Info, 'Disconnected ' + url);
      }
    }

    setLoadingStreaming(false);
    Interface.saveProps(props);
    return true;
  }, [loadingStreaming]);

  return (
    <Box px="4" pt="4">
      <Flex justify="between" align="center">
        <Heading size="6">Options</Heading>
        <Button variant="soft" size="2" color="indigo" onClick={() => navigate(-1)}>
          <Icon path={mdiBackburger} size={0.7} /> BACK
        </Button>
      </Flex>
      <Box width="100%" mt="4" mb="5">
        <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
      </Box>
      <Card>
        <Tabs.Root value={tab} onValueChange={(value) => setTab(value)}>
          <Tabs.List>
            <Tabs.Trigger value="client">
              <Text size="4">Client</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="server">
              <Text size="4">Server</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="help">
              <Text size="4">Help</Text>
            </Tabs.Trigger>
          </Tabs.List>
          <Box pt="3">
            <Tabs.Content value="client">
              <Box px="4" py="2">
                <Text as="label" size="1">
                  <Flex gap="2" align="center" justify="between">
                    <Text size="4" weight="medium">Dark theme</Text>
                    <Switch size="3" variant="soft" checked={AppData.props.appearance == 'dark'} onCheckedChange={(value) => AppData.setAppearance(value ? 'dark' : 'light')}/>
                  </Flex>
                </Text>
                <Flex justify="between" mt="4">
                  <Text size="4" weight="medium">Lock wallet</Text>
                  <Button size="2" variant="soft" color="red" onClick={() => Wallet.clear(() => navigate('/restore'))}>
                    <Icon path={mdiLocationExit} size={0.85} />
                  </Button>
                </Flex>
              </Box>
            </Tabs.Content>
            <Tabs.Content value="server">
              <Box px="4" py="2">
                <Text as="label" size="1">
                  <Flex gap="2" align="center" justify="between">
                    <Text size="4" weight="medium">Use ws streaming</Text>
                    <Switch size="3" variant="soft" checked={Interface.getProps().streaming} onCheckedChange={(value) => setWsStreaming(value)}/>
                  </Flex>
                </Text>
                <Box>
                  <Separator size="4" my="5" />
                </Box>
                {
                  !Object.entries(AppData.server.connections).length &&
                  <Text color="gray">No recent network activity</Text>
                }
                {
                  Object.entries(AppData.server.connections).map((index) =>
                    <Box key={index[0]}>
                      <Card mt="4">
                        <Flex gap="3" align="center" mb="3">
                          <Heading size="4">Interface server</Heading>
                          <Badge size="2" variant="soft" radius="medium">{ByteUtil.uint8ArrayToHexString(Hashing.hash160(ByteUtil.utf8StringToUint8Array(index[0]))).substring(0, 6)}</Badge>
                        </Flex>
                        <DataList.Root size="2" orientation={orientation}>
                          <DataList.Item align="center">
                            <DataList.Label>Hostname</DataList.Label>
                            <DataList.Value>
                              <Badge size="2" color="yellow" variant="soft" radius="full">{index[0]}</Badge>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item align="center">
                            <DataList.Label>Last use</DataList.Label>
                            <DataList.Value>
                              <Text size="2">{ index[1].time.toLocaleString() }</Text>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item align="center">
                            <DataList.Label>Requests</DataList.Label>
                            <DataList.Value>
                              <Text size="2">{ Readability.toCount('request', index[1].requests) } — { Readability.toCount('byte', index[1].sentBytes) }</Text>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item align="center">
                            <DataList.Label>Responses</DataList.Label>
                            <DataList.Value>
                              <Text size="2">{ Readability.toCount('response', index[1].responses) } — { Readability.toCount('byte', index[1].receivedBytes) }</Text>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item align="center">
                            <DataList.Label>Reliability</DataList.Label>
                            <DataList.Value>
                              <Badge size="2" color={index[1].responses / index[1].requests < 0.9 ? 'red' : 'jade'} variant="soft" radius="full">{ (100 * Math.min(1, index[1].responses / index[1].requests)).toFixed(2) }%</Badge>
                            </DataList.Value>
                          </DataList.Item>
                          <DataList.Item align="center">
                            <DataList.Label>Bandwidth</DataList.Label>
                            <DataList.Value>
                              <Text size="2">{ Readability.toCount('byte', index[1].sentBytes + index[1].receivedBytes) }</Text>
                            </DataList.Value>
                          </DataList.Item>
                        </DataList.Root>
                      </Card>
                    </Box>
                  )
                }
              </Box>
            </Tabs.Content>
            <Tabs.Content value="help">
              <Box px="4" py="2">
                <Flex justify="between">
                  <Text size="4" weight="medium">Clear cache</Text>
                  <Button size="2" variant="soft" color="jade" onClick={() => {
                    Interface.clearCache();
                    AlertBox.open(AlertType.Info, 'Application cache erased');
                  }}>
                    <Icon path={mdiCached} size={0.85} />
                  </Button>
                </Flex>
                <Flex justify="between" mt="4">
                  <Text size="4" weight="medium">Reload app</Text>
                  <Button size="2" variant="soft" onClick={() => location.reload()}>
                    <Icon path={mdiReloadAlert} size={0.85} />
                  </Button>
                </Flex>
                <Flex justify="between" mt="4">
                  <Text size="4" weight="medium">Show debugger</Text>
                  <Button size="2" variant="soft" color="yellow" onClick={() => AppData.openDevTools()}>
                    <Icon path={mdiBugOutline} size={0.85} />
                  </Button>
                </Flex>
              </Box>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Card>
    </Box>
  );
}