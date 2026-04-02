import { Box, Button, Flex, Heading } from "@radix-ui/themes";
import { useNavigate } from "react-router";
import { mdiDotsCircle, mdiMagnifyScan, mdiQrcodeScan } from "@mdi/js";
import { useCallback, useEffect, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData } from "../core/app";
import { Authorizer, RPC } from "tangentsdk";
import { scan, Format } from '@tauri-apps/plugin-barcode-scanner';
import Account from "../components/account";
import Icon from "@mdi/react";

export default function HomePage() {
  const ownerAddress = AppData.getWalletAddress() || '';
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const navigate = useNavigate();
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
    return () => {
      RPC.onNodeMessage = null;
    };
  }, []);

  return (
    <Box px="2" pt="4" maxWidth="680px" mx="auto">
      <Flex gap="2" align="center" justify="between" px="2" mb="2">
        <Flex align="center" gap="2">
          <Heading size={document.body.clientWidth < 450 ? '4' : '6'}>Wallet</Heading>
          <Button variant="surface" size="1" color={ AppData.isWalletReady() ? 'lime' : 'red' } onClick={() => AppData.isWalletReady() ? undefined : navigate('/restore')}>{ AppData.isWalletReady() ? '' : 'RO:' }{ ownerAddress.substring(ownerAddress.length - 6) }</Button>
        </Flex>
        <Flex justify="end" gap="1">
          {
            AppData.platform == 'mobile' &&
            <Button variant="soft" size="2" color="gray" onClick={() => tryPrompt()}>
              <Icon path={mdiQrcodeScan} size={0.9} />
            </Button>
          }
          <Button variant="soft" size="2" color="gray" onClick={() => navigate('/explorer')}>
            <Icon path={mdiMagnifyScan} size={0.9} />
          </Button>
          <Button variant="soft" size="2" color="amber" onClick={() => navigate('/configure')}>
            <Icon path={mdiDotsCircle} size={0.9} />
          </Button>
        </Flex>
      </Flex>
      <Account ownerAddress={ownerAddress} self={true} nonce={nonce}></Account>
    </Box>
  );
}