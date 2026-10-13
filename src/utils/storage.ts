/**
 * Storage module: IndexedDB for snapshots and LocalStorage for application settings.
 */

import { AppSettings, SnapshotEntry } from '../types';

const DB_NAME = 'AnkenManagementDB';
const DB_VERSION = 1;
const STORE_SNAPSHOTS = 'task_snapshots';
const SETTINGS_KEY = 'anken_app_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  shotBookId: '1exampleShotSpreadsheetId',
  shotGid: '7242854',
  kyujinBookId: '1exampleKyujinSpreadsheetId',
  kyujinGid: '1828959786',
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
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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
 * If a task transitions to 停止中 for the first time, sets firstSeenStoppedDate = uploadDate.
 */
export async function updateSnapshots(
  tasks: { key: string; status: string }[],
  uploadDateStr: string
): Promise<Map<string, string>> {
  // Returns map of key -> effectiveStopDate
  const effectiveStopDateMap = new Map<string, string>();

  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    const store = transaction.objectStore(STORE_SNAPSHOTS);

    for (const t of tasks) {
      if (!t.key) continue;

      const getReq = store.get(t.key);
      getReq.onsuccess = () => {
        const existing: SnapshotEntry | undefined = getReq.result;
        let firstStopped = existing?.firstSeenStoppedDate || '';

        const isCurrentlyStopped = t.status === '停止中' || t.status.includes('停止');

        if (isCurrentlyStopped) {
          if (!firstStopped) {
            // First time transitioning to 停止中
            firstStopped = uploadDateStr;
          }
          effectiveStopDateMap.set(t.key, firstStopped);
        } else {
          // Task is running or other, reset stopped if needed or retain history
        }

        const entry: SnapshotEntry = {
          key: t.key,
          status: t.status,
          firstSeenStoppedDate: firstStopped,
          uploadDate: uploadDateStr,
        };
        store.put(entry);
      };
    }

    await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
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
