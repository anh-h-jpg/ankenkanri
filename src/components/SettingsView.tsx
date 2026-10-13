import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  Link,
  Play,
  Plus,
  Save,
  Sliders,
  TestTube,
  Trash2,
} from 'lucide-react';
import { AppSettings } from '../types';
import { parseGoogleSheetUrl } from '../utils/normalize';
import { clearSnapshots } from '../utils/storage';
import { runPureFunctionTests, TestResult } from '../utils/testSuite';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClearAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onClearAllData,
}) => {
  const [form, setForm] = useState<AppSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newAliasFrom, setNewAliasFrom] = useState('');
  const [newAliasTo, setNewAliasTo] = useState('');
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);

  // URL paste inputs
  const [shotUrlInput, setShotUrlInput] = useState('');
  const [kyujinUrlInput, setKyujinUrlInput] = useState('');
  const [shotExtractSuccess, setShotExtractSuccess] = useState(false);
  const [kyujinExtractSuccess, setKyujinExtractSuccess] = useState(false);

  const handleShotUrlPaste = (val: string) => {
    setShotUrlInput(val);
    const parsed = parseGoogleSheetUrl(val);
    if (parsed.bookId || parsed.gid) {
      setForm((prev) => ({
        ...prev,
        shotBookId: parsed.bookId !== undefined ? parsed.bookId : prev.shotBookId,
        shotGid: parsed.gid !== undefined ? parsed.gid : prev.shotGid,
      }));
      setShotExtractSuccess(true);
      setTimeout(() => setShotExtractSuccess(false), 3000);
    }
  };

  const handleKyujinUrlPaste = (val: string) => {
    setKyujinUrlInput(val);
    const parsed = parseGoogleSheetUrl(val);
    if (parsed.bookId || parsed.gid) {
      setForm((prev) => ({
        ...prev,
        kyujinBookId: parsed.bookId !== undefined ? parsed.bookId : prev.kyujinBookId,
        kyujinGid: parsed.gid !== undefined ? parsed.gid : prev.kyujinGid,
      }));
      setKyujinExtractSuccess(true);
      setTimeout(() => setKyujinExtractSuccess(false), 3000);
    }
  };

  const handleSave = () => {
    onSaveSettings(form);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleAddMergeRule = () => {
    if (!newAliasFrom.trim() || !newAliasTo.trim()) return;
    const updated = {
      ...form.companyMerges,
      [newAliasFrom.trim()]: newAliasTo.trim(),
    };
    setForm({ ...form, companyMerges: updated });
    setNewAliasFrom('');
    setNewAliasTo('');
  };

  const handleRemoveMergeRule = (key: string) => {
    const updated = { ...form.companyMerges };
    delete updated[key];
    setForm({ ...form, companyMerges: updated });
  };

  const handleRunTests = () => {
    const res = runPureFunctionTests();
    setTestResults(res);
  };

  const handleClearSnapshotsDB = async () => {
    if (window.confirm('IndexedDBに保存された停止日スナップショット履歴を削除しますか？')) {
      await clearSnapshots();
      alert('IndexedDBのスナップショット履歴を消去しました。');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>システム設定 & 検証閾値</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Googleスプレッドシート連携設定、案件名統合テーブル、Dymtask検証閾値の設定
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>設定を保存</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>設定をlocalStorageに正常に保存しました。</span>
        </div>
      )}

      {/* 1. Google Spreadsheet Connection Settings */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <ExternalLink className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-zinc-200 tracking-wider">
            Googleスプレッドシート連携設定（該当行への直接リンク）
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Shot File */}
          <div className="space-y-3 p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
            <div className="font-semibold text-zinc-200 flex items-center justify-between border-b border-zinc-800/80 pb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>File A: ショット管理タブ</span>
              </span>
              <span className="text-[11px] text-zinc-500">単発タスク</span>
            </div>

            {/* URL Paste Box for File A */}
            <div>
              <label className="text-zinc-300 font-medium flex items-center gap-1 mb-1">
                <Link className="w-3 h-3 text-indigo-400" />
                <span>GoogleスプレッドシートのURLを貼り付け（自動抽出）：</span>
              </label>
              <input
                type="text"
                value={shotUrlInput}
                onChange={(e) => handleShotUrlPaste(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..."
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              {shotExtractSuccess && (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 animate-in fade-in">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>URLからBOOK_IDとGIDを自動抽出しました</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-zinc-800/40">
              <div>
                <label className="text-zinc-400 block mb-1">スプレッドシートID (BOOK_ID)：</label>
                <input
                  type="text"
                  value={form.shotBookId}
                  onChange={(e) => setForm({ ...form, shotBookId: e.target.value.trim() })}
                  placeholder="未設定（直接入力またはURLから抽出）"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">シートタブGID：</label>
                <input
                  type="text"
                  value={form.shotGid}
                  onChange={(e) => setForm({ ...form, shotGid: e.target.value.trim() })}
                  placeholder="未設定（例: 0）"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Kyujin File */}
          <div className="space-y-3 p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
            <div className="font-semibold text-zinc-200 flex items-center justify-between border-b border-zinc-800/80 pb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>File B: 求人依頼表タブ</span>
              </span>
              <span className="text-[11px] text-zinc-500">定期・不定期タスク</span>
            </div>

            {/* URL Paste Box for File B */}
            <div>
              <label className="text-zinc-300 font-medium flex items-center gap-1 mb-1">
                <Link className="w-3 h-3 text-indigo-400" />
                <span>GoogleスプレッドシートのURLを貼り付け（自動抽出）：</span>
              </label>
              <input
                type="text"
                value={kyujinUrlInput}
                onChange={(e) => handleKyujinUrlPaste(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..."
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
              />
              {kyujinExtractSuccess && (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 animate-in fade-in">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>URLからBOOK_IDとGIDを自動抽出しました</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-zinc-800/40">
              <div>
                <label className="text-zinc-400 block mb-1">スプレッドシートID (BOOK_ID)：</label>
                <input
                  type="text"
                  value={form.kyujinBookId}
                  onChange={(e) => setForm({ ...form, kyujinBookId: e.target.value.trim() })}
                  placeholder="未設定（直接入力またはURLから抽出）"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">シートタブGID：</label>
                <input
                  type="text"
                  value={form.kyujinGid}
                  onChange={(e) => setForm({ ...form, kyujinGid: e.target.value.trim() })}
                  placeholder="未設定（例: 0）"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs">
          <label className="text-zinc-400 block mb-1">
            停止日列のヘッダー名（ファイル内に専用の停止日列が存在する場合）：
          </label>
          <input
            type="text"
            value={form.stopDateColumnName}
            onChange={(e) => setForm({ ...form, stopDateColumnName: e.target.value })}
            placeholder="停止日"
            className="w-64 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs"
          />
          <p className="text-[11px] text-zinc-500 mt-1">
            ※ファイルに停止日列が存在しない場合、IndexedDBスナップショット履歴を自動比較して「停止中」に移行した初日を記録します。
          </p>
        </div>
      </div>

      {/* 2. Audit & Fraud Thresholds */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-zinc-200 tracking-wider">
            Dymtask不正検知・検証閾値設定
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-zinc-400 block mb-1">
              連続一括完了とみなす最小件数：
            </label>
            <input
              type="number"
              value={form.burstCountThreshold}
              onChange={(e) => setForm({ ...form, burstCountThreshold: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono"
            />
            <span className="text-[11px] text-zinc-500">既定値: 10件</span>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">
              連続一括完了の時間枠（分）：
            </label>
            <input
              type="number"
              value={form.burstWindowMinutes}
              onChange={(e) => setForm({ ...form, burstWindowMinutes: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono"
            />
            <span className="text-[11px] text-zinc-500">既定値: 5分</span>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">
              1日の合計実績時間上限（分）：
            </label>
            <input
              type="number"
              value={form.dailyActualLimitMinutes}
              onChange={(e) => setForm({ ...form, dailyActualLimitMinutes: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono"
            />
            <span className="text-[11px] text-zinc-500">既定値: 480分（8時間）</span>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">
              比率チェック対象の最小想定工数（分）：
            </label>
            <input
              type="number"
              value={form.estMinForRatioCheck}
              onChange={(e) => setForm({ ...form, estMinForRatioCheck: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono"
            />
            <span className="text-[11px] text-zinc-500">既定値: 30分以上</span>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">
              極端に短い実績比率の下限（%）：
            </label>
            <input
              type="number"
              value={form.actualLowRatioPercent}
              onChange={(e) => setForm({ ...form, actualLowRatioPercent: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono"
            />
            <span className="text-[11px] text-zinc-500">既定値: ≤ 25%</span>
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">
              大幅超過とみなす実績比率（%）：
            </label>
            <input
              type="number"
              value={form.actualHighRatioPercent}
              onChange={(e) => setForm({ ...form, actualHighRatioPercent: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono"
            />
            <span className="text-[11px] text-zinc-500">既定値: ≥ 200%（差分15分以上）</span>
          </div>
        </div>
      </div>

      {/* 3. Company Merge Rules */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <Building2 className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-zinc-200 tracking-wider">
            案件名統合テーブル（表記ゆれ対応・localStorage保存）
          </h3>
        </div>

        <p className="text-xs text-zinc-400">
          同一クライアントで表記が異なる場合（例: <code className="text-zinc-300">（株）テスト</code> と <code className="text-zinc-300">テスト株式会社</code>）、統合先の正規名称を設定して自動集約できます。
        </p>

        {/* Add new rule */}
        <div className="flex flex-col sm:flex-row items-center gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
          <input
            type="text"
            value={newAliasFrom}
            onChange={(e) => setNewAliasFrom(e.target.value)}
            placeholder="元の表記ゆれ名称（例: （株）テスト）"
            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs"
          />
          <span className="text-zinc-500 text-xs">→ 統合先：</span>
          <input
            type="text"
            value={newAliasTo}
            onChange={(e) => setNewAliasTo(e.target.value)}
            placeholder="正規名称（例: テスト株式会社）"
            className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs"
          />
          <button
            onClick={handleAddMergeRule}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ルールを追加</span>
          </button>
        </div>

        {/* Existing rules table */}
        <div className="max-h-48 overflow-y-auto divide-y divide-zinc-800 border border-zinc-800 rounded-xl">
          {Object.entries(form.companyMerges).length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">
              登録された統合ルールはありません。
            </div>
          ) : (
            Object.entries(form.companyMerges).map(([orig, target]) => (
              <div
                key={orig}
                className="flex items-center justify-between p-2.5 bg-zinc-950/40 text-xs text-zinc-300"
              >
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-zinc-400">{orig}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-emerald-400 font-semibold">{target}</span>
                </div>
                <button
                  onClick={() => handleRemoveMergeRule(orig)}
                  className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Unit Test Suite Execution */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <TestTube className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-zinc-200 tracking-wider">
              純粋関数・単体テスト検証（Unit Tests）
            </h3>
          </div>
          <button
            onClick={handleRunTests}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 hover:bg-emerald-900/60 transition-colors"
          >
            <Play className="w-3 h-3" />
            <span>テストを実行</span>
          </button>
        </div>

        {testResults ? (
          <div className="space-y-2">
            {testResults.map((t, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                  t.passed
                    ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-800/60 text-rose-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  {t.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold text-zinc-200">{t.name}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{t.message}</div>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800">
                  {t.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            「テストを実行」を押すと、ID/PW破棄・DYMTASK ID抽出・定期推論・連続一括完了検知の単体テストを一括検証します。
          </p>
        )}
      </div>

      {/* 5. Phase 2 Readiness */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-zinc-200 tracking-wider">
              フェーズ2：Google Sheets API直接連携
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-semibold">
            準備完了
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Googleアカウントでログインし、閲覧権限（<code className="text-zinc-300">spreadsheets.readonly</code>）のみでスプレッドシートの指定列を直接取得します。認証情報列（アイパス）は取得範囲から完全に除外されます。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-zinc-400 block mb-1">Google OAuth クライアントID：</label>
            <input
              type="text"
              value={form.googleClientId || ''}
              onChange={(e) => setForm({ ...form, googleClientId: e.target.value })}
              placeholder="例: 123456789-xxxx.apps.googleusercontent.com"
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-zinc-400 block mb-1">自動更新インターバル（分）：</label>
            <input
              type="number"
              value={form.autoSyncIntervalMinutes || 15}
              onChange={(e) => setForm({ ...form, autoSyncIntervalMinutes: Number(e.target.value) })}
              className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* 6. Database & Cache Reset */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-semibold text-rose-300 tracking-wider mb-1">
            データ消去・スナップショット履歴リセット
          </h4>
          <p className="text-xs text-zinc-400">
            IndexedDBに保持された過去の停止中スナップショット履歴、または現在のセッションデータをクリアします。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearSnapshotsDB}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 bg-rose-950/60 border border-rose-800/80 hover:bg-rose-900/60 transition-colors"
          >
            IndexedDBスナップショット削除
          </button>
          <button
            onClick={onClearAllData}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            現在のセッションデータをクリア
          </button>
        </div>
      </div>
    </div>
  );
};
