/**
 * Worker Client: Spawns and communicates with auditWorker.
 * Transparent fallback to main-thread execution if Web Worker is restricted.
 */

import { AppSettings, BaseRegistryTask, DymtaskSubtask } from '../types';
import { ParseResult } from './csvParser';
import { auditDymtaskList, AuditReport } from './dymtaskAuditor';

let workerInstance: Worker | null = null;
let messageIdCounter = 0;
const pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL('../workers/auditWorker.ts', import.meta.url), {
        type: 'module',
      });
      workerInstance.onmessage = (e: MessageEvent) => {
        const { id, type, report, result, error } = e.data;
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          if (type.endsWith('_SUCCESS')) {
            pending.resolve(report || result);
          } else {
            pending.reject(new Error(error || 'Worker task failed'));
          }
        }
      };
      workerInstance.onerror = (err) => {
        console.warn('Worker error, fallback will be used:', err);
      };
    } catch (err) {
      console.warn('Unable to initialize Worker, running on main thread:', err);
      workerInstance = null;
    }
  }
  return workerInstance;
}

export async function runAuditInWorker(
  subtasks: DymtaskSubtask[],
  registryMap: Map<string, BaseRegistryTask>,
  settings: AppSettings,
  auditDateStr?: string,
  activeRecurringTasks?: BaseRegistryTask[]
): Promise<AuditReport> {
  const worker = getWorker();
  if (worker) {
    try {
      const id = ++messageIdCounter;
      // Serialize Map to [key, value][]
      const registryMapData = Array.from(registryMap.entries());

      return await new Promise<AuditReport>((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        worker.postMessage({
          id,
          type: 'AUDIT_DYMTASK',
          payload: {
            subtasks,
            registryMapData,
            activeRecurringTasks,
            settings,
            auditDateStr,
          },
        });
      });
    } catch (err) {
      console.warn('Worker execution failed, falling back to main thread:', err);
    }
  }

  // Fallback to direct call
  return auditDymtaskList(subtasks, registryMap, settings, auditDateStr, activeRecurringTasks);
}
