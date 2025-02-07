import { Box, Button, Dialog, Flex, Heading, IconButton, TextField } from "@radix-ui/themes";
import { Interface, Netstat, Wallet } from "../core/wallet";
import { useNavigate } from "react-router";
import { mdiMagnify, mdiMagnifyScan } from "@mdi/js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Signing } from "../core/tangent/algorithm";
import { AlertBox, AlertType } from "../components/alert";
import Account from "../components/account";
import Icon from "@mdi/react";

export default function HomePage() {
  const ownerAddress = Wallet.getAddress() || '';
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const account = useRef<any>(null);
  const navigate = useNavigate();
  const search = useCallback(async () => {
    if (loading)
      return;

    const value = query.trim();
    const publicKeyHash = Signing.decodeAddress(value);
    if (publicKeyHash != null && publicKeyHash.data.length == 20) {
      navigate('/account/' + value);
      return;
    }
    
    const blockNumber = parseInt(value, 10);
    if (!isNaN(blockNumber) && blockNumber > 0) {
      setLoading(true);
      try {
        const block = await Interface.getBlockByNumber(blockNumber);
        setLoading(false);
        if (block != null) {
          navigate('/block/' + value);
          return;
        }
      } catch {
        setLoading(false);
      }
    }

    setLoading(true);
    try {
      const transaction = await Interface.getTransactionByHash(value);
      if (transaction != null) {
        navigate('/transaction/' + value);
        setLoading(false);
        return;
      }
    } catch {
      setLoading(false);
    }

    try {
      const block = await Interface.getBlockByHash(value);
      setLoading(false);
      if (block != null) {
        navigate('/block/' + value);
        return;
      }
    } catch {
      setLoading(false);
    }
    
    AlertBox.open(AlertType.Error, 'No blockchain data found');
  }, [query, loading]);
  const searchLatest = useCallback(async () => {
    const status = await Netstat.sync();
    if (status && Netstat.blockTipNumber != null) {
      setQuery(Netstat.blockTipNumber.toString());
    } else {
      AlertBox.open(AlertType.Error, 'Block tip not found');
    }
  }, [loading]);
  useEffect(() => {
    Interface.onNotification = (event) => {
      switch (event.type) {
        case 'block': {
          Netstat.sync().then(() => {
            if (account.current != null) {
              if (typeof account.current.updateFinalizedTransactions == 'function')
                account.current.updateFinalizedTransactions();
              if (typeof account.current.updateMempoolTransactions == 'function')
                account.current.updateMempoolTransactions();
            }
          });
          break;
        }
        case 'transaction': {
          Netstat.sync().then(() => {
            if (account.current != null && typeof account.current.updateMempoolTransactions == 'function')
              account.current.updateMempoolTransactions();
          });
          break;
        }
        default:
          break;
      }
    };
    return () => {
      Interface.onNotification = null;
    };
  }, []);

  return (
    <Box px="4" pt="4" maxWidth="680px" mx="auto">
      <Flex gap="2" align="center" px="1">
        <Heading size="6">My Account</Heading>
        <Dialog.Root>
          <Dialog.Trigger>
            <IconButton variant="ghost" size="2" mb="1" color="gray">
              <Icon path={mdiMagnifyScan} size={1} />
            </IconButton>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px">
            <form action="">
              <Flex justify="between" align="center" mb="2">
                <Dialog.Title mb="0">Explorer</Dialog.Title>
                <Button radius="medium" size="1" variant="outline" type="button" disabled={loading} onClick={() => searchLatest()}>Latest</Button>
              </Flex>
              <TextField.Root placeholder="Address, hash or number…" size="3" variant="soft" value={query} onChange={(e) => setQuery(e.target.value)} readOnly={loading}>
                <TextField.Slot>
                  <Icon path={mdiMagnify} size={0.9}  color="var(--accent-8)"/>
                </TextField.Slot>
              </TextField.Root>
              <Flex justify="center" mt="4">
                <Button variant="ghost" size="3" type="submit" loading={loading} disabled={!query.trim().length} onClick={(e) => { e.preventDefault(); search(); }}>Search the blockchain</Button>
              </Flex>
            </form>
          </Dialog.Content>
        </Dialog.Root>
      </Flex>
      <Account ownerAddress={ownerAddress} owns={true} ref={account}></Account>
    </Box>
  );
}