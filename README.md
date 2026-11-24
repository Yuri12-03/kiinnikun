# kiinnikun

鍛えたい部位とジムの利用可否から、Geminiがトレーニングメニューを提案する個人用アプリです。

## Issue #1の範囲

- 部位を複数選択し、ジム利用可否を入力する。
- AIが種目を実施順に提案し、セット数・回数・休憩時間をカードで表示する。
- 提案理由を開閉し、条件を変えて再提案する。
- 入力エラー、生成中、通信失敗、利用制限、回答不備を扱う。
- メニュー保存、種目の差し替え、身長・体重と重量提案、実績記録は次のIssue。

## 構成

```text
mobile/                         Expo SDK 58 / React Native / Expo Router
supabase/functions/_shared/      種目カタログ・入出力の検証（アプリと共用）
supabase/functions/generate-menu/ 本人確認 → 回数制限 → Gemini → 回答検証
supabase/migrations/             日本時間で1日10回のリクエスト制限
tests/                          ドメインとサーバー処理の自動テスト
```

アプリにはSupabaseの公開用キーだけを入れます。GeminiキーはEdge FunctionのSecretsに保管します。
個人用のため、アプリ内での新規ユーザー登録は設けず、許可した1アカウントのみAIに接続できます。

## 1. ローカルで起動する

Node.js 24.13以降とnpmを使用します。リポジトリのルートで実行してください。

```powershell
npm ci
npm start
```

スマホとPCを同じWi-Fiにつなぎ、SDK 58対応のExpo GoでQRコードを開きます。iPhoneはカメラ、AndroidはExpo Goから読み取れます。
SDKが一致しない場合はExpo Goを更新するか、対応するdevelopment buildを使用します。WindowsではiOSシミュレーターを起動できないため、iPhone実機で確認してください。

ブラウザでレイアウトを確認する場合：

```powershell
npm run web
```

環境変数をまだ設定していなくても条件入力画面は開けます。「AIへの接続を準備中です」と表示され、AI提案は実行できません。ダミー回答への自動切り替えはありません。

### スマホで接続できない場合

PCとスマホが同じWi-Fiでも、学内・公共Wi-Fiなどでは端末間通信が制限される場合があります。Expo Goが接続中のままになったり「Something went wrong」と表示されたりする場合は、詳細なエラーログを確認してください。通信が原因の場合は、通常の開発サーバーを`Ctrl + C`で停止し、次でトンネル接続を起動できます。

```powershell
npm run start:tunnel
```

ターミナルに新しく表示されたQRコードをExpo Goで読み取ります。古いQRコードは使用しません。トンネルではPC・スマホの両方にインターネット接続が必要ですが、同じWi-Fiである必要はありません。通常のLAN接続より起動や再読み込みに時間がかかります。[Expo公式](https://docs.expo.dev/more/expo-cli/#tunneling)

SDKの不一致やJavaScriptのエラーはトンネルでは解決しないため、Expo Goの「View error log」の内容を確認します。

## 2. Geminiの無料枠を準備する

1. [Google AI StudioのAPI keys](https://aistudio.google.com/api-keys)でプロジェクトとAPIキーを作成します。
2. 利用プロジェクトがFree Tierで、課金が有効になっていないことを確認します。
3. 初期モデルは`gemini-3.1-flash-lite`です。[公式料金表](https://ai.google.dev/gemini-api/docs/pricing)とAI Studioで、そのプロジェクトでの無料枠・利用可否・制限を確認します。
4. `supabase/.env.example`を`supabase/.env.local`にコピーし、`GEMINI_API_KEY`を入力します。キーはチャットやIssueに貼らないでください。

このアプリから課金を有効化したり、別モデルに自動切り替えたりはしません。無料枠はGoogle側のモデル・アカウント・条件に依存し、アプリ側で課金状態を判別するものではありません。
無料枠では送信内容・回答が製品改善に利用される場合があります。入力する内容は部位・ジム利用可否と種目データです。

## 3. Supabaseの無料プロジェクトと本人用アカウントを作る

1. [Supabase Dashboard](https://supabase.com/dashboard)からFreeプランのプロジェクトを作成します。DBパスワードはパスワードマネージャーなどに保存します。
2. プロジェクトのAuthentication → Users → Add userで、自分用のメールアドレスとパスワードを設定します。確認済みユーザーとして作成します。
3. 個人利用ではAuthenticationの設定で一般ユーザーの新規登録を無効にし、匿名サインインも有効にしません。
4. 作成したユーザーのUUIDを`supabase/.env.local`の`ALLOWED_USER_ID`に入力します。
5. ConnectまたはProject SettingsからProject URLと**Publishable key**を取得します。`mobile/.env.example`を`mobile/.env.local`にコピーし、2項目を入力します。

```dotenv
# mobile/.env.local：公開されてもよいSupabaseの接続先と公開用キーのみ
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Legacy anon keyも公開用キーとして利用できます。`service_role`・`sb_secret_...`やGeminiキーは絶対にここに入れません。
`.env.local`はGit管理対象外です。アプリのログイン画面にはここで作成した本人用アカウントを使用します。

## 4. サーバー処理をデプロイする

Supabase CLIは`npx supabase`で実行できます。初回のCLI取得にはインターネット接続が必要です。
ルートで実行し、ログインは開いたブラウザで本人が行います。

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --remote --yes
npx supabase secrets set --env-file supabase/.env.local --yes
npx supabase functions deploy generate-menu --use-api --yes
```

`YOUR_PROJECT_REF`はDashboard URLの`/project/`に続くIDです。CLI 3では`db push`に`--remote`を付けて接続済みのクラウドDBを指定します。`--use-api`を付けるとDockerを起動せずに関数をデプロイできます。
このリポジトリ専用の新規プロジェクトへデプロイしてください。既存アプリ用のDBへ適用する場合は、先に差分を確認してください。

Secretsは次の3項目です。`SUPABASE_URL`と`SUPABASE_ANON_KEY`はSupabaseが関数へ自動提供します。

| 項目 | 値 |
| --- | --- |
| `GEMINI_API_KEY` | GeminiのAPIキー |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `ALLOWED_USER_ID` | 作成した本人アカウントのUUID |

新しい署名鍵にも対応するため、プラットフォームのlegacy JWT検証を`config.toml`で無効にし、関数内でSupabase Authの`/user`を呼んでJWTを検証しています。さらにユーザーIDを`ALLOWED_USER_ID`と照合します。公開用キーだけではGeminiを呼び出せません。

DBのリクエストカウンターは原子的に更新され、同時リクエストでも1日10回を超えません。日付は日本時間です。Geminiのエラーも送信後は1回として数え、制限を迂回する自動再試行は行いません。Google側の上限は別に適用されます。

## 5. 本物の提案を確認する

1. 環境変数の変更後は開発サーバーを止め、次のコマンドでキャッシュをクリアして起動します。

   ```powershell
   npm --workspace @kiinnikun/mobile run start -- --clear
   ```

2. 実機で開き、作成した本人用アカウントでログインします。
3. 「脚」「ジムを使える」を選び、提案を表示します。
4. 戻って「ジムは使わない」に変え、器具不要の種目だけになることを確認します。
5. 提案理由を開閉し、複数部位でも試します。
6. 通信を切った場合のエラーと再試行を確認します。

種目の回数は片側ずつの場合「左右それぞれ」と表示します。重量は今回提案しません。所要時間はアプリ側の概算です。
種目カタログの器具・部位、件数・数値・部位のカバーを検証しますが、AI提案の医学的な妥当性や効果を保証する検証ではありません。

## 開発用チェック

```powershell
npm run typecheck
npm run lint
npm test
```

```powershell
# Web向けのバンドル確認（ネイティブ実機確認の代替ではありません）
npm --workspace @kiinnikun/mobile exec -- expo export --platform web
```

GitHub Actionsで型チェック・lint・テスト・Webバンドルを実行します。
テストはGeminiとSupabaseの通信をモックし、外部APIを利用しません。認証拒否、利用回数制限、器具条件、未知の種目、回答不備、タイムアウトなどを確認します。
DBマイグレーションの実行、実際の認証とGemini接続、iPhone・Android実機の確認結果は[検証記録](docs/issue-1-validation.md)に記録します。

デプロイ後のAPI疎通確認には、リポジトリのルートで次を実行できます。

```powershell
./scripts/smoke-deployment.ps1
```

このスクリプトはSupabase CLIのログイン済み管理権限を使用し、許可された確認済みユーザーの一時セッションを発行して、実際のAI提案を2回依頼します。メールやパスワードの入力は不要で、キーやセッションを表示・ファイル保存しません。最後にテスト用セッションをログアウトします。AI利用枠とアプリの1日上限を2回分使います。スマホ画面の操作確認は別途必要です。

## 参考

- [Expo Routerの導入](https://docs.expo.dev/router/installation/)
- [Gemini APIの構造化出力](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini APIリファレンス](https://ai.google.dev/api/generate-content)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
