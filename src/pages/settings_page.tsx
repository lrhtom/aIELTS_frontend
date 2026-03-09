import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/settings_page.css';

export default function SettingsPage() {
    const { lang } = useLang();
    const t = translations[lang];

    return (
        <Layout>
<div className=".*">
                <div className="settings-header">
                    <Link to="/" className="back-link"><span className="arrow">←</span> {t.nav.home}</Link>
                    <h1>{t.profile.heading}</h1>
                    <p>{t.profile.subheading}</p>
                </div>

                <div className="settings-card">
                    <div className="profile-message">
                        <p>{lang === 'zh' ? '设置功能已迁移到个人主页。请点击下方按钮访问个人主页。' : 'Settings have been moved to Profile page. Please click the button below to access your Profile.'}</p>
                        <Link to="/profile" className="profile-button">
                            {lang === 'zh' ? '前往个人主页' : 'Go to Profile'}
                        </Link>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
