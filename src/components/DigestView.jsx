import { Link } from 'react-router-dom';
import SecurityBanner from './SecurityBanner.jsx';
import SectionNav from './SectionNav.jsx';
import NewsSummary from './NewsSummary.jsx';
import HeroArticle from './HeroArticle.jsx';
import SubArticles from './SubArticles.jsx';
import NewsTopics from './NewsTopics.jsx';

function formatUpdatedAt(isoStr) {
  if (!isoStr) return null;
  try {
    return new Date(isoStr).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' JST';
  } catch {
    return null;
  }
}

function HeroSection({ data, showBackLink }) {
  const updatedAt = formatUpdatedAt(data.generated_at);
  const heroCount = (data.hero_article ? 1 : 0) + (data.sub_articles?.length || 0);
  const newsCount = data.news_topics?.length || 0;

  return (
    <div className="hero-section">
      <div className="hero-inner">
        {showBackLink && (
          <Link to="/archive" className="hero-back">← アーカイブに戻る</Link>
        )}
        <p className="hero-eyebrow">Daily Digest</p>
        <h1 className="hero-date">{data.date_ja || data.date}</h1>
        <p className="hero-tagline">行政DX・AI活用 最新情報ダイジェスト</p>
        <div className="hero-stats">
          {heroCount > 0 && (
            <span className="hero-stat-item">
              <span className="hero-stat-dot" />
              注目記事 {heroCount}本
            </span>
          )}
          {newsCount > 0 && (
            <span className="hero-stat-item">
              <span className="hero-stat-dot" />
              ニュース {newsCount}件
            </span>
          )}
          {updatedAt && (
            <span className="hero-stat-item">最終更新: {updatedAt}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DigestView({ data, showBackLink = false }) {
  if (!data) return null;

  const hasSecurityAlert = (data.security_alerts?.length || 0) > 0;

  return (
    <>
      <HeroSection data={data} showBackLink={showBackLink} />
      <SectionNav hasSecurityAlert={hasSecurityAlert} />

      {hasSecurityAlert && (
        <div id="sec-security">
          <SecurityBanner alerts={data.security_alerts} />
        </div>
      )}

      <div className="main-content">
        <NewsSummary points={data.news_summary} />

        <div id="sec-pickup">
          <HeroArticle article={data.hero_article} />
          <SubArticles articles={data.sub_articles} />
        </div>

        <div id="sec-news">
          <NewsTopics topics={data.news_topics} />
        </div>
      </div>
    </>
  );
}
