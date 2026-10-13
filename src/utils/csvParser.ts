/**
 * CSV parsing engine using PapaParse (Japanese).
 * Strips "アイパス（ID + PW）" credentials immediately.
 */

import Papa from 'papaparse';
import { BaseRegistryTask, DymtaskSubtask } from '../types';
import {
  findHeaderIndex,
  parseFileAShotRow,
  parseFileBKyujinRow,
} from './classifier';
import { extractDymTaskId, parseMinutes } from './normalize';
import { cleanHeaderName, sanitizeRawRow } from './security';

export interface ParseResult<T> {
  data: T[];
  totalRawRows: number;
  validRows: number;
  skippedRows: number;
  securityStrippedColumnsCount: number;
  headers: string[];
}

function isForbiddenHeader(h: string): boolean {
  const cleaned = cleanHeaderName(h);
  return /(?:アイパス|id\s*\+\s*pw|password|パスワード|secret|token)/i.test(cleaned);
}

/**
 * Parses File A (ショット: 単発タスク)
 * 行1-2: 説明・注意事項
 * 行3: ヘッダー
 * 行4以降: データ行
 */
export async function parseShotCsv(
  fileOrText: File | string,
  mergeRules: Record<string, string>,
  stopDateColConfig: string = '停止日'
): Promise<ParseResult<BaseRegistryTask>> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(fileOrText as any, {
      skipEmptyLines: false,
      complete: (results) => {
        try {
          const rawRows = results.data;
          if (!rawRows || rawRows.length < 3) {
            resolve({
              data: [],
              totalRawRows: rawRows.length,
              validRows: 0,
              skippedRows: 0,
              securityStrippedColumnsCount: 0,
              headers: [],
            });
            return;
          }

          const headerRowIdx = 2;
          const headers = (rawRows[headerRowIdx] || []).map((h) => String(h || ''));

          let strippedCount = 0;
          for (let i = 0; i < headers.length; i++) {
            if (isForbiddenHeader(headers[i])) {
              strippedCount++;
              headers[i] = '__STRIPPED_SECURITY_CREDENTIAL__';
            }
          }

          const statusIdx = findHeaderIndex(headers, 'ステータス');
          const statusSubIdx = statusIdx >= 0 ? statusIdx : findHeaderIndex(headers, '対応状況');
          const recordDateIdx = findHeaderIndex(headers, '記載日');
          const ownerIdx = findHeaderIndex(headers, '運用担当') >= 0
            ? findHeaderIndex(headers, '運用担当')
            : findHeaderIndex(headers, '依頼者');
          const taskNameIdx = findHeaderIndex(headers, '企業名（タスク名）') >= 0
            ? findHeaderIndex(headers, '企業名（タスク名）')
            : findHeaderIndex(headers, '企業名');
          const estIdx = findHeaderIndex(headers, '想定工数');
          const assigneeIdx = findHeaderIndex(headers, '担当者');
          const companyIdx = findHeaderIndex(headers, '会社名');
          const actualIdx = findHeaderIndex(headers, '実際時間');
          const dymIdIdx = findHeaderIndex(headers, 'DYMTASK');
          const stopDateIdx = stopDateColConfig ? findHeaderIndex(headers, stopDateColConfig) : -1;

          const colIndices = {
            statusIdx: statusSubIdx,
            recordDateIdx,
            ownerIdx,
            taskNameIdx,
            estIdx,
            assigneeIdx,
            companyIdx,
            actualIdx,
            dymIdIdx,
            stopDateIdx,
          };

          const tasks: BaseRegistryTask[] = [];
          let skipped = 0;

          for (let r = 3; r < rawRows.length; r++) {
            const originalRowNumber = r + 1;
            const rowValues = rawRows[r];
            if (!rowValues || rowValues.length === 0) {
              skipped++;
              continue;
            }

            for (let c = 0; c < rowValues.length; c++) {
              if (headers[c] === '__STRIPPED_SECURITY_CREDENTIAL__') {
                rowValues[c] = '';
              }
            }

            const parsedTask = parseFileAShotRow(rowValues, colIndices, originalRowNumber, mergeRules);
            if (parsedTask) {
              tasks.push(parsedTask);
            } else {
              skipped++;
            }
          }

          resolve({
            data: tasks,
            totalRawRows: rawRows.length,
            validRows: tasks.length,
            skippedRows: skipped,
            securityStrippedColumnsCount: strippedCount,
            headers: headers.filter((h) => h !== '__STRIPPED_SECURITY_CREDENTIAL__'),
          });
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => reject(error),
    });
  });
}

/**
 * Parses File B (求人依頼表: 定期・不定期タスク)
 * 行1-2: 説明
 * 行3: ヘッダー
 * 行4以降: データ行
 */
export async function parseKyujinCsv(
  fileOrText: File | string,
  mergeRules: Record<string, string>,
  stopDateColConfig: string = '停止日'
): Promise<ParseResult<BaseRegistryTask>> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(fileOrText as any, {
      skipEmptyLines: false,
      complete: (results) => {
        try {
          const rawRows = results.data;
          if (!rawRows || rawRows.length < 3) {
            resolve({
              data: [],
              totalRawRows: rawRows.length,
              validRows: 0,
              skippedRows: 0,
              securityStrippedColumnsCount: 0,
              headers: [],
            });
            return;
          }

          const headerRowIdx = 2;
          const headers = (rawRows[headerRowIdx] || []).map((h) => String(h || ''));

          let strippedCount = 0;
          for (let i = 0; i < headers.length; i++) {
            if (isForbiddenHeader(headers[i])) {
              strippedCount++;
              headers[i] = '__STRIPPED_SECURITY_CREDENTIAL__';
            }
          }

          const statusIdx = findHeaderIndex(headers, 'ステータス', true);
          const requestTypeIdx = findHeaderIndex(headers, '依頼種類', true);
          const recordDateIdx = findHeaderIndex(headers, '記載日', true);
          const ownerIdx = findHeaderIndex(headers, '運用担当', true) >= 0
            ? findHeaderIndex(headers, '運用担当', true)
            : findHeaderIndex(headers, '依頼者', true);
          const taskNameIdx = findHeaderIndex(headers, 'タスク名', true);
          const freqIdx = findHeaderIndex(headers, '頻度', true);
          const dayDetailIdx = findHeaderIndex(headers, '曜日詳細', true);
          const estIdx = findHeaderIndex(headers, '想定工数', true);
          const assigneeIdx = findHeaderIndex(headers, '対応者', true) >= 0
            ? findHeaderIndex(headers, '対応者', true)
            : findHeaderIndex(headers, '担当者', true);
          const companyIdx = findHeaderIndex(headers, '会社名', true);
          const dymIdIdx = findHeaderIndex(headers, 'DYMTASK', true);
          const stopDateIdx = stopDateColConfig ? findHeaderIndex(headers, stopDateColConfig, true) : -1;

          const colIndices = {
            statusIdx,
            requestTypeIdx,
            recordDateIdx,
            ownerIdx,
            taskNameIdx,
            freqIdx,
            dayDetailIdx,
            estIdx,
            assigneeIdx,
            companyIdx,
            dymIdIdx,
            stopDateIdx,
          };

          const tasks: BaseRegistryTask[] = [];
          let skipped = 0;

          for (let r = 3; r < rawRows.length; r++) {
            const originalRowNumber = r + 1;
            const rowValues = rawRows[r];
            if (!rowValues || rowValues.length === 0) {
              skipped++;
              continue;
            }

            for (let c = 0; c < rowValues.length; c++) {
              if (headers[c] === '__STRIPPED_SECURITY_CREDENTIAL__') {
                rowValues[c] = '';
              }
            }

            const parsedTask = parseFileBKyujinRow(rowValues, colIndices, originalRowNumber, mergeRules);
            if (parsedTask) {
              tasks.push(parsedTask);
            } else {
              skipped++;
            }
          }

          resolve({
            data: tasks,
            totalRawRows: rawRows.length,
            validRows: tasks.length,
            skippedRows: skipped,
            securityStrippedColumnsCount: strippedCount,
            headers: headers.filter((h) => h !== '__STRIPPED_SECURITY_CREDENTIAL__'),
          });
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => reject(error),
    });
  });
}

/**
 * Parses dym_todo_list CSV
 */
export async function parseDymtaskListCsv(
  fileOrText: File | string
): Promise<ParseResult<DymtaskSubtask>> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(fileOrText as any, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => cleanHeaderName(h).toUpperCase(),
      complete: (results) => {
        try {
          const rawRows = results.data;
          const subtasks: DymtaskSubtask[] = [];
          let skipped = 0;

          for (let i = 0; i < rawRows.length; i++) {
            const rowNumber = i + 2;
            const r = sanitizeRawRow(rawRows[i]);

            const rawId = r['ID'] || r['TASKID'] || r['DYMTASKID'] || '';
            const strippedId = String(rawId).replace(/^[\t\s]+/, '').trim();

            const taskName = r['TASKNAME'] || r['TASK_NAME'] || '';
            const project = r['PROJECT'] || '';
            const tag = r['TAG'] || '';
            const team = r['TEAM'] || '';
            const type = r['TYPE'] || '';
            const typeDetail = r['TYPEDETAIL'] || r['TYPE_DETAIL'] || '';
            const deadlineDay = r['DEADLINEDAY'] || r['DEADLINE_DAY'] || '';
            const deadlineTime = r['DEADLINETIME'] || r['DEADLINE_TIME'] || '';
            const estMinutes = parseMinutes(r['ESTTIME'] || r['EST_TIME']) || 0;
            const status = r['STATUS'] || '';
            const note = r['NOTE'] || '';
            const createdBy = r['CREATEDBY'] || r['CREATED_BY'] || '';
            const createdTime = r['CREATEDTIME'] || r['CREATED_TIME'] || '';
            const subtaskContent = r['SUBTASKCONTENT'] || r['SUBTASK_CONTENT'] || r['CONTENT'] || '';
            const assignee = r['ASSIGNEE'] || '';
            const actualMinutes = parseMinutes(r['ACTUALTIME'] || r['ACTUAL_TIME']) || 0;
            const substatus = r['SUBSTATUS'] || r['SUB_STATUS'] || '';
            const lastUpdatedUser = r['LASTUPDATEDUSER'] || r['LASTUPDATED_USER'] || '';
            const lastUpdatedTime = r['LASTUPDATEDTIME'] || r['LASTUPDATED_TIME'] || '';

            if (!strippedId && !taskName && !subtaskContent) {
              skipped++;
              continue;
            }

            subtasks.push({
              rowNumber,
              id: strippedId,
              taskName,
              project,
              tag,
              team,
              type,
              typeDetail,
              deadlineDay,
              deadlineTime,
              estMinutes,
              status,
              note,
              createdBy,
              createdTime,
              subtaskContent,
              assignee,
              actualMinutes,
              substatus,
              lastUpdatedUser,
              lastUpdatedTime,
            });
          }

          resolve({
            data: subtasks,
            totalRawRows: rawRows.length,
            validRows: subtasks.length,
            skippedRows: skipped,
            securityStrippedColumnsCount: 0,
            headers: results.meta.fields || [],
          });
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => reject(error),
    });
  });
}

// Backward compatibility alias
export const parseDummyTodoListCsv = parseDymtaskListCsv;
