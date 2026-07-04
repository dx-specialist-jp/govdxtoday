export default function AboutPage() {
  return (
    <>
      <div className="page-dark-header">
        <div className="page-dark-header-inner">
          <p className="page-dark-eyebrow">About</p>
          <h1 className="page-dark-title">サイトについて</h1>
        </div>
      </div>

      <div className="main-content">
        <div className="about-body">

          {/* 非営利・公開情報のみ・個人情報不掲載 — 最上位に宣言 */}
          <div className="declaration-box" role="note" aria-label="重要な宣言">
            <p>
              本サイトは<strong>非営利・非商業目的</strong>の個人運営サイトです。
              取り扱う情報は<strong>すべて公開情報</strong>に限定しており、
              機密性情報（機密性2以上）・特定の個人情報は一切掲載しません。
              収益化・広告掲載・有料サービスは行っていません。
            </p>
          </div>

          {/* 目的 */}
          <section className="about-section" aria-labelledby="purpose-heading">
            <h2 className="about-section-title" id="purpose-heading">サイトの目的</h2>
            <p>
              GovDX Today は、中央省庁・地方公共団体の
              <strong>PMO（プロジェクト管理オフィス）・PJMO（プロジェクト管理支援）担当者</strong>
              を主な対象として、行政DX・AI活用に関する情報を毎朝自動集約・要約するダイジェストサイトです。
            </p>
            <p>
              政府公式RSSとGoogle Alertsを横断的に収集し、AIが「PMO/PJMOとして何を確認・対応すべきか」
              の観点で要約・優先順位付けを行います。
              毎朝6時頃に前日分が更新されるため、業務開始前に最新情報を確認できます。
            </p>
          </section>

          {/* 掲載方針 */}
          <section className="about-section" aria-labelledby="policy-heading">
            <h2 className="about-section-title" id="policy-heading">掲載方針</h2>
            <ul>
              <li>掲載情報は<strong>すべて公開情報</strong>（政府・省庁の公式発表、無料で閲覧可能なニュース記事等）に限定しています</li>
              <li>ペイウォール（有料会員限定）記事は収集・掲載対象外としています</li>
              <li><strong>機密性情報</strong>（機密性2以上の行政情報）は収集も掲載も行いません</li>
              <li><strong>特定の個人情報</strong>（氏名・住所・連絡先・マイナンバー等、個人を識別できる情報）は掲載しません</li>
              <li>中央省庁PMO/PJMOの業務に関連する情報を優先し、AI（Gemini）が重要度を判定して掲載します</li>
              <li>要約はAIが自動生成するため、必ず出典元で原文を確認してください</li>
            </ul>
          </section>

          {/* AIによる要約 */}
          <section className="about-section" aria-labelledby="ai-heading">
            <h2 className="about-section-title" id="ai-heading">AIによる要約・フィルタリングについて</h2>
            <p>
              記事の要約・優先度判定・カテゴリ分類にはGoogle Gemini API
              （<code>gemini-2.5-flash-lite</code>、無料枠使用）を利用しています。
              要約は「中央省庁PMO/PJMOが業務で活用できる観点」で生成しており、
              具体的な対応事項・確認すべき文書・期限の目安を含むよう設計しています。
            </p>
            <p>
              ただし、<strong>AIの要約は正確性・完全性を保証するものではありません</strong>。
              誤情報（ハルシネーション）が含まれる場合があります。
              業務上の判断・意思決定・稟議・調達対応等には、必ず出典元の原文および
              所管部署の一次情報をご確認ください。
            </p>
          </section>

          {/* 免責事項 */}
          <section className="about-section" aria-labelledby="disclaimer-heading">
            <h2 className="about-section-title" id="disclaimer-heading">免責事項</h2>
            <p>
              本サイトの情報を利用することにより生じたいかなる損害についても、
              運営者は一切の責任を負いません。
            </p>
            <ul>
              <li>掲載情報の正確性・完全性・最新性について、いかなる保証もしません</li>
              <li>AIによる要約・フィルタリングの結果には誤りが含まれる場合があります</li>
              <li>リンク先（出典元）のサイト内容・可用性および利用に関して責任を負いません</li>
              <li>本サイトの内容は予告なく変更・削除される場合があります</li>
              <li>システム障害・GitHub Actions障害・Gemini API障害等により、予定された更新が行われない場合があります</li>
              <li>本サイトは個人が運営するものであり、いかなる組織・省庁の公式見解も代表しません</li>
            </ul>
          </section>

          {/* 著作権・引用 */}
          <section className="about-section" aria-labelledby="copyright-heading">
            <h2 className="about-section-title" id="copyright-heading">著作権・引用について</h2>
            <p>
              掲載されている各記事・情報の著作権は、それぞれの出典元（政府機関・報道機関等）に帰属します。
              本サイトは報道・批評・研究目的での引用（著作権法第32条）の範囲内での情報提供を行っています。
              AI要約は原文の転載ではなく二次的著作物としての要約です。
            </p>
            <p>
              著作権上の問題、または掲載内容に関するお問い合わせは、
              <a href="https://github.com/dx-specialist-jp/govdxtoday/issues" target="_blank" rel="noopener noreferrer">
                GitHubのIssue
              </a>
              よりご連絡ください。速やかに対応いたします。
            </p>
          </section>

          {/* 非営利・非商業宣言 */}
          <section className="about-section" aria-labelledby="nonprofit-heading">
            <h2 className="about-section-title" id="nonprofit-heading">非営利・非商業宣言</h2>
            <ul>
              <li>本サイトは<strong>一切の商業目的を持たない</strong>個人運営のサイトです</li>
              <li>広告掲載、アフィリエイト、スポンサーシップ等による収益化は行っていません</li>
              <li>有料会員制度・課金機能・寄付受付は設けていません</li>
              <li>掲載情報の販売・2次利用による収益化は行っていません</li>
              <li>情報収集・要約に使用するAI API費用・サーバー費用は個人が負担しています</li>
              <li>運営主体はいかなる政党・企業・団体とも関係を持っていません</li>
            </ul>
          </section>

          {/* プライバシー */}
          <section className="about-section" aria-labelledby="privacy-heading">
            <h2 className="about-section-title" id="privacy-heading">プライバシーについて</h2>
            <p>
              本サイトはGitHub Pagesによる<strong>完全静的サイト</strong>です。
              閲覧者の個人情報・アクセスログの独自収集・分析は行っていません。
              Cookie・追跡技術（トラッキング・フィンガープリント）は使用していません。
            </p>
            <p>
              ただし、以下の外部サービスにより技術的なアクセス記録が行われる場合があります。
              利用の際は各サービスのプライバシーポリシーをご確認ください。
            </p>
            <ul>
              <li>GitHub Pages（アクセスログ）</li>
              <li>Google Fonts（フォントの読み込み）</li>
            </ul>
          </section>

          {/* 更新ポリシー */}
          <section className="about-section" aria-labelledby="update-heading">
            <h2 className="about-section-title" id="update-heading">更新ポリシー</h2>
            <ul>
              <li>毎日UTC 14:00にジョブをキュー投入し、GitHub Actionsの遅延により<strong>日本時間 翌朝6:00頃</strong>に自動更新されます</li>
              <li>政府公式RSSフィード（9ソース）・Google Alerts RSS（8キーワード）から記事を収集します</li>
              <li>Google Gemini AIによる要約・フィルタリング・重要度判定を経て自動公開します</li>
              <li>API障害・ネットワーク障害等により更新が遅延または欠落する場合があります</li>
              <li>過去90日分のアーカイブを保持します</li>
              <li>手動更新も随時実施する場合があります</li>
            </ul>
          </section>

          {/* 情報源 — 最新ソース一覧に更新 */}
          <section className="about-section" aria-labelledby="sources-heading">
            <h2 className="about-section-title" id="sources-heading">収集対象の情報源</h2>

            <p><strong>政府・公的機関 RSS（4ソース）</strong></p>
            <ul>
              <li><strong>セキュリティ:</strong> JPCERT/CC・IPA（情報処理推進機構）・NISC（内閣サイバーセキュリティセンター）</li>
              <li><strong>デジタル庁:</strong> note</li>
            </ul>

            <p style={{ marginTop: '14px' }}><strong>Google Alerts RSS（8キーワード）</strong></p>
            <ul>
              <li>クラウド×政府 / AI×行政 / AIガバナンス / ガバメントクラウド</li>
              <li>デジタル庁 / 情報システム調達 / 政府情報システム / 生成AI×行政</li>
            </ul>

            <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              ※ 有料会員限定（ペイウォール）記事は自動的に除外します。<br />
              ※ 各ソースのRSSフィード状況により収集件数は変動します。
            </p>
          </section>

        </div>
      </div>
    </>
  );
}
