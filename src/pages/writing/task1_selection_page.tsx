import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';

export default function Task1SelectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [selectedType, setSelectedType] = useState<string | null>(null);

    const taskTypes = [
        { id: 'chart', nameZh: t.task1Selection.types.chart.title, nameEn: t.task1Selection.types.chart.nameEn, icon: '📈', desc: t.task1Selection.types.chart.desc, path: '/writing/chart', isBeta: false },
        { id: 'map', nameZh: t.task1Selection.types.map.title, nameEn: t.task1Selection.types.map.nameEn, icon: '🗺️', desc: t.task1Selection.types.map.desc, path: '/writing/map', isBeta: true },
        { id: 'flowchart', nameZh: t.task1Selection.types.flowchart.title, nameEn: t.task1Selection.types.flowchart.nameEn, icon: '⚙️', desc: t.task1Selection.types.flowchart.desc, path: '/writing/flowchart', isBeta: true },
        { id: 'random', nameZh: t.task1Selection.types.random.title, nameEn: t.task1Selection.types.random.nameEn, icon: '🎲', desc: t.task1Selection.types.random.desc, path: '/writing/random', isBeta: false },
    ];

    const goToPractice = (type: string) => {
        sessionStorage.removeItem(`writing_task1_chart_session_${type}`);
        navigate(`/writing/chart/doing?type=${type}`);
    };

    const handleStart = () => {
        if (!selectedType) return;

        if (selectedType === 'random') {
            const pool = ['chart', 'map', 'flowchart'];
            const chosen = pool[Math.floor(Math.random() * pool.length)];
            if (chosen === 'chart') navigate('/writing/chart');
            else goToPractice(chosen);
            return;
        }

        const target = taskTypes.find(t => t.id === selectedType);
        if (target) {
            if (target.id === 'chart') navigate(target.path);
            else if (target.id === 'flowchart' || target.id === 'map') goToPractice(target.id);
            else alert(`${t.task1Selection.comingSoon}${target.nameZh} (${target.nameEn})`);
        }
    };

    return (
        <Layout
            backUrl="/writing"
            backText={t.task1Selection.backToWriting}
            pageTitle={t.task1Selection.heading}
            pageSubtitle={t.task1Selection.subheading}
            headerRight={<AiModelSelector />}
        >
            <div className="practice-container writing-selection-page">

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
                                        {typeItem.isBeta && <span className="writing-beta-badge">{t.task1Selection.beta}</span>}
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
                            {t.task1Selection.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
