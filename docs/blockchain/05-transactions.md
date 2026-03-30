# Transactions

## Overview

A **transaction** in the Tangent blockchain is a state-changing action initiated by an account managed by a human user, as opposed to a smart contract. This documentation provides a comprehensive understanding of transactions within the Tangent ecosystem, including their structure, execution, and associated fees.

## Transaction Structure and Execution

### Initiation and State Change

When Bob sends Alice 1 TAN, for instance, a transaction is initiated that results in two critical actions: debiting Bob's account and crediting Alice's. This process represents a fundamental state change within the blockchain. Transactions in Tangent are analogous to those in traditional database systems, where sending a transaction from an account alters the state of account balances, account data, or blockchain data.

### Broadcast and Validation

Once a transaction is initiated, it must be broadcast across the entire network. Any node can request a transaction execution, after which a validator executes the transaction and propagates the resulting state change to the rest of the network. This ensures that all nodes maintain a consistent and up-to-date ledger.

## Transaction Fees

### Fee Mechanism

Most transactions in Tangent require a fee, which is determined by market conditions. During periods of high network activity, fees tend to be higher. These fees can be paid using any native tokens of supported blockchains, such as TAN for Tangent or BTC for Bitcoin.

### Gas Model

Tangent employs a gas-based fee model, where transactions consist of a series of commands, each requiring 'gas' units - an abstract metric. Users can specify two parameters: the **Gas Limit**, which sets the upper bound on gas usage, and the **Gas Price**, which defines the cost per gas unit. If the Gas Limit is too low, the transaction will fail; if it's too high, the user may overpay. The total fee consumed by a transaction is calculated by multiplying the Gas Limit by the Gas Price.

Network congestion factor is tracked within each block. This parameter regulates minimal gas price: if network is congested then nodes will not accept transactions with gas price specified as zero, and if network is under-utilized then nodes will accept those transactions. In other words, if network activity is low then users can send costless transactions.

## Transaction Categories

Tangent categorizes transactions into two main types: **normal transactions** and **commitment transactions**.

### Normal Transactions

Normal transactions are standard operations that users perform on the blockchain, such as transfers or smart contract deployments. These transactions have associated fees and follow the gas model described above.

### Commitment Transactions

Commitment transactions are integral to network governance and often serve as responses to normal transactions. They have stringent validity requirements and do not incur fees. For example, a user might initiate a withdrawal transaction, prompting an automatic commitment transaction from the bridge's attester with details about the off-chain transaction.

## Transaction Types

Each transaction category includes various types designed to optimize effectiveness in terms of size and performance. In Tangent, each transaction is essentially a native smart contract with strict validity rules. Even a 'call' transaction, which invokes a VM smart contract account, adheres to this structure. This design allows for complex operations while maintaining security and efficiency.

### Transfer
The 'transfer' transaction allows users to specify multiple destination accounts and corresponding amounts in a single operation. This type is highly efficient for batch transfers, significantly reducing the number of individual transactions required and minimizing associated fees.

### Deploy
The 'deploy' transaction is utilized to create a smart contract account and invoke an initialization function with specified arguments, referred to as calldata. Unlike transfer transactions, deploy transactions do not facilitate asset transfers but are essential for setting up and initializing smart contracts on the blockchain network.

### Call
The 'call' transaction is designed to invoke specific functions within an existing smart contract using predefined arguments. This type of transaction enables smart contracts to perform a wide range of actions, from simple data manipulation to complex state changes.

### Rollup
Rollups represent an advanced feature that allows the bundling of multiple transactions into a single, comprehensive transaction natively. This capability empowers users to construct intricate and multi-faceted transactions without the need for additional smart contract deployments. For instance, a rollup transaction can be used to pay fees from one account while simultaneously transferring assets from another, showcasing the flexibility and efficiency of this feature.

### Setup
The 'setup' transaction is dedicated to configuring an account for participation in network governance activities. It can activate various governance functions such as block production, bridge creation, participation, attestation, migration, thereby enabling active engagement in the blockchain's governance processes.

### Bridge Migration
The 'migrate' transaction is employed to facilitate the migration of a bridge participant when withdrawal disruption occurs. This is achieved by providing a withdrawal failure proof, ensuring that the migration process is transparent and verifiable.

### Bridge Attestation
The 'attestate' transaction serves as a proof of an off-chain transaction, attested by one or more validators. It contains crucial details about a transaction occurring on another blockchain, such as the transaction ID, block number, and other relevant fields. This type of transaction is responsible for minting or burning tokens according to predefined rules.

### Bridge Account Request
The 'route' transaction functions as a request to a bridge to generate an off-chain deposit address. This address can then be used to fund the on-chain account with tokens from another blockchain, facilitating cross-chain asset transfers.

### Bridge Account Binding
The 'bind' transaction acts as a response to a 'route' transaction, providing detailed information about an off-chain address created by a committee of bridge participants. This ensures that the binding process is secure and properly documented.

### Bridge Withdrawal Request
The 'withdraw' transaction is a request to a bridge to transfer on-chain tokens to an off-chain address on another blockchain. This type of transaction initiates the withdrawal process, ensuring that assets are correctly routed across different blockchain networks.

### Bridge Withdrawal Broadcast
The 'broadcast' transaction serves as a response to a 'withdraw' transaction, offering detailed information about whether the withdrawal transaction was successfully sent or encountered issues. This provides transparency and accountability in the withdrawal process.

### Bridge Withdrawal Anticast
The 'anticast' transaction is a form of automatic protest that can be submitted to re-mint funds in cases of severe errors within the bridge. For example, if a 'broadcast' transaction was received but no corresponding off-chain transaction was found, an anticast protest can be filed to recover the funds. These protests are only possible after a specified time-lock period, and all withdrawal transactions must be confirmed by an 'attestate' transaction. If no confirmation is received within four days, the user becomes eligible to recover the funds through this protest mechanism.