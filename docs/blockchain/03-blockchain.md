# Blockchain

## Introduction to Blockchain Technology

A **blockchain** is a decentralized, public database distributed across multiple computers within a network. This structure ensures transparency, security, and immutability of data. Each participant in the network maintains an identical copy of the blockchain, promoting trust and eliminating the need for central authorities.

## Blocks and Transactions

### Block Structure

- **Blocks** are sequential groups of data that store transaction information and network state.
- When a user sends cryptocurrency, the transaction must be included in a block to be considered valid.
- The target time for creating a new block is set at 12 seconds.

## Chaining and Data Integrity

The term **chain** refers to the cryptographic linking of blocks. Each block contains a reference to its predecessor, creating an unbreakable chain of data. Any alteration to a block necessitates changes to all subsequent blocks, requiring consensus from the entire network.

## Network Consensus and Nodes

### Node Functionality

- **Nodes** are computers within the network responsible for maintaining and verifying blockchain data.
- They ensure that all participants have access to the same information, promoting consistency and trust.

### Consensus Mechanism

To achieve distributed agreement, blockchains employ consensus mechanisms. Tangent utilizes a unique hybrid approach combining proof-of-stake (PoS) with sequential-proof-of-work (sPoW).

## Tangent's Consensus Mechanism

Tangent implements a consensus mechanism to ensure network security and efficiency.

### Proof-of-Stake (PoS)

- Participants must stake at least 12 **TAN** (Tangent's native currency) as collateral.
- Genesis epoch (first 5,000 blocks) does not require any collateral.
- Validator software is required to participate in the validation process.
- Validators are randomly selected to propose new blocks based on their stake, which other validators then verify and add to the blockchain.

_Minimal staking amount may be reduced in future._

### Committee Structure

The **committee** term in this context refers to a list of validators who are eligible to create the next block. These validators do not communicate with each other; they operate independently. Essentially, they form a tiny group of randomly selected miners who will take over the block production process if miner placed above them in the list failed to do so in meaningful time.

## Validator Selection and Block Creation

### Committee Structure

- Blocks are created by a randomly selected committee of up to 12 validators.
- Validators are prioritized within their epoch, preventing lower-priority blocks from replacing higher-priority ones.
- Lower-priority blocks require increased computational difficulty.

## Rewards and Penalties

### Reward Mechanism

Each validated block rewards the winning validator with 1.2 TAN, subject to a 1% decay every 500,000 blocks until reaching a negative threshold.

At this point, the coinbase resets to 0.0002 TAN, ensuring sustained profits while capping annual inflation at approximately 0.00169%.

With a circulating supply of 30,500,000 TAN including rewards from genesis epoch, this design minimizes impact on token value.

### Genesis Epoch Rewards

To ensure initial network security, the first 5,000 blocks (genesis epoch) offer increased rewards with 40 TAN coinbase per block. This incentive encourages initial node operators to participate and maintain network integrity during the early stages.

### Emission Curve Design

The emission curve follows a linear progression, promoting fair value distribution for late joiners and encouraging long-term engagement. This balanced approach fosters a sustainable ecosystem.

### Penalty Framework

High-priority validators face penalties equal to their coinbase reward plus any TAN fees if they neglect duties. This structure incentivizes honest participation and ensures network resilience over time.

## Network Recovery Mechanism

In case of a network halt due to unavailability of the entire committee, any node can create a recovery block. This block must meet a difficulty level 60 times higher than the current difficulty, ensuring a minimum network recovery time of 12 minutes. The recovery block has the lowest priority and can be replaced by a block created by a validator selected for that proposal slot.

## Sequential-Proof-of-Work (sPoW)

Unlike traditional Proof-of-Work systems, sPoW maintains steady block times without relying on validator committee communication. It employs Verifiable Delay Functions, specifically Wesolowki's verifiable delay function, which requires sequential operations rather than allowing multithreading.

Classical blockchains use Proof-of-Work to create lottery-like conditions where miner with best hardware and luck creates a block faster than anyone else. The sPoW cannot be used to create such conditions as VDFs don't have the required luck factor.

Instead it provides a reliable way to verify the strength of chain of blocks. This is particularly advantageous because traditional Proof-of-Stake (PoS) networks depend entirely on the integrity of their economic model and token distribution, which can be susceptible to manipulation under certain conditions.