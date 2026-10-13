export type TaskType = 'ショット' | '定期' | '不定期' | '要確認';

export type TaskStatus =
  | '稼働中'
  | '停止中'
  | '対応中'
  | '完了'
  | '休止中'
  | 'Wcheck中'
  | '保留中'
  | '確認中'
  | 'その他';

export interface BaseRegistryTask {
  id: string; // Unique generated or composite key
  originalRowNumber: number; // 1-based original line number in CSV
  sourceTab: 'ショット' | '求人依頼表';
  dymTaskId: string | null; // Primary 6-digit ID if present
  companyName: string; // Cleaned / resolved company name
  rawCompanyName: string;
  taskName: string;
  applicantOrOwner: string; // 運用担当 / 依頼者
  assignee: string; // 担当者 / 対応者
  estimatedMinutes: number | null; // 想定工数(分)
  actualMinutes?: number | null; // 実際時間(分)
  recordDate: string; // 記載日
  status: TaskStatus;
  rawStatus: string;
  taskType: TaskType;
  frequency?: string; // 頻度 (File B)
  dayDetail?: string; // 曜日詳細 (File B)
  stopDate?: string | null; // 停止日
  stopDateSource?: 'file' | 'snapshot';
  notes?: string;
  warningNotice?: string; // 注意・警告内容
  warningCategory?: 'MISMATCH' | 'EMPTY_FREQ' | 'UNKNOWN_FREQ';
  warningCategoryJa?: string; // 頻度と曜日詳細の不一致 / 頻度空欄 / 判定不可
  isInferredFrequency?: boolean; // 頻度空欄: 曜日詳細より判定
  // Shot execution timestamps
  shotStartDate?: string | null; // 対応開始日
  shotCompletedDate?: string | null; // 対応完了日
  assigneesList?: string[]; // 分割された対応者一覧
}

export interface AnkenSummary {
  canonicalName: string;
  rawNames: string[];
  assignees: string[];
  totalTasks: number;
  // Breakdown
  teikiRunning: number;
  teikiStopped: number;
  futeikiRunning: number;
  futeikiStopped: number;
  shotInProgress: number;
  shotCompleted: number;
  shotOther: number;
  // Anomalies
  warningCount: number;
  missingIdCount: number; // 定期・不定期の稼働中ID未設定数 (52)
  shotMissingIdCount: number; // ショット未完了のID未設定数
  teikiRunningNoIdCount: number; // 11
  futeikiRunningNoIdCount: number; // 41
  latestStopDate: string | null;
  tasks: BaseRegistryTask[];
}

export type UserRoleMode = 'メンバー' | 'サブリード' | 'リード';

export interface Member {
  id: string;
  name: string;
  normalizedName: string; // 大文字・アクセント除去 (照合用)
  role: 'メンバー' | 'サブリード' | 'リード';
  subLeader?: string; // サブリード名
  team: string; // チーム名
}

export interface AssigneeMapping {
  rawName: string;
  mappedMemberName: string;
}

export interface MemberQuarterKpi {
  memberId: string;
  memberName: string;
  subLeader: string;
  team: string;
  year: number;
  quarter: number; // 1-4
  // 1. Dymtask送信率 (%)
  sendRate: number;
  sendRateTarget?: number;
  scheduledIdDays: number;
  sentIdDays: number;
  // 2. 工数精度 (%)
  estAccuracy: number;
  estAccuracyTarget?: number;
  doneSubtasksCount: number;
  accurateSubtasksCount: number;
  // 3. エラー率 (件 / 100 subtasks)
  errorRatePer100: number;
  errorRateTarget?: number;
  totalErrors: number;
  totalSubtasks: number;
  reviewCount: number; // 参考
  // 4. 稼働負荷 (%)
  weeklyPlannedMinutes: number;
  workloadRatio: number;
  workloadTarget?: number;
  // 5. ショット完了件数 (件)
  shotCompletedCount: number;
  shotCompletedTarget?: number;
  // 6. ID付与率 (%)
  idAssignRate: number;
  idAssignRateTarget?: number;
  runningTasksWithId: number;
  runningTasksTotal: number;
  // Futeiki task count (informational)
  futeikiRunningCount: number;
}

export interface DymtaskSubtask {
  rowNumber: number;
  id: string; // DYMTASK ID
  taskName: string;
  project: string;
  tag: string;
  team: string;
  type: string; // DAILY / ONETIME
  typeDetail: string;
  deadlineDay: string; // YYYY-MM-DD
  deadlineTime: string;
  estMinutes: number;
  status: string; // Task status (Done, In Progress, etc.)
  note: string; // Google Sheet link
  createdBy: string;
  createdTime: string;
  subtaskContent: string;
  assignee: string;
  actualMinutes: number;
  substatus: string; // Done / Skipped
  lastUpdatedUser: string;
  lastUpdatedTime: string; // dd/mm/yyyy HH:MM:SS or yyyy/MM/dd HH:mm:ss
  parsedCloseDate?: Date | null;
}

// Backward compatibility alias
export type DummySubtask = DymtaskSubtask;

export type ExceptionLevel = 'エラー' | '要確認';

export type ExceptionCategory =
  | 'INVALID_ID'
  | 'INVALID_DATE'
  | 'EMPTY_ASSIGNEE'
  | 'UNCLOSED_SUBTASK'
  | 'ZERO_ACTUAL_WHEN_DONE'
  | 'NOT_IN_REGISTRY'
  | 'STOPPED_TASK_DUMMY'
  | 'MISSING_SCHEDULED_DUMMY'
  | 'REGISTRY_LINK_MISMATCH'
  | 'DUPLICATE_SUBTASK'
  | 'TIME_VARIANCE'
  | 'DAILY_TIME_EXCEEDED'
  | 'UPDATED_BY_OTHER'
  | 'BURST_CLOSURE';

export interface AuditException {
  id: string;
  level: ExceptionLevel;
  category: ExceptionCategory;
  categoryNameJa: string;
  date: string;
  taskId: string;
  assignee: string;
  subtaskContent: string;
  detail: string;
  rowNumber: number;
  evidence?: {
    estTime?: number;
    actualTime?: number;
    lastUpdatedUser?: string;
    burstCount?: number;
    windowMinutes?: number;
    expectedDymId?: string;
    foundDymId?: string;
  };
}

export interface AssigneeSummary {
  assignee: string;
  taskCount: number;
  subtaskCount: number;
  totalEstMinutes: number;
  totalActualMinutes: number;
  actualVsEstRatio: number; // percentage
  firstCloseTime: string | null;
  lastCloseTime: string | null;
  errorCount: number;
  reviewCount: number;
}

export interface AppSettings {
  // Google Sheet configs
  shotBookId: string;
  shotGid: string; // Default: 7242854
  kyujinBookId: string;
  kyujinGid: string; // Default: 1828959786
  stopDateColumnName: string;

  // Dymtask Audit Thresholds
  burstWindowMinutes: number; // Default: 5分
  burstCountThreshold: number; // Default: 10件
  dailyActualLimitMinutes: number; // Default: 480分 (8時間)
  estMinForRatioCheck: number; // Default: 30分
  actualLowRatioPercent: number; // Default: 25%
  actualHighRatioPercent: number; // Default: 200%
  actualHighMinDiff: number; // Default: 15分

  // Company Aliases / Merges
  companyMerges: Record<string, string>; // originalName -> canonicalName

  // Assignee manual mappings
  assigneeMappings?: Record<string, string>; // rawAssignee -> memberName

  // Non-working days (YYYY-MM-DD[])
  holidays: string[];

  // Quarterly KPI Configurations
  fiscalYearStartMonth?: number; // Default: 4 (4月開始)
  weeklyCapacityMinutes?: number; // Default: 2400 (40h/week)
  kpiSendRateTarget?: number; // Default: 95%
  kpiEstAccuracyTarget?: number; // Default: 80%
  kpiErrorRateThreshold?: number; // Default: 2.0 (件/100件)
  kpiIdAssignRateTarget?: number; // Default: 90%

  // Google OAuth Client ID (Phase 2 readiness)
  googleClientId?: string;
  autoSyncIntervalMinutes?: number;
}

export interface SnapshotEntry {
  key: string; // dymTaskId or fallback composite
  status: string;
  firstSeenStoppedDate: string;
  uploadDate: string;
}
