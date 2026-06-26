import { useState, useEffect } from 'react';

export default function SectionNav({ hasSecurityAlert, hasSummary, hasPickup }) {
  const sections = [
    ...(hasSecurityAlert ? [{ id: 'sec-security', label: '速報', alert: true }] : []),
    ...(hasSummary ? [{ id: 'sec-summary', label: '今日のポイント' }] : []),
    ...(hasPickup ? [{ id: 'sec-pickup', label: 'ピックアップ' }] : []),
    { id: 'sec-news', label: 'ニュース' },
  ];
  const [active, setActive] = useState(sections[0]?.id ?? 'sec-news');

  useEffect(() => {
    const ids = sections.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-15% 0px -65% 0px', threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [hasSecurityAlert, hasSummary, hasPickup]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const navOffset = 52 + 42; // header + section-nav height
    const top = el.getBoundingClientRect().top + window.scrollY - navOffset - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <nav className="section-nav" aria-label="セクションナビゲーション">
      <div className="section-nav-inner">
        {sections.map((s) => (
          <button
            key={s.id}
            className={`section-nav-btn${s.alert ? ' alert' : ''}${active === s.id ? ' active' : ''}`}
            onClick={() => scrollTo(s.id)}
            aria-current={active === s.id ? 'true' : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
