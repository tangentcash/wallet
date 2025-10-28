import { useNavigate, useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useState } from "react";
import { Box, Flex, Heading, Spinner } from "@radix-ui/themes";
import { AlertBox, AlertType } from "../components/alert";
import { EventResolver, RPC } from "tangentsdk";
import { AppData } from "../core/app";
import BigNumber from "bignumber.js";
import Transaction from "../components/transaction";

export default function TransactionPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();
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
      
      setData(result);
    } catch (exception) {
      setTimeout(() => AlertBox.open(AlertType.Error, 'Transaction not found: ' + (exception as Error).message), 200);
      navigate('/');
    }
  }, [params]);

  if (data != null) {
    const ownerAddress = AppData.getWalletAddress() || '';
    let rollupGasLimit = new BigNumber(0);
    if (data.state.receipts) {
      for (let hash in data.state.receipts)
        rollupGasLimit = rollupGasLimit.plus(data.state.receipts[hash].relativeGasUse);
    }
    return (
      <Box px="4" pt="4" mb="6" maxWidth="800px" mx="auto">
        <Heading size="6">Transaction</Heading>
        <Transaction ownerAddress={ownerAddress} transaction={data.transaction} receipt={data.receipt} state={data.state} open={true}></Transaction>
        {
          Array.isArray(data.transaction.transactions) && data.transaction.transactions.map((subtransaction: any, index: number) =>
            <Box mt="4" key={subtransaction.hash + index.toString()}>
              <Transaction ownerAddress={ownerAddress} preview={'Internal transaction #' + (index + 1).toString()} transaction={(() => ({
                ...subtransaction,
                gas_price: new BigNumber(0),
                gas_limit: rollupGasLimit.gt(0) ? rollupGasLimit : data.transaction.gas_limit
              }))()} receipt={(() => {
                const receipt = data.state.receipts[subtransaction.hash];
                return {
                  ...data.receipt,
                  relative_gas_use: receipt ? receipt.relativeGasUse : data.receipt.relative_gas_use,
                  relative_gas_paid: receipt ? receipt.relativeGasPaid : data.receipt.relative_gas_paid
                };
              })()} open={true}></Transaction>
            </Box>
          )
        }
      </Box>
    )
  } else {
    return (
      <Flex justify="center">
        <Spinner size="3" />
      </Flex>
    )
  }
}