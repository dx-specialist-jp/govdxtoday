/**
 * verify-daily-content.js
 * generate-content.js / regenerate-brief.js の実行後に、当日分の AI要約
 * （news_summary）とアクションブリーフ（news_topics_brief）が実際に生成できて
 * いるかを検証する。
 *
 * これまで両スクリプトはどちらも「失敗時は null のまま保存し、後続の補完処理に
 * 委ねる」設計になっており、最終的に補完も失敗した場合でもワークフロー自体は
 * continue-on-error により成功扱いになっていた。その結果、Gemini API側の障害
 * （クォータ枯渇・モデル廃止など）が数週間気づかれないまま放置されていた。
 * このスクリプトはその失敗を確実にワークフローの失敗として可視化する。
 *
 * hero_article / sub_articles / news_topics が揃わない（＝その日は要約対象と
 * なる記事が無かった）日は、news_summary / news_topics_brief が null のままでも
 * 正常系であり、gemini-utils.js の generateSummaryPoints / generateActionBrief も
 * 意図的に null を返す。この場合まで失敗扱いにすると、記事が少ない/無い日に
 * 毎回誤検知することになるため、要約対象となる元記事が実際に存在した場合のみ
 * 検証対象とする。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATA_DIR, getTodayJST } from './gemini-utils.js';

const targetDate = process.env.TARGET_DATE || getTodayJST();
const path = resolve(DATA_DIR, `${targetDate}.json`);

let data;
try {
  data = JSON.parse(readFileSync(path, 'utf-8'));
} catch (err) {
  console.error(`::error::${targetDate}.json の読み込みに失敗しました: ${err.message}`);
  process.exit(1);
}

// generateSummaryPoints への入力（buildSummaryInput）は hero_article/sub_articles/news_topics
// のいずれかがあれば非空になる。generateActionBrief への入力は news_topics のみ。
const hasSummaryInput = Boolean(data.hero_article) ||
  (Array.isArray(data.sub_articles) && data.sub_articles.length > 0) ||
  (Array.isArray(data.news_topics) && data.news_topics.length > 0);
const hasBriefInput = Array.isArray(data.news_topics) && data.news_topics.length > 0;

const missing = [];
if (hasSummaryInput && (!Array.isArray(data.news_summary) || data.news_summary.length === 0)) {
  missing.push('news_summary');
}
if (hasBriefInput && (!Array.isArray(data.news_topics_brief) || data.news_topics_brief.length === 0)) {
  missing.push('news_topics_brief');
}

if (missing.length > 0) {
  console.error(
    `::error::${targetDate}: AI要約の生成に失敗しています（欠落フィールド: ${missing.join(', ')}）。` +
    'Gemini APIキー・GEMINI_MODELの有効性・クォータ状況（Google AI Studio）を確認してください。'
  );
  process.exit(1);
}

if (!hasSummaryInput && !hasBriefInput) {
  console.log(`[INFO] ${targetDate}: 要約対象の記事が無いため検証をスキップしました`);
} else {
  console.log(`[INFO] ${targetDate}: news_summary / news_topics_brief の生成を確認しました`);
}
