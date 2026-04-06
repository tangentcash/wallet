import fs from 'fs';

const help = {
    "validatorstate": [
        {
            "function": "submitblock",
            "declaration": "private function validatorstate::submitblock() returns void",
            "description": "try to propose a block from mempool transactions"
        },
        {
            "function": "acceptnode",
            "declaration": "private function validatorstate::acceptnode(string uri_address) returns void",
            "description": "try to accept and connect to a node possibly by ip address"
        },
        {
            "function": "verify",
            "declaration": "private view function validatorstate::verify(uint64 number, uint64 count, bool? validate) const returns uint256[]",
            "description": "verify chain and possibly re-execute each block"
        },
        {
            "function": "exportentropies",
            "declaration": "private view function validatorstate::exportentropies(string participant_address, string password) const returns void",
            "description": "export a set of encrypted entropy messages"
        },
        {
            "function": "rejectnode",
            "declaration": "private function validatorstate::rejectnode(string uri_address) returns void",
            "description": "reject and disconnect from a node by ip address"
        },
        {
            "function": "getwallet",
            "declaration": "private view function validatorstate::getwallet() const returns wallet",
            "description": "get validator wallet"
        },
        {
            "function": "importentropies",
            "declaration": "private function validatorstate::importentropies(string participant_address, string password, string... messages) returns void",
            "description": "import a set of encrypted entropy messages"
        },
        {
            "function": "revert",
            "declaration": "private function validatorstate::revert(uint64 number, bool? keep_reverted_transactions) returns { new_tip_block_number: uint64, old_tip_block_number: uint64, mempool_transactions: uint64, block_delta: int64, transaction_delta: int64, state_delta: int64, is_fork: bool }",
            "description": "revert chainstate to block number and possibly send removed transactions to mempool"
        },
        {
            "function": "getblockchains",
            "declaration": "public view function validatorstate::getblockchains() const returns superchain::asset_info[]",
            "description": "get supported blockchains"
        },
        {
            "function": "setwallet",
            "declaration": "private view function validatorstate::setwallet(string type = 'mnemonic' | 'seed' | 'key', string entropy) const returns wallet",
            "description": "set validator wallet from mnemonic phrase, seed value or secret key"
        },
        {
            "function": "status",
            "declaration": "public view function validatorstate::status() const returns validator::status",
            "description": "get validator status"
        },
        {
            "function": "getnode",
            "declaration": "public view function validatorstate::getnode(string uri_address) const returns validator",
            "description": "get a node by ip address"
        }
    ],
    "mempoolstate": [
        {
            "function": "addnode",
            "declaration": "private function mempoolstate::addnode(string uri_address) returns void",
            "description": "add node ip address to trial addresses"
        },
        {
            "function": "rejecttransaction",
            "declaration": "private function mempoolstate::rejecttransaction(uint256 hash) returns void",
            "description": "remove mempool transaction by hash"
        },
        {
            "function": "submittransaction",
            "declaration": "public view function mempoolstate::submittransaction(string message_heh) returns uint256",
            "description": "try to accept and relay a mempool transaction from raw data and possibly validate over latest chainstate"
        },
        {
            "function": "getrawmempooltransactionbyhash",
            "declaration": "public view function mempoolstate::getrawmempooltransactionbyhash(uint256 hash) const returns string",
            "description": "get raw mempool transaction by hash"
        },
        {
            "function": "simulatetransaction",
            "declaration": "public view function mempoolstate::simulatetransaction(string message_hex) const returns uint256",
            "description": "execute transaction with block gas limit and return the receipt"
        },
        {
            "function": "getgasprice",
            "declaration": "public view function mempoolstate::getgasprice(string asset, double? percentile = 0.5, bool? mempool_only) const returns { price: decimal, paid: boolean }",
            "description": "get gas price from percentile of pending transactions"
        },
        {
            "function": "getmempooltransactionbyhash",
            "declaration": "public view function mempoolstate::getmempooltransactionbyhash(uint256 hash) const returns txn",
            "description": "get mempool transaction by hash"
        },
        {
            "function": "clearnode",
            "declaration": "private function mempoolstate::clearnode(string uri_address) returns void",
            "description": "remove associated node info by ip address"
        },
        {
            "function": "getmempooltransactions",
            "declaration": "public view function mempoolstate::getmempooltransactions(bool commitment, uint64 offset, uint64 count, uint8? unrolling) const returns (uint256[] | txn[])",
            "description": "get mempool transactions"
        },
        {
            "function": "getclosestnodecount",
            "declaration": "public view function mempoolstate::getclosestnodecount() const returns uint64",
            "description": "get closest node count"
        },
        {
            "function": "getnextaccountnonce",
            "declaration": "public view function mempoolstate::getnextaccountnonce(string owner_address) const returns uint64",
            "description": "get account nonce for next transaction by owner"
        },
        {
            "function": "getmempooltransactionsbyowner",
            "declaration": "public view function mempoolstate::getmempooltransactionsbyowner(const string address, uint64 offset, uint64 count, uint8? direction = 1, uint8? unrolling) const returns (uint256[] | txn[])",
            "description": "get mempool transactions by signing address"
        },
        {
            "function": "getaddresses",
            "declaration": "public view function mempoolstate::getaddresses(uint64 offset, uint64 count, string? services = 'consensus' | 'discovery' | 'superchain' | 'rpc' | 'rpc_public_access' | 'rpc_web_sockets' | 'production' | 'participation' | 'attestation') const returns string[]",
            "description": "get best node ip addresses with optional comma separated list of services"
        },
        {
            "function": "getclosestnode",
            "declaration": "public view function mempoolstate::getclosestnode(uint64? offset) const returns validator",
            "description": "get closest node info"
        },
        {
            "function": "getassetprice",
            "declaration": "public view function mempoolstate::getassetprice(string asset_from, string asset_to, double? percentile = 0.5) const returns decimal",
            "description": "get gas asset from percentile of pending transactions"
        }
    ],
    "chainstate": [
        {
            "function": "getwitnessaccountsbypurpose",
            "declaration": "public view function chainstate::getwitnessaccountsbypurpose(string address, string purpose = 'witness' | 'router' | 'custodian' | 'bridge', uint64 offset, uint64 count) const returns multiform[]",
            "description": "get witness addresses by owner address"
        },
        {
            "function": "getwitnessaccount",
            "declaration": "public view function chainstate::getwitnessaccount(string address, string asset, string wallet_address) const returns multiform",
            "description": "get witness address by owner address, asset, wallet address"
        },
        {
            "function": "getwitnessevent",
            "declaration": "public view function chainstate::getwitnessevent(uint256 transaction_hash) const returns uniform",
            "description": "get witness event by transaction hash"
        },
        {
            "function": "getbestbridgebalances",
            "declaration": "public view function chainstate::getbestbridgebalances(string asset, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get accounts with best bridge balance"
        },
        {
            "function": "getbridgebalance",
            "declaration": "public view function chainstate::getbridgebalance( string asset, uint256 hash) const returns multiform",
            "description": "get bridge balance by asset and hash"
        },
        {
            "function": "getbestbridgeinstancesbybalance",
            "declaration": "public view function chainstate::getbestbridgeinstancesbybalance(string asset, uint64 offset, uint64 count) const returns { instance: multiform?, balance: multiform }[]",
            "description": "get best bridge instance based on total value locked"
        },
        {
            "function": "getbridgeinstances",
            "declaration": "public view function chainstate::getbridgeinstances(string asset, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get bridge balances by asset"
        },
        {
            "function": "getbridgeaccounts",
            "declaration": "public view function chainstate::getbridgeaccounts(uint256 hash, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get bridge accounts by hash"
        },
        {
            "function": "getbridgeaccount",
            "declaration": "public view function chainstate::getbridgeaccount(string owner_address, string asset, uint256 hash) const returns multiform",
            "description": "get bridge account by owner addresses, asset and hash"
        },
        {
            "function": "getvalidatorattestationrewards",
            "declaration": "public view function chainstate::getvalidatorattestationrewards(string address, uint64 offset, uint64 count) const returns multiform",
            "description": "get validator attestation rewards by address"
        },
        {
            "function": "getvalidatorattestationreward",
            "declaration": "public view function chainstate::getvalidatorattestationreward(string address, string asset) const returns multiform",
            "description": "get validator attestation reward by address and asset"
        },
        {
            "function": "getvalidatorattestations",
            "declaration": "public view function chainstate::getvalidatorattestations(string address, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get validator attestations by address"
        },
        {
            "function": "getvalidatorattestationwithrewards",
            "declaration": "public view function chainstate::getvalidatorattestationwithrewards(string asset, string address) const returns multiform",
            "description": "get validator attestation by address and asset"
        },
        {
            "function": "getvalidatorattestation",
            "declaration": "public view function chainstate::getvalidatorattestation(string asset, string address) const returns multiform",
            "description": "get validator attestation by address and asset"
        },
        {
            "function": "getwitnessprogram",
            "declaration": "public view function chainstate::getwitnessprogram(string hashcode) const returns uniform",
            "description": "get witness program by hashcode (512bit number)"
        },
        {
            "function": "getvalidatorparticipationrefs",
            "declaration": "public view function chainstate::getvalidatorparticipationrefs(string owner_address, uint64 offset, uint64 count) const returns multiform",
            "description": "get validator participation refs by address"
        },
        {
            "function": "getvalidatorparticipationrewards",
            "declaration": "public view function chainstate::getvalidatorparticipationrewards(string address, uint64 offset, uint64 count) const returns multiform",
            "description": "get validator participation rewards by address"
        },
        {
            "function": "getvalidatorparticipationreward",
            "declaration": "public view function chainstate::getvalidatorparticipationreward(string address, string asset) const returns multiform",
            "description": "get validator participation reward by address and asset"
        },
        {
            "function": "getbestvalidatorparticipation",
            "declaration": "public view function chainstate::getbestvalidatorparticipation(uint256 commitment, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get best validator participations (zero commitment = offline, non-zero commitment = online threshold)"
        },
        {
            "function": "getvalidatorparticipations",
            "declaration": "public view function chainstate::getvalidatorparticipations(string address, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get validator participations by address"
        },
        {
            "function": "getvalidatorparticipationwithrewards",
            "declaration": "public view function chainstate::getvalidatorparticipationwithrewards(string address) const returns multiform",
            "description": "get validator participation with rewards by address"
        },
        {
            "function": "getvalidatorproductionreward",
            "declaration": "public view function chainstate::getvalidatorproductionreward(string address, string asset) const returns multiform",
            "description": "get validator production reward by address and asset"
        },
        {
            "function": "getbestbridgeinstancesbysecurity",
            "declaration": "public view function chainstate::getbestbridgeinstancesbysecurity(string asset, uint64 offset, uint64 count) const returns { instance: multiform, balance: multiform? }[]",
            "description": "get best bridge instance based on security level"
        },
        {
            "function": "getbridgeinstance",
            "declaration": "public view function chainstate::getbridgeinstance(string asset, uint256 hash) const returns multiform",
            "description": "get bridge instance by asset and hash"
        },
        {
            "function": "getmultiformscountbyrow",
            "declaration": "public view function chainstate::getmultiformscountbyrow(string type, any row) const returns uint64",
            "description": "get multiform count by type and row"
        },
        {
            "function": "getblockgaspricebynumber",
            "declaration": "public view function chainstate::getblockgaspricebynumber(uint64 number, string asset, double? percentile = 0.5) const returns decimal",
            "description": "get gas price from percentile of block transactions by number"
        },
        {
            "function": "getwitnessaccounts",
            "declaration": "public view function chainstate::getwitnessaccounts(string address, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get witness addresses by owner address"
        },
        {
            "function": "getwitnessaccounttagged",
            "declaration": "public view function chainstate::getwitnessaccounttagged(string asset, string wallet_address, uint64 offset) const returns multiform",
            "description": "get witness address by asset and wallet address"
        },
        {
            "function": "getbestbridgeinstances",
            "declaration": "public view function chainstate::getbestbridgeinstances(string asset, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get best bridge balances by asset"
        },
        {
            "function": "getvalidatorattestationswithrewards",
            "declaration": "public view function chainstate::getvalidatorattestationswithrewards(string address) const returns multiform[]",
            "description": "get validator attestations with rewards by address"
        },
        {
            "function": "getvalidatorparticipation",
            "declaration": "public view function chainstate::getvalidatorparticipation(string address) const returns multiform",
            "description": "get validator participation by address"
        },
        {
            "function": "getwitnesstransaction",
            "declaration": "public view function chainstate::getwitnesstransaction(string asset, string transaction_id) const returns uniform",
            "description": "get witness transaction by asset and transaction id"
        },
        {
            "function": "getaccountmultiform",
            "declaration": "public view function chainstate::getaccountmultiform(string address, string column, string row) const returns multiform",
            "description": "get account storage by address, column and row"
        },
        {
            "function": "getvalidatorparticipationref",
            "declaration": "public view function chainstate::getvalidatorparticipationref(string owner_address, string ref_owner_address, string ref_asset, uint256 ref_hash) const returns multiform",
            "description": "get validator participation by ref"
        },
        {
            "function": "getbridgebalances",
            "declaration": "public view function chainstate::getbridgebalances(uint256 hash, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get bridge balances by hash"
        },
        {
            "function": "getmultiformsbyrowfilter",
            "declaration": "public view function chainstate::getmultiformsbyrowfilter(string type, any row, string rank_condition = '>' | '>=' | '=' | '<>' | '<=' | '<', uint256 rank_value, int8 rank_order, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get multiform by type, row and rank"
        },
        {
            "function": "getblockassetpricebynumber",
            "declaration": "public view function chainstate::getblockassetpricebynumber(uint64 number, string asset_from, string asset_to, double? percentile = 0.5) const returns decimal",
            "description": "get gas asset from percentile of block transactions by number"
        },
        {
            "function": "getaccountmultiforms",
            "declaration": "public view function chainstate::getaccountmultiforms(string address, string column, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get account storage by address and column"
        },
        {
            "function": "getuniform",
            "declaration": "public view function chainstate::getuniform(string type, any index) const returns uniform",
            "description": "get uniform by type and index"
        },
        {
            "function": "getassetholders",
            "declaration": "public view function chainstate::getassetholders(string asset, uint256 rank) const returns uint64",
            "description": "get amount of asset holders with rank (balance value) greater or equal some value"
        },
        {
            "function": "getvalidatorproduction",
            "declaration": "public view function chainstate::getvalidatorproduction(string address) const returns multiform",
            "description": "get validator production by address"
        },
        {
            "function": "getblockgaspricebyhash",
            "declaration": "public view function chainstate::getblockgaspricebyhash(uint256 hash, string asset, double? percentile = 0.5) const returns decimal",
            "description": "get gas price from percentile of block transactions by hash"
        },
        {
            "function": "calltransaction",
            "declaration": "public view function chainstate::calltransaction(string asset, string from_address, string to_address, string function, any... args) const returns program_trace",
            "description": "execute of immutable function of program assigned to to_address"
        },
        {
            "function": "getblockstatebyhash",
            "declaration": "public view function chainstate::getblockstatebyhash(uint256 hash, uint8? unrolling = 0) const returns (uint256[] | (uniform|multiform)[])",
            "description": "get block state by hash"
        },
        {
            "function": "getmultiformscountbyrowfilter",
            "declaration": "public view function chainstate::getmultiformscountbyrowfilter(string type, any row, string rank_condition = '>' | '>=' | '=' | '<>' | '<=' | '<', uint256 rank_value) const returns uint64",
            "description": "get multiform count by type, row and rank"
        },
        {
            "function": "getbestvalidatorproducers",
            "declaration": "public view function chainstate::getbestvalidatorproducers(uint256 commitment, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get best validator producers (zero commitment = offline, non-zero commitment = online threshold)"
        },
        {
            "function": "getblockassetpricebyhash",
            "declaration": "public view function chainstate::getblockassetpricebyhash(uint256 hash, string asset_from, string asset_to, double? percentile = 0.5) const returns decimal",
            "description": "get gas asset from percentile of block transactions by hash"
        },
        {
            "function": "getmultiform",
            "declaration": "public view function chainstate::getmultiform(string type, any column, any row) const returns multiform",
            "description": "get multiform by type, column and row"
        },
        {
            "function": "getvalidatorproductionrewards",
            "declaration": "public view function chainstate::getvalidatorproductionrewards(string address, uint64 offset, uint64 count) const returns multiform",
            "description": "get validator production rewards by address"
        },
        {
            "function": "getmultiformsbycolumn",
            "declaration": "public view function chainstate::getmultiformsbycolumn(string type, any column, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get multiform by type and column"
        },
        {
            "function": "getmultiformsbycolumnfilter",
            "declaration": "public view function chainstate::getmultiformsbycolumnfilter(string type, any column, string rank_condition = '>' | '>=' | '=' | '<>' | '<=' | '<', uint256 rank_value, int8 rank_order, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get multiform by type, column and rank"
        },
        {
            "function": "getmultiformsbyrow",
            "declaration": "public view function chainstate::getmultiformsbyrow(string type, any row, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get multiform by type and row"
        },
        {
            "function": "getmultiformscountbycolumn",
            "declaration": "public view function chainstate::getmultiformscountbycolumn(string type, any column) const returns uint64",
            "description": "get multiform count by type and column"
        },
        {
            "function": "getmultiformscountbycolumnfilter",
            "declaration": "public view function chainstate::getmultiformscountbycolumnfilter(string type, any column, string rank_condition = '>' | '>=' | '=' | '<>' | '<=' | '<', uint256 rank_value) const returns uint64",
            "description": "get multiform count by type, column and rank"
        },
        {
            "function": "getaccountnonce",
            "declaration": "public view function chainstate::getaccountnonce(string address) const returns uint64",
            "description": "get account nonce by address"
        },
        {
            "function": "getaccountbalances",
            "declaration": "public view function chainstate::getaccountbalances(string address, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get account balances by address"
        },
        {
            "function": "getbestvalidatorattestations",
            "declaration": "public view function chainstate::getbestvalidatorattestations(string asset, uint256 commitment, uint64 offset, uint64 count) const returns multiform[]",
            "description": "get best validator attestations (zero commitment = offline, non-zero commitment = online threshold)"
        },
        {
            "function": "getblockstatebynumber",
            "declaration": "public view function chainstate::getblockstatebynumber(uint64 number, uint8? unrolling = 0) const returns (uint256[] | (uniform|multiform)[])",
            "description": "get block state by number"
        },
        {
            "function": "getaccountprogram",
            "declaration": "public view function chainstate::getaccountprogram(string address) const returns uniform",
            "description": "get account program hashcode by address"
        },
        {
            "function": "getaccountuniform",
            "declaration": "public view function chainstate::getaccountuniform(string address, string index) const returns uniform",
            "description": "get account storage by address and index"
        },
        {
            "function": "getaccountbalance",
            "declaration": "public view function chainstate::getaccountbalance(string address, string asset) const returns multiform",
            "description": "get account balance by address and asset"
        },
        {
            "function": "getvalidatorproductionwithrewards",
            "declaration": "public view function chainstate::getvalidatorproductionwithrewards(string address) const returns multiform",
            "description": "get validator production with rewards by address"
        }
    ],
    "txnstate": [
        {
            "function": "getpendingtransactionsbynumber",
            "declaration": "public view function txnstate::getpendingtransactionsbynumber(uint64 number, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])",
            "description": "get block transactions by number"
        },
        {
            "function": "getfinalizedtransactions",
            "declaration": "public view function txnstate::getfinalizedtransactions(uint64 offset, uint64 count, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])",
            "description": "get latest finalized transactions"
        },
        {
            "function": "getblocktransactionsbyhash",
            "declaration": "public view function txnstate::getblocktransactionsbyhash(uint256 hash, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])",
            "description": "get block transactions by hash"
        },
        {
            "function": "gettransactionsbyowner",
            "declaration": "public view function txnstate::gettransactionsbyowner(string owner_address, uint64 offset, uint64 count, uint8? direction = 1, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])",
            "description": "get transactions by owner"
        },
        {
            "function": "getblockreceiptsbynumber",
            "declaration": "public view function txnstate::getblockreceiptsbynumber(uint64 number, uint8? unrolling = 0) const returns (uint256[] | receipt[])",
            "description": "get block receipts by number"
        },
        {
            "function": "getblockreceiptsbyhash",
            "declaration": "public view function txnstate::getblockreceiptsbyhash(uint256 hash, uint8? unrolling = 0) const returns (uint256[] | receipt[])",
            "description": "get block receipts by hash"
        },
        {
            "function": "gettransactionsbyhash",
            "declaration": "public view function txnstate::gettransactionsbyhash(uint256 hash, uint8? unrolling = 0) const returns (txn | block::txn)",
            "description": "get transactions by hash including aliases"
        },
        {
            "function": "gettransactionbyhash",
            "declaration": "public view function txnstate::gettransactionbyhash(uint256 hash, uint8? unrolling = 0) const returns (txn | block::txn)",
            "description": "get transaction by hash including aliases"
        },
        {
            "function": "getrawtransactionbyhash",
            "declaration": "public view function txnstate::getrawtransactionbyhash(uint256 hash) const returns string",
            "description": "get raw transaction by hash"
        },
        {
            "function": "getreceiptbytransactionhash",
            "declaration": "public view function txnstate::getreceiptbytransactionhash(uint256 hash) const returns receipt",
            "description": "get receipt by transaction hash"
        },
        {
            "function": "getblocktransactionsbynumber",
            "declaration": "public view function txnstate::getblocktransactionsbynumber(uint64 number, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])",
            "description": "get block transactions by number"
        },
        {
            "function": "getpendingtransactionsbyhash",
            "declaration": "public view function txnstate::getpendingtransactionsbyhash(uint256 hash, uint8? unrolling = 0) const returns (uint256[] | txn[] | block::txn[])",
            "description": "get block transactions by hash"
        }
    ],
    "blockstate": [
        {
            "function": "getblockproofbynumber",
            "declaration": "public view function blockstate::getblockproofbynumber(uint64 number, bool? transactions, bool? receipts, bool? states) const returns block::proof",
            "description": "get block proof by number"
        },
        {
            "function": "getrawblockbynumber",
            "declaration": "public view function blockstate::getrawblockbynumber(uint64 number) const returns string",
            "description": "get block by number"
        },
        {
            "function": "getblockbynumber",
            "declaration": "public view function blockstate::getblockbynumber(uint64 number, uint8? unrolling = 0) const returns block",
            "description": "get block by number"
        },
        {
            "function": "getblockhashbynumber",
            "declaration": "public view function blockstate::getblockhashbynumber(uint64 number) const returns uint256",
            "description": "get block hash by number"
        },
        {
            "function": "getblockproofbyhash",
            "declaration": "public view function blockstate::getblockproofbyhash(uint256 hash, bool? transactions, bool? receipts, bool? states) const returns block::proof",
            "description": "get block proof by hash"
        },
        {
            "function": "getrawblockbyhash",
            "declaration": "public view function blockstate::getrawblockbyhash(uint256 hash) const returns string",
            "description": "get block by hash"
        },
        {
            "function": "getblockbyhash",
            "declaration": "public view function blockstate::getblockbyhash(uint256 hash, uint8? unrolling = 0) const returns block",
            "description": "get block by hash"
        },
        {
            "function": "getblockcheckpointhash",
            "declaration": "public view function blockstate::getblockcheckpointhash() const returns uint256",
            "description": "get block checkpoint hash"
        },
        {
            "function": "getblocktipnumber",
            "declaration": "public view function blockstate::getblocktipnumber() const returns uint64",
            "description": "get block tip number"
        },
        {
            "function": "getblocknumberbyhash",
            "declaration": "public view function blockstate::getblocknumberbyhash(uint256 hash) const returns uint64",
            "description": "get block number by hash"
        },
        {
            "function": "getblocktiphash",
            "declaration": "public view function blockstate::getblocktiphash() const returns uint256",
            "description": "get block tip hash"
        },
        {
            "function": "getblockcheckpointnumber",
            "declaration": "public view function blockstate::getblockcheckpointnumber() const returns uint64",
            "description": "get block checkpoint number"
        },
        {
            "function": "getblocks",
            "declaration": "public view function blockstate::getblocks(uint64 number, uint64 count) const returns uint256[]",
            "description": "get block hashes"
        }
    ],
    "utility": [
        {
            "function": "decodemessage",
            "declaration": "public function utility::decodemessage(string message) const returns any[]",
            "description": "decode message"
        },
        {
            "function": "decodetransaction",
            "declaration": "public function utility::decodetransaction(string message_hex) const returns { transaction: txn, signer_address: string }",
            "description": "decode transaction message and convert to object"
        },
        {
            "function": "encodeaddress",
            "declaration": "public function utility::encodeaddress(string public_key_hash) const returns string",
            "description": "encode public key hash"
        },
        {
            "function": "decodeaddress",
            "declaration": "public function utility::decodeaddress(string address) const returns string",
            "description": "decode address"
        },
        {
            "function": "help",
            "declaration": "public function utility::help() const returns { declaration: string, method: string, description: string }[]",
            "description": "get reference of all methods"
        }
    ],
    "websocket": [
        {
            "function": "subscribe",
            "declaration": "public function websocket::subscribe(string addresses, bool? blocks, bool? transactions) const returns uint64",
            "description": "subscribe to streams of incoming blocks and transactions optionally include blocks and transactions relevant to comma separated address list"
        },
        {
            "function": "unsubscribe",
            "declaration": "public function websocket::unsubscribe() const returns void",
            "description": "unsubscribe from all streams"
        }
    ]
};
const mapping = {
  'validatorstate': 'Validator',
  'mempoolstate': 'Mempool',
  'chainstate': 'Ledger',
  'txnstate': 'Transaction',
  'blockstate': 'Block',
  'utility': 'Utility',
  'websocket': 'Web Socket',
};

let result = '# RPC Reference\n';
for (let section in help) {
  const methods = help[section];
  result += '## ' + mapping[section] + ' RPC\n';
  for (let i = 0; i < methods.length; i++) {
    const method = methods[i];
    result += '### ' + method.function + '\n```c#\n' + method.declaration.replace(section + '::', '') + '\n```\n*' + method.description[0].toUpperCase() + method.description.substring(1) + '*\n';
  }
  result += '\n';
}

fs.writeFileSync('./03-rpc-reference.md', result);