import { mdiAlertOctagram, mdiBugOutline, mdiCached, mdiLightbulbOn, mdiLightbulbOutline, mdiLocationExit, mdiRefresh, mdiReloadAlert } from "@mdi/js";
import { Badge, Box, Button, Card, DataList, Flex, Heading, Table, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { SafeStorage, StorageField } from "../core/storage";
import { AppData, AppPermission } from "../core/app";
import { ByteUtil, RPC, Signing, Readability } from "tangentsdk";
import Icon from "@mdi/react";

function toServerInfo(url: string): string {
  try {
    const info = new URL(url);
    switch (info.protocol) {
      case 'http:':
        return info.hostname + ':' + (info.port || '80');
      case 'https:':
        return info.hostname + ':' + (info.port || '443');
      case 'ws:':
        return info.hostname + ':' + (info.port || '80');
      case 'wss:':
        return info.hostname + ':' + (info.port || '443');
      default:
        throw false;
    }
  } catch {
    return url;
  }
}

export default function ConfigurePage() {
  const [counter, setCounter] = useState(0);
  const [resolverAddress, setResolverAddress] = useState(AppData.props.resolver || '');
  const [serverAddress, setServerAddress] = useState(AppData.props.server || '');
  const [loadingProps, setLoadingProps] = useState(false);
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const networkInfo = useMemo<{ connections: number, sentBytes: number, receivedBytes: number, requests: number, responses: number, minTime: Date | null, maxTime: Date | null }>(() => {
    const indices = Object.entries(AppData.server.connections);
    let minTime: Date | null = null;
    let maxTime: Date | null = null;
    let sentBytes: number = 0;
    let receivedBytes: number = 0;
    let requests: number = 0;
    let responses: number = 0;
    let connections: number = 0;
    indices.map((item) => {
      const connection = item[1];
      sentBytes += connection.sentBytes;
      receivedBytes += connection.receivedBytes;
      requests += connection.requests;
      responses += connection.responses;
      connections += connection.active ? 1 : 0;
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
  const setResolverServer = useCallback((address: string) => {
    if (loadingProps)
      return false;

    setLoadingProps(true);
    try {
      const target = address || null;
      if (target != null)
        new URL(target);
      
      AppData.setResolver(target);
      if (target != null)
        AlertBox.open(AlertType.Info, 'Using ' + target + ' for server discovery');
      else
        AlertBox.open(AlertType.Warning, 'Server discovery disabled');
    } catch {
      AlertBox.open(AlertType.Error, 'Resolver address must be a valid URL');
    }

    setLoadingProps(false);
    return true;
  }, [loadingProps]);
  const setOverriderServer = useCallback(async (address: string) => {
    if (loadingProps)
      return false;

    setLoadingProps(true);
    try {
      const target = address || null;
      if (target != null)
        new URL('tcp://' + target);
      
      AppData.setServer(target);
      if (target != null) {
        await RPC.disconnectSocket();
        AppData.reconfigure(null, AppPermission.ReadOnly);
        if (await AppData.sync()) {
          AlertBox.open(AlertType.Info, 'Using ' + target + ' as overriding server');
        } else {
          AlertBox.open(AlertType.Warning, 'Server connection failed');
        }
      } else {
        AlertBox.open(AlertType.Warning, 'Overriding server disabled');
      }
    } catch {
      AlertBox.open(AlertType.Error, 'Server must be in a hostname:port format');
    }

    setLoadingProps(false);
    return true;
  }, [loadingProps]);
  const resetNetwork = useCallback(async () => {
    if (loadingProps)
      return false;

    setLoadingProps(true);
    await RPC.disconnectSocket();
    AppData.reconfigure(null, AppPermission.Reset);
    if (await AppData.sync()) {
      AlertBox.open(AlertType.Info, 'Network reset: connection re-acquired');
    } else {
      AlertBox.open(AlertType.Warning, 'Server connection failed');
    }
    setLoadingProps(false);
    return true;
  }, [loadingProps]);
  useEffect(() => {
    const timeout = setInterval(() => setCounter(new Date().getTime()), 1000);
    return () => clearInterval(timeout);
  }, []);

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="580px">
      <Heading size="6">Configuration</Heading>
      <Box width="100%" mt="4">
        <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
      </Box>
      <Card mt="4">
        <Box px="2" py="2">
          <Heading size="5" mb="2">Client options</Heading>
          <Text as="label" size="1">
            <Flex gap="2" align="center" justify="between">
              <Text size="2" color="gray">Display theme</Text>
              <Button size="2" variant="soft" color="jade" onClick={() => AppData.setAppearance(AppData.props.appearance == 'dark' ? 'light' : 'dark')}>
                <Icon path={AppData.props.appearance == 'dark' ? mdiLightbulbOutline : mdiLightbulbOn} size={0.85} />
              </Button>
            </Flex>
          </Text>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Erase cache</Text>
            <Button size="2" variant="soft" color="jade" onClick={() => {
              RPC.clearCache();
              AlertBox.open(AlertType.Info, 'Application cache erased');
            }}>
              <Icon path={mdiCached} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Reload app</Text>
            <Button size="2" variant="soft" onClick={() => location.reload()}>
              <Icon path={mdiReloadAlert} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Show debugger</Text>
            <Button size="2" variant="soft" color="yellow" onClick={() => AppData.openDevTools()}>
              <Icon path={mdiBugOutline} size={0.85} />
            </Button>
          </Flex>
        </Box>
      </Card>
      <Card mt="4">
        <Box px="2" py="2">
          <Heading size="5" mb="2">Wallet options</Heading>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Wallet status</Text>
            <Badge size="3" color="orange">{ AppData.getWalletSecretKey() != null ? 'Read/write' : 'Read-only' }</Badge>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Close wallet</Text>
            <Button size="2" variant="soft" color="jade" disabled={!AppData.isWalletReady()} onClick={() => AppData.clearWallet()}>
              <Icon path={mdiLocationExit} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Export wallet</Text>
            <Button size="2" variant="soft" color="red" onClick={async () => {
                const mnemonic = await SafeStorage.get(StorageField.Mnemonic);
                const secretKey = AppData.getWalletSecretKey(); 
                const publicKey = AppData.getWalletPublicKey();
                const publicKeyHash = AppData.getWalletPublicKeyHash();
                const address = AppData.getWalletAddress();
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
          <Flex gap="1" mt="2">
            <Tooltip content="This discovery server helps the client to find validator servers">
              <TextField.Root style={{ width: '100%' }} size="2" placeholder="Resolver server address" type="text" value={resolverAddress} onChange={(e) => setResolverAddress(e.target.value.trim())} />
            </Tooltip>
            <Button size="2" variant="soft" color="orange" onClick={() => setResolverServer(resolverAddress)}>
              <Icon path={mdiRefresh} size={0.85} />
            </Button>
          </Flex>
          <Flex gap="1" mt="2">
            <Tooltip content="This validator server is the only one used to interact with Tangent (if present)">
              <TextField.Root style={{ width: '100%' }} size="2" placeholder="Validator server address" type="text" value={serverAddress} onChange={(e) => setServerAddress(e.target.value.trim())} />
            </Tooltip>
            <Button size="2" variant="soft" color="orange" onClick={() => setOverriderServer(serverAddress)}>
              <Icon path={mdiRefresh} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" ml="1" color="gray">Reset network</Text>
            <Button size="2" variant="soft" color="yellow" onClick={() => resetNetwork()}>
              <Icon path={mdiReloadAlert} size={0.85} />
            </Button>
          </Flex>
        </Box>
      </Card>
      <Card mt="4">
        <Box px="2" py="2">
          <Heading size="5" mb="3">Network statistics</Heading>
          <DataList.Root size="2" orientation={orientation}>
            <DataList.Item>
              <DataList.Label>Channel</DataList.Label>
              <DataList.Value>
                { networkInfo.connections > 0 && <Badge size="2" color="jade">{ Readability.toCount('connection', networkInfo.connections) }</Badge> }
                { !networkInfo.connections && <Badge size="2" color="red">OFFLINE</Badge> }
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Quality</DataList.Label>
              <DataList.Value>
                <Badge size="2" color={(networkInfo.requests ? networkInfo.responses / networkInfo.requests < 0.9 : false) ? 'red' : 'jade'} variant="soft" radius="full">{ (100 * Math.min(1, networkInfo.requests > 0 ? networkInfo.responses / networkInfo.requests : 1)).toFixed(2) }%</Badge>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Bandwidth</DataList.Label>
              <DataList.Value>
                <Text size="2">{ Readability.toCount('byte', networkInfo.sentBytes + networkInfo.receivedBytes) }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Requests</DataList.Label>
              <DataList.Value>
                <Text size="2">{ Readability.toCount('request', networkInfo.requests) } — { Readability.toCount('byte', networkInfo.sentBytes) }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Responses</DataList.Label>
              <DataList.Value>
                <Text size="2">{ Readability.toCount('response', networkInfo.responses) } — { Readability.toCount('byte', networkInfo.receivedBytes) }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Oldest use</DataList.Label>
              <DataList.Value>
                <Text size="2">{ networkInfo.minTime ? networkInfo.minTime.toLocaleString() : 'never' }</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
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
                  <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
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