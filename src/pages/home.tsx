import { Badge, Box, Button, Dialog, Flex, Heading, TextField } from "@radix-ui/themes";
import { useNavigate } from "react-router";
import { mdiMagnify, mdiMagnifyScan, mdiQrcodeScan } from "@mdi/js";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData } from "../core/app";
import { Authorizer, RPC, Signing } from "tangentsdk";
import { scan, Format } from '@tauri-apps/plugin-barcode-scanner';
import Account from "../components/account";
import Icon from "@mdi/react";

export default function HomePage() {
  const ownerAddress = AppData.getWalletAddress() || '';
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [nonce, setNonce] = useState(0);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const search = useCallback(async () => {
    if (loading)
      return;

    setLoading(true);
    const value = query.trim();
    const publicKeyHash = Signing.decodeAddress(value);
    if (publicKeyHash != null && publicKeyHash.data.length == 20) {
      navigate('/account/' + value);
      setLoading(false);
      return;
    }
    
    const blockNumber = parseInt(value, 10);
    if (!isNaN(blockNumber) && blockNumber > 0) {
      try {
        const block = await RPC.getBlockByNumber(blockNumber);
        if (block != null) {
          navigate('/block/' + value);
          setLoading(false);
          return;
        }
      } catch { }
    }

    try {
      const transaction = await RPC.getTransactionByHash(value);
      if (transaction != null) {
        navigate('/transaction/' + value);
        setLoading(false);
        return;
      }

      const mempoolTransaction = await RPC.getMempoolTransactionByHash(value);
      if (mempoolTransaction != null) {
        navigate('/transaction/' + value);
        setLoading(false);
        return;
      }
    } catch { }

    try {
      const block = await RPC.getBlockByHash(value);
      if (block != null) {
        navigate('/block/' + value);
        setLoading(false);
        return;
      }
    } catch { }
    
    AlertBox.open(AlertType.Error, 'No blockchain data found');
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
    if (!searching && document.activeElement === document.body && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
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
    return () => {
      document.removeEventListener('keydown', searchKeydownEvent as any);
      document.removeEventListener('paste', searchPasteEvent);
      RPC.onNodeMessage = null;
    };
  }, []);

  return (
    <Box px="2" pt="4" maxWidth="680px" mx="auto">
      <Flex gap="2" align="center" justify="between" px="1" mb="2">
        <Flex align="center" gap="2">
          <Heading size={document.body.clientWidth < 450 ? '4' : '6'}>Wallet</Heading>
          <Badge radius="medium" variant="surface" size="2">{ ownerAddress.substring(ownerAddress.length - 6).toUpperCase() }</Badge>
        </Flex>
        <Flex justify="end" gap="1">
          <Dialog.Root onOpenChange={(opened) => setSearching(opened)} open={searching}>
            <Dialog.Trigger>
              <Button variant="soft" size="2" color="gray">
                <Icon path={mdiMagnifyScan} size={0.7} style={{ transform: 'translateY(-1px)' }} /> FIND
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="450px">
              <form action="">
                <Flex justify="between" align="center" mb="2">
                  <Dialog.Title mb="0">Explorer</Dialog.Title>
                  <Button radius="medium" size="1" variant="outline" type="button" disabled={loading} onClick={() => searchLatest()}>Last block</Button>
                </Flex>
                <TextField.Root placeholder="Address, hash or number…" size="3" variant="soft" value={query} onChange={(e) => setQuery(e.target.value)} readOnly={loading} ref={searchInput}>
                  <TextField.Slot>
                    <Icon path={mdiMagnify} size={0.9} color="var(--accent-8)"/>
                  </TextField.Slot>
                </TextField.Root>
                <Flex justify="center" mt="4">
                  <Button variant="ghost" size="3" type="submit" loading={loading} disabled={!query.trim().length} onClick={(e) => { e.preventDefault(); search(); }}>Search the blockchain</Button>
                </Flex>
              </form>
            </Dialog.Content>
          </Dialog.Root>
          {
            AppData.platform == 'mobile' &&
            <Button variant="soft" size="2" color="bronze" onClick={() => tryPrompt()}>
              <Icon path={mdiQrcodeScan} size={0.7} style={{ transform: 'translateY(-1px)' }} /> SCAN
            </Button>
          }
        </Flex>
      </Flex>
      <Account ownerAddress={ownerAddress} self={true} nonce={nonce}></Account>
    </Box>
  );
}