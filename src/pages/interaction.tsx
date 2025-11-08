import { mdiCodeJson, mdiMinus, mdiPlus } from "@mdi/js";
import { Avatar, Badge, Box, Button, Card, Checkbox, Dialog, DropdownMenu, Flex, Heading, IconButton, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEffectAsync } from "../core/react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AlertBox, AlertType } from "../components/alert";
import { AssetId, ByteUtil, Chain, Ledger, RPC, Signing, Stream, TextUtil, TransactionOutput, Transactions, Uint256, Readability, Hashsig, Pubkeyhash, Pubkey, Seckey, SummaryState, EventResolver } from "tangentsdk";
import { AppData } from "../core/app";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";
import Transaction from "../components/transaction";

export class ProgramTransfer {
  to: { address: string, value: string }[] = [];
}

export class ProgramValidatorAdjustment {
  assets: AssetId[] = []
  blockProduction: 'standby' | 'enable' | 'disable' = 'standby';
  participationStakes: { asset: AssetId, stake: string | null }[] = [];
  attestationStakes: { asset: AssetId, stake: string | null }[] = [];
  participationReservations: Set<string> = new Set<string>();
  attestationReservations: Set<string> = new Set<string>();
}

export class ProgramDepositoryAccount {
  routing: { chain: string, policy: string }[] = [];
  routingAddress: string = '';
}

export class ProgramDepositoryWithdrawal {
  routing: { chain: string, policy: string }[] = [];
  to: { address: string, value: string }[] = [];
  onlyIfNotInQueue: boolean = true;
}

export class ProgramDepositoryAdjustment {
  routing: { chain: string, policy: string }[] = [];
  incomingFee: string = '';
  outgoingFee: string = '';
  participationThreshold: string = '';
  securityLevel: number = 2;
  acceptsAccountRequests: boolean = true;
  acceptsWithdrawalRequests: boolean = true;
}

export class ProgramDepositoryMigration {
}

export class ProgramDepositoryWithdrawalMigration {
  routing: { chain: string, policy: string }[] = [];
  toManager: string = '';
  onlyIfNotInQueue: boolean = true;
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
  const [program, setProgram] = useState<ProgramTransfer | ProgramValidatorAdjustment | ProgramDepositoryAccount | ProgramDepositoryWithdrawal | ProgramDepositoryAdjustment | ProgramDepositoryMigration | ProgramDepositoryWithdrawalMigration | ApproveTransaction | null>(null);
  const navigate = useNavigate();
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
    else if (program instanceof ProgramDepositoryWithdrawal) {
      const blockchain = program.routing.find((item) => item.chain == assets[asset].asset.chain);
      return blockchain != null && blockchain.policy == 'utxo';
    }

    return false;
  }, [asset, program]);
  const transactionType = useMemo((): string => {
    if (program instanceof ProgramTransfer) {
      return program.to.length > 1 ? 'Send to many' : 'Send to one';
    } else if (program instanceof ProgramValidatorAdjustment) {
      return 'Validator adjustment';
    } else if (program instanceof ProgramDepositoryAccount) {
        return 'Address claim';
    } else if (program instanceof ProgramDepositoryWithdrawal) {
      return program.to.length > 1 ? 'Withdraw to many' : 'Withdraw to one';
    } else if (program instanceof ProgramDepositoryAdjustment) {
      return 'Bridge adjustment';
    } else if (program instanceof ProgramDepositoryMigration) {
      return 'Participant migration';
    } else if (program instanceof ProgramDepositoryWithdrawalMigration) {
      return 'Manager migration';
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
    } else if (program instanceof ProgramDepositoryWithdrawal) {
      return program.to.reduce((value, next) => {
        try {
          const numeric = new BigNumber(next.value.trim());
          return numeric.isPositive() ? value.plus(numeric) : value;
        } catch {
          return value;
        }
      }, new BigNumber(0));
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
    } else if (program instanceof ProgramValidatorAdjustment) {
        for (let i = 0; i < program.participationStakes.length; i++) {
          let item = program.participationStakes[i];
          try {
            if (typeof item.stake != 'string')
              continue;
  
            const numeric = new BigNumber(item.stake.trim());
            if (numeric.isNaN())
              return false;
          } catch {
            return false;
          }
        }
        
        for (let i = 0; i < program.attestationStakes.length; i++) {
          let item = program.attestationStakes[i];
          try {
            if (typeof item.stake != 'string')
              continue;
            
            const numeric = new BigNumber(item.stake.trim());
            if (numeric.isNaN())
              return false;
          } catch {
            return false;
          }
        }
        return program.blockProduction != 'standby' || program.participationStakes.length > 0 || program.attestationStakes.length > 0;
    } else if (program instanceof ProgramDepositoryAccount) {
      const routing = program.routing.find((item) => item.chain == assets[asset].asset.chain);
      if (routing?.policy == 'account' && !program.routingAddress.length)
        return false;

      if (params.manager == null)
        return false;
  
      return true;
    } else if (program instanceof ProgramDepositoryWithdrawal) {
      for (let i = 0; i < program.to.length; i++) {
        const payment = program.to[i];
        if (payment.address.trim() == ownerAddress)
          return false;
  
        const publicKeyHash = Signing.decodeAddress(payment.address.trim());
        if (publicKeyHash != null || !payment.address.length)
          return false;

        try {
          const numeric = new BigNumber(payment.value.trim());
          if (numeric.isNaN() || !numeric.isPositive())
            return false;
        } catch {
          return false;
        }
      }
      
      if (params.manager == null)
        return false;
  
      return sendingValue.gt(0) && sendingValue.lte(assets[asset].balance);
    } else if (program instanceof ProgramDepositoryAdjustment) {
      try {
        if (program.incomingFee.length > 0) {
          const numeric = new BigNumber(program.incomingFee.trim());
          if (numeric.isNaN() || numeric.isNegative())
            return false;
        }
      } catch {
        return false;
      }

      try {
        if (program.outgoingFee.length > 0) {
          const numeric = new BigNumber(program.outgoingFee.trim());
          if (numeric.isNaN() || numeric.isNegative())
            return false;
        }
      } catch {
        return false;
      }

      try {
        if (program.participationThreshold.length > 0) {
          const numeric = new BigNumber(program.participationThreshold.trim());
          if (numeric.isNaN() || numeric.isNegative())
            return false;
        }
      } catch {
        return false;
      }

      if (program.securityLevel < Chain.props.PARTICIPATION_COMMITTEE[0] || program.securityLevel > Chain.props.PARTICIPATION_COMMITTEE[1])
        return false;

      return true;
    } else if (program instanceof ProgramDepositoryMigration) {
      return true;
    } else if (program instanceof ProgramDepositoryWithdrawalMigration) {
      if (program.toManager.trim() == ownerAddress)
        return false;

      const publicKeyHash = Signing.decodeAddress(program.toManager.trim());
      if (!publicKeyHash || publicKeyHash.data.length != 20)
        return false;

      return true;
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

    return maxFeeValue.plus(sendingValue).lte(assets[asset].balance);
  }, [programReady, gasPrice, gasLimit, maxFeeValue, sendingValue]);
  const readOnlyApproval = useMemo((): boolean => {
    return program != null && program instanceof ApproveTransaction && params.transaction != null;
  }, [program]);
  const setRemainingValue = useCallback((index: number) => {
    if (program instanceof ProgramTransfer || program instanceof ProgramDepositoryWithdrawal) {
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
      } else if (program instanceof ProgramValidatorAdjustment) {
        return await buildProgram({
          type: new Transactions.ValidatorAdjustment(),
          args: {
            blockProduction: program.blockProduction == 'enable' ? 1 : (program.blockProduction == 'disable' ? 0 : 2),
            participationStakes: program.participationStakes.map((item) => ({
              asset: item.asset,
              stake: item.stake != null ? new BigNumber(item.stake) : new BigNumber(NaN)
            })),
            attestationStakes: program.attestationStakes.map((item) => ({
              asset: item.asset,
              stake: item.stake != null ? new BigNumber(item.stake) : new BigNumber(NaN)
            }))
          }
        });
      } else if (program instanceof ProgramDepositoryAccount) {
        let includeRoutingAddress = true;
        if (program.routingAddress.length > 0) {
          try {
            const accounts = await RPC.getWitnessAccount(ownerAddress, assets[asset].asset, program.routingAddress);
            includeRoutingAddress = !accounts || !accounts.length;
          } catch { }
        }
        return await buildProgram({
          type: new Transactions.DepositoryAccount(),
          args: {
            manager: Signing.decodeAddress(params.manager || ''),
            routingAddress: includeRoutingAddress ? program.routingAddress : ''
          }
        });
      } else if (program instanceof ProgramDepositoryWithdrawal) {
        return await buildProgram({
          type: new Transactions.DepositoryWithdrawal(),
          args: {
            onlyIfNotInQueue: program.onlyIfNotInQueue,
            fromManager: Signing.decodeAddress(params.manager || ''),
            toManager: null,
            to: program.to.map((payment) => ({
              to: payment.address,
              value: new BigNumber(payment.value)
            }))
          }
        });
      } else if (program instanceof ProgramDepositoryAdjustment) {
        return await buildProgram({
          type: new Transactions.DepositoryAdjustment(),
          args: {
            incomingFee: new BigNumber(program.incomingFee || 0),
            outgoingFee: new BigNumber(program.outgoingFee || 0),
            participationThreshold: new BigNumber(program.participationThreshold || 0),
            securityLevel: program.securityLevel,
            acceptsAccountRequests: program.acceptsAccountRequests,
            acceptsWithdrawalRequests: program.acceptsWithdrawalRequests
          }
        });
      } else if (program instanceof ProgramDepositoryMigration) {
        const participants = await RPC.getParticipations();
        if (!participants)
          throw new Error('cannot fetch participations');

        return await buildProgram({
          type: new Transactions.DepositoryMigration(),
          args: {
            shares: participants.map((item) => {
              const asset = new AssetId(item.asset.id);
              const manager = Signing.decodeAddress(item.manager || '');
              const owner = Signing.decodeAddress(item.owner || '');
              const message = new Stream();
              message.writeInteger(asset.toUint256());
              message.writeBinaryString(manager ? manager.data : new Uint8Array());
              message.writeBinaryString(owner ? owner.data : new Uint8Array());
              return {
                asset: asset,
                manager: manager,
                owner: owner,
                hash: message.hash()
              };
            }).sort((a, b): number => a.hash.lt(b.hash) ? -1 : (a.hash.eq(b.hash) ? 0 : 1))
          }
        });
      } else if (program instanceof ProgramDepositoryWithdrawalMigration) {
        return await buildProgram({
          type: new Transactions.DepositoryWithdrawal(),
          args: {
            onlyIfNotInQueue: program.onlyIfNotInQueue,
            fromManager: Signing.decodeAddress(ownerAddress || ''),
            toManager: Signing.decodeAddress(program.toManager || ''),
            to: []
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
      const hash = await RPC.submitTransaction(output.data, true);
      if (hash != null) {
        AlertBox.open(AlertType.Info, 'Transaction ' + hash + ' sent!');
        if (AppData.approveTransaction) {
          AppData.approveTransaction({ hash: new Uint256(hash), message: ByteUtil.hexStringToUint8Array(output.data), signature: output.body.signature });
        }
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
    switch (params.type) {
      case 'transfer':
      default: {
        const result = new ProgramTransfer();
        result.to = [{ address: '', value: '' }];
        setProgram(result);
       break; 
      }
      case 'approvetransaction': {
        if (params.transaction && params.transaction.length > 0)
          decodeApprovableTransaction(params.transaction, false);
        else
          setProgram(new ApproveTransaction());
        break;
      }
      case 'validator': {
        const result = new ProgramValidatorAdjustment();
        try { result.assets = ((await RPC.getBlockchains()) || []).map((v) => AssetId.fromHandle(v.chain)); } catch { }
        setProgram(result);
        break;
      }
      case 'registration': {
        const result = new ProgramDepositoryAccount();
        try { result.routing = ((await RPC.getBlockchains()) || []).map((v) => { return { chain: v.chain, policy: v.routing_policy }}); } catch { }
        setProgram(result);
        break;
      }
      case 'withdrawal': {
        const result = new ProgramDepositoryWithdrawal();
        result.to = [{ address: '', value: '' }];
        try { result.routing = ((await RPC.getBlockchains()) || []).map((v) => { return { chain: v.chain, policy: v.routing_policy }}); } catch { }
        setProgram(result);
        break;
      }
      case 'adjustment': {
        const result = new ProgramDepositoryAdjustment();
        try { result.routing = ((await RPC.getBlockchains()) || []).map((v) => { return { chain: v.chain, policy: v.token_policy }}); } catch { }
        setProgram(result);
        break;
      }
      case 'participantmigration': {
        setProgram(new ProgramDepositoryMigration());
        break;
      }
      case 'managermigration': {
        setProgram(new ProgramDepositoryWithdrawalMigration());
        break;
      }
    }

    setSimulation(null);
    try {
      let assetData = await RPC.fetchAll((offset, count) => RPC.getAccountBalances(ownerAddress, offset, count));
      if (Array.isArray(assetData)) {
        assetData = assetData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
        assetData = assetData.filter((item) => item.balance?.gt(0) || item.reserve?.gt(0) || item.supply?.gt(0));
      }

      if (params.asset != null) {
        const target: AssetId = new AssetId(params.asset);
        if (Array.isArray(assetData)) {
          const index = assetData.findIndex((item) => item.asset.id == target.id);
          if (index == -1) {
            assetData = [...assetData, {
              asset: target,
              balance: new BigNumber(0),
              reserve: new BigNumber(0),
              supply: new BigNumber(0)
            }];
            setAssets(assetData);
            setAsset(assetData.length - 1);
          } else {
            setAssets(assetData);
            setAsset(index);
          }
        } else {
          setAssets([{
            asset: target,
            balance: new BigNumber(0),
            reserve: new BigNumber(0),
            supply: new BigNumber(0)
          }]);
          setAsset(0);
        }
      } else if (Array.isArray(assetData)) {
        setAssets(assetData);
      }
    } catch { }
  }, [query]);
  useEffect(() => {
    return () => {
      if (AppData.approveTransaction) {
        AppData.approveTransaction(null);
      }
    }
  }, []);

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
                <DropdownMenu.Item onClick={() => navigate('/interaction?type=approvetransaction')}>Approve</DropdownMenu.Item>
              </Tooltip>
              <DropdownMenu.Separator />
              <Tooltip content="Change block production and/or participation/attestation stake(s)">
                <DropdownMenu.Item onClick={() => navigate('/interaction?type=validator')}>Configure validator</DropdownMenu.Item>
              </Tooltip>
              <DropdownMenu.Separator />
              <Tooltip content="Configure fee, security and functionality policy for a bridge">
                <DropdownMenu.Item onClick={() => navigate('/interaction?type=adjustment')}>Configure bridge</DropdownMenu.Item>
              </Tooltip>
              <Tooltip content="Migrate bridge participations to another participant (for participation unstaking)">
                <DropdownMenu.Item color="red" onClick={() => navigate('/interaction?type=participantmigration')}>Migrate participant</DropdownMenu.Item>
              </Tooltip>
              <Tooltip content="Migrate bridge manager to another manager along with custodial funds (for attestation unstaking)">
                <DropdownMenu.Item color="red" onClick={() => navigate('/interaction?type=managermigration')}>Migrate manager</DropdownMenu.Item>
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
                  <Select.Item key={item.hash + '_select'} value={index.toString()}>
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
          asset != -1 && (program instanceof ProgramDepositoryWithdrawal || program instanceof ProgramDepositoryWithdrawalMigration) &&
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
        asset != -1 && program instanceof ProgramValidatorAdjustment &&
        <Card mt="4">
          <Heading size="4" mb="2">Validation configuration</Heading>
          <Select.Root size="3" value={program.blockProduction} onValueChange={(value) => {
            const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
            copy.blockProduction = value as any;
            setProgram(copy);
          }}>
            <Select.Trigger variant="surface" placeholder="Select block production" style={{ width: '100%' }}>
            </Select.Trigger>
            <Select.Content color="gray">
              <Select.Item value="standby">Change block production</Select.Item>
              <Select.Item value="enable">
                <Text color="jade">ENABLE</Text> block production
              </Select.Item>
              <Select.Item value="disable">
                <Text color="red">DISABLE</Text> block production
              </Select.Item>
            </Select.Content>
          </Select.Root>
          {
            program.participationStakes.map((item, index) =>
              <Box mt="4" key={index}>
                <Heading size="4" mb="2">
                  <Flex align="center">
                    <Avatar mr="1" size="1" radius="full" fallback={(item.asset.chain || '?')[0]} src={'/cryptocurrency/' + (item.asset.chain || '').toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                    { item.asset.chain || '' } participation stake
                  </Flex>
                </Heading>
                <Box width="100%">
                  <Tooltip content="Locking value if positive and unlocking value if negative">
                    <TextField.Root mb="3" size="3" placeholder={'Stake value in ' + Readability.toAssetSymbol(item.asset)} type="number" value={item.stake || ''} disabled={item.stake == null} onChange={(e) => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.participationStakes[index].stake = e.target.value;
                      setProgram(copy);
                    }} />
                  </Tooltip>
                </Box>
                <Box width="100%">
                  <Flex align="center" justify="between">
                    <Button variant="soft" color="red" onClick={() => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.participationReservations.delete(item.asset.chain || '');
                      copy.participationStakes.splice(index, 1);
                      setProgram(copy);
                    }}>No change</Button>
                    <Tooltip content="Unlock full stake">
                      <Text as="label" size="2" color={item.stake != null ? 'jade' : 'red'}>
                        <Flex gap="2">
                          <Checkbox size="3" checked={item.stake == null} onCheckedChange={(value) => {
                            const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                            copy.participationStakes[index].stake = value ? null : '';
                            setProgram(copy);
                          }} />
                          <Text>Unlock full stake</Text>
                        </Flex>
                      </Text>
                    </Tooltip>
                  </Flex>
                </Box>
              </Box>
            )
          }
          {
            program.attestationStakes.map((item, index) =>
              <Box mt="4" key={index}>
                <Heading size="4" mb="2">
                  <Flex align="center">
                    <Avatar mr="1" size="1" radius="full" fallback={(item.asset.chain || '?')[0]} src={'/cryptocurrency/' + (item.asset.chain || '').toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                    { item.asset.chain || '' } attestation stake
                  </Flex>
                </Heading>
                <Box width="100%">
                  <Tooltip content="Locking value if positive and unlocking value if negative">
                    <TextField.Root mb="3" size="3" placeholder={'Stake value in ' + Readability.toAssetSymbol(item.asset)} type="number" value={item.stake || ''} disabled={item.stake == null} onChange={(e) => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.attestationStakes[index].stake = e.target.value;
                      setProgram(copy);
                    }} />
                  </Tooltip>
                </Box>
                <Box width="100%">
                  <Flex align="center" justify="between">
                    <Button variant="soft" color="red" onClick={() => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.attestationReservations.delete(item.asset.chain || '');
                      copy.attestationStakes.splice(index, 1);
                      setProgram(copy);
                    }}>No change</Button>
                    <Tooltip content="Unlock full stake">
                      <Text as="label" size="2" color={item.stake != null ? 'jade' : 'red'}>
                        <Flex gap="2" justify="end">
                          <Checkbox size="3" checked={item.stake == null} onCheckedChange={(value) => {
                            const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                            copy.attestationStakes[index].stake = value ? null : '';
                            setProgram(copy);
                          }} />
                          <Text>Unlock full stake</Text>
                        </Flex>
                      </Text>
                    </Tooltip>
                  </Flex>
                </Box>
              </Box>
            )
          }
          {
            (program.participationStakes.length > 0 || program.attestationStakes.length > 0) && 
            <Box width="100%" mt="3" mb="4">
              <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
            </Box>
          }
          <Box mt="4">
            <Select.Root size="3" onValueChange={(value) => {
              const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
              copy.participationStakes.push({ asset: AssetId.fromHandle(value), stake: '' });
              copy.participationReservations.add(copy.participationStakes[copy.participationStakes.length - 1].asset.chain || '');
              setProgram(copy);
            }}>
              <Select.Trigger variant="surface" placeholder="Change participation stake" style={{ width: '100%' }}>
              </Select.Trigger>
              <Select.Content variant="soft">
                <Select.Group>
                  <Select.Item value="0" disabled={true}>Select participation blockchain</Select.Item>
                  {
                    program.assets.map((item) =>
                      <Select.Item key={item.chain + '_select'} value={item.chain || ''} disabled={program.participationReservations.has(item.chain || '')}>
                        <Flex align="center" gap="1">
                          <Avatar mr="1" size="1" radius="full" fallback={(item.chain || '?')[0]} src={'/cryptocurrency/' + (item.chain || '').toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                          <Text size="4">{ item.chain || '' } participation update</Text>
                        </Flex>
                      </Select.Item>
                    )
                  }
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Box>
          <Box mt="4">
            <Select.Root size="3" onValueChange={(value) => {
              const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
              copy.attestationStakes.push({ asset: AssetId.fromHandle(value), stake: '' });
              copy.attestationReservations.add(copy.attestationStakes[copy.attestationStakes.length - 1].asset.chain || '');
              setProgram(copy);
            }}>
              <Select.Trigger variant="surface" placeholder="Change attestation stake" style={{ width: '100%' }}>
              </Select.Trigger>
              <Select.Content variant="soft">
                <Select.Group>
                  <Select.Item value="0" disabled={true}>Select attestation blockchain</Select.Item>
                  {
                    program.assets.map((item) =>
                      <Select.Item key={item.chain + '_select'} value={item.chain || ''} disabled={program.attestationReservations.has(item.chain || '')}>
                        <Flex align="center" gap="1">
                          <Avatar mr="1" size="1" radius="full" fallback={(item.chain || '?')[0]} src={'/cryptocurrency/' + (item.chain || '').toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                          <Text size="4">{ item.chain || '' } attestation update</Text>
                        </Flex>
                      </Select.Item>
                    )
                  }
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Box>
        </Card>
      }
      {
        asset != -1 && program instanceof ProgramDepositoryAccount &&
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
        asset != -1 && program instanceof ProgramDepositoryWithdrawal && program.to.map((item, index) =>
          <Card mt="4" key={index}>
            <Heading size="4" mb="2">Withdraw to account{ program.to.length > 1 ? ' #' + (index + 1) : ''}</Heading>
            <Flex gap="2" mb="3">
              <Box width="100%">
                <Tooltip content="Withdraw to off-chain address">
                  <TextField.Root size="3" placeholder="Withdraw to address" type="text" value={item.address} onChange={(e) => {
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
                <Flex justify="end" gap="2">
                  <Button size="3" variant="outline" color="gray" onClick={() => setRemainingValue(index) }>Remaining</Button>
                  <IconButton variant="soft" size="3" color={index != 0 ? 'red' : 'jade'} disabled={!omniTransaction && index == 0} onClick={() => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    if (index == 0) {
                      copy.to.push({ address: '', value: '' });
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
        asset != -1 && program instanceof ProgramDepositoryAdjustment &&
        <>
          <Card mt="4">
            <Heading size="4" mb="2">Bridge policy</Heading>
            <Box width="100%">
              <Tooltip content="Fee charged for deposits (absolute value)">
                <TextField.Root size="3" placeholder="Incoming absolute fee 0.0-∞" type="text" value={program.incomingFee} onChange={(e) => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  copy.incomingFee = e.target.value;
                  setProgram(copy);
                }} />
              </Tooltip>
            </Box>
            <Box width="100%" mt="3">
              <Tooltip content="Fee charged for withdrawals (absolute value)">
                <TextField.Root size="3" placeholder="Outgoing absolute fee 0.0-∞" type="text" value={program.outgoingFee} onChange={(e) => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  copy.outgoingFee = e.target.value;
                  setProgram(copy);
                }} />
              </Tooltip>
            </Box>
            <Box width="100%" mt="3">
              <Tooltip content="Participant stacking required to be included in bridge account/transaction calculations (absolute value)">
                <TextField.Root size="3" placeholder="Participation threshold 0.0-∞" type="text" value={program.participationThreshold} onChange={(e) => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  copy.participationThreshold = e.target.value;
                  setProgram(copy);
                }} />
              </Tooltip>
            </Box>
            <Box width="100%" mt="3">
              <Tooltip content="Determines how many participants must be present to sign transactions">
                <TextField.Root size="3" placeholder="Security level (2-16)" type="text" value={program.securityLevel.toString()} onChange={(e) => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  copy.securityLevel = parseInt(e.target.value) || 0;
                  setProgram(copy);
                }} />
              </Tooltip>
            </Box>
            <Flex width="100%" mt="3" justify="start" gap="2" wrap="wrap">
              <Tooltip content="Allow others to generate bridge accounts for your bridge">
                <Text as="label" size="2" color={program.acceptsAccountRequests ? 'jade' : 'red'}>
                  <Flex gap="2">
                    <Checkbox size="3" checked={program.acceptsAccountRequests} onCheckedChange={(value) => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.acceptsAccountRequests = (value.valueOf() as boolean);
                      setProgram(copy);
                    }} />
                    <Text>Enable deposits</Text>
                  </Flex>
                </Text>
              </Tooltip>
              <Tooltip content="Allow others to withdraw their funds from your bridge">
                <Text as="label" size="2" color={program.acceptsWithdrawalRequests ? 'jade' : 'red'}>
                  <Flex gap="2">
                    <Checkbox size="3" checked={program.acceptsWithdrawalRequests} onCheckedChange={(value) => {
                      const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                      copy.acceptsWithdrawalRequests = (value.valueOf() as boolean);
                      setProgram(copy);
                    }} />
                    <Text>Enable withdrawals</Text>
                  </Flex>
                </Text>
              </Tooltip>
            </Flex>
          </Card>
        </>
      }
      {
        asset != -1 && program instanceof ProgramDepositoryWithdrawalMigration &&
        <Card mt="4">
          <Heading size="4" mb="2">Migrate to manager account</Heading>
          <Box width="100%">
            <Tooltip content="Send to bridge funds to this manager address">
              <TextField.Root size="3" placeholder="New manager address" type="text" value={program.toManager} onChange={(e) => {
                const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                copy.toManager = e.target.value;
                setProgram(copy);
              }} />
            </Tooltip>
          </Box>
        </Card>
      }
      {
        programReady &&
        <Card mt="4">
          <Heading size="4" mb="2">Priority & cost</Heading>
          <Tooltip content="Higher gas price increases transaction priority">
            <TextField.Root mt="3" mb="3" size="3" placeholder="Custom gas price" type="number" disabled={loadingGasPriceAndPrice} value={gasPrice} onChange={(e) => setGasPrice(e.target.value)} />
          </Tooltip>
          <Tooltip content="Gas limit caps max transaction cost">
            <TextField.Root mb="3" size="3" placeholder="Custom gas limit" type="number" disabled={loadingGasPriceAndPrice} value={gasLimit} onChange={(e) => setGasLimit(e.target.value)} />
          </Tooltip>
          <Flex gap="2">
            <Box width="100%">
              <Tooltip content="Max possible transaction fee">
                <TextField.Root size="3" placeholder="Max fee value" readOnly={true} value={gasPrice.length > 0 && gasLimit.length > 0 ? 'Pay up to ' + Readability.toMoney(assets[asset].asset, maxFeeValue) + ' in fees' : 'Fee to be estimated'} onClick={() => {
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
            sendingValue.gt(0) && maxFeeValue.dividedBy(sendingValue).multipliedBy(100).toNumber() > 40.0 &&
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
                      asset != -1 && program instanceof ProgramValidatorAdjustment &&
                      <>
                        {
                          program.blockProduction != 'standby' &&
                          <Text as="div" weight="light" size="4" mb="1">— { program.blockProduction == 'enable' ? 'Enable' : 'Disable' } <Text color="red">block production</Text> of a validator node</Text>
                        }
                        {
                          program.participationStakes.length > 0 &&
                          <Text as="div" weight="light" size="4" mb="1">— Update stake of <Text color="red">{ Readability.toCount('participation', program.participationStakes.length) }</Text> of a validator node</Text>
                        }
                        {
                          program.attestationStakes.length > 0 &&
                          <Text as="div" weight="light" size="4" mb="1">— Update stake of <Text color="red">{ Readability.toCount('attestation', program.attestationStakes.length) }</Text> of a validator node</Text>
                        }
                      </>
                    }
                    {
                      asset != -1 && program instanceof ProgramDepositoryAccount &&
                      <>
                        <Text as="div" weight="light" size="4" mb="1">— Claim { Readability.toAssetName(assets[asset].asset) } deposit address</Text>
                        { program.routingAddress.length > 0 && <Text as="div" weight="light" size="4" mb="1">— Claim <Text color="red">{ Readability.toAddress(program.routingAddress) }</Text> { Readability.toAssetName(assets[asset].asset) } {program.routing.find((item) => item.chain == assets[asset].asset.chain)?.policy == 'account' ? 'sender/withdrawal' : 'withdrawal'} address</Text> }
                        <Text as="div" weight="light" size="4" mb="1">— Register through <Badge radius="medium" variant="surface" size="2">{ 
                            (params.manager || 'NULL').substring((params.manager || 'NULL').length - 6).toUpperCase()
                        }</Badge> node</Text>
                      </>
                    }
                    {
                      asset != -1 && program instanceof ProgramDepositoryWithdrawal &&
                      <>
                        <Text as="div" weight="light" size="4" mb="1">— Withdraw <Text color="red">{ Readability.toMoney(assets[asset].asset, sendingValue) }</Text> to <Text color="sky">{ Readability.toCount('account', program.to.length) }</Text></Text>
                        <Text as="div" weight="light" size="4" mb="1">— Withdraw through <Badge radius="medium" variant="surface" size="2">{ 
                            (params.manager || 'NULL').substring((params.manager || 'NULL').length - 6).toUpperCase()
                        }</Badge> node</Text>
                      </>
                    }
                    {
                      asset != -1 && program instanceof ProgramDepositoryAdjustment &&
                      <Text as="div" weight="light" size="4" mb="1">— Adjust a { assets[asset].chain } depository of a validator node by using { program.incomingFee.length > 0 && new BigNumber(program.incomingFee).gt(0) ? 'paid' : 'free' } deposits and { program.outgoingFee.length > 0 && new BigNumber(program.outgoingFee).gt(0) ? 'paid' : 'free' } withdrawals</Text>        
                    }
                    {
                      asset != -1 && program instanceof ProgramDepositoryMigration &&
                      <Text as="div" weight="light" size="4" mb="1">— Migration participation of a validator node (to possibly unstake the participation stake)</Text>        
                    }
                    {
                      asset != -1 && program instanceof ProgramDepositoryWithdrawalMigration &&
                      <Text as="div" weight="light" size="4" mb="1">— Migration a { assets[asset].chain } bridge of a validator node to <Badge radius="medium" variant="surface" size="2">{ 
                          program.toManager.substring(program.toManager.length - 6).toUpperCase()
                      }</Badge> node</Text>
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
                    <Text as="div" weight="light" size="4" mb="1">— Pay up to <Text color="orange">{ Readability.toMoney(assets[asset].asset, maxFeeValue) }</Text> to <Text color="sky">miner as fee</Text></Text>
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