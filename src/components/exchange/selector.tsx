import { mdiAlphabeticalVariant, mdiCancel, mdiConsole, mdiMagnify, mdiPlus } from "@mdi/js";
import { Badge, Box, Button, Dialog, Flex, IconButton, Select, Spinner, Text, TextField, Tooltip } from "@radix-ui/themes";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AssetId, Readability, Whitelist } from "tangentsdk";
import { Exchange, BlockchainInfo } from "../../core/exchange";
import Icon from "@mdi/react";
import { AssetImage, AssetName } from "../asset";

export default function AssetSelector(props: { children: ReactNode, title?: string, value?: AssetId | null, onChange?: (asset: AssetId | null) => void }) {
  const [launching, setLaunching] = useState(false);
  const [loading, setLoading] = useState<null | number>(null);
  const [policyIndex, setPolicyIndex] = useState<number | null>(null);
  const [symbol, setSymbol] = useState('');
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [assets, setAssets] = useState<{ asset: AssetId, contractAddress: boolean | string }[]>([]);
  const policy = useMemo((): BlockchainInfo | null => policyIndex != null ? Exchange.descriptors[policyIndex] : null, [policyIndex]);
  const customToken = useMemo((): (AssetId & { contractAddress: boolean | string }) | null => {
    const targetSymbol = symbol.trim(), targetAddress = address.trim();
    if (!policy || !targetSymbol.length || targetAddress.length < 32)
      return null;

    const result: any = AssetId.fromHandle(policy.chain || policy.handle, targetSymbol, targetAddress);
    result.contractAddress = Whitelist.contractAddressOf(result);
    return result;
  }, [policy, symbol, address]);
  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    setAssets([]);
    if (loading != null)
      clearTimeout(loading);

    if (value.length > 0) {
      setLoading(setTimeout(async () => {
        try {
          const result = await Exchange.assetQuery(value);
          setAssets(result.map((x) => ({ asset: x, contractAddress: Whitelist.contractAddressOf(x) })).sort((a, b) => {
            if ((a.contractAddress && !b.contractAddress) || (!a.asset.token && b.asset.token)) {
              return -1;
            } else if ((!a.contractAddress && b.contractAddress) || (a.asset.token && !b.asset.token)) {
              return 1;
            } else {
              const nameA = a.asset.token || a.asset.chain || a.asset.handle;
              const nameB = b.asset.token || b.asset.chain || b.asset.handle;
              const comparison = nameA.localeCompare(nameB);
              return comparison == 0 ? a.asset.handle.localeCompare(b.asset.handle) : comparison;
            }
          }));
        } catch { }
        setLoading(null);
      }, 300) as any);
    } else {
      setLoading(null);
    }
  }, [loading]);
  const useAsset = useCallback((asset: AssetId | null) => {
    if (props.onChange)
      props.onChange(asset ? new AssetId(asset.id) : null);
  }, []);
  useEffect(() => {
    if (props.value === undefined)
      return;

    setAddress('');
    if (props.value != null) {
      const policyId = Exchange.descriptors.findIndex((item) => item.chain == props.value?.chain);
      const asset = new AssetId(props.value.id);
      setQuery(props.value.handle);
      setPolicyIndex(policyId != -1 ? policyId : null);
      setSymbol(props.value?.token || '');
      setAssets([{ asset: asset, contractAddress: Whitelist.contractAddressOf(asset) }]);
    } else {
      setQuery('');
      setPolicyIndex(null);
      setSymbol('');
      setAssets([]);
    }
  }, [props.value]);

  return (
	<Dialog.Root>
		<Dialog.Trigger>{ props.children }</Dialog.Trigger>
    <Dialog.Content maxWidth="450px">
    {
      !launching &&
      <Box>
        <Dialog.Title>Find { props.title || ' a token' }</Dialog.Title>
        <Flex justify="between" align="center" gap="2" mt="3">
          <Tooltip content="Find already added tokens by their symbol">
            <TextField.Root placeholder="Try ETH…" size="3" style={{ width: '100%' }} value={query} onChange={(e) => updateQuery(e.currentTarget.value)}>
              <TextField.Slot>
                <Icon path={mdiMagnify} size={0.8}></Icon>
              </TextField.Slot>
            </TextField.Root>
          </Tooltip>
          <Tooltip content="Add a new token using public information">
            <IconButton variant="soft" size="3" onClick={() => setLaunching(true)}>
              <Icon path={mdiPlus} size={0.8}></Icon>
            </IconButton>
          </Tooltip>
        </Flex>
        <Box px="2" pt="1">
          {
            assets.map((item) =>
              <Dialog.Close key={item.asset.id}>
                <Button variant="ghost" color="gray" size="4" radius="none" style={{ width: '100%', padding: '8px 8px', display: 'block', borderRadius: '24px' }} mt="4" onClick={() => useAsset(item.asset)}>
                  <Flex align="center" gap="2">
                    <AssetImage asset={item.asset} size="2" iconSize="48px"></AssetImage>
                    <Flex align="start" direction="column">
                      <AssetName asset={item.asset}></AssetName>
                      <Flex gap="2" align="center" wrap="wrap">
                        <Text size="2">{ Readability.toAssetSymbol(item.asset) }</Text>
                        { typeof item.contractAddress == 'string' && <Badge color="amber" size="1" radius="full">{ Readability.toAddress(item.contractAddress, 8) }</Badge> }
                      </Flex>
                    </Flex>
                  </Flex>
                </Button>
              </Dialog.Close>)
          }
          {
            !assets.length && !loading && query.length > 0 &&
            <Flex width="100%" justify="center" pt="4">
              <Text color="gray" size="2" align="center">No tokens found</Text>
            </Flex>
          }
          {
            loading != null && 
            <Flex width="100%" justify="center" pt="6">
              <Spinner size="3"></Spinner>
            </Flex>
          }
        </Box>
      </Box>
    }
    {
      launching &&
      <Box>
        <Dialog.Title>New { props.title || ' token' }</Dialog.Title>
        <Tooltip content="Blockchain network where target token is launched">
          <Select.Root value={policyIndex != null ? policyIndex.toString() : '-1'} size="3" onValueChange={(value) => setPolicyIndex(parseInt(value))}>
            <Select.Trigger variant="soft" color="gray" style={{ width: '100%' }}>
              {
                policy != null &&
                <Flex align="center" gap="1">
                  <AssetImage asset={policy} size="1" iconSize="16px"></AssetImage>
                  <AssetName asset={policy} size="2"></AssetName>
                </Flex>
              }
              {
                !policy &&
                <Text>Token's blockchain</Text>
              }
            </Select.Trigger>
            <Select.Content position="popper" side="bottom" color="gray">
              <Select.Item value={"-1"} disabled={true}>Token's blockchain</Select.Item>
              {
                Exchange.descriptors.map((item, index) =>
                  <Select.Item key={item.id + 'select'} value={index.toString()}>
                    <Flex align="center" gap="1">
                      <AssetImage asset={item} size="1" iconSize="16px"></AssetImage>
                      <AssetName asset={item} size="2"></AssetName>
                    </Flex>
                  </Select.Item>)
              }
            </Select.Content>
          </Select.Root>
        </Tooltip>
        <Box py="3">
          <Tooltip content="Contract address located in previously selected blockchain network that is representing target token">
            <TextField.Root placeholder="Token's contract address" size="3" style={{ width: '100%' }} value={address} onChange={(e) => setAddress(e.currentTarget.value)}>
              <TextField.Slot>
                <Icon path={mdiConsole} size={0.8}></Icon>
              </TextField.Slot>
            </TextField.Root>
          </Tooltip>
        </Box>
        <Flex justify="between" align="center" gap="2">
          <Tooltip content="Official market symbol (ticker) of target token (possibly coming from smart contract)">
            <TextField.Root placeholder="Token's symbol (e.g. USDT)" size="3" style={{ width: '100%' }} value={symbol} onChange={(e) => setSymbol(e.currentTarget.value)}>
              <TextField.Slot>
                <Icon path={mdiAlphabeticalVariant} size={0.8}></Icon>
              </TextField.Slot>
            </TextField.Root>
          </Tooltip>
          <IconButton variant="soft" size="3" color="red" onClick={() => setLaunching(false)}>
            <Icon path={mdiCancel} size={0.8}></Icon>
          </IconButton>
        </Flex>
        {
          policy != null &&
          <Box px="2" pt="1">
            {
              customToken != null &&
              <Dialog.Close>
                <Button variant="ghost" color="gray" size="4" radius="none" style={{ width: '100%', padding: '4px 8px', display: 'block', borderRadius: '24px' }} mt="6" onClick={() => useAsset(customToken)}>
                  <Flex align="center" gap="2">
                    <AssetImage asset={customToken} size="2" iconSize="48px"></AssetImage>
                    <Flex align="start" direction="column">
                      <AssetName asset={customToken} size="2"></AssetName>
                      <Flex gap="2" align="center" wrap="wrap">
                        <Text size="2">{ Readability.toAssetSymbol(customToken) }</Text>
                        { typeof customToken.contractAddress == 'string' && <Badge color="amber" size="1" radius="full">{ Readability.toAddress(customToken.contractAddress, 8) }</Badge> }
                      </Flex>
                    </Flex>
                  </Flex>
                </Button>
              </Dialog.Close>
            }
            <Dialog.Close>
              <Button variant="ghost" color="gray" size="4" radius="none" style={{ width: '100%', padding: '4px 8px', display: 'block', borderRadius: '24px' }} mt="6" onClick={() => useAsset(policy)}>
                <Flex align="center" gap="2">
                  <AssetImage asset={policy} size="2" iconSize="48px"></AssetImage>
                  <Flex align="start" direction="column">
                    <AssetName asset={policy} size="2"></AssetName>
                    <Text size="2">{ Readability.toAssetSymbol(policy) }</Text>
                  </Flex>
                </Flex>
              </Button>
            </Dialog.Close>
          </Box>
        }
      </Box>
    }
    </Dialog.Content>
	</Dialog.Root>
  );
}