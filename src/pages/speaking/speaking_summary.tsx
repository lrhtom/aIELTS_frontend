import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/speaking_page.css'; // Reuse some styles

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    scores?: {
        grammar?: number;
        vocab?: number;
        relevance?: number;
    };
}

interface Word {
    en: string;
    zh?: string;
    count: number;
}

export default function SpeakingSummaryPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { translations: t } = useLang();
    const s = t.speakingConfig.scenarioSummary;

    const state = location.state as {
        chatHistory: ChatMessage[];
        scenarioPrompt: string;
        words: Word[];
    };

    if (!state) {
        return (
            <Layout>
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2>No data available.</h2>
                    <button onClick={() => navigate('/speaking')}>Back</button>
                </div>
            </Layout>
        );
    }

    const { chatHistory, scenarioPrompt, words } = state;

    // Calculate scores
    const aiMessages = chatHistory.filter(m => m.role === 'assistant' && m.scores);
    const avgGrammar = aiMessages.length ? Math.round(aiMessages.reduce((acc, m) => acc + (m.scores?.grammar || 0), 0) / aiMessages.length) : 0;
    const avgVocab = aiMessages.length ? Math.round(aiMessages.reduce((acc, m) => acc + (m.scores?.vocab || 0), 0) / aiMessages.length) : 0;
    const avgRelevance = aiMessages.length ? Math.round(aiMessages.reduce((acc, m) => acc + (m.scores?.relevance || 0), 0) / aiMessages.length) : 0;
    
    // Overall score (average of the three)
    const overall = Math.round((avgGrammar + avgVocab + avgRelevance) / 3);

    // Vocabulary coverage
    const usedWords = words.filter(w => w.count > 0).length;
    const totalWords = words.length;
    const coveragePercent = totalWords ? Math.round((usedWords / totalWords) * 100) : 0;

    return (
        <Layout>
            <div className="speaking-container" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
                <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{s.title}</h1>
                    <p style={{ color: 'var(--color-text-muted)' }}>{s.subtitle}</p>
                </header>

                <div className="sc-summary-card" style={{ 
                    background: 'var(--color-bg-card)', 
                    borderRadius: '1.5rem', 
                    padding: '2rem',
                    boxShadow: 'var(--shadow-lg)',
                    marginBottom: '2rem'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{s.overallScore}</div>
                            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{overall}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{s.vocabCoverage} ({coveragePercent}%)</div>
                            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--color-secondary)' }}>{usedWords}/{totalWords}</div>
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Grammar & Accuracy</span>
                                <div style={{ width: '60%', height: '8px', background: 'var(--color-bg-alt)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${avgGrammar}%`, height: '100%', background: 'var(--color-primary)' }} />
                                </div>
                                <span style={{ fontWeight: 600 }}>{avgGrammar}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Vocabulary Range</span>
                                <div style={{ width: '60%', height: '8px', background: 'var(--color-bg-alt)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${avgVocab}%`, height: '100%', background: 'var(--color-secondary)' }} />
                                </div>
                                <span style={{ fontWeight: 600 }}>{avgVocab}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Relevance & Logic</span>
                                <div style={{ width: '60%', height: '8px', background: 'var(--color-bg-alt)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${avgRelevance}%`, height: '100%', background: 'var(--color-accent)' }} />
                                </div>
                                <span style={{ fontWeight: 600 }}>{avgRelevance}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="sc-summary-details" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Scenario Recruiter</h3>
                    <div style={{ 
                        padding: '1rem', 
                        background: 'rgba(var(--color-primary-rgb), 0.05)', 
                        borderRadius: '1rem',
                        borderLeft: '4px solid var(--color-primary)',
                        fontStyle: 'italic'
                    }}>
                        "{scenarioPrompt}"
                    </div>
                </div>

                <div className="sc-vocab-review">
                    <h3 style={{ marginBottom: '1rem' }}>Vocabulary Practice</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {words.map((w, i) => (
                            <div key={i} style={{ 
                                padding: '0.5rem 1rem', 
                                borderRadius: '2rem', 
                                background: w.count > 0 ? 'rgba(var(--color-secondary-rgb), 0.1)' : 'var(--color-bg-alt)',
                                color: w.count > 0 ? 'var(--color-secondary)' : 'var(--color-text-muted)',
                                border: w.count > 0 ? '1px solid var(--color-secondary)' : '1px solid var(--color-border)',
                                fontSize: '0.9rem'
                            }}>
                                {w.en} {w.count > 0 && `(x${w.count})`}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                    <button 
                        className="btn-primary" 
                        onClick={() => navigate('/speaking')}
                        style={{ padding: '0.75rem 2rem', borderRadius: '2rem' }}
                    >
                        {s.backBtn}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
