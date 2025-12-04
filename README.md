<br/>
<div align="center">
    <br />
    <img src="https://github.com/tangentcash/cash/blob/main/var/images/favicon.png?raw=true" alt="Tangent Protocol Logo" width="100" />
    <h3>Tangent Protocol / Wallet App</h3>
</div>

## Project information
This wallet application leverages Cash Node's RPC capabilities to fetch and display comprehensive information about accounts, transactions, blocks, and overall network state. The app offers two modes of operation:

1. **Read-Only Mode**: Ideal for users who want to monitor their blockchain activities without interacting with the network.
2. **Full Interaction Mode**: Enables users to sign and submit transactions by providing sensitive information such as mnemonic phrases (recovery phrases) and private keys.

By default, the wallet connects to a public seeder node, which provides IP addresses of nodes offering public RPC services. This allows the wallet to effectively receive on-chain information. However, for enhanced security, users can specify their own node:

- **Self-Hosted Node**: This is the most secure option as it ensures that all data received is fully verified and trusted by the node runner.

For maximum security, always prefer using a self-hosted node for data verification. Be cautious when entering sensitive information such as mnemonic phrases and private keys. Standalone executable is always preferred over in-browser version.

## Building
Clone this repository
```bash
git clone https://github.com/tangentcash/wallet
```
Install dependencies
```bash
yarn
```
Build executable
```bash
yarn make        # Website files
yarn tauri build # Standalone executable
```

## License
This project is licensed under the MIT license