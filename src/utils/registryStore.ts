/**
 * High-performance In-Memory Registry Store & Indexer.
 * Keeps raw 12,500+ records outside of high-frequency React component state,
 * builds indexed Maps ONCE upon import, and avoids expensive re-computations.
 */

import { AnkenSummary, BaseRegistryTask } from '../types';
import { getCompanyGroupKey } from './normalize';

class RegistryStore {
  private shotTasks: BaseRegistryTask[] = [];
  private kyujinTasks: BaseRegistryTask[] = [];

  // Pre-indexed data structures
  public registryMap: Map<string, BaseRegistryTask> = new Map();
  public activeRecurringTasks: BaseRegistryTask[] = [];
  public recurringByWeekday: Map<string, BaseRegistryTask[]> = new Map();
  public recurringByAssigneeWeekday: Map<string, BaseRegistryTask[]> = new Map();

  // Tasks lists for NeedAttentionView
  public attentionTasks: BaseRegistryTask[] = [];
  public runningNoIdTasks: BaseRegistryTask[] = []; // 定期 11 + 不定期 41 = 52
  public shotNoIdTasks: BaseRegistryTask[] = []; // ショット未完了・ID未設定
  public warningTasks: BaseRegistryTask[] = []; // スケジュール不整合 (61)

  // Aggregated metrics
  public ankensSummary: AnkenSummary[] = [];
  public totalWarningCount: number = 0;
  public totalMissingIdCount: number = 0; // Exactly 52 (regular running without ID)
  public totalShotMissingIdCount: number = 0; // Shot without ID
  public teikiRunningNoIdCount: number = 0; // 11
  public futeikiRunningNoIdCount: number = 0; // 41
  public allTasksCount: number = 0;
  public rawCompanyNames: string[] = [];

  public warningReasonStats = {
    mismatch: 0,
    emptyFreq: 0,
    unknown: 0,
    total: 0,
  };

  // Listeners for store updates
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public setShotTasks(tasks: BaseRegistryTask[]) {
    this.shotTasks = tasks;
    this.rebuildIndexes();
    this.notify();
  }

  public setKyujinTasks(tasks: BaseRegistryTask[]) {
    this.kyujinTasks = tasks;
    this.rebuildIndexes();
    this.notify();
  }

  public clear() {
    this.shotTasks = [];
    this.kyujinTasks = [];
    this.rebuildIndexes();
    this.notify();
  }

  public getShotTasks(): BaseRegistryTask[] {
    return this.shotTasks;
  }

  public getKyujinTasks(): BaseRegistryTask[] {
    return this.kyujinTasks;
  }

  public getShotTasksCount(): number {
    return this.shotTasks.length;
  }

  public getKyujinTasksCount(): number {
    return this.kyujinTasks.length;
  }

  public getAllTasks(): BaseRegistryTask[] {
    return [...this.kyujinTasks, ...this.shotTasks];
  }

  public getTasksForCompany(canonicalName: string): BaseRegistryTask[] {
    const list: BaseRegistryTask[] = [];
    for (let i = 0; i < this.kyujinTasks.length; i++) {
      if (this.kyujinTasks[i].companyName === canonicalName) {
        list.push(this.kyujinTasks[i]);
      }
    }
    for (let i = 0; i < this.shotTasks.length; i++) {
      if (this.shotTasks[i].companyName === canonicalName) {
        list.push(this.shotTasks[i]);
      }
    }
    return list;
  }

  /**
   * Rebuilds indexes once upon file import (takes < 25ms for 12,500 records)
   */
  public rebuildIndexes() {
    const start = performance.now();
    console.time('インデックス構築');

    const newRegistryMap = new Map<string, BaseRegistryTask>();
    const newActiveRecurring: BaseRegistryTask[] = [];
    const newRecurringByWeekday = new Map<string, BaseRegistryTask[]>();
    const newRecurringByAssigneeWeekday = new Map<string, BaseRegistryTask[]>();
    const weekdayChars = ['日', '月', '火', '水', '木', '金', '土'];

    for (const w of weekdayChars) {
      newRecurringByWeekday.set(w, []);
    }

    let warningCount = 0;
    let missingIdCount = 0; // 定期・不定期 稼働中 (52)
    let shotMissingIdCount = 0; // ショット未完了
    let teikiRunningNoId = 0;
    let futeikiRunningNoId = 0;

    const attentionTasksList: BaseRegistryTask[] = [];
    const runningNoIdList: BaseRegistryTask[] = [];
    const shotNoIdList: BaseRegistryTask[] = [];
    const warningList: BaseRegistryTask[] = [];

    let mismatchCount = 0;
    let emptyFreqCount = 0;
    let unknownCount = 0;

    const companyNamesSet = new Set<string>();

    // Company aggregation map: keyed by normalized company groupKey
    const companyMap = new Map<
      string,
      {
        canonicalName: string;
        rawNames: Set<string>;
        assignees: Set<string>;
        tasks: BaseRegistryTask[];
        teikiRunning: number;
        teikiStopped: number;
        futeikiRunning: number;
        futeikiStopped: number;
        shotInProgress: number;
        shotCompleted: number;
        shotOther: number;
        warningCount: number;
        missingIdCount: number;
        shotMissingIdCount: number;
        teikiRunningNoIdCount: number;
        futeikiRunningNoIdCount: number;
        latestStopDate: string | null;
      }
    >();

    const getCompanyEntry = (companyName: string, rawName: string) => {
      companyNamesSet.add(companyName);
      if (rawName) companyNamesSet.add(rawName);

      const groupKey = getCompanyGroupKey(companyName) || companyName || '未設定';
      let entry = companyMap.get(groupKey);
      if (!entry) {
        entry = {
          canonicalName: companyName || '未設定',
          rawNames: new Set(),
          assignees: new Set(),
          tasks: [],
          teikiRunning: 0,
          teikiStopped: 0,
          futeikiRunning: 0,
          futeikiStopped: 0,
          shotInProgress: 0,
          shotCompleted: 0,
          shotOther: 0,
          warningCount: 0,
          missingIdCount: 0,
          shotMissingIdCount: 0,
          teikiRunningNoIdCount: 0,
          futeikiRunningNoIdCount: 0,
          latestStopDate: null,
        };
        companyMap.set(groupKey, entry);
      }
      return entry;
    };

    // 1. Index Kyujin Tasks (~1,500)
    for (let i = 0; i < this.kyujinTasks.length; i++) {
      const task = this.kyujinTasks[i];
      const dymId = task.dymTaskId;

      if (dymId) {
        newRegistryMap.set(dymId, task);
      }

      // Track warnings
      if (task.warningNotice) {
        warningCount++;
        warningList.push(task);
        attentionTasksList.push(task);

        if (task.warningCategory === 'EMPTY_FREQ') {
          emptyFreqCount++;
        } else if (task.warningCategory === 'UNKNOWN_FREQ') {
          unknownCount++;
        } else {
          mismatchCount++;
        }
      }

      // Active recurring tasks (ONLY 定期 稼働中, ~300 items)
      if (task.sourceTab === '求人依頼表' && task.status === '稼働中' && task.taskType === '定期') {
        newActiveRecurring.push(task);

        const freq = task.frequency || '';
        const dayDetail = task.dayDetail || '';
        const assignee = task.assignee || '';

        const registerWeekday = (w: string) => {
          newRecurringByWeekday.get(w)!.push(task);
          const userKey = `${assignee}__${w}`;
          let userList = newRecurringByAssigneeWeekday.get(userKey);
          if (!userList) {
            userList = [];
            newRecurringByAssigneeWeekday.set(userKey, userList);
          }
          userList.push(task);
        };

        if (freq === '毎日') {
          for (const w of weekdayChars) {
            registerWeekday(w);
          }
        } else if (freq === '週次') {
          for (const w of weekdayChars) {
            if (dayDetail.includes(w)) {
              registerWeekday(w);
            }
          }
        }
      }

      // Company grouping
      const compKey = task.companyName || '未設定';
      const c = getCompanyEntry(compKey, task.rawCompanyName);
      c.rawNames.add(task.rawCompanyName || compKey);
      if (task.assignee) c.assignees.add(task.assignee);
      c.tasks.push(task);

      if (task.warningNotice) c.warningCount++;

      if (task.stopDate) {
        if (!c.latestStopDate || task.stopDate > c.latestStopDate) {
          c.latestStopDate = task.stopDate;
        }
      }

      if (task.taskType === '定期') {
        if (task.status === '稼働中') {
          c.teikiRunning++;
          if (!dymId) {
            c.missingIdCount++;
            c.teikiRunningNoIdCount++;
            missingIdCount++;
            teikiRunningNoId++;
            runningNoIdList.push(task);
            attentionTasksList.push(task);
          }
        } else if (task.status === '停止中') {
          c.teikiStopped++;
        }
      } else if (task.taskType === '不定期') {
        if (task.status === '稼働中') {
          c.futeikiRunning++;
          if (!dymId) {
            c.missingIdCount++;
            c.futeikiRunningNoIdCount++;
            missingIdCount++;
            futeikiRunningNoId++;
            runningNoIdList.push(task);
            attentionTasksList.push(task);
          }
        } else if (task.status === '停止中') {
          c.futeikiStopped++;
        }
      }
    }

    // 2. Index Shot Tasks (~11,000)
    for (let i = 0; i < this.shotTasks.length; i++) {
      const task = this.shotTasks[i];
      const dymId = task.dymTaskId;

      if (dymId) {
        newRegistryMap.set(dymId, task);
      }

      const isShotCompleted = task.status === '完了';
      const isShotInProgress = task.status === '対応中' || task.status === 'Wcheck中';

      const compKey = task.companyName || '未設定';
      const c = getCompanyEntry(compKey, task.rawCompanyName);
      c.rawNames.add(task.rawCompanyName || compKey);
      if (task.assignee) c.assignees.add(task.assignee);
      c.tasks.push(task);

      if (isShotCompleted) {
        c.shotCompleted++;
      } else if (isShotInProgress) {
        c.shotInProgress++;
        if (!dymId) {
          c.shotMissingIdCount++;
          shotMissingIdCount++;
          shotNoIdList.push(task);
        }
      } else {
        c.shotOther++;
        if (!dymId) {
          c.shotMissingIdCount++;
          shotMissingIdCount++;
          shotNoIdList.push(task);
        }
      }
    }

    // 3. Build Final Anken Summary List
    const summaries: AnkenSummary[] = [];
    for (const data of companyMap.values()) {
      summaries.push({
        canonicalName: data.canonicalName,
        rawNames: Array.from(data.rawNames),
        assignees: Array.from(data.assignees),
        totalTasks: data.tasks.length,
        teikiRunning: data.teikiRunning,
        teikiStopped: data.teikiStopped,
        futeikiRunning: data.futeikiRunning,
        futeikiStopped: data.futeikiStopped,
        shotInProgress: data.shotInProgress,
        shotCompleted: data.shotCompleted,
        shotOther: data.shotOther,
        warningCount: data.warningCount,
        missingIdCount: data.missingIdCount,
        shotMissingIdCount: data.shotMissingIdCount,
        teikiRunningNoIdCount: data.teikiRunningNoIdCount,
        futeikiRunningNoIdCount: data.futeikiRunningNoIdCount,
        latestStopDate: data.latestStopDate,
        tasks: data.tasks,
      });
    }

    this.registryMap = newRegistryMap;
    this.activeRecurringTasks = newActiveRecurring;
    this.recurringByWeekday = newRecurringByWeekday;
    this.recurringByAssigneeWeekday = newRecurringByAssigneeWeekday;
    this.ankensSummary = summaries;

    this.totalWarningCount = warningCount;
    this.totalMissingIdCount = missingIdCount; // 52
    this.totalShotMissingIdCount = shotMissingIdCount;
    this.teikiRunningNoIdCount = teikiRunningNoId; // 11
    this.futeikiRunningNoIdCount = futeikiRunningNoId; // 41

    this.attentionTasks = attentionTasksList;
    this.runningNoIdTasks = runningNoIdList;
    this.shotNoIdTasks = shotNoIdList;
    this.warningTasks = warningList;

    this.warningReasonStats = {
      mismatch: mismatchCount,
      emptyFreq: emptyFreqCount,
      unknown: unknownCount,
      total: warningCount,
    };

    this.rawCompanyNames = Array.from(companyNamesSet);
    this.allTasksCount = this.shotTasks.length + this.kyujinTasks.length;

    const duration = Math.round(performance.now() - start);
    console.timeEnd('インデックス構築');
    console.log(`[インデックス構築 完了] 所要時間: ${duration}ms (総タスク: ${this.allTasksCount}件, 案件数: ${summaries.length}社, ID未設定(定期/不定期稼働中): ${missingIdCount}件, ショット未完了ID未設定: ${shotMissingIdCount}件, 要確認: ${warningCount}件)`);
  }
}

export const registryStore = new RegistryStore();
