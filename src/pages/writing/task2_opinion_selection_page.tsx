import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';

export default function Task2OpinionSelectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [selectedType, setSelectedType] = useState<string | null>(null);

    const taskTypes = [
        { id: 'opinion_agree', nameZh: t.task2OpinionSelection.types.agree.title, nameEn: t.task2OpinionSelection.types.agree.nameEn, icon: '⚖️', desc: t.task2OpinionSelection.types.agree.desc },
        { id: 'opinion_discuss', nameZh: t.task2OpinionSelection.types.discuss.title, nameEn: t.task2OpinionSelection.types.discuss.nameEn, icon: '🗣️', desc: t.task2OpinionSelection.types.discuss.desc },
        { id: 'opinion_advantages', nameZh: t.task2OpinionSelection.types.advantages.title, nameEn: t.task2OpinionSelection.types.advantages.nameEn, icon: '📈', desc: t.task2OpinionSelection.types.advantages.desc },
        { id: 'opinion_random', nameZh: t.task2OpinionSelection.types.random.title, nameEn: t.task2OpinionSelection.types.random.nameEn, icon: '🎲', desc: t.task2OpinionSelection.types.random.desc },
    ];

    const handleStart = () => {
        if (!selectedType) return;
        if (selectedType === 'opinion_random') {
            const typesPool = ['opinion_agree', 'opinion_discuss', 'opinion_advantages'];
            const randomType = typesPool[Math.floor(Math.random() * typesPool.length)];
            navigate(`/writing/task2/doing?type=${randomType}`);
            return;
        }

        const target = taskTypes.find(t => t.id === selectedType);
        if (target) {
            navigate(`/writing/task2/doing?type=${target.id}`);
        }
    };

    return (
        <Layout>
            <div className="practice-container">
                <div className="wc-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div className="practice-header" style={{ marginBottom: 0 }}>
                        <button className="back-link" onClick={() => navigate('/writing/task2')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {t.task2OpinionSelection.backToTask2Selection}
                        </button>
                        <h1>{t.task2OpinionSelection.heading}</h1>
                        <p>{t.task2OpinionSelection.subheading}</p>
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
                            {t.task2OpinionSelection.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
