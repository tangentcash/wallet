import { Badge, Box, Button, Callout, Card, Flex, Heading, Link, Select, Text, TextArea, TextField } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mdiAlertCircleOutline } from '@mdi/js';
import { AlertBox, AlertType } from "../components/alert";
import { useNavigate, useSearchParams } from "react-router";
import { wordlist } from '@scure/bip39/wordlists/english';
import { CSSTransition, SwitchTransition } from "react-transition-group";
import { SafeStorage, Storage, StorageField } from "../core/storage";
import { ByteUtil, Chain, NetworkType, Pubkeyhash, Signing, WalletType } from "tangentsdk";
import { AppData } from "../core/app";
import Typed from 'typed.js';
import Icon from '@mdi/react';

// @ts-ignore
const PASSWORD_SIZE = 6;
const COLOR_MAP = ["gray", "gold", "bronze", "brown", "yellow", "amber", "orange", "tomato", "red", "ruby", "crimson", "pink", "plum", "purple", "violet", "iris", "indigo", "blue", "cyan", "teal", "jade", "green", "grass", "lime", "mint", "sky"];

function cyrb128(str: string): number[] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
      k = str.charCodeAt(i);
      h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
      h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
      h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
      h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4), h2 ^= h1, h3 ^= h1, h4 ^= h1;
  return [h1>>>0, h2>>>0, h3>>>0, h4>>>0];
}

export default function RestorePage() {
  const [params] = useSearchParams();
  const [passphrase, setPassphrase] = useState('');
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState<'reset' | 'restore' | 'import' | 'mnemonic'>(AppData.isWalletExists() ? 'restore' : 'reset');
  const [importType, setImportType] = useState<WalletType>(WalletType.Mnemonic);
  const [importCandidate, setImportCandidate] = useState('');
  const [networkType, setNetworkType] = useState<NetworkType>(Storage.get(StorageField.Network) || AppData.defaultNetwork());
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const navigate = useNavigate();
  const importValid = useMemo((): boolean => {
    switch (importType) {
      case WalletType.Mnemonic: {
        const words = importCandidate.split(/[\s$]/).filter((v) => v.length > 0 && v.match(/[a-z]+/)).map((v) => v.trim());
        if (words.length != 24)
          return false;

        if (Signing.verifyMnemonic(words.join(' '))) {
          const result = words.join(' ');
          if (result != importCandidate)
            setImportCandidate(result);
          return true;
        }

        AlertBox.open(AlertType.Error, 'Recovery phrase is not correct');
        reportError();
        return false;
      }
      case WalletType.SecretKey: {
        Chain.props = Chain[networkType];
        const key = Signing.decodeSecretKey(importCandidate.trim());
        if (!key)
          return false;

        const result = Signing.encodeSecretKey(key);
        if (result != null && result != importCandidate)
          setImportCandidate(result);
        return true;
      }
      case WalletType.PublicKey: {
        Chain.props = Chain[networkType];
        const key = Signing.decodePublicKey(importCandidate.trim());
        if (!key)
          return false;

        if (Signing.verifyPublicKey(key)) {
          const result = Signing.encodePublicKey(key);
          if (result != null && result != importCandidate)
            setImportCandidate(result);
          return true;
        }

        AlertBox.open(AlertType.Error, 'Public key is not correct');
        reportError();
        return false;
      }
      case WalletType.Address: {
        Chain.props = Chain[networkType];
        const address = Signing.decodeAddress(importCandidate.trim());
        if (!address)
          return false;

        if (address.data.length == 20) {
          const result = Signing.encodeAddress(address);
          if (result != null && result != importCandidate)
            setImportCandidate(result);
          return true;
        }

        AlertBox.open(AlertType.Error, 'Address is not correct');
        reportError();
        return false;
      }
      default:
        return false;
    }
  }, [importType, importCandidate, networkType]);
  const wordsList = useMemo(() => {
    let result = [];
    for (let i = 0; i < 4; i++)
      result.push(wordlist[Math.floor(Math.random() * wordlist.length) % wordlist.length]);
    return result;
  }, [importType]);
  const exitPrompt = useCallback(() => {
    try {
      const to = decodeURIComponent(params.get('to') || '');
      if (to.length <= 1 || !to.startsWith('/'))
        throw false;

      navigate(to);
    } catch {
      navigate('/');
    }
  }, []);
  const reportError = useCallback(() => {
    setError(true);
    setPassphrase('');
    setTimeout(() => setError(false), 500);
  }, []);
  const restoreWallet = useCallback(async () => {
    if (loading || error)
      return;

    setLoading(true);
    let status = await AppData.restoreWallet(passphrase, networkType);
    if (!status) {
      AlertBox.open(AlertType.Error, 'Wallet password did not unlock the secure storage');
      reportError();
    } else {
      return exitPrompt();
    }
    setLoading(false);
  }, [passphrase, networkType, loading, error]);
  const createWallet = useCallback(async () => {
    if (loading || error)
      return;

    setLoading(true);
    let status = await SafeStorage.reset(passphrase);
    if (status) {
      if (importValid) {
        status = await AppData.resetWallet(importType == WalletType.Mnemonic ? importCandidate.split(' ') : importCandidate, importType, networkType);
        if (status)
          return exitPrompt();

        AlertBox.open(AlertType.Error, 'Wallet recovery phrase could not be securely saved');
        reportError();
      } else if (mnemonic.length == 24) {
        status = await AppData.resetWallet(mnemonic, WalletType.Mnemonic, networkType);
        if (status)
          return exitPrompt();

        AlertBox.open(AlertType.Error, 'Wallet recovery phrase could not be securely saved');
        reportError();
      } else {
        setStatus('mnemonic');
        await secureMnemonic();
      }
    } else {
      AlertBox.open(AlertType.Error, 'Wallet recovery phrase could not be generated');
      reportError();
    }
    setLoading(false);
  }, [passphrase, networkType, loading, error, importValid, mnemonic]);
  const secureMnemonic = useCallback(async () => {
    if (loading || error)
      return;

    setLoading(true);
    let mnemonic: string = '';
    for (let i = 0; i < 32; i++) {
      mnemonic = Signing.mnemonicgen();
      setSeed(cyrb128(mnemonic)[0]);
      setMnemonic(mnemonic.split(' '));
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    let status = await AppData.resetWallet(mnemonic.split(' '), WalletType.Mnemonic, networkType);
    if (!status) {
      AlertBox.open(AlertType.Error, 'Wallet recovery phrase could not be securely saved');
      reportError();
      setStatus('reset');
    }
    setLoading(false);
  }, [loading, error, networkType]);
  const copyMnemonic = useCallback(async () => {
    navigator.clipboard.writeText(mnemonic.join(' '));
    AlertBox.open(AlertType.Info, 'List of recovery phrase words is copied!');
  }, [mnemonic]);
  const resetWallet = useCallback((fromImport: boolean) => {
    setStatus('reset');
    setPassphrase('');
    if (!fromImport)
      setImportCandidate('');
  }, []);
  const importWallet = useCallback(() => {
    setStatus('import');
    setPassphrase('');
  }, [status]);
  const tryRestoreWallet = useCallback(() => {
    setStatus('restore');
    setPassphrase('');
    setImportCandidate('');
  }, []);
  useEffect(() => {
    if (!titleRef.current)
      return;

    const typed = new Typed(titleRef.current, {
      strings: ['Tangent Cash', 'Tangent Wallet'],
      typeSpeed: 100,
      backSpeed: 30,
      smartBackspace: false,
      onComplete: (self: Typed) => {
        setTimeout(() => {
          self.cursor.style.transition = 'opacity 0.5s linear';
          self.cursor.style.opacity = '0';
        }, 300);
      }
    });
    return () => typed.destroy()
  }, [titleRef]);
  
  const mobile = document.body.clientWidth < 500;
  return (
    <SwitchTransition mode="out-in">
      <CSSTransition classNames="fade-transition" key={status} nodeRef={contentRef} timeout={350} appear>
        <Flex justify="center" align="center" height="calc(100dvh - 96px)" key={status} ref={contentRef}>
          <Box maxWidth="600px" width="100%" mx="auto">
            {
              status == 'restore' &&
              <Card className="bp-mobile-ghost600" size="4" variant="surface" mx="auto" style={{ maxWidth: 400, width: '100%' }}>
                <Heading as="h3" size="8" align="center" mb="5">
                <Text ref={titleRef}>Tangent Wallet</Text>
                </Heading>
                <form action="">
                  <Box mb="6" position="relative">
                    <TextField.Root id="card-password-field" type="password" placeholder="Enter your password" autoComplete="current-password" size="3" value={passphrase} onChange={(e) => { setPassphrase(e.target.value); }}/>    
                    <Flex justify="center" mt="2" px="2">
                      <Text size="1" weight="light" color="gray">
                        Password encrypted.<Link size="1" color="red" ml="1" onClick={() => resetWallet(false)}>Reset wallet.</Link>
                      </Text>
                    </Flex>
                  </Box>
                  <Flex mt="4" justify="start" align="center" direction="column" gap="3">
                    <Button size="3" variant="surface" type="submit" loading={loading} style={{ paddingLeft: '24px', paddingRight: '24px', transition: 'all 0.1s linear' }} disabled={passphrase.length < PASSWORD_SIZE} color={error ? 'red' : undefined} className={error ? 'shadow-rainbow-hover animation-horizontal-shake' : (passphrase.length < PASSWORD_SIZE ? 'shadow-rainbow-hover' :  'shadow-rainbow-animation')} onClick={(e) => { e.preventDefault(); restoreWallet(); }}>Unlock wallet</Button>
                  </Flex>
                </form>
              </Card>
            }
            {
              status == 'reset' &&
              <Card className="bp-mobile-ghost600" size="4" variant="surface" mx="auto" style={{ maxWidth: 400, width: '100%' }}>
                <Heading as="h3" size="8" align="center" mb="5">
                  <Text ref={titleRef}>Tangent Wallet</Text>
                </Heading>
                <Box mb="5" position="relative">
                  <form action="">
                    <TextField.Root id="card-password-field" type="password" placeholder="Come up with a password" autoComplete="new-password" size="3" value={passphrase} onChange={(e) => { setPassphrase(e.target.value); }} />
                    {
                      AppData.isWalletExists() &&
                      <Flex justify="center" mt="2" px="2">
                        <Text size="1" weight="light" color="gray">
                          At any cost, do not forget.<Link size="1" ml="1" color="red" onClick={tryRestoreWallet}>Restore wallet.</Link>
                        </Text>
                      </Flex>
                    }
                    {
                      !AppData.isWalletExists() &&
                      <Flex justify="center" mt="2" px="2">
                        <Text size="1" weight="light" color="gray">
                          At any cost, do not forget.<Link size="1" ml="1" onClick={importWallet}>{ importValid ? 'Re-import wallet.' : 'Import wallet.' }</Link>
                        </Text>
                      </Flex>
                    }
                  </form>
                </Box>
                <Flex mt="4" justify="start" align="center" direction="column" gap="3">
                  <Button size="3" variant="surface" loading={loading} style={{ paddingLeft: '24px', paddingRight: '24px' }} disabled={passphrase.length < PASSWORD_SIZE} className={error ? 'shadow-rainbow-hover animation-horizontal-shake' : (passphrase.length < PASSWORD_SIZE ? 'shadow-rainbow-hover' :  'shadow-rainbow-animation')} onClick={createWallet}>{ importValid ? 'Import wallet' : 'Create wallet' }</Button>
                  { AppData.isWalletExists() && <Link size="1" ml="1" color="gray" onClick={importWallet}>{ importValid ? 'Re-import wallet' : 'Import wallet' }</Link> }
                </Flex>
              </Card>
            }
            {
              status == 'import' &&
              <Card className="bp-mobile-ghost600" size="4" variant="surface" mx="auto" style={{ maxWidth: 600, width: '100%' }}>
                <Flex justify="between" align="center" mb="4">
                  <Heading as="h3" size={mobile ? '4' : '7'}>Import</Heading>
                  <Select.Root size={mobile ? '2' : '3'} value={importType} onValueChange={async (value) => {
                      if (value == 'auto') {
                        const file = await AppData.openFile('application/json');
                        try {
                          if (!file)
                            throw 'not a json file';

                          let wallet;
                          try {
                            wallet = JSON.parse(ByteUtil.uint8ArrayToByteString(file));
                          } catch {
                            wallet = JSON.parse(ByteUtil.uint8ArrayToUtf8String(file));
                          }
                          if (typeof wallet.mnemonic == 'string') {
                            setImportType(WalletType.Mnemonic);
                            setImportCandidate(wallet.mnemonic);
                          } else if (typeof wallet.secret_key == 'string') {
                            setImportType(WalletType.SecretKey);
                            setImportCandidate(wallet.secret_key);
                          } else if (typeof wallet.public_key == 'string') {
                            setImportType(WalletType.PublicKey);
                            setImportCandidate(wallet.public_key);
                          } else if (typeof wallet.public_key_hash == 'string') {
                            setImportType(WalletType.Address);
                            setImportCandidate(Signing.encodeAddress(new Pubkeyhash(wallet.public_key_hash)) || '');
                          } else if (typeof wallet.address == 'string') {
                            setImportType(WalletType.Address);
                            setImportCandidate(wallet.address);
                          }
                        } catch (e: any) {
                          AlertBox.open(AlertType.Error, 'Bad wallet file: ' + e.toString());
                        }
                      } else {
                        setImportType(value as WalletType);
                        setImportCandidate('')
                      }
                    }}>
                    <Select.Trigger variant="soft" color="gray" />
                    <Select.Content>
                      <Select.Group>
                        <Select.Label>Import type</Select.Label>
                        <Select.Item value="auto">
                          <Text>Wallet file</Text>
                        </Select.Item>
                        <Select.Item value="mnemonic">
                          <Text>Recovery phrase</Text>
                        </Select.Item>
                        <Select.Item value="secretkey">
                          <Text>Private key</Text>
                        </Select.Item>
                        <Select.Item value="publickey">
                          <Text>Public key</Text>
                        </Select.Item>
                        <Select.Item value="address">
                          <Text>Address</Text>
                        </Select.Item>
                      </Select.Group>
                    </Select.Content>
                  </Select.Root>
                </Flex>
                {
                  importType == WalletType.Mnemonic &&
                  <>
                    <TextArea resize="vertical" variant="classic" size="3" style={{ minHeight: 150 }} placeholder={ wordsList.join(' ') + ' ... and 20 other words' } value={importCandidate} onChange={(e) => setImportCandidate(e.target.value)} />
                    <Flex justify="center" mt="2" px="2">
                      <Text size="1" weight="light" color="gray">
                        Recovery phrase is a secret for wallet recovery.<Link size="1" color="red" ml="1" onClick={() => resetWallet(false)}>Reset wallet.</Link>
                      </Text>
                    </Flex>
                  </>
                }
                {
                  importType == WalletType.SecretKey &&
                  <>
                    <TextField.Root type="text" placeholder={Chain[networkType].SECKEY_PREFIX + ' ...'} size="3" value={importCandidate} onChange={(e) => { setImportCandidate(e.target.value); }} />
                    <Flex justify="center" mt="2" px="2">
                      <Text size="1" weight="light" color="gray">
                        Private key is your wallet.<Link size="1" color="red" ml="1" onClick={() => resetWallet(false)}>Reset wallet.</Link>
                      </Text>
                    </Flex>
                  </>
                }
                {
                  importType == WalletType.PublicKey &&
                  <>
                    <TextField.Root type="text" placeholder={Chain[networkType].PUBKEY_PREFIX + ' ...'} size="3" value={importCandidate} onChange={(e) => { setImportCandidate(e.target.value); }} />
                    <Flex justify="center" mt="2" px="2">
                      <Text size="1" weight="light" color="gray">
                        Public key unlocks watch-only wallet.<Link size="1" color="red" ml="1" onClick={() => resetWallet(false)}>Reset wallet.</Link>
                      </Text>
                    </Flex>
                  </>
                }
                {
                  importType == WalletType.Address &&
                  <>
                    <TextField.Root type="text" placeholder={Chain[networkType].ADDRESS_PREFIX + ' ...'} size="3" value={importCandidate} onChange={(e) => { setImportCandidate(e.target.value); }} />
                    <Flex justify="center" mt="2" px="2">
                      <Text size="1" weight="light" color="gray">
                        Address unlocks watch-only wallet.<Link size="1" color="red" ml="1" onClick={() => resetWallet(false)}>Reset wallet.</Link>
                      </Text>
                    </Flex>
                  </>
                }
                <Flex mt="6" justify="start" align="center" direction="column" gap="3">
                  <Button size="3" variant="surface" loading={loading} disabled={ error || !importValid } style={{ paddingLeft: '24px', paddingRight: '24px' }} className={ importValid ? 'shadow-rainbow-animation' : 'shadow-rainbow-hover' } onClick={() => resetWallet(true)}>Setup a password</Button>
                </Flex>
              </Card>
            }
            {
              status == 'mnemonic' &&
              <Card className="bp-mobile-ghost800" size="4" variant="surface" mx="auto" style={{ width: '100%' }}>
                <Heading as="h3" size={mobile ? '4' : '7'} align="center" mb="3">Remember your recovery phrase</Heading>
                <Callout.Root mb="5" size="1" variant="surface">
                  <Callout.Icon>
                    <Icon path={mdiAlertCircleOutline} size={1} />
                  </Callout.Icon>
                  <Callout.Text>
                    This list of words is your only way to restore the wallet on this device if password is lost or on any other device when you want to move your wallet.
                  </Callout.Text>
                </Callout.Root>
                <Flex gap="2" wrap="wrap" justify="between" minHeight="120px">
                  { 
                    // @ts-ignore
                    mnemonic.map((word, index) => <Badge color={COLOR_MAP[(seed + index) % COLOR_MAP.length]} size="2" key={word + index.toString()}>{ word }</Badge>)
                  }
                </Flex>
                <Flex mt="6" justify="start" align="center" direction="column" gap="3">
                  <Button size="3" variant="surface" loading={loading} style={{ paddingLeft: '24px', paddingRight: '24px' }} className="shadow-rainbow-animation" onClick={createWallet}>Recovery phrase secured</Button>
                  <Button size="2" variant="ghost" disabled={loading} onClick={copyMnemonic}>Copy recovery phrase</Button>
                </Flex>
              </Card>
            }
            <Flex px="2" justify="center">
              <Select.Root value={networkType} onValueChange={(value) => setNetworkType(value as NetworkType)}>
                <Select.Trigger mt="6" variant="soft" color="gray" />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Tangent network</Select.Label>
                    <Select.Item value="mainnet">
                      <Text color="jade">Main network</Text>
                    </Select.Item>
                    <Select.Item value="testnet">
                      <Text color="blue">Test network</Text>
                    </Select.Item>
                    <Select.Item value="regtest">
                      <Text color="red">Regtest network</Text>
                    </Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Flex>
          </Box>
        </Flex>
      </CSSTransition>
    </SwitchTransition>
  );
}