import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';

export default function Task2SelectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [selectedType, setSelectedType] = useState<string | null>(null);

    const taskTypes = [
        { id: 'opinion', nameZh: t.task2Selection.types.opinion.title, nameEn: t.task2Selection.types.opinion.nameEn, icon: '⚖️', desc: t.task2Selection.types.opinion.desc },
        { id: 'report', nameZh: t.task2Selection.types.report.title, nameEn: t.task2Selection.types.report.nameEn, icon: '📊', desc: t.task2Selection.types.report.desc },
        { id: 'mixed', nameZh: t.task2Selection.types.mixed.title, nameEn: t.task2Selection.types.mixed.nameEn, icon: '🧩', desc: t.task2Selection.types.mixed.desc },
        { id: 'random', nameZh: t.task2Selection.types.random.title, nameEn: t.task2Selection.types.random.nameEn, icon: '🎲', desc: t.task2Selection.types.random.desc },
        { id: 'innovation', nameZh: t.task2Selection.types.innovation.title, nameEn: t.task2Selection.types.innovation.nameEn, icon: '🔮', desc: t.task2Selection.types.innovation.desc },
    ];

    const handleStart = () => {
        if (!selectedType) return;
        
        if (selectedType === 'random') {
            const mainPool = ['opinion', 'report', 'mixed', 'innovation'];
            const randomMain = mainPool[Math.floor(Math.random() * mainPool.length)];
            
            if (randomMain === 'opinion') {
                const opinionPool = ['opinion_agree', 'opinion_discuss', 'opinion_advantages'];
                const randomOpinion = opinionPool[Math.floor(Math.random() * opinionPool.length)];
                navigate(`/writing/task2/doing?type=${randomOpinion}`);
            } else {
                navigate(`/writing/task2/doing?type=${randomMain}`);
            }
            return;
        }

        const target = taskTypes.find(t => t.id === selectedType);
        if (target) {
            if (target.id === 'opinion') {
                navigate(`/writing/task2/opinion`);
            } else {
                navigate(`/writing/task2/doing?type=${target.id}`);
            }
        }
    };

    return (
        <Layout>
            <div className="practice-container">
                <div className="wc-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div className="practice-header" style={{ marginBottom: 0 }}>
                        <button className="back-link" onClick={() => navigate('/writing')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {t.task2Selection.backToWriting}
                        </button>
                        <h1>{t.task2Selection.heading}</h1>
                        <p>{t.task2Selection.subheading}</p>
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
                            {t.task2Selection.startBtn}
                        </button>
                    </div>
                </div>
            </div>
            {/* Styles are inherited from task1_selection_page.tsx via practice_page.css / inline styles */}
        </Layout>
    );
}
