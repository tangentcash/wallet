import type { SummaryState } from 'tangentsdk/rpc';
import type { AssetId } from 'tangentsdk/algorithm';
import type BigNumber from 'bignumber.js';


export type ChainInfo = {
  id: string;
  chain: string;
  name: string;
  routing_policy: string;
  gas_price?: BigNumber;
};

export type BalanceRecord = {
  asset: AssetId;
  supply: BigNumber;
  reserve: BigNumber;
  balance: BigNumber;
  contractAddress?: string;
};

export type AddressEntry = { address: string, tag?: string };

export type AccountAddressRecord = {
  asset: AssetId;
  purpose?: string;
  addresses?: AddressEntry[];
};

export type TransferTarget = { to: string, value: BigNumber };

export type TxRecord = {
  hash: string | null;
  signature?: string;
  type: string | number | null;
  from?: string;
  asset: { chain: string, id?: string };
  nonce: number | string;
  gas_price?: BigNumber | null;
  gas_limit: BigNumber;
  memo?: string;
  to?: TransferTarget[];
  callable?: string;
  args?: unknown;
  data?: string;
  error?: string | null;
  proof?: { success: boolean, transaction_id?: string, block_id?: number | string, memo?: string | null };
  commitments?: Record<string, string[]>;
  withdraw_hash?: string;
  route_hash?: string;
  setup_hash?: string;
  action?: unknown,
  transactions?: unknown[];
};

export type ReceiptRecord = {
  transaction?: string;
  from?: string;
  successful: boolean;
  block_number: BigNumber;
  block_time: BigNumber;
  events: unknown[];
  relative_gas_use: BigNumber;
};

export type ActivityEntry = { transaction: TxRecord, receipt?: ReceiptRecord, state?: SummaryState };

export type PreattestationLink = {
  hash: string | number | null;
  public_key: string | null;
  address: string | null;
};

export type PreattestationEntry = {
  link: PreattestationLink;
  transaction_id: string;
  index: number | string;
  value: BigNumber | number;
  type: string;
  tokens: unknown[];
};

export type PreattestationRecord = {
  transaction_id: string;
  block_id?: number | string;
  memo?: string | null;
  success: boolean;
  inputs: PreattestationEntry[];
  outputs: PreattestationEntry[];
  signers?: string[];
  confirmed_block_height?: number | string;
};

export type RewardRecord = { asset: AssetId, reward: BigNumber, block_number?: BigNumber };

export type ValidatorRecord = {
  stake: BigNumber | null;
  rewards: RewardRecord[];
  block_number: BigNumber;
};
