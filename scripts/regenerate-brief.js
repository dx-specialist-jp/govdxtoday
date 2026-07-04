// 使い方: GEMINI_API_KEY=xxx node scripts/regenerate-brief.js [YYYY-MM-DD] ...
//         省略時は最新3日分を対象にする

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSummaryPoints, generateActionBrief, buildSummaryInput, isFatalGeminiError, DATA_DIR, getRecentDates } from './gemini-utils.js';

// brief・summary の生成プロンプト本体は gemini-utils.js の
// generateActionBrief / generateSummaryPoints（generate-content.js と共通）を使用

async function main() {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  if (!process.env.GEMINI_API_KEY) {
    console.error('[ERROR] GEMINI_API_KEY が未設定です');
    process.exit(1);
  }

  let targets = process.argv.slice(2);
  if (targets.length === 0) {
    // デフォルトは直近3日分（前々日・前日・今日）。連続2日障害まで回収できる
    targets = getRecentDates(3);
  }
  console.log(`[INFO] 対象日: ${targets.join(', ')}`);

  let aborted = false;

  for (const [i, date] of targets.entries()) {
    const path = resolve(DATA_DIR, `${date}.json`);
    let data;
    try {
      data = JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      console.warn(`[WARN] ${date}.json が見つかりません`);
      continue;
    }

    const topics = data.news_topics || [];
    if (topics.length === 0) {
      console.log(`[INFO] ${date}: ニューストピックなし → スキップ`);
      continue;
    }

    const needsBrief = !data.news_topics_brief || data.news_topics_brief.length === 0;
    const needsSummary = !data.news_summary || data.news_summary.length === 0;
    if (!needsBrief && !needsSummary) {
      console.log(`[INFO] ${date}: brief・summary 既存 → スキップ`);
      continue;
    }

    console.log(`[INFO] ${date}: brief・summary を逐次生成中...`);

    // brief と summary はそれぞれ生成でき次第すぐ保存する。
    // 一方が致命的エラー（クォータ0・呼び出し上限到達）で中断しても、
    // 既に生成できた方を失わないようにするため。
    if (needsBrief) {
      try {
        const brief = await generateActionBrief(topics, model);
        if (brief !== null) {
          data.news_topics_brief = brief;
          writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
        }
      } catch (err) {
        if (isFatalGeminiError(err)) {
          console.error(`::error::Gemini呼び出しを${date}以降で中断しました（${err.zeroQuota ? 'クォータ割当0' : '呼び出し上限到達'}）。`);
          process.exitCode = 1;
          aborted = true;
          break;
        }
        throw err;
      }
      // brief と summary の間に少し間を置いてレート制限を回避
      if (needsSummary) await new Promise((r) => setTimeout(r, 5000));
    }

    if (needsSummary) {
      try {
        const summary = await generateSummaryPoints(buildSummaryInput(data.hero_article, data.sub_articles, data.news_topics), model);
        if (summary !== null) {
          data.news_summary = summary;
          writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
        }
      } catch (err) {
        if (isFatalGeminiError(err)) {
          console.error(`::error::Gemini呼び出しを${date}以降で中断しました（${err.zeroQuota ? 'クォータ割当0' : '呼び出し上限到達'}）。`);
          process.exitCode = 1;
          aborted = true;
          break;
        }
        throw err;
      }
    }

    console.log(`[INFO] ${date}: 更新完了`);

    // 複数日処理時の連続 API 呼び出しによるレート制限を避けるため日付間で休止
    // （最後の日付の後は次の呼び出しがないので待機不要）
    if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 30000));
  }

  console.log(aborted ? '[INFO] 中断（一部日付は未処理）' : '[INFO] 完了');
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
