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

## Links

* [![Project website](https://img.shields.io/badge/Tangent-Cash-3d665c.svg?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSI2NDBweCIgaGVpZ2h0PSI2NDBweCIgc3R5bGU9InNoYXBlLXJlbmRlcmluZzpnZW9tZXRyaWNQcmVjaXNpb247IHRleHQtcmVuZGVyaW5nOmdlb21ldHJpY1ByZWNpc2lvbjsgaW1hZ2UtcmVuZGVyaW5nOm9wdGltaXplUXVhbGl0eTsgZmlsbC1ydWxlOmV2ZW5vZGQ7IGNsaXAtcnVsZTpldmVub2RkIj4gDQogICAgPHJlY3QgZmlsbD0iIzNkNjY1YyIgeD0iMCIgeT0iMCIgd2lkdGg9IjY0MCIgaGVpZ2h0PSI2NDAiIHJ4PSIxNjAiIHJ5PSIxNjAiLz4NCiAgICA8cGF0aCBmaWxsPSIjNDhmZmIwIiBkPSJNIDMwNS41LDEzOS41IEMgMzA4LjI2NSwxMzkuNzk4IDMxMC43NjUsMTQwLjc5OCAzMTMsMTQyLjVDIDMyMC44MzksMTUyLjg1MyAzMjguMTcyLDE2My41MiAzMzUsMTc0LjVDIDM0Ny45MTQsMTk1LjMyNSAzNjAuNTgxLDIxNi4zMjUgMzczLDIzNy41QyA0MDguNDI2LDI5Mi41ODcgNDQzLjQyNiwzNDcuOTIgNDc4LDQwMy41QyA0ODQuMzAyLDQxNC4xMjEgNDkwLjEzNiw0MjQuOTU1IDQ5NS41LDQzNkMgNDk0LjA4NCw0MzguODM1IDQ5Mi40MTcsNDQxLjUwMiA0OTAuNSw0NDRDIDM3Ni44MzQsNDQ0LjUgMjYzLjE2Nyw0NDQuNjY3IDE0OS41LDQ0NC41QyAxNDcuODE5LDQ0MS43OTcgMTQ2LjE1Myw0MzkuMTMxIDE0NC41LDQzNi41QyAxNDcuNjMzLDQyOC41MTkgMTUxLjQ2Nyw0MjAuODUyIDE1Niw0MTMuNUMgMTc4Ljc0OCwzNzcuNjczIDIwMS4yNDgsMzQxLjY3MyAyMjMuNSwzMDUuNUMgMjM1Ljk2OSwyODUuMjQ4IDI0OC45NjksMjY1LjI0OCAyNjIuNSwyNDUuNUMgMjY0LjE0NSwyNDQuMzA0IDI2NS44MTEsMjQzLjMwNCAyNjcuNSwyNDIuNUMgMjczLjE3OSwyNDMuMzM5IDI3Ny4zNDYsMjQ2LjMzOSAyODAsMjUxLjVDIDI5Ny4wMjUsMjc3Ljg0OSAzMTMuMTkyLDMwNC42ODIgMzI4LjUsMzMyQyAzMjMuNTk1LDM0MC44OTkgMzE2LjI2MiwzNDYuODk5IDMwNi41LDM1MEMgMzAzLjUxOCwzNTAuNDk4IDMwMC41MTgsMzUwLjY2NSAyOTcuNSwzNTAuNUMgMjk2LjMxMiwzNDkuNjM2IDI5NS4xNDUsMzQ4LjYzNiAyOTQsMzQ3LjVDIDI4Ni4zMDQsMzM0Ljk5MyAyNzguNDcsMzIyLjY2IDI3MC41LDMxMC41QyAyNjkuMTkyLDMwNi41OTcgMjY3LjY5MiwzMDYuNTk3IDI2NiwzMTAuNUMgMjQ5LjA2MiwzMzguNDMzIDIzMS43MjksMzY2LjA5OSAyMTQsMzkzLjVDIDIxMS4yNzQsMzk3LjYxOSAyMDkuMTA3LDQwMS45NTIgMjA3LjUsNDA2LjVDIDIxNy4wNDMsNDA2LjYyOSAyMjYuMzc3LDQwNi42MjkgMjM1LjUsNDA2LjVDIDI4OS4yNjQsNDA3LjgzIDM0Mi45MzEsNDA3LjgzIDM5Ni41LDQwNi41QyA0MDguNSw0MDYuNSA0MjAuNSw0MDYuNSA0MzIuNSw0MDYuNUMgNDMyLjY0OSw0MDUuNDQ4IDQzMi40ODMsNDA0LjQ0OCA0MzIsNDAzLjVDIDM4NC42NDMsMzI5LjQ0OCAzMzguMzA5LDI1NC43ODEgMjkzLDE3OS41QyAyOTAuNTksMTc0LjY4NiAyODguNzU3LDE2OS42ODYgMjg3LjUsMTY0LjVDIDI4OS45OTMsMTU4LjIyMSAyOTMuMTYsMTUyLjIyMSAyOTcsMTQ2LjVDIDI5OS42MjgsMTQzLjc5IDMwMi40NjEsMTQxLjQ1NiAzMDUuNSwxMzkuNSBaIi8+DQo8L3N2Zz4=)](https://tangent.cash/)
* [![Discord server](https://img.shields.io/badge/Discord-Server-5865f2?logo=discord)](https://discord.gg/TyubmucCTB)

## License
This project is licensed under the MIT license
