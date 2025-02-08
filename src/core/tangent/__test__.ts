import BigNumber from 'bignumber.js';
import { Chain, Hashing, Signing, Uint256, ByteUtil, Pubkeyhash, AssetId, Recsighash } from './algorithm';
import { SchemaUtil, Stream } from './serialization';
import { Transactions } from './schema';

export async function test() {
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
  let cipherNonce = new Uint256(1);
  let cipherKeypair = secretKey ? await Signing.deriveCipherKeypair(secretKey, cipherNonce) : null;
  let ciphertext = cipherKeypair ? await Signing.publicEncrypt(cipherKeypair.cipherPublicKey, ByteUtil.byteStringToUint8Array(message), Signing.keygen().data) : null;
  let recoverPlaintext = cipherKeypair && ciphertext ? await Signing.privateDecrypt(cipherKeypair.cipherSecretKey, cipherKeypair.cipherPublicKey, ciphertext) : null;
  let cryptography = {
    mnemonic: mnemonic,
    secretKey: secretKey ? Signing.encodeSecretKey(secretKey) : null,
    publicKey: publicKey ? Signing.encodePublicKey(publicKey) : null,
    address: publicKeyHash ? Signing.encodeAddress(publicKeyHash) : null,
    message: message,
    messageHash: messageHash.toHex(),
    signature: signature ? ByteUtil.uint8ArrayToHexString(signature.data) : null,
    recoverPublicKey: recoverPublicKey ? Signing.encodePublicKey(recoverPublicKey) : null,
    recoverAddress: recoverPublicKeyHash ? Signing.encodeAddress(recoverPublicKeyHash) : null,
    cipherNonce: cipherNonce.toString(),
    cipherSecretKey: cipherKeypair ? ByteUtil.uint8ArrayToHexString(cipherKeypair.cipherSecretKey.data) : null,
    cipherPublicKey: cipherKeypair ? ByteUtil.uint8ArrayToHexString(cipherKeypair.cipherPublicKey.data) : null,
    ciphertext: ciphertext ? ByteUtil.uint8ArrayToHexString(ciphertext) : null,
    recoverPlaintext: recoverPlaintext ? ByteUtil.uint8ArrayToByteString(recoverPlaintext) : null,
    tests: {
      mnemonic: Signing.verifyMnemonic(mnemonic) ? 'passed' : 'failed',
      secretKey: secretKey && Signing.verifySecretKey(secretKey) ? 'passed' : 'failed',
      publicKey: publicKey && Signing.verifyPublicKey(publicKey) ? 'passed' : 'failed',
      address: publicKeyHash && Signing.verifyAddress(Signing.encodeAddress(publicKeyHash) || '') ? 'passed' : 'failed',
      signature: publicKey && signature && Signing.verify(messageHash, publicKey, signature) ? 'passed' : 'failed',
      recoverPublicKey: recoverPublicKey && publicKey && recoverPublicKey.equals(publicKey) ? 'passed' : 'failed',
      recoverAddress: recoverPublicKeyHash && publicKeyHash && recoverPublicKeyHash.equals(publicKeyHash) ? 'passed' : 'failed',
      recoverPlaintext: recoverPlaintext && ByteUtil.uint8ArrayToByteString(recoverPlaintext) == message ? 'passed' : 'failed',
    }
  };
  
  let transfer = {
    signature: new Recsighash('0x2ea73e535ea3abb4edb4bcb6b2f831fff37a1c0334f294837698afad7aa10a9a435f7fa05c42ace2465dca25beca60b50134e4b067e5c17c083ba58c4b602bd900'),
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
    ethAssetId: ethAsset,
    numberAssetId: numberAsset,
    hexAssetId: hexAsset,
    tests: {
      btcAsset: btcAsset.isValid() ? 'passed' : 'failed',
      ethAsset: ethAsset.isValid() ? 'passed' : 'failed',
      numberAsset: numberAsset.isValid() ? 'passed' : 'failed',
      hexAsset: hexAsset.isValid() ? 'passed' : 'failed',
    }
  };

  Chain.props = props;
  return {
    cryptography,
    serialization,
    assets
  };
}