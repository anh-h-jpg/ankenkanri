import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Download,
  ExternalLink,
  Search,
} from 'lucide-react';
import { AppSettings, BaseRegistryTask } from '../types';

interface NeedAttentionViewProps {
  tasks: BaseRegistryTask[];
  settings: AppSettings;
}

export const NeedAttentionView: React.FC<NeedAttentionViewProps> = ({
  tasks,
  settings,
}) => {
  const [subTab, setSubTab] = useState<'missingId' | 'warnings'>('missingId');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');

  // ID未設定かつ稼働中タスク（ショットは完了以外）
  const missingIdTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.dymTaskId) return false;
      if (t.sourceTab === 'ショット') {
        return t.status !== '完了';
      } else {
        return t.status === '稼働中';
      }
    });
  }, [tasks]);

  // 警告あり（要確認）タスク
  const warningTasks = useMemo(() => {
    return tasks.filter((t) => Boolean(t.warningNotice));
  }, [tasks]);

  const companies = useMemo(() => {
    const set = new Set<string>();
    const currentList = subTab === 'missingId' ? missingIdTasks : warningTasks;
    for (const t of currentList) {
      if (t.companyName) set.add(t.companyName);
    }
    return Array.from(set).sort();
  }, [subTab, missingIdTasks, warningTasks]);

  const currentFilteredList = useMemo(() => {
    const list = subTab === 'missingId' ? missingIdTasks : warningTasks;
    return list.filter((t) => {
      if (selectedCompany !== 'all' && t.companyName !== selectedCompany) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = t.taskName.toLowerCase().includes(q);
        const matchComp = t.companyName.toLowerCase().includes(q);
        const matchUser = (t.assignee || '').toLowerCase().includes(q);
        if (!matchName && !matchComp && !matchUser) return false;
      }
      return true;
    });
  }, [subTab, missingIdTasks, warningTasks, selectedCompany, searchTerm]);

  const handleExportCsv = () => {
    if (currentFilteredList.length === 0) return;

    if (subTab === 'missingId') {
      const headers = [
        'シート行番号',
        'タブ名',
        '案件名（会社名）',
        'タスク名',
        'ステータス',
        '対応者',
        '想定工数(分)',
        '対応内容',
      ];
      const rows = currentFilteredList.map((t) => [
        t.originalRowNumber,
        t.sourceTab,
        `"${t.companyName.replace(/"/g, '""')}"`,
        `"${t.taskName.replace(/"/g, '""')}"`,
        t.status,
        `"${(t.assignee || '').replace(/"/g, '""')}"`,
        t.estimatedMinutes !== null ? `${t.estimatedMinutes}分` : '—',
        'DYMTASK ID（6桁数字）の追記が必要',
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      downloadCsv(csv, `dymtask_id_misettei_ichiran_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`);
    } else {
      const headers = [
        'シート行番号',
        'タブ名',
        '案件名（会社名）',
        'タスク名',
        '頻度',
        '曜日詳細',
        'ステータス',
        '対応者',
        '警告内容（注意）',
      ];
      const rows = currentFilteredList.map((t) => [
        t.originalRowNumber,
        t.sourceTab,
        `"${t.companyName.replace(/"/g, '""')}"`,
        `"${t.taskName.replace(/"/g, '""')}"`,
        `"${(t.frequency || '').replace(/"/g, '""')}"`,
        `"${(t.dayDetail || '').replace(/"/g, '""')}"`,
        t.status,
        `"${(t.assignee || '').replace(/"/g, '""')}"`,
        `"${(t.warningNotice || '').replace(/"/g, '""')}"`,
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      downloadCsv(csv, `yo_kakunin_schedule_keikoku_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`);
    }
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSheetLink = (task: BaseRegistryTask) => {
    const isShot = task.sourceTab === 'ショット';
    const bookId = isShot ? settings.shotBookId : settings.kyujinBookId;
    const gid = isShot ? settings.shotGid : settings.kyujinGid;
    return `https://docs.google.com/spreadsheets/d/${bookId}/edit#gid=${gid}&range=${task.originalRowNumber}:${task.originalRowNumber}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>要確認・ID未設定</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            GoogleスプレッドシートへのDYMTASK ID追記またはスケジュール修正が必要なタスク一覧
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => {
              setSubTab('missingId');
              setSelectedCompany('all');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === 'missingId'
                ? 'bg-amber-950/80 text-amber-300 font-semibold border border-amber-800/80 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>ID未設定（{missingIdTasks.length}件）</span>
          </button>

          <button
            onClick={() => {
              setSubTab('warnings');
              setSelectedCompany('all');
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === 'warnings'
                ? 'bg-rose-950/80 text-rose-300 font-semibold border border-rose-800/80 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>要確認（{warningTasks.length}件）</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar & Export */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Company filter */}
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">全案件（{companies.length}社）</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="タスク名・担当者で検索"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          disabled={currentFilteredList.length === 0}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>CSV出力</span>
        </button>
      </div>

      {/* 3. Table of Tasks */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-medium">
                <th className="py-2.5 px-3">シート行</th>
                <th className="py-2.5 px-3">元タブ</th>
                <th className="py-2.5 px-3">案件名（会社名）</th>
                <th className="py-2.5 px-3">タスク名</th>
                {subTab === 'warnings' ? (
                  <>
                    <th className="py-2.5 px-3">頻度</th>
                    <th className="py-2.5 px-3">曜日詳細</th>
                    <th className="py-2.5 px-3">警告内容（注意）</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3">ステータス</th>
                    <th className="py-2.5 px-3">想定工数</th>
                    <th className="py-2.5 px-3">ID状況</th>
                  </>
                )}
                <th className="py-2.5 px-3">対応者</th>
                <th className="py-2.5 px-3 text-right">シートリンク</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {currentFilteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    {subTab === 'missingId'
                      ? '稼働中でDYMTASK IDが未設定のタスクはありません。'
                      : 'スケジュール設定に不整合のあるタスクはありません。'}
                  </td>
                </tr>
              ) : (
                currentFilteredList.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    {/* Original Row Number */}
                    <td className="py-3 px-3 font-mono font-bold text-zinc-300">
                      行 {task.originalRowNumber}
                    </td>

                    {/* Source Tab */}
                    <td className="py-3 px-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {task.sourceTab}
                      </span>
                    </td>

                    {/* Company */}
                    <td className="py-3 px-3 font-semibold text-zinc-100">
                      {task.companyName}
                    </td>

                    {/* Task Name */}
                    <td className="py-3 px-3 text-zinc-300 max-w-xs truncate" title={task.taskName}>
                      {task.taskName}
                    </td>

                    {subTab === 'warnings' ? (
                      <>
                        <td className="py-3 px-3 text-zinc-300 font-mono">
                          {task.frequency || '—'}
                        </td>
                        <td className="py-3 px-3 text-zinc-300 font-mono">
                          {task.dayDetail || '—'}
                        </td>
                        <td className="py-3 px-3 text-rose-300 font-medium">
                          {task.warningNotice}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/60">
                            {task.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-400 font-mono">
                          {task.estimatedMinutes !== null ? `${task.estimatedMinutes}分` : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                            DYMTASK ID未設定
                          </span>
                        </td>
                      </>
                    )}

                    {/* Assignee */}
                    <td className="py-3 px-3 text-zinc-300">
                      {task.assignee || '担当者未設定'}
                    </td>

                    {/* Sheet link */}
                    <td className="py-3 px-3 text-right">
                      <a
                        href={getSheetLink(task)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-800/70 hover:bg-indigo-900/60 transition-colors"
                      >
                        <span>シートの該当行を開く</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
