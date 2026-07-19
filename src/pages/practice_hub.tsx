import Layout from '../components/layout/Layout';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import '../styles/practice_hub.css';

export default function PracticeHub() {
    const { t } = useLang();

    return (
        <Layout
            pageTitle={t('practiceHub.heading')}
            pageSubtitle={t('practiceHub.subheading')}
            backUrl="/"
            backText={t('practiceHub.backToHome')}
        >
            <div className="practice-hub">
                <div className="practice-hub-container" style={{paddingTop: '20px'}}>

                <div className="mode-cards">
                    {/* Real Practice — coming soon */}
                    <div className="mode-card disabled">
                        <span className="mode-icon">📝</span>
                        <div className="mode-title">{t('practiceHub.realPractice.title')}</div>
                        <div className="mode-desc">{t('practiceHub.realPractice.desc')}</div>
                        <span className="coming-soon-badge">{t('practiceHub.comingSoon')}</span>
                    </div>

                    {/* AI Practice */}
                    <Link to="/practice/ai" className="mode-card ai-mode">
                        <span className="mode-icon">🤖</span>
                        <div className="mode-title">{t('practiceHub.aiPractice.title')}</div>
                        <div className="mode-desc">{t('practiceHub.aiPractice.desc')}</div>
                    </Link>
                </div>
                </div>
            </div>
        </Layout>
    );
}
