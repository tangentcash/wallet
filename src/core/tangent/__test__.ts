import BigNumber from 'bignumber.js';
import { Chain, Hashing, Signing, Uint256, ByteUtil, Pubkeyhash, AssetId, Recsighash } from './algorithm';
import { SchemaUtil, Stream } from './serialization';
import { Transactions } from './schema';

export default function test() {
  let props = Chain.props;
  Chain.props = Chain.regtest;

  let mnemonic = 'chimney clerk liberty defense gesture risk disorder switch raven chapter document admit win swing forward please clerk vague online coil material tone sibling intact';
  let secretKey = Signing.deriveSecretKeyFromMnemonic(mnemonic);
  let publicKey = secretKey ? Signing.derivePublicKey(secretKey) : null;
  let publicKeyHash = publicKey ? Signing.derivePublicKeyHash(publicKey) : null;
  let message = 'Hello, World!';
  let messageHash = new Uint256(Hashing.hash256(ByteUtil.utf8StringToUint8Array(message)));
  let signature = secretKey ? Signing.sign(messageHash, secretKey) : null;
  let recoverPublicKey = signature ? Signing.recover(messageHash, signature) : null;
  let recoverPublicKeyHash = signature ? Signing.recoverHash(messageHash, signature) : null;
  let cryptography = {
    mnemonic: mnemonic,
    mnemonicTest: Signing.verifyMnemonic(mnemonic) ? 'passed' : 'failed',
    secretKey: secretKey ? Signing.encodeSecretKey(secretKey) : null,
    publicKey: publicKey ? Signing.encodePublicKey(publicKey) : null,
    publicKeyTest: publicKey && Signing.verifyPublicKey(publicKey) ? 'passed' : 'failed',
    address: publicKeyHash ? Signing.encodeAddress(publicKeyHash) : null,
    addressTest: publicKeyHash && Signing.verifyAddress(Signing.encodeAddress(publicKeyHash) || '') ? 'passed' : 'failed',
    message: message,
    messageHash: messageHash.toHex(),
    signature: signature ? ByteUtil.uint8ArrayToHexString(signature.data) : null,
    signatureTest: publicKey && signature && Signing.verify(messageHash, publicKey, signature) ? 'passed' : 'failed',
    recoverPublicKey: recoverPublicKey ? Signing.encodePublicKey(recoverPublicKey) : null,
    recoverPublicKeyTest: recoverPublicKey && publicKey && recoverPublicKey.equals(publicKey) ? 'passed' : 'failed',
    recoverAddress: recoverPublicKeyHash ? Signing.encodeAddress(recoverPublicKeyHash) : null,
    recoverAddressTest: recoverPublicKeyHash && publicKeyHash && recoverPublicKeyHash.equals(publicKeyHash) ? 'passed' : 'failed'
  };
  
  let transfer = {
    signature: new Recsighash('0xfb302946de3850cf8bfbf38e1920e169240c1ecf184f7def0bb6e109c58f2e2f7535ed6d78070bed307976bbbee82f3daa3befbe57ed6cb068f7451026b7520755dfaf58d275a5d1cea975e87a750a660670e2f561b8aa9e55acad6fe6d23ac1'),
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