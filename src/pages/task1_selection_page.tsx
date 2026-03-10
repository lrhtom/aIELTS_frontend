import Layout from '../components/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../components/AiModelSelector';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/practice_page.css';

export default function Task1SelectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [selectedType, setSelectedType] = useState<string | null>(null);

    const taskTypes = [
        { id: 'chart', nameZh: t.task1Selection.types.chart.title, nameEn: t.task1Selection.types.chart.nameEn, icon: '📈', desc: t.task1Selection.types.chart.desc, path: '/writing/chart', isBeta: false },
        { id: 'map', nameZh: t.task1Selection.types.map.title, nameEn: t.task1Selection.types.map.nameEn, icon: '🗺️', desc: t.task1Selection.types.map.desc, path: '/writing/map', isBeta: true },
        { id: 'flowchart', nameZh: t.task1Selection.types.flowchart.title, nameEn: t.task1Selection.types.flowchart.nameEn, icon: '⚙️', desc: t.task1Selection.types.flowchart.desc, path: '/writing/flowchart', isBeta: true },
    ];

    const handleStart = () => {
        if (!selectedType) return;
        const target = taskTypes.find(t => t.id === selectedType);
        if (target) {
            if (target.id === 'chart' || target.id === 'flowchart') {
                // Determine actual practice page or nested page
                if (target.id === 'chart') navigate(target.path);
                if (target.id === 'flowchart') navigate('/writing/chart/doing?type=flowchart');
            } else {
                alert(`${t.task1Selection.comingSoon}${target.nameZh} (${target.nameEn})`);
            }
        }
    };

    return (
        <Layout>
            <div className="practice-container">
                <div className="wc-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div className="practice-header" style={{ marginBottom: 0 }}>
                        <button className="back-link" onClick={() => navigate('/writing')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {t.task1Selection.backToWriting}
                        </button>
                        <h1>{t.task1Selection.heading}</h1>
                        <p>{t.task1Selection.subheading}</p>
                    </div>
                    <div className="wc-model-box">
                        <AiModelSelector />
                    </div>
                </div>

                <div className="config-card">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '2rem' }}>
                        {taskTypes.map(typeItem => (
                            <div
                                key={typeItem.id}
                                className={`chart-card-btn ${selectedType === typeItem.id ? 'active' : ''}`}
                                onClick={() => setSelectedType(typeItem.id)}
                            >
                                <div className="chart-card-icon">{typeItem.icon}</div>
                                <div className="chart-card-content">
                                    <div className="chart-card-title">
                                        {typeItem.nameZh}
                                        {typeItem.isBeta && <span style={{ marginLeft: '8px', fontSize: '11px', background: '#f59e0b', color: '#fff', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>{t.task1Selection.beta}</span>}
                                    </div>
                                    <div className="chart-card-subtitle">{typeItem.nameEn}</div>
                                    <div className="chart-card-desc" style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>{typeItem.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                        <button 
                            className="primary-button"
                            onClick={handleStart}
                            disabled={!selectedType}
                            style={{ padding: '15px 40px', fontSize: '1.2rem', borderRadius: '12px', opacity: selectedType ? 1 : 0.5 }}
                        >
                            {t.task1Selection.startBtn}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                .chart-card-btn {
                    padding: 1.5rem;
                    border-radius: 16px;
                    border: 2px solid var(--border-color);
                    background: var(--bg-card);
                    cursor: pointer;
                    display: flex;
                    align-items: flex-start;
                    gap: 16px;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    overflow: hidden;
                }
                .chart-card-btn:hover {
                    transform: translateY(-4px);
                    border-color: var(--primary-color);
                    box-shadow: 0 12px 24px -10px rgba(59, 130, 246, 0.2);
                }
                .chart-card-btn.active {
                    border-color: var(--primary-color);
                    background: rgba(59, 130, 246, 0.05);
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                }
                .chart-card-icon {
                    font-size: 32px;
                    background: var(--bg-body);
                    width: 60px;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    transition: transform 0.3s ease;
                }
                .chart-card-btn:hover .chart-card-icon {
                    transform: scale(1.1) rotate(-5deg);
                }
                .chart-card-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .chart-card-subtitle {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    margin-top: 4px;
                }
            `}</style>
        </Layout>
    );
}
