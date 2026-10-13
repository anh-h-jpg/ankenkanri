import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { AnkenSummary, AppSettings, BaseRegistryTask } from '../types';

interface AnkenDetailModalProps {
  anken: AnkenSummary | null;
  onClose: () => void;
  settings: AppSettings;
}

export const AnkenDetailModal: React.FC<AnkenDetailModalProps> = ({
  anken,
  onClose,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'teiki' | 'futeiki' | 'shot'>('teiki');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!anken) return null;

  const getSheetLink = (task: BaseRegistryTask) => {
    if (!task.dymTaskId) return null;
    const isShot = task.sourceTab === 'ショット';
    const bookId = isShot ? settings.shotBookId : settings.kyujinBookId;
    const gid = isShot ? settings.shotGid : settings.kyujinGid;
    return `https://docs.google.com/spreadsheets/d/${bookId}/edit#gid=${gid}&range=${task.originalRowNumber}:${task.originalRowNumber}`;
  };

  const teikiTasks = anken.tasks.filter((t) => t.taskType === '定期');
  const futeikiTasks = anken.tasks.filter((t) => t.taskType === '不定期');
  const shotTasks = anken.tasks.filter((t) => t.taskType === 'ショット');

  const currentTabTasks =
    activeTab === 'teiki'
      ? teikiTasks
      : activeTab === 'futeiki'
      ? futeikiTasks
      : shotTasks;

  const filteredTasks = currentTabTasks.filter((t) => {
    if (activeTab !== 'shot') {
      if (statusFilter === 'running' && t.status !== '稼働中') return false;
      if (statusFilter === 'stopped' && t.status !== '停止中') return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = (t.taskName || '').toLowerCase().includes(q);
      const matchId = (t.dymTaskId || '').includes(q);
      const matchUser = (t.assignee || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchUser) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-950/60 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Building2 className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-zinc-100">{anken.canonicalName}</h2>
              {anken.rawNames.length > 1 && (
                <span className="text-xs text-zinc-400">
                  （統合元：{anken.rawNames.join('、')}）
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <span>
                対応者：<b className="text-zinc-200">{anken.assignees.join('、') || '担当者未設定'}</b>
              </span>
              <span>•</span>
              <span>
                総タスク数：<b className="text-zinc-200">{anken.totalTasks}件</b>
              </span>
              {anken.latestStopDate && (
                <>
                  <span>•</span>
                  <span>
                    直近の停止日：<b className="text-rose-400">{anken.latestStopDate}</b>
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mini stats cards */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-zinc-900/90 border-b border-zinc-800 text-xs">
          <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
            <div className="text-zinc-400 font-medium mb-1">定期（スケジュール）</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-emerald-400">{anken.teikiRunning}件</span>
              <span className="text-zinc-500">稼働</span>
              <span className="text-zinc-600">/</span>
              <span className="text-sm font-semibold text-zinc-400">{anken.teikiStopped}件</span>
              <span className="text-zinc-500">停止</span>
            </div>
          </div>

          <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
            <div className="text-zinc-400 font-medium mb-1">不定期（依頼ベース）</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-blue-400">{anken.futeikiRunning}件</span>
              <span className="text-zinc-500">稼働</span>
              <span className="text-zinc-600">/</span>
              <span className="text-sm font-semibold text-zinc-400">{anken.futeikiStopped}件</span>
              <span className="text-zinc-500">停止</span>
            </div>
          </div>

          <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
            <div className="text-zinc-400 font-medium mb-1">ショット（単発）</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-amber-400">{anken.shotInProgress}件</span>
              <span className="text-zinc-500">対応中</span>
              <span className="text-zinc-600">/</span>
              <span className="text-sm font-semibold text-emerald-400">{anken.shotCompleted}件</span>
              <span className="text-zinc-500">完了</span>
            </div>
          </div>
        </div>

        {/* Tabs and Filters */}
        <div className="p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => {
                setActiveTab('teiki');
                setStatusFilter('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'teiki'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              定期（{teikiTasks.length}件）
            </button>
            <button
              onClick={() => {
                setActiveTab('futeiki');
                setStatusFilter('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'futeiki'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              不定期（{futeikiTasks.length}件）
            </button>
            <button
              onClick={() => {
                setActiveTab('shot');
                setStatusFilter('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'shot'
                  ? 'bg-zinc-800 text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ショット（{shotTasks.length}件）
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'shot' && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-zinc-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> 絞り込み：
                </span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-zinc-700 text-white font-medium'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  すべて
                </button>
                <button
                  onClick={() => setStatusFilter('running')}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    statusFilter === 'running'
                      ? 'bg-emerald-950/80 text-emerald-300 font-medium border border-emerald-800/80'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  稼働中
                </button>
                <button
                  onClick={() => setStatusFilter('stopped')}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                    statusFilter === 'stopped'
                      ? 'bg-rose-950/80 text-rose-300 font-medium border border-rose-800/80'
                      : 'text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  停止中
                </button>
              </div>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ID・タスク名・担当者で検索"
                className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-52"
              />
            </div>
          </div>
        </div>

        {/* Task Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-950/40">
                <th className="py-2.5 px-3 font-medium">DYMTASK ID</th>
                <th className="py-2.5 px-3 font-medium">タスク名</th>
                {activeTab !== 'shot' ? (
                  <>
                    <th className="py-2.5 px-3 font-medium">頻度</th>
                    <th className="py-2.5 px-3 font-medium">曜日詳細</th>
                  </>
                ) : (
                  <th className="py-2.5 px-3 font-medium">記載日</th>
                )}
                <th className="py-2.5 px-3 font-medium">想定工数</th>
                <th className="py-2.5 px-3 font-medium">{activeTab === 'shot' ? '担当' : '対応者'}</th>
                <th className="py-2.5 px-3 font-medium">ステータス</th>
                {activeTab !== 'shot' && <th className="py-2.5 px-3 font-medium">停止日</th>}
                <th className="py-2.5 px-3 font-medium text-right">シートリンク</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-zinc-500">
                    該当するタスクがありません。
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const sheetLink = getSheetLink(task);

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      {/* ID */}
                      <td className="py-3 px-3">
                        {task.dymTaskId ? (
                          <span className="font-mono font-bold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/60">
                            {task.dymTaskId}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50">
                            DYMTASK ID未設定
                          </span>
                        )}
                      </td>

                      {/* Task Name */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-zinc-200 max-w-xs truncate" title={task.taskName}>
                          {task.taskName}
                        </div>
                        {task.warningNotice && (
                          <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{task.warningNotice}</span>
                          </div>
                        )}
                        {task.isInferredFrequency && (
                          <div className="text-[10px] text-cyan-400 italic mt-0.5">
                            頻度空欄: 曜日詳細より判定
                          </div>
                        )}
                      </td>

                      {/* Frequency / Day details or Record Date */}
                      {activeTab !== 'shot' ? (
                        <>
                          <td className="py-3 px-3 text-zinc-300">
                            {task.frequency || '—'}
                          </td>
                          <td className="py-3 px-3 text-zinc-300 font-mono text-[11px]">
                            {task.dayDetail || '—'}
                          </td>
                        </>
                      ) : (
                        <td className="py-3 px-3 text-zinc-400">
                          {task.recordDate || '—'}
                        </td>
                      )}

                      {/* Estimated time */}
                      <td className="py-3 px-3 text-zinc-300">
                        {task.estimatedMinutes !== null ? `${task.estimatedMinutes}分` : '—'}
                      </td>

                      {/* Assignee */}
                      <td className="py-3 px-3 text-zinc-300">
                        {task.assignee || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {task.status === '稼働中' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            稼働中
                          </span>
                        )}
                        {task.status === '停止中' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-300 bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            停止中
                          </span>
                        )}
                        {task.status === '完了' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            完了
                          </span>
                        )}
                        {task.status !== '稼働中' && task.status !== '停止中' && task.status !== '完了' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/50">
                            {task.rawStatus || task.status}
                          </span>
                        )}
                      </td>

                      {/* Stop Date */}
                      {activeTab !== 'shot' && (
                        <td className="py-3 px-3 text-zinc-400">
                          {task.stopDate ? (
                            <div>
                              <span className="text-rose-400 font-medium">{task.stopDate}</span>
                              {task.stopDateSource === 'snapshot' && (
                                <span className="block text-[10px] text-zinc-500">
                                  {task.stopDate} からの停止を検知
                                </span>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}

                      {/* Sheet link / Missing label */}
                      <td className="py-3 px-3 text-right">
                        {sheetLink ? (
                          <a
                            href={sheetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-800/70 hover:bg-indigo-900/60 transition-colors"
                          >
                            <span>シートの該当行を開く</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-zinc-500 italic">
                            行 {task.originalRowNumber}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <span>
            {filteredTasks.length}件 / 全{currentTabTasks.length}件を表示中
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
