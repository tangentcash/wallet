export namespace Messages {
  export class Uniform {
    type: string = 'uint32';
  }

  export class Authentic extends Uniform {
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

  export class DepositoryBalance {
    static typename: string = 'depository_balance';
  }

  export class DepositoryPolicy {
    static typename: string = 'depository_policy';
  }

  export class WitnessAccount {
    static typename: string = 'witness_account';
  }

  export class WitnessTransaction {
    static typename: string = 'witness_transaction';
  }
}

export namespace Transactions {
  export namespace Transfer {
    export class One extends Ledger.Transaction {
      static typename: string = 'transfer';
      memo: string = 'string';
      value: string = 'decimal';
      to: string = 'pubkeyhash';
  
      getType() { return One.typename; }
    }
  
    export class Many extends Ledger.Transaction {
      static typename: string = 'transfer';
      to: string[] = [
        'memo', 'uint32',
        'value', 'decimal',
        'to', 'pubkeyhash'
      ];
  
      getType() { return Many.typename; }
    }
  }

  export class Rollup extends Ledger.Transaction {
    static typename: string = 'rollup';

    getType() { return Rollup.typename; }
  }

  export class Certification extends Ledger.Transaction {
    static typename: string = 'certification';
    online: string = 'uint8';
    observers: string[] = [
      'asset', 'assetid',
      'online', 'boolean'
    ];

    getType() { return Certification.typename; }
  }

  export class RoutingAccount extends Ledger.Transaction {
    static typename: string = 'routing_account';
    address: string = 'string';

    getType() { return RoutingAccount.typename; }
  }

  export class DepositoryAccount extends Ledger.Transaction {
    static typename: string = 'depository_account';
    proposer: string = 'pubkeyhash';

    getType() { return DepositoryAccount.typename; }
  }

  export class DepositoryWithdrawal extends Ledger.Transaction {
    static typename: string = 'depository_withdrawal';
    onlyIfNotInQueue: string = 'boolean';
    proposer: string = 'pubkeyhash';
    migrationProposer: string = 'pubkeyhash';
    to: string[] = [
      'to', 'string',
      'value', 'decimal'
    ];

    getType() { return DepositoryWithdrawal.typename; }
  }

  export class DepositoryAdjustment extends Ledger.Transaction {
    static typename: string = 'depository_adjustment';
    incomingAbsoluteFee: string = 'decimal';
    incomingRelativeFee: string = 'decimal';
    outgoingAbsoluteFee: string = 'decimal';
    outgoingRelativeFee: string = 'decimal';
    securityLevel: string = 'uint8';
    acceptsAccountRequests: string = 'boolean';
    acceptsWithdrawalRequests: string = 'boolean';

    getType() { return DepositoryAdjustment.typename; }
  }

  export class DepositoryMigration extends Ledger.Transaction {
    static typename: string = 'depository_migration';

    getType() { return DepositoryMigration.typename; }
  }
}