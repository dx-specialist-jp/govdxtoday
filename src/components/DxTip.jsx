export default function DxTip({ tip }) {
  if (!tip) return null;

  return (
    <div className="digest-section">
      <p className="section-label">💡 今日のDX Tips</p>
      <div className="tips-card">
        <div className="tips-header">
          <span className="tips-icon" aria-hidden="true">💡</span>
          <h3 className="tips-title">{tip.title}</h3>
        </div>
        <p className="tips-body">{tip.body}</p>
        {tip.reference && (
          <div className="tips-reference">
            参照:{' '}
            {tip.reference_url ? (
              <a href={tip.reference_url} target="_blank" rel="noopener noreferrer">
                {tip.reference}
              </a>
            ) : (
              tip.reference
            )}
          </div>
        )}
      </div>
    </div>
  );
}
