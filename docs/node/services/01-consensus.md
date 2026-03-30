# Consensus

## Overview

A consensus node is a crucial component of a blockchain's peer-to-peer (P2P) network, serving as a core part of the protocol. It facilitates the synchronization and validation of transactions, blocks, and attestations across the network while ensuring robust and efficient network operations.

## Network Connection and Discovery

### Initial Connection
Upon startup, a consensus node connects to known nodes obtained from:

- **Bootstrap Nodes**: Preconfigured nodes that help new nodes join the network.

- **Other Nodes**: Nodes discovered during the initial connection process.

### Overriding Peers List
Users can specify an overriding peers list containing prioritized nodes. These nodes are attempted first and have higher priority than those discovered through the standard discovery process.

## Data Handling

### Transaction, Block, and Attestation Processing
The node accepts transactions, blocks, and attestations from its neighbors and re-broadcasts them to ensure network-wide propagation.

### Time Synchronization
To maintain network consistency, the node performs time synchronization with its peers to ensure all nodes have a coherent view of the current time.

## Network Health and Optimization

### Health Checks
Regular health checks are performed with neighboring nodes to monitor their status and responsiveness.

### Topology Optimization
The node periodically optimizes the P2P network topology to reduce latency and improve overall network efficiency.

## Discoverability and Proxies

### Public Key Publication
By publishing its public keys, the node becomes discoverable by accounts within the network.

### NAT Traversal
Nodes can use neighboring nodes as proxies to connect to other nodes that may be behind Network Address Translation (NAT) devices.

## Initial Block Download (IBD)

### Block Tip Checks
Upon initial connection to a peer, the node performs block tip checks. If the node is new or has an outdated block tip, it initiates the IBD process.

### Parallel Header Verification
To ensure safety during IBD, the node uses parallel header verification before downloading blocks.

### Efficient Block Download
The node downloads multiple blocks per request, significantly speeding up the IBD process.

## Communication Protocol

The node communicates with other P2P nodes using a compact API focused on:

- Blocks

- Transactions

- Attestations

- MPC Coordination

## Connection Methods

The node can connect to other P2P nodes directly, indirectly through proxies, or request reverse connections from other nodes.

## Fork and Re-org Resolution

As new block data arrives, the node resolves all forks and re-organizations (re-orgs) to maintain a consistent blockchain state.

## Background Tasks

The node runs several background tasks, including:

- **Topology Optimization**: Improves network layout.

- **Mempool Vacuums**: Expires old transactions and temporary data.

- **Fork Resolution**: Resolves block conflicts.

- **Attestation Resolution**: Re-broadcasts stale attestations.

- **Block Production**: Creates new blocks.

- **Block Dispatching**: Runs off-chain tasks based on internal block transactions.

## MPC and Block Production

The node can participate in MPC tasks, attestation tasks, and block production (mining) only if there is an on-chain request. The node's account must be enabled for these processes through a setup transaction.

## Account Requirement

At least one account is required for the node to connect to other nodes within the network.

## Node Banning and Bandwidth Limiting

The node can ban other P2P nodes in case of network disruptions or prolonged unreachability. It also limits the network bandwidth used by P2P peers to prevent network congestion.

## Aggregation of Validators

The node can aggregate validators to perform various MPC tasks requested by the protocol's bridge system, such as:

- Public key aggregation

- Signature aggregation

- Entropy shares aggregation/distribution

- Entropy recovery

## Inventory Management

The node maintains an 'inventory' of broadcast message hashes, acting as a cache to reduce the overhead of broadcast messages. This inventory helps the node keep track of which neighbors are aware of specific messages.

## RPC Event Notification

When new blocks and transactions arrive, the node sends events to an RPC service to notify other components or users about these updates.

## Mempool Synchronization

Upon initial connection to a node, the mempool is synchronized to ensure the node has the most up-to-date list of pending transactions.

## IBD Process Optimization

During the IBD process, the node avoids re-broadcasting block data to minimize network disruption and focus on efficiently downloading and verifying blocks.