# Config
An example configuration file that includes all possible fields.
```json
{
    "network": "mainnet",
    "keystate": "./keystate.sk",
    "interactive": false,
    "known_nodes": [],
    "bootstrap_nodes": [
        "https://p2p.tangent.cash:18420?consensus=1"
    ],
    "consensus": {
        "address": "0.0.0.0",
        "port": 18418,
        "accounts": [],
        "max_inbound_connections": 64,
        "max_outbound_connections": 8,
        "inventory_timeout": 300000,
        "inventory_size": 65536,
        "aggregation_cooldown": 2000,
        "aggregation_attempts": 6,
        "coordination_attempts": 15,
        "dispatch_retry_interval": 120000,
        "hashes_per_query": 2048,
        "headers_per_query": 128,
        "reorganizable": false,
        "miner": true,
        "server": true,
        "logging": true
    },
    "rpc": {
        "address": "0.0.0.0",
        "port": 18419,
        "username": null,
        "password": null,
        "sandbox": true,
        "server": false,
        "logging": true
    },
    "discovery": {
        "address": "0.0.0.0",
        "port": 18420,
        "server": false,
        "logging": true
    },
    "superchain": {
        "polling_frequency": 90000,
        "cache1_size": 32768,
        "cache2_size": 131072,
        "listener": false,
        "logging": true,
        "protocols": {
            "BTC": {
                "peers": [
                    {
                        "url": "http://admin:pass@127.0.0.1:8332",
                        "headers": { "key": "value" },
                        "rps": 2
                    }
                ],
                "strategy": {
                    "props": null,
                    "batching": null,
                    "linker": false,
                    "tip": null
                }
            }
        }
    },
    "tcp": {
        "tls_trusted_peers": 100,
        "mbps_per_socket": 24,
        "keep_alive": 5000,
        "timeout": 30000
    },
    "storage": {
        "path": "./",
        "module_cache_path": null,
        "optimization": "speed",
        "checkpoint_size": 128,
        "max_tree_queue_size": 65536,
        "max_tree_vector_size": 48,
        "module_cache_size": 8192,
        "blob_cache_size": 134217728,
        "index_page_size": 65536,
        "index_cache_size": -2000,
        "flush_threads_ratio": 0.25,
        "compaction_threads_ratio": 0.25,
        "computation_threads_ratio": 0.00,
        "transaction_to_account_index": true,
        "transaction_to_rollup_index": true,
        "logging": false
    },
    "logs": {
        "info": null,
        "error": null,
        "query": null,
        "archive_size": 8388608,
        "archive_repack_interval": 1800000,
        "control_logging": false
    }
}
```
## Basic Configuration

- **network**: `"mainnet"` | `"testnet"` | `"regtest"`
Specifies the consensus network type. `mainnet` is the main network, `testnet` is for testing purposes, and `regtest` is a local regression test mode.
- **keystate**: `string`
Path to the keystate file containing cryptographic keys for data encryption.
- **keystate_for_encryption**: `string`
Path to the keystate file that is not encrypted and can be used to create a new keystate with encryption applied.
- **interactive**: `boolean`
Enable interactive encryption of a keystate file that would require a password to be prompted at startup.
- **known_nodes**: `string[]`
An array of consensus nodes considered always reachable. Example: `tcp://127.0.0.1:18418`.
- **bootstrap_nodes**: `string[]`
An array of discovery nodes used for consensus node discovery.

## Consensus Service Configuration

The consensus section defines how the node participates in achieving agreement on the state of the blockchain:

- **address**: `string`
IP address of the consensus server.
- **port**: `number`
Port number for the consensus server.
- **accounts**: `string[]`
Array of account keys used by the node. If empty, a new random account will be created if none exists. Accepts secret keys and mnemonic phrases.
- **max_inbound_connections**: `number`
Limit on incoming connections.
- **max_outbound_connections**: `number`
Limit on outgoing connections.
- **inventory_timeout**: `number (ms)`
Time-to-live for cached broadcast messages.
- **inventory_size**: `number`
Size of the broadcast messages cache.
- **aggregation_cooldown**: `number (ms)`
Wait time between MPC aggregation attempts.
- **aggregation_attempts**: `number`
Number of MPC aggregation attempts before giving up.
- **coordination_attempts**: `number`
Number of MPC coordination attempts before giving up.
- **dispatch_retry_interval**: `number (ms)`
Interval for block re-dispatching.
- **hashes_per_query**: `number`
Number of hashes requested per P2P query.
- **headers_per_query**: `number`
Number of headers requested per P2P query.
- **reorganizable**: `boolean`
Enables deep reorganizations that can make the node unresponsive for long periods.
- **miner**: `boolean`
Enables block production if one or more accounts are participating in governance.
- **server**: `boolean`
Enables a consensus server.
- **logging**: `boolean`
Enables logging for consensus-related activities.

## RPC Service Configuration

The RPC section defines how external applications can interact with the node:

- **address**: `string`
IP address of the RPC server.
- **port**: `number`
Port number for the RPC server.
- **username**: `string | null`
Authorization username if not null.
- **password**: `string | null`
Authorization password if not null.
- **sandbox**: `boolean`
Enables sandbox mode that restricts administrative operations.
- **logging**: `boolean`
Enables logging for RPC activities.

## Discovery Service Configuration

The discovery section relates to node discovery on the network:

- **port**: `number`
Port number for the discovery server.
- **server**: `boolean`
Enables a discovery server.
- **logging**: `boolean`
Enables logging for discovery activities.

## Superchain Service Configuration

The superchain section relates to interactions with other blockchains:

- **polling_frequency**: `number (ms)`
Frequency of polling for new blocks.
- **cache1_size**: `number`
Size of the first cache level.
- **cache2_size**: `number`
Size of the second cache level.
- **listener**: `boolean`
Enables an array of superchain listeners managed by a consensus server.
- **logging**: `boolean`
Enables logging for superchain activities.

### Protocols

- **(network)**:
  - **peers**: `{ url: string, headers?: Record<string, string>, rps?: number }[]`
  An array of off-chain relay peer URLs several optional parameters such as headers mapping and RPS limiter.
  - **strategy.props**: `any`
  Custom configuration for specific protocol if applicable.
  - **strategy.batching**: `number | null`
  Optimizes amount of requests to an off-chain node by fetching more than 1 block per request.
  - **strategy.linker**: `boolean | null`
  Instead of going block by block, only scan blocks that certanly contain one or more relevant transactions. Can be much better in terms of requests per day, can be much worse: depends severely on amount and kind of bridge accounts active on-chain. Currently, works only for Solana, will become worse than simple scanning when there are more than 150 bridge accounts.
  - **strategy.tip**: `number | null`
  Specifies the initial tip of the chain that the scanner must start from.

## TCP Configuration

The TCP section configures low-level network settings:

- **tls_trusted_peers**: `number`
Number of TLS trusted peers.
- **mbps_per_socket**: `number (mbps)`
Maximum bandwidth per socket in Mbps (only applies to download speed).
- **keep_alive**: `number (ms)`
Keep-alive interval for TCP connections.
- **timeout**: `number (ms)`
General timeout for TCP operations.

## Storage Configuration

The storage section defines how data is stored and managed:

- **path**: `string`
The base path for all storage-related files.
- **module_cache_path**: `string | null`
Cache path of compiled VM byte code for smart contracts.
- **optimization**: `"speed" | "safety"`
Storage integrity vs performance. Safety mode is very conservative.
- **checkpoint_size**: `number`
Max reorganization depth (in blocks) before reaching deep reorganization.
- **max_tree_queue_size**: `number`
Size of the tree cache queue that affects JSON parser performance significantly as well as memory usage (inverse correlation).
- **max_tree_vector_size**: `number`
Size of the each element in tree queue cache.
- **module_cache_size**: `number`
Size of the module cache.
- **blob_cache_size**: `number (bytes)`
Rocksdb LRU cache size.
- **index_page_size**: `number`
Sqlite page_size value.
- **index_cache_size**: `number`
Sqlite cache_size value.
- **flush_threads_ratio**: `number`
Rocksdb ratio of threads dedicated to flushing data.
- **compaction_threads_ratio**: `number`
Rocksdb ratio of threads dedicated to compaction.
- **computation_threads_ratio**: `number`
Scheduler ratio of threads dedicated to computation. Zero will allocate threads without relying on Rocksdb threads count.
- **transaction_to_account_index**: `boolean`
Enables account transactions indexer (possible to query all transactions relevant to an account).
- **transaction_to_rollup_index**: `boolean`
Enables internal transactions indexer (transactions inside a rollup transaction).
- **logging**: `boolean`
Enables logging for storage activities.

## Logs Configuration

The logs section configures logging behavior:

- **info**: `null`
The file path of info level logs.
- **error**: `null`
The file path of error level logs.
- **query**: `null`
The file path of query level logs.
- **archive_size**: `number (bytes)`
Min log file size eligible to be packed in a historic log.
- **archive_repack_interval**: `number (ms)`
Interval for repacking log files into a historic log.
- **control_logging**: `false`
Enables control logging of internal tasks.