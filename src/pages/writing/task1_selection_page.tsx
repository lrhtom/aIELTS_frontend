import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';

const CHART_POOL = ['line', 'pie', 'bar', 'horizontal', 'table', 'mixed'] as const;

export default function Task1SelectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [selectedType, setSelectedType] = useState<string>('chart');
    const [selectedChart, setSelectedChart] = useState<string>('line');

    const taskTypes = [
        { id: 'chart', nameZh: t.task1Selection.types.chart.title, nameEn: t.task1Selection.types.chart.nameEn, icon: '📈', desc: t.task1Selection.types.chart.desc, isBeta: false },
        { id: 'map', nameZh: t.task1Selection.types.map.title, nameEn: t.task1Selection.types.map.nameEn, icon: '🗺️', desc: t.task1Selection.types.map.desc, isBeta: true },
        { id: 'flowchart', nameZh: t.task1Selection.types.flowchart.title, nameEn: t.task1Selection.types.flowchart.nameEn, icon: '⚙️', desc: t.task1Selection.types.flowchart.desc, isBeta: true },
        { id: 'random', nameZh: t.task1Selection.types.random.title, nameEn: t.task1Selection.types.random.nameEn, icon: '🎲', desc: t.task1Selection.types.random.desc, isBeta: false },
    ];

    const chartTypes = [
        { id: 'line', icon: '📈', nameZh: t.chartSelection.types.line.title, nameEn: t.chartSelection.types.line.nameEn },
        { id: 'pie', icon: '🥧', nameZh: t.chartSelection.types.pie.title, nameEn: t.chartSelection.types.pie.nameEn },
        { id: 'bar', icon: '📊', nameZh: t.chartSelection.types.bar.title, nameEn: t.chartSelection.types.bar.nameEn },
        { id: 'horizontal', icon: '🛶', nameZh: t.chartSelection.types.horizontal.title, nameEn: t.chartSelection.types.horizontal.nameEn },
        { id: 'table', icon: '🧮', nameZh: t.chartSelection.types.table.title, nameEn: t.chartSelection.types.table.nameEn },
        { id: 'mixed', icon: '🔀', nameZh: t.chartSelection.types.mixed.title, nameEn: t.chartSelection.types.mixed.nameEn },
        { id: 'random', icon: '🎲', nameZh: t.chartSelection.types.random.title, nameEn: t.chartSelection.types.random.nameEn },
    ];

    const selected = taskTypes.find(x => x.id === selectedType) ?? taskTypes[0];

    const goToChartPractice = (subtype: string) => {
        sessionStorage.removeItem(`writing_task1_chart_session_${subtype}`);
        navigate(`/writing/chart/doing?type=${subtype}`);
    };

    const handleStart = () => {
        if (selectedType === 'chart') {
            const sub = selectedChart === 'random'
                ? CHART_POOL[Math.floor(Math.random() * CHART_POOL.length)]
                : selectedChart;
            goToChartPractice(sub);
            return;
        }

        if (selectedType === 'random') {
            const pool = ['chart', 'map', 'flowchart'];
            const chosen = pool[Math.floor(Math.random() * pool.length)];
            if (chosen === 'chart') {
                const sub = CHART_POOL[Math.floor(Math.random() * CHART_POOL.length)];
                goToChartPractice(sub);
            } else {
                goToChartPractice(chosen);
            }
            return;
        }

        if (selectedType === 'flowchart' || selectedType === 'map') {
            goToChartPractice(selectedType);
            return;
        }

        alert(`${t.task1Selection.comingSoon}${selected.nameZh} (${selected.nameEn})`);
    };

    return (
        <Layout
            backUrl="/writing"
            backText={t.task1Selection.backToWriting}
            pageTitle={t.task1Selection.heading}
            pageSubtitle={t.task1Selection.subheading}
        >
            <div className="uc-console">
                <div className="uc-sidebar">
                    <div className="uc-sidebar-title">{t.task1Selection.heading}</div>
                    <nav className="uc-sidebar-nav">
                        {taskTypes.map(typeItem => (
                            <button
                                key={typeItem.id}
                                type="button"
                                className={`uc-nav-item ${selectedType === typeItem.id ? 'active' : ''}`}
                                onClick={() => setSelectedType(typeItem.id)}
                            >
                                <span className="nav-icon">{typeItem.icon}</span>
                                <span className="nav-text">
                                    {lang === 'zh' ? typeItem.nameZh : typeItem.nameEn}
                                    {typeItem.isBeta && (
                                        <span style={{
                                            marginLeft: 6,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: '2px 6px',
                                            borderRadius: 999,
                                            background: '#fef3c7',
                                            color: '#b45309',
                                        }}>{t.task1Selection.beta}</span>
                                    )}
                                </span>
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="uc-main-content">
                    <div className="uc-main-header">
                        <h2>{lang === 'zh' ? selected.nameZh : selected.nameEn}</h2>
                        <p>{selected.desc}</p>
                    </div>

                    <div className="uc-settings-list">
                        <div className="uc-card-group">
                            <div className="uc-list-row">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#f59e0b', background: '#fef3c7' }}>🤖</span>
                                        <span className="row-title">{t.components.aiModel.label}</span>
                                    </div>
                                </div>
                                <div className="uc-row-control console-model-selector">
                                    <AiModelSelector label="" description="" />
                                </div>
                            </div>
                        </div>

                        {selectedType === 'chart' && (
                            <div className="uc-card-group">
                                <div className="uc-list-row uc-row-vertical">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>📊</span>
                                            <span className="row-title">{t.chartSelection.heading}</span>
                                        </div>
                                        <span className="row-desc">{t.chartSelection.subheading}</span>
                                    </div>
                                    <div
                                        role="radiogroup"
                                        aria-label={t.chartSelection.heading}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                            gap: 8,
                                            marginTop: 4,
                                        }}
                                    >
                                        {chartTypes.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                role="radio"
                                                aria-checked={selectedChart === c.id}
                                                className={`task2-topic-chip ${selectedChart === c.id ? 'active' : ''}`}
                                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, padding: '8px 12px' }}
                                                onClick={() => setSelectedChart(c.id)}
                                            >
                                                <span style={{ fontSize: 16 }}>{c.icon}</span>
                                                <span style={{ flex: 1, textAlign: 'left' }}>
                                                    {lang === 'zh' ? c.nameZh : c.nameEn}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="uc-console-footer">
                        <button className="uc-console-start-btn" onClick={handleStart}>
                            {selected.icon} {t.task1Selection.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
