import { Box, Button, Dialog, Flex, Heading, TextField } from "@radix-ui/themes";
import { useNavigate } from "react-router";
import { mdiDotsCircle, mdiMagnify, mdiMagnifyScan, mdiQrcodeScan } from "@mdi/js";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData } from "../core/app";
import { Authorizer, RPC, Signing, Stream } from "tangentsdk";
import { scan, Format } from '@tauri-apps/plugin-barcode-scanner';
import Account from "../components/account";
import Icon from "@mdi/react";

export default function HomePage() {
  const ownerAddress = AppData.getWalletAddress();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [nonce, setNonce] = useState(0);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const search = useCallback(async (awaitMode: 'block' | 'transaction' | false) => {
    if (loading)
      return;

    setLoading(true);
    const jump = (target: string) => {
      setLoading(false);
      navigate(target);
    };
    const value = query.trim();
    const publicKeyHash = Signing.decodeAddress(value);
    if (publicKeyHash != null && publicKeyHash.data.length == 20) {
      jump('/account/' + value);
      return;
    }
    
    if (!awaitMode || awaitMode == 'block') {
      const blockNumber = parseInt(value, 10);
      if (!isNaN(blockNumber) && blockNumber > 0) {
        try {
          const block = await RPC.getBlockByNumber(blockNumber);
          if (block != null) {
            jump('/block/' + value);
            return;
          }
        } catch { }
      }
    }

    if (!awaitMode || awaitMode == 'transaction') {
      try {
        const transaction = await RPC.getTransactionByHash(value);
        if (transaction != null) {
          jump('/transaction/' + value);
          return;
        }
      } catch { }

      try {
        const aliasTransaction = await RPC.getTransactionByHash(new Stream().writeString(value).hash().toHex());
        if (aliasTransaction != null) {
          jump('/transaction/' + value);
          return;
        }
      } catch { }

      try {
        const mempoolTransaction = await RPC.getMempoolTransactionByHash(value);
        if (mempoolTransaction != null) {
          jump('/transaction/' + value);
          return;
        }
      } catch { }

      if (awaitMode) {
        jump('/transaction/' + value);
        return;
      }
    }

    if (!awaitMode || awaitMode == 'block') {
      try {
        const block = await RPC.getBlockByHash(value);
        if (block != null) {
          jump('/block/' + value);
          return;
        }
      } catch { }

      if (awaitMode) {
        jump('/block/' + value);
        return;
      }
    }

    AlertBox.open(AlertType.Error, 'Nothing found');
    setLoading(false);
  }, [query, loading]);
  const searchLatest = useCallback(async () => {
    const status = await AppData.sync();
    if (status && AppData.tip != null) {
      setQuery(AppData.tip.toString());
    } else {
      AlertBox.open(AlertType.Error, 'Block tip not found');
    }
  }, [loading]);
  const searchFocus = useCallback(() => {
    if (searchInput.current != null) {
      searchInput.current.focus();
    }
  }, [searchInput]);
  const searchKeydownEvent = useCallback((event: KeyboardEvent) => {
    if (!searching && document.activeElement === document.body && event.key != null && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      setQuery(event.key);
      setSearching(true);
      setTimeout(searchFocus, 10);
    }
  }, [searching]);
  const searchPasteEvent = useCallback((event: ClipboardEvent) => {
    if (!searching && document.activeElement === document.body) {
      const text = ((event.clipboardData || (window as any).clipboardData) as DataTransfer).getData('text');
      setQuery(text);
      setSearching(true);
      setTimeout(searchFocus, 10);
    }
  }, [searching, searchInput]);
  const tryPrompt = useCallback(async () => {
    if (loading)
      return;
    
    setLoading(true);
    try {
      const result = await scan({ windowed: true, formats: [Format.QRCode] });
      try {
        const request: { url?: string } = JSON.parse(result.content);
        if (typeof request.url != 'string' || !new URL(request.url).href.length)
          throw false;
        
        Authorizer.try(request);
      } catch {
        throw new Error('Not an approval prompt');
      }
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, 'Approval reverted: ' + (typeof exception == 'string' ? exception : exception.message));
    }
    setLoading(false);
  }, [loading]);
  useEffect(() => {
    const state: { blockId: any, transactionId: any } = { blockId: null, transactionId: null };
    if (ownerAddress != null) {
      RPC.onNodeMessage = (event) => {
        switch (event.type) {
          case 'block': {
            if (state.blockId != null)
              clearTimeout(state.blockId);
            state.blockId = setTimeout(() => {
              AppData.sync().then(() => setNonce(prev => prev + 1));
              state.blockId = null;
            }, 1000);
            break;
          }
          case 'transaction': {
            if (state.transactionId != null)
              clearTimeout(state.transactionId);
            state.transactionId = setTimeout(() => {
              AppData.sync().then(() => setNonce(prev => prev + 1));
              state.transactionId = null;
            }, 1000);
            break;
          }
          default:
            break;
        }
      };
      document.addEventListener('keydown', searchKeydownEvent as any);
      document.addEventListener('paste', searchPasteEvent);
    }
    return () => {
      document.removeEventListener('keydown', searchKeydownEvent as any);
      document.removeEventListener('paste', searchPasteEvent);
      RPC.onNodeMessage = null;
    };
  }, []);

  return (
    <Box px="2" pt="4" maxWidth="680px" mx="auto">
      <Flex gap="2" align="center" justify="between" px="2" mb="2">
        <Flex align="center" gap="2">
          <Heading size={document.body.clientWidth < 450 ? '4' : '6'}>Wallet</Heading>
          <Button variant="surface" size="1" color={ AppData.isWalletReady() ? 'lime' : 'red' } onClick={() => AppData.isWalletReady() ? undefined : navigate('/restore')}>{ AppData.isWalletReady() ? '' : 'RO:' }{ ownerAddress ? ownerAddress.substring(ownerAddress.length - 6) : 'NONE' }</Button>
        </Flex>
        <Flex justify="end" gap="1">
          {
            AppData.platform == 'mobile' &&
            <Button variant="soft" size="2" color="gray" onClick={() => tryPrompt()}>
              <Icon path={mdiQrcodeScan} size={0.9} />
            </Button>
          }
          <Dialog.Root onOpenChange={(opened) => setSearching(opened)} open={searching}>
            <Dialog.Trigger>
              <Button variant="soft" size="2" color="gray">
                <Icon path={mdiMagnifyScan} size={0.9} />
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <form action="">
                <Flex justify="between" align="center" mb="2">
                  <Dialog.Title mb="0">Search</Dialog.Title>
                  <Button size="1" variant="soft" type="button" disabled={loading} onClick={() => searchLatest()}>Tip block</Button>
                </Flex>
                <TextField.Root placeholder="Address, hash or number…" size="3" variant="soft" value={query} onChange={(e) => setQuery(e.target.value)} readOnly={loading} ref={searchInput}>
                  <TextField.Slot>
                    <Icon path={mdiMagnify} size={0.9} color="var(--accent-8)"/>
                  </TextField.Slot>
                </TextField.Root>
                <Flex justify="end" align="center" gap="2" mt="4">
                  <Heading size="3" weight="regular">For</Heading>
                  <Button variant="surface" size="2" type="submit" color="green" disabled={loading || !query.trim().length} onClick={() => search('transaction')}>Txn</Button>
                  <Button variant="surface" size="2" type="submit" color="yellow" disabled={loading || !query.trim().length} onClick={() => search('block')}>Block</Button>
                  <Button variant="surface" size="2" type="submit" color="red" disabled={loading || !query.trim().length} onClick={() => search(false)}>Any</Button>
                </Flex>
              </form>
            </Dialog.Content>
          </Dialog.Root>
          <Button variant="soft" size="2" color="amber" onClick={() => navigate('/configure')}>
            <Icon path={mdiDotsCircle} size={0.9} />
          </Button>
        </Flex>
      </Flex>
      <Account ownerAddress={ownerAddress} self={true} nonce={nonce}></Account>
    </Box>
  );
}