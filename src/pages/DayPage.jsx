import { useParams } from 'react-router-dom';
import DigestView from '../components/DigestView.jsx';
import { useJsonData } from '../hooks.js';

export default function DayPage() {
  const { date } = useParams();
  const { data, error } = useJsonData(date ? `data/${date}.json` : null);

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
