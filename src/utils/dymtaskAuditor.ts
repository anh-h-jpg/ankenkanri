/**
 * Dymtask Todo List Audit pure functions (Japanese).
 */

import {
  AppSettings,
  AssigneeSummary,
  AuditException,
  BaseRegistryTask,
  DymtaskSubtask,
} from '../types';
import { extractDymTaskId, parseDateTime } from './normalize';

export interface AuditReport {
  totalRows: number;
  totalTasks: number;
  totalAssignees: number;
  errorCount: number;
  reviewCount: number;
  exceptions: AuditException[];
  assigneeSummaries: AssigneeSummary[];
  timeScatterPoints: {
    assignee: string;
    timeHour: number; // 0.0 - 24.0
    timeLabel: string;
    subtaskName: string;
    taskId: string;
    isBurst: boolean;
    actualTime: number;
  }[];
}

/**
 * Pure audit function: Evaluates Dymtask subtasks against business rules and registry.
 */
export function auditDymtaskList(
  subtasks: DymtaskSubtask[],
  registryMap: Map<string, BaseRegistryTask>, // dymTaskId -> registryTask
  settings: AppSettings,
  auditDateStr?: string // Target evaluation date (e.g. YYYY/MM/DD or YYYY-MM-DD)
): AuditReport {
  const exceptions: AuditException[] = [];

  const assigneeDateActualMinutes = new Map<string, number>();
  const subtaskDeduplicationMap = new Map<string, DymtaskSubtask[]>();
  const assigneeCloseEventsMap = new Map<string, { subtask: DymtaskSubtask; closeTime: Date }[]>();

  const assigneeStats = new Map<
    string,
    {
      taskSet: Set<string>;
      subtaskCount: number;
      totalEst: number;
      totalActual: number;
      firstClose: Date | null;
      lastClose: Date | null;
      errorCount: number;
      reviewCount: number;
    }
  >();

  const getStats = (user: string) => {
    const key = user || '担当者未設定';
    if (!assigneeStats.has(key)) {
      assigneeStats.set(key, {
        taskSet: new Set(),
        subtaskCount: 0,
        totalEst: 0,
        totalActual: 0,
        firstClose: null,
        lastClose: null,
        errorCount: 0,
        reviewCount: 0,
      });
    }
    return assigneeStats.get(key)!;
  };

  // Step 1: Row-by-row checks
  for (const st of subtasks) {
    const stats = getStats(st.assignee);
    if (st.id) stats.taskSet.add(st.id);
    stats.subtaskCount += 1;
    stats.totalEst += st.estMinutes || 0;
    stats.totalActual += st.actualMinutes || 0;

    const closeTime = parseDateTime(st.lastUpdatedTime) || parseDateTime(st.createdTime);
    st.parsedCloseDate = closeTime;
    if (closeTime) {
      if (!stats.firstClose || closeTime < stats.firstClose) stats.firstClose = closeTime;
      if (!stats.lastClose || closeTime > stats.lastClose) stats.lastClose = closeTime;

      if (st.assignee && (st.substatus.toLowerCase() === 'done' || st.substatus.toLowerCase() === 'skipped')) {
        const list = assigneeCloseEventsMap.get(st.assignee) || [];
        list.push({ subtask: st, closeTime });
        assigneeCloseEventsMap.set(st.assignee, list);
      }
    }

    const effectiveDay = st.deadlineDay
      ? st.deadlineDay.replace(/-/g, '/')
      : closeTime
      ? `${closeTime.getFullYear()}/${String(closeTime.getMonth() + 1).padStart(2, '0')}/${String(closeTime.getDate()).padStart(2, '0')}`
      : '未判定';

    if (st.assignee && effectiveDay !== '未判定') {
      const dayKey = `${st.assignee}__${effectiveDay}`;
      const cur = assigneeDateActualMinutes.get(dayKey) || 0;
      assigneeDateActualMinutes.set(dayKey, cur + (st.actualMinutes || 0));
    }

    // 1. エラー: IDの桁数不正 (6桁必須)
    const cleanId = (st.id || '').trim();
    if (!cleanId || cleanId.length !== 6 || !/^\d{6}$/.test(cleanId)) {
      exceptions.push({
        id: `err-id-${st.rowNumber}`,
        level: 'エラー',
        category: 'INVALID_ID',
        categoryNameJa: 'DYMTASK IDの桁数不正 (6桁必須)',
        date: effectiveDay,
        taskId: cleanId || '(未設定)',
        assignee: st.assignee || '担当者未設定',
        subtaskContent: st.subtaskContent,
        detail: `ID「${cleanId}」が6桁の数字ではありません。`,
        rowNumber: st.rowNumber,
      });
      stats.errorCount += 1;
    }

    // 2. エラー: 日付解析不可
    if (!st.deadlineDay && !closeTime) {
      exceptions.push({
        id: `err-date-${st.rowNumber}`,
        level: 'エラー',
        category: 'INVALID_DATE',
        categoryNameJa: '日付・時刻の解析不可',
        date: '—',
        taskId: cleanId,
        assignee: st.assignee || '担当者未設定',
        subtaskContent: st.subtaskContent,
        detail: `DEADLINE DAYおよびLASTUPDATED TIME「${st.lastUpdatedTime}」の日時が認識できません。`,
        rowNumber: st.rowNumber,
      });
      stats.errorCount += 1;
    }

    // 3. エラー: ASSIGNEE未設定
    if (!st.assignee || !st.assignee.trim()) {
      exceptions.push({
        id: `err-assignee-${st.rowNumber}`,
        level: 'エラー',
        category: 'EMPTY_ASSIGNEE',
        categoryNameJa: '担当者（ASSIGNEE）未設定',
        date: effectiveDay,
        taskId: cleanId,
        assignee: '(未設定)',
        subtaskContent: st.subtaskContent,
        detail: 'Dymtaskに担当者名が記載されていません。',
        rowNumber: st.rowNumber,
      });
      stats.errorCount += 1;
    }

    // 4. エラー: タスクDoneだがサブタスク未完了
    const taskStatusLower = (st.status || '').toLowerCase();
    const substatusLower = (st.substatus || '').toLowerCase();
    if (taskStatusLower === 'done' && substatusLower !== 'done' && substatusLower !== 'skipped') {
      exceptions.push({
        id: `err-unclosed-${st.rowNumber}`,
        level: 'エラー',
        category: 'UNCLOSED_SUBTASK',
        categoryNameJa: 'タスクDoneだがサブタスク未完了',
        date: effectiveDay,
        taskId: cleanId,
        assignee: st.assignee,
        subtaskContent: st.subtaskContent,
        detail: `親タスクはDoneですがサブタスクステータスが「${st.substatus || '未設定'}」のままです。`,
        rowNumber: st.rowNumber,
      });
      stats.errorCount += 1;
    }

    // 5. エラー: サブタスクDoneだが実績時間0分
    if (substatusLower === 'done' && (!st.actualMinutes || st.actualMinutes <= 0)) {
      exceptions.push({
        id: `err-zero-actual-${st.rowNumber}`,
        level: 'エラー',
        category: 'ZERO_ACTUAL_WHEN_DONE',
        categoryNameJa: 'サブタスクDoneだが実績時間0分',
        date: effectiveDay,
        taskId: cleanId,
        assignee: st.assignee,
        subtaskContent: st.subtaskContent,
        detail: 'サブタスクはDoneですが、実績時間が0分として記録されています。',
        rowNumber: st.rowNumber,
        evidence: { actualTime: st.actualMinutes || 0 },
      });
      stats.errorCount += 1;
    }

    // REGISTRY CHECKS
    if (registryMap.size > 0 && cleanId && cleanId.length === 6) {
      const regTask = registryMap.get(cleanId);
      // 6. エラー: 管理シートに存在しないDYMTASK ID
      if (!regTask) {
        exceptions.push({
          id: `err-not-reg-${st.rowNumber}`,
          level: 'エラー',
          category: 'NOT_IN_REGISTRY',
          categoryNameJa: '管理シートに存在しないDYMTASK ID',
          date: effectiveDay,
          taskId: cleanId,
          assignee: st.assignee,
          subtaskContent: st.subtaskContent,
          detail: `ID ${cleanId} は求人依頼表またはショットの管理一覧に見つかりません。`,
          rowNumber: st.rowNumber,
        });
        stats.errorCount += 1;
      } else {
        // 7. エラー: 停止中タスクにDymtaskあり
        if (regTask.status === '停止中' || regTask.rawStatus.includes('停止')) {
          exceptions.push({
            id: `err-stopped-${st.rowNumber}`,
            level: 'エラー',
            category: 'STOPPED_TASK_DUMMY',
            categoryNameJa: '停止中タスクにDymtaskあり',
            date: effectiveDay,
            taskId: cleanId,
            assignee: st.assignee,
            subtaskContent: st.subtaskContent,
            detail: `タスク ${cleanId}（${regTask.companyName}）は停止中（停止日: ${regTask.stopDate || '—'}）です。Dymtaskの作成は不可です。`,
            rowNumber: st.rowNumber,
          });
          stats.errorCount += 1;
        }

        // 9. エラー: NOTE内のリンク先IDと不一致
        if (st.note) {
          const noteDymId = extractDymTaskId(st.note);
          const rangeMatch = st.note.match(/range=(\d+)(?::\d+)?/);
          if (rangeMatch) {
            const rowFromLink = parseInt(rangeMatch[1], 10);
            if (rowFromLink && rowFromLink !== regTask.originalRowNumber && noteDymId && noteDymId !== cleanId) {
              exceptions.push({
                id: `err-link-mismatch-${st.rowNumber}`,
                level: 'エラー',
                category: 'REGISTRY_LINK_MISMATCH',
                categoryNameJa: 'NOTE内のリンク先IDと不一致',
                date: effectiveDay,
                taskId: cleanId,
                assignee: st.assignee,
                subtaskContent: st.subtaskContent,
                detail: `NOTE列のリンクは行${rowFromLink}（ID: ${noteDymId}）を指しており、現在の行のID（${cleanId}）と一致しません。`,
                rowNumber: st.rowNumber,
                evidence: { expectedDymId: cleanId, foundDymId: noteDymId },
              });
              stats.errorCount += 1;
            }
          }
        }
      }
    }

    // Deduplication
    const dedupKey = `${cleanId}__${effectiveDay}__${(st.assignee || '').toLowerCase()}__${(st.subtaskContent || '').toLowerCase().trim()}`;
    const dedupList = subtaskDeduplicationMap.get(dedupKey) || [];
    dedupList.push(st);
    subtaskDeduplicationMap.set(dedupKey, dedupList);

    // 要確認: 実績時間の乖離 (≤25% または ≥200%)
    const est = st.estMinutes || 0;
    const act = st.actualMinutes || 0;
    if (est >= settings.estMinForRatioCheck && act > 0) {
      const ratio = (act / est) * 100;
      if (ratio <= settings.actualLowRatioPercent) {
        exceptions.push({
          id: `rev-low-time-${st.rowNumber}`,
          level: '要確認',
          category: 'TIME_VARIANCE',
          categoryNameJa: '実績時間が極端に短い (≤ 25%)',
          date: effectiveDay,
          taskId: cleanId,
          assignee: st.assignee,
          subtaskContent: st.subtaskContent,
          detail: `想定工数 ${est}分 に対し、実績時間は ${act}分（${Math.round(ratio)}% ≤ ${settings.actualLowRatioPercent}%）です。品質の確認が必要です。`,
          rowNumber: st.rowNumber,
          evidence: { estTime: est, actualTime: act },
        });
        stats.reviewCount += 1;
      } else if (ratio >= settings.actualHighRatioPercent && act - est >= settings.actualHighMinDiff) {
        exceptions.push({
          id: `rev-high-time-${st.rowNumber}`,
          level: '要確認',
          category: 'TIME_VARIANCE',
          categoryNameJa: '実績時間の大幅超過 (≥ 200%)',
          date: effectiveDay,
          taskId: cleanId,
          assignee: st.assignee,
          subtaskContent: st.subtaskContent,
          detail: `想定工数 ${est}分 に対し、実績時間は ${act}分（${Math.round(ratio)}%、+${act - est}分超過）です。工数増大の理由確認が必要です。`,
          rowNumber: st.rowNumber,
          evidence: { estTime: est, actualTime: act },
        });
        stats.reviewCount += 1;
      }
    }

    // 要確認: 最終更新者が担当者と不一致
    if (st.lastUpdatedUser && st.assignee) {
      const cleanAssignee = st.assignee.toLowerCase().trim();
      const cleanLastUser = st.lastUpdatedUser.toLowerCase().trim();
      if (cleanAssignee !== cleanLastUser && !cleanLastUser.includes(cleanAssignee) && !cleanAssignee.includes(cleanLastUser)) {
        exceptions.push({
          id: `rev-updated-by-${st.rowNumber}`,
          level: '要確認',
          category: 'UPDATED_BY_OTHER',
          categoryNameJa: '最終更新者が担当者と不一致',
          date: effectiveDay,
          taskId: cleanId,
          assignee: st.assignee,
          subtaskContent: st.subtaskContent,
          detail: `担当者は「${st.assignee}」ですが、最終更新者は「${st.lastUpdatedUser}」です。`,
          rowNumber: st.rowNumber,
          evidence: { lastUpdatedUser: st.lastUpdatedUser },
        });
        stats.reviewCount += 1;
      }
    }
  }

  // Step 2: Dymtask内のサブタスク重複 (要確認)
  for (const [key, list] of subtaskDeduplicationMap.entries()) {
    if (list.length > 1) {
      for (let i = 1; i < list.length; i++) {
        const item = list[i];
        const stats = getStats(item.assignee);
        const itemDay = item.deadlineDay ? item.deadlineDay.replace(/-/g, '/') : '—';
        exceptions.push({
          id: `rev-dup-${item.rowNumber}`,
          level: '要確認',
          category: 'DUPLICATE_SUBTASK',
          categoryNameJa: 'Dymtask内のサブタスク重複',
          date: itemDay,
          taskId: item.id,
          assignee: item.assignee,
          subtaskContent: item.subtaskContent,
          detail: `行${list[0].rowNumber}と重複しています（同ID ${item.id}、同日、同一担当者および同一内容）。`,
          rowNumber: item.rowNumber,
        });
        stats.reviewCount += 1;
      }
    }
  }

  // Step 3: 1日の合計実績時間480分超過 (要確認)
  for (const [dayKey, totalMins] of assigneeDateActualMinutes.entries()) {
    if (totalMins > settings.dailyActualLimitMinutes) {
      const [assignee, dateStr] = dayKey.split('__');
      const stats = getStats(assignee);
      exceptions.push({
        id: `rev-daylimit-${dayKey}`,
        level: '要確認',
        category: 'DAILY_TIME_EXCEEDED',
        categoryNameJa: '1日の合計実績時間が480分超過',
        date: dateStr,
        taskId: '—',
        assignee: assignee,
        subtaskContent: '当日の全サブタスク',
        detail: `${dateStr}の合計実績時間が ${totalMins}分（約${(totalMins / 60).toFixed(1)}時間）となり、上限の${settings.dailyActualLimitMinutes}分を超過しています。`,
        rowNumber: 0,
        evidence: { actualTime: totalMins },
      });
      stats.reviewCount += 1;
    }
  }

  // Step 4: 連続一括完了（送信不正の疑い - BURST_CLOSURE）
  const burstSubtaskRowSet = new Set<number>();
  for (const [assignee, events] of assigneeCloseEventsMap.entries()) {
    events.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
    const windowMs = settings.burstWindowMinutes * 60 * 1000;

    for (let i = 0; i < events.length; i++) {
      const startEvent = events[i];
      let j = i;
      const windowEvents: typeof events = [];

      while (j < events.length && events[j].closeTime.getTime() - startEvent.closeTime.getTime() <= windowMs) {
        windowEvents.push(events[j]);
        j++;
      }

      if (windowEvents.length >= settings.burstCountThreshold) {
        const stats = getStats(assignee);
        for (const ev of windowEvents) {
          burstSubtaskRowSet.add(ev.subtask.rowNumber);
        }

        const firstTimeStr = windowEvents[0].subtask.lastUpdatedTime;
        const lastTimeStr = windowEvents[windowEvents.length - 1].subtask.lastUpdatedTime;
        const closeDayStr = `${startEvent.closeTime.getFullYear()}/${String(startEvent.closeTime.getMonth() + 1).padStart(2, '0')}/${String(startEvent.closeTime.getDate()).padStart(2, '0')}`;
        exceptions.push({
          id: `rev-burst-${assignee}-${startEvent.closeTime.getTime()}`,
          level: '要確認',
          category: 'BURST_CLOSURE',
          categoryNameJa: '連続一括完了（送信不正の疑い）',
          date: closeDayStr,
          taskId: `${windowEvents.length}件`,
          assignee: assignee,
          subtaskContent: `${firstTimeStr} 〜 ${lastTimeStr} に一括完了`,
          detail: `${settings.burstWindowMinutes}分以内に ${windowEvents.length}件のサブタスクが連続完了されました。実際の送信有無または終了間際の一括処理か確認が必要です。`,
          rowNumber: windowEvents[0].subtask.rowNumber,
          evidence: {
            burstCount: windowEvents.length,
            windowMinutes: settings.burstWindowMinutes,
          },
        });
        stats.reviewCount += 1;
        i = j - 1;
      }
    }
  }

  // Step 5: Dymtask未送信 (本日の定期タスク - MISSING_SCHEDULED_DUMMY)
  if (registryMap.size > 0 && auditDateStr) {
    const formattedAuditDate = auditDateStr.replace(/-/g, '/');
    const auditDate = parseDateTime(auditDateStr);
    const standardDateIso = auditDate ? auditDate.toISOString().slice(0, 10) : '';

    if (auditDate && !settings.holidays.includes(standardDateIso)) {
      const dayOfWeekNum = auditDate.getDay();
      const weekdayChars = ['日', '月', '火', '水', '木', '金', '土'];
      const currentWeekdayChar = weekdayChars[dayOfWeekNum];

      const performedTaskIdsOnDate = new Set<string>();
      for (const st of subtasks) {
        const stDay = st.deadlineDay
          ? st.deadlineDay.replace(/-/g, '/')
          : st.parsedCloseDate
          ? `${st.parsedCloseDate.getFullYear()}/${String(st.parsedCloseDate.getMonth() + 1).padStart(2, '0')}/${String(st.parsedCloseDate.getDate()).padStart(2, '0')}`
          : '';
        if (stDay === formattedAuditDate && st.id) {
          performedTaskIdsOnDate.add(st.id);
        }
      }

      for (const [dymId, task] of registryMap.entries()) {
        if (task.sourceTab === '求人依頼表' && task.status === '稼働中' && task.taskType === '定期') {
          const freq = task.frequency || '';
          const dayDetail = task.dayDetail || '';

          let isDueToday = false;
          if (freq === '毎日') {
            isDueToday = true;
          } else if (freq === '週次' && dayDetail.includes(currentWeekdayChar)) {
            isDueToday = true;
          }

          if (isDueToday && !performedTaskIdsOnDate.has(dymId)) {
            exceptions.push({
              id: `err-missing-sched-${dymId}`,
              level: 'エラー',
              category: 'MISSING_SCHEDULED_DUMMY',
              categoryNameJa: 'Dymtask未送信 (本日の定期タスク)',
              date: formattedAuditDate,
              taskId: dymId,
              assignee: task.assignee || '担当者未設定',
              subtaskContent: task.taskName,
              detail: `定期タスク ${dymId}（${task.companyName}）は本日稼働予定（${freq} - ${dayDetail || '全日'}）ですが、Dymtaskの記録がありません。`,
              rowNumber: task.originalRowNumber,
            });
            const stats = getStats(task.assignee || '担当者未設定');
            stats.errorCount += 1;
          }
        }
      }
    }
  }

  // Scatter plot points
  const timeScatterPoints: AuditReport['timeScatterPoints'] = [];
  for (const st of subtasks) {
    if (st.parsedCloseDate) {
      const d = st.parsedCloseDate;
      const hours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
      const pad = (n: number) => String(n).padStart(2, '0');
      timeScatterPoints.push({
        assignee: st.assignee || '担当者未設定',
        timeHour: hours,
        timeLabel: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        subtaskName: st.subtaskContent || st.taskName,
        taskId: st.id,
        isBurst: burstSubtaskRowSet.has(st.rowNumber),
        actualTime: st.actualMinutes || 0,
      });
    }
  }

  // Assignee Summaries
  const assigneeSummaries: AssigneeSummary[] = [];
  for (const [user, s] of assigneeStats.entries()) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date | null) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : null);
    const ratio = s.totalEst > 0 ? Math.round((s.totalActual / s.totalEst) * 100) : 0;

    assigneeSummaries.push({
      assignee: user,
      taskCount: s.taskSet.size,
      subtaskCount: s.subtaskCount,
      totalEstMinutes: s.totalEst,
      totalActualMinutes: s.totalActual,
      actualVsEstRatio: ratio,
      firstCloseTime: fmt(s.firstClose),
      lastCloseTime: fmt(s.lastClose),
      errorCount: s.errorCount,
      reviewCount: s.reviewCount,
    });
  }

  assigneeSummaries.sort((a, b) => b.errorCount + b.reviewCount - (a.errorCount + a.reviewCount));

  let errorCount = 0;
  let reviewCount = 0;
  for (const ex of exceptions) {
    if (ex.level === 'エラー') errorCount++;
    else reviewCount++;
  }

  return {
    totalRows: subtasks.length,
    totalTasks: new Set(subtasks.map((s) => s.id).filter(Boolean)).size,
    totalAssignees: assigneeStats.size,
    errorCount,
    reviewCount,
    exceptions,
    assigneeSummaries,
    timeScatterPoints,
  };
}

// Backward compatibility alias
export const auditDummyTodoList = auditDymtaskList;
