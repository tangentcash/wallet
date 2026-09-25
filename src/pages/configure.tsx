import { mdiChevronDown, mdiChevronRight, mdiDeleteOutline, mdiDownload, mdiInformationOutline, mdiLockOutline, mdiPlus, mdiRefresh, mdiWeatherNight, mdiWeatherSunny } from "@mdi/js";
import { AlertDialog, Box, Button, DropdownMenu, Flex, Switch, TextField, Tooltip } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData, AppPermission, ConnectionState } from "../core/app";
import { ByteUtil, Signing } from "tangentsdk/algorithm";
import { RPC } from "tangentsdk/rpc";
import { UiUtil } from "tangentsdk/ui";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useEffectAsync } from "../core/react";
import Icon from "@mdi/react";
import License from "../components/license";
import AddressAvatar from "../components/avatar";

export default function ConfigurePage() {
  const address = AppData.getWalletAddress();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [counter, setCounter] = useState(0);
  const [walletAddresses, setWalletAddresses] = useState<(string | null)[]>([]);
  const [validatorAddress, setValidatorAddress] = useState(AppData.props.validator || '');
  const [exchangeAddress, setExchangeAddress] = useState(AppData.props.exchange || '');
  const [loadingProps, setLoadingProps] = useState(false);
  useEffect(() => {
    AppData.setTitle('App settings');
  }, []);
  const highlightExport = useMemo(() => {
    return searchParams.has('export');
  }, [searchParams]);
  const networkInfo = useMemo<ConnectionState>(() => {
    return AppData.server || {
      traffic: 0,
      messages: 0,
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
      navigate('/');
    } else if (result) {
      AlertBox.open(AlertType.Info, 'Active wallet wiped!');
      setWalletAddresses(await AppData.getWalletAddresses());
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
    <Box pt="4" pb="8" maxWidth="680px" mx="auto">
      <div className="page-head">
        <div className="page-title">App</div>
      </div>
      <div className="card" style={{ padding: '6px 18px' }}>
        {
          AppData.isWalletReady() ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button className="srow">
                  <span className="ic" style={{ overflow: 'hidden' }}><AddressAvatar address={address || ''} size="1" style={{ width: '100%', height: '100%' }}></AddressAvatar></span>
                  <span className="t"><b>Switch wallet</b><span>{ UiUtil.toAddress(address || undefined, 6) }</span></span>
                  <span className="go"><Icon path={mdiChevronDown} size={0.8}></Icon></span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {
                  walletAddresses.map((item, index) =>
                    <DropdownMenu.Item key={item || '' + '_select'} disabled={item != null && item == address} onClick={() => item != address && switchWallet(index)}>
                      <AddressAvatar address={item || ''} size="1" style={{ width: '16px', height: '16px' }}></AddressAvatar> Use { UiUtil.toAddress(item || undefined, 6) }
                    </DropdownMenu.Item>
                  )
                }
                <DropdownMenu.Separator></DropdownMenu.Separator>
                <DropdownMenu.Item onClick={() => navigate(`/restore?add=1&to=${encodeURIComponent('/configure')}`)}>Add wallet</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          ) : (
            <button className="srow" onClick={() => navigate(`/restore?to=${encodeURIComponent('/configure')}`)}>
              <span className="ic" style={{ overflow: 'hidden' }}>{ AppData.isWalletExists() ? <AddressAvatar address={address || ''} size="1" style={{ width: '100%', height: '100%' }}></AddressAvatar> : <Icon path={mdiPlus} size={0.95}></Icon> }</span>
              <span className="t"><b>{ AppData.isWalletExists() ? 'Switch wallet' : 'Add a wallet' }</b><span>{ AppData.isWalletExists() ? 'Unlock to switch or add wallets' : 'Create or import to get started' }</span></span>
              <span className="go"><Icon path={mdiChevronRight} size={0.8}></Icon></span>
            </button>
          )
        }
        <DropdownMenu.Root>
          <DropdownMenu.Trigger disabled={!AppData.isWalletExists()}>
            <button className={'srow' + (highlightExport ? ' shadow-rainbow-animation' : '')}>
              <span className="ic"><Icon path={mdiDownload} size={0.95}></Icon></span>
              <span className="t"><b>Backup wallet</b><span>Wallet file or recovery phrase</span></span>
              <span className="go"><Icon path={mdiChevronRight} size={0.8}></Icon></span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={() => exportWallet('wallet')}><span style={{ display: 'contents', width: '100%' }}>Download wallet file<span className="tiny dim" style={{ marginLeft: 'auto' }}>.json</span></span></DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exportWallet('mnemonic')}>Reveal recovery phrase</DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exportWallet('secretkey')}>Copy private key</DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => exportWallet('publickey')}>Copy public key</DropdownMenu.Item>
            <DropdownMenu.Separator></DropdownMenu.Separator>
            <DropdownMenu.Item onClick={() => exportWallet('address')}>Copy public address</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <button className="srow" disabled={!AppData.isWalletExists() || !AppData.isWalletReady()} onClick={() => {
          AppData.clearWallet();
          AlertBox.open(AlertType.Info, 'Wallet locked — signing requires your password again');
        }}>
          <span className="ic"><Icon path={mdiLockOutline} size={0.95}></Icon></span>
          <span className="t"><b>Lock wallet</b><span>Keep balances visible, require password to sign</span></span>
          <span className="go"><Icon path={mdiChevronRight} size={0.8}></Icon></span>
        </button>
        <AlertDialog.Root>
          <AlertDialog.Trigger disabled={!AppData.isWalletExists()}>
            <button className="srow danger">
              <span className="ic"><Icon path={mdiDeleteOutline} size={0.95}></Icon></span>
              <span className="t"><b>Destroy wallet</b><span>Erase keys from this device only</span></span>
              <span className="go"><Icon path={mdiChevronRight} size={0.8}></Icon></span>
            </button>
          </AlertDialog.Trigger>
          <AlertDialog.Content maxWidth="450px">
            <AlertDialog.Title>Destroy this wallet?</AlertDialog.Title>
            <AlertDialog.Description size="2">
              Erases the encrypted keys on this device. On-chain funds at <span className="mono">{ UiUtil.toAddress(address || undefined, 6) }</span> are untouched — recover them anywhere with your phrase.
            </AlertDialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <AlertDialog.Cancel>
                <Button variant="soft" color="gray">Keep wallet</Button>
              </AlertDialog.Cancel>
              {
                walletAddresses.length > 1 &&
                <>
                  <AlertDialog.Action>
                    <Button variant="soft" color="yellow" onClick={() => destroyWallet(false)}>Wipe wallet</Button>
                  </AlertDialog.Action>
                  <AlertDialog.Action>
                    <Button variant="solid" color="red" onClick={() => destroyWallet(true)}>Wipe all</Button>
                  </AlertDialog.Action>
                </>
              }
              {
                walletAddresses.length <= 1 &&
                <AlertDialog.Action>
                  <Button variant="solid" color="red" onClick={() => destroyWallet(true)}>Destroy</Button>
                </AlertDialog.Action>
              }
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </div>
      <div className="card" style={{ padding: '6px 18px' }}>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <button className="srow">
              <span className="ic"><Icon path={mdiRefresh} size={0.95}></Icon></span>
              <span className="t"><b>Manage client app</b><span>Updates · restart · reset settings</span></span>
              <span className="go"><Icon path={mdiChevronRight} size={0.8}></Icon></span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={() => AppData.openDevTools()} disabled={!AppData.isApp()}>Debug app</DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => location.reload()}>Restart client</DropdownMenu.Item>
            <DropdownMenu.Separator></DropdownMenu.Separator>
            <DropdownMenu.Item onClick={() => resetNetwork()}>Reset network</DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => {
              RPC.clearCache();
              AlertBox.open(AlertType.Info, 'Application cache erased');
            }}>Clear cache</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <div className="srow" style={{ cursor: 'default' }}>
          <span className="ic"><Icon path={AppData.props.appearance == 'light' ? mdiWeatherSunny : mdiWeatherNight} size={0.95}></Icon></span>
          <span className="t"><b>Lights</b><span>{ AppData.props.appearance == 'light' ? 'On for bright rooms' : 'Inverted surfaces for bright rooms' }</span></span>
          <Switch size="2" checked={ AppData.props.appearance == 'light' } onCheckedChange={(v) => AppData.setAppearance(v ? 'light' : 'dark')} aria-label={AppData.props.appearance == 'light' ? 'Lights on' : 'Lights off'} />
        </div>
        <div className="srow" style={{ cursor: 'default' }}>
          <span className="ic"><Icon path={mdiInformationOutline} size={0.95}></Icon></span>
          <span className="t"><b>Version</b><span>MIT licensed · open source</span></span>
          <Link to="/legal" style={{ marginLeft: 'auto' }}><span className="badge flat mono" style={{ cursor: 'pointer' }}>MIT</span></Link>
        </div>
      </div>
      <div className="card">
        <div className="f-row">
          <span className="f-name">Validator RPC</span>
          <span className="f-desc">blocks · accounts · mempool</span>
        </div>
        <div className="f-input">
          <Tooltip content="Specify the address of Validator RPC server: read/write on-chain data">
            <TextField.Root className="mono" style={{ flex: 1 }} size="3" placeholder="hostname:port" type="text" value={validatorAddress} onChange={(e) => setValidatorAddress(e.target.value.trim())} />
          </Tooltip>
        </div>
        <div className="f-row" style={{ marginTop: 22 }}>
          <span className="f-name">Exchange RPC</span>
          <span className="f-desc">markets &amp; trading · DEX tab only</span>
        </div>
        <div className="f-input">
          <Tooltip content="Specify the URL of Exchange RPC server: read-only DEX data">
            <TextField.Root className="mono" style={{ flex: 1 }} size="3" placeholder="http://hostname:port" type="text" value={exchangeAddress} onChange={(e) => setExchangeAddress(e.target.value.trim())} />
          </Tooltip>
        </div>
        <Button className="btn-brand btn-block" style={{ marginTop: 20 }} loading={loadingProps} onClick={async () => {
          if (!await setValidatorServer(validatorAddress))
            return;
          await setExchangeServer(exchangeAddress);
        }}>Save RPC settings</Button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
          <span className={'badge ' + (networkInfo.active ? 'ok' : 'err')}>{ networkInfo.active ? 'ONLINE' : 'OFFLINE' }</span>
          <span className="badge flat num">↓↑ { UiUtil.toCount('byte', networkInfo.traffic) }</span>
          <button className="chip-quiet" style={{ marginLeft: 'auto' }} onClick={() => resetNetwork()}>Reset</button>
        </div>
      </div>
      <License style={{ marginTop: 40 }} size={32} app={!AppData.isApp()}></License>
    </Box>
  );
}