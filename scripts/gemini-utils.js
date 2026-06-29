export async function callGemini(model, prompt) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const m = genai.getGenerativeModel({ model });

  // retryDelay をエラー本文から取得（秒単位。見つからなければ 65 秒）
  function extractRetryDelay(msg) {
    const match = msg.match(/retryDelay["\s:]+(\d+)s/);
    return match ? (parseInt(match[1], 10) + 5) * 1000 : 65000;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await m.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      const msg = String(err.message);
      const is429 = msg.includes('429');
      if (is429 && attempt < 2) {
        // RPM超過は retryDelay に従い待機してリトライ。RPD超過（retryDelay なし）も試みる
        const wait = extractRetryDelay(msg);
        console.warn(`[WARN] Gemini 429 - ${Math.round(wait / 1000)}秒後にリトライ (${attempt + 1}/2)`);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

export function parseJsonFromText(text) {
  const cleaned = text
    .replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
  return JSON.parse(cleaned);
}
