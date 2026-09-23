import { Badge, Box, Button, Flex, Tooltip } from "@radix-ui/themes";
import { AssetId } from 'tangentsdk/algorithm';
import { UiUtil } from 'tangentsdk/ui';
import { SummaryState, EventType } from 'tangentsdk/rpc';
import { AlertBox, AlertType } from "./alert";
import { Link, useNavigate } from "react-router";
import { AppData } from "../core/app";
import { useMemo, useState } from "react";
import { mdiAccountCheckOutline, mdiAccountGroupOutline, mdiAccountKeyOutline, mdiAlertCircleOutline, mdiAlertOctagram, mdiArrowDownBold, mdiArrowLeftRight, mdiArrowUpBold, mdiBackupRestore, mdiBankTransfer, mdiBridge, mdiBroadcast, mdiCash, mdiChevronDown, mdiClockOutline, mdiCodeBraces, mdiCogOutline, mdiConsoleLine, mdiDatabaseOutline, mdiEyeOutline, mdiFingerprint, mdiKeyChange, mdiLayersTriple, mdiOpenInNew, mdiPackageVariant, mdiSafe, mdiSafeSquareOutline, mdiSync, mdiTimerOutline } from "@mdi/js";
import { AssetImage } from "./asset-image";
import * as Collapsible from "@radix-ui/react-collapsible";
import BigNumber from "bignumber.js";
import Icon from "@mdi/react";
import { secondsToDuration } from "../core/utils";
import type { ReceiptRecord, TxRecord } from "../core/types";

export function toTransactionLabel(transaction: any, type: string | null): string {
  switch (type) {
    case 'transfer':
      return transaction.to.length > 1 ? 'Batch transfer' : 'Transfer';
    case 'deploy':
      return 'Deploy contract';
    case 'call':
      return transaction.function != null ? UiUtil.toFunctionName(transaction.function) : 'Execute contract';
    case 'rollup':
      return 'Rollup' + (transaction.transactions?.length > 0 ? ' ' + transaction.transactions?.length + 'x' : '');
    case 'route':
      return transaction.routing_address ? 'Claim address' : 'Build vault';
    case 'bind':
      return 'New vault (legacy)';
    case 'imbind':
      return 'New vault';
    case 'rebind':
      return 'Renew vault';
    case 'setup':
      return 'Setup validator';
    case 'withdraw':
      return 'Build vault transfer';
    case 'broadcast':
      return 'Relay vault transfer';
    case 'anticast':
      return 'Reconcile vault transfer';
    case 'attestate':
      return 'Vault transfer';
    default:
      return 'Non-standard';
  }
}
export function toFlow(state: SummaryState | null | undefined, receipt: ReceiptRecord | null | undefined, transaction: TxRecord, ownerAddress: string): { deltas: { asset: AssetId, value: BigNumber, reserved?: boolean }[], direction: 'in' | 'out' | 'neutral' } {
  const deltas: { asset: AssetId, value: BigNumber, reserved?: boolean }[] = [];
  if (state && receipt) {
    if (ownerAddress.length > 0) {
      const balance = (state.account.balances || { })[ownerAddress] || { };
      Object.keys(balance).forEach((id) => {
        const item = balance[id];
        const reserve = item.reserve || new BigNumber(0);
        const value = (item.supply || new BigNumber(0)).minus(reserve);
        if (!value.eq(0))
          deltas.push({ asset: item.asset, value, reserved: !reserve.eq(0) });
      });
    } else {
      const totals: Record<string, { asset: AssetId, value: BigNumber }> = { };
      (state.events || []).forEach((event: any) => {
        const amount = event.type == EventType.TransferFee ? event.fee : event.value;
        if ((event.type == EventType.Transfer || event.type == EventType.TransferFee || event.type == EventType.BridgeTransfer) && amount && !amount.eq(0)) {
          const key = event.asset.id || event.asset.handle;
          if (!totals[key])
            totals[key] = { asset: event.asset, value: new BigNumber(0) };
          totals[key].value = totals[key].value.plus(amount.abs());
        }
      });
      Object.values(totals).forEach((item) => deltas.push(item));
    }
    deltas.sort((a, b) => (b.value.abs().comparedTo(a.value.abs()) ?? 0));
    if (deltas.length)
      return { deltas, direction: ownerAddress.length > 0 ? (deltas[0].value.gt(0) ? 'in' : 'out') : 'neutral' };
  }
  const type = UiUtil.toTransactionType(transaction.type ?? '');
  const incoming = (Array.isArray(transaction.to) && transaction.to.some((item) => item.to == ownerAddress)) && (receipt?.from || transaction.from) != ownerAddress;
  if (type == 'transfer' && Array.isArray(transaction.to)) {
    let total = new BigNumber(0);
    transaction.to.forEach((item) => { total = total.plus(item.value || new BigNumber(0)); });
    if (total.gt(0))
      deltas.push({ asset: new AssetId(transaction.asset.id), value: total.multipliedBy(incoming ? 1 : -1) });
  }
  if (!deltas.length)
    return { deltas, direction: 'neutral' };
  return { deltas, direction: deltas[0].value.gt(0) ? 'in' : 'out' };
}
function toIcon(type: string | null, direction: 'in' | 'out' | 'neutral', pending: boolean, reverted: boolean): { cls: string, path: string } {
  if (reverted)
    return { cls: '', path: mdiAlertCircleOutline };
  switch (type) {
    case 'deploy': return { cls: '', path: mdiPackageVariant };
    case 'call': return { cls: '', path: mdiConsoleLine };
    case 'rollup': return { cls: '', path: mdiLayersTriple };
    case 'route': return { cls: 'dex', path: mdiBridge };
    case 'bind': return { cls: 'dex', path: mdiSafeSquareOutline };
    case 'imbind': return { cls: 'dex', path: mdiSafe };
    case 'rebind': return { cls: 'dex', path: mdiKeyChange };
    case 'setup': return { cls: 'dex', path: mdiCogOutline };
    case 'withdraw': return { cls: 'dex', path: mdiBankTransfer };
    case 'broadcast': return { cls: 'dex', path: mdiBroadcast };
    case 'anticast': return { cls: 'dex', path: mdiBackupRestore };
    case 'attestate': return { cls: 'dex', path: mdiSync };
  }
  if (pending)
    return { cls: 'pending', path: mdiClockOutline };
  if (direction == 'in')
    return { cls: 'in', path: mdiArrowDownBold };
  if (direction == 'out')
    return { cls: 'out', path: mdiArrowUpBold };
  return { cls: '', path: mdiArrowUpBold };
}

function toRowDetail(transaction: any, receipt: any, type: string | null, direction: 'in' | 'out' | 'neutral', ownerAddress: string) {
  const addr = (value: string) => <span className="mono">{ UiUtil.toAddress(value, 6) }</span>;
  switch (type) {
    case 'transfer': {
      const list = Array.isArray(transaction.to) ? transaction.to : [];
      if (!list.length)
        return null;
      if (direction == 'in') {
        const from = receipt?.from || transaction.from;
        return from ? <>from { addr(from) }</> : null;
      }
      const target = list.find((item: any) => item.to != ownerAddress) || list[0];
      return <>to { addr(target.to) }{ list.length > 1 && <span className="dim">+{ list.length - 1 }</span> }</>;
    }
    case 'deploy':
      return transaction.callable ? addr(transaction.callable) : null;
    case 'call':
      return transaction.callable ? <>on { addr(transaction.callable) }</> : null;
    case 'rollup': {
      const first = transaction.transactions?.[0]?.action;
      return first ? <>{ toTransactionLabel(first, UiUtil.toTransactionType(first.type)) }{ transaction.transactions.length > 1 && <span className="dim">+{ transaction.transactions.length - 1 }</span> }</> : null;
    }
    case 'route':
      return transaction.routing_address ? <>address { addr(transaction.routing_address) }</> : (transaction.bridge_hash ? <>{ (transaction.asset?.chain ? transaction.asset.chain.toUpperCase() + ' ' : '') }vault { addr(transaction.bridge_hash) }</> : null);
    case 'bind':
    case 'imbind':
    case 'rebind':
    case 'broadcast': {
      const parent = type == 'rebind' ? transaction.setup_hash : (type == 'broadcast' ? transaction.withdraw_hash : transaction.route_hash);
      return parent ? <>parent { addr(parent) }</> : null;
    }
    case 'setup': {
      const effects = [
        transaction.block_production !== undefined && 'block production',
        transaction.bridge_participation !== undefined && 'vault participation',
        transaction.attestations != null && transaction.attestations.length > 0 && 'attestation stake',
        transaction.bridges != null && transaction.bridges.length > 0 && 'vault allocation',
        transaction.bridge_migrations != null && transaction.bridge_migrations.length > 0 && 'vault migration',
      ].filter(Boolean);
      return effects.length > 0 ? <>{ effects.join(' · ') }</> : null;
    }
    case 'withdraw':
      return transaction.address ? <>to { addr(transaction.address) }</> : null;
    case 'anticast':
      return transaction.broadcast_hash ? <>broadcast { addr(transaction.broadcast_hash) }</> : null;
    case 'attestate':
      return transaction.proof?.transaction_id ? addr(transaction.proof.transaction_id) : null;
    default:
      return null;
  }
}
export function TransactionInputFields(props: { transaction: any }) {
  const transaction = props.transaction;
  switch (transaction.type) {
    case 'transfer':
      return transaction.to.map((item: any, index: number) =>
        <EventRow key={'IF0' + item.to + index} icon={mdiArrowUpBold} cls="lime" title="Pay to account"
          meta={<EventAddress address={item.to} link={true} />}
          value={ moneyNamed(transaction.asset, new BigNumber(item.value).negated(), true) } />
      )
    case 'deploy': {
      const args = JSON.stringify(transaction.args);
      return (
        <div className="dl"><div className="dl-row"><span className="dl-k">Strategy</span>
        <span className="dl-v"><Badge color="yellow">Deploy from { transaction.from }</Badge></span></div>
        <div className="dl-row"><span className="dl-k">Program</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.callable);
          AlertBox.open(AlertType.Info, 'Address copied!')
        }}>{ UiUtil.toAddress(transaction.callable) }</span>
        <Link className="dl-open router-link" to={'/account/' + transaction.callable}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
        <div className="dl-row"><span className="dl-k">Source</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.data);
          AlertBox.open(AlertType.Info, 'Program calldata copied!')
        }}>{ UiUtil.toAddress(transaction.data) }</span></span></div>
        <div className="dl-row"><span className="dl-k">Calldata</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          const data: any = JSON.stringify(transaction.args, null, 2);
          navigator.clipboard.writeText(data);
          AlertBox.open(AlertType.Info, 'Program arguments copied!')
        }}>{ UiUtil.toAddress(args) }</span></span></div></div>
      )
    }
    case 'call': {
      const flags = UiUtil.toFunctionFlags(transaction.function);
      const origin = flags.pipelinePay ? transaction.function.substring(1) : transaction.function;
      const method = origin.match(/[\(\)]/) != null ? origin : ('address_of(@' + origin + ')');
      const args = JSON.stringify(transaction.args);
      return (
        <div className="dl"><div className="dl-row"><span className="dl-k">Program</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.callable);
          AlertBox.open(AlertType.Info, 'Address copied!')
        }}>{ UiUtil.toAddress(transaction.callable) }</span>
        <Link className="dl-open router-link" to={'/account/' + transaction.callable}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
        <div className="dl-row"><span className="dl-k">Callable</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(origin);
          AlertBox.open(AlertType.Info, 'Program function copied!')
        }}>{ UiUtil.toAddress(method, 20) }</span></span></div>
        <div className="dl-row"><span className="dl-k">Calldata</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(JSON.stringify(transaction.args, null, 2));
          AlertBox.open(AlertType.Info, 'Program arguments copied!')
        }}>{ UiUtil.toAddress(args, 20) }</span></span></div>
        {
          Array.isArray(transaction.pays) && transaction.pays.map((item: any) =>
            <div className="dl-row" key={item.asset.id}><span className="dl-k">Value paid</span>
            <span className="dl-v">{ moneyNamed(item.asset, item.value) }</span></div>)
        }
        <div className="dl-row"><span className="dl-k">Pay mode</span>
        <span className="dl-v"><Tooltip content={flags.pipelinePay ? 'Value is paid in fully or partially from account balance delta' : 'Value is paid in full account balance directly'}>
          <Badge>{ flags.pipelinePay ? 'Pipeline pays' : 'Account pays' }</Badge>
        </Tooltip></span></div></div>
      )
    }
    case 'rollup':
      return (
        <Box>
          <div className="card-title">Internal transactions</div>
          <div className="dl-group">{
            transaction.transactions.map((item: any, index: number) =>
              <div className="subtx-row" key={'IF1' + item.action.hash + index}>     
                <AssetImage asset={item.action.asset} size="1"></AssetImage>
                <Badge size="2" variant="soft">{ toTransactionLabel(item.action, UiUtil.toTransactionType(item.action.type)) }</Badge>
                <span className="copyable" onClick={() => {
                  navigator.clipboard.writeText(item.action.hash);
                  AlertBox.open(AlertType.Info, 'Internal transaction hash copied!')
                }}>{ UiUtil.toAddress(item.action.hash) }</span>
                <Link className="dl-open router-link" to={'/transaction/' + item.action.hash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></div>
            )
          }</div>
        </Box>
      )
    case 'route':
      return (
        <div className="dl">{
          transaction.pow_challenge &&
          <div className="dl-row"><span className="dl-k">Proof of work</span>
          <span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText((transaction.pow_challenge.block_hash || 'NULL') + ' + ' + transaction.pow_challenge.solution);
            AlertBox.open(AlertType.Info, 'Proof of work copied!')
          }}>{ UiUtil.toAddress(transaction.pow_challenge.block_hash.toString()) } / { UiUtil.toValue(null, transaction.pow_challenge.solution, false, false) }</span></span></div>
        }
        {
          transaction.ownership_challenge &&
          <div className="dl-row"><span className="dl-k">Proof of ownership</span>
          <span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText((transaction.ownership_challenge.public_key || 'NULL') + ' + ' + (transaction.ownership_challenge.signature || 'NULL'));
            AlertBox.open(AlertType.Info, 'Proof of ownership copied!')
          }}>{ UiUtil.toAddress(transaction.ownership_challenge.public_key, 4) } / { UiUtil.toAddress(transaction.ownership_challenge.signature, 4) }</span></span></div>
        }
        <div className="dl-row"><span className="dl-k">Vault hash</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.bridge_hash);
          AlertBox.open(AlertType.Info, 'Vault hash copied!')
        }}>{ UiUtil.toAddress(transaction.bridge_hash) }</span></span></div>
        <div className="dl-row"><span className="dl-k">Routing address</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.routing_address || 'NULL');
          AlertBox.open(AlertType.Info, 'Address copied!')
        }}>{ transaction.routing_address ? UiUtil.toAddress(transaction.routing_address) : 'NULL' }</span></span></div></div>
      )
    case 'bind':
      return (
        <div className="dl"><div className="dl-row"><span className="dl-k">Parent hash</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.route_hash);
          AlertBox.open(AlertType.Info, 'Transaction hash copied!')
        }}>{ UiUtil.toAddress(transaction.route_hash) }</span>
        <Link className="dl-open router-link" to={'/transaction/' + transaction.route_hash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
        <div className="dl-row"><span className="dl-k">Group public key</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.group_public_key || 'NULL');
          AlertBox.open(AlertType.Info, 'Group public key copied!')
        }}>{ UiUtil.toAddress(transaction.group_public_key) }</span></span></div>
        <div className="dl-row"><span className="dl-k">Group signature</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.group_signature || 'NULL');
          AlertBox.open(AlertType.Info, 'Group signature copied!')
        }}>{ UiUtil.toAddress(transaction.group_signature) }</span></span></div></div>
      )
    case 'imbind':
      return (
        <div className="dl"><div className="dl-row"><span className="dl-k">Parent hash</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.route_hash);
          AlertBox.open(AlertType.Info, 'Transaction hash copied!')
        }}>{ UiUtil.toAddress(transaction.route_hash) }</span>
        <Link className="dl-open router-link" to={'/transaction/' + transaction.route_hash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
        <div className="dl-row"><span className="dl-k">Correction key</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.correction_key || 'NULL');
          AlertBox.open(AlertType.Info, 'Correction key copied!')
        }}>{ UiUtil.toAddress(transaction.correction_key) }</span></span></div>
        <div className="dl-row"><span className="dl-k">Imperfect key</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.imperfect_key || 'NULL');
          AlertBox.open(AlertType.Info, 'Imperfect key copied!')
        }}>{ UiUtil.toAddress(transaction.imperfect_key) }</span></span></div>
        <div className="dl-row"><span className="dl-k">Correction commitment</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.correction_commitment || 'NULL');
          AlertBox.open(AlertType.Info, 'Correction commitment copied!')
        }}>{ UiUtil.toAddress(transaction.correction_commitment) }</span></span></div>
        <div className="dl-row"><span className="dl-k">Key commitment</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.key_commitment || 'NULL');
          AlertBox.open(AlertType.Info, 'Key commitment copied!')
        }}>{ UiUtil.toAddress(transaction.key_commitment) }</span></span></div></div>
      )
    case 'rebind':
      return (
        <>
          <div className="dl"><div className="dl-row"><span className="dl-k">Parent hash</span>
          <span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(transaction.setup_hash);
            AlertBox.open(AlertType.Info, 'Transaction hash copied!')
          }}>{ UiUtil.toAddress(transaction.setup_hash) }</span>
          <Link className="dl-open router-link" to={'/transaction/' + transaction.setup_hash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div></div>
          {
            transaction.proofs && transaction.proofs.map((item: any, index: number) =>
              <div className="dl-group" key={'IXF51' + item.correction_commitment + index}><div className="dl"><div className="dl-row"><span className="dl-k">Renewal index</span>
              <span className="dl-v">{ UiUtil.toValue(null, index, false, false) }</span></div>
              <div className="dl-row"><span className="dl-k">Correction key</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(item.correction_key || 'NULL');
                AlertBox.open(AlertType.Info, 'Correction key copied!')
              }}>{ UiUtil.toAddress(item.correction_key) }</span></span></div>
              <div className="dl-row"><span className="dl-k">Imperfect key</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(item.imperfect_key || 'NULL');
                AlertBox.open(AlertType.Info, 'Imperfect key copied!')
              }}>{ UiUtil.toAddress(item.imperfect_key) }</span></span></div>
              <div className="dl-row"><span className="dl-k">Correction commitment</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(item.correction_commitment || 'NULL');
                AlertBox.open(AlertType.Info, 'Correction commitment copied!')
              }}>{ UiUtil.toAddress(item.correction_commitment) }</span></span></div>
              <div className="dl-row"><span className="dl-k">Key commitment</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(item.key_commitment || 'NULL');
                AlertBox.open(AlertType.Info, 'Key commitment copied!')
              }}>{ UiUtil.toAddress(item.key_commitment) }</span></span></div></div></div>
            )
          }
        </>
      )
    case 'setup':
      return (
        <>
          <div className="dl"><div className="dl-row"><span className="dl-k">Side effects on</span>
          <span className="dl-v"><Flex gap="2" wrap="wrap">
            { transaction.block_production !== undefined && <Badge size="1" color="amber">Block production</Badge> }
            { transaction.bridge_participation !== undefined && <Badge size="1" color="amber">Vault participation</Badge> }
            { transaction.attestations != null && transaction.attestations.length > 0 && <Badge size="1" color="amber">Vault attestation</Badge> }
            { transaction.bridges != null && transaction.bridges.length > 0 && <Badge size="1" color="amber">Vault allocation</Badge> }
            { transaction.bridge_migrations != null && transaction.bridge_migrations.length > 0 && <Badge size="1" color="amber">Vault migration</Badge> }
          </Flex></span></div>
          {
            transaction.block_production !== undefined &&
            <div className="dl-row"><span className="dl-k">Block production</span>
            <span className="dl-v"><Badge color={ typeof transaction.block_production == 'object' ? undefined : 'red' }>{ typeof transaction.block_production == 'object' ? 'Online with ' + UiUtil.toMoney(new AssetId(), transaction.block_production) + ' locked' : 'Offline' }</Badge></span></div>
          }
          {
            transaction.bridge_participation !== undefined &&
            <div className="dl-row"><span className="dl-k">Vault participation</span>
            <span className="dl-v"><Badge color={ typeof transaction.bridge_participation == 'object' ? undefined : 'red' }>{ typeof transaction.bridge_participation == 'object' ? 'Online with ' + UiUtil.toMoney(new AssetId(), transaction.bridge_participation) + ' locked' : 'Offline' }</Badge></span></div>
          }</div>
          {
            transaction.attestations != null && transaction.attestations.map((item: any) => 
              <div className="dl-group" key={'IF3' + item.asset.chain}><div className="dl"><div className="dl-row"><span className="dl-k">{ item.asset.chain } attestation stake</span>
              <span className="dl-v"><Badge color={ item.stake != null ? undefined : 'red' }>{ item.stake != null ? 'Online with ' + UiUtil.toMoney(new AssetId(), item.stake) : 'Offline' }</Badge></span></div>
              {
                item.min_fee != null &&
                <div className="dl-row"><span className="dl-k">Min fee</span>
                <span className="dl-v">{ moneyNamed(item.asset, item.min_fee) }</span></div>
              }</div></div>
            )
          }
          {
            transaction.bridges != null && transaction.bridges.map((item: any) => 
              <div className="dl-group" key={'IF113' + item.asset.chain}><div className="dl"><div className="dl-row"><span className="dl-k">Security level</span>
              <span className="dl-v">Requires { UiUtil.toCount('participant', item.security_level) }</span></div>
              <div className="dl-row"><span className="dl-k">Fee rate</span>
              <span className="dl-v">{ moneyNamed(item.asset, item.fee_rate) }</span></div></div></div>
            )
          }
          {
            transaction.bridge_migrations != null && transaction.bridge_migrations.map((item: any, index: number) =>
              <div className="dl-group" key={'IF7' + item.broadcast_hash + index}><div className="dl"><div className="dl-row"><span className="dl-k">Reasoning transaction hash</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(item.broadcast_hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ UiUtil.toAddress(item.broadcast_hash) }</span>
              <Link className="dl-open router-link" to={'/transaction/' + item.broadcast_hash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
              <div className="dl-row"><span className="dl-k">Participant account</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(item.participant);
                AlertBox.open(AlertType.Info, 'Address copied!')
              }}>{ UiUtil.toAddress(item.participant) }</span></span></div></div></div>
            )
          }
        </>
      )
    case 'withdraw':
      return (
        <div className="dl">
          <div className="dl-row"><span className="dl-k">Vault hash</span>
          <span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(transaction.bridge_hash);
            AlertBox.open(AlertType.Info, 'Vault hash copied!')
          }}>{ UiUtil.toAddress(transaction.bridge_hash) }</span></span></div>
          <div className="dl-row"><span className="dl-k">Address</span>
          <span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(transaction.address);
            AlertBox.open(AlertType.Info, 'Address copied!')
          }}>{ UiUtil.toAddress(transaction.address) }</span></span></div>
          <div className="dl-row"><span className="dl-k">Value</span>
          <span className="dl-v">{ moneyNamed(transaction.asset, transaction.value) }</span></div>
        </div>
      )
    case 'broadcast':
      return (
        <div className="dl"><div className="dl-row"><span className="dl-k">Parent hash</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.withdraw_hash);
          AlertBox.open(AlertType.Info, 'Transaction hash copied!')
        }}>{ UiUtil.toAddress(transaction.withdraw_hash) }</span>
        <Link className="dl-open router-link" to={'/transaction/' + transaction.withdraw_hash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
        {
          transaction.hashdata && transaction.calldata && transaction.prepared &&
          <>
            <div className="dl-row"><span className="dl-k">Transaction id</span>
            <span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(transaction.hashdata);
              AlertBox.open(AlertType.Info, 'Transaction hash copied!')
            }}>{ UiUtil.toAddress(transaction.hashdata) }</span></span></div>
            <div className="dl-row"><span className="dl-k">Proof message</span>
            <span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(JSON.stringify({
                internal: transaction.prepared,
                transaction_hash: transaction.hashdata,
                transaction_data: transaction.calldata,
                locktime: transaction.locktime
              }, null, 2));
              AlertBox.open(AlertType.Info, 'ABI data copied!')
            }}>Copy ABI data</span></span></div>
          </>
        }
        {
          transaction.error &&
          <div className="dl-row"><span className="dl-k">Relay message</span>
          <span className="dl-v"><div className="err-pre"><Box px="1" py="1">FAILED { transaction.error }</Box></div></span></div>
        }</div>
      )
    case 'anticast':
      return (
        <div className="dl"><div className="dl-row"><span className="dl-k">Broadcast hash</span>
        <span className="dl-v"><span className="copyable" onClick={() => {
          navigator.clipboard.writeText(transaction.broadcast_hash);
          AlertBox.open(AlertType.Info, 'Transaction hash copied!')
        }}>{ UiUtil.toAddress(transaction.broadcast_hash) }</span>
        <Link className="dl-open router-link" to={'/transaction/' + transaction.broadcast_hash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
        {
          transaction.attestate_hash &&
          <div className="dl-row"><span className="dl-k">Attestate hash</span>
          <span className="dl-v"><span className="copyable" onClick={() => {
            navigator.clipboard.writeText(transaction.attestate_hash);
            AlertBox.open(AlertType.Info, 'Transaction hash copied!')
          }}>{ UiUtil.toAddress(transaction.attestate_hash) }</span>
          <Link className="dl-open router-link" to={'/transaction/' + transaction.attestate_hash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
        }</div>
      )
    case 'attestate': {
      let signatures = 0;
      const commitments = Object.keys(transaction.commitments).length;
      for (let commitment in transaction.commitments)
        signatures += transaction.commitments[commitment].length;

      if (transaction.proof != null) {
        const from = transaction.proof.inputs.map((item: any) => {
          return [{
            address: item.link.address || item.link.public_key || item.link.owner,
            asset: item.asset || transaction.asset,
            value: item.value
          }, ...item.tokens.map((token: any) => {
            return {
              address: item.link.address || item.link.public_key || item.link.owner,
              asset: token.asset ? token.asset : AssetId.fromHandle(transaction.asset.chain, token.symbol, token.contract_address),
              value: token.value
            };
          })]
        }).flat();
        const to = transaction.proof.outputs.map((item: any) => {
          return [{
            address: item.link.address || item.link.public_key || item.link.owner,
            asset: item.asset || transaction.asset,
            value: item.value
          }, ...item.tokens.map((token: any) => {
            return {
              address: item.link.address || item.link.public_key || item.link.owner,
              asset: token.asset ? token.asset : AssetId.fromHandle(transaction.asset.chain, token.symbol, token.contract_address),
              value: token.value
            };
          })]
        }).flat();
        return (
          <>
            <div className="dl">
              <div className="dl-row"><span className="dl-k">Block id</span>
              <span className="dl-v">{ transaction.proof.block_id?.toString() || 'NULL' }</span></div>
              <div className="dl-row"><span className="dl-k">Transaction id</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(transaction.proof.transaction_id);
                AlertBox.open(AlertType.Info, 'Transaction id copied!')
              }}>{ UiUtil.toAddress(transaction.proof.transaction_id) }</span></span></div>
              {
                transaction.proof.memo &&
                <div className="dl-row"><span className="dl-k">Memo account</span>
                <span className="dl-v"><span className="copyable" onClick={() => {
                  navigator.clipboard.writeText(transaction.proof.memo);
                  AlertBox.open(AlertType.Info, 'Memo account copied!')
                }}>{ UiUtil.toAddress(transaction.proof.memo) }</span>
                <Link className="dl-open router-link" to={'/account/' + transaction.proof.memo}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span></div>
              }
              <div className="dl-row"><span className="dl-k">Attestations</span>
              <span className="dl-v"><Badge mr="1">{ UiUtil.toCount('commitment', commitments) }</Badge>
              <Badge>{ UiUtil.toCount('signature', signatures) }</Badge></span></div>
              <div className="dl-row"><span className="dl-k">Finality</span>
              <span className="dl-v"><Badge color={transaction.proof.success ? undefined : 'red'}>{ transaction.proof.success ? 'Executed' : 'Reverted' }</Badge></span></div>
            </div>
            {
              from.filter((item: any) => !new BigNumber(item.value).isZero()).map((item: any, index: number) =>
                <EventRow key={'IF5' + item.address + index} icon={mdiArrowUpBold} cls="lime" title="Balance change"
                  meta={<EventAddress address={item.address} link={false} />}
                  value={ moneyNamed(item.asset, new BigNumber(item.value).negated(), true) } />
              )
            }
            {
              to.filter((item: any) => !new BigNumber(item.value).isZero()).map((item: any, index: number) =>
                <EventRow key={'IF6' + item.address + index} icon={mdiArrowDownBold} cls="lime" title="Balance change"
                  meta={<EventAddress address={item.address} link={false} />}
                  value={ moneyNamed(item.asset, new BigNumber(item.value), true) } />
              )
            }
          </>
        )
      } else {
        return (
          <div className="dl"><div className="dl-row"><span className="dl-k">Finality</span>
          <span className="dl-v"><Badge>{ UiUtil.toCount('signature', signatures) } in { UiUtil.toCount('commitment', commitments) }</Badge></span></div></div>
        )
      }
    }
    default:
      return <div className="tiny dim">No additional input fields</div>
  }
}
function copyValue(text: string, message: string) {
  navigator.clipboard.writeText(text);
  AlertBox.open(AlertType.Info, message);
}
function EventAddress(props: { address: string, link?: boolean }) {
  return <span className="event-who">
    <span className="event-addr" onClick={() => copyValue(props.address, 'Address copied!')}>{ UiUtil.toAddress(props.address, 6) }</span>
    { props.link !== false && <Link className="dl-open router-link" to={'/account/' + props.address}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link> }
  </span>
}
function EventHash(props: { hash: string, message: string }) {
  return <span className="event-addr" onClick={() => copyValue(props.hash, props.message)}>{ UiUtil.toAddress(props.hash) }</span>
}
function EventRow(props: { icon: string, cls?: string, title: string, badge?: any, meta?: any, value?: any }) {
  return (
    <div className="dl-group">
      <div className="event-row">
        <span className={'event-ico ' + (props.cls || '')}><Icon path={props.icon} size={0.9}></Icon></span>
        <div className="event-main">
          <div className="event-text">
            <div className="event-title">{ props.title }{ props.badge }</div>
            { props.meta != null && <div className="event-meta">{ props.meta }</div> }
          </div>
          { props.value != null && <div className="event-value">{ props.value }</div> }
        </div>
      </div>
    </div>
  )
}
function moneyNamed(asset: AssetId, value: BigNumber, signed?: boolean): string {
  const money = UiUtil.toMoney(asset, value, signed);
  const chain = String(asset.chain || '').toUpperCase();
  const at = money.lastIndexOf(' ');
  if (at < 0 || !chain || money.slice(at + 1).toUpperCase() === chain)
    return money;
  return money.slice(0, at) + ' ' + chain + ' ' + money.slice(at + 1);
}
function HeroMoney(props: { asset: AssetId, value: BigNumber, size: number, chain?: boolean, reserved?: boolean }) {
  const incoming = props.value.gt(0);
  const money = UiUtil.toMoney(props.asset, props.value.abs());
  const at = money.indexOf(' ');
  const unit = at > 0 ? money.slice(at + 1) : '';
  const issuer = String(props.asset.chain || '').toUpperCase();
  const ticker = props.chain && issuer && issuer !== unit.toUpperCase() ? issuer + ' ' + unit : unit;
  return (
    <div className="hero-num" style={{ fontSize: props.size, color: props.reserved ? 'var(--warn)' : (incoming ? 'var(--up)' : 'var(--down)') }}>
      { incoming ? '+' : '−' }{ at > 0 ? money.slice(0, at) : money }{ at > 0 && <span style={{ fontSize: '0.5em', color: 'var(--text-2)' }}> { ticker }</span> }
    </div>
  )
}
export function TransactionOutputFields(props: { state: SummaryState }) {
  const state = props.state;
  return (
    <>
      {
        state.events.map((event, index) => {
          switch (event.type) {
            case EventType.Error: {
              return <EventRow key={'OF0' + event.type.toString() + index} icon={mdiAlertCircleOutline} cls="err" title="Execution error" meta={ event.message?.toString() || 'NULL' } />
            }
            case EventType.Transfer: {
              return <EventRow key={'OF1' + event.type.toString() + index} icon={mdiArrowLeftRight} cls="lime" title="Transfer"
                meta={<><EventAddress address={event.from} /><span className="arrow">→</span><EventAddress address={event.to} /></>}
                value={ moneyNamed(event.asset, event.value, true) } />
            }
            case EventType.TransferIsolated: {
              return <EventRow key={'OF2' + event.type.toString() + index} icon={mdiPackageVariant} cls="lime" title="Supply transfer"
                meta={<EventAddress address={event.owner} />}
                value={<>
                  { !event.supply.eq(0) && moneyNamed(event.asset, event.supply, true) }
                  { !event.reserve.eq(0) && <span className="sub">{ event.reserve.gte(0) ? 'Lock' : 'Unlock' } { moneyNamed(event.asset, event.reserve.abs(), true) }</span> }
                  { event.supply.eq(0) && event.reserve.eq(0) && '—' }
                </>} />
            }
            case EventType.TransferFee: {
              return <EventRow key={'OF3' + event.type.toString() + index} icon={mdiCash} cls="lime" title="Fee transfer"
                meta={<EventAddress address={event.owner} />}
                value={ moneyNamed(event.asset, event.fee, true) } />
            }
            case EventType.BridgePolicy: {
              return <EventRow key={'OF117' + event.type.toString() + index} icon={mdiCogOutline} cls="warn" title="Vault policy"
                meta={<EventHash hash={event.bridgeHash} message="Vault hash copied!" />} />
            }
            case EventType.BridgeTransaction: {
              return <EventRow key={'OF744' + event.type.toString() + index} icon={mdiBridge} cls="warn" title="Vault transaction"
                meta={<><EventHash hash={event.bridgeHash} message="Vault hash copied!" /><span className="arrow">·</span><span className="dim">nonce</span><EventHash hash={'0x' + event.nonce.toString(16)} message="Transaction nonce copied!" /></>} />
            }
            case EventType.BridgeAccount: {
              return <EventRow key={'OF742' + event.type.toString() + index} icon={mdiAccountKeyOutline} cls="warn" title="Vault account"
                meta={<><EventHash hash={event.bridgeHash} message="Vault hash copied!" /><span className="arrow">·</span><span className="dim">nonce</span><EventHash hash={'0x' + event.nonce.toString(16)} message="Account nonce copied!" /></>} />
            }
            case EventType.BridgeQueue: {
              return <EventRow key={'OF4113' + event.type.toString() + index} icon={mdiTimerOutline} cls="warn" title="Vault queue"
                meta={<EventHash hash={event.bridgeHash} message="Vault hash copied!" />}
                badge={<Badge color={event.size.gt(1) ? 'yellow' : 'green'} ml="1">{ event.size.gt(1) ? 'Executes after ' + UiUtil.toCount('transaction', event.size) : 'Executes immediately' }</Badge>} />
            }
            case EventType.BridgeTransfer: {
              return <EventRow key={'OF4' + event.type.toString() + index} icon={mdiBankTransfer} cls="warn" title="Vault transfer"
                meta={<EventHash hash={event.bridgeHash} message="Bridge hash copied!" />}
                value={ moneyNamed(event.asset, event.value, true) } />
            }
            case EventType.BridgeAttester: {
              return <EventRow key={'OF8' + event.type.toString() + index} icon={mdiAccountCheckOutline} cls="warn" title="Vault attester"
                meta={<><span className="dim">chosen</span><EventAddress address={event.owner} /></>} />
            }
            case EventType.BridgeParticipant: {
              return <EventRow key={'OF811' + event.type.toString() + index} icon={mdiAccountGroupOutline} cls="warn" title="Vault participant"
                meta={<><span className="dim">chosen</span><EventAddress address={event.owner} /></>} />
            }
            case EventType.WitnessAccount: {
              return <EventRow key={'OF9' + event.type.toString() + index} icon={mdiEyeOutline} cls="info" title="Witness account"
                badge={<Badge ml="1">{ event.purpose[0].toUpperCase() + event.purpose.substring(1) } account</Badge>}
                meta={event.addresses.map((item, index) =>
                  <span key={'OF10' + event.addresses[0] + event.asset.handle + item} className="event-addr" onClick={() => copyValue(item, 'Address copied!')}>{ 'v' + (event.addresses.length - index) + ' ' + UiUtil.toAddress(item, 6) }</span>
                )} />
            }
            case EventType.WitnessTransaction: {
              return <EventRow key={'OF11' + event.type.toString() + index} icon={mdiFingerprint} cls="info" title="Witness transaction"
                meta={<><span className="dim">{ event.asset.chain }</span><EventHash hash={event.stateHash} message="State hash copied!" /></>} />
            }
            case EventType.RollupReceipt: {
              return <EventRow key={'OF12' + event.type.toString() + index} icon={mdiDatabaseOutline} cls="info" title="Rollup receipt"
                meta={<><span className="event-who"><EventHash hash={event.transactionHash} message="Transaction hash copied!" /><Link className="dl-open router-link" to={'/transaction/' + event.transactionHash}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link></span><span className="arrow">·</span><span className="dim">#{ event.executionIndex.toString() } · { UiUtil.toGas(event.relativeGasUse) }</span></>} />
            }
            case EventType.Unknown:
            default: {
              let copy = event as { type: EventType.Unknown; event: BigNumber; args: any[]; }
              return <EventRow key={'OF13' + event.type.toString() + index} icon={mdiCodeBraces} cls="err"
                title={'0x' + copy.event.toString(16)}
                badge={<Badge color="yellow" ml="1">Non-standard</Badge>}
                meta={copy.args != null && <div className="err-pre" style={{ textAlign: 'left' }}>{ JSON.stringify(copy.args, null, 1) }</div>} />
            }
          }
        })
      }
    </>
  )
}
function TransactionDetails(props: { transaction: any, receipt?: any, state?: SummaryState | null, preview?: string | boolean }) {
  const navigate = useNavigate();
  const transaction = props.transaction;
  const receipt = props.receipt || null;
  const state = props.state || null;
  const pending = receipt == null;
  const reverted = !pending && (!receipt.successful || !!transaction.error || (transaction.proof != null && !transaction.proof.success));
  const isDeploy = UiUtil.toTransactionType(transaction.type ?? '') == 'deploy';
  const blockDelta = !pending && receipt.block_number != null && AppData.tip != null ? AppData.tip.minus(receipt.block_number) : null;
  const gasLimit = transaction.gas_limit != null ? new BigNumber(transaction.gas_limit) : null;
  const gasUse = !pending && receipt.relative_gas_use != null ? new BigNumber(receipt.relative_gas_use) : null;
  const gasPercent = gasLimit != null && gasUse != null && gasLimit.gt(0) ? gasUse.div(gasLimit).toNumber() * 100 : null;
  return (
    <Box>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Brief</div>
        <div className="dl">
          {
            props.preview &&
            <div className="dl-row"><span className="dl-k">Hash</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(transaction.hash);
                AlertBox.open(AlertType.Info, 'Transaction hash copied!')
              }}>{ UiUtil.toAddress(transaction.hash, 8) }</span></span></div>
          }
          <div className="dl-row"><span className="dl-k">Status</span>
            <span className="dl-v">{
              props.preview ? <span className="badge warn">PREVIEW</span> :
              pending ? <span className="badge warn">IN MEMPOOL</span> :
              reverted ? <span className="badge err">REVERTED</span> :
              <span className="badge ok">FINALIZED{ blockDelta != null ? ' · ' + UiUtil.toCount('block', blockDelta.plus(1)) : '' }</span>
            }</span></div>
          {
            transaction.signature != null &&
            <div className="dl-row"><span className="dl-k">Signature</span>
              <span className="dl-v"><span className="copyable" onClick={() => {
                navigator.clipboard.writeText(transaction.signature);
                AlertBox.open(AlertType.Info, 'Transaction signature copied!')
              }}>{ UiUtil.toAddress(transaction.signature, 8) }</span></span></div>
          }
          <div className="dl-row"><span className="dl-k">Signer</span>
            <span className="dl-v"><span className="copyable" onClick={() => {
              navigator.clipboard.writeText(receipt?.from || transaction.from || '');
              AlertBox.open(AlertType.Info, 'Address copied!')
            }}>{ UiUtil.toAddress(receipt?.from || transaction.from || 'NULL') }</span>
            {
              (receipt?.from || transaction.from) != null &&
              <Link className="dl-open router-link" to={'/account/' + (receipt?.from || transaction.from)}><Icon path={mdiOpenInNew} size={0.6}></Icon></Link>
            }</span></div>
          {
            !pending &&
            <>
              <div className="dl-row"><span className="dl-k">Block</span>
                <span className="dl-v num">
                  <Link className="router-link" style={{ color: 'var(--info)' }} to={'/block/' + receipt.block_number.toString()}>#{ receipt.block_number.toString() }</Link>
                </span></div>
              <div className="dl-row"><span className="dl-k">Timestamp</span>
                <span className="dl-v num">{ receipt.block_time != null ? new Date(receipt.block_time.toNumber()).toLocaleString() : '—' }</span></div>
            </>
          }
          <div className="dl-row"><span className="dl-k">Nonce</span><span className="dl-v mono">0x{ transaction.nonce?.toString(16) }</span></div>
          <div className="dl-row"><span className="dl-k">Gas price</span><span className="dl-v num">{ transaction.gas_price != null ? UiUtil.toMoney(AssetId.fromHandle(transaction.asset?.chain), transaction.gas_price) : '0.0 TAN' }</span></div>
          <div className="dl-row"><span className="dl-k">Gas limit</span><span className="dl-v num">{ gasLimit != null ? UiUtil.toGas(gasLimit) : '—' }</span></div>
          <div className="dl-row">
            <span className="dl-k">Gas use</span>
            <span className="dl-v num">{ gasUse != null ? UiUtil.toGas(gasUse) + ' · ' + (gasPercent != null ? gasPercent.toFixed(2) + '%' : '') : <span className="dim">not executed yet</span> }</span>
          </div>
          {
            gasPercent != null &&
            <div className="meter" style={{ marginTop: 0 }}><div style={{ width: Math.min(100, gasPercent) + '%' }}></div></div>
          }
          <div className="dl-row">
            <span className="dl-k">Fee</span>
            <span className="dl-v num">{ gasUse != null && transaction.gas_price != null ? UiUtil.toMoney(AssetId.fromHandle(transaction.asset?.chain), gasUse.multipliedBy(transaction.gas_price)) : '0.0 TAN' }</span>
          </div>
          {
            transaction.memo != null && transaction.memo !== '' &&
            <div className="dl-row"><span className="dl-k">Memo</span><span className="dl-v">{ typeof transaction.memo == 'string' ? transaction.memo : JSON.stringify(transaction.memo) }</span></div>
          }
          {
            transaction.expiry != null &&
            <div className="dl-row"><span className="dl-k">Expiry</span><span className="dl-v num">{ transaction.expiry.toString() }</span></div>
          }
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">{ isDeploy ? 'Program' : 'Contract' }</div>
        <TransactionInputFields transaction={transaction}></TransactionInputFields>
        {
          isDeploy && transaction.callable != null &&
          <Button className="btn-brand btn-block" style={{ marginTop: 14 }} onClick={() => navigate('/program/' + transaction.callable)}>Open program</Button>
        }
      </div>
      {
        state != null && state.events.length > 0 &&
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">Events <span className="badge info">{ state.events.length }</span></div>
          <TransactionOutputFields state={state}></TransactionOutputFields>
        </div>
      }
    </Box>
  )
}
export function TransactionView(props: { variant?: 'row' | 'full', ownerAddress: string, transaction: any, receipt?: any, state?: SummaryState, explorerMode?: boolean, preview?: string | boolean, open?: boolean }) {
  const transaction = props.transaction;
  const receipt = props.receipt || null;
  const state = props.state || null;
  const pending = receipt == null;
  const reverted = !pending && (!receipt.successful || !!transaction.error || (transaction.proof != null && !transaction.proof.success));
  const type = UiUtil.toTransactionType(transaction.type ?? '');
  const label = toTransactionLabel(transaction, type);
  const flow = useMemo(() => toFlow(state, receipt, transaction, props.ownerAddress), [state, receipt, transaction, props.ownerAddress]);
  const deltaClash = useMemo(() => {
    const symbols = flow.deltas.map((d) => String(UiUtil.toMoney(d.asset, 0)).split(' ').pop());
    return flow.deltas.some((d, i) => flow.deltas.some((e, j) => j > i && d.asset.chain !== e.asset.chain && symbols[i] === symbols[j]));
  }, [flow]);
  const [expanded, setExpanded] = useState(props.open || false);
  if (!props.preview && !pending && (!AppData.tip || receipt.block_number.gt(AppData.tip)))
    AppData.tip = receipt.block_number;
  const primary = flow.deltas[0] || null;
  const time = pending ? 'just now' : secondsToDuration(Math.max(0, Math.round((Date.now() - (receipt.block_time ? receipt.block_time.toNumber() : Date.now())) / 1000)), true) + ' ago';
  if (props.variant == 'row') {
    const icon = toIcon(type, flow.direction, props.preview ? true : pending, reverted);
    const detail = toRowDetail(transaction, receipt, type, flow.direction, props.ownerAddress);
    const row = (
      <div className={'tx-row' + (props.preview ? ' tx-row-clickable' : '')}>
        <span className={'tx-ico ' + icon.cls}><Icon path={icon.path} size={1} /></span>
        <div className="tx-main">
          <div className="tx-title">{ label }</div>
          {
            props.preview ? (
              <div className="tx-meta">
                <span className="badge warn">PREVIEW</span>
                <span>{ typeof props.preview == 'string' ? props.preview : 'not broadcast yet' }</span>
              </div>
            ) : props.explorerMode ? (
              <div className="tx-meta mono" style={{ fontSize: 11 }}>{ UiUtil.toAddress(transaction.hash) }</div>
            ) : (
              <div className="tx-meta">
                <span>{ time }</span>
                { detail && <span className="tx-detail">· {detail}</span> }
                { pending ? <span className="badge warn">IN MEMPOOL</span> : (reverted ? <span className="badge err">REVERTED</span> : null) }
              </div>
            )
          }
          {
            props.explorerMode && flow.deltas.length > 0 &&
            <div className="tx-flow">
              { flow.deltas.slice(0, 2).map((delta, index) => <span key={index} className={index > 0 ? 'fa' : undefined}>{ UiUtil.toMoney(delta.asset, delta.value.abs()).replace('-', '') }</span>) }
              { flow.deltas.length > 2 && <span className="more">+ { flow.deltas.length - 2 } more asset{ flow.deltas.length - 2 > 1 ? 's' : '' }</span> }
            </div>
          }
        </div>
        {
          props.explorerMode ? (
            <div className="tx-time num">{ time }</div>
          ) : (
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              {
                reverted ?
                <span className="tx-failed" title="Transaction reverted"><Icon path={mdiAlertOctagram} size={1.1} /></span> :
                <div className="tx-amt">
                  {
                    flow.deltas.length > 0 ?
                    flow.deltas.map((delta, index) =>
                      <span key={index} className={delta.reserved ? 'warn' : (delta.value.gt(0) ? 'up' : 'down')}>{ (delta.value.gt(0) ? '+' : '−') + UiUtil.toMoney(delta.asset, delta.value.abs()).replace('-', '') }</span>
                    ) :
                    <span className="dim">—</span>
                  }
                </div>
              }
              {
                props.preview &&
                <Icon path={mdiChevronDown} size={0.55} style={{ flex: 'none', color: 'var(--text-2)', transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }}></Icon>
              }
            </div>
          )
        }
      </div>
    );
    if (props.preview) {
      return (
        <Collapsible.Root open={expanded}>
          <div className="card" style={{ padding: '4px 18px' }} onClick={() => setExpanded(!expanded)}>{ row }</div>
          <Collapsible.Content>
            <div style={{ paddingBottom: 16 }}>
              <TransactionDetails transaction={transaction} receipt={receipt} state={state} preview={props.preview}></TransactionDetails>
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      )
    }
    return <Link to={'/transaction/' + transaction.hash} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>{ row }</Link>
  }
  const hero = toIcon(type, flow.direction, pending, reverted);
  const gasLimit = transaction.gas_limit != null ? new BigNumber(transaction.gas_limit) : null;
  const events = state?.events || [];
  return (
    <Box>
      <div className="card" style={{ textAlign: 'center', padding: '26px 18px' }}>
        <span className={'tx-ico ' + hero.cls} style={{ width: 52, height: 52, margin: '0 auto 12px' }}>
          <Icon path={hero.path} size={1.5}></Icon>
        </span>
        {
          type == 'deploy' ? (
            <div className="hero-num" style={{ fontSize: 22 }}>Program live</div>
          ) : flow.deltas.length > 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              { flow.deltas.map((delta, index) => <HeroMoney key={index} asset={delta.asset} value={delta.value} size={32} chain={deltaClash} reserved={delta.reserved} />) }
            </div>
          ) : primary ? (
            <HeroMoney asset={primary.asset} value={primary.value} size={38} reserved={primary.reserved} />
          ) : (
            <div className="hero-num" style={{ fontSize: 26 }}>{ reverted ? 'Reverted' : label }</div>
          )
        }
        <div className="tiny dim mono" style={{ marginTop: 6, overflowWrap: 'anywhere' }}>
          { pending ? 'awaiting inclusion' : (reverted ? 'no value moved' : (flow.deltas.length > 0 ? 'monetary' : 'nonmonetary')) + ' · ' + label.toLowerCase() }
          { !pending && !reverted && !primary && events.length > 0 && ' · events seen' }
        </div>
        <div className="tiny mono tx-hash" style={{ marginTop: 4, overflowWrap: 'anywhere' }} onClick={() => copyValue(transaction.hash, 'Transaction hash copied!')}>{ transaction.hash && UiUtil.toAddress(transaction.hash) }</div>
      </div>
      {
        reverted &&
        <div className="callout err" style={{ marginTop: 14 }}>
          <Icon path={mdiAlertCircleOutline} size={1}></Icon>
          <span><b>{ label } reverted.</b> No value moved{ gasLimit != null ? '; the gas you set (' + UiUtil.toGas(gasLimit) + ') was the ceiling, not a charge' : '' }.</span>
        </div>
      }
      <TransactionDetails transaction={transaction} receipt={receipt} state={state}></TransactionDetails>
    </Box>
  )
}