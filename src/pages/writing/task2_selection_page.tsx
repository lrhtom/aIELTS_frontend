import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import { clearTask2Session } from '../../utils/writing_session';
import '../../styles/practice_page.css';

type Task2TopicCategory =
    | 'all'
    | 'education'
    | 'technology'
    | 'culture'
    | 'urbanization'
    | 'government'
    | 'environment'
    | 'media'
    | 'society'
    | 'abstract'
    | 'random'
    | 'innovation';

export default function Task2SelectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [selectedType, setSelectedType] = useState<string>('opinion');
    const [selectedTopicCategory, setSelectedTopicCategory] = useState<Task2TopicCategory>('all');
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');

    const taskTypes = [
        { id: 'opinion', nameZh: t.task2Selection.types.opinion.title, nameEn: t.task2Selection.types.opinion.nameEn, icon: '⚖️', desc: t.task2Selection.types.opinion.desc },
        { id: 'report', nameZh: t.task2Selection.types.report.title, nameEn: t.task2Selection.types.report.nameEn, icon: '📊', desc: t.task2Selection.types.report.desc },
        { id: 'mixed', nameZh: t.task2Selection.types.mixed.title, nameEn: t.task2Selection.types.mixed.nameEn, icon: '🧩', desc: t.task2Selection.types.mixed.desc },
        { id: 'random', nameZh: t.task2Selection.types.random.title, nameEn: t.task2Selection.types.random.nameEn, icon: '🎲', desc: t.task2Selection.types.random.desc },
        { id: 'innovation', nameZh: t.task2Selection.types.innovation.title, nameEn: t.task2Selection.types.innovation.nameEn, icon: '🔮', desc: t.task2Selection.types.innovation.desc },
    ];

    const topicChoices: Array<{ id: Task2TopicCategory; label: string }> = [
        { id: 'all', label: t.task2Selection.topics.all },
        { id: 'education', label: t.task2Selection.topics.education },
        { id: 'technology', label: t.task2Selection.topics.technology },
        { id: 'culture', label: t.task2Selection.topics.culture },
        { id: 'urbanization', label: t.task2Selection.topics.urbanization },
        { id: 'government', label: t.task2Selection.topics.government },
        { id: 'environment', label: t.task2Selection.topics.environment },
        { id: 'media', label: t.task2Selection.topics.media },
        { id: 'society', label: t.task2Selection.topics.society },
        { id: 'abstract', label: t.task2Selection.topics.abstract },
        { id: 'random', label: t.task2Selection.topics.random },
        { id: 'innovation', label: t.task2Selection.topics.innovation },
    ];

    const selected = taskTypes.find(x => x.id === selectedType) ?? taskTypes[0];
    const topicQuery = `topic=${encodeURIComponent(selectedTopicCategory)}`;
    const navigateState = {
        customName: customName.trim(),
        customDescription: customDescription.trim(),
    };

    const handleStart = () => {
        if (selectedType === 'random') {
            const mainPool = ['opinion', 'report', 'mixed', 'innovation'];
            const randomMain = mainPool[Math.floor(Math.random() * mainPool.length)];

            if (randomMain === 'opinion') {
                const opinionPool = ['opinion_agree', 'opinion_discuss', 'opinion_advantages'];
                const randomOpinion = opinionPool[Math.floor(Math.random() * opinionPool.length)];
                clearTask2Session(randomOpinion);
                navigate(`/writing/task2/doing?type=${randomOpinion}&${topicQuery}`, { state: navigateState });
            } else {
                clearTask2Session(randomMain);
                navigate(`/writing/task2/doing?type=${randomMain}&${topicQuery}`, { state: navigateState });
            }
            return;
        }

        const target = taskTypes.find(x => x.id === selectedType);
        if (target) {
            if (target.id === 'opinion') {
                navigate(`/writing/task2/opinion?${topicQuery}`, { state: navigateState });
            } else {
                clearTask2Session(target.id);
                navigate(`/writing/task2/doing?type=${target.id}&${topicQuery}`, { state: navigateState });
            }
        }
    };

    return (
        <Layout
            backUrl="/writing"
            backText={t.task2Selection.backToWriting}
            pageTitle={t.task2Selection.heading}
            pageSubtitle={t.task2Selection.subheading}
        >
            <div className="uc-console">
                <div className="uc-sidebar">
                    <div className="uc-sidebar-title">{t.task2Selection.heading}</div>
                    <nav className="uc-sidebar-nav">
                        {taskTypes.map(typeItem => (
                            <button
                                key={typeItem.id}
                                type="button"
                                className={`uc-nav-item ${selectedType === typeItem.id ? 'active' : ''}`}
                                onClick={() => setSelectedType(typeItem.id)}
                            >
                                <span className="nav-icon">{typeItem.icon}</span>
                                <span className="nav-text">{lang === 'zh' ? typeItem.nameZh : typeItem.nameEn}</span>
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

                        <div className="uc-card-group">
                            <div className="uc-list-row uc-row-vertical">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>🎯</span>
                                        <span className="row-title">{t.task2Selection.topicLabel}</span>
                                    </div>
                                    <span className="row-desc">{t.task2Selection.topicHint}</span>
                                </div>
                                <div className="task2-topic-single-grid" role="radiogroup" aria-label={t.task2Selection.topicLabel} style={{ marginTop: 4 }}>
                                    {topicChoices.map(topic => (
                                        <button
                                            key={topic.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={selectedTopicCategory === topic.id}
                                            className={`task2-topic-chip ${selectedTopicCategory === topic.id ? 'active' : ''}`}
                                            onClick={() => setSelectedTopicCategory(topic.id)}
                                        >
                                            {topic.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="uc-console-footer">
                        <button className="uc-console-start-btn" onClick={handleStart}>
                            {selected.icon} {t.task2Selection.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
