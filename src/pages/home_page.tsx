import AppNavbar from '../components/AppNavbar';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/home_page.css';

export default function HomePage() {
    const { lang } = useLang();
    const t = translations[lang];

    return (
        <div className="home-page">
            <AppNavbar />

            <section className="hero">
                <h1>Master IELTS with <span className="gradient-text">AI</span></h1>
                <p>{t.home.hero.subtitle}</p>
                <Link to="/practice" className="hero-btn">{t.home.hero.startPractice}</Link>
                <Link to="/practice" className="hero-btn hero-btn-secondary">{t.home.hero.vocab}</Link>
            </section>

            <section className="announcements">
                <h2>{t.home.announcements.heading}</h2>
                <div className="announcement-list">
                    {t.home.announcements.items.map((item, i) => (
                        <div key={i} className="announcement-item">
                            <span className="announcement-date">{item.date}</span>
                            <div className="announcement-content">
                                <span className={`announcement-tag ${item.tag}`}>{item.tag}</span>
                                {item.content}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="footer">{t.home.footer}</footer>
        </div>
    );
}
