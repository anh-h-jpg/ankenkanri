/**
 * High-performance In-Memory Registry Store & Indexer.
 * Keeps raw 12,500+ records outside of high-frequency React component state,
 * builds indexed Maps ONCE upon import, and avoids expensive re-computations.
 */

import { AnkenSummary, BaseRegistryTask } from '../types';

class RegistryStore {
  private shotTasks: BaseRegistryTask[] = [];
  private kyujinTasks: BaseRegistryTask[] = [];

  // Pre-indexed data structures
  public registryMap: Map<string, BaseRegistryTask> = new Map();
  public activeRecurringTasks: BaseRegistryTask[] = [];
  public recurringByWeekday: Map<string, BaseRegistryTask[]> = new Map();
  public recurringByAssigneeWeekday: Map<string, BaseRegistryTask[]> = new Map();
  public attentionTasks: BaseRegistryTask[] = [];
  public ankensSummary: AnkenSummary[] = [];
  public totalWarningCount: number = 0;
  public totalMissingIdCount: number = 0;
  public allTasksCount: number = 0;

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
    let missingIdCount = 0;
    const attentionTasksList: BaseRegistryTask[] = [];

    // Company aggregation map
    const companyMap = new Map<
      string,
      {
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
        latestStopDate: string | null;
      }
    >();

    const getCompanyEntry = (companyKey: string) => {
      let entry = companyMap.get(companyKey);
      if (!entry) {
        entry = {
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
          latestStopDate: null,
        };
        companyMap.set(companyKey, entry);
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

      if (task.warningNotice) {
        warningCount++;
        attentionTasksList.push(task);
      } else if (!dymId && task.status === '稼働中') {
        attentionTasksList.push(task);
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
      const c = getCompanyEntry(compKey);
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
            missingIdCount++;
          }
        } else if (task.status === '停止中') {
          c.teikiStopped++;
        }
      } else if (task.taskType === '不定期') {
        if (task.status === '稼働中') {
          c.futeikiRunning++;
          if (!dymId) {
            c.missingIdCount++;
            missingIdCount++;
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

      const isShotInProgress = task.status === '対応中' || task.status === 'Wcheck中';
      const isShotCompleted = task.status === '完了';

      if (task.warningNotice) {
        warningCount++;
        attentionTasksList.push(task);
      } else if (!dymId && !isShotCompleted) {
        attentionTasksList.push(task);
      }

      const compKey = task.companyName || '未設定';
      const c = getCompanyEntry(compKey);
      c.rawNames.add(task.rawCompanyName || compKey);
      if (task.assignee) c.assignees.add(task.assignee);
      c.tasks.push(task);

      if (isShotCompleted) {
        c.shotCompleted++;
      } else if (isShotInProgress) {
        c.shotInProgress++;
        if (!dymId) {
          c.missingIdCount++;
          missingIdCount++;
        }
      } else {
        c.shotOther++;
        if (!dymId) {
          c.missingIdCount++;
          missingIdCount++;
        }
      }
    }

    // 3. Build Final Anken Summary List
    const summaries: AnkenSummary[] = [];
    for (const [canonicalName, data] of companyMap.entries()) {
      summaries.push({
        canonicalName,
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
    this.totalMissingIdCount = missingIdCount;
    this.allTasksCount = this.shotTasks.length + this.kyujinTasks.length;
    (this as any).attentionTasks = attentionTasksList;

    const duration = Math.round(performance.now() - start);
    console.timeEnd('インデックス構築');
    console.log(`[インデックス構築 完了] 所要時間: ${duration}ms (総タスク: ${this.allTasksCount}件, 案件数: ${summaries.length}社, 定期稼働: ${newActiveRecurring.length}件)`);
  }
}

export const registryStore = new RegistryStore();
