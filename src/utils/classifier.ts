/**
 * Task classification and warning detection pure functions (Japanese).
 */

import { BaseRegistryTask, TaskStatus, TaskType } from '../types';
import { extractDymTaskId, normalizeCompanyName, parseAssignees, parseMinutes } from './normalize';
import { cleanHeaderName } from './security';

const WEEKDAYS_REGEX = /[月火水木金土日]/;

export interface ClassificationResult {
  taskType: TaskType;
  isInferredFrequency: boolean;
  warningNotice?: string;
}

/**
 * Classifies a task and checks for inconsistencies in Japanese.
 */
export function classifyTaskRule(
  sourceTab: 'ショット' | '求人依頼表',
  frequencyRaw?: string | null,
  dayDetailRaw?: string | null
): ClassificationResult {
  if (sourceTab === 'ショット') {
    return {
      taskType: 'ショット',
      isInferredFrequency: false,
    };
  }

  const freq = (frequencyRaw || '').trim();
  const dayDetail = (dayDetailRaw || '').trim();

  let taskType: TaskType = '要確認';
  let isInferredFrequency = false;
  let warnings: string[] = [];

  if (freq === '毎日' || freq === '週次' || freq === '月次') {
    taskType = '定期';
  } else if (freq === '不定期') {
    taskType = '不定期';
  } else if (!freq) {
    // 頻度空欄
    if (dayDetail === '不定期') {
      taskType = '不定期';
      isInferredFrequency = true;
    } else if (WEEKDAYS_REGEX.test(dayDetail)) {
      taskType = '定期';
      isInferredFrequency = true;
    } else {
      taskType = '要確認';
      warnings.push('頻度・曜日詳細ともに未設定');
    }
  } else {
    // Other frequency text
    if (freq.includes('日') || freq.includes('週') || freq.includes('月') || freq.includes('定期')) {
      taskType = '定期';
    } else {
      taskType = '要確認';
      warnings.push(`頻度未定義（${freq}）`);
    }
  }

  // 警告判定（頻度の分類を維持しつつ注意文言を付与）
  // 1. 不定期だが曜日詳細に特定曜日あり
  if (freq === '不定期' && /[月火水木金土]/.test(dayDetail)) {
    warnings.push(`不定期だが曜日詳細に特定曜日あり（${dayDetail}）`);
  }

  // 2. 週次/毎日/月次だが曜日詳細が不定期
  if ((freq === '週次' || freq === '毎日' || freq === '月次') && dayDetail === '不定期') {
    warnings.push(`${freq}だが曜日詳細が不定期指定`);
  }

  // 3. 月次だが曜日詳細に特定曜日指定あり（※日付指定「1日」「15日」「末日」は除外、曜日指定のみ警告）
  if (freq === '月次' && (dayDetail.includes('曜') || /[月火水木金土]/.test(dayDetail)) && !/^\d+日$/.test(dayDetail)) {
    warnings.push(`月次だが曜日詳細に曜日指定あり（${dayDetail}）`);
  }

  let warningCategory: 'MISMATCH' | 'EMPTY_FREQ' | 'UNKNOWN_FREQ' | undefined;
  let warningCategoryJa: string | undefined;

  if (taskType === '要確認') {
    if (!freq) {
      warningCategory = 'EMPTY_FREQ';
      warningCategoryJa = '頻度空欄';
    } else {
      warningCategory = 'UNKNOWN_FREQ';
      warningCategoryJa = '判定不可';
    }
  } else if (warnings.length > 0) {
    warningCategory = 'MISMATCH';
    warningCategoryJa = '頻度と曜日詳細の不一致';
  }

  return {
    taskType,
    isInferredFrequency,
    warningNotice: warnings.length > 0 ? warnings.join('；') : undefined,
    warningCategory,
    warningCategoryJa,
  };
}

/**
 * Maps status strings to TaskStatus enum
 */
export function normalizeStatus(raw: string | undefined | null): { status: TaskStatus; raw: string } {
  if (!raw) return { status: 'その他', raw: '' };
  const trimmed = raw.trim();

  if (trimmed.includes('稼働中')) return { status: '稼働中', raw: trimmed };
  if (trimmed.includes('停止中') || trimmed.includes('終了')) return { status: '停止中', raw: trimmed };
  if (trimmed.includes('完了') || trimmed.includes('Done')) return { status: '完了', raw: trimmed };
  if (trimmed.includes('対応中') || trimmed.includes('進行中')) return { status: '対応中', raw: trimmed };
  if (trimmed.includes('休止中')) return { status: '休止中', raw: trimmed };
  if (trimmed.includes('Wcheck') || trimmed.includes('Wチェック')) return { status: 'Wcheck中', raw: trimmed };
  if (trimmed.includes('保留')) return { status: '保留中', raw: trimmed };
  if (trimmed.includes('確認中')) return { status: '確認中', raw: trimmed };

  return { status: 'その他', raw: trimmed };
}

/**
 * Finds index of a header in array by cleaned name
 */
export function findHeaderIndex(headers: string[], matchPattern: string, useFirstMatch: boolean = true): number {
  const cleanedTarget = cleanHeaderName(matchPattern);
  let bestIndex = -1;

  for (let i = 0; i < headers.length; i++) {
    const cleanedH = cleanHeaderName(headers[i]);
    if (cleanedH === cleanedTarget || cleanedH.startsWith(cleanedTarget)) {
      if (useFirstMatch) {
        return i;
      }
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Helper to parse a single row of File A (ショット)
 */
export function parseFileAShotRow(
  rowValues: string[],
  colIndices: {
    statusIdx: number;
    recordDateIdx: number;
    ownerIdx: number;
    taskNameIdx: number;
    estIdx: number;
    assigneeIdx: number;
    companyIdx: number;
    actualIdx: number;
    dymIdIdx: number;
    stopDateIdx?: number;
    startDateIdx?: number;
    completedDateIdx?: number;
  },
  originalRowNumber: number,
  mergeRules: Record<string, string>
): BaseRegistryTask | null {
  const getVal = (idx?: number) => (idx !== undefined && idx >= 0 && idx < rowValues.length ? rowValues[idx]?.trim() : '');

  const companyVal = getVal(colIndices.companyIdx);
  const taskNameVal = getVal(colIndices.taskNameIdx);

  // 企業名または会社名が空でない行が有効タスク
  if (!companyVal && !taskNameVal) {
    return null;
  }

  const effectiveRawCompany = companyVal || taskNameVal;
  const { canonical, cleaned } = normalizeCompanyName(effectiveRawCompany, mergeRules);
  const dymTaskId = extractDymTaskId(getVal(colIndices.dymIdIdx));
  const rawStatus = getVal(colIndices.statusIdx);
  const { status } = normalizeStatus(rawStatus);

  const stopDate = colIndices.stopDateIdx !== undefined && colIndices.stopDateIdx >= 0
    ? getVal(colIndices.stopDateIdx) || null
    : null;

  const rawAssignee = getVal(colIndices.assigneeIdx);
  const assigneesList = parseAssignees(rawAssignee);

  const shotStartDate = colIndices.startDateIdx !== undefined && colIndices.startDateIdx >= 0
    ? getVal(colIndices.startDateIdx) || null
    : null;
  const shotCompletedDate = colIndices.completedDateIdx !== undefined && colIndices.completedDateIdx >= 0
    ? getVal(colIndices.completedDateIdx) || null
    : null;

  return {
    id: `shot-${originalRowNumber}-${dymTaskId || Math.random().toString(36).slice(2, 7)}`,
    originalRowNumber,
    sourceTab: 'ショット',
    dymTaskId,
    companyName: canonical,
    rawCompanyName: cleaned,
    taskName: taskNameVal || companyVal,
    applicantOrOwner: getVal(colIndices.ownerIdx),
    assignee: rawAssignee,
    assigneesList,
    estimatedMinutes: parseMinutes(getVal(colIndices.estIdx)),
    actualMinutes: parseMinutes(getVal(colIndices.actualIdx)),
    recordDate: getVal(colIndices.recordDateIdx),
    status,
    rawStatus,
    taskType: 'ショット',
    stopDate,
    stopDateSource: stopDate ? 'file' : undefined,
    shotStartDate,
    shotCompletedDate,
  };
}

/**
 * Helper to parse a single row of File B (求人依頼表)
 */
export function parseFileBKyujinRow(
  rowValues: string[],
  colIndices: {
    statusIdx: number;
    requestTypeIdx: number;
    recordDateIdx: number;
    ownerIdx: number;
    taskNameIdx: number;
    freqIdx: number;
    dayDetailIdx: number;
    estIdx: number;
    assigneeIdx: number;
    companyIdx: number;
    dymIdIdx: number;
    stopDateIdx?: number;
  },
  originalRowNumber: number,
  mergeRules: Record<string, string>
): BaseRegistryTask | null {
  const getVal = (idx?: number) => (idx !== undefined && idx >= 0 && idx < rowValues.length ? rowValues[idx]?.trim() : '');

  const companyVal = getVal(colIndices.companyIdx);
  const taskNameVal = getVal(colIndices.taskNameIdx);

  // タスク名または会社名が空でない行が有効タスク
  if (!companyVal && !taskNameVal) {
    return null;
  }

  const effectiveRawCompany = companyVal || taskNameVal;
  const { canonical, cleaned } = normalizeCompanyName(effectiveRawCompany, mergeRules);
  const dymTaskId = extractDymTaskId(getVal(colIndices.dymIdIdx));
  const rawStatus = getVal(colIndices.statusIdx);
  const { status } = normalizeStatus(rawStatus);

  const freq = getVal(colIndices.freqIdx);
  const dayDetail = getVal(colIndices.dayDetailIdx);

  const classification = classifyTaskRule('求人依頼表', freq, dayDetail);

  const stopDate = colIndices.stopDateIdx !== undefined && colIndices.stopDateIdx >= 0
    ? getVal(colIndices.stopDateIdx) || null
    : null;

  const rawAssignee = getVal(colIndices.assigneeIdx);
  const assigneesList = parseAssignees(rawAssignee);

  return {
    id: `kyujin-${originalRowNumber}-${dymTaskId || Math.random().toString(36).slice(2, 7)}`,
    originalRowNumber,
    sourceTab: '求人依頼表',
    dymTaskId,
    companyName: canonical,
    rawCompanyName: cleaned,
    taskName: taskNameVal || companyVal,
    applicantOrOwner: getVal(colIndices.ownerIdx),
    assignee: rawAssignee,
    assigneesList,
    estimatedMinutes: parseMinutes(getVal(colIndices.estIdx)),
    recordDate: getVal(colIndices.recordDateIdx),
    status,
    rawStatus,
    taskType: classification.taskType,
    frequency: freq,
    dayDetail: dayDetail,
    stopDate,
    stopDateSource: stopDate ? 'file' : undefined,
    warningNotice: classification.warningNotice,
    warningCategory: classification.warningCategory,
    warningCategoryJa: classification.warningCategoryJa,
    isInferredFrequency: classification.isInferredFrequency,
  };
}
