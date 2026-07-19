import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import {
    type OpinionDrillCategory,
} from '../../api/task2_opinion_drill';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';

const CATEGORY_ORDER: OpinionDrillCategory[] = [
    'education',
    'technology',
    'culture',
    'urbanization',
    'government',
    'environment',
    'media',
    'society',
    'abstract',
];

export default function Task2OpinionDrillPage() {
    const navigate = useNavigate();
    const { t } = useLang();

    const [questionCount, setQuestionCount] = useState(3);
    const [selectedCategories, setSelectedCategories] = useState<Set<OpinionDrillCategory>>(new Set());

    const toggleCategory = (category: OpinionDrillCategory) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const handleStart = () => {
        if (!Number.isFinite(questionCount) || questionCount < 1 || questionCount > 10) {
            showToast(t('task2OpinionDrill.countRangeError'), 'error');
            return;
        }

        navigate('/writing/task2/opinion-drill/generating', {
            state: {
                questionCount,
                categories: Array.from(selectedCategories),
            },
        });
    };

    return (
        <Layout
            backUrl="/writing"
            backText={t('task2OpinionDrill.backToTask2Selection')}
            pageTitle={t('task2OpinionDrill.heading')}
            pageSubtitle={t('task2OpinionDrill.subheading')}
        >
            <div className="uc-console">
                <div className="uc-main-content" style={{ borderLeft: 'none' }}>
                    <div className="uc-main-header">
                        <h2>{t('task2OpinionDrill.heading')}</h2>
                        <p>{t('task2OpinionDrill.subheading')}</p>
                    </div>

                    <div className="uc-settings-list">
                        <div className="uc-card-group">
                            {/* AI Model */}
                            <div className="uc-list-row">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#f59e0b', background: '#fef3c7' }}>🤖</span>
                                        <span className="row-title">{t('components.aiModel.label')}</span>
                                    </div>
                                </div>
                                <div className="uc-row-control console-model-selector">
                                    <AiModelSelector label="" description="" />
                                </div>
                            </div>

                            {/* Question Count */}
                            <div className="uc-list-row">
                                <div className="uc-row-label">
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#6366f1', background: '#eef2ff' }}>🔢</span>
                                        <span className="row-title">{t('task2OpinionDrill.countLabel')}</span>
                                    </div>
                                    <span className="row-desc" style={{ marginLeft: '40px' }}>{t('task2OpinionDrill.countHint')}</span>
                                </div>
                                <div className="uc-row-control">
                                    <input
                                        id="opinion-drill-count"
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={questionCount}
                                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                                        className="console-select"
                                        style={{ width: 100, paddingLeft: 12 }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="uc-card-group">
                            {/* Categories (multi-select) */}
                            <div className="uc-list-row uc-row-vertical">
                                <div className="uc-row-label-flex">
                                    <div className="uc-row-label" style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>🏷️</span>
                                        <span className="row-title">{t('task2OpinionDrill.categoriesLabel')}</span>
                                    </div>
                                    <span className="row-desc">{t('task2OpinionDrill.randomHint')}</span>
                                </div>
                                <div
                                    className="task2-topic-single-grid"
                                    role="group"
                                    aria-label={t('task2OpinionDrill.categoriesLabel')}
                                    style={{ marginTop: 4 }}
                                >
                                    {CATEGORY_ORDER.map((category) => {
                                        const active = selectedCategories.has(category);
                                        return (
                                            <button
                                                key={category}
                                                type="button"
                                                aria-pressed={active}
                                                className={`task2-topic-chip ${active ? 'active' : ''}`}
                                                onClick={() => toggleCategory(category)}
                                            >
                                                {t(`task2OpinionDrill.categories.${category}`)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="uc-console-footer">
                        <button className="uc-console-start-btn" onClick={handleStart}>
                            🧠 {t('task2OpinionDrill.startBtn')}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
