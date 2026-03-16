import { useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useCallback, useEffect, useState } from "react";
import { Box, Callout, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { Chain, EventResolver, RPC, Stream } from "tangentsdk";
import { AppData } from "../core/app";
import { mdiListStatus } from "@mdi/js";
import Transaction from "../components/transaction";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

function ExtendedTransaction(props: { data: any, focused: boolean }) {
  const data = props.data;
  const ownerAddress = AppData.getWalletAddress() || '';
  return (
    <>
      <Transaction ownerAddress={ownerAddress} transaction={data.transaction} receipt={data.receipt} state={data.state} open={props.focused || undefined}></Transaction>
      {
        Array.isArray(data.transaction.transactions) && data.transaction.transactions.map((subtransaction: any, index: number) =>
          <Box mt="4" key={subtransaction.action.hash + index.toString()}>
            <Transaction ownerAddress={ownerAddress} preview={'Internal transaction #' + (index + 1).toString()} transaction={(() => ({
              ...subtransaction.action,
              gas_price: new BigNumber(0),
              gas_limit: data.rollupGasLimit.gt(0) ? data.rollupGasLimit : data.transaction.gas_limit
            }))()} receipt={(() => {
              const receipt = data.state ? data.state.receipts[subtransaction.action.hash] : null;
              return {
                ...data.receipt,
                relative_gas_use: receipt ? receipt.relativeGasUse : data.receipt.relative_gas_use,
              };
            })()} open={true}></Transaction>
          </Box>
        )
      }
    </>
  )
}

export default function TransactionPage() {
  const params = useParams();
  const [targets, setTargets] = useState<any[] | null>(null);
  const [timeoutId, setTimeoutId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchTransaction = useCallback(async () => {
    try {
      if (!params.id)
        throw false;

      let results: any[] | null = null;
      try {
        results = await RPC.getTransactionsByHash(params.id, 2);
        if (!results)
            throw false;
      } catch {
        try {
          results = await RPC.getTransactionsByHash(new Stream().writeString(params.id).hash().toHex(), 2);
          if (!results)
            throw false;
        } catch {
          let result = await RPC.getMempoolTransactionByHash(params.id);
          if (!result)
            throw false;

          results = [result];
        }
      }
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result.transaction) {
          results[i] = { transaction: result };
        } else {
          result.state = EventResolver.calculateSummaryState(result.receipt?.events);
        }

        result.rollupGasLimit = new BigNumber(0);
        if (result.state != null && result.state.receipts) {
          for (let hash in result.state.receipts) {
            result.rollupGasLimit = result.rollupGasLimit.plus(result.state.receipts[hash].relativeGasUse);
          }
        }
      }
  
      if (!AppData.tip)
        await AppData.sync();

      setTargets(results);
    } catch {
      setTargets(null);
    }
    setTimeoutId(setTimeout(() => fetchTransaction(), Chain.policy.BLOCK_TIME) as any);
  }, [params.id]);
  useEffectAsync(async () => {
    setLoading(true);
    await fetchTransaction();
    setLoading(false);
  }, [fetchTransaction]);
  useEffect(() => {
    return () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    }
  }, [timeoutId]);

  if (targets != null) {
    return (
      <Box px="4" pt="4" mb="6" maxWidth="800px" mx="auto">
        <Heading size="6">{ targets.length > 1 ? 'Group of transactions' : 'Transaction' }</Heading>
        {
          targets.map((data) => <ExtendedTransaction key={data.transaction.hash} data={data} focused={targets.length == 1}></ExtendedTransaction>)
        }
      </Box>
    )
  } else if (loading) {
    return (
      <Flex justify="center" pt="6">
        <Spinner size="3" />
      </Flex>
    )
  } else {
    return (
      <Box px="4" pt="6" maxWidth="800px" mx="auto">
        <Flex align="center" mb="3" gap="2">
          <Spinner size="3"></Spinner>
          <Heading>Awaiting transaction</Heading>
        </Flex>
        <Callout.Root color="yellow">
          <Callout.Icon>
            <Icon path={mdiListStatus} size={1} />
          </Callout.Icon>
          <Callout.Text>
            <Flex direction="column" gap="2">
              <Text>1. If you have just submitted a transaction then it will appear here shortly.</Text>
              <Text>2. It could still be in the mempool of a different node, waiting to be broadcasted.</Text>
              <Text>3. When the network is busy it can take a while for your transaction to propagate through the network.</Text>
              <Text>4. If it still does not show up after 1 hour then this transaction either got dropped or was not sent.</Text>
            </Flex>
          </Callout.Text>
        </Callout.Root>
      </Box>
    )
  }
}