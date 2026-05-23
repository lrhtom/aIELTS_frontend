import Layout from '../../components/layout/Layout';
import { Link, useNavigate } from 'react-router-dom';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';

export default function Writing_page() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    return (
        <Layout>
            <div className="practice-container">
                <div className="practice-header">
                    <Link to="/practice/ai" className="back-link">{t.writingHub.backToPractice}</Link>
                    <h1>{t.writingHub.heading}</h1>
                    <p>{t.writingHub.subheading}</p>
                </div>

                <div className="config-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3>{t.writingHub.practiceMode}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        <button
                            style={{
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: '2px solid var(--color-primary)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-text)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}
                            onClick={() => navigate('/writing/correction')}
                        >
                            <span style={{ fontSize: '24px' }}>📝</span>
                            <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub.correction.title}</div>
                            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                {t.writingHub.correction.desc}
                            </div>
                        </button>

                        <button
                            style={{
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: '2px solid var(--color-primary)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-text)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}
                            onClick={() => navigate('/writing/task1')}
                        >
                            <span style={{ fontSize: '24px' }}>📊</span>
                            <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub.task1.title}</div>
                            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                {t.writingHub.task1.desc}
                            </div>
                        </button>

                        <button
                            style={{
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: '2px solid var(--color-primary)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-text)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}
                            onClick={() => navigate('/writing/task2')}
                        >
                            <span style={{ fontSize: '24px' }}>🖋️</span>
                            <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub.task2.title}</div>
                            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                {t.writingHub.task2.desc}
                            </div>
                        </button>

                        <button
                            style={{
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: '2px solid var(--color-primary)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-text)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}
                            onClick={() => navigate('/writing/task2/opinion-drill')}
                        >
                            <span style={{ fontSize: '24px' }}>🧠</span>
                            <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub.opinionDrill.title}</div>
                            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                {t.writingHub.opinionDrill.desc}
                            </div>
                        </button>

                        <button
                            style={{
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: '2px solid var(--color-primary)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-text)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}
                            onClick={() => navigate('/writing/chat-config')}
                        >
                            <span style={{ fontSize: '24px' }}>💬</span>
                            <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub.typingChat.title}</div>
                            <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                                {t.writingHub.typingChat.desc}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
