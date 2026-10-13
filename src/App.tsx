/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AnkenDetailModal } from './components/AnkenDetailModal';
import { AnkenOverview } from './components/AnkenOverview';
import { DymtaskAuditView } from './components/DymtaskAuditView';
import { FileUploadModal } from './components/FileUploadModal';
import { Header } from './components/Header';
import { NeedAttentionView } from './components/NeedAttentionView';
import { SettingsView } from './components/SettingsView';
import { AnkenSummary, AppSettings, DymtaskSubtask } from './types';
import { parseDymtaskListCsv, parseKyujinCsv, parseShotCsv } from './utils/csvParser';
import { registryStore } from './utils/registryStore';
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

  // In-memory Dymtask subtasks dataset
  const [dymtaskSubtasks, setDymtaskSubtasks] = useState<DymtaskSubtask[]>([]);

  // Version counter to trigger re-renders only when registry store updates
  const [, setRegistryVersion] = useState<number>(0);

  // Subscribe to registryStore changes (indexes built ONCE upon import, zero re-indexing on UI changes)
  useEffect(() => {
    return registryStore.subscribe(() => {
      setRegistryVersion((v) => v + 1);
    });
  }, []);

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

  // Read pre-indexed data structures from registryStore (O(1) access)
  const ankens = registryStore.ankensSummary;
  const registryMap = registryStore.registryMap;
  const activeRecurringTasks = registryStore.activeRecurringTasks;
  const totalWarningCount = registryStore.totalWarningCount;
  const totalMissingIdCount = registryStore.totalMissingIdCount;
  const shotTasksCount = registryStore.getShotTasksCount();
  const kyujinTasksCount = registryStore.getKyujinTasksCount();
  const attentionTasks = registryStore.attentionTasks.length > 0
    ? registryStore.attentionTasks
    : registryStore.getAllTasks();

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

      // Store in high-performance registryStore (indexes once, avoiding full recomputation)
      registryStore.setShotTasks(enrichedShot);
      registryStore.setKyujinTasks(enrichedKyujin);
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
      registryStore.clear();
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
        shotCount={shotTasksCount}
        kyujinCount={kyujinTasksCount}
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
            activeRecurringTasks={activeRecurringTasks}
            settings={settings}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        )}

        {activeTab === 'attention' && (
          <NeedAttentionView
            tasks={attentionTasks}
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
        onImportShotTasks={(tasks) => registryStore.setShotTasks(tasks)}
        onImportKyujinTasks={(tasks) => registryStore.setKyujinTasks(tasks)}
        onImportDymtaskSubtasks={(subs) => setDymtaskSubtasks(subs)}
        settings={settings}
        shotTasksCount={shotTasksCount}
        kyujinTasksCount={kyujinTasksCount}
        dymtaskSubtasksCount={dymtaskSubtasks.length}
      />
    </div>
  );
}
