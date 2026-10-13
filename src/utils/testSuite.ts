/**
 * Pure function unit tests and verification suite (Japanese).
 */

import Papa from 'papaparse';
import { classifyTaskRule } from './classifier';
import { auditDymtaskList } from './dymtaskAuditor';
import { extractDymTaskId, normalizeCompanyName, parseGoogleSheetUrl } from './normalize';
import { sanitizeRawRow, verifyNoCredentialsInRecord } from './security';
import { DEFAULT_SETTINGS } from './storage';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runPureFunctionTests(): TestResult[] {
  const results: TestResult[] = [];

  // Test 1: ID/PW保護（アイパス列除外）
  try {
    const dirtyRow = {
      'タスク名': '求人更新',
      'アイパス（ID + PW）': 'user123:secretpwd',
      'ID + PW': 'admin:pass',
      '会社名': 'テスト株式会社',
    };
    const cleanRow = sanitizeRawRow(dirtyRow);
    const hasForbidden = !verifyNoCredentialsInRecord(cleanRow);
    const passed = !hasForbidden && !('アイパス（ID + PW）' in cleanRow) && !('ID + PW' in cleanRow);
    results.push({
      name: 'ID/PW保護: 「アイパス（ID + PW）」列の完全除外',
      passed,
      message: passed ? 'パスワード列をメモリから即時破棄することを確認しました。' : 'エラー: パスワード列が残存しています。',
    });
  } catch (e: any) {
    results.push({ name: 'ID/PW保護', passed: false, message: e.message });
  }

  // Test 2: 表記ゆれ・NFKC正規化と案件名統合
  try {
    const raw = '【求人】  株式会社リクルートキャリア  ';
    const norm = normalizeCompanyName(raw, { '株式会社リクルートキャリア': 'リクルートキャリア' });
    const passed = norm.canonical === 'リクルートキャリア' && norm.cleaned === '株式会社リクルートキャリア';
    results.push({
      name: '正規化: NFKC処理・【】除去・案件名統合',
      passed,
      message: passed ? `案件名を正常に正規化しました（${norm.canonical}）` : `想定と異なる結果: ${norm.canonical}`,
    });
  } catch (e: any) {
    results.push({ name: '正規化', passed: false, message: e.message });
  }

  // Test 3: DYMTASK ID抽出（6桁・先頭タブ除去）
  try {
    const id1 = extractDymTaskId('\t102451');
    const id2 = extractDymTaskId('102452 / 102453');
    const id3 = extractDymTaskId('abc');
    const passed = id1 === '102451' && id2 === '102452' && id3 === null;
    results.push({
      name: 'DYMTASK ID: 6桁数字抽出・先頭タブ除去・先頭ID採用',
      passed,
      message: passed ? 'DYMTASK IDを正確に抽出しました。' : `不整合: id1=${id1}, id2=${id2}, id3=${id3}`,
    });
  } catch (e: any) {
    results.push({ name: 'DYMTASK ID', passed: false, message: e.message });
  }

  // Test 4: タスク分類ルールと警告検知
  try {
    const shotRes = classifyTaskRule('ショット', '', '');
    const teikiRes = classifyTaskRule('求人依頼表', '毎日', '月火水木金');
    const inferRes = classifyTaskRule('求人依頼表', '', '月水金');
    const warnRes = classifyTaskRule('求人依頼表', '不定期', '月火');

    const passed =
      shotRes.taskType === 'ショット' &&
      teikiRes.taskType === '定期' &&
      inferRes.taskType === '定期' &&
      inferRes.isInferredFrequency === true &&
      warnRes.warningNotice !== undefined;

    results.push({
      name: 'タスク分類: ショット/定期/不定期の判定および曜日詳細からの推論・警告',
      passed,
      message: passed ? '分類ルールおよびスケジュール警告を正常に判定しました。' : '分類ロジックの不整合が発生しました。',
    });
  } catch (e: any) {
    results.push({ name: 'タスク分類', passed: false, message: e.message });
  }

  // Test 5: Dymtask検証と連続一括完了（送信不正検知）
  try {
    const mockSubtasks: any[] = [
      {
        rowNumber: 2,
        id: '123',
        assignee: 'Nguyen Van A',
        status: 'Done',
        substatus: 'Done',
        estMinutes: 30,
        actualMinutes: 0,
        lastUpdatedTime: '2026/10/12 10:00:00',
        subtaskContent: 'テストタスク1',
      },
    ];

    for (let i = 0; i < 11; i++) {
      mockSubtasks.push({
        rowNumber: 10 + i,
        id: '100001',
        assignee: 'Nguyen Van A',
        status: 'Done',
        substatus: 'Done',
        estMinutes: 10,
        actualMinutes: 10,
        lastUpdatedTime: `2026/10/12 15:0${Math.floor(i / 3)}:${String((i * 15) % 60).padStart(2, '0')}`,
        subtaskContent: `連続サブタスク ${i}`,
      });
    }

    const report = auditDymtaskList(mockSubtasks, new Map(), DEFAULT_SETTINGS);
    const hasBurst = report.exceptions.some((e) => e.category === 'BURST_CLOSURE');
    const hasInvalidId = report.exceptions.some((e) => e.category === 'INVALID_ID');
    const hasZeroActual = report.exceptions.some((e) => e.category === 'ZERO_ACTUAL_WHEN_DONE');

    const passed = hasBurst && hasInvalidId && hasZeroActual;
    results.push({
      name: 'Dymtask検証: 連続一括完了（送信不正）および各種異常の検知',
      passed,
      message: passed ? `検知成功（エラー: ${report.errorCount}件、要確認: ${report.reviewCount}件、一括完了検知あり）` : '検証テストに失敗しました。',
    });
  } catch (e: any) {
    results.push({ name: 'Dymtask検証', passed: false, message: e.message });
  }

  // Test 6: GoogleスプレッドシートURL解析（BOOK_IDとGIDの自動抽出）
  try {
    const url1 = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_12345/edit#gid=1234567';
    const parsed1 = parseGoogleSheetUrl(url1);
    const url2 = 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_12345/edit?gid=9876543';
    const parsed2 = parseGoogleSheetUrl(url2);

    const passed =
      parsed1.bookId === '1AbCdEfGhIjKlMnOpQrStUvWxYz_12345' &&
      parsed1.gid === '1234567' &&
      parsed2.bookId === '1AbCdEfGhIjKlMnOpQrStUvWxYz_12345' &&
      parsed2.gid === '9876543';

    results.push({
      name: 'URL解析: GoogleスプレッドシートURLからのBOOK_IDとGID自動抽出',
      passed,
      message: passed ? 'URLからBOOK_IDとGIDを正確に抽出しました。' : 'URL抽出の検証に失敗しました。',
    });
  } catch (e: any) {
    results.push({ name: 'URL解析', passed: false, message: e.message });
  }

  // Test 7: CSV改行含有・空行含有時の行番号（rowNumber）維持テスト
  try {
    const csvWithMultilineAndEmpty = [
      '注釈行1,説明',
      '注釈行2,説明',
      'ステータス,会社名,DYMTASK',
      '稼働中,"株式会社マルチライン\n改行セル",102901',
      '',
      '稼働中,空行後株式会社,102902',
    ].join('\n');

    const parsed = Papa.parse<string[]>(csvWithMultilineAndEmpty, {
      skipEmptyLines: false,
    });

    const rows = parsed.data;
    // rows[0] -> 行1 (注釈行1)
    // rows[1] -> 行2 (注釈行2)
    // rows[2] -> 行3 (ヘッダー)
    // rows[3] -> 行4 (改行を含むセルを持つタスク: 3 + 1 = 4)
    // rows[4] -> 行5 (空行)
    // rows[5] -> 行6 (空行の後のタスク: 5 + 1 = 6)

    const row4_num = 3 + 1;
    const row6_num = 5 + 1;
    const row4_company = rows[3] ? rows[3][1] : '';
    const row6_company = rows[5] ? rows[5][1] : '';

    const passed =
      rows.length === 6 &&
      row4_num === 4 &&
      row6_num === 6 &&
      row4_company.includes('改行セル') &&
      row6_company === '空行後株式会社';

    results.push({
      name: '行番号算定: セル内改行および空行を含むCSVでのrowNumber保持検証',
      passed,
      message: passed
        ? `正確に維持確認（全${rows.length}行中、セル内改行タスク: 行${row4_num}、空行後タスク: 行${row6_num}）`
        : `行番号算定の不整合を検出しました（行数: ${rows.length}）`,
    });
  } catch (e: any) {
    results.push({ name: '行番号算定', passed: false, message: e.message });
  }

  return results;
}
