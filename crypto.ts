// Device-bound AES-GCM key management using Web Crypto API for sensitive locally cached fields

const KEY_STORAGE_NAME = 'gmcsl_device_crypto_v1';

async function getOrCreateDeviceKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('gmcsl_keystore', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('keys')) {
          req.result.createObjectStore('keys');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const existing = await new Promise<CryptoKey | undefined>((resolve) => {
      const tx = db.transaction('keys', 'readonly');
      const getReq = tx.objectStore('keys').get(KEY_STORAGE_NAME);
      getReq.onsuccess = () => resolve(getReq.result as CryptoKey | undefined);
      getReq.onerror = () => resolve(undefined);
    });

    if (existing) {
      db.close();
      return existing;
    }

    const generated = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable device-bound key
      ['encrypt', 'decrypt']
    );

    await new Promise<void>((resolve) => {
      const tx = db.transaction('keys', 'readwrite');
      tx.objectStore('keys').put(generated, KEY_STORAGE_NAME);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
    return generated;
  } catch {
    return null;
  }
}

export async function encryptLocalPayload(plainText: string): Promise<string> {
  const key = await getOrCreateDeviceKey();
  if (!key) return plainText;
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  let bin = '';
  combined.forEach((b) => (bin += String.fromCharCode(b)));
  return `ENC:${btoa(bin)}`;
}

export async function decryptLocalPayload(payload: string): Promise<string> {
  if (!payload || !payload.startsWith('ENC:')) return payload;
  const key = await getOrCreateDeviceKey();
  if (!key) return '';
  try {
    const raw = atob(payload.slice(4));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const iv = bytes.slice(0, 12);
    const data = bytes.slice(12);
    const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch {
    return '';
  }
}
