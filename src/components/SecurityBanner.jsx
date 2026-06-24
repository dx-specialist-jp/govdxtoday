export default function SecurityBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="security-banner" role="alert" aria-label="セキュリティ速報">
      {alerts.map((alert, i) => (
        <div key={i} className="security-banner-inner">
          <span className="security-banner-label">セキュリティ速報</span>
          <div>
            <span className="security-banner-title">{alert.title}</span>
            {alert.url && (
              <a
                href={alert.url}
                className="security-banner-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                詳細を確認 →
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
