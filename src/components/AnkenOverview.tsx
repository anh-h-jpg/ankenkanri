import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Search,
  Users,
} from 'lucide-react';
import { AnkenSummary } from '../types';

interface AnkenOverviewProps {
  ankens: AnkenSummary[];
  onSelectAnken: (anken: AnkenSummary) => void;
  onNavigateToAttention?: (group?: 'runningNoId' | 'shotNoId' | 'warnings') => void;
}

export const AnkenOverview: React.FC<AnkenOverviewProps> = ({
  ankens,
  onSelectAnken,
  onNavigateToAttention,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'needsAction' | 'normal'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totals = useMemo(() => {
    let totalAnkens = ankens.length;
    let teikiRunning = 0;
    let teikiStopped = 0;
    let futeikiRunning = 0;
    let futeikiStopped = 0;
    let shotInProgress = 0;
    let shotCompleted = 0;
    let totalWarnings = 0;
    let totalMissingIds = 0; // Regular running without ID (52)
    let totalShotMissingIds = 0; // Shot incomplete without ID
    let teikiRunningNoId = 0;
    let futeikiRunningNoId = 0;

    for (const a of ankens) {
      teikiRunning += a.teikiRunning;
      teikiStopped += a.teikiStopped;
      futeikiRunning += a.futeikiRunning;
      futeikiStopped += a.futeikiStopped;
      shotInProgress += a.shotInProgress;
      shotCompleted += a.shotCompleted;
      totalWarnings += a.warningCount;
      totalMissingIds += a.missingIdCount;
      totalShotMissingIds += (a.shotMissingIdCount || 0);
      teikiRunningNoId += (a.teikiRunningNoIdCount || 0);
      futeikiRunningNoId += (a.futeikiRunningNoIdCount || 0);
    }

    return {
      totalAnkens,
      teikiRunning,
      teikiStopped,
      futeikiRunning,
      futeikiStopped,
      shotInProgress,
      shotCompleted,
      totalWarnings,
      totalMissingIds,
      totalShotMissingIds,
      teikiRunningNoId,
      futeikiRunningNoId,
    };
  }, [ankens]);

  const filteredAnkens = useMemo(() => {
    let list = ankens.filter((a) => {
      const hasIssues = a.warningCount > 0 || a.missingIdCount > 0;
      if (filterType === 'needsAction' && !hasIssues) return false;
      if (filterType === 'normal' && hasIssues) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = a.canonicalName.toLowerCase().includes(q);
        const matchRaw = a.rawNames.some((n) => n.toLowerCase().includes(q));
        const matchUser = a.assignees.some((u) => u.toLowerCase().includes(q));
        if (!matchName && !matchRaw && !matchUser) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      const aAnomalies = a.warningCount * 10 + a.missingIdCount;
      const bAnomalies = b.warningCount * 10 + b.missingIdCount;
      if (bAnomalies !== aAnomalies) {
        return bAnomalies - aAnomalies;
      }
      return a.canonicalName.localeCompare(b.canonicalName);
    });

    return list;
  }, [ankens, filterType, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredAnkens.length / pageSize));
  const paginatedAnkens = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAnkens.slice(start, start + pageSize);
  }, [filteredAnkens, currentPage, pageSize]);

  const countNeedsAction = ankens.filter((a) => a.warningCount > 0 || a.missingIdCount > 0).length;
  const countNormal = ankens.length - countNeedsAction;

  return (
    <div className="space-y-6">
      {/* 1. Global Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Ankens */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>案件数</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {totals.totalAnkens}件
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">管理中のクライアント</p>
        </div>

        {/* Teiki */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>定期（スケジュール）</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">
              {totals.teikiRunning}件
            </span>
            <span className="text-xs text-zinc-400">稼働</span>
            <span className="text-zinc-600">/</span>
            <span className="text-sm font-semibold text-zinc-400">
              {totals.teikiStopped}件
            </span>
            <span className="text-[11px] text-zinc-400">停止</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">毎日・週次・月次</p>
        </div>

        {/* Futeiki */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>不定期</span>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-400">
              {totals.futeikiRunning}件
            </span>
            <span className="text-xs text-zinc-400">稼働</span>
            <span className="text-zinc-600">/</span>
            <span className="text-sm font-semibold text-zinc-400">
              {totals.futeikiStopped}件
            </span>
            <span className="text-[11px] text-zinc-400">停止</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">依頼ベース</p>
        </div>

        {/* Shot */}
        <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>ショット（単発）</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">
              {totals.shotInProgress}件
            </span>
            <span className="text-xs text-zinc-400">対応中</span>
            <span className="text-zinc-600">/</span>
            <span className="text-sm font-semibold text-emerald-400">
              {totals.shotCompleted}件
            </span>
            <span className="text-[11px] text-zinc-400">完了</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">別タブで管理</p>
        </div>

        {/* Warnings */}
        <div
          onClick={() => onNavigateToAttention && onNavigateToAttention('warnings')}
          className="bg-zinc-900/90 border border-zinc-800 hover:border-rose-700/60 p-4 rounded-xl shadow-sm cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>要確認</span>
            <AlertTriangle className="w-4 h-4 text-rose-400 group-hover:animate-bounce" />
          </div>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            {totals.totalWarnings}件
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">スケジュール不整合</p>
        </div>

        {/* Missing DYMTASK ID (Regular Running: 52) */}
        <div
          onClick={() => onNavigateToAttention && onNavigateToAttention('runningNoId')}
          className="bg-zinc-900/90 border border-zinc-800 hover:border-amber-700/60 p-4 rounded-xl shadow-sm cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>ID未設定（稼働中）</span>
            <AlertCircle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-400 tracking-tight">
            {totals.totalMissingIds}件
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            定期 {totals.teikiRunningNoId}件 + 不定期 {totals.futeikiRunningNoId}件
          </p>
        </div>

        {/* Missing DYMTASK ID (Shot incomplete) */}
        <div
          onClick={() => onNavigateToAttention && onNavigateToAttention('shotNoId')}
          className="bg-zinc-900/90 border border-zinc-800 hover:border-indigo-700/60 p-4 rounded-xl shadow-sm cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>ショット未完了・ID未設定</span>
            <Layers className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-indigo-400 tracking-tight">
            {totals.totalShotMissingIds}件
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">単発・未完了タスク</p>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => {
              setFilterType('all');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterType === 'all'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            すべて（{ankens.length}件）
          </button>
          <button
            onClick={() => {
              setFilterType('needsAction');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              filterType === 'needsAction'
                ? 'bg-rose-950/80 text-rose-300 font-semibold border border-rose-800/80 shadow-sm'
                : 'text-zinc-400 hover:text-rose-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            要対応（{countNeedsAction}件）
          </button>
          <button
            onClick={() => {
              setFilterType('normal');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterType === 'normal'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            正常（{countNormal}件）
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="会社名・担当者で検索"
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value={15}>15件</option>
            <option value={25}>25件</option>
            <option value={50}>50件</option>
            <option value={100}>100件</option>
          </select>
        </div>
      </div>

      {/* 3. Main Anken Management Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-medium">
                <th className="py-3 px-4">案件名（会社名）・対応者</th>
                <th className="py-3 px-4">稼働/停止の割合</th>
                <th className="py-3 px-3 text-center">定期（稼働 / 停止）</th>
                <th className="py-3 px-3 text-center">不定期（稼働 / 停止）</th>
                <th className="py-3 px-3 text-center">ショット（対応中 / 完了）</th>
                <th className="py-3 px-3">直近の停止日</th>
                <th className="py-3 px-3 text-center">例外</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {paginatedAnkens.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    {ankens.length === 0
                      ? 'データがありません。「CSV読み込み」または「サンプルデータ」を押してください。'
                      : '条件に一致する案件が見つかりません。'}
                  </td>
                </tr>
              ) : (
                paginatedAnkens.map((anken) => {
                  const hasAnomaly = anken.warningCount > 0 || anken.missingIdCount > 0;
                  const totalRunning = anken.teikiRunning + anken.futeikiRunning + anken.shotInProgress;
                  const totalStopped = anken.teikiStopped + anken.futeikiStopped + anken.shotCompleted;
                  const totalAll = totalRunning + totalStopped;
                  const runningPercent = totalAll > 0 ? (totalRunning / totalAll) * 100 : 0;

                  return (
                    <tr
                      key={anken.canonicalName}
                      onClick={() => onSelectAnken(anken)}
                      className={`cursor-pointer transition-colors hover:bg-zinc-800/40 ${
                        hasAnomaly ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Company Name & Assignee */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {hasAnomaly && (
                            <span
                              title={`要確認: ${anken.warningCount}件、ID未設定: ${anken.missingIdCount}件`}
                              className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse"
                            />
                          )}
                          <div className="font-semibold text-zinc-100 hover:text-indigo-300 transition-colors">
                            {anken.canonicalName}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                          <Users className="w-3 h-3 text-zinc-400" />
                          <span>{anken.assignees.join(', ') || '担当者未設定'}</span>
                        </div>
                      </td>

                      {/* Mini Bar */}
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-emerald-400 font-medium">
                            {totalRunning}件 稼働
                          </span>
                          <span className="text-zinc-400">
                            {totalStopped}件 停止/完了
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${runningPercent}%` }}
                          />
                          <div
                            className="bg-zinc-600 h-full transition-all duration-300"
                            style={{ width: `${100 - runningPercent}%` }}
                          />
                        </div>
                      </td>

                      {/* Teiki */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-emerald-400">
                          {anken.teikiRunning}件
                        </span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="font-medium text-zinc-400">
                          {anken.teikiStopped}件
                        </span>
                      </td>

                      {/* Futeiki */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-blue-400">
                          {anken.futeikiRunning}件
                        </span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="font-medium text-zinc-400">
                          {anken.futeikiStopped}件
                        </span>
                      </td>

                      {/* Shot */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-amber-400">
                          {anken.shotInProgress}件
                        </span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="font-medium text-emerald-400">
                          {anken.shotCompleted}件
                        </span>
                      </td>

                      {/* Latest Stop Date */}
                      <td className="py-3.5 px-3 text-zinc-400 text-[11px]">
                        {anken.latestStopDate ? (
                          <span className="text-rose-400 font-medium">
                            {anken.latestStopDate}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Anomalies Badge */}
                      <td className="py-3.5 px-3 text-center">
                        {hasAnomaly ? (
                          <div className="inline-flex items-center gap-1.5">
                            {anken.warningCount > 0 && (
                              <span
                                title={`スケジュール警告 ${anken.warningCount}件`}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80"
                              >
                                {anken.warningCount}件 要確認
                              </span>
                            )}
                            {anken.missingIdCount > 0 && (
                              <span
                                title={`稼働中ID未設定タスク ${anken.missingIdCount}件`}
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80"
                              >
                                {anken.missingIdCount}件 未設定
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAnken(anken);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        >
                          詳細
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination (Japanese) */}
        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <div>
            {filteredAnkens.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}〜
            {Math.min(currentPage * pageSize, filteredAnkens.length)}件を表示（全{filteredAnkens.length}件）
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              {currentPage} / {totalPages} ページ
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 text-zinc-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
