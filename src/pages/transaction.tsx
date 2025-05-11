import { useNavigate, useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useState } from "react";
import { Box, Button, Flex, Heading, Spinner } from "@radix-ui/themes";
import { mdiBackburger } from "@mdi/js";
import { AlertBox, AlertType } from "../components/alert";
import { EventResolver, RPC } from "tangentsdk";
import { AppData } from "../core/app";
import Transaction from "../components/transaction";
import Icon from "@mdi/react";

export default function TransactionPage() {
  const id = useParams().id;
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();
  useEffectAsync(async () => {
    try {
      if (!id)
        throw false;

      let result = null;
      try {
        result = await RPC.getTransactionByHash(id, 2);
        if (!result)
          throw false;
      } catch {
        result = await RPC.getMempoolTransactionByHash(id);
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
  }, []);

  if (data != null) {
    return (
      <Box px="4" pt="4" mb="6">
        <Flex justify="between" align="center">
          <Heading size="6">Transaction</Heading>
          <Button variant="soft" size="2" color="indigo" onClick={() => navigate(-1)}>
            <Icon path={mdiBackburger} size={0.7} /> BACK
          </Button>
        </Flex>
        <Transaction ownerAddress={AppData.getWalletAddress() || ''} transaction={data.transaction} receipt={data.receipt} state={data.state} open={true}></Transaction>
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