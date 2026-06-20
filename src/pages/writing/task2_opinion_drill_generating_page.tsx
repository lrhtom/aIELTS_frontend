import Layout from '../../components/layout/Layout';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import {
    generateOpinionDrillQuestions,
    type OpinionDrillCategory,
    type OpinionDrillQuestion,
} from '../../api/task2_opinion_drill';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';
import '../../styles/task2_opinion_drill.css';

interface DrillGeneratingState {
    questionCount: number;
    categories: OpinionDrillCategory[];
}

interface DrillDoingRouteState {
    questions: OpinionDrillQuestion[];
}

const PENDING_CONFIG_KEY = 'task2OpinionDrillGeneratingPendingV1';

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

export default function Task2OpinionDrillGeneratingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { lang } = useLang();
    const t = translations[lang];

    const routeState = location.state as DrillGeneratingState | null;

    const readPendingConfig = (): DrillGeneratingState | null => {
        try {
            const raw = sessionStorage.getItem(PENDING_CONFIG_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as DrillGeneratingState;
            if (!parsed || !Array.isArray(parsed.categories) || !Number.isFinite(parsed.questionCount)) {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    };

    const writePendingConfig = (config: DrillGeneratingState) => {
        sessionStorage.setItem(PENDING_CONFIG_KEY, JSON.stringify(config));
    };

    const clearPendingConfig = () => {
        sessionStorage.removeItem(PENDING_CONFIG_KEY);
    };

    const parseErrorMessage = (err: unknown, fallback: string) => {
        const e = err as { message?: string };
        return e?.message || fallback;
    };

    useEffect(() => {
        const pending = routeState ?? readPendingConfig();
        const count = pending?.questionCount;
        const categoriesRaw = pending?.categories;

        if (!Number.isFinite(count) || !Array.isArray(categoriesRaw) || count! < 1 || count! > 10) {
            showToast(t.task2OpinionDrill.missingConfig, 'error');
            clearPendingConfig();
            navigate('/writing/task2/opinion-drill', { replace: true });
            return;
        }

        writePendingConfig({
            questionCount: Number(count),
            categories: categoriesRaw,
        });

        const safeCount = Number(count);
        const categories = categoriesRaw.filter((item): item is OpinionDrillCategory =>
            CATEGORY_ORDER.includes(item)
        );

        let cancelled = false;

        const runGeneration = async () => {
            try {
                const { questions } = await generateOpinionDrillQuestions({
                    count: safeCount,
                    categories,
                });

                if (cancelled) return;

                if (!questions || questions.length === 0) {
                    throw new Error(t.task2OpinionDrill.startFail);
                }

                const doingState: DrillDoingRouteState = { questions };
                clearPendingConfig();
                navigate('/writing/task2/opinion-drill/doing', {
                    replace: true,
                    state: doingState,
                });
            } catch (err: unknown) {
                if (cancelled) return;
                showToast(parseErrorMessage(err, t.task2OpinionDrill.startFail), 'error');
                navigate('/writing/task2/opinion-drill', { replace: true });
            }
        };

        runGeneration();

        return () => {
            cancelled = true;
        };
    }, [navigate, routeState, t.task2OpinionDrill.missingConfig, t.task2OpinionDrill.startFail]);

    const handleBack = () => {
        clearPendingConfig();
        navigate('/writing/task2/opinion-drill');
    };

    return (
        <Layout
            onBack={handleBack}
            backText={t.task2OpinionDrill.backToSetup}
            pageTitle={t.task2OpinionDrill.heading}
            pageSubtitle={t.task2OpinionDrill.subheading}
            headerRight={<AiModelSelector variant="minimal" />}
        >
            <div className="practice-container writing-selection-page">

                <div className="wp-state-wrap">
                    <div className="spinner wp-loading-spinner"></div>
                    <h2>{t.task2OpinionDrill.generatingTitle}</h2>
                    <p>{t.task2OpinionDrill.generatingDesc}</p>
                </div>
            </div>
        </Layout>
    );
}
