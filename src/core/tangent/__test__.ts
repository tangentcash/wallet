import BigNumber from 'bignumber.js';
import { Chain, Hashing, Signing, Uint256, ByteUtil, Sighash, Pubkeyhash, AssetId } from './algorithm';
import { SchemaUtil, Stream } from './serialization';
import { Transactions } from './schema';

export default function test() {
  let props = Chain.props;
  Chain.props = Chain.regtest;

  let mnemonic = 'chimney clerk liberty defense gesture risk disorder switch raven chapter document admit win swing forward please clerk vague online coil material tone sibling intact';
  let privateKey = Signing.derivePrivateKeyFromMnemonic(mnemonic);
  let rootPublicKey = privateKey ? Signing.derivePublicKey(privateKey) : null;
  let publicKey = rootPublicKey ? Signing.deriveTweakedPublicKey(rootPublicKey) : null;
  let publicKeyHash = publicKey ? Signing.derivePublicKeyHash(publicKey) : null;
  let message = 'Hello, World!';
  let messageHash = new Uint256(Hashing.hash256(ByteUtil.utf8StringToUint8Array(message)));
  let signature = privateKey ? Signing.signTweaked(messageHash, privateKey) : null;
  let recoverPublicKey = signature ? Signing.recoverTweaked(messageHash, signature) : null;
  let recoverPublicKeyHash = signature ? Signing.recoverTweakedHash(messageHash, signature) : null;
  let cryptography = {
    mnemonic: mnemonic,
    mnemonicTest: Signing.verifyMnemonic(mnemonic) ? 'passed' : 'failed',
    privateKey: privateKey ? Signing.encodePrivateKey(privateKey) : null,
    privateKeyTest: privateKey && Signing.verifyPrivateKey(privateKey) ? 'passed' : 'failed',
    publicKey: publicKey ? Signing.encodePublicKey(publicKey) : null,
    publicKeyTest: publicKey && Signing.verifyPublicKey(publicKey) ? 'passed' : 'failed',
    address: publicKeyHash ? Signing.encodeAddress(publicKeyHash) : null,
    addressTest: publicKeyHash && Signing.verifyAddress(Signing.encodeAddress(publicKeyHash) || '') ? 'passed' : 'failed',
    message: message,
    messageHash: messageHash.toHex(),
    signature: signature ? ByteUtil.uint8ArrayToHexString(signature.data) : null,
    signatureTest: publicKey && signature && Signing.verifyTweaked(messageHash, publicKey, signature) ? 'passed' : 'failed',
    recoverPublicKey: recoverPublicKey ? Signing.encodePublicKey(recoverPublicKey) : null,
    recoverPublicKeyTest: recoverPublicKey && publicKey && recoverPublicKey.equals(publicKey) ? 'passed' : 'failed',
    recoverAddress: recoverPublicKeyHash ? Signing.encodeAddress(recoverPublicKeyHash) : null,
    recoverAddressTest: recoverPublicKeyHash && publicKeyHash && recoverPublicKeyHash.equals(publicKeyHash) ? 'passed' : 'failed'
  };
  
  let transfer = {
    signature: new Sighash('0xb628aed6c1501b728d54bb106201cb5ba1be6f1670fe013c5f370bbc9b76b6434d77455a21cbe9a3533dede41e8727a9815d782b58bb958637dc9f88936d73da01'),
    asset: AssetId.fromHandle('BTC'),
    gasPrice: new BigNumber('0.0000000005'),
    gasLimit: new Uint256(10000),
    sequence: 3,
    conservative: false,
    memo: '',
    value: new BigNumber(0.1),
    to: new Pubkeyhash('0x26e43159073658d6590a95febb3b5b1898b1a22b')
  };
  let stream = new Stream();
  let serialization = null;
  SchemaUtil.store(stream, transfer, new Transactions.Transfer());
  try {
    serialization = {
      hash: stream.hash().toHex(),
      data: stream.encode(),
      vars: SchemaUtil.array(stream.rewind(0)),
      storeObject: transfer,
      loadObject: SchemaUtil.load(stream.rewind(0), new Transactions.Transfer())
    };
  } catch (exception) {
    serialization = exception;
  }
  
  let btcAsset = AssetId.fromHandle('BTC');
  let ethAsset = AssetId.fromHandle('ETH', 'USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7');
  let numberAsset = new AssetId(5788240);
  let hexAsset = new AssetId('0x425443');
  let assets = {
    btcAsset: btcAsset,
    btcAssetTest: btcAsset.isValid(),
    ethAssetId: ethAsset,
    ethAssetTest: ethAsset.isValid(),
    numberAssetId: numberAsset,
    numberAssetTest: numberAsset.isValid(),
    hexAssetId: hexAsset,
    hexAssetTest: hexAsset.isValid(),
  };

  Chain.props = props;
  return {
    cryptography,
    serialization,
    assets
  };
}