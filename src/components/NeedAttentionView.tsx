import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Filter,
  Layers,
  Search,
} from 'lucide-react';
import { AppSettings, BaseRegistryTask } from '../types';

interface NeedAttentionViewProps {
  tasks: BaseRegistryTask[];
  settings: AppSettings;
  initialGroup?: 'runningNoId' | 'shotNoId' | 'warnings';
}

export const NeedAttentionView: React.FC<NeedAttentionViewProps> = ({
  tasks,
  settings,
  initialGroup = 'runningNoId',
}) => {
  const [subTab, setSubTab] = useState<'runningNoId' | 'shotNoId' | 'warnings'>(initialGroup);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [warningReasonFilter, setWarningReasonFilter] = useState<'all' | 'MISMATCH' | 'EMPTY_FREQ' | 'UNKNOWN_FREQ'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sheetWarningMsg, setSheetWarningMsg] = useState<string | null>(null);

  // Group 1: 定期・不定期 稼働中かつID未設定 (Expected: 52 = 11 定期 + 41 不定期)
  const runningNoIdTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.dymTaskId) return false;
      if (t.sourceTab === 'ショット') return false; // ショットは除外
      return t.status === '稼働中';
    });
  }, [tasks]);

  const teikiCount = useMemo(() => runningNoIdTasks.filter((t) => t.taskType === '定期').length, [runningNoIdTasks]);
  const futeikiCount = useMemo(() => runningNoIdTasks.filter((t) => t.taskType === '不定期').length, [runningNoIdTasks]);

  // Group 2: ショット未完了かつID未設定
  const shotNoIdTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.dymTaskId) return false;
      if (t.sourceTab !== 'ショット') return false;
      return t.status !== '完了';
    });
  }, [tasks]);

  // Group 3: スケジュール不整合（要確認）
  const warningTasks = useMemo(() => {
    return tasks.filter((t) => Boolean(t.warningNotice));
  }, [tasks]);

  // Warning reason breakdown statistics
  const warningStats = useMemo(() => {
    let mismatch = 0;
    let emptyFreq = 0;
    let unknown = 0;
    for (const t of warningTasks) {
      if (t.warningCategory === 'EMPTY_FREQ') {
        emptyFreq++;
      } else if (t.warningCategory === 'UNKNOWN_FREQ') {
        unknown++;
      } else {
        mismatch++;
      }
    }
    return {
      mismatch,
      emptyFreq,
      unknown,
      total: warningTasks.length,
    };
  }, [warningTasks]);

  // Get current active list based on active tab
  const currentList = useMemo(() => {
    if (subTab === 'runningNoId') return runningNoIdTasks;
    if (subTab === 'shotNoId') return shotNoIdTasks;
    return warningTasks;
  }, [subTab, runningNoIdTasks, shotNoIdTasks, warningTasks]);

  const companies = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < currentList.length; i++) {
      if (currentList[i].companyName) set.add(currentList[i].companyName);
    }
    return Array.from(set).sort();
  }, [currentList]);

  const filteredTasks = useMemo(() => {
    return currentList.filter((t) => {
      if (selectedCompany !== 'all' && t.companyName !== selectedCompany) return false;
      if (subTab === 'warnings' && warningReasonFilter !== 'all') {
        if (t.warningCategory !== warningReasonFilter) return false;
      }
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = t.taskName.toLowerCase().includes(q);
        const matchComp = t.companyName.toLowerCase().includes(q);
        const matchUser = (t.assignee || '').toLowerCase().includes(q);
        if (!matchName && !matchComp && !matchUser) return false;
      }
      return true;
    });
  }, [currentList, selectedCompany, subTab, warningReasonFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

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

  const handleExportCsv = () => {
    if (filteredTasks.length === 0) return;
    const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    if (subTab === 'runningNoId') {
      const headers = [
        'シート行番号',
        '種別',
        'タブ名',
        '案件名（会社名）',
        'タスク名',
        '頻度',
        '曜日詳細',
        'ステータス',
        '対応者',
        '想定工数(分)',
        '対応要件',
      ];
      const rows = filteredTasks.map((t) => [
        t.originalRowNumber,
        t.taskType,
        t.sourceTab,
        `"${t.companyName.replace(/"/g, '""')}"`,
        `"${t.taskName.replace(/"/g, '""')}"`,
        `"${(t.frequency || '').replace(/"/g, '""')}"`,
        `"${(t.dayDetail || '').replace(/"/g, '""')}"`,
        t.status,
        `"${(t.assignee || '').replace(/"/g, '""')}"`,
        t.estimatedMinutes !== null ? `${t.estimatedMinutes}分` : '—',
        'DYMTASK IDの付与が必要（定期・不定期 稼働中）',
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      downloadCsv(csv, `teiki_futeiki_kadochu_id_misettei_${nowStr}.csv`);
    } else if (subTab === 'shotNoId') {
      const headers = [
        'シート行番号',
        'タブ名',
        '案件名（会社名）',
        'タスク名',
        'ステータス',
        '対応者',
        '想定工数(分)',
        '記載日',
        '対応要件',
      ];
      const rows = filteredTasks.map((t) => [
        t.originalRowNumber,
        t.sourceTab,
        `"${t.companyName.replace(/"/g, '""')}"`,
        `"${t.taskName.replace(/"/g, '""')}"`,
        t.status,
        `"${(t.assignee || '').replace(/"/g, '""')}"`,
        t.estimatedMinutes !== null ? `${t.estimatedMinutes}分` : '—',
        t.recordDate || '—',
        'ショット未完了タスクのDYMTASK ID追記',
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      downloadCsv(csv, `shot_mikanryo_id_misettei_${nowStr}.csv`);
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
        '不整合理由区分',
        '警告内容詳細',
      ];
      const rows = filteredTasks.map((t) => [
        t.originalRowNumber,
        t.sourceTab,
        `"${t.companyName.replace(/"/g, '""')}"`,
        `"${t.taskName.replace(/"/g, '""')}"`,
        `"${(t.frequency || '').replace(/"/g, '""')}"`,
        `"${(t.dayDetail || '').replace(/"/g, '""')}"`,
        t.status,
        `"${(t.assignee || '').replace(/"/g, '""')}"`,
        `"${t.warningCategoryJa || '頻度と曜日詳細の不一致'}"`,
        `"${(t.warningNotice || '').replace(/"/g, '""')}"`,
      ]);
      const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      downloadCsv(csv, `yo_kakunin_schedule_fuseigo_${nowStr}.csv`);
    }
  };

  const getSheetLink = (task: BaseRegistryTask) => {
    const isShot = task.sourceTab === 'ショット';
    const bookId = isShot ? settings.shotBookId?.trim() : settings.kyujinBookId?.trim();
    const gid = isShot ? settings.shotGid?.trim() : settings.kyujinGid?.trim();
    if (!bookId || !gid) return null;
    return `https://docs.google.com/spreadsheets/d/${bookId}/edit#gid=${gid}&range=${task.originalRowNumber}:${task.originalRowNumber}`;
  };

  return (
    <div className="space-y-6">
      {sheetWarningMsg && (
        <div className="p-3 bg-amber-950/80 border border-amber-800 text-amber-200 text-xs rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{sheetWarningMsg}</span>
          </div>
          <button
            onClick={() => setSheetWarningMsg(null)}
            className="text-amber-400 hover:text-amber-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Header with 3 Tab Switchers */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>要確認・ID未設定</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            稼働中ID未設定タスク、ショット未完了タスク、スケジュール不整合の対比・一覧
          </p>
        </div>

        {/* 3 Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800 flex-wrap">
          {/* Tab 1: Running regular without ID (52) */}
          <button
            onClick={() => {
              setSubTab('runningNoId');
              setSelectedCompany('all');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === 'runningNoId'
                ? 'bg-amber-950/80 text-amber-300 font-semibold border border-amber-800/80 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>ID未設定（稼働中・{runningNoIdTasks.length}件）</span>
          </button>

          {/* Tab 2: Shot incomplete without ID */}
          <button
            onClick={() => {
              setSubTab('shotNoId');
              setSelectedCompany('all');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === 'shotNoId'
                ? 'bg-indigo-950/80 text-indigo-300 font-semibold border border-indigo-800/80 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>ショット未完了・ID未設定（{shotNoIdTasks.length}件）</span>
          </button>

          {/* Tab 3: Warnings (61) */}
          <button
            onClick={() => {
              setSubTab('warnings');
              setSelectedCompany('all');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              subTab === 'warnings'
                ? 'bg-rose-950/80 text-rose-300 font-semibold border border-rose-800/80 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>要確認（スケジュール・{warningTasks.length}件）</span>
          </button>
        </div>
      </div>

      {/* Subtab breakdown banner */}
      {subTab === 'runningNoId' && (
        <div className="bg-amber-950/30 border border-amber-900/60 p-3.5 rounded-xl text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>定期・不定期の稼働中タスク（合計 {runningNoIdTasks.length}件）:</strong> ショットは別枠管理となっており、本枠には定期 {teikiCount}件、不定期 {futeikiCount}件が含まれます。
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-mono">
              定期稼働: {teikiCount}件
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 font-mono">
              不定期稼働: {futeikiCount}件
            </span>
          </div>
        </div>
      )}

      {subTab === 'shotNoId' && (
        <div className="bg-indigo-950/30 border border-indigo-900/60 p-3.5 rounded-xl text-xs text-indigo-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>ショット（単発）未完了タスク（{shotNoIdTasks.length}件）:</strong> ステータスが「完了」以外で、DYMTASK IDが未入力のタスク一覧です。
          </span>
        </div>
      )}

      {/* Warning Breakdown Statistics Table (Req A.3) */}
      {subTab === 'warnings' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <Filter className="w-3.5 h-3.5 text-rose-400" />
              <span>要確認タスク 理由別統計（全{warningStats.total}件）</span>
            </div>
            <span className="text-[11px] text-zinc-400">クリックして絞り込み可能</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            {/* All */}
            <button
              onClick={() => {
                setWarningReasonFilter('all');
                setCurrentPage(1);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                warningReasonFilter === 'all'
                  ? 'bg-zinc-800 border-zinc-600 text-white shadow-sm'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="text-[11px] text-zinc-400">すべて（合計）</div>
              <div className="text-xl font-black text-zinc-100 mt-1 font-mono">{warningStats.total}件</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">全警告タスク</div>
            </button>

            {/* Mismatch */}
            <button
              onClick={() => {
                setWarningReasonFilter('MISMATCH');
                setCurrentPage(1);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                warningReasonFilter === 'MISMATCH'
                  ? 'bg-rose-950/40 border-rose-700 text-rose-200 shadow-sm'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="text-[11px] text-rose-400">頻度と曜日詳細の不一致</div>
              <div className="text-xl font-black text-rose-300 mt-1 font-mono">{warningStats.mismatch}件</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">不定期に曜日/週次に不定期</div>
            </button>

            {/* Empty Freq */}
            <button
              onClick={() => {
                setWarningReasonFilter('EMPTY_FREQ');
                setCurrentPage(1);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                warningReasonFilter === 'EMPTY_FREQ'
                  ? 'bg-amber-950/40 border-amber-700 text-amber-200 shadow-sm'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="text-[11px] text-amber-400">頻度空欄</div>
              <div className="text-xl font-black text-amber-300 mt-1 font-mono">{warningStats.emptyFreq}件</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">頻度・曜日詳細ともに未設定</div>
            </button>

            {/* Unknown Freq */}
            <button
              onClick={() => {
                setWarningReasonFilter('UNKNOWN_FREQ');
                setCurrentPage(1);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                warningReasonFilter === 'UNKNOWN_FREQ'
                  ? 'bg-orange-950/40 border-orange-700 text-orange-200 shadow-sm'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="text-[11px] text-orange-400">判定不可</div>
              <div className="text-xl font-black text-orange-300 mt-1 font-mono">{warningStats.unknown}件</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">頻度テキスト未定義</div>
            </button>
          </div>
        </div>
      )}

      {/* 2. Filter Bar & Separate CSV Export */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Company filter */}
          <select
            value={selectedCompany}
            onChange={(e) => {
              setSelectedCompany(e.target.value);
              setCurrentPage(1);
            }}
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
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="タスク名・担当者で検索"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>
        </div>

        {/* Separate Export Button for Each Group */}
        <button
          onClick={handleExportCsv}
          disabled={filteredTasks.length === 0}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>
            {subTab === 'runningNoId'
              ? 'CSV出力（定期/不定期ID未設定）'
              : subTab === 'shotNoId'
              ? 'CSV出力（ショット未完了ID未設定）'
              : 'CSV出力（要確認リスト）'}
          </span>
        </button>
      </div>

      {/* 3. Table of Tasks */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-medium">
                <th className="py-2.5 px-3">シート行</th>
                <th className="py-2.5 px-3">種別/元タブ</th>
                <th className="py-2.5 px-3">案件名（会社名）</th>
                <th className="py-2.5 px-3">タスク名</th>
                {subTab === 'warnings' ? (
                  <>
                    <th className="py-2.5 px-3">頻度</th>
                    <th className="py-2.5 px-3">曜日詳細</th>
                    <th className="py-2.5 px-3">理由区分</th>
                    <th className="py-2.5 px-3">警告内容（注意）</th>
                  </>
                ) : subTab === 'runningNoId' ? (
                  <>
                    <th className="py-2.5 px-3">頻度/曜日</th>
                    <th className="py-2.5 px-3">ステータス</th>
                    <th className="py-2.5 px-3">想定工数</th>
                    <th className="py-2.5 px-3">ID状況</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3">ステータス</th>
                    <th className="py-2.5 px-3">想定工数</th>
                    <th className="py-2.5 px-3">記載日</th>
                    <th className="py-2.5 px-3">ID状況</th>
                  </>
                )}
                <th className="py-2.5 px-3">対応者</th>
                <th className="py-2.5 px-3 text-right">シートリンク</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    {subTab === 'runningNoId'
                      ? '定期・不定期でDYMTASK IDが未設定の稼働中タスクはありません。'
                      : subTab === 'shotNoId'
                      ? 'ショットで未完了かつDYMTASK IDが未設定のタスクはありません。'
                      : 'スケジュール設定に不整合のあるタスクはありません。'}
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task) => {
                  const sheetLink = getSheetLink(task);
                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* Original Row Number */}
                      <td className="py-3 px-3 font-mono font-bold text-zinc-300">
                        行 {task.originalRowNumber}
                      </td>

                      {/* Source Tab & Type */}
                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          task.taskType === '定期'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : task.taskType === '不定期'
                            ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                            : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                        }`}>
                          {task.taskType}（{task.sourceTab}）
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
                          <td className="py-3 px-3">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {task.warningCategoryJa || '不一致'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-rose-300 font-medium">
                            {task.warningNotice}
                          </td>
                        </>
                      ) : subTab === 'runningNoId' ? (
                        <>
                          <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">
                            {task.frequency || '—'} / {task.dayDetail || '—'}
                          </td>
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
                      ) : (
                        <>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-800/60">
                              {task.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-zinc-400 font-mono">
                            {task.estimatedMinutes !== null ? `${task.estimatedMinutes}分` : '—'}
                          </td>
                          <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">
                            {task.recordDate || '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
                              DYMTASK ID未設定
                            </span>
                          </td>
                        </>
                      )}

                      {/* Assignee */}
                      <td className="py-3 px-3 text-zinc-300">
                        {task.assignee || '担当者未設定'}
                      </td>

                      {/* Sheet Link */}
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
                          <button
                            type="button"
                            aria-disabled="true"
                            onClick={() => {
                              setSheetWarningMsg('設定でBOOK_IDとGIDを入力してください');
                              setTimeout(() => setSheetWarningMsg(null), 5000);
                            }}
                            title="設定でBOOK_IDとGIDを入力してください"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-500 bg-zinc-900 border border-zinc-800 cursor-not-allowed opacity-50 hover:opacity-75 transition-colors"
                          >
                            <span>シートの該当行を開く</span>
                            <ExternalLink className="w-3 h-3 text-zinc-600" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Pagination */}
        <div className="p-4 bg-zinc-950/80 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span>
              {filteredTasks.length === 0
                ? '0件'
                : `${(currentPage - 1) * pageSize + 1}〜${Math.min(
                    currentPage * pageSize,
                    filteredTasks.length
                  )}件を表示（全${filteredTasks.length}件）`}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="ml-2 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs focus:outline-none"
            >
              <option value={15}>15件 / ページ</option>
              <option value={25}>25件 / ページ</option>
              <option value={50}>50件 / ページ</option>
              <option value={100}>100件 / ページ</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-zinc-300">
              {currentPage} / {totalPages} ページ
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
