/**
 * Pure functions for Workload and Quarterly KPI calculations.
 * Strict, deterministic, and testable without UI or side effects.
 */

import { AppSettings, BaseRegistryTask, DymtaskSubtask, Member, MemberQuarterKpi } from '../types';
import { normalizeAssigneeName } from './normalize';

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

/**
 * Counts the number of weekdays specified in dayDetail (e.g. "月水金" -> 3)
 */
export function countSpecifiedWeekdays(dayDetail: string | undefined | null): number {
  if (!dayDetail) return 0;
  const str = dayDetail.trim();
  let count = 0;
  for (const w of ['月', '火', '水', '木', '金', '土', '日']) {
    if (str.includes(w)) count++;
  }
  return count;
}

/**
 * Calculates weekly planned minutes for a task:
 * - Only regular tasks (定期) with status 稼働中 are counted
 * - 毎日: 想定工数 × (number of days in 曜日詳細 or default 5)
 * - 週次: 想定工数 × (number of days in 曜日詳細 or default 1)
 * - 月次: 想定工数 ÷ 4
 * - 不定期: NOT counted in weekly minutes (tracked separately as count)
 */
export function calcWeeklyPlannedMinutes(task: BaseRegistryTask): number {
  if (task.sourceTab !== '求人依頼表' || task.taskType !== '定期' || task.status !== '稼働中') {
    return 0;
  }

  const est = task.estimatedMinutes || 0;
  if (est <= 0) return 0;

  const freq = (task.frequency || '').trim();
  const dayDetail = (task.dayDetail || '').trim();

  if (freq === '毎日') {
    const days = countSpecifiedWeekdays(dayDetail);
    const multiplier = days > 0 ? days : 5;
    return est * multiplier;
  }

  if (freq === '週次') {
    const days = countSpecifiedWeekdays(dayDetail);
    const multiplier = days > 0 ? days : 1;
    return est * multiplier;
  }

  if (freq === '月次') {
    return Math.round(est / 4);
  }

  // Fallback for inferred recurring
  const days = countSpecifiedWeekdays(dayDetail);
  return days > 0 ? est * days : est;
}

/**
 * Calculates start and end dates for a fiscal quarter.
 * @param year Fiscal year (e.g. 2026)
 * @param quarter 1, 2, 3, or 4
 * @param startMonth Month that Q1 starts in (default 4 = April)
 */
export function getQuarterDateRange(
  year: number,
  quarter: number,
  startMonth: number = 4
): { startDate: string; endDate: string; label: string } {
  // Q1 starts at startMonth
  // Q2: startMonth + 3
  // Q3: startMonth + 6
  // Q4: startMonth + 9
  const mOffset = (quarter - 1) * 3;
  let qStartM = startMonth + mOffset;
  let qYear = year;
  while (qStartM > 12) {
    qStartM -= 12;
    qYear += 1;
  }

  let qEndM = qStartM + 2;
  let qEndYear = qYear;
  if (qEndM > 12) {
    qEndM -= 12;
    qEndYear += 1;
  }

  // Last day of end month
  const lastDay = new Date(qEndYear, qEndM, 0).getDate();

  const pad = (n: number) => String(n).padStart(2, '0');
  const startDate = `${qYear}-${pad(qStartM)}-01`;
  const endDate = `${qEndYear}-${pad(qEndM)}-${pad(lastDay)}`;
  const label = `${year}年度 Q${quarter} (${qStartM}月〜${qEndM}月)`;

  return { startDate, endDate, label };
}

/**
 * Checks if a given YYYY-MM-DD date is a working day (Mon-Fri and not holiday)
 */
export function isWorkingDay(dateStr: string, holidays: string[] = []): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const day = d.getDay();
  if (day === 0 || day === 6) return false; // Weekend
  return !holidays.includes(dateStr);
}

/**
 * Determines whether a date string falls inside [startDate, endDate]
 */
export function isDateInQuarter(dateStr: string | null | undefined, startDate: string, endDate: string): boolean {
  if (!dateStr) return false;
  // Normalize YYYY/MM/DD or YYYY-MM-DD
  const normalized = dateStr.replace(/\//g, '-').slice(0, 10);
  return normalized >= startDate && normalized <= endDate;
}

/**
 * Computes individual Quarterly KPIs for a member
 */
export function computeMemberQuarterKpi(
  member: Member,
  tasks: BaseRegistryTask[],
  dymtaskSubtasks: DymtaskSubtask[],
  settings: AppSettings,
  year: number,
  quarter: number,
  targets: Record<string, number> = {}
): MemberQuarterKpi {
  const normMember = member.normalizedName || normalizeAssigneeName(member.name);
  const startMonth = settings.fiscalYearStartMonth || 4;
  const { startDate, endDate } = getQuarterDateRange(year, quarter, startMonth);

  // 1. Filter member's tasks from registry
  const memberTasks = tasks.filter((t) => {
    if (t.assigneesList && t.assigneesList.length > 0) {
      return t.assigneesList.some((a) => normalizeAssigneeName(a) === normMember);
    }
    return normalizeAssigneeName(t.assignee) === normMember;
  });

  const runningTasks = memberTasks.filter((t) => t.status === '稼働中');
  const runningWithId = runningTasks.filter((t) => Boolean(t.dymTaskId));
  const activeRecurring = memberTasks.filter((t) => t.taskType === '定期' && t.status === '稼働中');
  const activeFuteiki = memberTasks.filter((t) => t.taskType === '不定期' && t.status === '稼働中');

  // 2. Filter member's Dymtask subtasks in this quarter
  const memberSubtasks = dymtaskSubtasks.filter((s) => {
    const sNorm = normalizeAssigneeName(s.assignee);
    if (sNorm !== normMember) return false;
    const dateStr = s.deadlineDay ? s.deadlineDay.replace(/\//g, '-').slice(0, 10) : '';
    return isDateInQuarter(dateStr, startDate, endDate);
  });

  // KPI 1: Dymtask 送信率 (Scheduled ID x Day vs Sent ID x Day)
  // For each working day in quarter, compute scheduled tasks and check if sent in Dymtask
  const sentIdDateSet = new Set<string>();
  for (const s of memberSubtasks) {
    if (s.id && s.deadlineDay) {
      const d = s.deadlineDay.replace(/\//g, '-').slice(0, 10);
      sentIdDateSet.add(`${s.id}__${d}`);
    }
  }

  // Iterate days in quarter
  let scheduledIdDays = 0;
  let sentIdDays = 0;

  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const curD = new Date(startD);

  const pad = (n: number) => String(n).padStart(2, '0');
  const weekdayChars = ['日', '月', '火', '水', '木', '金', '土'];

  while (curD <= endD) {
    const dStr = `${curD.getFullYear()}-${pad(curD.getMonth() + 1)}-${pad(curD.getDate())}`;
    const dayOfWeek = weekdayChars[curD.getDay()];

    if (isWorkingDay(dStr, settings.holidays)) {
      for (const t of activeRecurring) {
        if (!t.dymTaskId) continue;
        const freq = t.frequency || '';
        const dayDetail = t.dayDetail || '';

        let runsOnDay = false;
        if (freq === '毎日') runsOnDay = true;
        else if (freq === '週次' && dayDetail.includes(dayOfWeek)) runsOnDay = true;

        if (runsOnDay) {
          scheduledIdDays++;
          if (sentIdDateSet.has(`${t.dymTaskId}__${dStr}`)) {
            sentIdDays++;
          }
        }
      }
    }
    curD.setDate(curD.getDate() + 1);
  }

  const sendRate = scheduledIdDays > 0 ? Math.round((sentIdDays / scheduledIdDays) * 1000) / 10 : 100.0;

  // KPI 2: 工数精度 (Done subtasks with 0.5 <= ACTUAL / EST <= 1.5)
  const doneSubtasks = memberSubtasks.filter((s) => s.status === 'Done' || s.substatus === 'Done');
  let accurateCount = 0;
  for (const s of doneSubtasks) {
    if (s.estMinutes > 0) {
      const ratio = s.actualMinutes / s.estMinutes;
      if (ratio >= 0.5 && ratio <= 1.5) {
        accurateCount++;
      }
    }
  }
  const estAccuracy = doneSubtasks.length > 0 ? Math.round((accurateCount / doneSubtasks.length) * 1000) / 10 : 100.0;

  // KPI 3: エラー率 (ERROR per 100 subtasks. REVIEW is 参考 only)
  let totalErrors = 0;
  let reviewCount = 0;
  for (const s of memberSubtasks) {
    // Check known error conditions
    if (!s.id || s.id.length !== 6 || !/^\d+$/.test(s.id)) totalErrors++;
    if (s.actualMinutes === 0 && (s.status === 'Done' || s.substatus === 'Done')) totalErrors++;
    if (!s.deadlineDay) totalErrors++;
    if (s.estMinutes > 0 && (s.actualMinutes / s.estMinutes < 0.25 || s.actualMinutes / s.estMinutes > 2.0)) {
      reviewCount++; // Review only
    }
  }
  const errorRatePer100 = memberSubtasks.length > 0
    ? Math.round((totalErrors / memberSubtasks.length) * 100 * 10) / 10
    : 0.0;

  // KPI 4: 稼働負荷 (週間予定工数 / weekly capacity)
  let weeklyPlannedMinutes = 0;
  for (const t of activeRecurring) {
    weeklyPlannedMinutes += calcWeeklyPlannedMinutes(t);
  }
  const capacity = settings.weeklyCapacityMinutes || 2400;
  const workloadRatio = Math.round((weeklyPlannedMinutes / capacity) * 1000) / 10;

  // KPI 5: ショット完了件数 (Shot completed in quarter)
  const shotTasks = memberTasks.filter((t) => t.sourceTab === 'ショット');
  const shotCompletedInQuarter = shotTasks.filter((t) => {
    const isDone = t.status === '完了';
    if (!isDone) return false;
    const completedDate = t.shotCompletedDate || t.recordDate;
    return isDateInQuarter(completedDate, startDate, endDate);
  }).length;

  // KPI 6: ID付与率 (Running tasks with DYMTASK ID / Total running tasks)
  const idAssignRate = runningTasks.length > 0
    ? Math.round((runningWithId.length / runningTasks.length) * 1000) / 10
    : 100.0;

  return {
    memberId: member.id,
    memberName: member.name,
    subLeader: member.subLeader || '未設定',
    team: member.team || '未設定',
    year,
    quarter,
    sendRate,
    sendRateTarget: targets.sendRate !== undefined ? targets.sendRate : settings.kpiSendRateTarget || 95,
    scheduledIdDays,
    sentIdDays,
    estAccuracy,
    estAccuracyTarget: targets.estAccuracy !== undefined ? targets.estAccuracy : settings.kpiEstAccuracyTarget || 80,
    doneSubtasksCount: doneSubtasks.length,
    accurateSubtasksCount: accurateCount,
    errorRatePer100,
    errorRateTarget: targets.errorRate !== undefined ? targets.errorRate : settings.kpiErrorRateThreshold || 2.0,
    totalErrors,
    totalSubtasks: memberSubtasks.length,
    reviewCount,
    weeklyPlannedMinutes,
    workloadRatio,
    workloadTarget: targets.workload !== undefined ? targets.workload : 100.0,
    shotCompletedCount: shotCompletedInQuarter,
    shotCompletedTarget: targets.shotCompleted !== undefined ? targets.shotCompleted : 10,
    idAssignRate,
    idAssignRateTarget: targets.idAssignRate !== undefined ? targets.idAssignRate : settings.kpiIdAssignRateTarget || 90,
    runningTasksWithId: runningWithId.length,
    runningTasksTotal: runningTasks.length,
    futeikiRunningCount: activeFuteiki.length,
  };
}
