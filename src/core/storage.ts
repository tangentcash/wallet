import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@ethersproject/random';
import { ByteUtil } from 'tangentsdk';
import { openDB, IDBPDatabase } from 'idb';

export enum StorageField {
  Network = '__network__',
  Passphrase = '__passphrase__',
  Accounts = '__accounts__',
  App = '__app__'
}

export class AppStorage {
  static set(path: string, value?: any): boolean {
    try {
      if (value != null)
        localStorage.setItem(path, JSON.stringify(value));
      else
        localStorage.removeItem(path);
      return true;
    } catch {
      return false;
    }
  }
  static get(path: string): any | null {
    try {
      let value = localStorage.getItem(path);
      try {
        return value ? JSON.parse(value) : null;
      } catch {
        return value || null;
      }
    } catch {
      return null;
    }
  }
  static keys(): string[] {
    const result: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key != null)
          result.push(key);
      }
    } catch { }
    return result;
  }
  static wipe(): void {
    localStorage.clear();
  }
}

export class BigStorage {
  static handle: IDBPDatabase<any> | null = null;

  static async set(path: string, value?: any): Promise<boolean> {
    try {
      const db = await this.db();
      if (value != null)
        await db.put('kvm', JSON.stringify(value), path);
      else
        await db.delete('kvm', path);
      return true;
    } catch {
      return false;
    }
  }
  static async get(path: string): Promise<any | null> {
    try {
      const db = await this.db();
      const value = await db.get('kvm', path);
      try {
        return value ? JSON.parse(value) : null;
      } catch {
        return value || null;
      }
    } catch {
      return null;
    }
  }
  static async keys(): Promise<string[]> {
    const result: string[] = [];
    try {
      const db = await this.db();
      const keys = await db.getAllKeys('kvm');
      for (let i = 0; i < keys.length; i++) {
        result.push(keys[i].toString());
      }
    } catch {
      return [];
    }
    return result;
  }
  private static async db(): Promise<IDBPDatabase<any>> {
    if (!this.handle) {
      this.handle = await openDB('kvms', 1, {
        upgrade: (db) => db.createObjectStore('kvm')
      });
      if (!this.handle) {
        throw false;
      }
    }
    return this.handle;
  }
}

export class SafeStorage {
  static key: Uint8Array | null = null;

  private static derivePassphraseKey(passphrase: string): Uint8Array {
    const security = 16384;
    let key: Uint8Array = sha256(passphrase);
    for (let i = 0; i < security; i++)
      key = sha256(key);
    return key;
  }
  static async reset(passphrase: string): Promise<boolean> {
    if (!this.key)
      this.key = randomBytes(32);

    const derivedKey = this.derivePassphraseKey(passphrase);
    const payload = Uint8Array.from([...randomBytes(240), ...this.key, ...randomBytes(240)]);
    try {
      const iv = randomBytes(16);
      const key = await crypto.subtle.importKey('raw', derivedKey as any, { 'name': 'AES-CBC' }, false, ['encrypt']);
      const data = await crypto.subtle.encrypt({ name: 'AES-CBC', length: 256, iv: iv as any }, key, payload);
      AppStorage.set(StorageField.Passphrase, ByteUtil.uint8ArrayToHexString(Uint8Array.from([...iv, ...new Uint8Array(data)])));
      return true;
    } catch {
      return false;
    }
  }
  static async restore(passphrase: string): Promise<boolean> {
    const value = AppStorage.get(StorageField.Passphrase);
    if (!value)
      return false;

    const message = ByteUtil.hexStringToUint8Array(value);
    if (message.length <= 16)
      return false;

    const derivedKey = this.derivePassphraseKey(passphrase);
    try {
      const iv = message.slice(0, 16);
      const key = await crypto.subtle.importKey('raw', derivedKey as any, { 'name': 'AES-CBC' }, false, ['decrypt']);
      const data = await crypto.subtle.decrypt({ name: 'AES-CBC', length: 256, iv: iv }, key, message.slice(16));
      const payload = new Uint8Array(data).slice(240, 240 + 32);
      if (payload.length != 32)
        return false;

      this.key = payload;
      return true;
    } catch {
      return false;
    }
  }
  static async set(path: string, value?: any): Promise<boolean> {
    if (!this.key)
      return false;

    if (!value) {
      AppStorage.set(path);
      return true;
    }

    const payload = Uint8Array.from([...randomBytes(128), ...ByteUtil.utf8StringToUint8Array(JSON.stringify(value)), ...randomBytes(128)]);
    try {
      const iv = randomBytes(16);
      const key = await crypto.subtle.importKey('raw', sha256(Uint8Array.from([...this.key, ...sha256(path)])) as any, { 'name': 'AES-CBC' }, false, ['encrypt']);
      const data = await crypto.subtle.encrypt({ name: 'AES-CBC', length: 256, iv: iv as any }, key, payload);
      AppStorage.set(path, ByteUtil.uint8ArrayToHexString(Uint8Array.from([...iv, ...new Uint8Array(data)])));
      return true;
    } catch {
      return false;
    }
  }
  static async get(path: string): Promise<any | null> {
    if (!this.key)
      return null;

    const value = AppStorage.get(path);
    if (value == null)
      return null;

    const message = ByteUtil.hexStringToUint8Array(value);
    if (!message || message.length <= 16)
      return null;

    try {
      const iv = message.slice(0, 16);
      const key = await crypto.subtle.importKey('raw', sha256(Uint8Array.from([...this.key, ...sha256(path)])) as any, { 'name': 'AES-CBC' }, false, ['decrypt']);
      const data = await crypto.subtle.decrypt({ name: 'AES-CBC', length: 256, iv: iv }, key, message.slice(16));
      const payload = new Uint8Array(data);
      if (payload.length < 256)
        return null;

      return JSON.parse(ByteUtil.uint8ArrayToUtf8String(payload.slice(128, payload.length - 128)));
    } catch {
      return null;
    }
  }
  static clear(): void {
    this.key = null;
  }
  static wipe(): void {
    this.clear();
    AppStorage.wipe();
  }
  static hasEncryptedKey(): boolean {
    return AppStorage.get(StorageField.Passphrase) != null;
  }
  static hasDecryptedKey(): boolean {
    return this.hasEncryptedKey() && this.key != null && this.key.length == 32;
  }
}