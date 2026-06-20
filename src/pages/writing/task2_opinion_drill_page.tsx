import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import {
    type OpinionDrillCategory,
} from '../../api/task2_opinion_drill';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';
import '../../styles/task2_opinion_drill.css';

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
    const { lang } = useLang();
    const t = translations[lang];

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
            showToast(t.task2OpinionDrill.countRangeError, 'error');
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
            backText={t.task2OpinionDrill.backToTask2Selection}
            pageTitle={t.task2OpinionDrill.heading}
            pageSubtitle={t.task2OpinionDrill.subheading}
            headerRight={<AiModelSelector variant="minimal" />}
        >
            <div className="practice-container writing-selection-page">

                <div className="config-card writing-selection-card opinion-drill-config-card">
                    <div className="opinion-drill-form-grid">
                        <label className="opinion-drill-label" htmlFor="opinion-drill-count">
                            {t.task2OpinionDrill.countLabel}
                        </label>
                        <input
                            id="opinion-drill-count"
                            type="number"
                            min={1}
                            max={10}
                            value={questionCount}
                            onChange={(e) => setQuestionCount(Number(e.target.value))}
                            className="opinion-drill-count-input"
                        />
                        <p className="opinion-drill-help">{t.task2OpinionDrill.countHint}</p>
                    </div>

                    <div className="opinion-drill-category-area">
                        <div className="opinion-drill-label">{t.task2OpinionDrill.categoriesLabel}</div>
                        <div className="opinion-drill-category-grid">
                            {CATEGORY_ORDER.map((category) => {
                                const active = selectedCategories.has(category);
                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        className={`opinion-drill-category-chip${active ? ' active' : ''}`}
                                        onClick={() => toggleCategory(category)}
                                    >
                                        {t.task2OpinionDrill.categories[category]}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="opinion-drill-help">{t.task2OpinionDrill.randomHint}</p>
                    </div>

                    <div className="writing-selection-actions">
                        <button className="primary-button writing-selection-start-btn" onClick={handleStart}>
                            {t.task2OpinionDrill.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
