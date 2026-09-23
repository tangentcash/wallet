import { Button, Select, TextField } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mdiAlertCircleOutline, mdiAlertOutline, mdiDownload, mdiFileDocumentOutline, mdiKeyOutline, mdiEyeOutline } from '@mdi/js';
import { AlertBox, AlertType } from "../components/alert";

import AddressAvatar from "../components/avatar";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { SafeStorage } from "../core/storage";
import { ByteUtil, Chain, Pubkeyhash, Signing } from "tangentsdk/algorithm";
import { NetworkType, WalletType } from "tangentsdk/rpc";
import { AppData } from "../core/app";
import { UiUtil } from "tangentsdk/ui";
import Icon from '@mdi/react';
import './restore.css';

// @ts-ignore
const PASSWORD_SIZE = 6;


export default function RestorePage() {
  const [params] = useSearchParams();
  const [passphrase, setPassphrase] = useState('');
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activated, setActivated] = useState(false);
  const [status, setStatus] = useState<'reset' | 'restore' | 'import' | 'mnemonic'>(AppData.isWalletExists() && !params.has('add') ? 'restore' : 'reset');
  const [importType, setImportType] = useState<WalletType>(WalletType.Mnemonic);
  const [importCandidate, setImportCandidate] = useState('');
  const [networkType, setNetworkType] = useState<NetworkType>(AppData.savedNetwork() || AppData.defaultNetwork());
  const options = useMemo(() => ({
    add: params.get('add')
  }), [params]);
  useEffect(() => {
    setStatus(AppData.isWalletExists() && !params.has('add') ? 'restore' : 'reset');
  }, [params]);
  const navigate = useNavigate();
  const reportError = useCallback(() => {
    setError(true);
    setPassphrase('');
    setTimeout(() => setError(false), 2500);
  }, []);
  const importError = useMemo((): string | null => {
    switch (importType) {
      case WalletType.Mnemonic: {
        const words = importCandidate.split(/[\s$]/).filter((v) => v.length > 0 && v.match(/[a-z]+/)).map((v) => v.trim());
        if (words.length != 24) {
          const missing = 24 - words.length;
          return missing > 0 ? `Input ${missing} more word${missing > 1 ? 's' : ''}` : `Remove ${-missing} word${missing < -1 ? 's' : ''}`;
        }

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          if (!Signing.verifyMnemonicWord(word)) {
            return `“${word}” is not a recovery word`
          }
        }

        if (Signing.verifyMnemonic(words.join(' '))) {
          const result = words.join(' ');
          if (result != importCandidate)
            setImportCandidate(result);
          return null;
        }

        return `Not a recovery phrase`;
      }
      case WalletType.SecretKey: {
        Chain.props = Chain[networkType];
        const key = Signing.decodeSecretKey(importCandidate.trim());
        if (!key)
          return `Not a private key`;

        const result = Signing.encodeSecretKey(key);
        if (result != null && result != importCandidate)
          setImportCandidate(result);
        return null;
      }
      case WalletType.PublicKey: {
        Chain.props = Chain[networkType];
        const key = Signing.decodePublicKey(importCandidate.trim());
        if (!key)
          return `Not a public key`;

        if (Signing.verifyPublicKey(key)) {
          const result = Signing.encodePublicKey(key);
          if (result != null && result != importCandidate)
            setImportCandidate(result);
          return null;
        }
        
        return `Not a valid public key`;
      }
      case WalletType.Address: {
        Chain.props = Chain[networkType];
        const address = Signing.decodeAddress(importCandidate.trim());
        if (!address)
          return `Not an address`;

        if (address.data.length == 20) {
          const result = Signing.encodeAddress(address);
          if (result != null && result != importCandidate)
            setImportCandidate(result);
          return null;
        }

        return `Not a valid address`;
      }
      default:
        return null;
    }
  }, [importType, importCandidate, networkType]);
  const phraseWords = useMemo((): string[] => {
    const words = importCandidate.split(/ +/);
    return Array.from({ length: 24 }, (_, i) => words[i] || '');
  }, [importCandidate]);
  const setWord = useCallback((index: number, raw: string) => {
    const tokens = raw.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    const next = phraseWords.slice();
    if (tokens.length > 1) {
      for (let k = 0; k < tokens.length && index + k < 24; k++)
        next[index + k] = tokens[k];
    } else
      next[index] = tokens[0] || '';
    setImportCandidate(next.join(' '));
  }, [phraseWords]);
  const unlockButton = useRef<HTMLButtonElement>(null);
  const wordCells = useRef<Array<HTMLInputElement | null>>([]);
  const advanceWord = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key != 'Enter' || e.nativeEvent.isComposing)
      return;

    e.preventDefault();
    if (!Signing.verifyMnemonicWord(phraseWords[index]))
      return;

    const next = wordCells.current[index + 1];
    if (next)
      next.focus();
    else
      e.currentTarget.blur();
  }, [phraseWords]);
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
  const restoreWallet = useCallback(async () => {
    if (loading || error)
      return;

    setLoading(true);
    try {
      let status = await AppData.restoreWallet(passphrase, networkType);
      if (!status) {
        AlertBox.open(AlertType.Error, 'Wallet password did not unlock the secure storage');
        reportError();
      } else {
        return exitPrompt();
      }
    } catch (exception: any) {
        AlertBox.open(AlertType.Error, exception.message);
        reportError();
    }
    setLoading(false);
  }, [passphrase, networkType, loading, error]);
  const createWallet = useCallback(async () => {
    if (loading || error)
      return;

    setLoading(true);
    let status = options.add ? await SafeStorage.restore(passphrase) : await SafeStorage.reset(passphrase);
    if (status) {
      if (importError) {
        let candidate = mnemonic;
        if (candidate.length != 24) {
          let rng: string = Signing.mnemonicgen();
          candidate = rng.split(' ');
          setMnemonic(candidate);
        }

        status = await AppData.resetWallet(candidate, WalletType.Mnemonic, networkType);
        if (!status) {
          AlertBox.open(AlertType.Error, 'Wallet recovery phrase could not be securely saved');
          reportError();
        } else {
          setStatus('mnemonic');
        }
      } else {
        status = await AppData.resetWallet(importType == WalletType.Mnemonic ? importCandidate.split(' ') : importCandidate, importType, networkType);
        if (status)
          return exitPrompt();

        AlertBox.open(AlertType.Error, 'Wallet recovery phrase could not be securely saved');
        reportError();
      }
    } else {
      AlertBox.open(AlertType.Error, options.add ? 'Wallet password did not unlock the secure storage' : 'Wallet recovery phrase could not be generated');
      reportError();
    }
    setLoading(false);
  }, [passphrase, networkType, loading, error, importError, mnemonic, options.add]);
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
    Chain.props = Chain[networkType];
  }, [networkType]);
  useEffect(() => {
    setActivated(true);
  }, []);

  if (!activated && !options.add && AppData.isWalletReady()) {
    return <Navigate replace={true} to="/" state={{ from: `${location.pathname}${location.search}` }} />;
  }

  const lockedAddress = AppData.getWalletAddress();
  const networkPill =
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
      <Select.Root value={networkType} onValueChange={(value) => setNetworkType(value as NetworkType)}>
        <Select.Trigger className="network-pill">
          <span className="rp-dot"></span>
          { networkType == 'mainnet' ? 'Mainnet' : networkType == 'testnet' ? 'Testnet' : 'Regtest' }
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            <Select.Label>Network</Select.Label>
            <Select.Item value="regtest">Regtest<span className="tiny dim" style={{ marginLeft: 'auto' }}>local node</span></Select.Item>
            <Select.Item value="testnet" disabled>Testnet<span className="tiny dim" style={{ marginLeft: 'auto' }}>public peers</span></Select.Item>
            <Select.Item value="mainnet">Mainnet<span className="badge warn" style={{ marginLeft: 'auto' }}>LIVE</span></Select.Item>
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </div>;

  return (
    <div className="restore-wrap" key={status}>
      {
        status == 'restore' &&
        <div className="restore-hero">
          <div className="brand-tile" style={ lockedAddress ? { background: 'transparent', overflow: 'hidden' } : undefined }>{ lockedAddress ? <AddressAvatar address={lockedAddress} size="1" style={{ width: '100%', height: '100%', borderRadius: 22 }}></AddressAvatar> : 'T' }</div>
          <div className="page-title" style={{ fontSize: 30 }}>Welcome back</div>
          <div className="page-sub">{ lockedAddress ? `Unlock to manage ${UiUtil.toAddress(lockedAddress, 6)}` : 'Unlock to manage your wallet' }</div>
          <div className="card" style={{ marginTop: 26, width: '100%', maxWidth: 400 }}>
            <div className="field" style={{ marginBottom: error ? 12 : 14 }}>
              <span className="field-label" style={error ? { color: 'var(--down)' } : undefined}>Password</span>
              <TextField.Root id="card-password-field" className="restore-input" type="password" placeholder="Enter your password" autoComplete="current-password" enterKeyHint="go" value={passphrase} onChange={(e) => { setError(false); setPassphrase(e.target.value); }} onKeyDown={(e) => { if (e.key == 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); unlockButton.current?.click(); } }} />
            </div>
            {
              error &&
              <div className="callout err" style={{ marginBottom: 14 }}>
                <Icon path={mdiAlertCircleOutline} size={1} />
                <span>Couldn't unlock this wallet.</span>
              </div>
            }
            <Button ref={unlockButton} className={'btn-brand btn-block' + (error ? ' animation-horizontal-shake' : '')} disabled={passphrase.length < PASSWORD_SIZE || loading} onClick={(e) => { e.preventDefault(); restoreWallet(); }}>
              { loading ? 'Unlocking…' : 'Unlock wallet' }
            </Button>
            { networkPill }
          </div>
          <div style={{ marginTop: 26 }}>
            <Button className="btn-soft btn-sm" onClick={() => navigate('/restore?add=true')}>Add or import a wallet</Button>
          </div>
        </div>
      }
      {
        status == 'reset' &&
        <div className="restore-hero">
          {
            !AppData.isWalletExists() &&
            <>
              <div className="page-title" style={{ fontSize: 26, whiteSpace: 'nowrap' }}>Your keys, your tangent</div>
              <div className="page-sub" style={{ marginTop: 8 }}>Non-custodial. No email, no servers.</div>
            </>
          }
          {
            AppData.isWalletExists() &&
            <>
              <div className="page-title" style={{ fontSize: 26 }}>Add a wallet</div>
              <div className="page-sub" style={{ marginTop: 8 }}>A new wallet will be added on this device.</div>
            </>
          }
          <div className="card" style={{ marginTop: 26, width: '100%', maxWidth: 400 }}>
            <div className="field" style={{ marginBottom: 14 }}>
              <span className="field-label">{ options.add ? 'Confirm your password' : 'Choose a password' }</span>
              <TextField.Root id="card-password-field" className="restore-input" type="password" placeholder={options.add ? 'Enter your password' : 'At least 6 characters'} autoComplete="new-password" value={passphrase} onChange={(e) => { setError(false); setPassphrase(e.target.value); }} />
              <span className="tiny dim" style={{ display: 'block', marginTop: 8 }}>Do not forget it — the password itself cannot be recovered.</span>
            </div>
            <Button className={'btn-brand btn-block' + (error ? ' animation-horizontal-shake' : '')} disabled={passphrase.length < PASSWORD_SIZE || loading} onClick={(e) => { e.preventDefault(); createWallet(); }}>
              { !importError && importCandidate.length > 0 ? 'Open wallet' : 'Create new wallet' }
            </Button>
            {
              AppData.isWalletExists() &&
              <div className="tiny dim" style={{ textAlign: 'center', marginTop: 14 }}>
                Locked the wrong wallet? <span className="watch-link" onClick={tryRestoreWallet}>Unlock the existing one →</span>
              </div>
            }
            { networkPill }
          </div>
          <div className="tiny dim" style={{ textAlign: 'center', marginTop: 18 }}>
            Already have a wallet? <span className="watch-link" onClick={importWallet}>Import wallet →</span>
          </div>
        </div>
      }
      {
        status == 'import' &&
        <div className="restore-col">
          <div className="page-head" style={{ width: '100%', maxWidth: 480, marginBottom: 14 }}>
              <Select.Root value={importType} onValueChange={async (value) => {
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
                <Select.Trigger className="import-source" />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>Import source</Select.Label>
                    <Select.Item value="auto"><Icon path={mdiFileDocumentOutline} size={0.85}></Icon>Wallet file</Select.Item>
                    <Select.Item value="mnemonic"><Icon path={mdiDownload} size={0.85}></Icon>Recovery phrase<span className="tiny dim" style={{ marginLeft: 'auto' }}>24 words</span></Select.Item>
                    <Select.Item value="secretkey"><Icon path={mdiKeyOutline} size={0.85}></Icon>Private key</Select.Item>
                    <Select.Item value="publickey"><Icon path={mdiKeyOutline} size={0.85}></Icon>Public key</Select.Item>
                    <Select.Item value="address"><Icon path={mdiEyeOutline} size={0.85}></Icon>Watch-only address</Select.Item>
                  </Select.Group>
                </Select.Content>
              </Select.Root>
          </div>
          <div className="card" style={{ width: '100%', maxWidth: 480 }}>
            {
              importType == WalletType.Mnemonic &&
              <>
                <div className="phrase-grid">
                  {
                    Array.from({ length: 24 }, (_, i) =>
                      <input key={'phrase_word_' + i} type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
                        ref={(el) => { wordCells.current[i] = el; }} enterKeyHint={i < 23 ? 'next' : 'done'}
                        className={'word-cell' + (phraseWords[i].length > 0 && !Signing.verifyMnemonicWord(phraseWords[i]) ? ' bad' : '')}
                        placeholder={String(i + 1)} value={phraseWords[i]} onChange={(e) => setWord(i, e.target.value)} onKeyDown={(e) => advanceWord(i, e)} />
                    )
                  }
                </div>
                {
                  importError && !phraseWords.some((w) => w.length == 0) &&
                  <div className="callout err" style={{ marginTop: 12 }}>
                    <Icon path={mdiAlertCircleOutline} size={1} />
                    <span>{ importError }</span>
                  </div>
                }
                <div className="tiny dim" style={{ marginTop: 12, textAlign: 'center' }}>Paste the whole phrase at once — words fill in automatically.</div>
              </>
            }
            {
              importType != WalletType.Mnemonic &&
              <>
                <TextField.Root className="restore-input mono-input" type="text" placeholder={ importType == WalletType.SecretKey ? Chain[networkType].SECKEY_PREFIX + ' …' : importType == WalletType.PublicKey ? Chain[networkType].PUBKEY_PREFIX + ' …' : Chain[networkType].ADDRESS_PREFIX + ' …' } value={importCandidate} onChange={(e) => { setImportCandidate(e.target.value); }} />
                {
                  importCandidate && importError &&
                  <div className="callout err" style={{ marginTop: 12 }}>
                    <Icon path={mdiAlertCircleOutline} size={1} />
                    <span>{ importError }</span>
                  </div>
                }
                {
                  !importCandidate &&
                  <div className="tiny dim" style={{ marginTop: 10, textAlign: 'center' }}>{ importType == WalletType.SecretKey ? 'A private key imports a full signing wallet.' : importType == WalletType.PublicKey ? 'A public key tracks a watch-only wallet.' : 'You will see balances and history, but cannot sign.' }</div>
                }
              </>
            }
            <Button className="btn-brand btn-block" style={{ marginTop: 14 }} disabled={error || !!importError || !importCandidate} onClick={() => resetWallet(true)}>Import wallet</Button>
          </div>
          {
            importType == WalletType.Mnemonic &&
            <div className="callout" style={{ width: '100%', maxWidth: 480, marginTop: 14 }}>
              <Icon path={mdiAlertCircleOutline} size={1} />
              <span>Words are checked against the wordlist as you type. Unknown words are flagged before any chain contact.</span>
            </div>
          }
          <div className="tiny dim" style={{ textAlign: 'center', marginTop: 18 }}>
            Changed your mind? <span className="watch-link" onClick={() => resetWallet(false)}>Create a new wallet instead →</span>
          </div>
        </div>
      }
      {
        status == 'mnemonic' &&
        <div className="restore-col">
          <div className="callout warn" style={{ width: '100%', maxWidth: 480, marginBottom: 14 }}>
            <Icon path={mdiAlertOutline} size={1} />
            <span>This phrase is the only way to restore the wallet on any device. Save it offline — anyone with these words controls the funds.</span>
          </div>
          <div className="card" style={{ width: '100%', maxWidth: 480 }}>
            <div className="card-title">Your recovery phrase</div>
            <div className="phrase-grid">
              {
                mnemonic.map((word, index) =>
                  <span className="pv-cell" key={word + index}><i>{ index + 1 }</i>{ word }</span>
                )
              }
            </div>
            <Button className="btn-brand btn-block" style={{ marginTop: 18 }} disabled={loading} onClick={() => exitPrompt()}>Finish setup</Button>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
              <Button className="btn-soft btn-sm" disabled={loading} onClick={copyMnemonic}>Copy phrase</Button>
            </div>
          </div>
        </div>
      }
    </div>
  );
}