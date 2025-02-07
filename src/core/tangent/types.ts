import { ByteUtil, Hashing } from "./algorithm";
import { States, Transactions } from "./schema";


export class Types
{
  static AccountBalance = Hashing.hash32(ByteUtil.byteStringToUint8Array(States.AccountBalance.typename));
  static AccountDepository = Hashing.hash32(ByteUtil.byteStringToUint8Array(States.AccountDepository.typename));
  static WitnessAddress = Hashing.hash32(ByteUtil.byteStringToUint8Array(States.WitnessAddress.typename));
  static WitnessTransaction = Hashing.hash32(ByteUtil.byteStringToUint8Array(States.WitnessTransaction.typename));
  static Rollup = Hashing.hash32(ByteUtil.byteStringToUint8Array(Transactions.Rollup.typename));
  static ContributionAllocation = Hashing.hash32(ByteUtil.byteStringToUint8Array(Transactions.ContributionAllocation.typename));
}