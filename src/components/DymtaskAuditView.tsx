import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  Users,
} from 'lucide-react';
import {
  AppSettings,
  AssigneeSummary,
  AuditException,
  BaseRegistryTask,
  DymtaskSubtask,
  ExceptionLevel,
} from '../types';
import { auditDymtaskList, AuditReport } from '../utils/dymtaskAuditor';
import { runAuditInWorker } from '../utils/workerClient';
import { SvgTimelineChart } from './SvgTimelineChart';

interface DymtaskAuditViewProps {
  dymtaskSubtasks: DymtaskSubtask[];
  registryMap: Map<string, BaseRegistryTask>;
  activeRecurringTasks?: BaseRegistryTask[];
  settings: AppSettings;
  onOpenUpload: () => void;
}

export const DymtaskAuditView: React.FC<DymtaskAuditViewProps> = ({
  dymtaskSubtasks,
  registryMap,
  activeRecurringTasks,
  settings,
  onOpenUpload,
}) => {
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'エラー' | '要確認'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [auditDate, setAuditDate] = useState<string>('2026-10-12');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  const [auditReport, setAuditReport] = useState<AuditReport>(() => {
    return auditDymtaskList(dymtaskSubtasks, registryMap, settings, auditDate, activeRecurringTasks);
  });

  useEffect(() => {
    let isCancelled = false;
    setIsAuditing(true);

    runAuditInWorker(dymtaskSubtasks, registryMap, settings, auditDate, activeRecurringTasks)
      .then((res) => {
        if (!isCancelled) {
          setAuditReport(res);
          setIsAuditing(false);
        }
      })
      .catch((err) => {
        console.error('Audit run error:', err);
        if (!isCancelled) {
          // Fallback to local
          const fallback = auditDymtaskList(dymtaskSubtasks, registryMap, settings, auditDate, activeRecurringTasks);
          setAuditReport(fallback);
          setIsAuditing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [dymtaskSubtasks, registryMap, settings, auditDate, activeRecurringTasks]);

  const assignees = useMemo(() => {
    const set = new Set<string>();
    for (const s of dymtaskSubtasks) {
      if (s.assignee) set.add(s.assignee);
    }
    return Array.from(set).sort();
  }, [dymtaskSubtasks]);

  const filteredExceptions = useMemo(() => {
    return auditReport.exceptions.filter((ex) => {
      if (levelFilter !== 'all' && ex.level !== levelFilter) return false;
      if (selectedAssignee !== 'all' && ex.assignee !== selectedAssignee) return false;
      if (categoryFilter !== 'all' && ex.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTask = ex.taskId.toLowerCase().includes(q);
        const matchUser = ex.assignee.toLowerCase().includes(q);
        const matchDesc = ex.detail.toLowerCase().includes(q);
        const matchContent = ex.subtaskContent.toLowerCase().includes(q);
        if (!matchTask && !matchUser && !matchDesc && !matchContent) return false;
      }
      return true;
    });
  }, [auditReport.exceptions, levelFilter, selectedAssignee, categoryFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredExceptions.length / pageSize));
  const paginatedExceptions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExceptions.slice(start, start + pageSize);
  }, [filteredExceptions, currentPage, pageSize]);

  const handleExportExceptionsCsv = () => {
    if (filteredExceptions.length === 0) return;

    const headers = [
      '重要度',
      'DYMTASK ID',
      '担当者',
      '日付',
      'エラー区分',
      'サブタスク内容',
      '詳細・検証結果',
      '行番号',
    ];
    const rows = filteredExceptions.map((ex) => [
      ex.level,
      `="${ex.taskId}"`,
      `"${ex.assignee}"`,
      ex.date,
      `"${ex.categoryNameJa}"`,
      `"${(ex.subtaskContent || '').replace(/"/g, '""')}"`,
      `"${ex.detail.replace(/"/g, '""')}"`,
      ex.rowNumber || '—',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dymtask_kensho_reigai_${auditDate.replace(/[-/]/g, '') || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (dymtaskSubtasks.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center max-w-xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
          <FileCheck2 className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-zinc-100 mb-2">
          Dymtaskデータが未読み込みです
        </h3>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200">dym_todo_list</code> CSVファイルを読み込むと、管理シートとの自動照合、連続一括完了（送信不正）の検知、想定工数と実績時間の乖離チェックを行います。
        </p>
        <button
          onClick={onOpenUpload}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 inline-flex items-center gap-2 transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>dym_todo_list を読み込む</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Metric Cards */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>Dymtask検証</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
              管理シート {registryMap.size}件と照合中
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            連続一括完了（送信不正）、停止中案件への送信、工数異常およびフォーマット不整合を検知
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
            <span>検証対象日：</span>
            <input
              type="date"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none font-mono text-xs cursor-pointer"
            />
          </div>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>再読み込み</span>
          </button>
        </div>
      </div>

      {isAuditing && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-xs text-indigo-300 flex items-center gap-2.5 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          <span>処理中...（Dymtask検証を実行中）</span>
        </div>
      )}

      {/* 5 Big Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-zinc-400 font-medium mb-1">Dymtask総行数</div>
          <div className="text-2xl font-black text-white">
            {auditReport.totalRows.toLocaleString()}件
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">記録されたサブタスク数</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-zinc-400 font-medium mb-1">タスクID数</div>
          <div className="text-2xl font-black text-indigo-400">
            {auditReport.totalTasks}件
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">個別DYMTASK ID</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="text-xs text-zinc-400 font-medium mb-1">担当者数</div>
          <div className="text-2xl font-black text-cyan-400">
            {auditReport.totalAssignees}名
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">作業者（ASSIGNEE）</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium mb-1">
            <span>エラー</span>
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            {auditReport.errorCount}件
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">ID不正・停止中・0分など</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium mb-1">
            <span>要確認</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            {auditReport.reviewCount}件
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">連続一括完了・乖離など</p>
        </div>
      </div>

      {/* 2. Scatter Timeline Visual (00:00 - 24:00) */}
      <div className="space-y-2">
        <SvgTimelineChart
          points={auditReport.timeScatterPoints}
          assignees={assignees}
        />
      </div>

      {/* 3. Assignee Performance & Audit Summary Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-semibold text-zinc-200 tracking-wider">
              担当者別集計（全{auditReport.assigneeSummaries.length}名）
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">
            担当者をクリックすると下部の例外一覧を絞り込めます
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-medium">
                <th className="py-2.5 px-4">担当者（ASSIGNEE）</th>
                <th className="py-2.5 px-3 text-center">タスク数</th>
                <th className="py-2.5 px-3 text-center">サブタスク数</th>
                <th className="py-2.5 px-3 text-right">想定工数</th>
                <th className="py-2.5 px-3 text-right">実績時間</th>
                <th className="py-2.5 px-3 text-center">実績 / 想定比率</th>
                <th className="py-2.5 px-3 text-center">初回 / 最終完了</th>
                <th className="py-2.5 px-4 text-center">エラー / 要確認</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {auditReport.assigneeSummaries.map((s) => {
                const isSelected = selectedAssignee === s.assignee;
                const hasIssues = s.errorCount > 0 || s.reviewCount > 0;
                const ratioColor =
                  s.actualVsEstRatio < 50
                    ? 'text-amber-400 font-bold'
                    : s.actualVsEstRatio > 150
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-400';

                return (
                  <tr
                    key={s.assignee}
                    onClick={() =>
                      setSelectedAssignee(selectedAssignee === s.assignee ? 'all' : s.assignee)
                    }
                    className={`cursor-pointer transition-colors hover:bg-zinc-800/40 ${
                      isSelected
                        ? 'bg-indigo-950/40 border-l-2 border-indigo-500'
                        : hasIssues
                        ? 'bg-rose-950/10'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-zinc-200">
                      <div className="flex items-center gap-2">
                        {hasIssues && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        )}
                        <span>{s.assignee}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                            選択中
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center text-zinc-300 font-mono">
                      {s.taskCount}件
                    </td>

                    <td className="py-3 px-3 text-center text-zinc-300 font-mono">
                      {s.subtaskCount}件
                    </td>

                    <td className="py-3 px-3 text-right text-zinc-400 font-mono">
                      {s.totalEstMinutes.toLocaleString()}分
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-zinc-200">
                      {s.totalActualMinutes.toLocaleString()}分
                    </td>

                    <td className="py-3 px-3 text-center font-mono">
                      <span className={ratioColor}>{s.actualVsEstRatio}%</span>
                    </td>

                    <td className="py-3 px-3 text-center text-zinc-400 font-mono text-[11px]">
                      {s.firstCloseTime && s.lastCloseTime
                        ? `${s.firstCloseTime} 〜 ${s.lastCloseTime}`
                        : '—'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        {s.errorCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80">
                            {s.errorCount}件 エラー
                          </span>
                        )}
                        {s.reviewCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80">
                            {s.reviewCount}件 要確認
                          </span>
                        )}
                        {!hasIssues && (
                          <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 正常
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Filterable Exceptions Detail Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-semibold text-zinc-200 tracking-wider">
              例外・検知詳細（全{filteredExceptions.length}件）
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Level filter */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
              <button
                onClick={() => setLevelFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  levelFilter === 'all'
                    ? 'bg-zinc-800 text-white font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setLevelFilter('エラー')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  levelFilter === 'エラー'
                    ? 'bg-rose-950/80 text-rose-300 font-medium border border-rose-800/80'
                    : 'text-zinc-400 hover:text-rose-300'
                }`}
              >
                エラー（{auditReport.errorCount}件）
              </button>
              <button
                onClick={() => setLevelFilter('要確認')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  levelFilter === '要確認'
                    ? 'bg-amber-950/80 text-amber-300 font-medium border border-amber-800/80'
                    : 'text-zinc-400 hover:text-amber-300'
                }`}
              >
                要確認（{auditReport.reviewCount}件）
              </button>
            </div>

            {/* Assignee filter dropdown */}
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">全担当者（{assignees.length}名）</option>
              {assignees.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>

            {/* Category filter dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">全エラー区分</option>
              <option value="BURST_CLOSURE">連続一括完了（送信不正の疑い）</option>
              <option value="INVALID_ID">DYMTASK IDの桁数不正 (6桁必須)</option>
              <option value="NOT_IN_REGISTRY">管理シートに存在しないDYMTASK ID</option>
              <option value="STOPPED_TASK_DUMMY">停止中タスクにDymtaskあり</option>
              <option value="MISSING_SCHEDULED_DUMMY">Dymtask未送信 (本日の定期タスク)</option>
              <option value="ZERO_ACTUAL_WHEN_DONE">サブタスクDoneだが実績時間0分</option>
              <option value="TIME_VARIANCE">想定工数と実績時間の乖離</option>
              <option value="DUPLICATE_SUBTASK">Dymtask内のサブタスク重複</option>
              <option value="UPDATED_BY_OTHER">最終更新者が担当者と不一致</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ID・内容・担当者で検索"
                className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-48"
              />
            </div>

            {/* Export CSV button */}
            <button
              onClick={handleExportExceptionsCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 hover:bg-emerald-900/60 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV出力</span>
            </button>
          </div>
        </div>

        {/* Table of Exceptions */}
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-950 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-3">重要度</th>
                <th className="py-2.5 px-3">DYMTASK ID</th>
                <th className="py-2.5 px-3">担当者</th>
                <th className="py-2.5 px-3">日付</th>
                <th className="py-2.5 px-3">エラー区分</th>
                <th className="py-2.5 px-3">サブタスク内容・詳細</th>
                <th className="py-2.5 px-3 text-right">行番号</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredExceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    現在の絞り込み条件に該当する例外はありません。
                  </td>
                </tr>
              ) : (
                paginatedExceptions.map((ex) => (
                  <tr
                    key={ex.id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="py-3 px-3">
                      {ex.level === 'エラー' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80">
                          <AlertOctagon className="w-3 h-3 text-rose-400" />
                          エラー
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          要確認
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-indigo-400">
                      {ex.taskId}
                    </td>

                    <td className="py-3 px-3 text-zinc-200 font-medium">
                      {ex.assignee}
                    </td>

                    <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">
                      {ex.date}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-zinc-200 block">
                        {ex.categoryNameJa}
                      </span>
                      {ex.subtaskContent && (
                        <span className="text-[11px] text-zinc-400 truncate max-w-xs block mt-0.5">
                          {ex.subtaskContent}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-zinc-300 max-w-md">
                      <div>{ex.detail}</div>
                    </td>

                    <td className="py-3 px-3 text-right text-zinc-400 font-mono">
                      {ex.rowNumber > 0 ? `#${ex.rowNumber}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Exceptions Table Pagination Footer */}
        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <div>
            {filteredExceptions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}〜
            {Math.min(currentPage * pageSize, filteredExceptions.length)}件を表示中（全{filteredExceptions.length}件）
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-zinc-800 bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              {currentPage} / {totalPages} ページ
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-zinc-800 bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Compatibility export
export const DummyAuditView = DymtaskAuditView;
