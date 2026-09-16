import { Ref } from "react";

export type Family = 'evm' | 'solana' | 'tron';

export type WcAsset = 'ETH' | 'arbETH' | 'AVAX' | 'baseETH' | 'blastETH' | 'BNB' | 'ETC' | 'XDAI' | 'lineaETH' | 'POL' | 'opETH' | 'zkETH' | 'rbhETH' | 'SOL' | 'TRX';

export type WcStatus = 'idle' | 'connecting' | 'sending' | 'sent' | 'error';

export interface WcNetwork {
  id: WcAsset;
  name: string;
  family: Family;
  symbol: string;
  txUrl: (txId: string) => string;
}

export interface WcTransaction {
  network: WcAsset;
  txId: string;
  to: string;
  token: string | null;
  amount: string;
  memoHex: string;
}

export interface WcCache {
  load?: (key: string) => string | null | undefined | Promise<string | null | undefined>;
  store?: (key: string, value: string) => void | Promise<boolean>;
}

export interface WcContext {
  acquire: () => void;
  submit: (address: string) => void;
  reset: () => void;
  status: WcStatus;
  busy: boolean;
  error: string | null;
  txId: string | null;
  explorerUrl: string | null;
  network: WcAsset;
  meta: WcNetwork;
  memoHex: string | null;
  memoError: string | null;
  problems: string[];
  canSend: boolean;
}

export interface WcProps {
  network: WcAsset;
  to: string;
  amount: string;
  memo: string;
  token?: string | null;
  ref?: Ref<WcContext>;
  onInit?: (acquire: () => void) => any;
  onConnect?: (address: string, tokens: { contractAddress: string, symbol: string }[] | null) => void | Promise<void>;
  onCacheLoad?: (key: string) => string | null | undefined | Promise<string | null | undefined>;
  onCacheStore?: (key: string, value: string) => void | Promise<boolean>;
  onStatusChange?: (status: WcStatus) => void;
  onSent?: (tx: WcTransaction) => void;
  onError?: (message: string) => void;
}

export function normalizeMemo(input: string): { hex: string | null; error: string | null } {
  const raw = input.trim();
  if (raw === '') return { hex: `0x${'0'.repeat(64)}`, error: null };
  if (raw.startsWith('0x') || raw.startsWith('0X')) {
    const body = raw.slice(2).toLowerCase();
    if (!/^[0-9a-fA-F]*$/.test(body)) return { hex: null, error: 'Memo hex contains characters outside 0-9a-f.' };
    if (body.length > 64) return { hex: null, error: `Memo is ${Math.ceil(body.length / 2)} bytes — 32 is the maximum.` };
    return { hex: `0x${body.padEnd(64, '0')}`, error: null };
  }
  const bytes = new TextEncoder().encode(raw);
  if (bytes.length > 32) return { hex: null, error: `Memo is ${bytes.length} bytes — 32 is the maximum.` };
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return { hex: `0x${Array.from(padded, b => b.toString(16).padStart(2, '0')).join('')}`, error: null };
}

export function validateSend(input: WcProps): { memoHex: string | null; memoError: string | null; problems: string[] } {
  const memoN = normalizeMemo(input.memo);
  const amountOk = /^\d*\.?\d+$/.test(input.amount.trim().replace(/[,\s]/g, '')) && Number(input.amount) > 0;
  const problems: string[] = [];
  if (!input.amount.trim()) problems.push('Enter an amount.');
  else if (!amountOk) problems.push('Amount must be a positive number.');
  if (!input.to.trim()) problems.push('Enter a recipient.');
  if (input.token !== null && input.token !== undefined && !input.token.trim())
    problems.push(`Enter the token contract.`);
  if (memoN.error) problems.push(memoN.error);
  return { memoHex: memoN.hex, memoError: memoN.error, problems };
}

export function toBaseUnits(amount: string, decimals: number): bigint {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(amount.trim().replace(/[,\s]/g, ''));
  if (!match) throw new Error('Amount is not a valid number.');
  const int = match[1] ?? '0';
  const frac = match[2] ?? '';
  if (int.length > 40) throw new Error('Amount is too large.');
  const base = BigInt(int + (frac + '0'.repeat(decimals)).slice(0, decimals));
  if (base <= 0n) throw new Error('Amount rounds down to zero — send more.');
  return base;
}
