import { useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useState } from "react";
import { Box, Callout, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { EventResolver, RPC } from "tangentsdk";
import { AppData } from "../core/app";
import { mdiListStatus, mdiProgressQuestion } from "@mdi/js";
import Transaction from "../components/transaction";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

export default function TransactionPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffectAsync(async () => {
    try {
      if (!params.id)
        throw false;

      let result = null;
      try {
        result = await RPC.getTransactionByHash(params.id, 2);
        if (!result)
          throw false;
      } catch {
        result = await RPC.getMempoolTransactionByHash(params.id);
        if (!result)
          throw false;
      }
      
      if (!result.transaction) {
        result = { transaction: result };
      } else {
        result.state = EventResolver.calculateSummaryState(result.receipt?.events);
      }
      
      if (!AppData.tip)
        await AppData.sync();

      setData(result);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [params]);

  if (data != null) {
    const ownerAddress = AppData.getWalletAddress() || '';
    let rollupGasLimit = new BigNumber(0);
    if (data.state != null && data.state.receipts) {
      for (let hash in data.state.receipts) {
        rollupGasLimit = rollupGasLimit.plus(data.state.receipts[hash].relativeGasUse);
      }
    }
    return (
      <Box px="4" pt="4" mb="6" maxWidth="800px" mx="auto">
        <Heading size="6">Transaction</Heading>
        <Transaction ownerAddress={ownerAddress} transaction={data.transaction} receipt={data.receipt} state={data.state} open={true}></Transaction>
        {
          Array.isArray(data.transaction.transactions) && data.transaction.transactions.map((subtransaction: any, index: number) =>
            <Box mt="4" key={subtransaction.action.hash + index.toString()}>
              <Transaction ownerAddress={ownerAddress} preview={'Internal transaction #' + (index + 1).toString()} transaction={(() => ({
                ...subtransaction.action,
                gas_price: new BigNumber(0),
                gas_limit: rollupGasLimit.gt(0) ? rollupGasLimit : data.transaction.gas_limit
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
          <Icon path={mdiProgressQuestion} size={1.1} />
          <Heading>Transaction not found</Heading>
        </Flex>
        <Callout.Root color="yellow">
          <Callout.Icon>
            <Icon path={mdiListStatus} size={1} />
          </Callout.Icon>
          <Callout.Text>
            <Flex direction="column" gap="2">
              <Text>1. If you have just submitted a transaction please wait for at least 30 seconds before refreshing this page.</Text>
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