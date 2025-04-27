import { mdiAlertOctagram, mdiBackburger, mdiBugOutline, mdiCached, mdiLocationExit, mdiReloadAlert } from "@mdi/js";
import { Badge, Box, Button, Card, DataList, Flex, Heading, Switch, Table, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useNavigate } from "react-router";
import { AppData } from "../app";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Interface, Wallet } from "../core/wallet";
import { AlertBox, AlertType } from "../components/alert";
import { Readability } from "../core/text";
import { SafeStorage, StorageField } from "../core/storage";
import { ByteUtil, Signing } from "../core/tangent/algorithm";
import Icon from "@mdi/react";

function toServerInfo(url: string): string {
  try {
    const info = new URL(url);
    switch (info.protocol) {
      case 'http:':
        return 'http — ' + info.hostname + ':' + (info.port || '80');
      case 'https:':
        return 'https — ' + info.hostname + ':' + (info.port || '443');
      case 'ws:':
        return 'ws — ' + info.hostname + ':' + (info.port || '80');
      case 'wss:':
        return 'wss — ' + info.hostname + ':' + (info.port || '443');
      default:
        throw false;
    }
  } catch {
    return url;
  }
}

export default function ConfigurePage() {
  const [counter, setCounter] = useState(0);
  const [loadingStreaming, setLoadingStreaming] = useState(false);
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const navigate = useNavigate();
  const networkInfo = useMemo<{ connections: number, sentBytes: number, receivedBytes: number, requests: number, responses: number, minTime: Date | null, maxTime: Date | null }>(() => {
    const indices = Object.entries(AppData.server.connections);
    let minTime: Date | null = null;
    let maxTime: Date | null = null;
    let sentBytes: number = 0;
    let receivedBytes: number = 0;
    let requests: number = 0;
    let responses: number = 0;
    let connections: number = indices.length;
    indices.map((item) => {
      const connection = item[1];
      sentBytes += connection.sentBytes;
      receivedBytes += connection.receivedBytes;
      requests += connection.requests;
      responses += connection.responses;
      if (minTime == null || minTime.getTime() > connection.time.getTime())
        minTime = connection.time;
      if (maxTime == null || maxTime.getTime() < connection.time.getTime())
        maxTime = connection.time;
    });
    return {
      connections: connections,
      sentBytes: sentBytes,
      receivedBytes: receivedBytes,
      requests: requests,
      responses: responses,
      minTime: minTime,
      maxTime: maxTime
    };
  }, [counter]);
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
  useEffect(() => {
    const timeout = setInterval(() => setCounter(new Date().getTime()), 1000);
    return () => clearInterval(timeout);
  }, []);

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="580px">
      <Flex justify="between" align="center">
        <Heading size="6">Options</Heading>
        <Button variant="soft" size="2" color="indigo" onClick={() => navigate(-1)}>
          <Icon path={mdiBackburger} size={0.7} /> BACK
        </Button>
      </Flex>
      <Box width="100%" mt="4">
        <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
      </Box>
      <Card mt="4">
        <Box px="2" py="2">
          <Heading size="5" mb="2">Client options</Heading>
          <Text as="label" size="1">
            <Flex gap="2" align="center" justify="between">
              <Text size="2" color="gray">Dark theme</Text>
              <Switch size="3" variant="soft" checked={AppData.props.appearance == 'dark'} onCheckedChange={(value) => AppData.setAppearance(value ? 'dark' : 'light')}/>
            </Flex>
          </Text>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Clear client cache</Text>
            <Button size="2" variant="soft" color="jade" onClick={() => {
              Interface.clearCache();
              AlertBox.open(AlertType.Info, 'Application cache erased');
            }}>
              <Icon path={mdiCached} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Reload client app</Text>
            <Button size="2" variant="soft" onClick={() => location.reload()}>
              <Icon path={mdiReloadAlert} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Show client debugger</Text>
            <Button size="2" variant="soft" color="yellow" onClick={() => AppData.openDevTools()}>
              <Icon path={mdiBugOutline} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Seal wallet</Text>
            <Button size="2" variant="soft" color="red" onClick={() => Wallet.clear(() => navigate('/restore'))}>
              <Icon path={mdiLocationExit} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Export wallet</Text>
            <Button size="2" variant="soft" color="red" onClick={async () => {
                const mnemonic = await SafeStorage.get(StorageField.Mnemonic);
                const secretKey = Wallet.getSecretKey(); 
                const publicKey = Wallet.getPublicKey();
                const publicKeyHash = Wallet.getPublicKeyHash();
                const address = Wallet.getAddress();
                AppData.saveFile('wallet.json', 'application/json', JSON.stringify({
                  mnemonic: mnemonic != null && Array.isArray(mnemonic) ? mnemonic.join(' ') : undefined,
                  secret_key: secretKey != null ? Signing.encodeSecretKey(secretKey) || undefined : undefined,
                  public_key: publicKey != null ? Signing.encodePublicKey(publicKey) || undefined : undefined,
                  public_key_hash: publicKeyHash != null ? ByteUtil.uint8ArrayToHexString(publicKeyHash.data) || undefined : undefined,
                  address: address
                }, null, 2));
              }}>
              <Icon path={mdiAlertOctagram} size={0.85} />
            </Button>
          </Flex>
        </Box>
      </Card>
      <Card mt="4">
        <Box px="2" py="2">
          <Heading size="5" mb="1">Server options</Heading>
          <Tooltip content="This discovery server helps the client to find validator servers">
            <TextField.Root size="2" placeholder="Resolver server address" type="text" mt="2" value={AppData.props.resolver || ''} onChange={(e) => {
              AppData.setResolver(e.target.value);
              setCounter(new Date().getTime());
            }} />
          </Tooltip>
          <Tooltip content="This validator server is the only one used to interact with Tangent (if present)">
            <TextField.Root size="2" placeholder="Validator server address" type="text" mt="2" value={AppData.props.server || ''} onChange={(e) => {
              AppData.setServer(e.target.value);
              setCounter(new Date().getTime());
            }} />
          </Tooltip>
          <Text as="label" size="1">
            <Flex gap="2" align="center" justify="between" mt="3" pl="1">
              <Text size="2" color="gray">Use websocket streaming</Text>
              <Switch size="3" variant="soft" checked={Interface.getProps().streaming} onCheckedChange={(value) => setWsStreaming(value)}/>
            </Flex>
          </Text>
        </Box>
      </Card>
      <Card mt="4">
        <Box px="2" py="2">
          <Heading size="5" mb="3">Network statistics</Heading>
          <DataList.Root size="2" orientation={orientation}>
            <DataList.Item align="center">
              <DataList.Label>Reliability</DataList.Label>
              <DataList.Value>
                <Badge size="2" color={(networkInfo.requests ? networkInfo.responses / networkInfo.requests < 0.9 : false) ? 'red' : 'jade'} variant="soft" radius="full">{ (100 * Math.min(1, networkInfo.requests > 0 ? networkInfo.responses / networkInfo.requests : 1)).toFixed(2) }%</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label>Connections</DataList.Label>
              <DataList.Value>
                <Text size="2">{ Readability.toCount('connection', networkInfo.connections) }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label>Requests</DataList.Label>
              <DataList.Value>
                <Text size="2">{ Readability.toCount('request', networkInfo.requests) } — { Readability.toCount('byte', networkInfo.sentBytes) }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label>Responses</DataList.Label>
              <DataList.Value>
                <Text size="2">{ Readability.toCount('response', networkInfo.responses) } — { Readability.toCount('byte', networkInfo.receivedBytes) }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label>Bandwidth</DataList.Label>
              <DataList.Value>
                <Text size="2">{ Readability.toCount('byte', networkInfo.sentBytes + networkInfo.receivedBytes) }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label>Oldest use</DataList.Label>
              <DataList.Value>
                <Text size="2">{ networkInfo.minTime ? networkInfo.minTime.toLocaleString() : 'never' }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item align="center">
              <DataList.Label>Latest use</DataList.Label>
              <DataList.Value>
                <Text size="2">{ networkInfo.maxTime ? networkInfo.maxTime.toLocaleString() : 'never' }</Text>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
          {
            Object.entries(AppData.server.connections).length > 0 &&
            <Table.Root variant="surface" mt="4">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Server</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Reliability</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {
                  Object.entries(AppData.server.connections).map((item) =>
                    <Table.Row key={item[0]}>
                      <Table.RowHeaderCell>{ toServerInfo(item[0]) }</Table.RowHeaderCell>
                      <Table.Cell>
                        <Badge size="2" color={(item[1].requests ? item[1].responses / item[1].requests < 0.9 : false) ? 'red' : 'jade'} variant="soft" radius="full">{ (100 * Math.min(1, item[1].requests > 0 ? item[1].responses / item[1].requests : 1)).toFixed(2) }%</Badge>
                      </Table.Cell>
                    </Table.Row>)
                }
              </Table.Body>
            </Table.Root>
          }
        </Box>
      </Card>
    </Box>
  );
}