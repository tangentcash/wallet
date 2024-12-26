import { mdiBackburger, mdiMinus, mdiPlus } from "@mdi/js";
import { Avatar, Badge, Box, Button, Card, Checkbox, DataList, Dialog, DropdownMenu, Flex, Heading, IconButton, Select, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useCallback, useMemo, useState } from "react";
import { useEffectAsync } from "../core/extensions/react";
import { Interface, TransactionOutput, Wallet } from "../core/wallet";
import { AssetId, Signing, Uint256 } from "../core/tangent/algorithm";
import { Readability } from "../core/text";
import { Link, useNavigate } from "react-router";
import { Transactions } from "../core/tangent/schema";
import { AlertBox, AlertType } from "../components/alert";
import Icon from "@mdi/react";
import BigNumber from "bignumber.js";

export default function InteractionPage() {
  const ownerAddress = Wallet.getAddress() || '';
  const orientation = document.body.clientWidth < 500 ? 'vertical' : 'horizontal';
  const [assets, setAssets] = useState<any[]>([]);
  const [asset, setAsset] = useState(-1);
  const [sequence, setSequence] = useState<BigNumber | null>();
  const [gasPrice, setGasPrice] = useState('');
  const [gasLimit, setGasLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGasPrice, setLoadingGasPrice] = useState(false);
  const [loadingGasLimit, setLoadingGasLimit] = useState(false);
  const [conservative, setConservative] = useState(false);
  const [transactionData, setTransactionData] = useState<TransactionOutput | null>(null);
  const [to, setTo] = useState<{ address: string, memo: string | null, value: string }[]>([{ address: '', memo: null, value: '' }]);
  const navigate = useNavigate();
  const sendingValue = useMemo((): BigNumber => {
    return to.reduce((value, next) => {
      try {
        const numeric = new BigNumber(next.value.trim());
        return numeric.isPositive() ? value.plus(numeric) : value;
      } catch {
        return value;
      }
    }, new BigNumber(0));
  }, [to, assets]);
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
  const paymentsReady = useMemo((): boolean => {
    if (asset == -1)
      return false;

    for (let i = 0; i < to.length; i++) {
      const payment = to[i];
      const paymentAddress = payment.address.trim();
      if (paymentAddress == ownerAddress)
        return false;

      const publicKeyHash = Signing.decodeAddress(paymentAddress);
      if (!publicKeyHash || publicKeyHash.data.length != 20)
        return false;

      try {
        const numeric = new BigNumber(payment.value.trim());
        if (!numeric.isPositive())
          return false;
      } catch {
        return false;
      }
    }
    
    return sendingValue.gt(0) && sendingValue.lte(assets[asset].balance);
  }, [asset, to, gasPrice, gasLimit, conservative, assets]);
  const transactionReady = useMemo((): boolean => {
    if (!paymentsReady)
      return false;

    try {
      const numeric = new BigNumber(gasPrice.trim());
      if (!numeric.gte(0))
        return false;
    } catch {
      return false;
    }
    
    try {
      const numeric = new BigNumber(gasLimit.trim());
      if (!numeric.gt(0) || !numeric.isInteger())
        return false;
    } catch {
      return false;
    }

    return maxFeeValue.plus(sendingValue).lte(assets[asset].balance);
  }, [paymentsReady, gasPrice, gasLimit, maxFeeValue, sendingValue, assets, asset]);
  const setRemainingValue = useCallback((index: number) => {
    const balance = assets[asset].balance;
    let value = balance.minus(sendingValue);
    try {
      const numeric = new BigNumber(to[index].value.trim());
      if (numeric.isPositive())
        value = value.minus(numeric);
    } catch { }
    
    const copy = [...to];
    copy[index].value = value.lt(0) ? '0' : value.toString();
    console.log(sendingValue.toString());
    setTo(copy);
  }, [assets, asset, to]);
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
  }, [loadingGasLimit, to, transactionReady, loading, sequence, assets, asset]);
  const buildTransaction = useCallback(async (prebuilt?: TransactionOutput): Promise<TransactionOutput | null> => {
    if (!paymentsReady || loading)
      return null;
    
    setLoading(true);
    try {
      const output = await Wallet.buildTransaction({
        asset: new AssetId(assets[asset].asset.id),
        sequence: prebuilt ? prebuilt.body.sequence.toString() : (sequence || undefined),
        conservative: conservative,
        gasPrice: gasPrice,
        gasLimit: prebuilt ? prebuilt.body.gasLimit.toString() : gasLimit,
        method: to.length > 1 ? {
          type: new Transactions.Omnitransfer(),
          args: {
            to: to.map((payment) => ({
              memo: payment.memo || '',
              value: new BigNumber(payment.value),
              to: Signing.decodeAddress(payment.address)
            }))
          }
        } : {
          type: new Transactions.Transfer(),
          args: {
            memo: to[0].memo || '',
            value: new BigNumber(to[0].value),
            to: Signing.decodeAddress(to[0].address)
          }
        }
      });
      setSequence(new BigNumber(output.body.sequence.toString()));
      setTransactionData(output);
      setLoading(false);
      return output;
    } catch (exception) {
      AlertBox.open(AlertType.Error, (exception as Error).message);
      setLoading(false);
      return null;
    }
  }, [paymentsReady, loading, assets, asset, sequence, conservative, gasPrice, gasLimit, to]);
  const submitTransaction = useCallback(async () => {
    if (loading)
      return false;

    const output = await buildTransaction();
    if (!output) {
      AlertBox.open(AlertType.Error, 'Cannot build transaction');
      return false;
    }

    setLoading(true);
    try {
      const hash = await Interface.submitTransaction(output.data);
      if (hash != null) {
        AlertBox.open(AlertType.Info, 'Transaction ' + hash + ' sent!');
        navigate('/');
      } else {
        AlertBox.open(AlertType.Error, 'Failed to send transaction!');
      }  
    } catch (exception) {
      AlertBox.open(AlertType.Error, 'Failed to send transaction: ' + (exception as Error).message);
    }
    setLoading(false);
    return true;
  }, [loading, to, transactionReady, loading, sequence, assets, asset]);
  useEffectAsync(async () => {
    try {
      let assetData = await Interface.fetchAll((offset, count) => Interface.getAccountBalances(ownerAddress, offset, count));
      if (Array.isArray(assetData)) {
        assetData = assetData.sort((a, b) => new AssetId(a.asset.id).handle.localeCompare(new AssetId(b.asset.id).handle));
        setAssets(assetData.filter((item) => item.balance?.gt(0) || item.reserve?.gt(0) || item.supply?.gt(0)));
      }
    } catch { }
  }, []);

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="640px">
      <Flex justify="between" align="center">
        <Heading>{ to.length > 1 ? 'Pay to many' : 'Pay to one' }</Heading>
        <Button variant="soft" size="2" color="indigo" onClick={() => navigate(-1)}>
          <Icon path={mdiBackburger} size={0.7} /> BACK
        </Button>
      </Flex>
      <Box width="100%" mt="3" mb="4">
        <Box style={{ border: '1px dashed var(--gray-8)' }}></Box>
      </Box>
      <Card>
        <Heading size="4" mb="2">Paying account</Heading>
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
      </Card>
      {
        asset != -1 && to.map((item, index) =>
          <Card mt="4" key={index}>
            <Heading size="4" mb="2">Recepient account{ to.length > 1 ? ' #' + (index + 1) : ''}</Heading>
            <Flex gap="2" mb="3">
              <Box width="100%">
                <Tooltip content="Pay to account address">
                  <TextField.Root size="3" placeholder="Pay to account" type="text" value={item.address} onChange={(e) => {
                    const copy = [...to];
                    copy[index].address = e.target.value;
                    setTo(copy);
                  }} />
                </Tooltip>
              </Box>
              <Button size="3" variant="outline" color="gray" disabled={!paymentsReady}>
                <Link className="router-link" to={'/account/' + item.address}>▒▒</Link>
              </Button>
            </Flex>
            {
              item.memo != null &&
              <Tooltip content="Attach a message to payment">
                <TextField.Root mb="3" size="3" placeholder="Payment message" type="text" value={item.memo} onChange={(e) => {
                  const copy = [...to];
                  copy[index].memo = e.target.value;
                  setTo(copy);
                }} />
              </Tooltip>
            }
            <Flex gap="2">
              <Box width="100%">
                <Tooltip content="Payment value received by account">
                  <TextField.Root mb="3" size="3" placeholder={'Payment value in ' + (assets[asset].asset.token || assets[asset].asset.chain)} type="number" value={item.value} onChange={(e) => {
                    const copy = [...to];
                    copy[index].value = e.target.value;
                    setTo(copy);
                  }} />
                </Tooltip>
              </Box>
              <Button size="3" variant="outline" color="gray" onClick={() => setRemainingValue(index) }>Remaining</Button>
            </Flex>
            <Flex justify="between" mt="2">
              <Box px="1">
                <Tooltip content="Identify payment by number">
                  <Text as="label" size="2" color={item.memo != null ? 'jade' : 'gray'}>
                    <Flex gap="2" align="center" justify="end">
                      <Checkbox size="3" checked={item.memo != null} onCheckedChange={(value) => {
                        const copy = [...to];
                        copy[index].memo = value ? '' : null;
                        setTo(copy);
                      }} />
                      <Text>Attach message</Text>
                    </Flex>
                  </Text>
                </Tooltip>
              </Box>
              <IconButton variant="soft" color={index != 0 ? 'red' : 'jade'} onClick={() => {
                const copy = [...to];
                if (index == 0) {
                  copy.push({ address: '', memo: null, value: '' });
                } else {
                  copy.splice(index, 1);
                }
                setTo(copy);
              }}>
                <Icon path={index == 0 ? mdiPlus : mdiMinus} size={0.7} />
              </IconButton>
            </Flex>
          </Card>
        )
      }
      {
        paymentsReady &&
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
                <Button size="3" variant="outline" color="gray" disabled={loading || loadingGasLimit} loading={loadingGasPrice}>
                  Estimate
                  <DropdownMenu.TriggerIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item disabled={loading || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.95)} shortcut="> 95%">Fastest</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loading || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.75)} shortcut="> 75%">Fast</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loading || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.50)} shortcut="> 50%">Medium</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loading || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.25)} shortcut="> 25%">Slow</DropdownMenu.Item>
                <DropdownMenu.Item disabled={loading || loadingGasPrice || loadingGasLimit} onClick={() => setEstimatedGasPrice(0.10)} shortcut="> 10%">Slowest</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Flex>
          <Flex gap="2">
            <Box width="100%">
              <Tooltip content="Gas limit caps max transaction cost">
                <TextField.Root mb="3" size="3" placeholder="Gas limit" type="number" disabled={loadingGasPrice} value={gasLimit} onChange={(e) => setGasLimit(e.target.value)} />
              </Tooltip>
            </Box>
            <Button size="3" variant="outline" color="gray" disabled={loading || loadingGasPrice} loading={loadingGasLimit} onClick={() => setCalculatedGasLimit()}>Calculate</Button>
          </Flex>
          <Box px="1" mt="2">
            <Tooltip content="If transaction fails do not include it in a block">
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
                  <TextField.Root mb="3" size="3" placeholder="Transaction hash" readOnly={true} value={transactionData ? transactionData.hash.substring(0, 16) + '...' + transactionData.hash.substring(transactionData.hash.length - 16) : ''} onClick={() => {
                    navigator.clipboard.writeText(transactionData?.hash || 'none');
                    AlertBox.open(AlertType.Info, 'Transaction hash copied!')
                  }}/>
                </Tooltip>
              </Box>
              <Button size="3" variant="outline" color="gray" disabled={loadingGasPrice || loadingGasLimit} loading={loading} onClick={() => buildTransaction()}>Redo</Button>
            </Flex>
            <Tooltip content="Transaction data that will be sent to a node">
              <TextField.Root mb="3" size="3" placeholder="Transaction data" readOnly={true} value={transactionData ? transactionData.data.substring(0, 20) + '...' + transactionData.data.substring(transactionData.data.length - 20) : ''} onClick={() => {
                navigator.clipboard.writeText(transactionData?.data || 'none');
                AlertBox.open(AlertType.Info, 'Transaction data copied!')
              }}/>
            </Tooltip>
            <Flex gap="2" mb="3">
              <Box width="100%">
                <Tooltip content="Account that pays for transaction">
                  <TextField.Root size="3" placeholder="Paying account" readOnly={true} value={ownerAddress.substring(0, 16) + '...' + ownerAddress.substring(ownerAddress.length - 16)} onClick={() => {
                    navigator.clipboard.writeText(ownerAddress);
                    AlertBox.open(AlertType.Info, 'Address copied!')
                  }}/>
                </Tooltip>
              </Box>
              <Button size="3" variant="outline" color="gray">
                <Link className="router-link" to={'/account/' + ownerAddress}>▒▒</Link>
              </Button>
            </Flex>
            <Tooltip content="Total transaction payment value">
              <TextField.Root mb="3" size="3" placeholder="Payment value" readOnly={true} value={ '— ' + Readability.toMoney(assets[asset].asset, sendingValue) + ' as payment' } onClick={() => {
                navigator.clipboard.writeText(sendingValue.toString());
                AlertBox.open(AlertType.Info, 'Value copied!')
              }}/>
            </Tooltip>
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
                <Button variant="outline" size="3" color="jade" disabled={loadingGasPrice || loadingGasLimit} loading={loading} onClick={() => buildTransaction()}>Submit transaction</Button>
              </Dialog.Trigger>
              <Dialog.Content maxWidth="450px">
                <Dialog.Title mb="0">Confirmation</Dialog.Title>
                <Dialog.Description mb="3" size="2" color="gray">This transaction will be sent to one of the nodes</Dialog.Description>
                {
                  asset != -1 &&
                  <Box>
                    <Text as="div" weight="light" size="4" mb="1">— Paying <Text color="red">{ Readability.toMoney(assets[asset].asset, sendingValue) }</Text> to <Text color="sky">{ Readability.toCount('account', to.length) }</Text></Text>
                    <Text as="div" weight="light" size="4" mb="1">— Paying up to <Text color="orange">{ Readability.toMoney(assets[asset].asset, maxFeeValue) }</Text> to <Text color="sky">miner as fee</Text></Text>
                  </Box>
                }
                <Flex gap="3" mt="4" justify="between">
                  <Dialog.Close>
                    <Button variant="soft" color="gray">Cancel</Button>
                  </Dialog.Close>
                  <Dialog.Close>
                    <Button color="red" disabled={loadingGasPrice || loadingGasLimit} loading={loading} onClick={() => submitTransaction()}>Submit</Button>
                  </Dialog.Close>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </Flex>
        </Box>
      }
    </Box>
  )

  return (
    <Box px="4" pt="4" mx="auto" maxWidth="640px">
      <Card>
        <DataList.Root orientation={orientation}>
          <DataList.Item align="center">
            <DataList.Label>Paying value:</DataList.Label>
            <DataList.Value>
              <Badge color={asset != -1 ? 'red' : 'gray'} variant="soft" radius="full" size="3">{ asset != -1 ? Readability.toMoney(assets[asset].asset, sendingValue) : 'none' }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item align="center">
            <DataList.Label>Max fee value:</DataList.Label>
            <DataList.Value>
              <Badge color={asset != -1 ? 'orange' : 'gray'} variant="soft" radius="full" size="3">{ asset != -1 ? Readability.toMoney(assets[asset].asset, maxFeeValue) : 'none' }</Badge>
            </DataList.Value>
          </DataList.Item>
          <DataList.Item align="center">
            <DataList.Label>Max paying value:</DataList.Label>
            <DataList.Value>
              <Badge color={asset != -1 ? 'green' : 'gray'} variant="soft" radius="full" size="3">{ asset != -1 ? Readability.toMoney(assets[asset].asset, sendingValue.plus(maxFeeValue)) : 'none' }</Badge>
            </DataList.Value>
          </DataList.Item>
        </DataList.Root>
      </Card>
    </Box>
  )
}