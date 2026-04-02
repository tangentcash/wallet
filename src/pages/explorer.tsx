import { Box, Button, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { useNavigate } from "react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertBox, AlertType } from "../components/alert";
import { AppData } from "../core/app";
import { EventResolver, Readability, RPC, Signing, Stream, SummaryState } from "tangentsdk";
import { mdiMagnify } from "@mdi/js";
import { useEffectAsync } from "../core/react";
import Icon from "@mdi/react";
import InfiniteScroll from "react-infinite-scroll-component";
import Transaction from "../components/transaction";

const TRANSACTION_COUNT = 16;
export default function ExplorerPage() {
  const ownerAddress = AppData.getWalletAddress();
  const [counter, setCounter] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [transactions, setTransactions] = useState<{ transaction: any, receipt?: any, state?: SummaryState }[]>([]);
  const [moreTransactions, setMoreTransactions] = useState(true);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const blockNumber = useMemo((): BigNumber | null => {
    return AppData.tip;
  }, [counter]);
  const search = useCallback(async (mode: 'block' | 'transaction' | false) => {
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
    
    if (!mode || mode == 'block') {
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

    if (!mode || mode == 'transaction') {
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

      if (mode) {
        jump('/transaction/' + value);
        return;
      }
    }

    if (!mode || mode == 'block') {
      try {
        const block = await RPC.getBlockByHash(value);
        if (block != null) {
          jump('/block/' + value);
          return;
        }
      } catch { }

      if (mode) {
        jump('/block/' + value);
        return;
      }
    }

    AlertBox.open(AlertType.Error, 'Nothing found');
    setLoading(false);
  }, [query, loading]);
  const findTransactions = useCallback(async (refresh?: boolean) => {
    try {
      const data = await RPC.getFinalizedTransactions(refresh ? 0 : transactions.length, TRANSACTION_COUNT, 2);
      if (!Array.isArray(data) || !data.length) {
        if (refresh)
          setTransactions([]);
        setMoreTransactions(false);
        return false;
      }

      const candidateTransactions = data.map((value) => { return { ...value, state: EventResolver.calculateSummaryState(value?.receipt?.events) } });
      setTransactions(refresh ? candidateTransactions : prev => prev.concat(candidateTransactions));
      setMoreTransactions(candidateTransactions.length >= TRANSACTION_COUNT);
      return candidateTransactions.length > 0;
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to fetch transactions: ' + (exception as Error).message);
      if (refresh)
        setTransactions([]);
      setMoreTransactions(false);
      return false;
    }
  }, [transactions]);
  useEffectAsync(async () => {
    if (!AppData.tip)
      await AppData.sync();
    
    await findTransactions(true);
    setCounter(1);

    const timeout = setInterval(() => setCounter(new Date().getTime()), 3000);
    return () => clearInterval(timeout);
  }, []);

  return (
    <Box px="4" pt="4" maxWidth="680px" mx="auto">
      <Box px="1">
        <Heading mb="2" size="5">Block height { Readability.toValue(null, blockNumber, false, false) }</Heading>
        <TextField.Root style={{ width: '100%' }} placeholder="Address, hash or number…" size="3" variant="soft" value={query} onChange={(e) => setQuery(e.target.value)} readOnly={loading} ref={searchInput}>
          <TextField.Slot>
            <Icon path={mdiMagnify} size={0.9} color="var(--accent-8)"/>
          </TextField.Slot>
        </TextField.Root>
      </Box>
      {
        query.trim().length > 0 &&
        <Flex px="2" gap="1" mt="4" wrap="wrap">   
          <Button size="2" variant="soft" disabled={loading} onClick={() => search(false)}>In anything</Button>
          <Button size="2" variant="soft" disabled={loading} onClick={() => search('transaction')}>In transaction</Button>
          <Button size="2" variant="soft" disabled={loading} onClick={() => search('block')}>In block</Button>
        </Flex>
      }
      <Box width="100%">
        <InfiniteScroll dataLength={transactions.length} hasMore={moreTransactions} next={findTransactions} loader={<div></div>}>
          {
            transactions.map((item, index) =>
              <Box width="100%" key={item.transaction.hash + index + '_tx'}>
                {
                  (!index || !item.receipt || new Date(transactions[index - 1].receipt.block_time?.toNumber()).setHours(0, 0, 0, 0) != new Date(item.receipt.block_time?.toNumber()).setHours(0, 0, 0, 0)) &&
                  <Box px="2" mt="6">
                    <Flex justify="between" mb="1">
                      <Heading size="4">Date</Heading>
                      <Text as="div" size="2" align="right">{ item.receipt ? (new Date(item.receipt.block_time?.toNumber()).setHours(0, 0, 0, 0) == new Date().setHours(0, 0, 0, 0) ? 'Today' : new Date(item.receipt.block_time?.toNumber()).toLocaleDateString()) : 'Today' }</Text>
                    </Flex>
                    <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
                  </Box>
                }
                <Box mb="4">
                  <Transaction ownerAddress={ownerAddress || ''} transaction={item.transaction} receipt={item.receipt} state={item.state}></Transaction>
                </Box>
              </Box>
            )
          }
        </InfiniteScroll>
      </Box>
    </Box>
  );
}