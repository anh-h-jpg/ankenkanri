/**
 * Sample datasets for testing with Japanese data, edge cases, and Dymtask validation cases.
 */

export const SAMPLE_SHOT_CSV = `※ 注意：ショット（単発タスク）管理シートです。列の削除は行わないでください。
※ 求人更新Googleスプレッドシートから出力されたデータです。
ステータス\t記載日\t運用担当/依頼者\t企業名（タスク名）\t想定工数(分)\t担当者\t会社名\t実際時間\tDYMTASK ID\tアイパス（ID + PW）\t停止日
完了\t2026/10/01\t山田 太郎\t【スポット求人作成】リクルートキャリア\t45\tNguyen Van A\t株式会社リクルートキャリア\t40\t\t102401\tuser_rec:Pass1234!\t
対応中\t2026/10/10\t佐藤 花子\t【原稿修正】マイナビパートナーズ\t30\tTran Thi B\t株式会社マイナビ\t25\t102402\tadmin:Secret99$\t
完了\t2026/10/05\t鈴木 一郎\t【バナー差し替え】パーソルキャリア\t60\tLe Hoang C\tパーソルキャリア株式会社\t55\t102403\tlogin_id:p@ssw0rd\t
Wcheck中\t2026/10/11\t山田 太郎\t【緊急掲載】エン・ジャパン\t90\tNguyen Van A\tエン・ジャパン株式会社\t\t102404\tpass_col:xyz\t
休止中\t2026/09/20\t田中 次郎\t【条件変更】ディップ\t30\tPham Duc D\tディップ株式会社\t\t102405\tsuper:secret\t2026/09/25
保留中\t2026/10/08\t佐藤 花子\t【原稿チェック】ネオキャリア\t45\tTran Thi B\t株式会社ネオキャリア\t\t\tclear_pwd:abc\t
確認中\t2026/10/12\t鈴木 一郎\t【新規求人枠作成】クイック\t60\tLe Hoang C\t株式会社クイック\t\t102407\tpw:dummy\t
対応中\t2026/10/12\t山田 太郎\t【写真差し替え】テスト株式会社\t30\tNguyen Van A\t（株）テスト\t\t102408\tpw:pass\t
完了\t2026/10/02\t佐藤 花子\t【求人クローズ】ヒューマンリソシア\t20\tTran Thi B\tヒューマンリソシア株式会社\t20\t102409\tpw:pass\t
対応中\t2026/10/11\t田中 次郎\t【求人原稿追記】ビズリーチ\t40\tPham Duc D\t株式会社ビズリーチ\t\t\tsec:secret\t`;

export const SAMPLE_KYUJIN_CSV = `※ 注意：定期・不定期タスク管理シートです。
※ ステータス列と依頼種類列が重複している場合、1列目を優先採用します。
ステータス\t依頼種類\t記載日\t運用担当/依頼者\tタスク名\t頻度\t曜日詳細\t想定工数(分)\t対応者\t会社名\tDYMTASK ID\tアイパス（ID + PW）\tステータス\t依頼種類\t停止日
稼働中\t求人原稿作成\t2026/01/10\t山田 太郎\tリクルート 求人日次更新\t毎日\t月火水木金\t60\tNguyen Van A\t株式会社リクルートキャリア\t\t102501\tpw:root123\t稼働中\t通常\t
稼働中\t掲載状況確認\t2026/02/15\t佐藤 花子\tマイナビ 週次エントリー確認\t週次\t月水金\t45\tTran Thi B\t株式会社マイナビ\t102502\tid:user,pw:999\t稼働中\t通常\t
稼働中\tスカウト送信\t2026/03/01\t鈴木 一郎\tパーソル 月次集計\t月次\t第1営業日\t90\tLe Hoang C\tパーソルキャリア株式会社\t102503\tpw:admin\t稼働中\t通常\t
停止中\t求人更新\t2025/11/05\t田中 次郎\tディップ 旧掲載停止\t毎日\t全日\t30\tPham Duc D\tディップ株式会社\t102504\tpw:sec1\t停止中\t終了\t2026/08/15
稼働中\tバナー作成\t2026/04/10\t佐藤 花子\tネオキャリア 都度原稿差し替え\t不定期\t不定期\t40\tTran Thi B\t株式会社ネオキャリア\t102505\tpw:pwd\t稼働中\t通常\t
稼働中\t原稿更新\t2026/05/20\t山田 太郎\tテスト株式会社 日次メンテナンス\t毎日\t月火水木金\t30\tNguyen Van A\tテスト株式会社\t102506\tpw:secret\t稼働中\t通常\t
稼働中\tスカウト配信\t2026/06/01\t鈴木 一郎\tクイック 曜日配信\t\t月水金\t45\tLe Hoang C\t株式会社クイック\t102507\tpw:secret\t稼働中\t通常\t
稼働中\t条件更新\t2026/07/15\t山田 太郎\tビズリーチ 週末チェック\t週次\t金\t60\tNguyen Van A\t株式会社ビズリーチ\t\t\tpw:secret\t稼働中\t通常\t
稼働中\t警告テスト1\t2026/08/01\t田中 次郎\t不定期だが曜日指定ありタスク\t不定期\t火木\t30\tPham Duc D\t株式会社エン・ジャパン\t102509\tpw:secret\t稼働中\t通常\t
稼働中\t警告テスト2\t2026/08/10\t佐藤 花子\t週次だが不定期指定タスク\t週次\t不定期\t45\tTran Thi B\tヒューマンリソシア株式会社\t102510\tpw:secret\t稼働中\t通常\t
稼働中\t警告テスト3\t2026/09/01\t鈴木 一郎\t月次だが曜日指定ありタスク\t月次\t月\t60\tLe Hoang C\tパーソルキャリア株式会社\t102511\tpw:secret\t稼働中\t通常\t
停止中\tアーカイブ\t2026/01/05\t山田 太郎\tリクルート 旧週次レポート\t週次\t月\t30\tNguyen Van A\t株式会社リクルートキャリア\t102512\tpw:secret\t停止中\t終了\t2026/07/01`;

export const SAMPLE_DYMTASK_TODO_CSV = `ID,TASK NAME,PROJECT,TAG,TEAM,TYPE,TYPE DETAIL,DEADLINE DAY,DEADLINE TIME,EST TIME,STATUS,NOTE,CREATED BY,CREATED TIME,SUBTASK CONTENT,ASSIGNEE,ACTUAL TIME,SUBSTATUS,LASTUPDATED USER,LASTUPDATED TIME
\t102501,リクルート 求人日次更新,求人更新,RECRUIT,BPO-A,DAILY,KYUJIN,2026/10/12,18:00,60,Done,https://docs.google.com/spreadsheets/d/1kyujin/edit#gid=1828959786&range=4:4,Yamada,2026/10/12 09:00:00,IT職種15件の更新送信,Nguyen Van A,55,Done,Nguyen Van A,2026/10/12 10:20:15
102502,マイナビ 週次エントリー確認,求人更新,MYNAVI,BPO-A,DAILY,CHECK,2026/10/12,18:00,45,Done,https://docs.google.com/spreadsheets/d/1kyujin/edit#gid=1828959786&range=5:5,Sato,2026/10/12 09:15:00,応募書類30件の確認,Tran Thi B,40,Done,Tran Thi B,2026/10/12 11:30:00
102401,スポット求人作成,求人更新,SHOT,BPO-A,ONETIME,NEW,2026/10/12,18:00,45,Done,https://docs.google.com/spreadsheets/d/1shot/edit#gid=7242854&range=4:4,Yamada,2026/10/12 09:30:00,新規求人バナー作成,Nguyen Van A,40,Done,Nguyen Van A,2026/10/12 13:45:00
102402,原稿修正,求人更新,SHOT,BPO-A,ONETIME,EDIT,2026/10/12,18:00,30,Done,https://docs.google.com/spreadsheets/d/1shot/edit#gid=7242854&range=5:5,Sato,2026/10/12 10:00:00,給与条件テキスト修正,Tran Thi B,25,Done,Tran Thi B,2026/10/12 14:10:00
102504,ディップ 旧掲載停止,求人更新,DIP,BPO-A,DAILY,STOP,2026/10/12,18:00,30,Done,,Tanaka,2026/10/12 10:00:00,停止中案件の誤送信タスク,Pham Duc D,20,Done,Pham Duc D,2026/10/12 14:35:10
102505,ネオキャリア 都度原稿差し替え,求人更新,NEO,BPO-A,DAILY,REPLACE,2026/10/12,18:00,40,Done,https://docs.google.com/spreadsheets/d/1kyujin/edit#gid=1828959786&range=8:8,Sato,2026/10/12 10:30:00,メイン画像の差し替え作業,Tran Thi B,35,Done,Nguyen Van A,2026/10/12 15:00:22
102403,バナー差し替え,求人更新,SHOT,BPO-A,ONETIME,BANNER,2026/10/12,18:00,60,Done,https://docs.google.com/spreadsheets/d/1shot/edit#gid=7242854&range=6:6,Suzuki,2026/10/12 11:00:00,採用バナー差し替え,Le Hoang C,10,Done,Le Hoang C,2026/10/12 15:20:00
102404,緊急掲載,求人更新,SHOT,BPO-A,ONETIME,URGENT,2026/10/12,18:00,30,Done,https://docs.google.com/spreadsheets/d/1shot/edit#gid=7242854&range=7:7,Yamada,2026/10/12 11:30:00,緊急掲載の原稿反映,Nguyen Van A,85,Done,Nguyen Van A,2026/10/12 16:15:00
102506,日次メンテナンス,求人更新,TEST,BPO-A,DAILY,MAINT,2026/10/12,18:00,30,Done,https://docs.google.com/spreadsheets/d/1kyujin/edit#gid=1828959786&range=9:9,Yamada,2026/10/12 13:00:00,リンク導線チェック,Nguyen Van A,0,Done,Nguyen Van A,2026/10/12 16:40:00
102405,条件変更,求人更新,DIP,BPO-A,ONETIME,UPDATE,2026/10/12,18:00,30,Done,,Tanaka,2026/10/12 13:30:00,勤務地情報の更新,,25,Done,Pham Duc D,2026/10/12 16:50:00
99999,桁数不正タスク,求人更新,ERR,BPO-A,DAILY,ERR,2026/10/12,18:00,20,Done,,Tanaka,2026/10/12 14:00:00,5桁IDの異常データ,Pham Duc D,20,Done,Pham Duc D,2026/10/12 17:00:00
888888,未登録タスク,求人更新,ERR,BPO-A,DAILY,ERR,2026/10/12,18:00,30,Done,,Tanaka,2026/10/12 14:00:00,シート未記載のDymtask,Pham Duc D,30,Done,Pham Duc D,2026/10/12 17:05:00
102502,マイナビ 週次エントリー確認,求人更新,MYNAVI,BPO-A,DAILY,CHECK,2026/10/12,18:00,45,Done,https://docs.google.com/spreadsheets/d/1kyujin/edit#gid=1828959786&range=5:5,Sato,2026/10/12 09:15:00,応募書類30件の確認,Tran Thi B,40,Done,Tran Thi B,2026/10/12 11:30:00
102401,スポット求人作成,求人更新,SHOT,BPO-A,ONETIME,NEW,2026/10/12,18:00,45,Done,https://docs.google.com/spreadsheets/d/1shot/edit#gid=7242854&range=99:99,Yamada,2026/10/12 09:30:00,NOTEリンク先の行不一致,Nguyen Van A,40,Done,Nguyen Van A,2026/10/12 13:45:00
102407,新規求人枠作成,求人更新,QUICK,BPO-A,ONETIME,NEW,2026/10/12,18:00,60,Done,https://docs.google.com/spreadsheets/d/1shot/edit#gid=7242854&range=10:10,Suzuki,2026/10/12 14:00:00,新規枠作成作業,Le Hoang C,50,In Progress,Le Hoang C,2026/10/12 17:10:00
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信1,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:30:10
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信2,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:30:25
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信3,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:30:40
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信4,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:31:05
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信5,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:31:30
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信6,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:31:55
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信7,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:32:15
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信8,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:32:40
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信9,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:33:05
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信10,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:33:30
102501,リクルート 求人日次更新,求人更新,BURST,BPO-A,DAILY,BULK,2026/10/12,18:00,10,Done,,Yamada,2026/10/12 17:20:00,確認メール送信11,Nguyen Van A,10,Done,Nguyen Van A,2026/10/12 17:34:00`;

// Alias for compatibility
export const SAMPLE_DUMMY_TODO_CSV = SAMPLE_DYMTASK_TODO_CSV;
