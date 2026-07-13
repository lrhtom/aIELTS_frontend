import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import CustomPromptField from '../../components/common/CustomPromptField';
import { showToast } from '../../components/common/Toast';
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
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');

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

    const goToChartPractice = (subtype: string, extraParams?: Record<string, string>) => {
        sessionStorage.removeItem(`writing_task1_chart_session_${subtype}`);
        const params = new URLSearchParams({ type: subtype, ...(extraParams || {}) });
        navigate(`/writing/chart/doing?${params.toString()}`, {
            state: {
                customName: customName.trim(),
                customDescription: customDescription.trim(),
                customPrompt: customPrompt.trim(),
            },
        });
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

        if (selectedType === 'map') {
            goToChartPractice('map');
            return;
        }
        if (selectedType === 'flowchart') {
            goToChartPractice(selectedType);
            return;
        }

        showToast(`${t.task1Selection.comingSoon}${selected.nameZh} (${selected.nameEn})`, 'info');
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

                        <div className="uc-card-group">
                            <div className="uc-list-row uc-row-vertical">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>🏷️</span>
                                        <span className="row-title">{t.common.customQuestion.sectionTitle}</span>
                                    </div>
                                    <span className="row-desc" style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                        {t.common.customQuestion.sectionDesc}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                                    <input
                                        type="text"
                                        maxLength={80}
                                        placeholder={t.common.customQuestion.namePlaceholder}
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14 }}
                                        aria-label={t.common.customQuestion.nameLabel}
                                    />
                                    <textarea
                                        maxLength={300}
                                        rows={2}
                                        placeholder={t.common.customQuestion.descPlaceholder}
                                        value={customDescription}
                                        onChange={e => setCustomDescription(e.target.value)}
                                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
                                        aria-label={t.common.customQuestion.descLabel}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 自定义提示词指令（高级，可选）· 地图题走图像生成，不适用 */}
                        {selectedType !== 'map' && (
                            <div className="uc-card-group">
                                <CustomPromptField value={customPrompt} onChange={setCustomPrompt} />
                            </div>
                        )}

                        {selectedType === 'map' && (
                            <div className="uc-card-group">
                                <div className="uc-list-row uc-row-vertical">
                                    <div className="uc-row-label-flex">
                                        <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <span className="uc-row-icon" style={{ color: '#7c3aed', background: '#ede9fe' }}>🗺️</span>
                                            <span className="row-title">{t.task1Selection.mapMode.heading}</span>
                                        </div>
                                        <span className="row-desc">{t.task1Selection.mapMode.subheading}</span>
                                    </div>
                                    <div style={{
                                        marginTop: 8,
                                        padding: '14px 16px',
                                        borderRadius: 10,
                                        border: '1px solid var(--color-border)',
                                        background: 'rgba(13,148,136,0.06)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 8,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                padding: '3px 8px',
                                                borderRadius: 999,
                                                background: '#fef3c7',
                                                color: '#b45309',
                                            }}>{t.task1Selection.mapMode.raster.badge}</span>
                                            <span style={{ fontWeight: 600 }}>{t.task1Selection.mapMode.raster.title}</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                                            {t.task1Selection.mapMode.raster.summary}
                                        </div>
                                        <ul style={{
                                            margin: '4px 0 0 0',
                                            paddingLeft: 18,
                                            fontSize: 12,
                                            color: 'var(--color-text-secondary)',
                                            lineHeight: 1.6,
                                        }}>
                                            {t.task1Selection.mapMode.raster.bullets.map((b, i) => <li key={i}>{b}</li>)}
                                        </ul>
                                        <div style={{
                                            marginTop: 6,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: 'var(--color-primary)',
                                        }}>
                                            💰 {t.task1Selection.mapMode.raster.cost}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

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
