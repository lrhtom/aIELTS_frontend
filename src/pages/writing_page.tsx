import AppNavbar from '../components/AppNavbar';
import { Link, useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/practice_page.css';

export default function Writing_page() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    return (
        <div className="practice-page">
            <AppNavbar />

            <div className="practice-container">
                <div className="practice-header">
                    <Link to="/practice/ai" className="back-link">← {t.nav.practice}</Link>
                    <h1>写作大厅 (Writing)</h1>
                    <p>选择你要进行的写作练习类型</p>
                </div>

                <div className="config-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3>练习模式</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        <button
                            style={{
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: '2px solid var(--accent-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}
                            onClick={() => navigate('/writing/correction')}
                        >
                            <span style={{ fontSize: '24px' }}>📝</span>
                            <div style={{ fontSize: '18px', fontWeight: '600' }}>写作批改 (Correction)</div>
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                将你的雅思大作文或小作文粘贴至此，AI 考官将根据雅思官方四项评分准则（Task Response, Coherence, Lexical, Grammar）为你进行深入批改和打分。
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
