# GovDX Today

中央省庁PMO/PJMO担当者向けの行政DX・AI活用・クラウド情報を毎日自動収集・キュレーションするサイト。
GitHub Pages で公開、非営利・非商業目的。

**公開URL:** https://dx-specialist-jp.github.io/govdxtoday/

---

## アーキテクチャ

```
RSS/Atom フィード収集
  └─ scripts/generate-content.js
       ├─ Gemini API でフィルタリング・要約・記事ごとのPMO/PJMOアクション生成
       └─ public/data/YYYY-MM-DD.json に保存
            └─ npm run build → docs/ → GitHub Pages デプロイ
```

**スタック:**
- フロントエンド: React 18 + React Router v6 + Vite (HashRouter, SPA)
- ホスティング: GitHub Pages (`docs/` ディレクトリ)
- CI/CD: GitHub Actions (`.github/workflows/daily-update.yml`) — 毎日 UTC 14:00 実行
- AI: Google Gemini API (`gemini-2.5-flash-lite`) — フィルタリング・要約・PMO対応ポイント生成

---

## ディレクトリ構成

```
scripts/
  generate-content.js   # メイン生成スクリプト（日次 GitHub Actions から実行）
  regenerate-brief.js   # 既存データへの news_summary 再生成（手動実行用）
  gemini-utils.js       # Gemini API 共通ユーティリティ（callGemini, parseJsonFromText）
src/
  components/
    DigestView.jsx      # ページ全体のレイアウト
    NewsTopics.jsx      # ニューストピック一覧（記事ごとにPMO/PJMOアクションを併記したカード）
    NewsSummary.jsx     # 今日のポイント
    HeroArticle.jsx     # 注目記事（最高優先度の政府記事）
    SubArticles.jsx     # サブ記事（重要度 3 以上の政府記事）
    SecurityBanner.jsx  # セキュリティ速報バナー
    SectionNav.jsx      # セクション内ナビゲーション
    Sidebar.jsx         # サイドバー（タグ・アーカイブ）
    Header.jsx          # ヘッダー
public/data/
  YYYY-MM-DD.json       # 日次データ（generate-content.js が出力）
  index.json            # 日付一覧・メタ情報
  tags.json             # カテゴリタグインデックス
docs/                   # Vite ビルド出力 → GitHub Pages が参照
```

---

## JSON データ構造

```json
{
  "date": "2026-06-28",
  "date_ja": "2026年6月28日（日）",
  "news_summary": ["今日のポイント1", "..."],
  "security_alerts": [{ "title": "...", "url": "...", "source": "..." }],
  "hero_article": { "section_name", "title", "summary", "source_name", "source_url", "pub_date" },
  "sub_articles": [...],
  "news_topics": [{ "title", "summary", "relevance", "category", "source", "url", "score" }],
  "cloud_updates": [{ "provider", "items": [{ "title", "url", "pub_date", "source" }] }],
  "generated_at": "2026-06-28T00:00:00.000Z"
}
```

`cloud_updates` はガバメントクラウド認定CSP各社（AWS/Azure/Google Cloud/Oracle Cloud/さくらインターネット）の公式RSSをそのまま掲載するセクションで、
Gemini APIによるAI要約は行わない（`generate-content.js` の他のGemini呼び出しとは独立して常に生成される）。プロバイダごとに直近
`CLOUD_ITEMS_PER_PROVIDER`（既定5件）を新しい順に掲載する。

`news_topics[].relevance` は各記事カードの「PMO/PJMOが取るべきアクション」欄に表示される、記事ごとの対応・確認事項（1文）。Gemini生成が得られない場合も
`generate-content.js` の `DEFAULT_RELEVANCE` で必ず埋められ、カードの表示構成（タイトル→サマリー→区切り線→アクション→出典）は日によって変わらない。

**カテゴリ一覧（news_topics.category）:**
`セキュリティ` / `行政AI` / `行政DX` / `AI活用` / `クラウド/インフラ` / `制度/ガイドライン` / `自治体DX事例` / `調達・契約` / `働き方/業務改革` / `その他`

---

## セットアップ

```bash
npm install
```

**環境変数（GitHub Actions Secrets に登録）:**

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `GEMINI_API_KEY` | 必須 | Google Gemini API キー |
| `GEMINI_MODEL` | 任意 | 省略時: `gemini-2.5-flash-lite` |

---

## 開発

```bash
# 開発サーバー起動
npm run dev

# コンテンツ生成（要 GEMINI_API_KEY）
GEMINI_API_KEY=xxx npm run generate

# 特定日を指定して生成
GEMINI_API_KEY=xxx TARGET_DATE=2026-06-28 npm run generate

# ビルド
npm run build
```

---

## 保守手順

### 日次更新が失敗したとき

1. GitHub Actions の `Daily Content Update` ログを確認
2. Gemini API クォータ超過の場合は翌日に自動復旧（RPD 日次上限）
3. 手動で特定日を再生成する場合:
   ```bash
   GEMINI_API_KEY=xxx TARGET_DATE=2026-06-28 npm run generate
   git add public/data/ && git commit -m "chore: 手動更新 2026-06-28"
   git push
   ```

### 既存データに news_summary を追加したいとき

APIキー不足や旧コードで生成されたデータに `news_summary` を後付けで追加できる:

```bash
# 特定日を指定
GEMINI_API_KEY=xxx node scripts/regenerate-brief.js 2026-06-27 2026-06-28

# 省略すると直近3日分
GEMINI_API_KEY=xxx node scripts/regenerate-brief.js
```

- `news_summary` はフィールドが既存の場合はスキップ（上書きしない）

### ワークフローを手動トリガーするとき

GitHub の `Actions` タブ → `Daily Content Update` → `Run workflow` → `target_date` に `YYYY-MM-DD` を入力。

### 情報源を追加・変更したいとき

`scripts/generate-content.js` の先頭にある定数を編集:

- `GOV_SOURCES` — 政府公式 RSS（JPCERT/CC・IPA・NISC・デジタル庁など）
- `GOOGLE_ALERT_SOURCES` — Google Alerts の RSS URL
- `CLOUD_SOURCES` — ガバメントクラウド認定CSP公式 RSS（AI要約なし、`cloud_updates` にそのまま掲載）

### Gemini モデルを変更したいとき

GitHub Secrets の `GEMINI_MODEL` に新モデル名を設定するか、生成コマンドに環境変数を指定:

```bash
GEMINI_API_KEY=xxx GEMINI_MODEL=gemini-2.5-flash npm run generate
```

### GitHub Pages のデプロイが失敗したとき

`docs/` ディレクトリが古い場合はローカルでビルドしてプッシュ:

```bash
npm run build
git add docs/ && git commit -m "chore: 手動ビルド"
git push
```

---

## Gemini API の重要度スコア基準

| スコア | 意味 | 対応 |
|--------|------|------|
| 5 | 即時対応必須（CVE・施行間近のガイドライン改定） | セキュリティバナーに表示 |
| 4 | 今月中に確認（新ガイドライン・調達制度変更） | 注目記事・サブ記事に表示 |
| 3 | 四半期以内に把握（行政DX動向・AI導入事例） | 注目記事・サブ記事に表示 |
| 2 | 参考情報（業界トレンド・海外事例） | ニューストピックに統合 |
| 1 | PMO/PJMO業務に直接関係しない | 除外 |

スコア 1 になる記事パターン（内容不問）: 開催案内のみ・議事録掲載通知・入札公告・人事情報・市民向け広報
