/**
 * Storage module: IndexedDB for snapshots and LocalStorage for application settings.
 */

import { AppSettings, SnapshotEntry } from '../types';

const DB_NAME = 'AnkenManagementDB';
const DB_VERSION = 1;
const STORE_SNAPSHOTS = 'task_snapshots';
const SETTINGS_KEY = 'anken_app_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  shotBookId: '',
  shotGid: '',
  kyujinBookId: '',
  kyujinGid: '',
  stopDateColumnName: '停止日',
  burstWindowMinutes: 5,
  burstCountThreshold: 10,
  dailyActualLimitMinutes: 480,
  estMinForRatioCheck: 30,
  actualLowRatioPercent: 25,
  actualHighRatioPercent: 200,
  actualHighMinDiff: 15,
  companyMerges: {
    '（株）テスト': 'テスト株式会社',
    '株式会社テスト': 'テスト株式会社',
  },
  holidays: ['2026-01-01', '2026-04-30', '2026-05-01', '2026-09-02'],
  autoSyncIntervalMinutes: 15,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Clean up legacy placeholder IDs if present
      if (parsed.shotBookId && (parsed.shotBookId.includes('example') || parsed.shotBookId.includes('1BxiMVs'))) {
        parsed.shotBookId = '';
      }
      if (parsed.kyujinBookId && (parsed.kyujinBookId.includes('example') || parsed.kyujinBookId.includes('1BxiMVs'))) {
        parsed.kyujinBookId = '';
      }
      if (parsed.shotGid === '7242854' && !parsed.shotBookId) {
        parsed.shotGid = '';
      }
      if (parsed.kyujinGid === '1828959786' && !parsed.kyujinBookId) {
        parsed.kyujinGid = '';
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load settings from localStorage, using defaults', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings to localStorage', e);
  }
}

/**
 * Initializes IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets snapshot entry by key (dymTaskId or composite key)
 */
export async function getSnapshot(key: string): Promise<SnapshotEntry | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB get error:', err);
    return null;
  }
}

/**
 * Retrieves all snapshots
 */
export async function getAllSnapshots(): Promise<SnapshotEntry[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('IndexedDB getAll error:', err);
    return [];
  }
}

/**
 * Updates snapshots upon new file upload.
 * Optimized with batch in-memory reading and writing to prevent UI freezing on 11,000+ items.
 */
export async function updateSnapshots(
  tasks: { key: string; status: string }[],
  uploadDateStr: string
): Promise<Map<string, string>> {
  const effectiveStopDateMap = new Map<string, string>();
  if (!tasks || tasks.length === 0) return effectiveStopDateMap;

  try {
    const db = await openDB();

    // 1. Read existing snapshots in a single getAll request
    const existingSnapshots: SnapshotEntry[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    const existingMap = new Map<string, SnapshotEntry>();
    for (let i = 0; i < existingSnapshots.length; i++) {
      existingMap.set(existingSnapshots[i].key, existingSnapshots[i]);
    }

    // 2. Compute updates in memory
    const toPut: SnapshotEntry[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t.key) continue;

      const existing = existingMap.get(t.key);
      let firstStopped = existing?.firstSeenStoppedDate || '';
      const isCurrentlyStopped = t.status === '停止中' || t.status.includes('停止');

      if (isCurrentlyStopped) {
        if (!firstStopped) {
          firstStopped = uploadDateStr;
        }
        effectiveStopDateMap.set(t.key, firstStopped);
      }

      toPut.push({
        key: t.key,
        status: t.status,
        firstSeenStoppedDate: firstStopped,
        uploadDate: uploadDateStr,
      });
    }

    // 3. Batch put in a single readwrite transaction
    const writeTx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    const writeStore = writeTx.objectStore(STORE_SNAPSHOTS);
    for (let i = 0; i < toPut.length; i++) {
      writeStore.put(toPut[i]);
    }

    await new Promise((resolve, reject) => {
      writeTx.oncomplete = () => resolve(true);
      writeTx.onerror = () => reject(writeTx.error);
    });
  } catch (err) {
    console.error('IndexedDB update error:', err);
  }

  return effectiveStopDateMap;
}

/**
 * Clears snapshot database
 */
export async function clearSnapshots(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STORE_SNAPSHOTS, 'readwrite');
  const store = transaction.objectStore(STORE_SNAPSHOTS);
  store.clear();
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
