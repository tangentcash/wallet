import { mdiAlertOctagram, mdiBugOutline, mdiCached, mdiLightbulbOn, mdiLightbulbOutline, mdiLocationExit, mdiRefresh, mdiReloadAlert, mdiTrashCan } from "@mdi/js";
import { AlertDialog, Badge, Box, Button, Card, DataList, Flex, Heading, Select, Separator, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { SafeStorage, StorageField } from "../core/storage";
import { AppData, AppPermission, ConnectionState } from "../core/app";
import { ByteUtil, RPC, Signing, Readability } from "tangentsdk";
import Icon from "@mdi/react";
import License from "../components/license";
import { useNavigate } from "react-router";

export default function ConfigurePage() {
  const mobile = document.body.clientWidth <= 600;
  const orientation = mobile ? 'vertical' : 'horizontal';
  const navigate = useNavigate();
  const [counter, setCounter] = useState(0);
  const [walletExportType, setWalletExportType] = useState<'wallet' | 'mnemonic' | 'secretkey' | 'publickey' | 'address'>('wallet');
  const [validatorAddress, setValidatorAddress] = useState(AppData.props.validator || '');
  const [exchangeAddress, setExchangeAddress] = useState(AppData.props.exchange || '');
  const [loadingProps, setLoadingProps] = useState(false);
  const networkInfo = useMemo<ConnectionState>(() => {
    return AppData.server || {
      sentBytes: 0,
      receivedBytes: 0,
      requests: 0,
      responses: 0,
      time: null,
      active: false
    };
  }, [counter]);
  const setValidatorServer = useCallback(async (address: string) => {
    if (loadingProps)
      return false;

    setLoadingProps(true);
    try {
      const target = address || null;
      if (target != null)
        new URL('tcp://' + target);
      
      AppData.setValidator(target);
      if (target != null) {
        await RPC.disconnectSocket();
        AppData.reconfigure(null, AppPermission.ReadOnly);
        if (await AppData.sync()) {
          AlertBox.open(AlertType.Info, 'Using ' + target + ' as validator server');
        } else {
          AlertBox.open(AlertType.Warning, 'Validator server connection failed');
        }
      } else {
        AlertBox.open(AlertType.Warning, 'Custom validator server disabled');
      }
    } catch {
      AlertBox.open(AlertType.Error, 'Server must be in a hostname:port format');
    }

    setLoadingProps(false);
    return true;
  }, [loadingProps]);
  const setExchangeServer = useCallback(async (address: string) => {
    if (loadingProps)
      return false;

    setLoadingProps(true);
    try {
      const target = address || null;
      if (target != null)
        new URL(target);
      
      AppData.setExchange(target);
      if (target != null) {
        AppData.reconfigure(null, AppPermission.ReadOnly);
        AlertBox.open(AlertType.Info, 'Using ' + target + ' as exchange server');
      } else {
        AlertBox.open(AlertType.Warning, 'Custom exchange server disabled');
      }
    } catch {
      AlertBox.open(AlertType.Error, 'Server must be in a URL format');
    }

    setLoadingProps(false);
    return true;
  }, [loadingProps]);
  const exportWallet = useCallback(async () => {
    switch (walletExportType) {
      case 'wallet': {
        const mnemonic = await SafeStorage.get(StorageField.Mnemonic);
        const secretKey = AppData.getWalletSecretKey();
        const publicKey = AppData.getWalletPublicKey();
        const publicKeyHash = AppData.getWalletPublicKeyHash();
        const address = AppData.getWalletAddress();
        if ((!mnemonic && !secretKey) || !publicKey || !publicKeyHash || !address) {
          AlertBox.open(AlertType.Error, 'Walled is locked or has no recovery phase and/or no private key');
          break;
        }

        AppData.saveFile('wallet.json', 'application/json', JSON.stringify({
          mnemonic: mnemonic != null && Array.isArray(mnemonic) ? mnemonic.join(' ') : undefined,
          secret_key: secretKey != null ? Signing.encodeSecretKey(secretKey) || undefined : undefined,
          public_key: publicKey != null ? Signing.encodePublicKey(publicKey) || undefined : undefined,
          public_key_hash: publicKeyHash != null ? ByteUtil.uint8ArrayToHexString(publicKeyHash.data) || undefined : undefined,
          address: address
        }, null, 2));
        break;
      }
      case 'mnemonic': {
        const mnemonic = await SafeStorage.get(StorageField.Mnemonic);
        if (!mnemonic) {
          AlertBox.open(AlertType.Error, 'Wallet is locked or has no recovery phrase');
          break;
        }

        navigator.clipboard.writeText(mnemonic);
        AlertBox.open(AlertType.Info, 'Recovery phrase copied!');
        break;
      }
      case 'secretkey': {
        const secretKey = AppData.getWalletSecretKey();
        const encodedSecretKey = secretKey ? Signing.encodeSecretKey(secretKey) : null;
        if (!encodedSecretKey) {
          AlertBox.open(AlertType.Error, 'Wallet is locked or has no private key');
          break;
        }

        navigator.clipboard.writeText(encodedSecretKey);
        AlertBox.open(AlertType.Info, 'Private key copied!');
        break;
      }
      case 'publickey': {
        const publicKey = AppData.getWalletPublicKey();
        const encodedPublicKey = publicKey ? Signing.encodePublicKey(publicKey) : null;
        if (!encodedPublicKey) {
          AlertBox.open(AlertType.Error, 'Wallet is locked or has no public key');
          break;
        }

        navigator.clipboard.writeText(encodedPublicKey);
        AlertBox.open(AlertType.Info, 'Public key copied!');
        break;
      }
      case 'address': {
        const address = AppData.getWalletAddress();
        if (!address) {
          AlertBox.open(AlertType.Error, 'Wallet has no address');
          break;
        }

        navigator.clipboard.writeText(address);
        AlertBox.open(AlertType.Info, 'Address copied!');
        break;
      }
    }
  }, [walletExportType]);
  const resetNetwork = useCallback(async () => {
    if (loadingProps)
      return false;

    setLoadingProps(true);
    await RPC.disconnectSocket();
    AppData.reconfigure(null, AppPermission.Reset);
    if (await AppData.sync()) {
      AlertBox.open(AlertType.Info, 'Network reset: connection re-acquired');
    } else {
      AlertBox.open(AlertType.Warning, 'Connection failed');
    }
    setLoadingProps(false);
    return true;
  }, [loadingProps]);
  useEffect(() => {
    const timeout = setInterval(() => setCounter(new Date().getTime()), 3000);
    return () => clearInterval(timeout);
  }, []);

  return (
    <Box px={mobile ? undefined : '4'} pt={mobile ? '2' : '4'} mx="auto" maxWidth="580px">
      {
        !mobile &&
        <>
          <Heading size="6">Setup</Heading>
          <Box width="100%" mt="4">
            <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
          </Box>
        </>
      }
      <Card mt={mobile ? undefined : '4'} variant={mobile ? 'ghost' : 'surface'} style={mobile ? { margin: 0, border: 'none' } : undefined}>
        <Box px="2" py="2">
          <Heading size={mobile ? '6' : '5'} mb="2">Wallet</Heading>
          <Flex justify="between" align="center" mt="3">
            <Text size="2" color="gray">Wallet status</Text>
            <Badge size="3" color="lime">{ AppData.isWalletExists() ? (AppData.getWalletSecretKey() != null ? 'Read/write' : 'Read-only') : 'TBC' }</Badge>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Select.Root value={walletExportType} onValueChange={(e) => setWalletExportType(e as any)}>
              <Select.Trigger variant="ghost" />
              <Select.Content>
                <Select.Group>
                  <Select.Label>Wallet export type</Select.Label>
                  <Select.Item value="wallet">Export file</Select.Item>
                  <Select.Item value="mnemonic">Export recovery phrase</Select.Item>
                  <Select.Item value="secretkey">Export private key</Select.Item>
                  <Select.Item value="publickey">Export public key</Select.Item>
                  <Select.Item value="address">Export address</Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
            <Button size="2" variant="soft" color="yellow" disabled={!AppData.isWalletExists()} onClick={exportWallet}>
              <Icon path={mdiAlertOctagram} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Close wallet</Text>
            <Button size="2" variant="soft" color="lime" disabled={!AppData.isWalletExists() || !AppData.isWalletReady()} onClick={() => AppData.clearWallet()}>
              <Icon path={mdiLocationExit} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Destroy wallet</Text>
            <AlertDialog.Root>
              <AlertDialog.Trigger disabled={!AppData.isWalletExists()}>
                <Button size="2" variant="soft" color="red">
                  <Icon path={mdiTrashCan} size={0.85} />
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="450px">
                <AlertDialog.Title>Wipe the wallet</AlertDialog.Title>
                <AlertDialog.Description size="2">
                  Are you sure? You will not be able to recover the access without your recovery phrase or private key.
                </AlertDialog.Description>
                <Flex gap="3" mt="4" justify="end">
                  <AlertDialog.Cancel>
                    <Button variant="soft" color="gray">Cancel</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button variant="solid" color="red" onClick={() => {
                      AppData.destroyWallet();
                      navigate('/');
                    }}>Destroy wallet</Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </Flex>
        </Box>
      </Card>
      {
        mobile &&
        <Box width="100%">
          <Separator my="0" size="4"></Separator>
        </Box>
      }
      <Card mt="4" variant={mobile ? 'ghost' : 'surface'} style={mobile ? { margin: 0, border: 'none' } : undefined}>
        <Box px="2" py="2">
          <Heading size={mobile ? '6' : '5'} mb="3">Client</Heading>
          <Flex gap="2" align="center" justify="between">
            <Text size="2" color="gray">Display theme</Text>
            <Button size="2" variant="soft" color="lime" onClick={() => AppData.setAppearance(AppData.props.appearance == 'dark' ? 'light' : 'dark')}>
              <Icon path={AppData.props.appearance == 'dark' ? mdiLightbulbOutline : mdiLightbulbOn} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" color="gray">Erase cache</Text>
            <Button size="2" variant="soft" color="lime" onClick={() => {
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
          {
            AppData.isApp() &&
            <Flex justify="between" align="center" mt="2">
              <Text size="2" color="gray">Show debugger</Text>
              <Button size="2" variant="soft" color="yellow" onClick={() => AppData.openDevTools()}>
                <Icon path={mdiBugOutline} size={0.85} />
              </Button>
            </Flex>
          }
        </Box>
      </Card>
      {
        mobile &&
        <Box width="100%">
          <Separator my="0" size="4"></Separator>
        </Box>
      }
      <Card mt="4" variant={mobile ? 'ghost' : 'surface'} style={mobile ? { margin: 0, border: 'none' } : undefined}>
        <Box px="2" py="2">
          <Heading size={mobile ? '6' : '5'} mb="3">Server</Heading>
          <Flex gap="1" mt="2">
            <Tooltip content="Specify the URL of Validator RPC server: read/write on-chain data">
              <TextField.Root style={{ width: '100%' }} size="2" placeholder="Validator RPC server address" type="text" value={validatorAddress} onChange={(e) => setValidatorAddress(e.target.value.trim())} />
            </Tooltip>
            <Button size="2" variant="soft" color="yellow" onClick={() => setValidatorServer(validatorAddress)}>
              <Icon path={mdiRefresh} size={0.85} />
            </Button>
          </Flex>
          <Flex gap="1" mt="2">
            <Tooltip content="Specify the URL of Exchange RPC server: read-only DEX data">
              <TextField.Root style={{ width: '100%' }} size="2" placeholder="Exchange RPC server address" type="text" value={exchangeAddress} onChange={(e) => setExchangeAddress(e.target.value.trim())} />
            </Tooltip>
            <Button size="2" variant="soft" color="yellow" onClick={() => setExchangeServer(exchangeAddress)}>
              <Icon path={mdiRefresh} size={0.85} />
            </Button>
          </Flex>
          <Flex justify="between" align="center" mt="2">
            <Text size="2" ml="1" color="gray">Reset network</Text>
            <Button size="2" variant="soft" color="yellow" onClick={() => resetNetwork()}>
              <Icon path={mdiReloadAlert} size={0.85} />
            </Button>
          </Flex>
          <Card mt="3" variant="surface">
            <DataList.Root size="2" orientation={orientation}>
              <DataList.Item>
                <DataList.Label>Server status</DataList.Label>
                <DataList.Value>
                  <Flex gap="1" wrap="wrap">
                    <Badge size="2" color={networkInfo.active ? 'lime' : 'red'}>{ networkInfo.active ? 'ONLINE' : 'OFFLINE' }</Badge>
                    <Badge size="2" color={(networkInfo.requests ? networkInfo.responses / networkInfo.requests < 0.9 : false) ? 'red' : 'lime'} variant="soft" radius="full">{ (100 * Math.min(1, networkInfo.requests > 0 ? networkInfo.responses / networkInfo.requests : 1)).toFixed(2) }%</Badge>
                  </Flex>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Server test</DataList.Label>
                <DataList.Value>
                  <Text size="2">{ networkInfo.time ? networkInfo.time.toLocaleString() : 'never' }</Text>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Server pings</DataList.Label>
                <DataList.Value>
                  <Text size="2">{ Readability.toCount('ping', networkInfo.requests) } — { Readability.toCount('byte', networkInfo.sentBytes) }</Text>
                </DataList.Value>
              </DataList.Item>
              <DataList.Item>
                <DataList.Label>Server pongs</DataList.Label>
                <DataList.Value>
                  <Text size="2">{ Readability.toCount('pong', networkInfo.responses) } — { Readability.toCount('byte', networkInfo.receivedBytes) }</Text>
                </DataList.Value>
              </DataList.Item>
            </DataList.Root>
          </Card>
        </Box>
      </Card>
      <License style={{ marginTop: '60px' }} app={true}></License>
    </Box>
  );
}