import Layout from '../components/layout/Layout';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import '../styles/settings_page.css';

export default function SettingsPage() {
    const { translations: t } = useLang();

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
                        <p>{t.settings.movedMessage}</p>
                        <Link to="/profile" className="profile-button">
                            {t.settings.goToProfile}
                        </Link>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
