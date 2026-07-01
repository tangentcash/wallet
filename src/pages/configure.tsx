import { mdiClose, mdiCloudDownload } from "@mdi/js";
import { AlertDialog, Badge, Box, Button, Card, DataList, DropdownMenu, Flex, Heading, TextField, Tooltip } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData, AppPermission, ConnectionState } from "../core/app";
import { ByteUtil, RPC, Signing, Readability } from "tangentsdk";
import { useNavigate, useSearchParams } from "react-router";
import { useEffectAsync } from "../core/react";
import Icon from "@mdi/react";
import License from "../components/license";

export default function ConfigurePage() {
  const address = AppData.getWalletAddress();
  const mobile = document.body.clientWidth <= 600;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [counter, setCounter] = useState(0);
  const [walletAddresses, setWalletAddresses] = useState<(string | null)[]>([]);
  const [validatorAddress, setValidatorAddress] = useState(AppData.props.validator || '');
  const [exchangeAddress, setExchangeAddress] = useState(AppData.props.exchange || '');
  const [loadingProps, setLoadingProps] = useState(false);
  const highlightExport = useMemo(() => {
    return searchParams.has('export');
  }, [searchParams]);
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
  const exportWallet = useCallback(async (type: 'wallet' | 'mnemonic' | 'secretkey' | 'publickey' | 'address') => {
    if (!AppData.isWalletReady() && type != 'address') {
      navigate(`/restore?to=${encodeURIComponent('/configure?export=1')}`);
      return;
    }
    switch (type) {
      case 'wallet': {
        const mnemonic = AppData.getWalletMnemonic();
        const secretKey = AppData.getWalletSecretKey();
        const publicKey = AppData.getWalletPublicKey();
        const publicKeyHash = AppData.getWalletPublicKeyHash();
        const address = AppData.getWalletAddress();
        if ((!mnemonic && !secretKey) || !publicKey || !publicKeyHash || !address) {
          AlertBox.open(AlertType.Error, 'Walled has no recovery phase or no private key');
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
        const mnemonic = AppData.getWalletMnemonic();
        if (!mnemonic) {
          AlertBox.open(AlertType.Error, 'Wallet has no recovery phrase');
          break;
        }

        navigator.clipboard.writeText(mnemonic.join(' '));
        AlertBox.open(AlertType.Info, 'Recovery phrase copied!');
        break;
      }
      case 'secretkey': {
        const secretKey = AppData.getWalletSecretKey();
        const encodedSecretKey = secretKey ? Signing.encodeSecretKey(secretKey) : null;
        if (!encodedSecretKey) {
          AlertBox.open(AlertType.Error, 'Wallet has no private key');
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
          AlertBox.open(AlertType.Error, 'Wallet has no public key');
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
  }, []);
  const resetNetwork = useCallback(async () => {
    if (loadingProps)
      return false;

    setLoadingProps(true);
    await RPC.disconnectSocket();
    AppData.reconfigure(null, AppPermission.Reset);
    if (await AppData.sync()) {
      AlertBox.open(AlertType.Info, 'Network reset: connection re-acquired');
      setValidatorAddress(AppData.props.validator || '');
      setExchangeAddress(AppData.props.exchange || '');;
      AppData.save();
    } else {
      AlertBox.open(AlertType.Warning, 'Connection failed');
    }  
    setLoadingProps(false);
    return true;
  }, [loadingProps]);
  const switchWallet = useCallback(async (index: number) => {
    const status = await AppData.switchWallet(index);
    if (status) {
      setWalletAddresses(await AppData.getWalletAddresses());
      AlertBox.open(AlertType.Info, 'Switched to wallet ' + (AppData.getWalletAddress() || (index + 1).toString()));
    } else {
      AlertBox.open(AlertType.Error, 'Failed to switch to wallet ' + (index + 1).toString());
    }
  }, []);
  const destroyWallet = useCallback(async (fully: boolean) => {
    const result = await AppData.destroyWallet(fully);
    if (!result) {
      AlertBox.open(AlertType.Error, 'Failed to wipe the wallet');
    } else if (result == 'wipe') {
      setTimeout(() => navigate('/'), 250);
    }
  }, []);
  useEffectAsync(async () => {
    setWalletAddresses(await AppData.getWalletAddresses());
  }, []);
  useEffect(() => {
    const timeout = setInterval(() => setCounter(new Date().getTime()), 3000);
    return () => clearInterval(timeout);
  }, []);

  return (
    <Box px={mobile ? undefined : '4'} pt={mobile ? '2' : '4'} mx="auto" maxWidth="580px">
      <Box px="4" py="2">
        <Heading size="6" mb={mobile ? undefined : '2'}>Settings</Heading>
      </Box>
      <Card variant={mobile ? 'ghost' : 'surface'} style={mobile ? { margin: 0, border: 'none' } : { borderRadius: '28px' }}>
        <Box px="2" py="2">
          <DataList.Root orientation="vertical">
            <DataList.Item>
              <DataList.Label minWidth="88px">Wallet control</DataList.Label>
              <DataList.Value>
                <Flex gap="2" wrap="wrap">
                  <Button size="2" variant="solid" color={AppData.isWalletExists() && AppData.isWalletReady() ? 'red' : 'lime'} onClick={() => {
                    if (!AppData.isWalletExists() || !AppData.isWalletReady()) {
                      navigate(`/restore?to=${encodeURIComponent('/configure')}`);
                    } else {
                      AppData.clearWallet();
                    }
                  }}>
                    { AppData.isWalletExists() ? (AppData.isWalletReady() ? <>{ (AppData.getWalletSecretKey() != null ? 'Full control' : 'Watch only') } <Icon path={mdiClose} size={0.7}></Icon></> : 'Unlock to see') : 'Create to see' }
                  </Button>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger disabled={!AppData.isWalletExists() || !AppData.isWalletReady()}>
                      <Button variant="surface" size="2" color="yellow">
                        { address ? address.substring(address.length - 6) : 'Switch' }
                        <DropdownMenu.TriggerIcon />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      {
                        walletAddresses.map((item, index) =>
                          <DropdownMenu.Item key={item || '' + '_select'} disabled={item != null && item == address} onClick={() => switchWallet(index)}>
                            { index + 1 } - { item ? item.substring(item.length - 6) : 'UNKNOWN' }
                          </DropdownMenu.Item>
                        )
                      }
                      <DropdownMenu.Separator></DropdownMenu.Separator>
                      <DropdownMenu.Item onClick={() => navigate(`/restore?add=1&to=${encodeURIComponent('/configure')}`)}>Add wallet</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </Flex>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label minWidth="88px">Wallet data</DataList.Label>
              <DataList.Value>
                <Flex gap="2" wrap="wrap">    
                  <AlertDialog.Root>
                    <AlertDialog.Trigger disabled={!AppData.isWalletExists()}>
                      <Button size="2" variant="soft" color="red">Destroy</Button>
                    </AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="450px">
                      <AlertDialog.Title>Wipe the wallet</AlertDialog.Title>
                      <AlertDialog.Description size="2">
                        Are you sure? You will not be able to recover the access without your recovery phrase or private key.
                      </AlertDialog.Description>
                      <Flex gap="3" mt="4" justify="end">
                        <AlertDialog.Cancel>
                          <Button variant="solid" color="lime">Cancel</Button>
                        </AlertDialog.Cancel>
                        {
                          walletAddresses.length > 1 &&
                          <AlertDialog.Action>
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger>
                                <Button variant="soft" color="red">
                                  Destroy wallet
                                  <DropdownMenu.TriggerIcon />
                                </Button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content>
                                <DropdownMenu.Item color="yellow" onClick={() => destroyWallet(false)}>Only active</DropdownMenu.Item>
                                <DropdownMenu.Item color="red" onClick={() => destroyWallet(true)}>Wipe all data</DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Root>
                          </AlertDialog.Action>
                        }
                        {
                          walletAddresses.length <= 1 &&
                          <AlertDialog.Action>
                            <Button variant="soft" color="red" onClick={() => destroyWallet(true)}>Destroy wallet</Button>
                          </AlertDialog.Action>
                        }
                      </Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <Button variant="surface" className={highlightExport ? 'shadow-rainbow-animation' : undefined} disabled={!AppData.isWalletExists()}>
                        Backup
                        <DropdownMenu.TriggerIcon />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item onClick={() => exportWallet('wallet')}>File</DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => exportWallet('mnemonic')}>Recovery phrase</DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => exportWallet('secretkey')}>Private key</DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => exportWallet('publickey')}>Public key</DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => exportWallet('address')}>Address</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </Flex>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label minWidth="88px">Client app</DataList.Label>
              <DataList.Value>
                <Flex gap="2" wrap="wrap">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      <Button variant="surface" color="gray">
                        Manage
                        <DropdownMenu.TriggerIcon />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <DropdownMenu.Item onClick={() => AppData.openDevTools()} disabled={!AppData.isApp()}>Debug app</DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => location.reload()}>Reload app</DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => resetNetwork()}>Reset network</DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => {
                        RPC.clearCache();
                        AlertBox.open(AlertType.Info, 'Application cache erased');
                      }}>Clear cache</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                  <Button size="2" variant="solid" style={{ backgroundColor: 'var(--gray-12)', color: 'var(--gray-1)' }} onClick={() => AppData.setAppearance(AppData.props.appearance == 'dark' ? 'light' : 'dark')}>
                    { AppData.props.appearance == 'dark' ? 'Lights on' : 'Lights off'}
                  </Button>
                </Flex>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label minWidth="88px">Validator RPC</DataList.Label>
              <DataList.Value>
                <Tooltip content="Specify the URL of Validator RPC server: read/write on-chain data">
                  <TextField.Root style={{ width: '100%' }} size="2" placeholder="Validator RPC server address" type="text" value={validatorAddress} onChange={(e) => setValidatorAddress(e.target.value.trim())} />
                </Tooltip>
                <Button size="2" ml="2" variant="soft" color="lime" onClick={() => setValidatorServer(validatorAddress)}>
                  <Icon path={mdiCloudDownload} size={0.85} />
                </Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label minWidth="88px">Exchange RPC</DataList.Label>
              <DataList.Value>
                <Tooltip content="Specify the URL of Exchange RPC server: read-only DEX data">
                  <TextField.Root style={{ width: '100%' }} size="2" placeholder="Exchange RPC server address" type="text" value={exchangeAddress} onChange={(e) => setExchangeAddress(e.target.value.trim())} />
                </Tooltip>
                <Button size="2" ml="2" variant="soft" color="lime" onClick={() => setExchangeServer(exchangeAddress)}>
                  <Icon path={mdiCloudDownload} size={0.85} />
                </Button>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>RPC traffic</DataList.Label>
              <DataList.Value>
                <Flex gap="1" wrap="wrap">
                  <Badge size="3" color={networkInfo.active ? 'lime' : 'red'}>{ networkInfo.active ? 'ONLINE' : 'OFFLINE' }</Badge>
                  <Badge size="3" color="lime">↓{ Readability.toCount('byte', networkInfo.receivedBytes) }</Badge>
                  <Badge size="3" color="blue">↑{ Readability.toCount('byte', networkInfo.sentBytes) }</Badge>
                </Flex>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Box>
      </Card>
      <License style={{ marginTop: '60px' }} app={!AppData.isApp()}></License>
    </Box>
  );
}