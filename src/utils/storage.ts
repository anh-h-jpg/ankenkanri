/**
 * Storage module: IndexedDB for snapshots and LocalStorage for application settings.
 */

import { AppSettings, BaseRegistryTask, DymtaskSubtask, Member, SnapshotEntry } from '../types';

const DB_NAME = 'AnkenManagementDB';
const DB_VERSION = 2;
const STORE_SNAPSHOTS = 'task_snapshots';
const STORE_MEMBERS = 'members';
const STORE_DYMTASK_HISTORY = 'dymtask_history';
const STORE_REGISTRY_SNAPSHOTS = 'registry_snapshots';
const STORE_KPI_TARGETS = 'kpi_targets';
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
  assigneeMappings: {},
  holidays: ['2026-01-01', '2026-04-30', '2026-05-01', '2026-09-02'],
  fiscalYearStartMonth: 4,
  weeklyCapacityMinutes: 2400,
  kpiSendRateTarget: 95,
  kpiEstAccuracyTarget: 80,
  kpiErrorRateThreshold: 2.0,
  kpiIdAssignRateTarget: 90,
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
 * Initializes IndexedDB with all required tables
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_MEMBERS)) {
        db.createObjectStore(STORE_MEMBERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DYMTASK_HISTORY)) {
        db.createObjectStore(STORE_DYMTASK_HISTORY, { keyPath: 'compositeKey' });
      }
      if (!db.objectStoreNames.contains(STORE_REGISTRY_SNAPSHOTS)) {
        db.createObjectStore(STORE_REGISTRY_SNAPSHOTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KPI_TARGETS)) {
        db.createObjectStore(STORE_KPI_TARGETS, { keyPath: 'key' });
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

/**
 * 1. Members Storage Operations
 */
export async function getAllMembers(): Promise<Member[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEMBERS, 'readonly');
      const store = tx.objectStore(STORE_MEMBERS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to get members:', e);
    return [];
  }
}

export async function saveMembers(members: Member[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MEMBERS, 'readwrite');
    const store = tx.objectStore(STORE_MEMBERS);
    for (const m of members) {
      store.put(m);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to save members:', e);
  }
}

export async function saveMember(member: Member): Promise<void> {
  return saveMembers([member]);
}

export async function deleteMember(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MEMBERS, 'readwrite');
    const store = tx.objectStore(STORE_MEMBERS);
    store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to delete member:', e);
  }
}

/**
 * 2. Dymtask History Operations (Deduplication by composite key)
 */
export function buildDymtaskCompositeKey(sub: DymtaskSubtask): string {
  const id = (sub.id || '').trim();
  const deadline = (sub.deadlineDay || '').trim();
  const assignee = (sub.assignee || '').trim().toUpperCase();
  const content = (sub.subtaskContent || '').trim();
  const updated = (sub.lastUpdatedTime || '').trim();
  return `${id}__${deadline}__${assignee}__${content}__${updated}`;
}

export async function saveDymtaskSubtasksHistory(
  subtasks: DymtaskSubtask[]
): Promise<{ added: number; total: number }> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DYMTASK_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_DYMTASK_HISTORY);

    let addedCount = 0;
    for (const sub of subtasks) {
      const compositeKey = buildDymtaskCompositeKey(sub);
      store.put({ ...sub, compositeKey });
      addedCount++;
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });

    // Count total
    const totalCount = await new Promise<number>((resolve, reject) => {
      const readTx = db.transaction(STORE_DYMTASK_HISTORY, 'readonly');
      const readStore = readTx.objectStore(STORE_DYMTASK_HISTORY);
      const req = readStore.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return { added: addedCount, total: totalCount };
  } catch (e) {
    console.error('Failed to save dymtask history:', e);
    return { added: 0, total: 0 };
  }
}

export async function getAllDymtaskHistory(): Promise<DymtaskSubtask[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DYMTASK_HISTORY, 'readonly');
      const store = tx.objectStore(STORE_DYMTASK_HISTORY);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to get all dymtask history:', e);
    return [];
  }
}

/**
 * 3. Daily Registry Snapshots (For tracking stopped dates and quarterly new tasks)
 */
export interface RegistryDailySnapshot {
  id: string; // YYYY-MM-DD
  date: string;
  shotTasksCount: number;
  kyujinTasksCount: number;
  taskSummaries: {
    key: string;
    dymTaskId: string | null;
    status: string;
    recordDate: string;
    companyName: string;
    taskName: string;
    assignee: string;
    sourceTab: 'ショット' | '求人依頼表';
    taskType: string;
  }[];
}

export async function saveRegistryDailySnapshot(
  date: string,
  shotTasks: BaseRegistryTask[],
  kyujinTasks: BaseRegistryTask[]
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_REGISTRY_SNAPSHOTS, 'readwrite');
    const store = tx.objectStore(STORE_REGISTRY_SNAPSHOTS);

    const snapshot: RegistryDailySnapshot = {
      id: date,
      date,
      shotTasksCount: shotTasks.length,
      kyujinTasksCount: kyujinTasks.length,
      taskSummaries: [...kyujinTasks, ...shotTasks].map((t) => ({
        key: t.dymTaskId || t.id,
        dymTaskId: t.dymTaskId,
        status: t.status,
        recordDate: t.recordDate,
        companyName: t.companyName,
        taskName: t.taskName,
        assignee: t.assignee,
        sourceTab: t.sourceTab,
        taskType: t.taskType,
      })),
    };

    store.put(snapshot);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to save registry snapshot:', e);
  }
}

export async function getAllRegistrySnapshots(): Promise<RegistryDailySnapshot[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_REGISTRY_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_REGISTRY_SNAPSHOTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Failed to get registry snapshots:', e);
    return [];
  }
}

/**
 * 4. KPI Targets Storage
 */
export async function getKpiTargets(key: string): Promise<Record<string, number>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_KPI_TARGETS, 'readonly');
      const store = tx.objectStore(STORE_KPI_TARGETS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.targets || {});
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return {};
  }
}

export async function saveKpiTargets(key: string, targets: Record<string, number>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_KPI_TARGETS, 'readwrite');
    const store = tx.objectStore(STORE_KPI_TARGETS);
    store.put({ key, targets });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to save kpi targets:', e);
  }
}

/**
 * Clears ALL stored data across all IndexedDB stores
 */
export async function clearAllStoredData(): Promise<void> {
  try {
    const db = await openDB();
    const storeNames = [
      STORE_SNAPSHOTS,
      STORE_MEMBERS,
      STORE_DYMTASK_HISTORY,
      STORE_REGISTRY_SNAPSHOTS,
      STORE_KPI_TARGETS,
    ];
    for (const name of storeNames) {
      if (db.objectStoreNames.contains(name)) {
        const tx = db.transaction(name, 'readwrite');
        tx.objectStore(name).clear();
      }
    }
  } catch (e) {
    console.error('Failed to clear all IndexedDB stores:', e);
  }
}
