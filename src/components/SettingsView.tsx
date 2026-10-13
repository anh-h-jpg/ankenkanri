import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCheck2,
  Link,
  Play,
  Plus,
  Save,
  Search,
  Sliders,
  TestTube,
  Trash2,
} from 'lucide-react';
import { AppSettings, BaseRegistryTask } from '../types';
import { extractDymTaskId, parseGoogleSheetUrl } from '../utils/normalize';
import { clearSnapshots } from '../utils/storage';
import { runPureFunctionTests, TestResult } from '../utils/testSuite';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onClearAllData: () => void;
  registryMap?: Map<string, BaseRegistryTask>;
  allTasks?: BaseRegistryTask[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onClearAllData,
  registryMap,
  allTasks,
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

  // Verification section (確認用)
  const [checkDymTaskId, setCheckDymTaskId] = useState('');

  const foundCheckTask = useMemo(() => {
    const rawInput = checkDymTaskId.trim();
    if (!rawInput) return null;
    const cleanId = extractDymTaskId(rawInput) || rawInput;

    if (registryMap && registryMap.has(cleanId)) {
      return registryMap.get(cleanId)!;
    }
    if (registryMap && registryMap.has(rawInput)) {
      return registryMap.get(rawInput)!;
    }
    if (allTasks) {
      return (
        allTasks.find(
          (t) =>
            t.dymTaskId === cleanId ||
            t.dymTaskId === rawInput ||
            extractDymTaskId(t.dymTaskId) === cleanId
        ) || null
      );
    }
    return null;
  }, [checkDymTaskId, registryMap, allTasks]);

  const checkTaskSheetUrl = useMemo(() => {
    if (!foundCheckTask) return null;
    const isShot = foundCheckTask.sourceTab === 'ショット';
    const bookId = isShot ? form.shotBookId?.trim() : form.kyujinBookId?.trim();
    const gid = isShot ? form.shotGid?.trim() : form.kyujinGid?.trim();
    if (!bookId || !gid) return null;
    return `https://docs.google.com/spreadsheets/d/${bookId}/edit#gid=${gid}&range=${foundCheckTask.originalRowNumber}:${foundCheckTask.originalRowNumber}`;
  }, [foundCheckTask, form.shotBookId, form.shotGid, form.kyujinBookId, form.kyujinGid]);

  const sampleAvailableIds = useMemo(() => {
    if (registryMap && registryMap.size > 0) {
      return Array.from(registryMap.keys())
        .filter((k) => k && k.length >= 4)
        .slice(0, 6);
    }
    if (allTasks && allTasks.length > 0) {
      return allTasks
        .map((t) => t.dymTaskId)
        .filter((id): id is string => Boolean(id && id.length >= 4))
        .slice(0, 6);
    }
    return [];
  }, [registryMap, allTasks]);

  const handleShotUrlPaste = (val: string) => {
    setShotUrlInput(val);
    const parsed = parseGoogleSheetUrl(val);
    if (parsed.bookId || parsed.gid) {
      const updated = {
        ...form,
        shotBookId: parsed.bookId !== undefined ? parsed.bookId : form.shotBookId,
        shotGid: parsed.gid !== undefined ? parsed.gid : form.shotGid,
      };
      setForm(updated);
      onSaveSettings(updated);
      setShotExtractSuccess(true);
      setTimeout(() => setShotExtractSuccess(false), 3000);
    }
  };

  const handleKyujinUrlPaste = (val: string) => {
    setKyujinUrlInput(val);
    const parsed = parseGoogleSheetUrl(val);
    if (parsed.bookId || parsed.gid) {
      const updated = {
        ...form,
        kyujinBookId: parsed.bookId !== undefined ? parsed.bookId : form.kyujinBookId,
        kyujinGid: parsed.gid !== undefined ? parsed.gid : form.kyujinGid,
      };
      setForm(updated);
      onSaveSettings(updated);
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

      {/* 2. Verification Section (確認用) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-zinc-200 tracking-wider">
              確認用：DYMTASK ID 行番号（ROW）・生成リンク照合
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 font-semibold">
            対比検証
          </span>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          DYMTASK IDを入力すると、CSV解析で割り振られたシート行番号（rowNumber）とアプリが作成するGoogleスプレッドシートリンクをリアルタイムに確認・対比できます。
        </p>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={checkDymTaskId}
                onChange={(e) => setCheckDymTaskId(e.target.value)}
                placeholder="確認したいDYMTASK IDを入力（例: 102401）"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs font-mono placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            {sampleAvailableIds.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-zinc-500">サンプルID:</span>
                {sampleAvailableIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCheckDymTaskId(id)}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-cyan-300 border border-zinc-700 transition-colors"
                  >
                    {id}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Verification Result Card */}
        {checkDymTaskId.trim() ? (
          foundCheckTask ? (
            <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-800 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[11px] text-zinc-400 mb-0.5">DYMTASK ID</div>
                  <div className="font-mono font-bold text-cyan-300 text-sm">
                    {foundCheckTask.dymTaskId || '未設定'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/60">
                  <div className="text-[11px] text-cyan-300 mb-0.5 font-medium">CSV行番号（ROW）</div>
                  <div className="font-mono font-bold text-cyan-400 text-sm">
                    行 {foundCheckTask.originalRowNumber}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[11px] text-zinc-400 mb-0.5">元タブ</div>
                  <div className="font-semibold text-zinc-200">
                    {foundCheckTask.sourceTab}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[11px] text-zinc-400 mb-0.5">対応者</div>
                  <div className="text-zinc-300">
                    {foundCheckTask.assignee || '未設定'}
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <div className="text-[11px] text-zinc-400">案件名（会社名） & タスク名:</div>
                <div className="font-semibold text-zinc-100">
                  {foundCheckTask.companyName}
                  <span className="text-zinc-500 mx-2">/</span>
                  <span className="text-zinc-300 font-normal">{foundCheckTask.taskName}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 text-xs space-y-2">
                <div className="text-[11px] text-zinc-400 font-medium">生成リンク（Googleスプレッドシート）:</div>
                {checkTaskSheetUrl ? (
                  <div className="space-y-2">
                    <div className="p-2 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-cyan-300 break-all select-all">
                      {checkTaskSheetUrl}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={checkTaskSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>シートの該当行を開く</span>
                      </a>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        range={foundCheckTask.originalRowNumber}:{foundCheckTask.originalRowNumber}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-lg text-amber-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold">設定でBOOK_IDとGIDを入力してください</div>
                      <div className="text-[11px] text-amber-300/80 mt-0.5">
                        {foundCheckTask.sourceTab}のBOOK_IDまたはGIDが未設定のため、URLを生成できません。（算定された行番号: 行 {foundCheckTask.originalRowNumber}）
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                該当するDYMTASK ID（<code className="text-zinc-200 font-mono">{checkDymTaskId}</code>）のタスクが見つかりません。CSVが読み込まれているか、またはIDをご確認ください。
              </span>
            </div>
          )
        ) : (
          <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/60 text-xs text-zinc-500">
            確認したいDYMTASK IDを入力すると、行番号および生成されるGoogleスプレッドシートリンクが表示されます。
          </div>
        )}
      </div>

      {/* 3. Audit & Fraud Thresholds */}
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
