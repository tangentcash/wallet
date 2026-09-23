import { useNavigate, useParams } from "react-router";
import { useEffectAsync } from "../core/react";
import { useCallback, useEffect, useState } from "react";
import { Box, Button, IconButton } from "@radix-ui/themes";
import { Stream } from "tangentsdk/serialization";
import { EventResolver, RPC } from "tangentsdk/rpc";
import { UiUtil } from "tangentsdk/ui";
import { Chain } from "tangentsdk/algorithm";
import { AppData } from "../core/app";
import { mdiAlertCircleOutline, mdiArrowLeftBoldCircleOutline } from "@mdi/js";
import { TransactionView } from "../components/transaction";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";

export default function TransactionPage() {
  const params = useParams();
  const navigate = useNavigate();
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
    const ownerAddress = AppData.getWalletAddress() || '';
    const headStatus = targets.length == 1 ? (() => {
      const { transaction, receipt } = targets[0];
      if (receipt == null) return <span className="badge warn">IN MEMPOOL</span>;
      if (!receipt.successful || !!transaction.error || (transaction.proof != null && !transaction.proof.success)) return <span className="badge err">REVERTED</span>;
      const delta = receipt.block_number != null && AppData.tip != null ? AppData.tip.minus(receipt.block_number) : null;
      return delta == null ? <span className="badge ok">FINALIZED</span> : <span className={'badge ' + (delta.plus(1).gt(2) ? 'ok' : 'warn')}>{ UiUtil.toCount('confirmation', delta.plus(1)).toUpperCase() }</span>;
    })() : null;
    return (
      <Box pt="4" pb="8" maxWidth="680px" mx="auto">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconButton variant="ghost" size="3" color="gray" aria-label="Back" onClick={() => navigate(-1)}>
              <Icon path={mdiArrowLeftBoldCircleOutline} size={1.2}></Icon>
            </IconButton>
            <div className="page-title" style={{ fontSize: 20 }}>{ targets.length > 1 ? 'Group of transactions' : 'Transaction' }</div>
          </div>
        { headStatus }
        </div>
        {
          targets.map((data, index) => (
            <Box key={data.transaction.hash} mt={index > 0 ? '6' : undefined}>
              <TransactionView variant="full" ownerAddress={ownerAddress} transaction={data.transaction} receipt={data.receipt} state={data.state}></TransactionView>
              {
                Array.isArray(data.transaction.transactions) && data.transaction.transactions.map((subtransaction: any, subIndex: number) =>
                  <Box mt="5" key={subtransaction.action.hash + subIndex.toString()}>
                    <div className="card-title" style={{ marginBottom: 10 }}>Transaction { subIndex + 2 } of { data.transaction.transactions.length + 1 }</div>
                    <TransactionView variant="full" ownerAddress={ownerAddress} transaction={subtransaction.action} receipt={subtransaction.receipt} state={EventResolver.calculateSummaryState(subtransaction.receipt?.events)}></TransactionView>
                  </Box>
                )
              }
            </Box>
          ))
        }
      </Box>
    )
  } else if (loading) {
    return (
      <Box pt="4" maxWidth="680px" mx="auto">
        <div className="card">
          <div className="skel" style={{ height: 120 }}></div>
          <div className="skel" style={{ height: 200, marginTop: 14 }}></div>
        </div>
      </Box>
    )
  } else {
    return (
      <Box pt="4" pb="8" maxWidth="680px" mx="auto">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div className="page-title" style={{ fontSize: 20 }}>Transaction</div>
          <span className="badge err">NOT FOUND</span>
        </div>
        <div className="callout err">
          <Icon path={mdiAlertCircleOutline} size={1}></Icon>
          <span><b>{ UiUtil.toAddress(params.id || '') }</b> isn't on this network.</span>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="tiny dim" style={{ lineHeight: 1.7 }}>
            1. The hash may be mistyped or from a different network.<br></br>
            2. The transaction might not have been broadcast yet.<br></br>
            3. The node may still be synchronizing this block.<br></br>
            4. Cross-chain transactions show up only after confirmed finality on the source chain.<br></br>
            5. If it still does not show up after 1 hour then this transaction either got dropped or was not sent.
          </div>
        </div>
        <Button className="btn-soft btn-block" style={{ marginTop: 12 }} onClick={() => navigate('/explorer')}>Back to explorer</Button>
      </Box>
    )
  }
}
