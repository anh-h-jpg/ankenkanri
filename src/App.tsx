/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnkenDetailModal } from './components/AnkenDetailModal';
import { AnkenOverview } from './components/AnkenOverview';
import { DymtaskAuditView } from './components/DymtaskAuditView';
import { FileUploadModal } from './components/FileUploadModal';
import { Header } from './components/Header';
import { NeedAttentionView } from './components/NeedAttentionView';
import { SettingsView } from './components/SettingsView';
import { AnkenSummary, AppSettings, BaseRegistryTask, DymtaskSubtask } from './types';
import { parseDymtaskListCsv, parseKyujinCsv, parseShotCsv } from './utils/csvParser';
import {
  SAMPLE_DYMTASK_TODO_CSV,
  SAMPLE_KYUJIN_CSV,
  SAMPLE_SHOT_CSV,
} from './utils/sampleData';
import {
  loadSettings,
  saveSettings,
  updateSnapshots,
} from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'attention' | 'settings'>('overview');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // In-browser task datasets
  const [shotTasks, setShotTasks] = useState<BaseRegistryTask[]>([]);
  const [kyujinTasks, setKyujinTasks] = useState<BaseRegistryTask[]>([]);
  const [dymtaskSubtasks, setDymtaskSubtasks] = useState<DymtaskSubtask[]>([]);

  // Selected Anken for Detail Modal
  const [selectedAnken, setSelectedAnken] = useState<AnkenSummary | null>(null);

  // Sync dark class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Combined all registry tasks
  const allRegistryTasks = useMemo(() => {
    return [...kyujinTasks, ...shotTasks];
  }, [kyujinTasks, shotTasks]);

  // Map of dymTaskId -> BaseRegistryTask for fast lookup by Dymtask auditor
  const registryMap = useMemo(() => {
    const map = new Map<string, BaseRegistryTask>();
    for (const t of allRegistryTasks) {
      if (t.dymTaskId) {
        map.set(t.dymTaskId, t);
      }
    }
    return map;
  }, [allRegistryTasks]);

  // Group tasks by 案件
  const ankens: AnkenSummary[] = useMemo(() => {
    const map = new Map<
      string,
      {
        rawNames: Set<string>;
        assignees: Set<string>;
        tasks: BaseRegistryTask[];
        teikiRunning: number;
        teikiStopped: number;
        futeikiRunning: number;
        futeikiStopped: number;
        shotInProgress: number;
        shotCompleted: number;
        shotOther: number;
        warningCount: number;
        missingIdCount: number;
        latestStopDate: string | null;
      }
    >();

    for (const task of allRegistryTasks) {
      const companyKey = task.companyName || '未設定';
      let entry = map.get(companyKey);
      if (!entry) {
        entry = {
          rawNames: new Set(),
          assignees: new Set(),
          tasks: [],
          teikiRunning: 0,
          teikiStopped: 0,
          futeikiRunning: 0,
          futeikiStopped: 0,
          shotInProgress: 0,
          shotCompleted: 0,
          shotOther: 0,
          warningCount: 0,
          missingIdCount: 0,
          latestStopDate: null,
        };
        map.set(companyKey, entry);
      }

      entry.rawNames.add(task.rawCompanyName || companyKey);
      if (task.assignee) entry.assignees.add(task.assignee);
      entry.tasks.push(task);

      if (task.warningNotice) {
        entry.warningCount++;
      }

      if (task.stopDate) {
        if (!entry.latestStopDate || task.stopDate > entry.latestStopDate) {
          entry.latestStopDate = task.stopDate;
        }
      }

      if (task.taskType === '定期') {
        if (task.status === '稼働中') {
          entry.teikiRunning++;
          if (!task.dymTaskId) entry.missingIdCount++;
        } else if (task.status === '停止中') {
          entry.teikiStopped++;
        }
      } else if (task.taskType === '不定期') {
        if (task.status === '稼働中') {
          entry.futeikiRunning++;
          if (!task.dymTaskId) entry.missingIdCount++;
        } else if (task.status === '停止中') {
          entry.futeikiStopped++;
        }
      } else if (task.taskType === 'ショット') {
        if (task.status === '完了') {
          entry.shotCompleted++;
        } else if (task.status === '対応中' || task.status === 'Wcheck中') {
          entry.shotInProgress++;
          if (!task.dymTaskId) entry.missingIdCount++;
        } else {
          entry.shotOther++;
          if (!task.dymTaskId) entry.missingIdCount++;
        }
      } else {
        if (task.status === '稼働中') {
          if (!task.dymTaskId) entry.missingIdCount++;
        }
      }
    }

    const result: AnkenSummary[] = [];
    for (const [canonicalName, data] of map.entries()) {
      result.push({
        canonicalName,
        rawNames: Array.from(data.rawNames),
        assignees: Array.from(data.assignees),
        totalTasks: data.tasks.length,
        teikiRunning: data.teikiRunning,
        teikiStopped: data.teikiStopped,
        futeikiRunning: data.futeikiRunning,
        futeikiStopped: data.futeikiStopped,
        shotInProgress: data.shotInProgress,
        shotCompleted: data.shotCompleted,
        shotOther: data.shotOther,
        warningCount: data.warningCount,
        missingIdCount: data.missingIdCount,
        latestStopDate: data.latestStopDate,
        tasks: data.tasks,
      });
    }

    return result;
  }, [allRegistryTasks]);

  const totalWarningCount = useMemo(() => {
    return allRegistryTasks.filter((t) => Boolean(t.warningNotice)).length;
  }, [allRegistryTasks]);

  const totalMissingIdCount = useMemo(() => {
    return allRegistryTasks.filter((t) => {
      if (t.dymTaskId) return false;
      return t.sourceTab === 'ショット' ? t.status !== '完了' : t.status === '稼働中';
    }).length;
  }, [allRegistryTasks]);

  const handleLoadSampleData = async () => {
    try {
      const nowStr = new Date().toISOString().slice(0, 10);

      const shotRes = await parseShotCsv(
        SAMPLE_SHOT_CSV,
        settings.companyMerges,
        settings.stopDateColumnName
      );
      const shotSnapMap = await updateSnapshots(
        shotRes.data.map((t) => ({ key: t.dymTaskId || t.id, status: t.status })),
        nowStr
      );
      const enrichedShot = shotRes.data.map((t) => {
        const key = t.dymTaskId || t.id;
        if (!t.stopDate && shotSnapMap.has(key)) {
          return { ...t, stopDate: shotSnapMap.get(key)!, stopDateSource: 'snapshot' as const };
        }
        return t;
      });

      const kyujinRes = await parseKyujinCsv(
        SAMPLE_KYUJIN_CSV,
        settings.companyMerges,
        settings.stopDateColumnName
      );
      const kyujinSnapMap = await updateSnapshots(
        kyujinRes.data.map((t) => ({ key: t.dymTaskId || t.id, status: t.status })),
        nowStr
      );
      const enrichedKyujin = kyujinRes.data.map((t) => {
        const key = t.dymTaskId || t.id;
        if (!t.stopDate && kyujinSnapMap.has(key)) {
          return { ...t, stopDate: kyujinSnapMap.get(key)!, stopDateSource: 'snapshot' as const };
        }
        return t;
      });

      const dymtaskRes = await parseDymtaskListCsv(SAMPLE_DYMTASK_TODO_CSV);

      setShotTasks(enrichedShot);
      setKyujinTasks(enrichedKyujin);
      setDymtaskSubtasks(dymtaskRes.data);
    } catch (e) {
      console.error('Failed to load sample data', e);
    }
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleClearAllData = () => {
    if (window.confirm('現在のセッション内のすべてのタスクデータを消去しますか？')) {
      setShotTasks([]);
      setKyujinTasks([]);
      setDymtaskSubtasks([]);
      setSelectedAnken(null);
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'} flex flex-col font-sans transition-colors duration-200`}>
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onOpenUpload={() => setIsUploadOpen(true)}
        onLoadSample={handleLoadSampleData}
        shotCount={shotTasks.length}
        kyujinCount={kyujinTasks.length}
        dymtaskCount={dymtaskSubtasks.length}
        warningCount={totalWarningCount}
        missingIdCount={totalMissingIdCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <AnkenOverview
            ankens={ankens}
            onSelectAnken={(a) => setSelectedAnken(a)}
            onNavigateToAttention={() => setActiveTab('attention')}
          />
        )}

        {activeTab === 'audit' && (
          <DymtaskAuditView
            dymtaskSubtasks={dymtaskSubtasks}
            registryMap={registryMap}
            settings={settings}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        )}

        {activeTab === 'attention' && (
          <NeedAttentionView
            tasks={allRegistryTasks}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onClearAllData={handleClearAllData}
          />
        )}
      </main>

      {/* Anken Detail Modal */}
      {selectedAnken && (
        <AnkenDetailModal
          anken={selectedAnken}
          onClose={() => setSelectedAnken(null)}
          settings={settings}
        />
      )}

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onImportShotTasks={(tasks) => setShotTasks(tasks)}
        onImportKyujinTasks={(tasks) => setKyujinTasks(tasks)}
        onImportDymtaskSubtasks={(subs) => setDymtaskSubtasks(subs)}
        settings={settings}
        shotTasksCount={shotTasks.length}
        kyujinTasksCount={kyujinTasks.length}
        dymtaskSubtasksCount={dymtaskSubtasks.length}
      />
    </div>
  );
}
