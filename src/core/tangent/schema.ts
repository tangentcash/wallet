export namespace Messages {
  export class Generic {
    version: string = 'uint32';
    type: string = 'uint32';
  }

  export class Authentic extends Generic {
    signature: string = 'recsighash';
  }
  
  export function asSigningSchema(schema: any): any {
    const signingSchema = { ...schema };
    for (let key in new Messages.Authentic()) {
      delete signingSchema[key];
    }
    return signingSchema;
  }
}

export namespace Ledger {
  export class Transaction extends Messages.Authentic {
    asset: string = 'assetid';
    gasPrice: string = 'decimal';
    gasLimit: string = 'uint256';
    sequence: string = 'uint64';
    conservative: string = 'boolean';
  }
}

export namespace States {
  export class AccountBalance {
    static typename: string = 'account_balance';
  }

  export class AccountDepository {
    static typename: string = 'account_depository';
  }

  export class WitnessAddress {
    static typename: string = 'witness_address';
  }

  export class WitnessTransaction {
    static typename: string = 'witness_transaction';
  }
}

export namespace Transactions {
  export class Transfer extends Ledger.Transaction {
    static typename: string = 'transfer';
    memo: string = 'string';
    value: string = 'decimal';
    to: string = 'pubkeyhash';

    getType() { return Transfer.typename; }
  }

  export class Omnitransfer extends Ledger.Transaction {
    static typename: string = 'omnitransfer';
    to: string[] = [
      'memo', 'uint32',
      'value', 'decimal',
      'to', 'pubkeyhash'
    ];

    getType() { return Omnitransfer.typename; }
  }

  export class Withdrawal extends Ledger.Transaction {
    static typename: string = 'withdrawal';
    proposer: string = 'pubkeyhash';
    to: string[] = [
      'to', 'string',
      'value', 'decimal'
    ];

    getType() { return Withdrawal.typename; }
  }

  export class Commitment extends Ledger.Transaction {
    static typename: string = 'commitment';
    online: string = 'uint8';
    observers: string[] = [
      'asset', 'assetid',
      'online', 'boolean'
    ];

    getType() { return Commitment.typename; }
  }

  export class Rollup extends Ledger.Transaction {
    static typename: string = 'rollup';

    getType() { return Rollup.typename; }
  }

  export class AddressAccount extends Ledger.Transaction {
    static typename: string = 'address_account';
    address: string = 'string';

    getType() { return AddressAccount.typename; }
  }

  export class PubkeyAccount extends Ledger.Transaction {
    static typename: string = 'pubkey_account';
    pubkey: string = 'string';
    sighash: string = 'string';

    getType() { return PubkeyAccount.typename; }
  }

  export class DelegationAccount extends Ledger.Transaction {
    static typename: string = 'delegation_account';
    proposer: string = 'pubkeyhash';

    getType() { return DelegationAccount.typename; }
  }

  export class ContributionAllocation extends Ledger.Transaction {
    static typename: string = 'contribution_allocation';

    getType() { return ContributionAllocation.typename; }
  }
  
  export class ContributionSelection extends Ledger.Transaction {
    static typename: string = 'contribution_selection';

    getType() { return ContributionSelection.typename; }
  }
  
  export class ContributionActivation extends Ledger.Transaction {
    static typename: string = 'contribution_activation';

    getType() { return ContributionActivation.typename; }
  }
  
  export class ContributionDeallocation extends Ledger.Transaction {
    static typename: string = 'contribution_deallocation';
    contributionActivationHash: string = 'uint256';
    cipherPublicKey1: string = 'pubkey';
    cipherPublicKey2: string = 'pubkey';

    getType() { return ContributionDeallocation.typename; }
  }

  export class ContributionDeselection extends Ledger.Transaction {
    static typename: string = 'contribution_deselection';

    getType() { return ContributionDeselection.typename; }
  }
  
  export class ContributionDeactivation extends Ledger.Transaction {
    static typename: string = 'contribution_deactivation';

    getType() { return ContributionDeactivation.typename; }
  }
  
  export class DepositoryAdjustment extends Ledger.Transaction {
    static typename: string = 'depository_adjustment';
    incomingAbsoluteFee: string = 'decimal';
    incomingRelativeFee: string = 'decimal';
    outgoingAbsoluteFee: string = 'decimal';
    outgoingRelativeFee: string = 'decimal';

    getType() { return DepositoryAdjustment.typename; }
  }

  export class DepositoryMigration extends Ledger.Transaction {
    static typename: string = 'depository_migration';
    proposer: string = 'pubkeyhash';
    value: string = 'decimal';

    getType() { return DepositoryMigration.typename; }
  }
}