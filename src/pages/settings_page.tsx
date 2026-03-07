import AppNavbar from '../components/AppNavbar';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import AiModelSelector from '../components/AiModelSelector';
import '../styles/settings_page.css';

export default function SettingsPage() {
    const { lang, setLang } = useLang();
    const t = translations[lang];

    return (
        <div className="settings-page">
            <AppNavbar />

            <div className="settings-container">
                <div className="settings-header">
                    <Link to="/" className="back-link"><span className="arrow">←</span> {t.nav.home}</Link>
                    <h1>{t.settings.heading}</h1>
                    <p>{t.settings.subheading}</p>
                </div>

                <div className="settings-card">
                    <div className="settings-row">
                        <div className="settings-label-group">
                            <div className="settings-label">{t.settings.language.label}</div>
                            <div className="settings-desc">{t.settings.language.desc}</div>
                        </div>
                        <div className="lang-pills">
                            <button
                                className={`lang-pill${lang === 'zh' ? ' active' : ''}`}
                                onClick={() => setLang('zh')}
                            >
                                中文
                            </button>
                            <button
                                className={`lang-pill${lang === 'en' ? ' active' : ''}`}
                                onClick={() => setLang('en')}
                            >
                                English
                            </button>
                        </div>
                    </div>

                    <div className="settings-row">
                        <div className="settings-label-group">
                            <div className="settings-label">{t.settings.model.label}</div>
                            <div className="settings-desc">{t.settings.model.desc}</div>
                        </div>
                        <div className="settings-control">
                            <AiModelSelector label="" description="" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
