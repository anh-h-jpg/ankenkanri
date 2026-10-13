import { AppSettings, BaseRegistryTask, DymtaskSubtask } from '../types';
import { parseDymtaskListCsv, parseKyujinCsv, parseShotCsv } from '../utils/csvParser';
import { auditDymtaskList } from '../utils/dymtaskAuditor';

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  if (type === 'AUDIT_DYMTASK') {
    const { subtasks, registryMapData, activeRecurringTasks, settings, auditDateStr } = payload;
    try {
      console.time('Worker: Dymtask検証');

      // Reconstruct map from serialized entries [key, value][]
      const registryMap = new Map<string, BaseRegistryTask>(registryMapData);

      const report = auditDymtaskList(
        subtasks,
        registryMap,
        settings,
        auditDateStr,
        activeRecurringTasks
      );

      console.timeEnd('Worker: Dymtask検証');

      self.postMessage({
        id,
        type: 'AUDIT_SUCCESS',
        report,
      });
    } catch (err: any) {
      console.error('Worker error during Dymtask audit:', err);
      self.postMessage({
        id,
        type: 'AUDIT_ERROR',
        error: err.message || 'Dymtaskの検証中にエラーが発生しました。',
      });
    }
  } else if (type === 'PARSE_SHOT_CSV') {
    try {
      const { csvText, companyMerges, stopDateColumnName } = payload;
      const res = await parseShotCsv(csvText, companyMerges, stopDateColumnName);
      self.postMessage({
        id,
        type: 'PARSE_SUCCESS',
        result: res,
      });
    } catch (err: any) {
      self.postMessage({
        id,
        type: 'PARSE_ERROR',
        error: err.message || 'ショットCSVの解析に失敗しました。',
      });
    }
  } else if (type === 'PARSE_KYUJIN_CSV') {
    try {
      const { csvText, companyMerges, stopDateColumnName } = payload;
      const res = await parseKyujinCsv(csvText, companyMerges, stopDateColumnName);
      self.postMessage({
        id,
        type: 'PARSE_SUCCESS',
        result: res,
      });
    } catch (err: any) {
      self.postMessage({
        id,
        type: 'PARSE_ERROR',
        error: err.message || '求人依頼表CSVの解析に失敗しました。',
      });
    }
  } else if (type === 'PARSE_DYMTASK_CSV') {
    try {
      const { csvText } = payload;
      const res = await parseDymtaskListCsv(csvText);
      self.postMessage({
        id,
        type: 'PARSE_SUCCESS',
        result: res,
      });
    } catch (err: any) {
      self.postMessage({
        id,
        type: 'PARSE_ERROR',
        error: err.message || 'Dymtask CSVの解析に失敗しました。',
      });
    }
  }
};

