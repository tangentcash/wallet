# Programs

## The Distributed Ledger Analogy

Blockchains like Bitcoin are often compared to a **distributed ledger**. This analogy helps us understand how blockchains enable decentralized currencies using cryptography. In this system, the ledger records all activities and enforces rules that dictate what can or cannot be done to modify it. For instance, a Bitcoin address cannot spend more than it has received, ensuring the integrity of transactions across the network.

## Beyond Simple Transactions

While blockchains like Bitcoin focus on simple transaction rules, **Tangent** uses a more sophisticated concept: smart contracts. To better understand this feature, we need to move beyond the distributed ledger analogy and consider Tangent as a **distributed state machine**.

### The Distributed State Machine

In Tangent, the blockchain's state is not just a record of accounts and balances; it's a complex data structure that includes a machine state. This state can evolve from block to block according to pre-defined rules, executing arbitrary machine code. The specific rules governing these state transitions are defined by the **Virtual Machine (VM)**.

## Smart Contracts

### What is a Smart Contract?

On Tangent, smart contracts are referred to as **programs**. A program is essentially an account that contains executable code organized into functions. Users interact with these programs by sending 'call' transactions.

### Deployment and Compilation

When a program is deployed on Tangent, it undergoes a process involving a modified deterministic version of the AngelScript Virtual Machine. This process compiles the program into bytecode format, ensuring efficiency and security.

#### Compressed Source Code

Programs are deployed as compressed source code, allowing everyone to inspect the original program while optimizing storage size. This transparency is crucial for trust and verification within the network.

### Immutability and Passivity

Every program on Tangent is **immutable** and **passive**. Once deployed, a program cannot change; it remains fixed. Additionally, programs do not execute autonomously but only when called by another account. This design ensures predictability and security within the system.