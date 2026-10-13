import React from 'react';
import {
  Building2,
  CheckCircle2,
  FileCheck2,
  Moon,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sun,
  TestTube2,
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'overview' | 'audit' | 'attention' | 'settings';
  setActiveTab: (tab: 'overview' | 'audit' | 'attention' | 'settings') => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onOpenUpload: () => void;
  onLoadSample: () => void;
  shotCount: number;
  kyujinCount: number;
  dymtaskCount: number;
  warningCount: number;
  missingIdCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isDarkMode,
  setIsDarkMode,
  onOpenUpload,
  onLoadSample,
  shotCount,
  kyujinCount,
  dymtaskCount,
  warningCount,
  missingIdCount,
}) => {
  const totalAnomalies = warningCount + missingIdCount;

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur bg-zinc-950/90 border-zinc-800 text-zinc-100 transition-colors dark:bg-zinc-950/90 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-xl">
              案
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  案件管理
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                    求人更新 BPO
                  </span>
                </h1>
                <div
                  title="ID/PW保護：CSV読み込み時にアイパス（ID + PW）列を即時完全破棄（メモリ・外部送信なし）"
                  className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">ID/PW保護</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400">
                案件タスク管理とDymtask不正チェック
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Pure Japanese) */}
          <nav className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>案件一覧</span>
              {(shotCount > 0 || kyujinCount > 0) && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-700 text-zinc-300">
                  {shotCount + kyujinCount}件
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'audit'
                  ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Dymtask検証</span>
              {dymtaskCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/30">
                  {dymtaskCount}件
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('attention')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                activeTab === 'attention'
                  ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>要確認・ID未設定</span>
              {totalAnomalies > 0 && (
                <span className="flex items-center justify-center text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse">
                  {totalAnomalies}件
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>設定</span>
            </button>
          </nav>

          {/* Action buttons & Theme toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={onLoadSample}
              title="検証用の全パターン網羅サンプルデータを読み込みます"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-800/60 hover:bg-amber-900/40 transition-colors"
            >
              <TestTube2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">サンプルデータ</span>
            </button>

            <button
              onClick={onOpenUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40 shadow-sm transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>CSV読み込み</span>
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'ライトモードに切替' : 'ダークモードに切替'}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border border-zinc-800 transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
