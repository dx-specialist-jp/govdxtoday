import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

const BASE = import.meta.env.BASE_URL;

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function getTodayJST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

function pad(n) { return String(n).padStart(2, '0'); }

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-indexed
}

function buildCalendarDays(year, month) {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=日
  const daysInMonth = getDaysInMonth(year, month);
  const days = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, date: `${year}-${pad(month)}-${pad(d)}` });
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function CalendarDay({ cell, dateMap, today }) {
  if (!cell) {
    return <div className="cal-day cal-empty" aria-hidden="true" />;
  }
  const info = dateMap.get(cell.date);
  const isToday = cell.date === today;
  const isAvailable = !!info;

  const cls = [
    'cal-day',
    isAvailable ? 'cal-available' : '',
    isToday ? 'cal-today' : '',
    info?.has_security_alert ? 'cal-alert' : '',
  ].filter(Boolean).join(' ');

  const numEl = <span className="cal-day-num">{cell.day}</span>;
  const dotEl = isAvailable ? <span className="cal-day-dot" aria-hidden="true" /> : null;

  if (!isAvailable) {
    return (
      <div className={cls} aria-label={`${cell.date} 記事なし`}>
        {numEl}
      </div>
    );
  }

  return (
    <Link
      to={`/day/${cell.date}`}
      className={cls}
      title={info.summary_short || cell.date}
      aria-label={`${cell.date}${info.has_security_alert ? ' セキュリティ速報あり' : ''}`}
    >
      {numEl}
      {dotEl}
    </Link>
  );
}

function Calendar({ year, month, dateMap, today }) {
  const days = useMemo(() => buildCalendarDays(year, month), [year, month]);
  return (
    <div className="cal-grid" role="grid" aria-label={`${year}年${month}月カレンダー`}>
      {WEEKDAYS.map((wd, i) => (
        <div
          key={wd}
          className={`cal-header${i === 0 ? ' cal-sun' : i === 6 ? ' cal-sat' : ''}`}
          role="columnheader"
          aria-label={`${wd}曜日`}
        >
          {wd}
        </div>
      ))}
      {days.map((cell, i) => (
        <CalendarDay key={i} cell={cell} dateMap={dateMap} today={today} />
      ))}
    </div>
  );
}

export default function Archive() {
  const [index, setIndex] = useState(null);
  const [error, setError] = useState(null);
  const today = useMemo(() => getTodayJST(), []);
  const todayParts = today.split('-').map(Number);

  const [viewYear, setViewYear] = useState(todayParts[0]);
  const [viewMonth, setViewMonth] = useState(todayParts[1]);

  useEffect(() => {
    fetch(`${BASE}data/index.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setIndex)
      .catch((e) => setError(e.message));
  }, []);

  // date → info のマップ
  const dateMap = useMemo(() => {
    const m = new Map();
    for (const d of (index?.dates || [])) m.set(d.date, d);
    return m;
  }, [index]);

  const sortedDates = useMemo(
    () => [...(index?.dates || [])].sort((a, b) => b.date.localeCompare(a.date)),
    [index]
  );

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  const isCurrentMonth = viewYear === todayParts[0] && viewMonth === todayParts[1];

  if (error) {
    return (
      <>
        <div className="page-dark-header">
          <div className="page-dark-header-inner">
            <p className="page-dark-eyebrow">Archive</p>
            <h1 className="page-dark-title">アーカイブ</h1>
          </div>
        </div>
        <div className="main-content">
          <div className="error-box" role="alert">読み込みエラー: {error}</div>
        </div>
      </>
    );
  }

  if (!index) return <div className="loading" role="status" aria-live="polite">読み込み中</div>;

  return (
    <>
      <div className="page-dark-header">
        <div className="page-dark-header-inner">
          <p className="page-dark-eyebrow">Archive</p>
          <h1 className="page-dark-title">アーカイブ</h1>
          <p className="page-dark-subtitle">
            {sortedDates.length > 0 ? `過去 ${sortedDates.length} 日分` : 'データなし'}
          </p>
        </div>
      </div>

      <div className="main-content">
        {/* カレンダー */}
        <div className="digest-section">
          <p className="section-label">日付から選ぶ</p>
          <div className="cal-wrapper">
            {/* 月ナビゲーション */}
            <div className="cal-nav">
              <button
                className="cal-nav-btn"
                onClick={prevMonth}
                aria-label="前の月"
              >
                ‹
              </button>
              <p className="cal-nav-title" aria-live="polite">
                {viewYear}年 {MONTH_NAMES[viewMonth - 1]}
              </p>
              <button
                className="cal-nav-btn"
                onClick={nextMonth}
                disabled={isCurrentMonth}
                aria-label="次の月"
                aria-disabled={isCurrentMonth}
              >
                ›
              </button>
            </div>

            {/* 凡例 */}
            <div className="cal-legend" aria-label="凡例">
              <span className="cal-legend-item">
                <span className="cal-legend-dot cal-legend-normal" aria-hidden="true" />
                記事あり
              </span>
              <span className="cal-legend-item">
                <span className="cal-legend-dot cal-legend-alert" aria-hidden="true" />
                速報あり
              </span>
              <span className="cal-legend-item">
                <span className="cal-legend-today-sample" aria-hidden="true">1</span>
                今日
              </span>
            </div>

            <Calendar
              year={viewYear}
              month={viewMonth}
              dateMap={dateMap}
              today={today}
            />
          </div>
        </div>

        {/* 最近のダイジェスト一覧 */}
        {sortedDates.length > 0 && (
          <div className="digest-section">
            <p className="section-label">最近のダイジェスト</p>
            <nav className="date-list" aria-label="最近の日付一覧">
              {sortedDates.slice(0, 14).map((item) => {
                const [y, m, d] = item.date.split('-').map(Number);
                return (
                  <Link key={item.date} to={`/day/${item.date}`} className="date-list-item">
                    <div className="date-badge" aria-hidden="true">
                      <div className="date-badge-month">{m}月</div>
                      <div className="date-badge-day">{d}</div>
                    </div>
                    <div className="date-list-body">
                      <div className="date-list-title">{item.summary_short}</div>
                      <div className="date-list-meta">
                        {item.date}
                        {item.article_count > 0 && ` · ${item.article_count}件`}
                      </div>
                    </div>
                    {item.has_security_alert && (
                      <span className="security-pill" aria-label="セキュリティ速報あり">速報</span>
                    )}
                    <span className="date-list-arrow" aria-hidden="true">›</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {sortedDates.length === 0 && (
          <div className="empty-state">
            <strong>まだコンテンツがありません</strong>
            <p>夜間バッチが実行されると、カレンダーに日付が表示されます。</p>
          </div>
        )}
      </div>
    </>
  );
}
