import { mdiAlphabeticalVariant, mdiCancel, mdiConsole, mdiHistory, mdiMagnify, mdiPlus } from "@mdi/js";
import { Box, Button, Dialog, Flex, Select, Text } from "@radix-ui/themes";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AssetId } from "tangentsdk/algorithm";
import { UiUtil } from "tangentsdk/ui";
import { Whitelist } from "tangentsdk/whitelist";
import { Assetlist } from "tangentsdk/assetlist";
import BigNumber from "bignumber.js";
import { Exchange, BlockchainInfo, Balance, ExchangeField } from "../../core/exchange";
import { AssetImage } from "../asset-image";
import { AssetName } from "../asset-name";
import { AppStorage } from "../../core/storage";
import { toFancyMoney, toChainAssetSymbol } from "../../core/utils";
import Icon from "@mdi/react";

type SelectorAsset = { asset: AssetId, contractAddress: boolean | string, amount?: BigNumber };

function assetSort(a: SelectorAsset, b: SelectorAsset): number {
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
}
function toBalanceItem(balance: Balance): SelectorAsset {
  return { asset: balance.asset, contractAddress: Whitelist.contractAddressOf(balance.asset), amount: balance.available };
}

function TokenRow(props: { item: SelectorAsset, onSelect: (asset: AssetId) => void, trailing?: ReactNode }) {
  const item = props.item;
  return (
    <Dialog.Close>
      <button className="asset-row" onClick={() => props.onSelect(item.asset)}>
        <AssetImage asset={item.asset} size="2" iconSize="36px"></AssetImage>
        <div className="asset-main">
          <AssetName asset={item.asset} size="3"></AssetName>
          <div className="mono tiny dim" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span>{ toChainAssetSymbol(item.asset) }</span>
            { typeof item.contractAddress == 'string' && <span>{ UiUtil.toAddress(item.contractAddress, 8) }</span> }
          </div>
        </div>
        { props.trailing }
      </button>
    </Dialog.Close>
  );
}

export default function AssetSelector(props: { children: ReactNode, title?: string, value?: AssetId | null, onChange?: (asset: AssetId | null) => void, balances?: Balance[] }) {
  const [launching, setLaunching] = useState(false);
  const [loading, setLoading] = useState<number | undefined>(undefined);
  const [policyIndex, setPolicyIndex] = useState<number | null>(null);
  const [symbol, setSymbol] = useState('');
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<SelectorAsset[]>([]);
  const [assets, setAssets] = useState<SelectorAsset[]>([]);
  const [selected, setSelected] = useState<SelectorAsset | null>(null);
  const [added, setAdded] = useState<SelectorAsset[]>([]);
  const policy = useMemo((): BlockchainInfo | null => policyIndex != null ? Exchange.descriptors[policyIndex] : null, [policyIndex]);
  const customToken = useMemo((): (AssetId & { contractAddress: boolean | string }) | null => {
    const targetSymbol = symbol.trim(), targetAddress = address.trim();
    if (!policy || !targetSymbol.length || targetAddress.length < 32)
      return null;

    const result: any = AssetId.fromHandle(policy.chain || policy.handle, targetSymbol, targetAddress);
    result.contractAddress = Whitelist.contractAddressOf(result);
    return result;
  }, [policy, symbol, address]);
  const addCustomToken = useCallback(() => {
    if (!customToken)
      return;

    const item: SelectorAsset = { asset: new AssetId(customToken.id), contractAddress: customToken.contractAddress };
    setAdded((prev) => [item, ...prev.filter((v) => v.asset.id != item.asset.id)]);
    setAddress('');
    setSymbol('');
    setLaunching(false);
  }, [customToken]);
  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    clearTimeout(loading);

    if (props.balances && !value.trim().length) {
      setAssets([]);
      setLoading(undefined);
      return;
    }

    if (value.length > 0) {
      setLoading(window.setTimeout(async () => {
        try {
          const result = await Exchange.assetQuery(value);
          setAssets(result.map((x) => ({ asset: x, contractAddress: Whitelist.contractAddressOf(x) })).sort(assetSort));
        } catch { }
        setLoading(undefined);
      }, 150));
    } else {
      setLoading(undefined);
    }
  }, [loading, props.balances]);
  const balanceMatches = useMemo((): SelectorAsset[] => {
    if (!props.balances)
      return [];
    const target = query.trim().toLowerCase();
    return props.balances.filter((v) => (!target.length || [UiUtil.toAssetSymbol(v.asset), v.asset.token, v.asset.chain, v.asset.handle, Assetlist.toName(v.asset, false)].filter(Boolean).join(' ').toLowerCase().includes(target)) && !added.some((a) => a.asset.id == v.asset.id)).map(toBalanceItem).sort(assetSort);
  }, [props.balances, query, added]);
  const showSelected = props.value != null && selected != null && !balanceMatches.some((v) => v.asset.id == selected?.asset.id);
  const remoteMatches = useMemo((): SelectorAsset[] => {
    if (!props.balances)
      return assets;
    if (!query.trim().length)
      return [];
    return assets.filter((v) => !balanceMatches.some((b) => b.asset.id == v.asset.id) && v.asset.id != selected?.asset.id && !added.some((a) => a.asset.id == v.asset.id));
  }, [props.balances, balanceMatches, selected, added, assets, query]);
  const showHistory = !added.length && !balanceMatches.length && !remoteMatches.length && !showSelected && !loading && !query.trim().length && (!props.balances || !props.balances.length);
  const showEmpty = !added.length && !balanceMatches.length && !remoteMatches.length && !showSelected && !loading && query.trim().length > 0;
  const useAsset = useCallback((asset: AssetId | null) => {
    if (props.onChange)
      props.onChange(asset ? new AssetId(asset.id) : null);

    if (asset != null) {
      let prev = (AppStorage.get(ExchangeField.AssetsHistory) || []).filter((v: any) => typeof v == 'string');
      if (!Array.isArray(prev)) {
        prev = [];
      } else if (prev.find((v) => v == asset.id)) {
        return;
      }

      const next = [asset.id, ...prev.slice(0, 7)];
      AppStorage.set(ExchangeField.AssetsHistory, next);
      setHistory(next.map((v) => {
        const x = new AssetId(v);
        return { asset: x, contractAddress: Whitelist.contractAddressOf(x) }
      }));
    }
  }, [props.onChange]);
  useEffect(() => {
    if (props.value === undefined)
      return;

    setAddress('');
    setLaunching(false);
    if (props.value != null) {
      const policyId = Exchange.descriptors.findIndex((item) => item.chain == props.value?.chain);
      const asset = new AssetId(props.value.id);
      setQuery(props.value.handle);
      setPolicyIndex(policyId != -1 ? policyId : null);
      setSymbol(props.value?.token || '');
      setSelected({ asset: asset, contractAddress: Whitelist.contractAddressOf(asset), amount: props.balances?.find((v) => v.asset.id == asset.id)?.available });
    } else {
      setQuery('');
      setPolicyIndex(null);
      setSymbol('');
      setAssets([]);
      setSelected(null);
    }
  }, [props.value]);
  useEffect(() => {
    const prev = AppStorage.get(ExchangeField.AssetsHistory);
    if (Array.isArray(prev)) {
      setHistory(prev.filter((v: any) => typeof v == 'string').map((v: string) => {
        const x = new AssetId(v);
        return { asset: x, contractAddress: Whitelist.contractAddressOf(x) }
      }));
    }
  }, []);

  return (
	<Dialog.Root>
		<Dialog.Trigger>{ props.children }</Dialog.Trigger>
    <Dialog.Content className="sheet-content token-picker" maxWidth="450px">
      <Dialog.Title style={{ fontWeight: 750, fontSize: 16, margin: '0 0 12px', color: 'var(--text)' }}>Find { props.title || ' a token' }</Dialog.Title>
      <div className="search">
        <Icon path={mdiMagnify} size={0.85}></Icon>
        <input placeholder="Token name, symbol or contract…" value={query} onChange={(e) => updateQuery(e.currentTarget.value)} />
        {
          props.value != null &&
          <button aria-label="Clear selected token" onClick={() => useAsset(null)} style={{ border: 0, background: 'none', padding: 4, display: 'grid', placeItems: 'center', color: 'var(--text-3)', cursor: 'pointer', flex: 'none' }}>
            <Icon path={mdiCancel} size={0.75}></Icon>
          </button>
        }
      </div>
      <div className="picker-list">
      {
        added.length > 0 &&
        <Box>
          <div className="menu-cap" style={{ padding: '14px 2px 4px' }}>Added</div>
          { added.map((item) => <TokenRow key={item.asset.id} item={item} onSelect={useAsset}></TokenRow>) }
        </Box>
      }
      {
        showSelected && selected != null &&
        <Box>
          <div className="menu-cap" style={{ padding: '14px 2px 4px' }}>Selected</div>
          <TokenRow item={selected} onSelect={useAsset} trailing={ selected.amount != null && <span className="mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-2)', flex: 'none' }}>{ toFancyMoney(null, selected.amount) }</span> }></TokenRow>
        </Box>
      }
      {
        balanceMatches.length > 0 &&
        <Box>
          <div className="menu-cap" style={{ padding: '14px 2px 4px' }}>Your balances</div>
          { balanceMatches.map((item) => <TokenRow key={item.asset.id} item={item} onSelect={useAsset} trailing={ item.amount != null && <span className="mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-2)', flex: 'none' }}>{ toFancyMoney(null, item.amount) }</span> }></TokenRow>) }
        </Box>
      }
      {
        remoteMatches.length > 0 &&
        <Box>
          <div className="menu-cap" style={{ padding: '14px 2px 4px' }}>{ balanceMatches.length > 0 ? 'All tokens' : 'Tokens' }</div>
          { remoteMatches.map((item) => <TokenRow key={item.asset.id} item={item} onSelect={useAsset}></TokenRow>) }
        </Box>
      }
      {
        showHistory &&
        <Box>
          <div className="menu-cap" style={{ padding: '14px 2px 4px' }}>Recent</div>
          { history.map((item) => <TokenRow key={item.asset.id} item={item} onSelect={useAsset} trailing={<Icon path={mdiHistory} size={0.7} style={{ color: 'var(--text-3)', flex: 'none' }}></Icon>}></TokenRow>) }
        </Box>
      }
      {
        showEmpty &&
        <div className="dim" style={{ textAlign: 'center', fontSize: 13, padding: '26px 0 10px' }}>No tokens found</div>
      }
      </div>
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 2 }}>
        {
          !launching &&
          <button className="asset-row" style={{ color: 'inherit', border: 0, width: '100%', background: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => setLaunching(true)}>
            <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--elev)', display: 'grid', placeItems: 'center', color: 'var(--text-2)', flex: 'none' }}><Icon path={mdiPlus} size={0.85}></Icon></span>
            <div className="asset-main">
              <div style={{ fontWeight: 650, fontSize: 15 }}>Add custom token</div>
              <div className="tiny dim" style={{ marginTop: 2 }}>Register a token by its contract address</div>
            </div>
          </button>
        }
        {
          launching &&
          <Box pb="1">
            <div className="menu-cap" style={{ padding: '12px 2px 8px' }}>Custom token</div>
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
            <div className="search" style={{ marginTop: 10 }}>
              <Icon path={mdiConsole} size={0.85}></Icon>
              <input placeholder="Token's contract address" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
            </div>
            <div className="search" style={{ marginTop: 10 }}>
              <Icon path={mdiAlphabeticalVariant} size={0.85}></Icon>
              <input placeholder="Token's symbol (e.g. USDC)" value={symbol} onChange={(e) => setSymbol(e.currentTarget.value)} />
            </div>
            <Flex gap="2" mt="3">
              <Button variant="ghost" color="gray" style={{ flex: 1, height: 44, borderRadius: 'var(--r-md)', fontWeight: 700, margin: 0 }} onClick={() => setLaunching(false)}>Back</Button>
              <Button className="btn-brand" style={{ flex: 2, height: 44, borderRadius: 'var(--r-md)', fontWeight: 700 }} disabled={customToken == null} onClick={addCustomToken}>
                { customToken != null ? `Add ${ UiUtil.toAssetSymbol(customToken) }` : 'Add token' }
              </Button>
            </Flex>
            {
              policy != null &&
              <Dialog.Close>
                <Button variant="ghost" color="gray" style={{ marginTop: 10, height: 40, fontWeight: 650, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }} onClick={() => useAsset(policy)}>
                  Or use native { UiUtil.toAssetSymbol(policy) }
                </Button>
              </Dialog.Close>
            }
          </Box>
        }
      </div>
    </Dialog.Content>
	</Dialog.Root>
  );
}
