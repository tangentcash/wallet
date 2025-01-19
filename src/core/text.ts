import { AssetId } from "./tangent/algorithm";
import BigNumber from "bignumber.js";
import Names from '../assets/cryptocurrency/names.json';
import Colors from '../assets/cryptocurrency/colors.json';

export class Readability {
  static toAssetName(asset: AssetId): string {
    const token: string | null = asset.token?.toUpperCase() || null;
    const chain: string = asset.chain?.toUpperCase() || '[CHAIN?]';
    if (token != null) {
      const name = (Names as Record<string, string>)[token];
      if (name != null)
        return name;

      return token + ' on ' + chain;
    }

    return (Names as Record<string, string>)[chain] || chain;
  }
  static toAssetColor(asset: AssetId): string {
    const token: string | null = asset.token?.toLowerCase() || null;
    if (token != null) {
      return (Colors as Record<string, string>)[token] || token;
    }

    const chain: string = asset.chain?.toLowerCase() || 'var(--gray-5)';
    return (Colors as Record<string, string>)[chain] || chain;
  }
  static toAddressIndex(index?: BigNumber): string {
    if (!index)
      return 'ANY';

    return (index.eq(0) ? 'ROOT' : 'CHILD') + index.toString();
  }
  static toTransactionCategory(type: string): string {
    switch (type) {
      case 'functional':
        return 'Functional';
      case 'delegation':
        return 'Delegation';
      case 'consensus':
        return 'Consensus';
      case 'aggregation':
        return 'Aggregation';
      default:
        return 'Non-standard';
    }
  }
  static toTransactionType(type: string): string {
    switch (type) {
      case 'transfer':
        return 'Transfer';
      case 'omnitransfer':
        return 'Bulk transfer';
      case 'deployment':
        return 'Contract creation';
      case 'invocation':
        return 'Contract call';
      case 'withdrawal':
        return 'Internal withdrawal';
      case 'rollup':
        return 'Rollup';
      case 'address_account':
        return 'Address registration';
      case 'pubkey_account':
        return 'Pubkey registration';
      case 'delegation_account':
        return 'Deposit wallet delegation';
      case 'custodian_account':
        return 'Deposit wallet creation';
      case 'commitment':
        return 'Validator activity';
      case 'replay':
        return 'Bridge withdrawal';
      case 'contribution_allocation':
        return 'Coverage wallet election';
      case 'contribution_activation':
        return 'Coverage wallet creation';
      case 'contribution_deallocation':
        return 'Coverage wallet dismission';
      case 'contribution_deactivation':
        return 'Coverage wallet unlock';
      case 'contribution_adjustment':
        return 'Fee policy activity';
      case 'contribution_allowance':
        return 'Coverage policy activity';
      case 'contribution_migration':
        return 'Custody migration';
      case 'claim':
        return 'Bridging transaction';
      default:
        return 'Non-standard';
    }
  }
  static toValue(asset: AssetId, value: string | number | BigNumber | null, delta: boolean, trailing: boolean): string {
    if (value == null)
      return '[null]';

    const numeric: BigNumber = value instanceof BigNumber ? value : new BigNumber(value);
    const places = numeric.decimalPlaces();
    const text: string[] = (places ? numeric.toFormat(places) : numeric.toString()).split('.');
    if (trailing && text.length < 2)
      text.push('0');

    const result = text[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (text.length > 1 ? '.' + text[1] : '') + ' ' + (asset.token || asset.chain);
    return delta ? ((numeric.gt(0) ? '+' : '') + result) : result;
  }
  static toMoney(asset: AssetId, value: string | number | BigNumber | null, delta?: boolean): string {
    return this.toValue(asset, value, delta || false, true);
  }
  static toUnit(value: string | number | BigNumber | null, delta?: boolean): string {
    if (value == null)
      return '[null]';

    const numeric: BigNumber = value instanceof BigNumber ? value : new BigNumber(value);
    const asset = new AssetId();
    asset.chain = numeric.eq(1) ? 'unit' : 'units';
    return this.toValue(asset, numeric, delta || false, false);
  }
  static toGas(value: string | number | BigNumber | null, delta?: boolean): string {
    if (value == null)
      return '[null]';

    const numeric: BigNumber = value instanceof BigNumber ? value : new BigNumber(value);
    const asset = new AssetId();
    asset.chain = numeric.eq(1) ? 'gas unit' : 'gas units';
    return this.toValue(asset, numeric, delta || false, false);
  }
  static toTimespan(value: string | number | BigNumber | null, delta?: boolean): string {
    if (value == null)
      return '[null]';

    const numeric: BigNumber = value instanceof BigNumber ? value : new BigNumber(value);
    const seconds = numeric.gte(1000);
    const asset = new AssetId();
    asset.chain = seconds ? 'sec.' : 'ms';
    return this.toValue(asset, seconds ? numeric.dividedBy(1000) : numeric, delta || false, false);
  }
  static toCount(name: string, value: string | number | BigNumber | null, delta?: boolean): string {
    if (value == null)
      return '[null]';

    const numeric: BigNumber = value instanceof BigNumber ? value : new BigNumber(value);
    const asset = new AssetId();
    asset.chain = numeric.eq(1) ? name : (name + 's');
    return this.toValue(asset, numeric, delta || false, false);
  }
  static toHash(value?: string, size?: number): string {
    if (!value)
      return 'none';

    return value.substring(0, size || 16) + '...' + value.substring(value.length - (size || 16));
  }
  static toAddress(value?: string, size?: number): string {
    if (!value)
      return 'none';
    
    return value.substring(0, size || 8) + '...' + value.substring(value.length - (size || 8));
  }
}