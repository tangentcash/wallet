# Accounts

## Overview
An account in the context of blockchain technology is an entity capable of sending messages on the blockchain. These accounts are controlled by anyone possessing the corresponding private keys, making them a fundamental component of decentralized systems.

## Structure and Functionality

### Mini-Database
Each account acts as a mini-database that can store various types of relevant data, including:

- **Asset Balances**: Information about the assets held within the account.
- **Smart Contracts**: Programs attached to the account with additional storage data populated in named programs.
- **Blockchain Data**: Information pertinent to on-chain governance.

### Nonce
Accounts are equipped with a nonce, which is a counter indicating the number of transactions sent from an externally-owned account. This mechanism ensures that only one transaction with a given nonce can be executed for each account, providing protection against replay attacks where signed transactions are repeatedly broadcast and re-executed.

## Cryptographic Keys

### Private Key
The private key is a crucial component of an account, serving as the means to sign transactions. Possession of the private key grants custody over the funds associated with the account. It is essential to understand that cryptocurrency is not physically held; instead, private keys are held, and the funds remain on the ledger, with each network node maintaining a copy. This setup prevents malicious actors from broadcasting fake transactions because the sender of any transaction can always be verified.

### Public Key
The public key is derived from the private key using the Elliptic Curve Digital Signature Algorithm (ECDSA). This cryptographic process ensures that the public key can be used to verify the authenticity of transactions signed by the corresponding private key, preventing forgeries.

## Account Address Generation

To generate a public address for an account, the following steps are undertaken:

1. **Hashing**: The 20 bytes of the Ripemd-160 hash of the public key are obtained.
2. **Encoding**: This hashed value is then encoded using the Bech32M function with Tangent-specific parameters.

This process results in a unique and secure address for each account on the blockchain.

## Security Implications

The use of cryptographic keys ensures that only authorized entities can send transactions from an account, maintaining the integrity and security of the blockchain. The decentralized nature of the ledger, where each node holds a copy, further enhances this security by making it difficult for malicious actors to tamper with transaction data.

By understanding these components and their interactions, users and developers can better navigate the complexities of blockchain technology and ensure the secure management of accounts and transactions.