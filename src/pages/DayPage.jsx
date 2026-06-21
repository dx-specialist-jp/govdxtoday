import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DigestView from '../components/DigestView.jsx';

const BASE = import.meta.env.BASE_URL;

export default function DayPage() {
  const { date } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!date) return;
    setData(null);
    setError(null);
    fetch(`${BASE}data/${date}.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [date]);

  if (error) {
    return (
      <div className="main-content">
        <div className="error-box">
          データが見つかりません（{date}）: {error}
        </div>
      </div>
    );
  }

  if (!data) return <div className="loading">読み込み中</div>;

  return <DigestView data={data} showBackLink={true} />;
}
