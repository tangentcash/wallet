import Regtest from './regtest.config.json'
import Testnet from './testnet.config.json'
import Mainnet from './mainnet.config.json'
import { NetworkType } from 'tangentsdk';

const resolve = (network: NetworkType): {
  node: { resolverUrl: string | null, serverUrl: string | null, authorizer: boolean },
  wallet: { network: string, password: string | null },
  swap: { url: string, route: string, asset: string }
} => {
  switch (network) {
    case NetworkType.Regtest:
      return Regtest;
    case NetworkType.Testnet:
      return Testnet;
    case NetworkType.Mainnet:
      return Mainnet;
    default:
      throw new Error('invalid network');
  }
}
const config = resolve(NetworkType.Testnet);

export default config;