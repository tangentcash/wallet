export namespace Messages {
  export class Generic {
    version: string = 'uint32';
    type: string = 'uint32';
  }

  export class Authentic extends Generic {
    signature: string = 'sighash';
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
    static type: number = 8;
  }

  export class AccountContribution {
    static type: number = 9;
  }

  export class WitnessAddress {
    static type: number = 12;
  }

  export class WitnessTransaction {
    static type: number = 13;
  }
}

export namespace Transactions {
  export class Transfer extends Ledger.Transaction {
    static __type__: number = 14;
    memo: string = 'string';
    value: string = 'decimal';
    to: string = 'pubkeyhash';

    getType() { return Transfer.__type__; }
  }

  export class Omnitransfer extends Ledger.Transaction {
    static __type__: number = 15;
    to: string[] = [
      'memo', 'uint32',
      'value', 'decimal',
      'to', 'pubkeyhash'
    ];

    getType() { return Omnitransfer.__type__; }
  }

  export class Rollup extends Ledger.Transaction {
    static __type__: number = 19;

    getType() { return Rollup.__type__; }
  }

  export class AddressAccount extends Ledger.Transaction {
    static __type__: number = 23;
    address: string = 'string';

    getType() { return AddressAccount.__type__; }
  }

  export class PubkeyAccount extends Ledger.Transaction {
    static __type__: number = 24;
    pubkey: string = 'string';
    sighash: string = 'string';

    getType() { return PubkeyAccount.__type__; }
  }

  export class ContributionAllocation extends Ledger.Transaction {
    static __type__: number = 27;

    getType() { return ContributionAllocation.__type__; }
  }
}