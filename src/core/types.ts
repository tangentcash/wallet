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
  hash: string;
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
  proof?: { success: boolean };
  withdraw_hash?: string;
  route_hash?: string;
  setup_hash?: string;
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

export type RewardRecord = { asset: AssetId, reward: BigNumber, block_number?: BigNumber };

export type ValidatorRecord = {
  stake: BigNumber | null;
  rewards: RewardRecord[];
  block_number: BigNumber;
};
