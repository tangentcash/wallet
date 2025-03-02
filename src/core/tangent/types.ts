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
  static ContributionSelection = Hashing.hash32(ByteUtil.byteStringToUint8Array(Transactions.ContributionSelection.typename));
  static ContributionActivation = Hashing.hash32(ByteUtil.byteStringToUint8Array(Transactions.ContributionActivation.typename));
  static ContributionDeselection = Hashing.hash32(ByteUtil.byteStringToUint8Array(Transactions.ContributionDeselection.typename));
  static ContributionDeactivation = Hashing.hash32(ByteUtil.byteStringToUint8Array(Transactions.ContributionDeactivation.typename));
}