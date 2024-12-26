import { Badge, Box, Button, Callout, Card, Checkbox, Flex, Heading, Link, Select, Text, TextArea, TextField } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Signing } from "../core/tangent/algorithm";
import { mdiAlertCircleOutline } from '@mdi/js';
import { AlertBox, AlertType } from "../components/alert";
import { useNavigate } from "react-router";
import { wordlist } from '@scure/bip39/wordlists/english';
import { CSSTransition, SwitchTransition } from "react-transition-group";
import { Wallet } from "../core/wallet";
import { SafeStorage, Storage, StorageField } from "../core/storage";
import Typed from 'typed.js';
import Icon from '@mdi/react';

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
  const [passphrase, setPassphrase] = useState('');
  const [passphraseCheck, setPassphraseCheck] = useState('');
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [mnemonicSecured, setMnemonicSecured] = useState(false);
  const [mnemonicCandidate, setMnemonicCandidate] = useState('');
  const [seed, setSeed] = useState(0);
  const [numeration, setNumeration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [status, setStatus] = useState(Wallet.isExists() ? 'restore' : 'reset');
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | 'regtest'>(Storage.get(StorageField.Network) || 'mainnet');
  const wordsList = useMemo(() => {
    let result = [];
    for (let i = 0; i < 4; i++)
      result.push(wordlist[Math.floor(Math.random() * wordlist.length) % wordlist.length]);
    return result;
  }, []);
  const titleRef = useRef(null);
  const contentRef = useRef(null);
  const navigate = useNavigate();
  const reportError = useCallback(() => {
    setError(true);
    resetPassphrase();
    setTimeout(() => setError(false), 500);
  }, []);
  const resetPassphrase = useCallback(() => {
    setPassphrase('');
    setPassphraseCheck('');
  }, []);
  const restoreWallet = useCallback(async () => {
    if (loading || error)
      return;

    setLoading(true);
    let status = await Wallet.restore(passphrase, network);
    if (!status) {
      AlertBox.open(AlertType.Error, 'Wallet password did not unlock the secure storage');
      reportError();
    } else {
      return navigate('/');
    }
    setLoading(false);
  }, [passphrase, loading, error]);
  const createWallet = useCallback(async () => {
    if (loading || error)
      return;

    setLoading(true);
    let status = await SafeStorage.reset(passphrase);
    if (status) {
      const hasCandidateMnemonic = (mnemonicSecured && mnemonicCandidate.split(' ').length == 24);
      if (hasCandidateMnemonic || mnemonic.length == 24) {
        status = await Wallet.reset(hasCandidateMnemonic ? mnemonicCandidate.split(' ') : mnemonic, network);
        if (status)
            return navigate('/');

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
  }, [passphrase, loading, error]);
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

    let status = await Wallet.reset(mnemonic.split(' '));
    if (!status) {
      AlertBox.open(AlertType.Error, 'Wallet recovery phrase could not be securely saved');
      reportError();
      setStatus('reset');
    } else {
      setTimeout(() => setMnemonicSecured(true), 3500);
    }
    setLoading(false);
  }, [loading, error]);
  const parseMnemonic = useCallback(async (candidate: string) => {
    if (loading || error)
      return setMnemonicCandidate(candidate);

    const words = candidate.split(/[\s$]/).filter((v) => v.length > 0 && v.match(/[a-z]+/)).map((v) => v.trim());
    if (words.length == 24) {
      if (!Signing.verifyMnemonic(words.join(' '))) {
        AlertBox.open(AlertType.Error, 'Recovery phrase is not correct');
        reportError();
        setMnemonicSecured(false);
        return setMnemonicCandidate(candidate);
      }
      
      setMnemonicSecured(true);
      return setMnemonicCandidate(words.join(' '));
    }

    setMnemonicSecured(false);
    setMnemonicCandidate(candidate);
  }, [mnemonicSecured, mnemonicCandidate, loading, error]);
  const copyMnemonic = useCallback(async () => {
    if (numeration) {
      navigator.clipboard.writeText(mnemonic.map((x, index) => (index + 1) + '. ' + x).join('\n'));
      AlertBox.open(AlertType.Info, 'Plain recovery phrase is copied!');
    } else {
      navigator.clipboard.writeText(mnemonic.join(' '));
      AlertBox.open(AlertType.Info, 'List of recovery phrase words is copied!');
    }
  }, [mnemonic, numeration]);
  const resetWallet = useCallback(() => { setStatus('reset'); resetPassphrase(); }, []);
  const importWallet = useCallback(() => {
    if (status == 'mnemonic')
      setMnemonicSecured(false);
    setStatus('import');
    resetPassphrase();
  }, [status]);
  const tryRestoreWallet = useCallback(() => { setStatus('restore'); resetPassphrase(); }, []);
  useEffect(() => {
    const typed = new Typed(titleRef.current, {
      strings: ['Tangent Chain', 'Tangent Wallet'],
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
  
  return (
    <SwitchTransition mode="out-in">
      <CSSTransition classNames="fade-transition" key={status} nodeRef={contentRef} timeout={350} appear>
        <Flex justify="center" align="center" height="100dvh" key={status} ref={contentRef}>
          <Box maxWidth="600px" width="100%" mx="auto">
            { status == 'restore' && <Card className="bp-mobile-ghost600" size="4" variant="surface" mx="auto" style={{ maxWidth: 400, width: '100%' }}>
              <Heading as="h3" size="8" align="center" mb="5">
              <Text ref={titleRef}>Tangent Wallet</Text>
              </Heading>
              <form action="">
                <Box mb="6" position="relative">
                  <TextField.Root id="card-password-field" type="password" placeholder="Enter your password" autoComplete="current-password" size="3" value={passphrase} onChange={(e) => { setPassphrase(e.target.value); }}/>    
                  <Flex justify="center" mt="2">
                    <Text size="1" weight="light" color="gray">Wallet is encrypted with password.</Text>
                    <Link size="1" color="red" ml="1" onClick={resetWallet}>Reset wallet.</Link>
                  </Flex>
                </Box>
                <Flex mt="4" justify="start" align="center" direction="column" gap="3">
                  <Button size="3" variant="surface" type="submit" loading={loading} style={{ paddingLeft: '24px', paddingRight: '24px', transition: 'all 0.1s linear' }} disabled={passphrase.length < PASSWORD_SIZE} color={error ? 'red' : undefined} className={error ? 'shadow-rainbow-hover animation-horizontal-shake' : (passphrase.length < PASSWORD_SIZE ? 'shadow-rainbow-hover' :  'shadow-rainbow-animation')} onClick={(e) => { e.preventDefault(); restoreWallet(); }}>Unlock wallet</Button>
                </Flex>
              </form>
            </Card> }
            { status == 'reset' && <Card className="bp-mobile-ghost600" size="4" variant="surface" mx="auto" style={{ maxWidth: 400, width: '100%' }}>
              <Heading as="h3" size="8" align="center" mb="5">
                <Text ref={titleRef}>Tangent Wallet</Text>
              </Heading>
              <Box mb="5" position="relative">
                <TextField.Root id="card-password-field" type="password" placeholder="Come up with a password" autoComplete="new-password" size="3" value={passphrase} onChange={(e) => { setPassphrase(e.target.value); }} />
                <TextField.Root id="card-password-field" type="password" placeholder="Retype your new password" autoComplete="new-password" size="3" mt="2" disabled={passphrase.length < PASSWORD_SIZE} value={passphraseCheck} onChange={(e) => { setPassphraseCheck(e.target.value); }} />
                {
                  Wallet.isExists() &&
                  <Flex justify="center" mt="2">
                    <Text size="1" weight="light" color="gray">At any cost, do not forget.</Text>
                    <Link size="1" ml="1" onClick={tryRestoreWallet}>Restore wallet.</Link>
                  </Flex>
                }
                {
                  !Wallet.isExists() &&
                  <Flex justify="center" mt="2">
                    <Text size="1" weight="light" color="gray">At any cost, do not forget.</Text>
                    <Link size="1" ml="1" onClick={importWallet}>{ mnemonicSecured ? 'Change recovery phrase.' : 'Import wallet.' }</Link>
                  </Flex>
                }
              </Box>
              <Flex mt="4" justify="start" align="center" direction="column" gap="3">
                <Button size="3" variant="surface" loading={loading} style={{ paddingLeft: '24px', paddingRight: '24px' }} disabled={passphrase.length < PASSWORD_SIZE || passphrase != passphraseCheck} className={error ? 'shadow-rainbow-hover animation-horizontal-shake' : (passphrase.length < PASSWORD_SIZE || passphrase != passphraseCheck ? 'shadow-rainbow-hover' :  'shadow-rainbow-animation')} onClick={createWallet}>{ mnemonicSecured ? 'Import wallet' : 'Create wallet' }</Button>
                { Wallet.isExists() && <Link size="1" ml="1" color="gray" onClick={importWallet}>{ mnemonicSecured ? 'Change recovery phrase' : 'Import wallet' }</Link> }
              </Flex>
            </Card> }
            { status == 'import' && <Card className="bp-mobile-ghost600" size="4" variant="surface" mx="auto" style={{ maxWidth: 600, width: '100%' }}>
              <Heading as="h3" size="7" align="center" mb="3">Enter your recovery phrase</Heading>
              <TextArea resize="vertical" variant="classic" size="3" style={{ minHeight: 150 }} placeholder={ wordsList.join(' ') + ' ... and 20 other words' } value={mnemonicCandidate} onChange={(e) => parseMnemonic(e.target.value)} />
              <Flex justify="center" mt="2">
                  <Text size="1" weight="light" color="gray">Recovery phrase is a secret that will restore your wallet on any device.</Text>
                  <Link size="1" color="red" ml="1" onClick={resetWallet}>Reset wallet.</Link>
                </Flex>
              <Flex mt="6" justify="start" align="center" direction="column" gap="3">
                <Button size="3" variant="surface" loading={loading} disabled={ error || !mnemonicSecured } style={{ paddingLeft: '24px', paddingRight: '24px' }} className={ mnemonicSecured ? 'shadow-rainbow-animation' : 'shadow-rainbow-hover' } onClick={resetWallet}>Setup a password</Button>
              </Flex>
            </Card> }
            { status == 'mnemonic' && <Card className="bp-mobile-ghost800" size="4" variant="surface" mx="auto" style={{ width: '100%' }}>
              <Heading as="h3" size="7" align="center" mb="3">Remember your recovery phrase</Heading>
              <Callout.Root mb="5" size="1" variant="surface">
                <Callout.Icon>
                  <Icon path={mdiAlertCircleOutline} size={1} />
                </Callout.Icon>
                <Callout.Text>
                  This list of words is your only way to restore the wallet on this device if password is lost or on any other device when you want to move your wallet.
                </Callout.Text>
              </Callout.Root>
              <Flex gap="2" wrap="wrap" justify={numeration ? 'center' : 'between' }>
                { 
                  // @ts-ignore
                  mnemonic.map((word, index) => <Badge color={COLOR_MAP[(seed + index) % COLOR_MAP.length]} size="2" key={word + index.toString()}>{ numeration ? index + 1 + '. ' + word : word }</Badge>)
                }
              </Flex>
              <Flex justify="between" align="center" mt="6">
                <Text as="label" size="2">
                  <Flex gap="2">
                    <Checkbox checked={numeration} onCheckedChange={(e) => setNumeration(e.valueOf() == true)} />
                    Show order of words
                  </Flex>
                </Text>
                <Button size="2" variant="ghost" disabled={loading} onClick={copyMnemonic}>Copy recovery phrase</Button>
              </Flex>
              <Flex mt="6" justify="start" align="center" direction="column" gap="3">
                <Button size="3" variant="surface" loading={loading} style={{ paddingLeft: '24px', paddingRight: '24px' }} disabled={!mnemonicSecured} className={ mnemonicSecured ? 'shadow-rainbow-animation' : 'shadow-rainbow-hover' } onClick={createWallet}>Recovery phrase secured</Button>
              </Flex>
            </Card> }
            <Flex px="2" justify="center">
              <Select.Root value={network} onValueChange={(value) => setNetwork(value as 'mainnet' | 'testnet' | 'regtest')}>
                <Select.Trigger mt="6" variant="soft" color="gray" />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Tangent network</Select.Label>
                    <Select.Item value="mainnet">
                      <Text color="green">Main network</Text>
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