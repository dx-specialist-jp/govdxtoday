import { useState, useEffect } from 'react';

const BASE = import.meta.env.BASE_URL;

// public/data/ 配下のJSONを取得する共通フック。DayPage・Archive・TagPage で
// 個別実装されていた「フェッチ→setState→エラーハンドリング」を1箇所に集約する。
// path が変わるたびに再フェッチし、フェッチ開始時に data/error をリセットする
// （例: DayPage で日付を変えたときに前の日付のデータが一瞬残るのを防ぐ）
export function useJsonData(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) return;
    setData(null);
    setError(null);
    fetch(`${BASE}${path}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [path]);

  return { data, error };
}
