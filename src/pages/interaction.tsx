import { mdiCodeJson, mdiMinus, mdiPlus } from "@mdi/js";
import { Avatar, Badge, Box, Button, Card, Checkbox, Dialog, DropdownMenu, Flex, Heading, IconButton, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEffectAsync } from "../core/react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { AlertBox, AlertType } from "../components/alert";
import { AssetId, ByteUtil, Chain, Ledger, RPC, Signing, TextUtil, TransactionOutput, Transactions, Uint256, Readability, Hashsig, Pubkeyhash, Pubkey, Seckey, SummaryState, EventResolver } from "tangentsdk";
import { AppData } from "../core/app";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";
import Transaction from "../components/transaction";

export class ProgramTransfer {
  to: { address: string, value: string }[] = [];
}

export class ProgramSetup {
  assets: { asset: AssetId, policy: string }[] = []
  blockProduction: 'standby' | 'enable' | 'disable' = 'standby';
  blockProductionStake: string = '';
  bridgeParticipation: 'standby' | 'enable' | 'disable' = 'standby';
  bridgeParticipationStake: string = '';
  migrations: {
    broadcastHash: string,
    participant: string
  }[] = [];
  attestations: {
    asset: AssetId,
    stake: string | null,
    incomingFee: string,
    outgoingFee: string,
    participationThreshold: string,
    securityLevel: string,
    acceptsAccountRequests: number,
    acceptsWithdrawalRequests: number
  }[] = [];
  attestationReservations: Set<string> = new Set<string>();
}

export class ProgramRoute {
  routing: { chain: string, policy: string }[] = [];
  routingAddress: string = '';
}

export class ProgramWithdraw {
  routing: { chain: string, policy: string }[] = [];
  toAddress: string = '';
  toValue: string = '';
  onlyIfNotInQueue: boolean = true;
}

export class ProgramWithdrawAndMigrate {
  routing: { chain: string, policy: string }[] = [];
  onlyIfNotInQueue: boolean = true;
}

export class ProgramAnticast {
    broadcastHash: string = '';
}

export class ApproveTransaction {
  hexMessage: string = '';
  transaction: any = null;
  type: number | null = null;
  typename: string | null = null;
  instruction: Uint8Array | null = null;
}

function toSimpleTransaction(input: any): Record<string, any> {
  let output: Record<string, any> = { };
  for (let key in input) {
    const value = input[key];
    if (value instanceof Hashsig || value instanceof Pubkey || value instanceof Seckey)
      output[key] = ByteUtil.uint8ArrayToHexString(value.data);
    else if (value instanceof Pubkeyhash)
      output[key] = Signing.encodeAddress(value);
    else if (value instanceof Uint8Array)
      output[key] = ByteUtil.uint8ArrayToHexString(value);
    else if (value instanceof Uint256 || BigNumber.isBigNumber(value))
      output[key] = value.toString();
    else if (typeof value == 'object' || Array.isArray(value))
      output[key] = toSimpleTransaction(value);
    else
      output[key] = value;
  }
  return output;
}

export default function InteractionPage() {
  const location = useLocation();
  const ownerAddress = AppData.getWalletAddress() || '';
  const [query] = useSearchParams();
  const params = {
    type: query.get('type'),
    asset: query.get('asset'),
    manager: query.get('manager'),
    transaction: query.get('transaction')
  };
  const [assets, setAssets] = useState<any[]>([]);
  const [asset, setAsset] = useState(-1);
  const [nonce, setNonce] = useState<BigNumber | null>();
  const [simulation, setSimulation] = useState<{ receipt: any, state: SummaryState } | null>(null);
  const [gasPrice, setGasPrice] = useState('');
  const [gasLimit, setGasLimit] = useState('');
  const [loadingTransaction, setLoadingTransaction] = useState(false);
  const [loadingGasPriceAndPrice, setLoadingGasPriceAndPrice] = useState(false);
  const [transactionData, setTransactionData] = useState<TransactionOutput | null>(null);
  const [program, setProgram] = useState<ProgramTransfer | ProgramSetup | ProgramRoute | ProgramWithdraw | ProgramWithdrawAndMigrate | ProgramAnticast | ApproveTransaction | null>(null);
  const navigate = useNavigate();
  const gasAsset = useMemo((): AssetId | null => {
    if (asset == -1)
      return null;

    const transactionAsset = assets[asset];
    return new AssetId(transactionAsset.asset.chain);
  }, [assets, asset]);
  const maxFeeValue = useMemo((): BigNumber => {
    try {
      const price = new BigNumber(gasPrice.trim());
      if (!price.gte(0))
        return new BigNumber(0);
      
      const limit = new BigNumber(gasLimit.trim());
      if (!limit.gt(0) || !limit.isInteger())
        return new BigNumber(0);

      return price.multipliedBy(limit);
    } catch {
      return new BigNumber(0);
    }
  }, [gasPrice, gasLimit]);
  const omniTransaction = useMemo((): boolean => {
    if (asset == -1)
      return false;
    
    if (program instanceof ProgramTransfer) {
      return true;
    }
    else if (program instanceof ProgramWithdraw) {
      const blockchain = program.routing.find((item) => item.chain == assets[asset].asset.chain);
      return blockchain != null && blockchain.policy == 'utxo';
    }

    return false;
  }, [asset, program]);
  const transactionType = useMemo((): string => {
    if (program instanceof ProgramTransfer) {
      return program.to.length > 1 ? 'Send to many' : 'Send to one';
    } else if (program instanceof ProgramSetup) {
      return 'Validator setup';
    } else if (program instanceof ProgramRoute) {
        return 'Claim address';
    } else if (program instanceof ProgramWithdraw) {
      return 'Withdraw to address';
    } else if (program instanceof ProgramWithdrawAndMigrate) {
      return 'Migrate bridge';
    } else if (program instanceof ProgramAnticast) {
        return 'Protest bridge';
    } else if (program instanceof ApproveTransaction) {
      return 'Approve action';
    }
    return 'Bad program';
  }, [program]);
  const sendingValue = useMemo((): BigNumber => {
    if (program instanceof ProgramTransfer) {
      return program.to.reduce((value, next) => {
        try {
          const numeric = new BigNumber(next.value.trim());
          return numeric.isPositive() ? value.plus(numeric) : value;
        } catch {
          return value;
        }
      }, new BigNumber(0));
    } else if (program instanceof ProgramWithdraw) {
      try {
        const numeric = new BigNumber(program.toValue.trim());
        return numeric.isPositive() ? numeric : new BigNumber(0);
      } catch {
        return new BigNumber(0);
      }
    }
    return new BigNumber(0);
  }, [assets, program]);
  const programReady = useMemo((): boolean => {
    if (asset == -1)
      return false;

    if (program instanceof ProgramTransfer) {
      for (let i = 0; i < program.to.length; i++) {
        const payment = program.to[i];
        if (payment.address.trim() == ownerAddress)
          return false;
  
        const publicKeyHash = Signing.decodeAddress(payment.address.trim());
        if (!publicKeyHash || publicKeyHash.data.length != 20)
          return false;

        try {
          const numeric = new BigNumber(payment.value.trim());
          if (numeric.isNaN() || !numeric.isPositive())
            return false;
        } catch {
          return false;
        }
      }
  
      return sendingValue.gt(0) && sendingValue.lte(assets[asset].balance);
    } else if (program instanceof ProgramSetup) {
      const migrationReservations = new Set<string>();
      for (let i = 0; i < program.migrations.length; i++) {
        const migration = program.migrations[i];
        if (!migration.broadcastHash || !migration.participant)
          return false;

        try {
          const hash = new Uint256(migration.broadcastHash);
          if (!hash.gt(0))
            throw false;

          const id = hash.toHex();
          if (migrationReservations.has(id))
            throw false;

          migrationReservations.add(id);
        } catch {
          return false;
        }

        try {
          const participant = Signing.decodeAddress(migration.participant);
          if (!participant)
            throw false;
        } catch {
          return false;
        }
      }

      for (let i = 0; i < program.attestations.length; i++) {
        let item = program.attestations[i];
        try {
          if (typeof item.stake != 'string')
            continue;
          
          const numeric = new BigNumber(item.stake.trim());
          if (numeric.isNaN())
            return false;
          
          if (item.incomingFee.length > 0) {
            const numeric = new BigNumber(item.incomingFee.trim());
            if (numeric.isNaN() || numeric.isNegative())
              return false;
          }

          if (item.outgoingFee.length > 0) {
            const numeric = new BigNumber(item.outgoingFee.trim());
            if (numeric.isNaN() || numeric.isNegative())
              return false;
          }

          if (item.participationThreshold.length > 0) {
            const numeric = new BigNumber(item.participationThreshold.trim());
            if (numeric.isNaN() || numeric.isNegative())
              return false;
          }

          if (item.securityLevel.length > 0) {
            const numeric = new BigNumber(item.securityLevel.trim());
            if (numeric.isNaN() || numeric.isNegative() || numeric.integerValue().toString() != numeric.toString())
              return false;

            if (numeric.lt(Chain.policy.PARTICIPATION_COMMITTEE[0]) || numeric.gt(Chain.policy.PARTICIPATION_COMMITTEE[1]))
              return false;
          }

          if (item.acceptsAccountRequests != -1 && item.acceptsAccountRequests != 0 && item.acceptsAccountRequests != 1)
            return false;

          if (item.acceptsWithdrawalRequests != -1 && item.acceptsWithdrawalRequests != 0 && item.acceptsWithdrawalRequests != 1)
            return false;
        } catch {
          return false;
        }
      }

      if (program.blockProduction == 'enable') {
        try {
          const numeric = new BigNumber(program.blockProductionStake.trim());
          if (!numeric.gte(0))
            return false;
        } catch {
          return false;
        }
      }

      if (program.bridgeParticipation == 'enable') {
        try {
          const numeric = new BigNumber(program.bridgeParticipationStake.trim());
          if (!numeric.gte(0))
            return false;
        } catch {
          return false;
        }
      }

      return program.blockProduction != 'standby' || program.bridgeParticipation != 'standby' || program.attestations.length > 0 || program.migrations.length > 0;
    } else if (program instanceof ProgramRoute) {
      const routing = program.routing.find((item) => item.chain == assets[asset].asset.chain);
      if (routing?.policy == 'account' && !program.routingAddress.length)
        return false;

      if (params.manager == null)
        return false;
  
      return true;
    } else if (program instanceof ProgramWithdraw) {
      if (program.toAddress.trim() == ownerAddress)
        return false;

      const publicKeyHash = Signing.decodeAddress(program.toAddress.trim());
      if (publicKeyHash != null || !program.toAddress.length)
        return false;

      try {
        const numeric = new BigNumber(program.toValue.trim());
        if (numeric.isNaN() || !numeric.isPositive())
          return false;
      } catch {
        return false;
      }
      
      if (params.manager == null)
        return false;
  
      return sendingValue.gt(0) && sendingValue.lte(assets[asset].balance);
    } else if (program instanceof ProgramWithdrawAndMigrate) {
      return true;   
    } else if (program instanceof ProgramAnticast) {
      try {
        const hash = new Uint256(program.broadcastHash);
        if (!hash.gt(0))
          throw false;

        return true;
      } catch {
        return false;
      }
    } else if (program instanceof ApproveTransaction) {
      return program.hexMessage != null && program.transaction != null;
    }
    return false;
  }, [asset, gasPrice, gasLimit, assets, program]);
  const transactionReady = useMemo((): boolean => {
    if (!programReady)
      return false;

    try {
      const numeric = new BigNumber(gasPrice.trim());
      if (numeric.isNaN() || !numeric.gte(0))
        return false;
    } catch {
      return false;
    }
    
    try {
      const numeric = new BigNumber(gasLimit.trim());
      if (numeric.isNaN() || !numeric.gt(0) || !numeric.isInteger())
        return false;
    } catch {
      return false;
    }

    const gasAssetBalance = (gasAsset ? assets.find((v) => v.asset.id == gasAsset.id)?.balance : null) || new BigNumber(0);
    return maxFeeValue.plus(sendingValue).lte(gasAssetBalance);
  }, [programReady, gasPrice, gasLimit, gasAsset, maxFeeValue, sendingValue]);
  const readOnlyApproval = useMemo((): boolean => {
    return program != null && program instanceof ApproveTransaction && params.transaction != null;
  }, [program]);
  const setRemainingValue = useCallback((index: number) => {
    if (program instanceof ProgramTransfer) {
      const balance = assets[asset].balance;
      let value = balance.minus(sendingValue);
      try {
        const numeric = new BigNumber(program.to[index].value.trim());
        if (!numeric.isNaN() && numeric.isPositive())
          value = value.minus(numeric);
      } catch { }
      
      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
      copy.to[index].value = value.lt(0) ? '0' : value.toString();
      setProgram(copy);
    } else if (program instanceof ProgramWithdraw) {
      const balance = assets[asset].balance;
      let value = balance.minus(sendingValue);
      try {
        const numeric = new BigNumber(program.toValue);
        if (!numeric.isNaN() && numeric.isPositive())
          value = value.minus(numeric);
      } catch { }
      
      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
      copy.toValue = value.lt(0) ? '0' : value.toString();
      setProgram(copy);
    }
  }, [assets, asset, program]);
  const buildTransaction = useCallback(async (options?: { prebuilt?: TransactionOutput, gasPrice?: BigNumber, gasLimit?: BigNumber }): Promise<TransactionOutput | null> => {
    if (!programReady || loadingTransaction)
      return null;
    
    setLoadingTransaction(true);
    try {
      const buildProgram = async (method: { type: Ledger.Transaction | Ledger.Commitment | Ledger.Unknown, args: { [key: string]: any } }) => {
        const output = await AppData.buildWalletTransaction({
          asset: new AssetId(assets[asset].asset.id),
          nonce: options?.prebuilt ? options.prebuilt.body.nonce.toString() : (nonce || undefined),
          gasPrice: options?.gasPrice ? options.gasPrice : gasPrice,
          gasLimit: options?.gasLimit ? options.gasLimit : (options?.prebuilt ? options.prebuilt.body.gasLimit.toString() : gasLimit),
          method: method
        });
        setNonce(new BigNumber(output.body.nonce.toString()));
        setTransactionData(output);
        if (program instanceof ApproveTransaction)
          await decodeApprovableTransaction(output.data, true);
        setLoadingTransaction(false);
        return output;
      };
      if (program instanceof ProgramTransfer) {
        return await buildProgram(program.to.length > 1 ? {
          type: new Transactions.Transfer.Many(),
          args: {
            to: program.to.map((payment) => ({
              to: Signing.decodeAddress(payment.address || ''),
              value: new BigNumber(payment.value)
            }))
          }
        } : {
          type: new Transactions.Transfer.One(),
          args: {
            to: Signing.decodeAddress(program.to[0].address || ''),
            value: new BigNumber(program.to[0].value)
          }
        });
      } else if (program instanceof ProgramSetup) {
        return await buildProgram({
          type: new Transactions.Setup(),
          args: {
            hasProduction: program.blockProduction != 'standby',
            productionStake: program.blockProduction != 'standby' ? (program.blockProduction == 'enable' ? new BigNumber(program.blockProductionStake) : new BigNumber(NaN)) : undefined,
            hasParticipation: program.bridgeParticipation != 'standby',
            participationStake: program.bridgeParticipation != 'standby' ? (program.bridgeParticipation == 'enable' ? new BigNumber(program.bridgeParticipationStake) : new BigNumber(NaN)) : undefined,
            migrations: program.migrations.map((item) => ({
              broadcastHash: new Uint256(item.broadcastHash),
              participant: Signing.decodeAddress(item.participant)
            })).sort((a, b) => a.broadcastHash.compareTo(b.broadcastHash)),
            attestations: program.attestations.map((item) => ({
              asset: item.asset,
              stake: item.stake != null ? new BigNumber(item.stake) : new BigNumber(NaN),
              hasAcceptsAccountRequests: item.acceptsAccountRequests != -1,
              hasAcceptsWithdrawalRequests: item.acceptsWithdrawalRequests != -1,
              hasSecurityLevel: item.securityLevel.length > 0,
              hasIncomingFee: item.incomingFee.length > 0,
              hasOutgoingFee: item.outgoingFee.length > 0,
              hasParticipationThreshold: item.participationThreshold.length > 0,
              acceptsAccountRequests: item.acceptsAccountRequests != -1 ? item.acceptsAccountRequests > 0 : undefined,
              acceptsWithdrawalRequests: item.acceptsWithdrawalRequests != -1 ? item.acceptsWithdrawalRequests > 0 : undefined,
              securityLevel: item.securityLevel.length > 0 ? new Uint256(new BigNumber(item.securityLevel).toNumber()) : undefined,
              incomingFee: item.incomingFee.length > 0 ? new BigNumber(item.incomingFee) : undefined,
              outgoingFee: item.outgoingFee.length > 0 ? new BigNumber(item.outgoingFee) : undefined,
              participationThreshold: item.participationThreshold.length > 0 ? new BigNumber(item.participationThreshold) : undefined,
            })).sort((a, b) => a.asset.toUint256().compareTo(b.asset.toUint256()))
          }
        });
      } else if (program instanceof ProgramRoute) {
        let includeRoutingAddress = true;
        if (program.routingAddress.length > 0) {
          try {
            const accounts = await RPC.getWitnessAccount(ownerAddress, assets[asset].asset, program.routingAddress);
            includeRoutingAddress = !accounts || !accounts.length;
          } catch { }
        }
        return await buildProgram({
          type: new Transactions.Route(),
          args: {
            manager: Signing.decodeAddress(params.manager || ''),
            routingAddress: includeRoutingAddress ? program.routingAddress : ''
          }
        });
      } else if (program instanceof ProgramWithdraw) {
        return await buildProgram({
          type: new Transactions.Withdraw(),
          args: {
            onlyIfNotInQueue: program.onlyIfNotInQueue,
            manager: Signing.decodeAddress(params.manager || ''),
            toAddress: program.toAddress,
            toValue: new BigNumber(program.toValue)
          }
        });
      } else if (program instanceof ProgramWithdrawAndMigrate) {
        return await buildProgram({
          type: new Transactions.Withdraw(),
          args: {
            onlyIfNotInQueue: program.onlyIfNotInQueue,
            manager: Signing.decodeAddress(ownerAddress || ''),
            to: []
          }
        });
      } else if (program instanceof ProgramAnticast) {
        return await buildProgram({
          type: new Transactions.Anticast(),
          args: {
            broadcastHash: new Uint256(program.broadcastHash),
          }
        });
      } else if (program instanceof ApproveTransaction) {
        const type = new Ledger.Unknown();
        type.getType = (): number => program.type || 0;
        return await buildProgram({
          type: type,
          args: {
            typeless: program.instruction
          }
        });
      }
      
      throw new Error('bad program type');
    } catch (exception) {
      AlertBox.open(AlertType.Error, (exception as Error).message);
      setLoadingTransaction(false);
      return null;
    }
  }, [programReady, loadingTransaction, assets, asset, nonce, gasPrice, gasLimit, program]);
  const calculateTransactionGas = useCallback(async (percentile: number) => {
    if (loadingGasPriceAndPrice)
      return false;

    let presetGasPrice = new BigNumber(-1);
    if (gasPrice.length > 0) {
      try {
        const numeric = new BigNumber(gasPrice.trim());
        if (!numeric.isNaN() && numeric.gte(0))
          presetGasPrice = numeric;
      } catch { }
    }

    let presetGasLimit = new BigNumber(-1);
    if (gasLimit.length > 0) {
      try {
        const numeric = new BigNumber(gasLimit.trim());
        if (!numeric.isNaN() && numeric.gte(0))
          presetGasLimit = numeric;
      } catch { }
    }

    const loadingRequired = presetGasPrice.eq(-1) || presetGasLimit.eq(-1);
    setLoadingGasPriceAndPrice(loadingRequired);
    if (presetGasPrice.eq(-1)) {
      try {
        presetGasPrice = await RPC.getGasPrice(new AssetId(assets[asset].asset.id), percentile);
        presetGasPrice = presetGasPrice != null && BigNumber.isBigNumber(presetGasPrice) && presetGasPrice.gte(0) ? presetGasPrice : new BigNumber(0);
      } catch { }
    }

    if (presetGasLimit.eq(-1)) {
      try {
        const output = await buildTransaction({ gasPrice: presetGasPrice });
        if (!output)
          throw new Error('cannot build transaction');

        let receipt = await RPC.simulateTransaction(output.data);
        presetGasLimit = receipt ? typeof receipt.relative_gas_use == 'string' ? new BigNumber(receipt.relative_gas_use, 16) : (BigNumber.isBigNumber(receipt.relative_gas_use) ? receipt.relative_gas_use : new BigNumber(-1)) : new BigNumber(-1);
        if (presetGasLimit.lt(0)) {
          AlertBox.open(AlertType.Error, 'Cannot fetch transaction gas limit');
        } else if (receipt != null && receipt.events != null) {
          setSimulation({ receipt: receipt, state: EventResolver.calculateSummaryState(receipt.events) })
        }
      } catch (exception) {
        AlertBox.open(AlertType.Error, 'Cannot fetch transaction gas limit: ' + (exception as Error).message);
      }
    }
    
    try {
      if (presetGasPrice.gte(0) && presetGasLimit.gte(0)) {
        await buildTransaction({
          gasPrice: presetGasPrice,
          gasLimit: presetGasLimit
        });
      }
    } catch { }

    setGasPrice(presetGasPrice.gte(0) ? presetGasPrice.toString() : '');
    setGasLimit(presetGasLimit.gte(0) ? presetGasLimit.toString() : '');
    if (loadingRequired)
      setLoadingGasPriceAndPrice(false);
    return true;
  }, [loadingGasPriceAndPrice, programReady, transactionReady, loadingTransaction, gasPrice, gasLimit, nonce, assets, asset, program, buildTransaction]);
  const submitTransaction = useCallback(async () => {
    if (loadingTransaction)
      return false;

    const output = await buildTransaction();
    if (!output) {
      AlertBox.open(AlertType.Error, 'Cannot build transaction');
      return false;
    }

    setLoadingTransaction(true);
    try {
      const hash = await RPC.submitTransaction(output.data);
      if (hash != null) {
        AlertBox.open(AlertType.Info, 'Transaction ' + hash + ' sent!');
        if (AppData.approveTransaction) {
          AppData.approveTransaction({ hash: new Uint256(hash), message: ByteUtil.hexStringToUint8Array(output.data), signature: output.body.signature });
        }
        setNonce(null);
        setSimulation(null);
        setGasPrice('');
        setGasLimit('');
        setTransactionData(null);
        navigate(-1);
      } else {
        AlertBox.open(AlertType.Error, 'Failed to send transaction!');
      }  
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to send transaction: ' + (exception as Error).message);
    }
    setLoadingTransaction(false);
    return true;
  }, [loadingTransaction, transactionReady, loadingTransaction, nonce, assets, asset, program, buildTransaction]);
  const decodeApprovableTransaction = useCallback(async (data: string, applyOnlyIfSuccessful: boolean): Promise<void> => {
    const result = new ApproveTransaction();
    result.hexMessage = data;
    try {
      const body = AppData.decodeTransaction(data);
      const preview = await RPC.decodeTransaction(data);
      if (!preview || !preview.transaction)
        throw new Error('Failed to decode transaction');
      
      result.transaction = preview.transaction;
      result.type = body.type;
      result.typename = body.typename;
      result.instruction = body.instruction;
    } catch (exception: any) {
      AlertBox.open(AlertType.Error, exception.message);
    }
    if (!applyOnlyIfSuccessful || result.transaction != null)
      setProgram(result);
  }, []);
  useEffectAsync(async () => {
    if (!AppData.isWalletReady())
      return;
    
    let requiresAllAssets = false;
    switch (params.type) {
      case 'transfer':
      default: {
        const result = new ProgramTransfer();
        result.to = [{ address: '', value: '' }];
        setProgram(result);
       break; 
      }
      case 'approve': {
        if (params.transaction && params.transaction.length > 0)
          decodeApprovableTransaction(params.transaction, false);
        else
          setProgram(new ApproveTransaction());
        break;
      }
      case 'configure': {
        const result = new ProgramSetup();
        try { result.assets = ((await RPC.getBlockchains()) || []).map((v) => { return { asset: AssetId.fromHandle(v.chain), policy: v.token_policy as string }}); } catch { }
        setProgram(result);
        break;
      }
      case 'register': {
        const result = new ProgramRoute();
        try { result.routing = ((await RPC.getBlockchains()) || []).map((v) => { return { chain: v.chain, policy: v.routing_policy }}); } catch { }
        setProgram(result);
        break;
      }
      case 'withdraw': {
        const result = new ProgramWithdraw();
        try { result.routing = ((await RPC.getBlockchains()) || []).map((v) => { return { chain: v.chain, policy: v.routing_policy }}); } catch { }
        setProgram(result);
        break;
      }
      case 'protest': {
        setProgram(new ProgramAnticast());
        break;
      }
      case 'migrate': {
        requiresAllAssets = true;
        setProgram(new ProgramWithdrawAndMigrate());
        break;
      }
    }

    setSimulation(null);
    try {
      let assetData = await RPC.fetchAll((offset, count) => RPC.getAccountBalances(ownerAddress, offset, count));
      if (Array.isArray(assetData)) {
        assetData = assetData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
        assetData = assetData.filter((item) => item.balance?.gt(0) || item.reserve?.gt(0) || item.supply?.gt(0));
      } else {
        assetData = [];
      }

      if (requiresAllAssets) {
        const blockchains = await RPC.getBlockchains();
        if (blockchains != null) {
          for (let i = 0; i < blockchains.length; i++) {
            const additional = new AssetId(blockchains[i].id);
            if (assetData.findIndex((item) => item.asset.id == additional.id) == -1)
              assetData.push({ asset: additional, balance: new BigNumber(0), reserve: new BigNumber(0), supply: new BigNumber(0) });
          }
        }
      }

      const initial = { asset: new AssetId(), balance: new BigNumber(0), reserve: new BigNumber(0), supply: new BigNumber(0) }
      const target = params.asset != null ? { asset: new AssetId(params.asset), balance: new BigNumber(0), reserve: new BigNumber(0), supply: new BigNumber(0) } : null;
      if (assetData.findIndex((item) => item.asset.chain == initial.asset.chain) == -1) {
        assetData = [initial, ...assetData];
      }
      let assetIndex = target ? assetData.findIndex((item) => item.asset.id == target.asset.id) : -1;
      if (target && assetIndex == -1) {
        assetData = [...assetData, target];
        assetIndex = assetData.length - 1;
      }
      setAssets(assetData);
      setAsset(assetIndex);
    } catch { }
  }, [query]);
  useEffect(() => {
    return () => {
      if (AppData.approveTransaction) {
        AppData.approveTransaction(null);
      }
    }
  }, []);

  if (!AppData.isWalletReady()) {
    return <Navigate replace={true} to={`/restore?to=${encodeURIComponent(location.pathname + location.search)}`} state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="640px">
      <Heading>{ transactionType }</Heading>
      <Box width="100%" mt="3" mb="4">
        <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
      </Box>
      <Card>
        <Flex justify="between" align="center" mb="2" px="1">
          <Heading size="4">Paying account</Heading>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button variant="ghost" size="3" color="gray" disabled={readOnlyApproval}>⨎⨎</Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content side="left">
              <Tooltip content="Transfer/pay asset to one or more accounts">
                <DropdownMenu.Item onClick={() => navigate('/interaction?type=transfer')}>Transfer</DropdownMenu.Item>
              </Tooltip>
              <Tooltip content="Approve and submit transaction from unverified source">
                <DropdownMenu.Item onClick={() => navigate('/interaction?type=approve')}>Approve</DropdownMenu.Item>
              </Tooltip>
              <Tooltip content="Protest a withdrawal broadcast transaction to get a refund">
                <DropdownMenu.Item onClick={() => navigate('/interaction?type=protest')}>Protest</DropdownMenu.Item>
              </Tooltip>
              <DropdownMenu.Separator />
              <Tooltip content="For validator: change block production and/or participation/attestation stake(s)">
                <DropdownMenu.Item onClick={() => navigate('/interaction?type=configure')}>Setup</DropdownMenu.Item>
              </Tooltip>
              <Tooltip content="For validator: migrate bridge manager to another manager along with custodial funds (for attestation unstaking)">
                <DropdownMenu.Item onClick={() => navigate('/interaction?type=migrate')}>Migrate</DropdownMenu.Item>
              </Tooltip>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Flex>
        <Select.Root size="3" value={asset.toString()} onValueChange={(value) => setAsset(parseInt(value))}>
          <Select.Trigger variant="surface" placeholder="Select account" style={{ width: '100%' }} className={asset >= 0 || !assets.length ? undefined : 'shadow-rainbow-animation'}>
          </Select.Trigger>
          <Select.Content variant="soft">
            <Select.Group>
              <Select.Item value="-1" disabled={true}>Select account</Select.Item>
              {
                assets.map((item, index) =>
                  <Select.Item key={item.asset.id + '_select'} value={index.toString()}>
                    <Flex align="center" gap="1">
                      <Avatar mr="1" size="1" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} style={{ width: '24px', height: '24px' }} />
                      <Text size="4">{ Readability.toMoney(item.asset, item.balance) }{ item.asset.token ? ' on ' + item.asset.chain : '' }</Text>
                    </Flex>
                  </Select.Item>
                )
              }
            </Select.Group>
          </Select.Content>
        </Select.Root>
        {
          asset != -1 && params.manager != null &&
          <Box width="100%" mt="3">
            <Tooltip content="Bridge account that will process the withdrawal">
              <TextField.Root size="3" placeholder="Transaction manager account" type="text" color="red" value={Readability.toAddress(params.manager, 16)} readOnly={true} />
            </Tooltip>
          </Box>
        }
        {
          asset != -1 && (program instanceof ProgramWithdraw || program instanceof ProgramWithdrawAndMigrate) &&
          <Box width="100%" px="1" mt="3">
            <Tooltip content="If bridge is busy with another withdrawal then do not withdraw">
              <Text as="label" size="2" color={program.onlyIfNotInQueue ? 'jade' : 'orange'}>
                <Flex gap="2">
                  <Checkbox size="3" checked={program.onlyIfNotInQueue} onCheckedChange={(value) => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    copy.onlyIfNotInQueue = (value.valueOf() as boolean);
                    setProgram(copy);
                  }} />
                  <Text>Only if not in queue</Text>
                </Flex>
              </Text>
            </Tooltip>
          </Box>
        }
        {
          asset != -1 && (program instanceof ApproveTransaction) &&
          <Flex justify="between" mt="3" gap="1">
            <Box width="100%">
              <Tooltip content="Original approval transaction data (hex or binary)">
                <TextField.Root size="3" placeholder="Raw transaction data" type="text" value={Readability.toAddress(program.hexMessage, 16)} readOnly={true} />
              </Tooltip>
            </Box>
            <Button size="3" variant="surface" disabled={readOnlyApproval} onClick={async () => {
              try {
                const result = await AppData.openFile('');
                if (result != null) {
                  const data = ByteUtil.uint8ArrayToByteString(result);
                  await decodeApprovableTransaction(TextUtil.isHexEncoding(data) ? data : ByteUtil.uint8ArrayToHexString(result), false);
                }
              } catch { }
            }}>Browse</Button>
          </Flex>
        }
      </Card>
      {
        asset != -1 && program instanceof ProgramTransfer && program.to.map((item, index) =>
          <Card mt="4" key={index}>
            <Heading size="4" mb="2">Send to account{ program.to.length > 1 ? ' #' + (index + 1) : ''}</Heading>
            <Flex gap="2" mb="3">
              <Box width="100%">
                <Tooltip content="Send to account address">
                  <TextField.Root size="3" placeholder="Send to account" type="text" value={item.address} onChange={(e) => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    copy.to[index].address = e.target.value;
                    setProgram(copy);
                  }} />
                </Tooltip>
              </Box>
              {
                programReady &&
                <Button size="3" variant="outline" color="gray" disabled={!programReady}>
                  <Link className="router-link" to={'/account/' + item.address}>▒▒</Link>
                </Button>
              }
            </Flex>
            <Flex gap="2">
              <Box width="100%">
                <Tooltip content="Payment value received by account">
                  <TextField.Root mb="3" size="3" placeholder={'Payment value in ' + Readability.toAssetSymbol(assets[asset].asset)} type="number" value={item.value} onChange={(e) => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    copy.to[index].value = e.target.value;
                    setProgram(copy);
                  }} />
                </Tooltip>
              </Box>
              {
                omniTransaction &&
                <Flex justify="between" gap="1">
                  <Button size="3" variant="outline" color="gray" onClick={() => setRemainingValue(index) }>Remaining</Button>
                  <IconButton variant="soft" size="3" color={index != 0 ? 'red' : 'jade'} disabled={!omniTransaction && index == 0} onClick={() => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    if (index == 0) {
                      copy.to.push({ address: '', derivation: null, value: '' });
                    } else {
                      copy.to.splice(index, 1);
                    }
                    setProgram(copy);
                  }}>
                    <Icon path={index == 0 ? mdiPlus : mdiMinus} size={0.7} />
                  </IconButton>
                </Flex>
              }
              {
                !omniTransaction &&
                <Button size="3" variant="outline" color="gray" onClick={() => setRemainingValue(index) }>Remaining</Button>
              }
            </Flex>
          </Card>
        )
      }
      {
        asset != -1 && program instanceof ProgramSetup &&
        <Card mt="4">
          <Heading size="4" mb="2">Validation setup</Heading>
          <Select.Root size="3" value={program.blockProduction} onValueChange={(value) => {
            const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
            copy.blockProduction = value as any;
            copy.blockProductionStake = '';
            setProgram(copy);
          }}>
            <Select.Trigger variant="surface" placeholder="Select block production" style={{ width: '100%' }}>
            </Select.Trigger>
            <Select.Content color="gray">
              <Select.Item value="standby">Block production unchanged</Select.Item>
              <Select.Item value="enable">
                <Text color="jade">ENABLE</Text> block production
              </Select.Item>
              <Select.Item value="disable">
                <Text color="red">DISABLE</Text> block production
              </Select.Item>
            </Select.Content>
          </Select.Root>
          {
            program.blockProduction == 'enable' &&
            <Box width="100%" mt="4">
              <Tooltip content="Locking value to activate block production staking">
                <TextField.Root mb="3" size="3" placeholder={'Block production stake in ' + Readability.toAssetSymbol(new AssetId())} type="number" value={program.blockProductionStake} onChange={(e) => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  copy.blockProductionStake = e.target.value;
                  setProgram(copy);
                }} />
              </Tooltip>
            </Box>
          }
          <Box mt="4">
            <Select.Root size="3" value={program.bridgeParticipation} onValueChange={(value) => {
              const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
              copy.bridgeParticipation = value as any;
              copy.bridgeParticipationStake = '';
              setProgram(copy);
            }}>
              <Select.Trigger variant="surface" placeholder="Select bridge participation" style={{ width: '100%' }}>
              </Select.Trigger>
              <Select.Content color="gray">
                <Select.Item value="standby">Bridge participation unchanged</Select.Item>
                <Select.Item value="enable">
                  <Text color="jade">ENABLE</Text> bridge participation
                </Select.Item>
                <Select.Item value="disable">
                  <Text color="red">DISABLE</Text> bridge participation
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>
          {
            program.bridgeParticipation == 'enable' &&
            <Box width="100%" mt="4">
              <Tooltip content="Locking value to activate bridge participation staking">
                <TextField.Root mb="3" size="3" placeholder={'Bride participation stake in ' + Readability.toAssetSymbol(new AssetId())} type="number" value={program.bridgeParticipationStake} onChange={(e) => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  copy.bridgeParticipationStake = e.target.value;
                  setProgram(copy);
                }} />
              </Tooltip>
            </Box>
          }
          {
            program.attestations.map((item, index) =>
              <Box mt="4" key={index}>
                <Card>
                  <Heading size="4" mb="2">
                    <Flex align="center">
                      <Avatar mr="1" size="1" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} style={{ width: '24px', height: '24px' }} />
                      { item.asset.chain || '' } attestation
                    </Flex>
                  </Heading>
                  <Box width="100%">
                    <Tooltip content="Locking value to activate/increase bridge attestation staking">
                      <TextField.Root mb="3" size="3" placeholder={'Attestation stake in ' + Readability.toAssetSymbol(new AssetId())} type="number" value={item.stake || ''} disabled={item.stake == null} onChange={(e) => {
                        const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                        copy.attestations[index].stake = e.target.value;
                        setProgram(copy);
                      }} />
                    </Tooltip>
                  </Box>
                  <Box width="100%">
                    <Tooltip content="Fee charged for deposits (absolute value)">
                      <TextField.Root size="3" placeholder="Incoming absolute fee 0.0-∞" type="text" value={item.incomingFee} onChange={(e) => {
                        const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                        copy.attestations[index].incomingFee = e.target.value;
                        setProgram(copy);
                      }} />
                    </Tooltip>
                  </Box>
                  <Box width="100%" mt="3">
                    <Tooltip content="Fee charged for withdrawals (absolute value)">
                      <TextField.Root size="3" placeholder="Outgoing absolute fee 0.0-∞" type="text" value={item.outgoingFee} onChange={(e) => {
                        const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                        copy.attestations[index].outgoingFee = e.target.value;
                        setProgram(copy);
                      }} />
                    </Tooltip>
                  </Box>
                  <Box width="100%" mt="3">
                    <Tooltip content="Participant stacking required to be included in bridge account/transaction calculations (absolute value)">
                      <TextField.Root size="3" placeholder="Participation threshold 0.0-∞" type="text" value={item.participationThreshold} onChange={(e) => {
                        const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                        copy.attestations[index].participationThreshold = e.target.value;
                        setProgram(copy);
                      }} />
                    </Tooltip>
                  </Box>
                  <Box width="100%" mt="3">
                    <Tooltip content="Determines how many participants must be present to sign transactions">
                      <TextField.Root size="3" placeholder="Security level (5-21)" type="text" value={item.securityLevel} onChange={(e) => {
                        const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                        copy.attestations[index].securityLevel = e.target.value;
                        setProgram(copy);
                      }} />
                    </Tooltip>
                  </Box>
                  <Box width="100%" mt="3">
                    <Select.Root size="3" value={item.acceptsAccountRequests.toString()} onValueChange={(value) => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.attestations[index].acceptsAccountRequests = parseInt(value) || -1;
                      setProgram(copy);
                    }}>
                      <Select.Trigger variant="surface" placeholder="Select account policy" style={{ width: '100%' }}>
                      </Select.Trigger>
                      <Select.Content color="gray">
                        <Select.Item value="-1">Account policy unchanged</Select.Item>
                        <Select.Item value="1">
                          <Text color="jade">ENABLE</Text> account creation
                        </Select.Item>
                        <Select.Item value="0">
                          <Text color="red">DISABLE</Text> account creation
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Box>
                  <Box width="100%" mt="3">
                    <Select.Root size="3" value={item.acceptsWithdrawalRequests.toString()} onValueChange={(value) => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.attestations[index].acceptsWithdrawalRequests = parseInt(value) || -1;
                      setProgram(copy);
                    }}>
                      <Select.Trigger variant="surface" placeholder="Select withdrawal policy" style={{ width: '100%' }}>
                      </Select.Trigger>
                      <Select.Content color="gray">
                        <Select.Item value="-1">Withdrawal policy unchanged</Select.Item>
                        <Select.Item value="1">
                          <Text color="jade">ENABLE</Text> withdrawals
                        </Select.Item>
                        <Select.Item value="0">
                          <Text color="red">DISABLE</Text> withdrawals
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Box>
                  <Box width="100%" mt="3">
                    <Flex align="center" justify="between">
                      <Button variant="soft" color="red" onClick={() => {
                        const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                        copy.attestationReservations.delete(item.asset.chain || '');
                        copy.attestations.splice(index, 1);
                        setProgram(copy);
                      }}>Cancel changes</Button>
                      <Tooltip content="Unlock stake">
                        <Text as="label" size="2" color={item.stake != null ? 'jade' : 'red'}>
                          <Flex gap="2" justify="end">
                            <Checkbox size="3" checked={item.stake == null} onCheckedChange={(value) => {
                              const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                              copy.attestations[index].stake = value ? null : '';
                              setProgram(copy);
                            }} />
                            <Text>Unlock stake</Text>
                          </Flex>
                        </Text>
                      </Tooltip>
                    </Flex>
                  </Box>
                </Card>
              </Box>
            )
          }
          {
            program.attestations.length > 0 && 
            <Box width="100%" mt="3" mb="4">
              <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
            </Box>
          }
          <Box mt="4">
            <Select.Root size="3" onValueChange={(value) => {
              const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
              copy.attestations.push({
                asset: AssetId.fromHandle(value),
                stake: '',
                incomingFee: '',
                outgoingFee: '',
                participationThreshold: '',
                securityLevel: '',
                acceptsAccountRequests: -1,
                acceptsWithdrawalRequests: -1
              });
              copy.attestationReservations.add(copy.attestations[copy.attestations.length - 1].asset.chain || '');
              setProgram(copy);
            }}>
              <Select.Trigger variant="surface" placeholder="Change bridge attestation stake" style={{ width: '100%' }}>
              </Select.Trigger>
              <Select.Content variant="soft">
                <Select.Group>
                  <Select.Item value="0" disabled={true}>Select attestation blockchain</Select.Item>
                  {
                    program.assets.map((item) =>
                      <Select.Item key={item.asset.chain + '_select'} value={item.asset.chain || ''} disabled={program.attestationReservations.has(item.asset.chain || '')}>
                        <Flex align="center" gap="1">
                          <Avatar mr="1" size="1" radius="full" fallback={Readability.toAssetFallback(item.asset)} src={Readability.toAssetImage(item.asset)} style={{ width: '24px', height: '24px' }} />
                          <Text size="4">{ item.asset.chain || '' } attestation update</Text>
                        </Flex>
                      </Select.Item>
                    )
                  }
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Box>
          {
            program.migrations.map((item, index) =>
              <Box mt="4" key={index}>
                <Card>
                  <Heading size="4" mb="2">Participant migration{ program.migrations.length > 1 ? ' #' + (index + 1) : ''}</Heading>
                  <Box width="100%">
                    <Tooltip content="Transaction hash of broadcast transaction that has off-chain relay fault and was initiated by this validator">
                      <TextField.Root mb="3" size="3" placeholder={'Failed transaction hash'} type="text" value={item.broadcastHash || ''} onChange={(e) => {
                        const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                        copy.migrations[index].broadcastHash = e.target.value;
                        setProgram(copy);
                      }} />
                    </Tooltip>
                  </Box>
                  <Flex mt="3" gap="2">
                    <Box width="100%">
                      <Tooltip content="Account address of participant that must be replaced (migrated) by new randomly chosen participant">
                        <TextField.Root mb="3" size="3" placeholder={'Participant to replace'} type="text" value={item.participant || ''} onChange={(e) => {
                          const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                          copy.migrations[index].participant = e.target.value;
                          setProgram(copy);
                        }} />
                      </Tooltip>
                    </Box>
                    <IconButton variant="soft" size="3" color="jade" onClick={() => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.migrations.splice(index, 1);
                      setProgram(copy);
                    }}>
                      <Icon path={mdiMinus} size={0.7} />
                    </IconButton>
                  </Flex>
                </Card>
              </Box>
            )
          }
          <Box mt="4" width="100%">
            <Button variant="surface" color="gray" size="2" style={{ width: '100%', height: 'auto', justifyContent: 'start' }} onClick={() => {
              const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
              copy.migrations.push({ transactionHash: '', participant: '' });
              setProgram(copy);
            }}>
              <Box px="2" py="2">
                <Text size="3">Migrate bridge participant</Text>
              </Box>
            </Button>
          </Box>
        </Card>
      }
      {
        asset != -1 && program instanceof ProgramRoute &&
        <Card mt="4">
          <Heading size="4" mb="2">{program.routing.find((item) => item.chain == assets[asset].asset.chain)?.policy == 'account' ? 'Sender' : 'Routing'} wallet address</Heading>
          <Box width="100%">
            <Tooltip content={'Register ' + assets[asset].asset.chain + ' wallet address that you own to ' + (program.routing.find((item) => item.chain == assets[asset].asset.chain)?.policy == 'account' ? 'deposit assets from or ' : '') + 'withdraw assets to'}>
              <TextField.Root size="3" placeholder={assets[asset].asset.chain + " routing address"} type="text" value={program.routingAddress} onChange={(e) => {
                const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                copy.routingAddress = e.target.value;
                setProgram(copy);
              }} />
            </Tooltip>
          </Box>
        </Card>
      }
      {
        asset != -1 && program instanceof ProgramWithdraw &&  
        <Card mt="4">
          <Heading size="4" mb="2">Withdrawal destination</Heading>
          <Box width="100%" mb="3">
            <Tooltip content="Withdraw to off-chain address">
              <TextField.Root size="3" placeholder="Withdraw to address" type="text" value={program.toAddress} onChange={(e) => {
                const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                copy.toAddress = e.target.value;
                setProgram(copy);
              }} />
            </Tooltip>
          </Box>
          <Flex gap="2">
            <Box width="100%">
              <Tooltip content="Payment value received by account">
                <TextField.Root mb="3" size="3" placeholder={'Payment value in ' + Readability.toAssetSymbol(assets[asset].asset)} type="number" value={program.toValue} onChange={(e) => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  copy.toValue = e.target.value;
                  setProgram(copy);
                }} />
              </Tooltip>
            </Box>
            <Button size="3" variant="outline" color="gray" onClick={() => setRemainingValue(0) }>Remaining</Button>
          </Flex>
        </Card>
      }
      {
        asset != -1 && program instanceof ProgramAnticast &&
        <Card mt="4">
          <Heading size="4" mb="2">Bridge broadcast transaction hash</Heading>
          <Box width="100%">
            <Tooltip content="Transaction hash of broadcast transaction that has off-chain relay success but no off-chain withdrawal received">
              <TextField.Root size="3" placeholder={'Successful transaction hash'} type="text" value={program.broadcastHash || ''} onChange={(e) => {
                const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                copy.broadcastHash = e.target.value;
                setProgram(copy);
              }} />
            </Tooltip>
          </Box>
        </Card>
      }
      {
        (program instanceof ApproveTransaction) && program.transaction != null &&
        <Box>
          <Transaction ownerAddress={ownerAddress} transaction={program.transaction} receipt={simulation?.receipt || undefined} state={simulation?.state || undefined} preview={true}></Transaction>
          {
            Array.isArray(program.transaction.transactions) && program.transaction.transactions.map((subtransaction: any, index: number) =>
              <Box mt="4" key={subtransaction.hash + index.toString()}>
                <Transaction ownerAddress={ownerAddress} transaction={subtransaction} preview={'Internal transaction #' + (index + 1).toString() + ' preview!'}></Transaction>
              </Box>
            )
          }
        </Box>
      }
      {
        programReady &&
        <Card mt="4">
          <Heading size="4" mb="2">Priority & cost</Heading>
          <Tooltip content="Higher gas price increases transaction priority">
            <TextField.Root mt="3" mb="3" size="3" placeholder={"Custom gas price " + Readability.toAssetSymbol(gasAsset || new AssetId())} type="number" disabled={loadingGasPriceAndPrice} value={gasPrice} onChange={(e) => setGasPrice(e.target.value)} />
          </Tooltip>
          <Tooltip content="Gas limit caps max transaction cost">
            <TextField.Root mb="3" size="3" placeholder="Custom gas limit" type="number" disabled={loadingGasPriceAndPrice} value={gasLimit} onChange={(e) => setGasLimit(e.target.value)} />
          </Tooltip>
          <Flex gap="2">
            <Box width="100%">
              <Tooltip content="Max possible transaction fee">
                <TextField.Root size="3" placeholder="Max fee value" readOnly={true} value={gasPrice.length > 0 && gasLimit.length > 0 ? 'Pay up to ' + Readability.toMoney(gasAsset, maxFeeValue) + ' in fees' : 'Fee to be estimated'} onClick={() => {
                  navigator.clipboard.writeText(maxFeeValue.toString());
                  AlertBox.open(AlertType.Info, 'Value copied!')
                }}/>
              </Tooltip>
            </Box>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button size="3" variant="outline" color="gray" style={{ outlineColor: 'red' }} disabled={loadingTransaction || loadingGasPriceAndPrice} loading={loadingGasPriceAndPrice}>
                  Auto
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPriceAndPrice} onClick={() => calculateTransactionGas(0.95)} shortcut="> 95%">Fastest</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPriceAndPrice} onClick={() => calculateTransactionGas(0.75)} shortcut="> 75%">Fast</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPriceAndPrice} onClick={() => calculateTransactionGas(0.50)} shortcut="> 50%">Medium</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPriceAndPrice} onClick={() => calculateTransactionGas(0.25)} shortcut="> 25%">Slow</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPriceAndPrice} onClick={() => calculateTransactionGas(0.10)} shortcut="> 10%">Slowest</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
          {
            sendingValue.gt(0) && gasAsset?.id == assets[asset].asset.id && maxFeeValue.dividedBy(sendingValue).multipliedBy(100).toNumber() > 40.0 &&
            <Flex justify="end" pt="4">
              <Text color="orange" size="2" weight="medium">Warning: transaction fee may cost up to {maxFeeValue.dividedBy(sendingValue).multipliedBy(100).toNumber().toFixed(2)}% of paying value</Text>
            </Flex>
          }
        </Card>
      }
      {
        programReady &&
        <Box mt="4">
          <Flex justify="center" mt="4">
            <Dialog.Root>
              <Dialog.Trigger>
                <Button variant="outline" size="3" color="jade" className="shadow-rainbow-animation" loading={loadingGasPriceAndPrice || loadingTransaction} onClick={() => transactionReady ? buildTransaction() : calculateTransactionGas(0.95)}>Review transaction</Button>
              </Dialog.Trigger>
              {
                transactionReady &&
                <Dialog.Content maxWidth="500px">
                  <Flex justify="between" align="center">
                    <Dialog.Title mb="0">Review</Dialog.Title>
                    <Button variant="surface" color="indigo" radius="medium" size="1" onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(toSimpleTransaction(transactionData), null, 4));
                      AlertBox.open(AlertType.Info, 'Transaction dump copied!')
                    }}>
                      <Icon path={mdiCodeJson} size={0.6}></Icon>
                      Dump
                    </Button>
                  </Flex>
                  <Dialog.Description mb="3" size="2" color="gray">Side effects:</Dialog.Description>
                  <Box>
                    {
                      asset != -1 && program instanceof ProgramTransfer &&
                      <Text as="div" weight="light" size="4" mb="1">— Send <Text color="red">{ Readability.toMoney(assets[asset].asset, sendingValue) }</Text> to <Text color="sky">{ Readability.toCount('account', program.to.length) }</Text></Text>        
                    }
                    {
                      asset != -1 && program instanceof ProgramSetup &&
                      <>
                        {
                          program.blockProduction != 'standby' &&
                          <Text as="div" weight="light" size="4" mb="1">— { program.blockProduction == 'enable' ? 'Enable' : 'Disable' } <Text color="red">block production</Text> of a validator node</Text>
                        }
                        {
                          program.bridgeParticipation != 'standby' &&
                          <Text as="div" weight="light" size="4" mb="1">— { program.bridgeParticipation == 'enable' ? 'Enable' : 'Disable' } <Text color="red">bridge participation</Text> of a validator node</Text>
                        }
                        {
                          program.attestations.length > 0 &&
                          <Text as="div" weight="light" size="4" mb="1">— Update policy of <Text color="red">{ Readability.toCount('attester', program.attestations.length) }</Text> of a validator node</Text>
                        }
                        {
                          program.migrations.length > 0 &&
                          <Text as="div" weight="light" size="4" mb="1">— Migrate <Text color="red">{ Readability.toCount('participant', program.migrations.length) }</Text> of a validator node</Text>
                        }
                      </>
                    }
                    {
                      asset != -1 && program instanceof ProgramRoute &&
                      <>
                        <Text as="div" weight="light" size="4" mb="1">— Claim { Readability.toAssetName(assets[asset].asset) } deposit address</Text>
                        { program.routingAddress.length > 0 && <Text as="div" weight="light" size="4" mb="1">— Claim <Text color="red">{ Readability.toAddress(program.routingAddress) }</Text> { Readability.toAssetName(assets[asset].asset) } {program.routing.find((item) => item.chain == assets[asset].asset.chain)?.policy == 'account' ? 'sender/withdrawal' : 'withdrawal'} address</Text> }
                        <Text as="div" weight="light" size="4" mb="1">— Register through <Badge radius="medium" variant="surface" size="2">{ 
                            (params.manager || 'NULL').substring((params.manager || 'NULL').length - 6)
                        }</Badge> node</Text>
                      </>
                    }
                    {
                      asset != -1 && program instanceof ProgramWithdraw &&
                      <>
                        <Text as="div" weight="light" size="4" mb="1">— Withdraw <Text color="red">{ Readability.toMoney(assets[asset].asset, sendingValue) }</Text> to <Text color="sky">1 account</Text></Text>
                        <Text as="div" weight="light" size="4" mb="1">— Withdraw through <Badge radius="medium" variant="surface" size="2">{ 
                            (params.manager || 'NULL').substring((params.manager || 'NULL').length - 6)
                        }</Badge> node</Text>
                      </>
                    }
                    {
                      asset != -1 && program instanceof ProgramWithdrawAndMigrate &&
                      <Text as="div" weight="light" size="4" mb="1">— Migrate a { assets[asset].chain } bridge of a validator node to another bridge</Text>
                    }
                    {
                      asset != -1 && program instanceof ProgramAnticast &&
                      <Text as="div" weight="light" size="4" mb="1">— Protest <Badge radius="medium" variant="surface" size="2" color="red">{ Readability.toHash(program.broadcastHash, 4) }</Badge> withdrawal broadcast to get a refund</Text>
                    }
                    {
                      asset != -1 && program instanceof ApproveTransaction &&
                      <>
                        <Text as="div" weight="light" size="4" mb="1">— From unverified data (careful!)</Text>
                        <Text as="div" weight="light" size="4" mb="1">— Execute <Badge radius="medium" variant="surface" size="2" color="red">{ program.typename || 'unknown' } transaction</Badge></Text>
                        {
                          Array.isArray(program.transaction.transactions) && program.transaction.transactions.map((subtransaction: any, index: number) =>
                            <Text as="div" weight="light" size="4" mb="1" key={subtransaction.hash + 'x' + index.toString()}>— Execute internal <Badge radius="medium" variant="surface" size="2" color="red">{ Readability.toTransactionType(subtransaction.type) } transaction</Badge></Text>
                          )
                        }
                      </>
                    }
                    <Text as="div" weight="light" size="4" mb="1">— Pay up to <Text color="orange">{ Readability.toMoney(gasAsset, maxFeeValue) }</Text> to <Text color="sky">miner as fee</Text></Text>
                  </Box>
                  <Flex gap="3" mt="4" justify="between">
                    <Dialog.Close>
                      <Button variant="soft" color="gray">Cancel</Button>
                    </Dialog.Close>
                    <Dialog.Close>
                      <Button color="red" disabled={loadingGasPriceAndPrice} loading={loadingTransaction} onClick={() => submitTransaction()}>Submit</Button>
                    </Dialog.Close>
                  </Flex>
                </Dialog.Content>
              }
            </Dialog.Root>
          </Flex>
        </Box>
      }
    </Box>
  )
}