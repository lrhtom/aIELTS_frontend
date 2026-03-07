import AppNavbar from '../components/AppNavbar';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/practice_hub.css';

export default function AIPractice() {
    const { lang } = useLang();
    const t = translations[lang].aiPractice;

    return (
        <div className="practice-hub">
            <AppNavbar />

            <div className="practice-hub-container">
                <div className="practice-hub-header">
                    <Link to="/practice" className="back-link">{t.backToPractice}</Link>
                    <h1>{t.heading}</h1>
                    <p>{t.subheading}</p>
                </div>

                <div className="skill-grid">
                    <Link to="/practice/ai/reading" className="skill-entry reading">
                        <span className="skill-icon">📖</span>
                        <div className="skill-name">{t.reading.title}</div>
                        <div className="skill-sub">{t.reading.desc}</div>
                    </Link>

                    <Link to="/practice/ai/listening" className="skill-entry listening">
                        <span className="skill-icon">🎧</span>
                        <div className="skill-name">{t.listening.title}</div>
                        <div className="skill-sub">{t.listening.desc}</div>
                    </Link>

                    <Link to="/speaking" className="skill-entry speaking">
                        <span className="skill-icon">🗣️</span>
                        <div className="skill-name">{t.speaking.title}</div>
                        <div className="skill-sub">{t.speaking.desc}</div>
                    </Link>

                    <Link to="/writing" className="skill-entry writing">
                        <span className="skill-icon">✍️</span>
                        <div className="skill-name">{t.writing.title}</div>
                        <div className="skill-sub">{t.writing.desc}</div>
                    </Link>


                </div>
            </div>
        </div>
    );
}
