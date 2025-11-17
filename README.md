<br/>
<div align="center">
    <br />
    <img src="https://github.com/tangentcash/cash/blob/main/var/images/icon.png?raw=true" alt="Tangent Protocol Logo" width="100" />
    <h3>Tangent Protocol / Wallet App</h3>
</div>

## Project information
This is a wallet app that utilizes Cash Node's RPC capabilities to receive and display informations about accounts, transactions, blocks and overall network state. Wallet can be used in read-only mode or can include secret information such as mnemonic phrase (recovery phrase) and private key to sign and submit transactions to blockchain. By default wallet connects to a public seeder node that sends out ip addresses that provide public RPC and tries to use those results to effectively receive on-chain information. User can specify their own node to override this behavior which would be the most secure option as data received by self-hosted node is fully verified and can be trusted by node runner.

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