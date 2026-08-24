# RPC Reference
## Validator RPC
### submitblock
```c#
private function submitblock() returns void
```
*Try to propose a block from mempool transactions*
### acceptnode
```c#
private function acceptnode(string uri_address) returns void
```
*Try to accept and connect to a node possibly by ip address*
### verify
```c#
private view function verify(uint64 number, uint64 count, bool? validate) const returns uint256[]
```
*Verify chain and possibly re-execute each block*
### status
```c#
public view function status() const returns validator::status
```
*Get validator status*
### getwallet
```c#
private view function getwallet() const returns wallet
```
*Get validator wallet*
### rejectnode
```c#
private function rejectnode(string uri_address) returns void
```
*Reject and disconnect from a node by ip address*
### revert
```c#
private function revert(uint64 number) returns { new_tip_block_number: uint64, old_tip_block_number: uint64, block_delta: int64, transaction_delta: int64, state_delta: int64, is_fork: bool }
```
*Revert chainstate to block number and possibly send removed transactions to mempool*
### getblockchains
```c#
public view function getblockchains() const returns superchain::asset_info[]
```
*Get supported blockchains*
### getnode
```c#
public view function getnode(string uri_address) const returns validator
```
*Get a node by ip address*

## Mempool RPC
### addnode
```c#
private function addnode(string uri_address) returns void
```
*Add node ip address to trial addresses*
### simulatebridge
```c#
private function simulatebridge(string asset, string bridge_hash, string to_address, decimal to_value) returns superchain_transaction
```
*Build an off-chain attestation transaction payload using off-chain node*
### rejecttransaction
```c#
private function rejecttransaction(uint256 hash) returns void
```
*Remove mempool transaction by hash*
### submittransaction
```c#
public view function submittransaction(string message_hash) returns uint256
```
*Try to accept and relay a mempool transaction from raw data and possibly validate over latest chainstate*
### getrawmempooltransactionbyhash
```c#
public view function getrawmempooltransactionbyhash(uint256 hash) const returns string
```
*Get raw mempool transaction by hash*
### simulatetransaction
```c#
public view function simulatetransaction(string message_hex) const returns uint256
```
*Execute transaction with block gas limit and return the receipt*
### getgasprice
```c#
public view function getgasprice(string asset, double? percentile = 0.5, bool? mempool_only) const returns { price: decimal, paid: boolean }
```
*Get gas price from percentile of pending transactions*
### getmempooltransactionbyhash
```c#
public view function getmempooltransactionbyhash(uint256 hash) const returns txn
```
*Get mempool transaction by hash*
### clearnode
```c#
private function clearnode(string uri_address) returns void
```
*Remove associated node info by ip address*
### getclosestnode
```c#
public view function getclosestnode(uint64? offset) const returns validator
```
*Get closest node info*
### getnextaccountnonce
```c#
public view function getnextaccountnonce(string owner_address) const returns uint64
```
*Get account nonce for next transaction by owner*
### getmempooltransactions
```c#
public view function getmempooltransactions(bool commitment, uint64 offset, uint64 count, uint8? unrolling) const returns (uint256[] | txn[])
```
*Get mempool transactions*
### getclosestnodecount
```c#
public view function getclosestnodecount() const returns uint64
```
*Get closest node count*
### getmempooltransactionsbyowner
```c#
public view function getmempooltransactionsbyowner(const string address, uint64 offset, uint64 count, uint8? direction = 1, uint8? unrolling) const returns (uint256[] | txn[])
```
*Get mempool transactions by signing address*
### getaddresses
```c#
public view function getaddresses(uint64 offset, uint64 count, string? services = 'consensus' | 'discovery' | 'superchain' | 'rpc' | 'rpc_public_access' | 'rpc_web_sockets' | 'production' | 'participation' | 'attestation') const returns string[]
```
*Get best node ip addresses with optional comma separated list of services*
### getassetprice
```c#
public view function getassetprice(string asset_from, string asset_to, double? percentile = 0.5) const returns decimal
```
*Get gas asset from percentile of pending transactions*

## Ledger RPC
### getwitnessaccountsbypurpose
```c#
public view function getwitnessaccountsbypurpose(string address, string purpose = 'witness' | 'router' | 'custodian' | 'bridge', uint64 offset, uint64 count) const returns multiform[]
```
*Get witness addresses by owner address*
### getwitnessaccount
```c#
public view function getwitnessaccount(string address, string asset, string wallet_address) const returns multiform
```
*Get witness address by owner address, asset, wallet address*
### getwitnessevent
```c#
public view function getwitnessevent(uint256 transaction_hash) const returns uniform
```
*Get witness event by transaction hash*
### getbestbridgebalances
```c#
public view function getbestbridgebalances(string asset, uint64 offset, uint64 count) const returns multiform[]
```
*Get accounts with best bridge balance*
### getbridgebalances
```c#
public view function getbridgebalances(uint256 hash, uint64 offset, uint64 count) const returns multiform[]
```
*Get bridge balances by hash*
### getbridgebalance
```c#
public view function getbridgebalance( string asset, uint256 hash) const returns multiform
```
*Get bridge balance by asset and hash*
### getbestbridgeinstancesbybalance
```c#
public view function getbestbridgeinstancesbybalance(string asset, uint64 offset, uint64 count) const returns { instance: multiform?, balance: multiform }[]
```
*Get best bridge instance based on total value locked*
### getbridgeinstances
```c#
public view function getbridgeinstances(string asset, uint64 offset, uint64 count) const returns multiform[]
```
*Get bridge balances by asset*
### getbridgeaccounts
```c#
public view function getbridgeaccounts(uint256 hash, uint64 offset, uint64 count) const returns multiform[]
```
*Get bridge accounts by hash*
### getbridgeaccount
```c#
public view function getbridgeaccount(string owner_address, string asset, uint256 hash) const returns multiform
```
*Get bridge account by owner addresses, asset and hash*
### getvalidatorattestationrewards
```c#
public view function getvalidatorattestationrewards(string address, uint64 offset, uint64 count) const returns multiform
```
*Get validator attestation rewards by address*
### getvalidatorattestationreward
```c#
public view function getvalidatorattestationreward(string address, string asset) const returns multiform
```
*Get validator attestation reward by address and asset*
### getvalidatorattestations
```c#
public view function getvalidatorattestations(string address, uint64 offset, uint64 count) const returns multiform[]
```
*Get validator attestations by address*
### getvalidatorattestationwithrewards
```c#
public view function getvalidatorattestationwithrewards(string asset, string address) const returns multiform
```
*Get validator attestation by address and asset*
### getvalidatorattestation
```c#
public view function getvalidatorattestation(string asset, string address) const returns multiform
```
*Get validator attestation by address and asset*
### getwitnessprogram
```c#
public view function getwitnessprogram(string hashcode) const returns uniform
```
*Get witness program by hashcode (512bit number)*
### getvalidatorparticipationrefs
```c#
public view function getvalidatorparticipationrefs(string owner_address, uint64 offset, uint64 count) const returns multiform
```
*Get validator participation refs by address*
### getvalidatorparticipationrewards
```c#
public view function getvalidatorparticipationrewards(string address, uint64 offset, uint64 count) const returns multiform
```
*Get validator participation rewards by address*
### getvalidatorparticipationreward
```c#
public view function getvalidatorparticipationreward(string address, string asset) const returns multiform
```
*Get validator participation reward by address and asset*
### getbestvalidatorparticipation
```c#
public view function getbestvalidatorparticipation(uint256 commitment, uint64 offset, uint64 count) const returns multiform[]
```
*Get best validator participations (zero commitment = offline, non-zero commitment = online threshold)*
### getmultiformscountbyrowfilter
```c#
public view function getmultiformscountbyrowfilter(string type, any row, string rank_condition = '>' | '>=' | '=' | '<>' | '<=' | '<', uint256 rank_value) const returns uint64
```
*Get multiform count by type, row and rank*
### getbestvalidatorproducers
```c#
public view function getbestvalidatorproducers(uint256 commitment, uint64 offset, uint64 count) const returns multiform[]
```
*Get best validator producers (zero commitment = offline, non-zero commitment = online threshold)*
### calltransaction
```c#
public view function calltransaction(string asset, string from_address, string to_address, string function, any... args) const returns program_trace
```
*Execute of immutable function of program assigned to to_address*
### getblockgaspricebyhash
```c#
public view function getblockgaspricebyhash(uint256 hash, string asset, double? percentile = 0.5) const returns decimal
```
*Get gas price from percentile of block transactions by hash*
### getwitnessaccounttagged
```c#
public view function getwitnessaccounttagged(string asset, string wallet_address, uint64 offset) const returns multiform
```
*Get witness address by asset and wallet address*
### getbestbridgeinstances
```c#
public view function getbestbridgeinstances(string asset, uint64 offset, uint64 count) const returns multiform[]
```
*Get best bridge balances by asset*
### getvalidatorattestationswithrewards
```c#
public view function getvalidatorattestationswithrewards(string address) const returns multiform[]
```
*Get validator attestations with rewards by address*
### getblockgaspricebynumber
```c#
public view function getblockgaspricebynumber(uint64 number, string asset, double? percentile = 0.5) const returns decimal
```
*Get gas price from percentile of block transactions by number*
### getwitnesstransaction
```c#
public view function getwitnesstransaction(string asset, string transaction_id) const returns uniform
```
*Get witness transaction by asset and transaction id*
### getaccountmultiform
```c#
public view function getaccountmultiform(string address, string column, string row) const returns multiform
```
*Get account storage by address, column and row*
### getvalidatorparticipations
```c#
public view function getvalidatorparticipations(string address, uint64 offset, uint64 count) const returns multiform[]
```
*Get validator participations by address*
### getvalidatorparticipationref
```c#
public view function getvalidatorparticipationref(string owner_address, string ref_owner_address, string ref_asset, uint256 ref_hash) const returns multiform
```
*Get validator participation by ref*
### getmultiformsbyrowfilter
```c#
public view function getmultiformsbyrowfilter(string type, any row, string rank_condition = '>' | '>=' | '=' | '<>' | '<=' | '<', uint256 rank_value, int8 rank_order, uint64 offset, uint64 count) const returns multiform[]
```
*Get multiform by type, row and rank*
### getvalidatorparticipationwithrewards
```c#
public view function getvalidatorparticipationwithrewards(string address) const returns multiform
```
*Get validator participation with rewards by address*
### getblockassetpricebynumber
```c#
public view function getblockassetpricebynumber(uint64 number, string asset_from, string asset_to, double? percentile = 0.5) const returns decimal
```
*Get gas asset from percentile of block transactions by number*
### getaccountmultiforms
```c#
public view function getaccountmultiforms(string address, string column, uint64 offset, uint64 count) const returns multiform[]
```
*Get account storage by address and column*
### getuniform
```c#
public view function getuniform(string type, any index) const returns uniform
```
*Get uniform by type and index*
### getassetholders
```c#
public view function getassetholders(string asset, uint256 rank) const returns uint64
```
*Get amount of asset holders with rank (balance value) greater or equal some value*
### getvalidatorproduction
```c#
public view function getvalidatorproduction(string address) const returns multiform
```
*Get validator production by address*
### getblockstatebyhash
```c#
public view function getblockstatebyhash(uint256 hash, uint8? unrolling = 0) const returns (uint256[] | (uniform|multiform)[])
```
*Get block state by hash*
### getwitnessaccounts
```c#
public view function getwitnessaccounts(string address, uint64 offset, uint64 count) const returns multiform[]
```
*Get witness addresses by owner address*
### getblockassetpricebyhash
```c#
public view function getblockassetpricebyhash(uint256 hash, string asset_from, string asset_to, double? percentile = 0.5) const returns decimal
```
*Get gas asset from percentile of block transactions by hash*
### getvalidatorparticipation
```c#
public view function getvalidatorparticipation(string address) const returns multiform
```
*Get validator participation by address*
### getmultiform
```c#
public view function getmultiform(string type, any column, any row) const returns multiform
```
*Get multiform by type, column and row*
### getmultiformsbycolumnfilter
```c#
public view function getmultiformsbycolumnfilter(string type, any column, string rank_condition = '>' | '>=' | '=' | '<>' | '<=' | '<', uint256 rank_value, int8 rank_order, uint64 offset, uint64 count) const returns multiform[]
```
*Get multiform by type, column and rank*
### getmultiformsbyrow
```c#
public view function getmultiformsbyrow(string type, any row, uint64 offset, uint64 count) const returns multiform[]
```
*Get multiform by type and row*
### getmultiformscountbycolumn
```c#
public view function getmultiformscountbycolumn(string type, any column) const returns uint64
```
*Get multiform count by type and column*
### getmultiformscountbycolumnfilter
```c#
public view function getmultiformscountbycolumnfilter(string type, any column, string rank_condition = '>' | '>=' | '=' | '<>' | '<=' | '<', uint256 rank_value) const returns uint64
```
*Get multiform count by type, column and rank*
### getbestbridgeinstancesbysecurity
```c#
public view function getbestbridgeinstancesbysecurity(string asset, uint64 offset, uint64 count) const returns { instance: multiform, balance: multiform? }[]
```
*Get best bridge instance based on security level*
### getbridgeinstance
```c#
public view function getbridgeinstance(string asset, uint256 hash) const returns multiform
```
*Get bridge instance by asset and hash*
### getmultiformscountbyrow
```c#
public view function getmultiformscountbyrow(string type, any row) const returns uint64
```
*Get multiform count by type and row*
### getaccountnonce
```c#
public view function getaccountnonce(string address) const returns uint64
```
*Get account nonce by address*
### getaccountbalances
```c#
public view function getaccountbalances(string address, uint64 offset, uint64 count) const returns multiform[]
```
*Get account balances by address*
### getbestvalidatorattestations
```c#
public view function getbestvalidatorattestations(string asset, uint256 commitment, uint64 offset, uint64 count) const returns multiform[]
```
*Get best validator attestations (zero commitment = offline, non-zero commitment = online threshold)*
### getblockstatebynumber
```c#
public view function getblockstatebynumber(uint64 number, uint8? unrolling = 0) const returns (uint256[] | (uniform|multiform)[])
```
*Get block state by number*
### getaccountprogram
```c#
public view function getaccountprogram(string address) const returns uniform
```
*Get account program hashcode by address*
### getaccountuniform
```c#
public view function getaccountuniform(string address, string index) const returns uniform
```
*Get account storage by address and index*
### getaccountbalance
```c#
public view function getaccountbalance(string address, string asset) const returns multiform
```
*Get account balance by address and asset*
### getvalidatorproductionwithrewards
```c#
public view function getvalidatorproductionwithrewards(string address) const returns multiform
```
*Get validator production with rewards by address*
### getvalidatorproductionreward
```c#
public view function getvalidatorproductionreward(string address, string asset) const returns multiform
```
*Get validator production reward by address and asset*
### getmultiformsbycolumn
```c#
public view function getmultiformsbycolumn(string type, any column, uint64 offset, uint64 count) const returns multiform[]
```
*Get multiform by type and column*
### getvalidatorproductionrewards
```c#
public view function getvalidatorproductionrewards(string address, uint64 offset, uint64 count) const returns multiform
```
*Get validator production rewards by address*

## Transaction RPC
### gettransactionbyhash
```c#
public view function gettransactionbyhash(uint256 hash, uint8? unrolling = 0) const returns (txn | block::txn)
```
*Get transaction by hash including aliases*
### getfinalizedtransactions
```c#
public view function getfinalizedtransactions(uint64 offset, uint64 count, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])
```
*Get latest finalized transactions*
### getblocktransactionsbyhash
```c#
public view function getblocktransactionsbyhash(uint256 hash, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])
```
*Get block transactions by hash*
### gettransactionsbyowner
```c#
public view function gettransactionsbyowner(string owner_address, uint64 offset, uint64 count, uint8? direction = 1, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])
```
*Get transactions by owner*
### getrawtransactionbyhash
```c#
public view function getrawtransactionbyhash(uint256 hash) const returns string
```
*Get raw transaction by hash*
### gettransactionsbyhash
```c#
public view function gettransactionsbyhash(uint256 hash, uint8? unrolling = 0) const returns (txn[] | block::txn[])
```
*Get transactions by hash including aliases*
### getblocktransactionsbynumber
```c#
public view function getblocktransactionsbynumber(uint64 number, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])
```
*Get block transactions by number*

## Block RPC
### getblockbynumber
```c#
public view function getblockbynumber(uint64 number, uint8? unrolling = 0) const returns block
```
*Get block by number*
### getblockhashbynumber
```c#
public view function getblockhashbynumber(uint64 number) const returns uint256
```
*Get block hash by number*
### getblockproofbynumber
```c#
public view function getblockproofbynumber(uint64 number, bool? transactions, bool? receipts, bool? states) const returns block::proof
```
*Get block proof by number*
### getblockproofbyhash
```c#
public view function getblockproofbyhash(uint256 hash, bool? transactions, bool? receipts, bool? states) const returns block::proof
```
*Get block proof by hash*
### getrawblockbyhash
```c#
public view function getrawblockbyhash(uint256 hash) const returns string
```
*Get block by hash*
### getblockbyhash
```c#
public view function getblockbyhash(uint256 hash, uint8? unrolling = 0) const returns block
```
*Get block by hash*
### getblockcheckpointhash
```c#
public view function getblockcheckpointhash() const returns uint256
```
*Get block checkpoint hash*
### getblocktipnumber
```c#
public view function getblocktipnumber() const returns uint64
```
*Get block tip number*
### getrawblockbynumber
```c#
public view function getrawblockbynumber(uint64 number) const returns string
```
*Get block by number*
### getblocknumberbyhash
```c#
public view function getblocknumberbyhash(uint256 hash) const returns uint64
```
*Get block number by hash*
### getblocktiphash
```c#
public view function getblocktiphash() const returns uint256
```
*Get block tip hash*
### getblocks
```c#
public view function getblocks(uint64 number, uint64 count) const returns uint256[]
```
*Get block hashes*
### getblockcheckpointnumber
```c#
public view function getblockcheckpointnumber() const returns uint64
```
*Get block checkpoint number*

## Utility RPC
### decodetransaction
```c#
public function decodetransaction(string message_hex) const returns { transaction: txn, signer_address: string }
```
*Decode transaction message and convert to object*
### encodeaddress
```c#
public function encodeaddress(string public_key_hash) const returns string
```
*Encode public key hash*
### decodeaddress
```c#
public function decodeaddress(string address) const returns string
```
*Decode address*
### help
```c#
public function help() const returns { declaration: string, method: string, description: string }[]
```
*Get reference of all methods*
### decodemessage
```c#
public function decodemessage(string message) const returns any[]
```
*Decode message*

## Web Socket RPC
### subscribe
```c#
public function subscribe(string addresses, bool? blocks, bool? transactions) const returns uint64
```
*Subscribe to streams of incoming blocks and transactions optionally include blocks and transactions relevant to comma separated address list*
### unsubscribe
```c#
public function unsubscribe() const returns void
```
*Unsubscribe from all streams*

