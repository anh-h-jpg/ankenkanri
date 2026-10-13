import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { AppSettings, BaseRegistryTask, DymtaskSubtask } from '../types';
import {
  parseDymtaskListCsv,
  parseKyujinCsv,
  parseShotCsv,
} from '../utils/csvParser';
import { updateSnapshots } from '../utils/storage';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportShotTasks: (tasks: BaseRegistryTask[]) => void;
  onImportKyujinTasks: (tasks: BaseRegistryTask[]) => void;
  onImportDymtaskSubtasks: (subtasks: DymtaskSubtask[]) => void;
  settings: AppSettings;
  shotTasksCount: number;
  kyujinTasksCount: number;
  dymtaskSubtasksCount: number;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onImportShotTasks,
  onImportKyujinTasks,
  onImportDymtaskSubtasks,
  settings,
  shotTasksCount,
  kyujinTasksCount,
  dymtaskSubtasksCount,
}) => {
  const [activeTab, setActiveTab] = useState<'shot' | 'kyujin' | 'dymtask'>('shot');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    validRows: number;
    skippedRows: number;
    securityStripped: number;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setLastResult(null);
    setProgressMsg(`ファイル ${file.name} を読み込み中...`);

    try {
      const nowStr = new Date().toISOString().slice(0, 10);

      if (activeTab === 'shot') {
        setProgressMsg('ショット管理シートを解析中...');
        const res = await parseShotCsv(file, settings.companyMerges, settings.stopDateColumnName);

        const snapshotItems = res.data.map((t) => ({
          key: t.dymTaskId || t.id,
          status: t.status,
        }));
        const stopDateMap = await updateSnapshots(snapshotItems, nowStr);

        const enriched = res.data.map((t) => {
          const key = t.dymTaskId || t.id;
          if (!t.stopDate && stopDateMap.has(key)) {
            return {
              ...t,
              stopDate: stopDateMap.get(key)!,
              stopDateSource: 'snapshot' as const,
            };
          }
          return t;
        });

        onImportShotTasks(enriched);
        setLastResult({
          success: true,
          validRows: res.validRows,
          skippedRows: res.skippedRows,
          securityStripped: res.securityStrippedColumnsCount,
          message: `ショットタスク ${res.validRows.toLocaleString()}件を読み込みました。`,
        });
      } else if (activeTab === 'kyujin') {
        setProgressMsg('求人依頼表を解析中...');
        const res = await parseKyujinCsv(file, settings.companyMerges, settings.stopDateColumnName);

        const snapshotItems = res.data.map((t) => ({
          key: t.dymTaskId || t.id,
          status: t.status,
        }));
        const stopDateMap = await updateSnapshots(snapshotItems, nowStr);

        const enriched = res.data.map((t) => {
          const key = t.dymTaskId || t.id;
          if (!t.stopDate && stopDateMap.has(key)) {
            return {
              ...t,
              stopDate: stopDateMap.get(key)!,
              stopDateSource: 'snapshot' as const,
            };
          }
          return t;
        });

        onImportKyujinTasks(enriched);
        setLastResult({
          success: true,
          validRows: res.validRows,
          skippedRows: res.skippedRows,
          securityStripped: res.securityStrippedColumnsCount,
          message: `求人依頼表タスク ${res.validRows.toLocaleString()}件を読み込みました。`,
        });
      } else {
        setProgressMsg('dym_todo_list を解析中...');
        const res = await parseDymtaskListCsv(file);
        onImportDymtaskSubtasks(res.data);
        setLastResult({
          success: true,
          validRows: res.validRows,
          skippedRows: res.skippedRows,
          securityStripped: 0,
          message: `Dymtaskサブタスク ${res.validRows.toLocaleString()}件を読み込みました。`,
        });
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      setLastResult({
        success: false,
        validRows: 0,
        skippedRows: 0,
        securityStripped: 0,
        message: `読み込みエラー: ${err.message || 'CSVの解析に失敗しました'}`,
      });
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                CSVデータ読み込み（Googleスプレッドシート連携）
              </h2>
              <p className="text-xs text-zinc-400">
                ショット、求人依頼表、およびdym_todo_listの3ファイルに対応
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Alert Badge */}
        <div className="mx-5 mt-4 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-emerald-200">
              ID/PW保護：
            </span>{' '}
            <code className="bg-emerald-900/60 px-1 py-0.5 rounded text-emerald-200 font-mono">アイパス（ID + PW）</code> 列は
            読み込み時にメモリから即座に破棄されます。外部サーバーへの送信やローカルストレージへの保存は一切行われません。
          </div>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 gap-2 px-5 mt-4">
          <button
            onClick={() => {
              setActiveTab('shot');
              setLastResult(null);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTab === 'shot'
                ? 'bg-zinc-800/90 border-indigo-500 shadow-sm'
                : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-zinc-200">File A: ショット</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                {shotTasksCount}件
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">単発タスク（約11,000行）</p>
          </button>

          <button
            onClick={() => {
              setActiveTab('kyujin');
              setLastResult(null);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTab === 'kyujin'
                ? 'bg-zinc-800/90 border-indigo-500 shadow-sm'
                : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-zinc-200">File B: 求人依頼表</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                {kyujinTasksCount}件
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">定期・不定期（約1,500行）</p>
          </button>

          <button
            onClick={() => {
              setActiveTab('dymtask');
              setLastResult(null);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTab === 'dymtask'
                ? 'bg-zinc-800/90 border-indigo-500 shadow-sm'
                : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-zinc-200">dym_todo_list</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                {dymtaskSubtasksCount}件
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Dymtask検証・不正検知</p>
          </button>
        </div>

        {/* Upload Zone */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              loading
                ? 'border-indigo-500/50 bg-indigo-950/10 cursor-wait'
                : 'border-zinc-700 hover:border-indigo-500 hover:bg-zinc-800/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-indigo-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>

            <p className="text-sm font-medium text-zinc-200 mb-1">
              CSVファイルをここにドラッグ＆ドロップ、または <span className="text-indigo-400 underline">ファイルを選択</span>
            </p>
            <p className="text-xs text-zinc-400">
              フォーマット：1〜2行目は説明文、3行目はヘッダー、4行目以降がデータ
            </p>
          </div>

          {loading && (
            <div className="p-3 bg-indigo-950/30 border border-indigo-800/50 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              <span>{progressMsg}</span>
            </div>
          )}

          {lastResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                lastResult.success
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
              }`}
            >
              {lastResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold text-zinc-200">{lastResult.message}</p>
                {lastResult.success && (
                  <div className="flex gap-4 text-[11px] text-zinc-400">
                    <span>有効行：<b className="text-emerald-300">{lastResult.validRows}件</b></span>
                    <span>スキップ/空行：<b className="text-zinc-300">{lastResult.skippedRows}件</b></span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            案件名の正規化と6桁のDYMTASK IDを自動抽出します
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
