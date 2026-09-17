import type { ExpeditionRecord } from '../simulation/types';
import { validateExpeditionRecord } from './contract';
import { sameRecordData } from './history';

// IndexedDB accommodates full observation/action histories without localStorage's
// small synchronous quota. Each transaction commits one complete record atomically.
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('roverlab-expeditions', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browser storage is unavailable. You can still export completed expeditions as JSON.'));
  });
}

export async function loadExpeditionRecords(): Promise<ExpeditionRecord[]> {
  const database = await openDatabase();
  try {
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const transaction = database.transaction('records', 'readonly');
      const request = transaction.objectStore('records').getAll();
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(new Error('Saved expeditions could not be read. Please try reloading.'));
    });
    return values.map(validateExpeditionRecord);
  } finally { database.close(); }
}

export async function saveExpeditionRecord(value: ExpeditionRecord): Promise<void> {
  const record = validateExpeditionRecord(value);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      const existing = store.get(record.id);
      let conflict = false;
      existing.onsuccess = () => {
        if (existing.result === undefined) store.add(record);
        else if (!sameRecordData(existing.result, record)) {
          conflict = true;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error(conflict
        ? 'An expedition with this identity already exists with different data. The saved record was kept.'
        : 'The expedition could not be saved in this browser. Storage may be full or disabled. Export its JSON to keep a copy.'));
    });
  } finally { database.close(); }
}
