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
            <div className="practice-container writing-selection-page">
                <div className="writing-selection-header">
                    <div className="practice-header writing-selection-title">
                        <button className="back-link writing-back-btn" onClick={() => navigate('/writing')}>
                            {t.task2Selection.backToWriting}
                        </button>
                        <h1>{t.task2Selection.heading}</h1>
                        <p>{t.task2Selection.subheading}</p>
                    </div>
                    <div className="wc-model-box">
                        <AiModelSelector />
                    </div>
                </div>

                <div className="config-card writing-selection-card">
                    <div className="writing-selection-grid">
                        {taskTypes.map(typeItem => (
                            <button
                                key={typeItem.id}
                                type="button"
                                className={`writing-choice-card ${selectedType === typeItem.id ? 'active' : ''}`}
                                onClick={() => setSelectedType(typeItem.id)}
                            >
                                <div className="writing-choice-icon">{typeItem.icon}</div>
                                <div className="writing-choice-content">
                                    <div className="writing-choice-title">
                                        {lang === 'zh' ? typeItem.nameZh : typeItem.nameEn}
                                    </div>
                                    <div className="writing-choice-subtitle">{lang === 'zh' ? typeItem.nameEn : typeItem.nameZh}</div>
                                    <div className="writing-choice-desc">{typeItem.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="writing-selection-actions">
                        <button
                            className="primary-button writing-selection-start-btn"
                            onClick={handleStart}
                            disabled={!selectedType}
                        >
                            {t.task2Selection.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
