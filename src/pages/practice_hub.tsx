import AppNavbar from '../components/AppNavbar';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/practice_hub.css';

export default function PracticeHub() {
    const { lang } = useLang();
    const t = translations[lang].practiceHub;

    return (
        <div className="practice-hub">
            <AppNavbar />

            <div className="practice-hub-container">
                <div className="practice-hub-header">
                    <Link to="/" className="back-link">{t.backToHome}</Link>
                    <h1>{t.heading}</h1>
                    <p>{t.subheading}</p>
                </div>

                <div className="mode-cards">
                    {/* Real Practice — coming soon */}
                    <div className="mode-card disabled">
                        <span className="mode-icon">📝</span>
                        <div className="mode-title">{t.realPractice.title}</div>
                        <div className="mode-desc">{t.realPractice.desc}</div>
                        <span className="coming-soon-badge">{t.comingSoon}</span>
                    </div>

                    {/* AI Practice */}
                    <Link to="/practice/ai" className="mode-card ai-mode">
                        <span className="mode-icon">🤖</span>
                        <div className="mode-title">{t.aiPractice.title}</div>
                        <div className="mode-desc">{t.aiPractice.desc}</div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
