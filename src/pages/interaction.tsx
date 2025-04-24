import { mdiBackburger, mdiMinus, mdiPlus } from "@mdi/js";
import { Avatar, Badge, Box, Button, Card, Checkbox, Dialog, DropdownMenu, Flex, Heading, IconButton, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useCallback, useMemo, useState } from "react";
import { useEffectAsync } from "../core/extensions/react";
import { Interface, TransactionOutput, Wallet } from "../core/wallet";
import { AssetId, Chain, Signing, Uint256 } from "../core/tangent/algorithm";
import { Readability } from "../core/text";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Ledger, Transactions } from "../core/tangent/schema";
import { AlertBox, AlertType } from "../components/alert";
import { SchemaUtil, Stream } from "../core/tangent/serialization";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";

export class ProgramTransfer {
  to: { address: string, memo: string | null, value: string }[] = [];
}

export class ProgramDepositoryWithdrawal {
  routing: { chain: string, policy: string }[] = [];
  to: { address: string, value: string }[] = [];
  onlyIfNotInQueue: boolean = true;
}

export class CallCertification {
  assets: AssetId[] = []
  blockProduction: 'standby' | 'enable' | 'disable' = 'standby';
  participationStakes: { asset: AssetId, stake: string | null }[] = [];
  attestationStakes: { asset: AssetId, stake: string | null }[] = [];
  participationReservations: Set<string> = new Set<string>();
  attestationReservations: Set<string> = new Set<string>();
}

export class CallDepositoryAdjustment {
  incomingFee: string = '';
  outgoingFee: string = '';
  securityLevel: number = 2;
  acceptsAccountRequests: boolean = true;
  acceptsWithdrawalRequests: boolean = true;
}

export class CallDepositoryRegrouping {
}

export class CallDepositoryWithdrawal {
  manager: string = '';
}

export default function InteractionPage() {
  const [query] = useSearchParams();
  const [ownerAddress, setOwnerAddress] = useState<string>(Wallet.getAddress() || '');
  const [assets, setAssets] = useState<any[]>([]);
  const [asset, setAsset] = useState(-1);
  const [nonce, setNonce] = useState<BigNumber | null>();
  const [gasPrice, setGasPrice] = useState('');
  const [gasLimit, setGasLimit] = useState('');
  const [loadingTransaction, setLoadingTransaction] = useState(false);
  const [loadingGasPrice, setLoadingGasPrice] = useState(false);
  const [loadingGasLimit, setLoadingGasLimit] = useState(false);
  const [conservative, setConservative] = useState(false);
  const [transactionData, setTransactionData] = useState<TransactionOutput | null>(null);
  const [program, setProgram] = useState<ProgramTransfer | ProgramDepositoryWithdrawal | CallCertification | CallDepositoryAdjustment | CallDepositoryRegrouping | CallDepositoryWithdrawal | null>(null);
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
    } else if (program instanceof ProgramDepositoryWithdrawal) {
      return program.to.length > 1 ? 'Withdraw to many' : 'Withdraw to one';
    } else if (program instanceof CallCertification) {
      return 'Validator adjustment';
    } else if (program instanceof CallDepositoryAdjustment) {
      return 'Depository adjustment';
    } else if (program instanceof CallDepositoryRegrouping) {
      return 'Depository regrouping';
    } else if (program instanceof CallDepositoryWithdrawal) {
      return 'Depository migration';
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
      
      const fromManager = query.get('fromManager');
      if (fromManager == null)
        return false;
  
      return sendingValue.gt(0) && sendingValue.lte(assets[asset].balance);
    } else if (program instanceof CallCertification) {
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
    
    } else if (program instanceof CallDepositoryAdjustment) {
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

      if (program.securityLevel < Chain.props.PARTICIPATION_COMMITTEE[0] || program.securityLevel > Chain.props.PARTICIPATION_COMMITTEE[1])
        return false;

      return true;
    } else if (program instanceof CallDepositoryRegrouping) {
      return true;
    } else if (program instanceof CallDepositoryWithdrawal) {
      if (program.manager.trim() == ownerAddress)
        return false;

      const publicKeyHash = Signing.decodeAddress(program.manager.trim());
      if (!publicKeyHash || publicKeyHash.data.length != 20)
        return false;

      return true;
    }
    return false;
  }, [asset, gasPrice, gasLimit, conservative, assets, program]);
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
  const setEstimatedGasPrice = useCallback(async (percentile: number) => {
    if (loadingGasPrice)
      return false;

    setLoadingGasPrice(true);
    try {
      const price = await Interface.getGasPrice(new AssetId(assets[asset].asset.id), percentile);
      if (price != null && price instanceof BigNumber && price.gte(0)) {
        setGasPrice(price.toString());
      } else {
        setGasPrice('0');
      }
    } catch {
      setGasPrice('0');
    }

    setLoadingGasPrice(false);
    return true;
  }, [loadingGasPrice, assets, asset]);
  const setCalculatedGasLimit = useCallback(async () => {
    if (loadingGasLimit)
      return false;

    const output = await buildTransaction();
    if (!output) {
      AlertBox.open(AlertType.Error, 'Cannot build transaction to fetch gas limit');
      return false;
    }

    setLoadingGasLimit(true);
    try {
      let gas = await Interface.getOptimalTransactionGas(output.data);
      if (typeof gas == 'string') {
        gas = new BigNumber(gas, 16);
      }

      if (!gas || !(gas instanceof BigNumber) || !gas.gte(0)) {
        gas = await Interface.getEstimateTransactionGas(output.data);
        if (typeof gas == 'string') {
          gas = new BigNumber(gas, 16);
        }
      }
      
      if (gas != null && gas instanceof BigNumber && gas.gte(0)) {
        setGasLimit(gas.toString());
        output.body.gasLimit = new Uint256(gas.toString());
        await buildTransaction(output);
      } else {
        AlertBox.open(AlertType.Error, 'Cannot fetch transaction gas limit');
        setGasLimit('');
      }
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Cannot fetch transaction gas limit: ' + (exception as Error).message);
      setGasLimit('');
    }

    setLoadingGasLimit(false);
    return true;
  }, [loadingGasLimit, programReady, transactionReady, loadingTransaction, nonce, assets, asset, program]);
  const buildTransaction = useCallback(async (prebuilt?: TransactionOutput): Promise<TransactionOutput | null> => {
    if (!programReady || loadingTransaction)
      return null;
    
    const buildProgramTransaction = async (method: { type: Ledger.Transaction, args: { [key: string]: any } }) => {
      const output = await Wallet.buildTransaction({
        asset: new AssetId(assets[asset].asset.id),
        nonce: prebuilt ? prebuilt.body.nonce.toString() : (nonce || undefined),
        conservative: conservative,
        gasPrice: gasPrice,
        gasLimit: prebuilt ? prebuilt.body.gasLimit.toString() : gasLimit,
        method: method
      });
      setNonce(new BigNumber(output.body.nonce.toString()));
      setTransactionData(output);
      setLoadingTransaction(false);
      return output;
    };
    const buildCallTransaction = async (schema: any, input: Promise<{ hash: string, data: string } | null>) => {
      const data = await input;
      if (!data)
        throw new Error('transaction build error');

      const output: TransactionOutput = {
        hash: data.hash,
        data: data.data,
        body: SchemaUtil.load(Stream.decode(data.data), schema)
      }
      setNonce(new BigNumber(output.body.nonce.toString()));
      setTransactionData(output);
      setLoadingTransaction(false);
      return output;
    };
    setLoadingTransaction(true);
    try {
      if (program instanceof ProgramTransfer) {
        return buildProgramTransaction(program.to.length > 1 ? {
          type: new Transactions.Transfer.Many(),
          args: {
            to: program.to.map((payment) => ({
              memo: payment.memo || '',
              value: new BigNumber(payment.value),
              to: Signing.decodeAddress(payment.address)
            }))
          }
        } : {
          type: new Transactions.Transfer.One(),
          args: {
            memo: program.to[0].memo || '',
            value: new BigNumber(program.to[0].value),
            to: Signing.decodeAddress(program.to[0].address)
          }
        });
      } else if (program instanceof ProgramDepositoryWithdrawal) {
        return buildProgramTransaction({
          type: new Transactions.DepositoryWithdrawal(),
          args: {
            onlyIfNotInQueue: program.onlyIfNotInQueue,
            fromManager: Signing.decodeAddress(query.get('manager') || ''),
            toManager: null,
            to: program.to.map((payment) => ({
              to: payment.address,
              value: new BigNumber(payment.value)
            }))
          }
        });
      } else if (program instanceof CallCertification) {
        const participation: Record<string, BigNumber | null> = { };
        program.participationStakes.forEach((item) => {
          participation[item.asset.handle] = item.stake != null ? new BigNumber(item.stake) : null;
        });
        const attestation: Record<string, BigNumber | null> = { };
        program.attestationStakes.forEach((item) => {
          attestation[item.asset.handle] = item.stake != null ? new BigNumber(item.stake) : null;
        });
        return buildCallTransaction(new Transactions.Certification(), Interface.buildCertificationTransaction(
          new AssetId(assets[asset].asset.id),
          program.blockProduction,
          participation,
          attestation));
      } else if (program instanceof CallDepositoryAdjustment) {
        return buildCallTransaction(new Transactions.DepositoryAdjustment(), Interface.buildDepositoryAdjustmentTransaction(
          new AssetId(assets[asset].asset.id),
          new BigNumber(program.incomingFee),
          new BigNumber(program.outgoingFee),
          program.securityLevel,
          program.acceptsAccountRequests,
          program.acceptsWithdrawalRequests));
      } else if (program instanceof CallDepositoryRegrouping) {
        return buildCallTransaction(new Transactions.DepositoryRegrouping(), Interface.buildDepositoryRegroupingTransaction(
          new AssetId(assets[asset].asset.id)));
      } else if (program instanceof CallDepositoryWithdrawal) {
        return buildCallTransaction(new Transactions.DepositoryWithdrawal(), Interface.buildDepositoryWithdrawalTransaction(
          new AssetId(assets[asset].asset.id),
          program.manager));
      }
      
      throw new Error('bad program type');
    } catch (exception) {
      AlertBox.open(AlertType.Error, (exception as Error).message);
      setLoadingTransaction(false);
      return null;
    }
  }, [programReady, loadingTransaction, assets, asset, nonce, conservative, gasPrice, gasLimit, program]);
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
      const hash = await Interface.submitTransaction(output.data, true);
      if (hash != null) {
        AlertBox.open(AlertType.Info, 'Transaction ' + hash + ' sent!');
        navigate('/');
      } else {
        AlertBox.open(AlertType.Error, 'Failed to send transaction!');
      }  
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to send transaction: ' + (exception as Error).message);
    }
    setLoadingTransaction(false);
    return true;
  }, [loadingTransaction, transactionReady, loadingTransaction, nonce, assets, asset, program]);
  useEffectAsync(async () => {
    const queryType = query.get('type');
    let queryAddress = Wallet.getAddress() || ownerAddress;
    switch (queryType) {
      case 'transfer': 
      default: {
        const result = new ProgramTransfer();
        result.to = [{ address: '', memo: null, value: '' }];
        setProgram(result);
       break; 
      }
      case 'withdrawal': {
        const result = new ProgramDepositoryWithdrawal();
        result.to = [{ address: '', value: '' }];
        try { result.routing = ((await Interface.getBlockchains()) || []).map((v) => { return { chain: v.chain, policy: v.routing_policy }}); } catch { }
        setProgram(result);
        break;
      }
      case 'certification': {
        const result = new CallCertification();
        try { result.assets = ((await Interface.getBlockchains()) || []).map((v) => AssetId.fromHandle(v.chain)); } catch { }
        queryAddress = await Interface.getSignerAddress() || ownerAddress;
        setProgram(result);
        break;
      }
      case 'adjustment': {
        queryAddress = await Interface.getSignerAddress() || ownerAddress;
        setProgram(new CallDepositoryAdjustment());
        break;
      }
      case 'regrouping': {
        queryAddress = await Interface.getSignerAddress() || ownerAddress;
        setProgram(new CallDepositoryRegrouping());
        break;
      }
      case 'migration': {
        queryAddress = await Interface.getSignerAddress() || ownerAddress;
        setProgram(new CallDepositoryWithdrawal());
        break;
      }
    }

    if (queryAddress != ownerAddress)
      setOwnerAddress(queryAddress);

    try {
      let assetData = await Interface.fetchAll((offset, count) => Interface.getAccountBalances(queryAddress, offset, count));
      if (Array.isArray(assetData)) {
        assetData = assetData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
        assetData = assetData.filter((item) => item.balance?.gt(0) || item.reserve?.gt(0) || item.supply?.gt(0));
      }

      const queryAsset = query.get('asset');
      if (queryAsset != null) {
        const target: AssetId = new AssetId(queryAsset);
        if (Array.isArray(assetData)) {
          const index = assetData.findIndex((item) => item.asset.id == target.id);
          if (index == -1) {
            assetData.push({
              asset: target,
              balance: new BigNumber(0),
              reserve: new BigNumber(0),
              supply: new BigNumber(0)
            });
            setAsset(assets.length - 1);
          } else {
            setAsset(index);
          }
        } else {
          assetData = [{
            asset: target,
            balance: new BigNumber(0),
            reserve: new BigNumber(0),
            supply: new BigNumber(0)
          }];
          setAsset(0);
        }
      }
      setAssets(assetData || []);
    } catch { }
  }, [query]);

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="640px">
      <Flex justify="between" align="center">
        <Heading>{ transactionType }</Heading>
        <Button variant="soft" size="2" color="indigo" onClick={() => navigate(-1)}>
          <Icon path={mdiBackburger} size={0.7} /> BACK
        </Button>
      </Flex>
      <Box width="100%" mt="3" mb="4">
        <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
      </Box>
      <Card>
        <Flex justify="between" align="center" mb="2" px="1">
          <Heading size="4">Paying account</Heading>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <Button variant="ghost" size="3" color="gray">⨎⨎</Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content side="left">
              <Tooltip content="Transfer/pay to one or more accounts">
                <DropdownMenu.Item shortcut="⟳ ₿" onClick={() => navigate('/interaction?type=transfer')}>Transfer</DropdownMenu.Item>
              </Tooltip>
              <DropdownMenu.Separator />
              <Tooltip content="Change block production and/or participation/attestation stake(s)">
                <DropdownMenu.Item shortcut="⟳ ₿" onClick={() => navigate('/interaction?type=certification')}>Configure validator</DropdownMenu.Item>
              </Tooltip>
              <DropdownMenu.Separator />
              <Tooltip content="Configure fee, security and functionality policy for a depository">
                <DropdownMenu.Item shortcut="⇌ ₿" onClick={() => navigate('/interaction?type=adjustment')}>Configure depository</DropdownMenu.Item>
              </Tooltip>
              <Tooltip content="Migrate depository participations to another manager (for participation unstaking)">
                <DropdownMenu.Item shortcut="→ ₿" color="red" onClick={() => navigate('/interaction?type=regrouping')}>Regroup depository</DropdownMenu.Item>
              </Tooltip>
              <Tooltip content="Migrate depository's custodial funds to another depository (for attestation unstaking)">
                <DropdownMenu.Item shortcut="→ ₿" color="red" onClick={() => navigate('/interaction?type=migration')}>Migrate depository</DropdownMenu.Item>
              </Tooltip>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Flex>
        <Select.Root size="3" value={asset.toString()} onValueChange={(value) => setAsset(parseInt(value))}>
          <Select.Trigger variant="surface" placeholder="Select account" style={{ width: '100%' }}>
          </Select.Trigger>
          <Select.Content variant="soft">
            <Select.Group>
              <Select.Item value="-1" disabled={true}>Select account</Select.Item>
              {
                assets.map((item, index) =>
                  <Select.Item key={item.hash + '_select'} value={index.toString()}>
                    <Flex align="center" gap="1">
                      <Avatar mr="1" size="1" radius="full" fallback={(item.asset.token || item.asset.chain)[0]} src={'/cryptocurrency/' + (item.asset.token || item.asset.chain).toLowerCase() + '.svg'} style={{ width: '24px', height: '24px' }} />
                      <Text size="4">{ Readability.toMoney(item.asset, item.balance) }</Text>
                    </Flex>
                  </Select.Item>
                )
              }
            </Select.Group>
          </Select.Content>
        </Select.Root>
        {
          asset != -1 && ownerAddress.length > 0 &&
          <Box width="100%" mt="3">
            <Tooltip content="Account that will send the transaction and pay for it">
              <TextField.Root size="3" placeholder="Transaction sender account" type="text" color="red" value={Readability.toAddress(ownerAddress, 16)} readOnly={true} />
            </Tooltip>
          </Box>
        }
        {
          asset != -1 && program instanceof ProgramDepositoryWithdrawal &&
          <Box width="100%" px="1" mt="3">
            <Tooltip content="If depository is busy with another withdrawal then do not withdraw">
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
            {
              item.memo != null &&
              <Tooltip content="Attach a message to payment">
                <TextField.Root mb="3" size="3" placeholder="Payment message" type="text" value={item.memo} onChange={(e) => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  copy.to[index].memo = e.target.value;
                  setProgram(copy);
                }} />
              </Tooltip>
            }
            <Flex gap="2">
              <Box width="100%">
                <Tooltip content="Payment value received by account">
                  <TextField.Root mb="3" size="3" placeholder={'Payment value in ' + (assets[asset].asset.token || assets[asset].asset.chain)} type="number" value={item.value} onChange={(e) => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    copy.to[index].value = e.target.value;
                    setProgram(copy);
                  }} />
                </Tooltip>
              </Box>
              <Button size="3" variant="outline" color="gray" onClick={() => setRemainingValue(index) }>Remaining</Button>
            </Flex>
            {
              omniTransaction &&
              <Flex justify="between">
                <Box px="1">
                  <Tooltip content="Identify payment by number">
                    <Text as="label" size="2" color={item.memo != null ? 'jade' : 'gray'}>
                      <Flex gap="2" align="center" justify="end">
                        <Checkbox size="3" checked={item.memo != null} onCheckedChange={(value) => {
                          const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                          copy.to[index].memo = value ? '' : null;
                          setProgram(copy);
                        }} />
                        <Text>Attach message</Text>
                      </Flex>
                    </Text>
                  </Tooltip>
                </Box>
                <IconButton variant="soft" color={index != 0 ? 'red' : 'jade'} disabled={!omniTransaction && index == 0} onClick={() => {
                  const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                  if (index == 0) {
                    copy.to.push({ address: '', memo: null, value: '' });
                  } else {
                    copy.to.splice(index, 1);
                  }
                  setProgram(copy);
                }}>
                  <Icon path={index == 0 ? mdiPlus : mdiMinus} size={0.7} />
                </IconButton>
              </Flex>
            }
          </Card>
        )
      }
      {
        asset != -1 && program instanceof ProgramDepositoryWithdrawal && program.to.map((item, index) =>
          <Card mt="4" key={index}>
            <Heading size="4" mb="2">Withdraw to account{ program.to.length > 1 ? ' #' + (index + 1) : ''}</Heading>
            <Flex gap="2" mb="3">
              <Box width="100%">
                <Tooltip content="Withdraw to Your pre-registered address">
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
                  <TextField.Root mb="3" size="3" placeholder={'Payment value in ' + (assets[asset].asset.token || assets[asset].asset.chain)} type="number" value={item.value} onChange={(e) => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    copy.to[index].value = e.target.value;
                    setProgram(copy);
                  }} />
                </Tooltip>
              </Box>
              <Button size="3" variant="outline" color="gray" onClick={() => setRemainingValue(index) }>Remaining</Button>
            </Flex>
            {
              omniTransaction &&
              <Flex justify="end">
                <IconButton variant="soft" color={index != 0 ? 'red' : 'jade'} disabled={!omniTransaction && index == 0} onClick={() => {
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
          </Card>
        )
      }
      {
        asset != -1 && program instanceof CallCertification &&
        <Card mt="4">
          <Heading size="4" mb="2">Block production</Heading>
          <Select.Root size="3" value={program.blockProduction} onValueChange={(value) => {
            const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
            copy.blockProduction = value as any;
            setProgram(copy);
          }}>
            <Select.Trigger variant="surface" placeholder="Select block production" style={{ width: '100%' }}>
            </Select.Trigger>
            <Select.Content color="gray">
              <Select.Item value="standby">No change</Select.Item>
              <Select.Item value="enable">
                Set <Text color="jade">ONLINE</Text>
              </Select.Item>
              <Select.Item value="disable">
                Set <Text color="red">OFFLINE</Text>
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
                    <TextField.Root mb="3" size="3" placeholder={'Stake value in ' + (item.asset.token || item.asset.chain)} type="number" value={item.stake || ''} disabled={item.stake == null} onChange={(e) => {
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
                    <TextField.Root mb="3" size="3" placeholder={'Stake value in ' + (item.asset.token || item.asset.chain)} type="number" value={item.stake || ''} disabled={item.stake == null} onChange={(e) => {
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
        asset != -1 && program instanceof CallDepositoryAdjustment &&
        <Card mt="4">
          <Heading size="4" mb="2">Depository fee policy</Heading>
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
            <Tooltip content="Determines how many participants must be present to sign transactions">
              <TextField.Root size="3" placeholder="Security level (2-16)" type="text" value={program.securityLevel.toString()} onChange={(e) => {
                const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                copy.securityLevel = parseInt(e.target.value) || 0;
                setProgram(copy);
              }} />
            </Tooltip>
          </Box>
          <Box width="100%" mt="3">
            <Tooltip content="Allow others to generate depository accounts for your depository">
              <Text as="label" size="2" color={program.acceptsAccountRequests ? 'jade' : 'red'}>
                <Flex gap="2">
                  <Checkbox size="3" checked={program.acceptsAccountRequests} onCheckedChange={(value) => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    copy.onlyIfNotInQueue = (value.valueOf() as boolean);
                    setProgram(copy);
                  }} />
                  <Text>Enable account generation</Text>
                </Flex>
              </Text>
            </Tooltip>
          </Box>
          <Box width="100%" mt="3">
            <Tooltip content="Allow others to withdraw their funds from your depository">
              <Text as="label" size="2" color={program.acceptsWithdrawalRequests ? 'jade' : 'red'}>
                <Flex gap="2">
                  <Checkbox size="3" checked={program.acceptsWithdrawalRequests} onCheckedChange={(value) => {
                    const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                    copy.onlyIfNotInQueue = (value.valueOf() as boolean);
                    setProgram(copy);
                  }} />
                  <Text>Enable account withdrawals</Text>
                </Flex>
              </Text>
            </Tooltip>
          </Box>
        </Card>
      }
      {
        asset != -1 && program instanceof CallDepositoryWithdrawal &&
        <Card mt="4">
          <Heading size="4" mb="2">Migrate to manager account</Heading>
          <Box width="100%">
            <Tooltip content="Send to depository custody funds to this manager address">
              <TextField.Root size="3" placeholder="New manager address" type="text" value={program.manager} onChange={(e) => {
                const copy = Object.assign(Object.create(Object.getPrototypeOf(program)), program);
                copy.manager = e.target.value;
                setProgram(copy);
              }} />
            </Tooltip>
          </Box>
        </Card>
      }
      {
        programReady &&
        <Card mt="4">
          <Heading size="4" mb="2">Transaction cost</Heading>
          <Flex gap="2" mt="2">
            <Box width="100%">
              <Tooltip content="Higher gas price speeds up transactions">
                <TextField.Root mb="3" size="3" placeholder="Gas price" type="number" value={gasPrice} onChange={(e) => setGasPrice(e.target.value)} />
              </Tooltip>
            </Box>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <Button size="3" variant="outline" color="gray" disabled={loadingTransaction || loadingGasLimit} loading={loadingGasPrice}>
                  Estimate
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.95)} shortcut="> 95%">Fastest</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.75)} shortcut="> 75%">Fast</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.50)} shortcut="> 50%">Medium</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.25)} shortcut="> 25%">Slow</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loadingTransaction || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.10)} shortcut="> 10%">Slowest</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
          <Flex gap="2">
            <Box width="100%">
              <Tooltip content="Gas limit caps max transaction cost">
                <TextField.Root mb="3" size="3" placeholder="Gas limit" type="number" disabled={loadingGasPrice} value={gasLimit} onChange={(e) => setGasLimit(e.target.value)} />
              </Tooltip>
            </Box>
            <Button size="3" variant="outline" color="gray" disabled={loadingTransaction || loadingGasPrice} loading={loadingGasLimit} onClick={() => setCalculatedGasLimit()}>Calculate</Button>
          </Flex>
          <Box px="1" mt="2">
            <Tooltip content="If transaction fails do not include it in a block (without error report)">
              <Text as="label" size="2" color={conservative ? 'red' : 'jade'}>
                <Flex gap="2">
                  <Checkbox size="3" checked={!conservative} onCheckedChange={(value) => setConservative(!(value.valueOf() as boolean))} />
                  <Text>Pay for completed only</Text>
                </Flex>
              </Text>
            </Tooltip>
          </Box>
          {
            maxFeeValue.dividedBy(sendingValue).multipliedBy(100).toNumber() > 40.0 &&
            <Flex justify="end" pt="4">
              <Text color="orange" size="2" weight="medium">Warning: transaction fee may cost up to {maxFeeValue.dividedBy(sendingValue).multipliedBy(100).toNumber().toFixed(2)}% of paying value</Text>
            </Flex>
          }
        </Card>
      }
      {
        transactionReady &&
        <Box mt="4">
          <Card>
            <Heading size="4" mb="2">Check transaction</Heading>
            <Flex gap="2" mt="2">
              <Box width="100%">
                <Tooltip content="Future transaction hash">
                  <TextField.Root mb="3" size="3" placeholder="Transaction hash" readOnly={true} value={Readability.toHash(transactionData?.hash)} onClick={() => {
                    navigator.clipboard.writeText(transactionData?.hash || 'none');
                    AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                  }}/>
                </Tooltip>
              </Box>
              <Button size="3" variant="outline" color="gray" disabled={loadingGasPrice || loadingGasLimit} loading={loadingTransaction} onClick={() => buildTransaction()}>Redo</Button>
            </Flex>
            <Tooltip content="Transaction data that will be sent to a node">
              <TextField.Root mb="3" size="3" placeholder="Transaction data" readOnly={true} value={Readability.toHash(transactionData?.data)} onClick={() => {
                navigator.clipboard.writeText(transactionData?.data || 'none');
                AlertBox.open(AlertType.Info, 'Transaction data copied!')
              }}/>
            </Tooltip>
            <Flex gap="2" mb="3">
              <Box width="100%">
                <Tooltip content="Account that pays for transaction">
                  <TextField.Root size="3" placeholder="Paying account" readOnly={true} value={Readability.toAddress(ownerAddress)} onClick={() => {
                    navigator.clipboard.writeText(ownerAddress);
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}/>
                </Tooltip>
              </Box>
              <Button size="3" variant="outline" color="gray">
                <Link className="router-link" to={'/account/' + ownerAddress}>▒▒</Link>
              </Button>
            </Flex>
            {
              (program instanceof ProgramTransfer || program instanceof ProgramDepositoryWithdrawal) &&
              <Tooltip content="Total transaction payment value">
                <TextField.Root mb="3" size="3" placeholder="Payment value" readOnly={true} value={ '— ' + Readability.toMoney(assets[asset].asset, sendingValue) + ' as payment' } onClick={() => {
                  navigator.clipboard.writeText(sendingValue.toString());
                  AlertBox.open(AlertType.Info, 'Value copied!')
                }}/>
              </Tooltip>
            }
            <Tooltip content="Max possible transaction fee">
              <TextField.Root mb="3" size="3" placeholder="Max fee value" readOnly={true} value={ '— ' + Readability.toMoney(assets[asset].asset, maxFeeValue) + ' as max fee' } onClick={() => {
                navigator.clipboard.writeText(maxFeeValue.toString());
                AlertBox.open(AlertType.Info, 'Value copied!')
              }}/>
            </Tooltip>
            <Tooltip content="Total transaction payment value including max possible fee">
              <TextField.Root mb="1" size="3" placeholder="Payment value" readOnly={true} value={ '— ' + Readability.toMoney(assets[asset].asset, sendingValue.plus(maxFeeValue)) + ' as max total cost' } onClick={() => {
                navigator.clipboard.writeText(sendingValue.plus(maxFeeValue).toString());
                AlertBox.open(AlertType.Info, 'Value copied!')
              }}/>
            </Tooltip>
          </Card>
          <Flex justify="center" mt="4">
            <Dialog.Root>
              <Dialog.Trigger>
                <Button variant="outline" size="3" color="jade" disabled={loadingGasPrice || loadingGasLimit} loading={loadingTransaction} onClick={() => buildTransaction()}>Submit transaction</Button>
              </Dialog.Trigger>
              <Dialog.Content maxWidth="450px">
                <Dialog.Title mb="0">Confirmation</Dialog.Title>
                <Dialog.Description mb="3" size="2" color="gray">This transaction will be sent to one of the nodes</Dialog.Description>
                <Box>
                  {
                    asset != -1 && program instanceof ProgramTransfer &&
                    <Text as="div" weight="light" size="4" mb="1">— Send <Text color="red">{ Readability.toMoney(assets[asset].asset, sendingValue) }</Text> to <Text color="sky">{ Readability.toCount('account', program.to.length) }</Text></Text>        
                  }
                  {
                    asset != -1 && program instanceof ProgramDepositoryWithdrawal &&
                    <>
                      <Text as="div" weight="light" size="4" mb="1">— Withdraw <Text color="red">{ Readability.toMoney(assets[asset].asset, sendingValue) }</Text> to <Text color="sky">{ Readability.toCount('account', program.to.length) }</Text></Text>
                      <Text as="div" weight="light" size="4" mb="1">— Withdraw through <Badge radius="medium" variant="surface" size="2">{ 
                          (query.get('manager') || 'NULL').substring((query.get('manager') || 'NULL').length - 6).toUpperCase()
                      }</Badge> node</Text>
                    </>
                  }
                  {
                    asset != -1 && program instanceof CallCertification &&
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
                    asset != -1 && program instanceof CallDepositoryAdjustment &&
                    <Text as="div" weight="light" size="4" mb="1">— Adjust a { assets[asset].chain } depository of a validator node by using { program.incomingFee.length > 0 && new BigNumber(program.incomingFee).gt(0) ? 'paid' : 'free' } deposits and { program.outgoingFee.length > 0 && new BigNumber(program.outgoingFee).gt(0) ? 'paid' : 'free' } withdrawals</Text>        
                  }
                  {
                    asset != -1 && program instanceof CallDepositoryRegrouping &&
                    <Text as="div" weight="light" size="4" mb="1">— Regroup participation of a validator node (to possibly unstake the participation stake)</Text>        
                  }
                  {
                    asset != -1 && program instanceof CallDepositoryWithdrawal &&
                    <Text as="div" weight="light" size="4" mb="1">— Migration a { assets[asset].chain } depository of a validator node to <Badge radius="medium" variant="surface" size="2">{ 
                        program.manager.substring(program.manager.length - 6).toUpperCase()
                    }</Badge> node</Text>
                  }
                  <Text as="div" weight="light" size="4" mb="1">— Pay up to <Text color="orange">{ Readability.toMoney(assets[asset].asset, maxFeeValue) }</Text> to <Text color="sky">miner as fee</Text></Text>
                </Box>
                <Flex gap="3" mt="4" justify="between">
                  <Dialog.Close>
                    <Button variant="soft" color="gray">Cancel</Button>
                  </Dialog.Close>
                  <Dialog.Close>
                    <Button color="red" disabled={loadingGasPrice || loadingGasLimit} loading={loadingTransaction} onClick={() => submitTransaction()}>Submit</Button>
                  </Dialog.Close>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </Flex>
        </Box>
      }
    </Box>
  )
}