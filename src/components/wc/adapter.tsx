import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { defineChain } from 'viem';
import { TronWeb } from 'tronweb';
import type { CaipNetwork, CaipNetworkId } from '@reown/appkit';
import type { AppKitNetwork, ChainNamespace } from '@reown/appkit/networks';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getMint, createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { TronAdapter } from '@reown/appkit-adapter-tron';
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink';
import { BitKeepAdapter } from '@tronweb3/tronwallet-adapter-bitkeep';
import { OkxWalletAdapter } from '@tronweb3/tronwallet-adapter-okxwallet';
import { BinanceWalletAdapter } from '@tronweb3/tronwallet-adapter-binance';
import { MetaMaskAdapter } from '@tronweb3/tronwallet-adapter-metamask-tron';
import { TrustAdapter } from '@tronweb3/tronwallet-adapter-trust';
import { arbitrum, avalanche, base, blast, bsc, classic, gnosis, linea, mainnet, optimism, polygon, solana, tronMainnet, zksync } from '@reown/appkit/networks';
import { Family, toBaseUnits, validateSend, WcAsset, WcCache, WcNetwork, WcProps, WcStatus } from './types';
import { AppData } from '../../core/app';

interface TokenMeta { decimals?: number; symbol?: string; name?: string }

const metaKey = (chain: string, contract: string): string => `token:${chain}:${contract.toLowerCase()}`;
const metaLabel = (o: TokenMeta): TokenMeta => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as TokenMeta;
const word = (value: string | bigint): string => typeof value === 'bigint' ? value.toString(16).padStart(64, '0') : value.slice(2).toLowerCase().padStart(64, '0');
const namespaceOf = (net: AppKitNetwork): ChainNamespace => ('chainNamespace' in net && net.chainNamespace) || 'eip155';
const caip2Of = (net: AppKitNetwork): CaipNetworkId => ('caipNetworkId' in net && net.caipNetworkId) || `${namespaceOf(net)}:${net.id}`;
const familyOf = (net: AppKitNetwork): Family => {
  const ns = namespaceOf(net);
  if (ns === 'eip155') return 'evm';
  if (ns === 'solana' || ns === 'tron') return ns;
  throw new Error(`${caip2Of(net)}: namespace '${ns}' cannot be sent by this component.`);
};
const project = {
  id: '1fcd1dac53eae49754bd7726fd55bba4',
  name: 'Funding contract',
  description: 'Send EVM, Tron and Solana transfers with a 32-byte memo identifier on-chain.',
  url: window.location.origin,
  icon: window.location.origin + '/web-app-manifest-192x192.png',
  networks: {
    ETH: mainnet,
    arbETH: arbitrum,
    AVAX: avalanche,
    baseETH: base,
    blastETH: blast,
    BNB: bsc,
    ETC: classic,
    XDAI: gnosis,
    lineaETH: linea,
    POL: polygon,
    opETH: optimism,
    zkETH: zksync,
    rbhETH: defineChain({
      id: 4663,
      name: 'Robinhood Chain',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
      blockExplorers: { default: { name: 'Robinhood Chain Explorer', url: 'https://robinhoodchain.blockscout.com' } },
    }),
    SOL: solana,
    TRX: tronMainnet,
  },
  rpcs: {
    ETH: ['blockscout', 'https://eth.blockscout.com'],
    arbETH: ['blockscout', 'https://arbitrum.blockscout.com'],
    AVAX: ['routescan', 'https://api.routescan.io'],
    baseETH: ['blockscout', 'https://base.blockscout.com'],
    blastETH: ['routescan', 'https://api.routescan.io'],
    BNB: ['nodereal', 'https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3'],
    ETC: ['blockscout', 'https://etc.blockscout.com'],
    XDAI: ['blockscout', 'https://gnosis.blockscout.com'],
    lineaETH: ['blockscout', 'https://explorer.linea.build'],
    POL: ['blockscout', 'https://polygon.blockscout.com'],
    opETH: ['blockscout', 'https://explorer.optimism.io'],
    zkETH: ['blockscout', 'https://zksync.blockscout.com'],
    rbhETH: ['blockscout', 'https://robinhoodchain.blockscout.com'],
    SOL: { indexer: 'https://public.rpc.solanavibestation.com', tx: 'https://solana-rpc.publicnode.com' },
    TRX: {
      feeLimit: 150_000_000,
      adapterConfig: { checkTimeout: 3_000, openUrlWhenWalletNotFound: false }
    }
  }
};
export const networks: readonly WcNetwork[] = (Object.keys(project.networks) as WcAsset[]).map(name => {
  const net = project.networks[name];
  const family = familyOf(net);
  const explorer = net.blockExplorers?.default.url.replace(/\/$/, '');
  return {
    id: name,
    name: net.name,
    family,
    symbol: net.nativeCurrency.symbol,
    txUrl: txId => !explorer ? '' : family === 'tron' ? `${explorer}/#/transaction/${txId}` : `${explorer}/tx/${txId}`,
  };
});
const appKit = createAppKit({
  adapters: [
    new WagmiAdapter({ projectId: project.id, networks: Object.values(project.networks) as unknown as [AppKitNetwork, ...AppKitNetwork[]] }),
    new SolanaAdapter(),
    new TronAdapter({
      walletAdapters: [
        new TronLinkAdapter(project.rpcs.TRX.adapterConfig),
        new BitKeepAdapter(project.rpcs.TRX.adapterConfig),
        new OkxWalletAdapter(project.rpcs.TRX.adapterConfig),
        new BinanceWalletAdapter(project.rpcs.TRX.adapterConfig),
        new MetaMaskAdapter(),
        new TrustAdapter(project.rpcs.TRX.adapterConfig),
      ]
    }),
  ],
  networks: Object.values(project.networks) as unknown as [AppKitNetwork, ...AppKitNetwork[]],
  projectId: project.id,
  metadata: {
    name: project.name,
    description: project.description,
    url: project.url,
    icons: project.icon ? [project.icon] : [],
  },
  features: {
    swaps: false,
    onramp: false,
    receive: false,
    send: false,
    email: false,
    emailShowWallets: false,
    socials: false,
    history: false,
    analytics: false,
    allWallets: true,
    smartSessions: false,
    legalCheckbox: false,
    collapseWallets: false,
    pay: false,
    reownAuthentication: false,
    headless: false
  },
  themeMode: AppData.props.appearance,
  allWallets: 'SHOW',
});

export default function WcAdapter({
  ref, network, to, amount, memo, token,
  onInit, onConnect, onCacheLoad, onCacheStore, onStatusChange, onSent, onError,
}: WcProps) {
  const [status, setStatus] = useState<WcStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const busy = useRef(false);
  const events = useRef({ onConnect, onStatusChange, onSent, onError });
  events.current = { onConnect, onStatusChange, onSent, onError };
  const cache = useMemo<WcCache | undefined>(
    () => onCacheLoad || onCacheStore ? { load: onCacheLoad, store: onCacheStore } : undefined,
    [onCacheLoad, onCacheStore],
  );
  const meta = useMemo(() => networks.find(o => o.id === network) ?? networks[0]!, [network]);
  const { memoHex, memoError, problems } = useMemo(
    () => validateSend({ network, to, amount, memo, token }),
    [network, to, amount, memo, token],
  ); 
  const cacheLoad = useCallback(async (cache: WcCache | undefined, key: string): Promise<any> => {
    try {
      const cached = cache?.load ? await cache.load(key) : null;
      return cached ? JSON.parse(cached) : null;
    } catch { }
    return null;
  }, [cache]);
  const cacheStore = useCallback(async (cache: WcCache | undefined, key: string, value: any): Promise<void> => {
    if (cache?.store) {
      try { await cache.store(key, JSON.stringify(value)); } catch { }
    }
  }, [cache]);
  const decimalsLoad = useCallback(async (cache: WcCache | undefined, key: string, load: () => Promise<TokenMeta>): Promise<TokenMeta> => {
    let cached;
    try {
      if (cache?.load) {
        cached = await cache.load(key);
        const p = typeof cached === 'string' ? JSON.parse(cached) : cached;
        cached = p && typeof p === 'object' ? p as TokenMeta : {};
      } else {
        cached = {};
      }
    } catch { cached = {}; }
    if (typeof cached.decimals === 'number') return cached;
    const fresh = await load();
    const merged = metaLabel({ ...cached, ...metaLabel(fresh) });
    if (cache?.store && typeof merged.decimals === 'number') {
      try { await cache.store(key, JSON.stringify(merged)); } catch { }
    }
    return merged;
  }, []);
  const report = useCallback((next: WcStatus) => {
    setStatus(next);
    events.current.onStatusChange?.(next);
  }, []);
  const acquire = useCallback(async () => {
    if (busy.current)
      return;

    busy.current = true;
    const rpc = project.rpcs[network];
    const net = project.networks[network];
    if (!net || !rpc)
      throw new Error(`'${String(network)}' is not a supported network name.`);

    const family = familyOf(net);
    const ns = namespaceOf(net);
    setError(null);
    setTxId(null);
    report('connecting');
    try {
      await appKit.ready();
      if (appKit.getIsConnectedState())
        await appKit.disconnect().catch(() => undefined);

      const chain: CaipNetwork | undefined = appKit.getCaipNetworks(ns).find(c => c.caipNetworkId === caip2Of(net));
      if (!chain)
        throw new Error(`${net.name} is not configured in AppKit.`);

      appKit.setCaipNetwork(chain);
      const address = await new Promise<string>((resolve, reject) => {
        let settled = false;
        let modalSeen = false;
        let unsubAccount: (() => void) | undefined;
        let unsubEvents: (() => void) | undefined;
        const timer = setTimeout(
          () => settle(() => reject(new Error('The pairing request expired before it was approved.'))),
          180_000,
        );
        function settle(fn: () => void): void {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          unsubAccount?.();
          unsubEvents?.();
          fn();
        }
        function probeOnClose(trie: number): void {
          const address = appKit.getAddress(ns);
          if (address) settle(() => resolve(address));
          else if (trie >= 10) settle(() => reject(new Error('Wallet connection cancelled.')));
          else setTimeout(() => probeOnClose(trie + 1), 150);
        }
        unsubAccount = appKit.subscribeAccount(account => {
          if (account.isConnected && account.address && account.caipAddress?.startsWith(`${ns}:`))
            settle(() => resolve(account.address!));
        });
        unsubEvents = appKit.subscribeEvents(state => {
          const event = state.data.event;
          if (event === 'MODAL_OPEN' || event === 'MODAL_CREATED') modalSeen = true;
          else if (event === 'MODAL_CLOSE' && modalSeen) probeOnClose(0);
        });
        void appKit!.open({ view: 'Connect', namespace: ns });
      });
      report('sending');

      let connect = events.current.onConnect?.(address, null);
      if (connect instanceof Promise) await connect;

      let tokens: { contractAddress: string, symbol: string }[] = [];
      const tokensCache = await cacheLoad(cache, 'tokenset:' + address);
      if (!tokensCache || !Array.isArray(tokensCache.tokens) || typeof tokensCache.expiration != 'number' || tokensCache.expiration <= new Date().getTime()) {
        const saveCache = () => cacheStore(cache, 'tokenset:' + address, { tokens: tokens, expiration: new Date().getTime() + 300_000 });
        switch (family) {
          case 'evm': {
            try {
              const [type, url] = rpc as string[];
              if (type == 'blockscout') {
                const result = await (await fetch(`${url}/api/v2/addresses/${address}/token-balances`)).json();
                for (const item of result)
                  tokens.push({ contractAddress: item?.token?.address || item?.token?.address_hash || '', symbol: item?.token?.symbol || '' });
              } else if (type == 'routescan') {
                const result = (await (await fetch(`${url}/v2/network/mainnet/evm/${Number(net.id)}/etherscan/api?module=account&action=addresstokenbalance&address=${address}&page=1&offset=100`)).json()).result;
                for (const item of result)
                  tokens.push({ contractAddress: item.TokenAddress || '', symbol: item.TokenSymbol || '' });
              } else if (type == 'nodereal') {
                const result = (await (await fetch(url, {
                  method: 'POST',
                  body: JSON.stringify({ "jsonrpc": "2.0", "method": "nr_getTokenHoldings", "params": [address, "0x1", "0x64"], "id": 1 }),
                  headers: { 'Content-Type': 'application/json' }
                })).json()).result.details;
                for (const item of result)
                  tokens.push({ contractAddress: item.tokenAddress || '', symbol: item.tokenSymbol || '' });
              }
              await saveCache();
            } catch { }
            break;
          }
          case 'tron': {
            try {
              const set = new Set<string>(), miss: string[] = [];
              const data = (await (await fetch(`https://api.trongrid.io/v1/accounts/${address}/trc20/balance?limit=200`)).json()).data;
              data.forEach((e: any) => Object.keys(e).forEach(v => set.add(v)));
              await Promise.all([...set].map(async (c: string) => {
                const s = await cacheLoad(cache, 'tron:' + c);
                s == null ? miss.push(c) : tokens.push({ contractAddress: c, symbol: s });
              }));
              for (let i = 0; i < miss.length; i += 20) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const data = (await (await fetch(`https://api.trongrid.io/v1/trc20/info?contract_list=${miss.slice(i, i + 20).join(',')}`)).json()).data;
                await Promise.all(data.map((t: any) => {
                  tokens.push({ contractAddress: t.contract_address, symbol: t.symbol });
                  return cacheStore(cache, 'tron:' + t.contract_address, t.symbol);
                }));
              }
              await saveCache();
            } catch { }
            break;
          }
          case 'solana': {
            try {
              const connection = new Connection(project.rpcs.SOL.indexer, 'confirmed');
              const owner = new PublicKey(address);
              const held = (await Promise.all([TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((p) => connection.getParsedTokenAccountsByOwner(owner, { programId: p })))).flatMap((r) => r.value).map((t) => t.account.data.parsed.info);
              const mints = [...new Set(held.map((i) => i.mint))];
              if (!mints.length)
                break;

              const MP = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
              const pdas = mints.map((m) => PublicKey.findProgramAddressSync([Buffer.from("metadata"), MP.toBuffer(), new PublicKey(m).toBuffer()], MP)[0]);
              for (let i = 0; i < pdas.length; i++) {
                const symbol = await cacheLoad(cache, 'solana:' + pdas[i].toBase58());
                if (typeof symbol == 'string') {
                  tokens.push({ contractAddress: mints[i], symbol: symbol });
                  pdas.splice(i, 1);
                  mints.splice(i, 1);
                  --i;
                }
              }
              for (let i = 0; i < pdas.length; i += 100) {
                const items = await connection.getMultipleAccountsInfo(pdas.slice(i, i + 100));
                for (let j = 0; j < items.length; j++) {
                  let symbol = "???", buf = items[j]?.data as Buffer | undefined, off = 65;
                  if (buf && buf.length >= 69) {
                    const rd = () => {
                      if (off + 4 > buf!.length) return "";
                      const len = buf!.readUInt32LE(off); off += 4;
                      const v = buf!.subarray(off, off + len).toString("utf8").replace(/\0/g, "").trim(); off += len;
                      return v;
                    };
                    rd();
                    symbol = rd() || symbol;
                  }
                  tokens.push({ contractAddress: mints[i + j], symbol: symbol });
                  await cacheStore(cache, 'solana:' + pdas[i + j].toBase58(), symbol);   
                }
              }
              await saveCache();
            } catch { }
            break;
          }
          default:
            throw new Error('Invalid chain family');
        }
      } else {
        tokens = tokensCache.tokens;
      }

      connect = events.current.onConnect?.(address, tokens.filter((v) => v.contractAddress && v.symbol));
      if (connect instanceof Promise) await connect;
    } catch (e) {
      let message = '';
      const o = e && typeof e === 'object' ? e as Record<string, unknown> : null;
      if (e instanceof Error && e.message.trim())
        message = e.message;
      else if (o) {
        const nested = o.error && typeof o.error === 'object' ? (o.error as Record<string, unknown>).message : undefined;
        if (typeof o.message === 'string' && o.message.trim()) message = o.message;
        else if (typeof nested === 'string' && nested.trim()) message = nested;
        else if (o.code === 4001 || o.code === 4100 || o.code === 4200) message = 'Request rejected in the wallet.';
        else { try { const json = JSON.stringify(e); if (json && json !== '{}') message = json; } catch { } }
      } else if (typeof e === 'string' && e.trim()) message = e;
      const shown = message || 'The wallet returned an unknown error.';
      setError(shown);
      report('error');
      events.current.onError?.(shown);
    } finally {
      busy.current = false;
    }
  }, [report, cacheLoad, cacheStore, network]);
  const submit = useCallback(async (from: string) => {
    if (busy.current || problems.length > 0 || !memoHex)
      return;

    busy.current = true;
    const net = project.networks[network];
    if (!net)
      throw new Error(`'${String(network)}' is not a supported network name.`);

    const family = familyOf(net);
    const ns = namespaceOf(net);
    const recipient = to.trim();
    const contract = token?.trim() ?? null;
    const request = { network, to: recipient, token: contract, amount: amount.trim(), memoHex };
    setError(null);
    setTxId(null);
    report('connecting');
    try {
      if (!appKit.getIsConnectedState())
        throw new Error('No connection was made.');

      report('sending');  
      const provider = appKit.getProvider<unknown>(ns);
      if (!provider)
        throw new Error('No provider for the connected wallet.');

      let hash: string = '';
      switch (family) {
        case 'evm': {
          const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
          if (!EVM_ADDRESS_RE.test(to)) throw new Error('Recipient is not a valid 0x address.');
          if (token && !EVM_ADDRESS_RE.test(token)) throw new Error('Token contract is not a valid 0x address.');
          const chainId = Number(net.id);
          const rpc = net.rpcUrls.default.http[0];
          if (!rpc) throw new Error(`${net.name} has no default RPC url configured.`);
          let decimals: number;
          if (token) {
            const meta = await decimalsLoad(cache, metaKey(`eip155:${chainId}`, token), async () => {
              let response: Response;
              try {
                response = await fetch(rpc, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: token, data: '0x313ce567' }, 'latest'] }),
                });
              } catch {
                throw new Error('Could not reach an RPC node to read the token decimals.');
              }
              const json = (await response.json()) as { result?: string; error?: { message?: string } };
              if (json.error) throw new Error(`Token decimals() failed: ${json.error.message ?? 'unknown error'}`);
              if (!json.result || !/^0x0*[0-9a-fA-F]{1,4}$/.test(json.result)) throw new Error('Token decimals() returned no usable value.');
              return { decimals: parseInt(json.result, 16) };
            });
            if (meta.decimals === undefined) throw new Error('Token decimals() returned no usable value.');
            decimals = meta.decimals;
          } else {
            decimals = net.nativeCurrency.decimals;
          }
          const base = toBaseUnits(amount, decimals);
          const data = token ? `0xa9059cbb${word(to)}${word(base)}${memoHex.slice(2)}` : memoHex;
          const context = provider as {
            request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
            setDefaultChain?: (chainId: string) => void;
          };
          context.setDefaultChain?.(caip2Of(net));
          const onChain = async () => Number(await context.request({ method: 'eth_chainId' }) as string | number);
          if (await onChain().catch(() => chainId) !== chainId) {
            await context
              .request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chainId.toString(16)}` }] })
              .catch(() => undefined);
            if (await onChain().catch(() => chainId) !== chainId)
              throw new Error(`The wallet is not on ${net.name}. Switch it there and send again.`);
          }
          hash = await context.request({
            method: 'eth_sendTransaction',
            params: [{ from, to: token ?? to, value: `0x${(token ? 0n : base).toString(16)}`, data }],
          }) as string;
          break;
        }
        case 'tron': {
          const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
          if (!TRON_ADDRESS_RE.test(to)) throw new Error('Recipient is not a valid Tron address (T…).');
          if (token && !TRON_ADDRESS_RE.test(token)) throw new Error('Token contract is not a valid TRC-20 address (T…).');
          const rpc = (net as any).rpcUrls['chainDefault']?.http[0] ?? net.rpcUrls.default.http[0] ?? '';
          if (!rpc) throw new Error(`${net.name} has no full node url configured.`);
          if (!TronWeb.isAddress(to)) throw new Error('Recipient is not a valid Tron address.');
          if (token && !TronWeb.isAddress(token)) throw new Error('Token contract is not a valid TRC-20 address.');
          const tronWeb = new TronWeb({ fullHost: rpc });
          let decimals = 6;
          if (token) {
            const meta = await decimalsLoad(cache, metaKey('tron', token), async () => {
              const res = await tronWeb.transactionBuilder.triggerConstantContract(token, 'decimals()', {}, [], from);
              const hex = (res as { constant_result?: string[] }).constant_result?.[0];
              if (typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex)) throw new Error('Failed to read the TRC-20 decimals().');
              return { decimals: parseInt(hex, 16) };
            });
            decimals = meta.decimals ?? 6;
          }

          const base = toBaseUnits(amount, decimals);
          let unsigned: {
            txID: string;
            visible?: boolean;
            raw_data?: unknown;
            raw_data_hex?: string;
            signature?: string | string[];
            [key: string]: unknown;
          };
          if (!token) {
            if (base > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Tron amount is too large.');
            const built = await tronWeb.transactionBuilder.sendTrx(to, Number(base), from);
            unsigned = await tronWeb.transactionBuilder.addUpdateData(built, memoHex.slice(2), 'hex', { txLocal: true }) as unknown as typeof unsigned;
          } else {
            const res = await tronWeb.transactionBuilder.triggerSmartContract(
              token, '', { feeLimit: project.rpcs.TRX.feeLimit, callValue: 0, input: `a9059cbb${word(TronWeb.address.toHex(to))}${word(base)}${memoHex.slice(2)}` }, [], from,
            );
            if (!res?.transaction) throw new Error('Failed to build the TRC-20 transfer.');
            unsigned = res.transaction as unknown as typeof unsigned;
          }
          unsigned.visible = false;
          
          const context = provider as {
            type?: string;
            request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
            provider?: {
              session?: { sessionProperties?: Record<string, string | undefined> };
              request?: (args: { method: string; params?: unknown }, chain?: string) => Promise<unknown>;
            };
          };
          const walletConnect = context.type === 'WALLET_CONNECT';
          const v1 = context.provider?.session?.sessionProperties?.['tron_method_version'] === 'v1';
          const payload = structuredClone(unsigned);  
          const request = walletConnect ? {
            method: 'tron_signTransaction',
            params: v1 ? { address: from, transaction: unsigned } : { address: from, transaction: { transaction: unsigned } },
          } : { method: 'tron_sendTransaction', params: { transaction: unsigned } };
          if (walletConnect && !context.provider?.request)
              throw new Error('The WalletConnect session is gone — connect again and send again.');
          if (!context.request)
            throw new Error('This Tron wallet does not expose a request() method.');
          
          const returned = (await (walletConnect && context.provider?.request ? context.provider.request(request, caip2Of(net)) : context.request(request))) as (typeof unsigned) | undefined;
          const raw = (returned as (typeof unsigned) | undefined)?.signature;
          const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
          const clean = list.map(sig => (typeof sig === 'string' ? sig.replace(/^0x/i, '') : '')).filter(sig => sig.length > 0);
          const signature = clean.length ? clean : undefined;
          if (!signature)
            throw new Error('The wallet returned no signature — it was rejected, or that wallet cannot sign Tron transactions.');

          const signed = { ...payload, signature };
          const tronTxInfo = async (tronWeb: TronWeb, txid: string): Promise<Record<string, unknown> | null> => {
            try {
              const info = (await tronWeb.trx.getTransactionInfo(txid)) as unknown as Record<string, unknown> | null;
              return info && Object.keys(info).length > 0 ? info : null;
            } catch {
              return null;
            }
          };
          if (!(await tronTxInfo(tronWeb, signed.txID))) {
            const out = (await tronWeb.trx.sendRawTransaction(signed as never)) as { result?: boolean; message?: string; txid?: string; code?: unknown };
            if (!out.result) {
              const tronNodeMessage = (message?: string): string => {
                if (!message) return '';
                const raw = message.replace(/^0x/i, '');
                if (raw.length === 0 || raw.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(raw)) return message;
                const bytes = Uint8Array.from(raw.match(/.{2}/g) ?? [], pair => parseInt(pair, 16));
                const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
                return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(decoded) ? message : decoded;
              };
              const reason = `${String(out.code ?? '')} ${tronNodeMessage(out.message ?? '')}`.trim();
              if (!(await tronTxInfo(tronWeb, signed.txID) || /duplicate|already exists/i.test(reason))) {
                throw new Error(
                  `Tron broadcast rejected${reason ? `: ${reason}` : ''}. ` + (/energy|bandwidth|insufficient/i.test(reason)
                    ? 'The sender lacks the energy/bandwidth (or TRX) to pay for this transaction.'
                    : /does not exist/i.test(reason) ? 'That account is not activated on-chain yet — the first transfer to a new address costs ~1 TRX.' : ''),
                );
              }

            }
            hash = out.txid || signed.txID;
          }
          hash = hash || signed.txID;
          break;
        }
        case 'solana': {
          const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
          if (!BASE58_RE.test(to)) throw new Error('Recipient is not a valid Solana address (base58).');
          if (token && !BASE58_RE.test(token)) throw new Error('Token mint is not a valid Solana address (base58).');
          const context = provider as { sendTransaction: (tx: unknown, connection: unknown) => Promise<string> };
          let toKey: InstanceType<typeof PublicKey>;
          let mintKey: InstanceType<typeof PublicKey> | undefined;
          try {
            toKey = new PublicKey(to);
            mintKey = token ? new PublicKey(token) : undefined;
          } catch {
            throw new Error('Recipient or token mint is not a valid Solana address.');
          }    
          const connection = new Connection(project.rpcs.SOL.tx, 'confirmed');
          const fromKey = new PublicKey(from);
          const tx = new Transaction();
          if (!mintKey) {
            const lamports = toBaseUnits(amount, 9);
            if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('SOL amount is too large.');
            tx.add(SystemProgram.transfer({ fromPubkey: fromKey, toPubkey: toKey, lamports: Number(lamports) }));
          } else {
            const pinnedMintKey = mintKey;
            const meta = await decimalsLoad(cache, metaKey('solana', mintKey.toBase58()), () => getMint(connection, pinnedMintKey).then(m => ({ decimals: m.decimals })));
            if (meta.decimals === undefined) throw new Error('Could not read the token mint decimals.');
            const decimals = meta.decimals;
            const base = toBaseUnits(amount, decimals);
            const fromAta = getAssociatedTokenAddressSync(mintKey, fromKey);
            const toAta = getAssociatedTokenAddressSync(mintKey, toKey);
            tx.add(createAssociatedTokenAccountIdempotentInstruction(fromKey, toAta, toKey, mintKey));
            tx.add(createTransferCheckedInstruction(fromAta, mintKey, toAta, fromKey, base, decimals));
          }
          const memoBytes = new Uint8Array(32);
          for (let i = 0; i < 32; i++) memoBytes[i] = parseInt(memoHex.slice(2 + i * 2, 4 + i * 2), 16);
          tx.add(new TransactionInstruction({
            programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
            keys: [],
            data: Buffer.from(btoa(String.fromCharCode(...memoBytes)), 'utf8') as never,
          }));
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = blockhash;
          tx.feePayer = fromKey;
          hash = await context.sendTransaction(tx, connection);
          break;
        }
        default:
          throw new Error('Invalid chain family');
      }

      if (typeof hash !== 'string')
        throw new Error('The wallet did not return a transaction hash.');

      setTxId(hash);
      report('sent');
      events.current.onSent?.({ ...request, txId: hash });
    } catch (e) {
      let message = '';
      const o = e && typeof e === 'object' ? e as Record<string, unknown> : null;
      if (e instanceof Error && e.message.trim())
        message = e.message;
      else if (o) {
        const nested = o.error && typeof o.error === 'object' ? (o.error as Record<string, unknown>).message : undefined;
        if (typeof o.message === 'string' && o.message.trim()) message = o.message;
        else if (typeof nested === 'string' && nested.trim()) message = nested;
        else if (o.code === 4001 || o.code === 4100 || o.code === 4200) message = 'Request rejected in the wallet.';
        else { try { const json = JSON.stringify(e); if (json && json !== '{}') message = json; } catch { } }
      } else if (typeof e === 'string' && e.trim()) message = e;
      const shown = message || 'The wallet returned an unknown error.';
      setError(shown);
      report('error');
      events.current.onError?.(shown);
    } finally {
      busy.current = false;
    }
  }, [amount, cache, report, memoHex, network, problems, to, token]);
  useEffect(() => {
    if (appKit?.isOpen()) void appKit.close().catch(() => undefined);
    if (onInit) onInit(acquire);
  }, [acquire]);
  useImperativeHandle(ref, () => ({
    acquire: () => void acquire(),
    submit: (address: string) => void submit(address),
    reset: () => { setError(null); setTxId(null); report('idle'); if (appKit?.isOpen()) void appKit.close().catch(() => undefined);  },
    status,
    busy: status === 'connecting' || status === 'sending',
    error,
    txId,
    explorerUrl: status === 'sent' && txId ? meta.txUrl(txId) : null,
    network,
    meta,
    memoHex,
    memoError,
    problems,
    canSend: problems.length === 0 && status !== 'connecting' && status !== 'sending',
  }), [acquire, submit, status, error, txId, network, meta, memoHex, memoError, problems, report]);

  return null;
}