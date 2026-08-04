/**
 *  mock: skip the settlement overlay, persist and return to the hub (marking is deferred to the score report)
 *
 * Config page for the full writing set (Task 1 + Task 2).
 * Generates both questions at once: a Task 1 chart/map/process diagram plus a Task 2 essay,
 */
import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import CustomPromptField from '../../components/common/CustomPromptField';
import { showToast } from '../../components/common/Toast';
import { generateWritingFull } from '../../api/ai_question';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';

const TASK1_TYPES = ['random', 'line', 'bar', 'pie', 'horizontal', 'table', 'mixed', 'flowchart', 'map'] as const;
const TASK2_TYPES = ['opinion', 'opinion_agree', 'opinion_discuss', 'opinion_advantages', 'report', 'mixed'] as const;

export default function WritingFullConfigPage() {
    const navigate = useNavigate();
    const { t } = useLang();

    const [task1Type, setTask1Type] = useState<string>('random');
    const [task2Type, setTask2Type] = useState<string>('opinion');
    const [customName, setCustomName] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleStart = async () => {
        if (submitting) return;                       //stored as a single parent card in the bank whose children are answered separately (untimed and unordered, unlike the full mock).
        setSubmitting(true);
        try {
            const r = await generateWritingFull({
                task1Type,
                task2Type,
                customName: customName.trim(),
                customPrompt: customPrompt.trim(),
            });
            showToast(t('writingFull.toastStarted'), 'success');
            navigate(`/writing/full/${r.aiQuestionId}`);
        } catch {
            showToast(t('writingFull.toastStartFail'), 'error');
            setSubmitting(false);
        }
    };

    return (
        <Layout
            pageTitle={t('writingFull.configTitle')}
            pageSubtitle={t('writingFull.configSubtitle')}
            backUrl="/writing"
            backText={t('writingFull.backToWriting')}
        >
            <div className="practice-container">
                <div className="config-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <h3 style={{ marginTop: 0 }}>{t('writingFull.task1Label')}</h3>
                        <div className="wf-chip-row">
                            {TASK1_TYPES.map(id => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`wf-chip ${task1Type === id ? 'is-active' : ''}`}
                                    onClick={() => setTask1Type(id)}
                                >
                                    {t(`writingFull.task1Types.${id}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 style={{ marginTop: 0 }}>{t('writingFull.task2Label')}</h3>
                        <div className="wf-chip-row">
                            {TASK2_TYPES.map(id => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`wf-chip ${task2Type === id ? 'is-active' : ''}`}
                                    onClick={() => setTask2Type(id)}
                                >
                                    {t(`writingFull.task2Types.${id}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="wf-field">
                        <span>{t('writingFull.customNameLabel')}</span>
                        <input
                            type="text"
                            value={customName}
                            maxLength={100}
                            placeholder={t('writingFull.customNamePlaceholder')}
                            onChange={e => setCustomName(e.target.value)}
                        />
                    </label>

                    <CustomPromptField value={customPrompt} onChange={setCustomPrompt} />
                    <AiModelSelector />

                    <button type="button" className="wf-start-btn" onClick={() => { void handleStart(); }} disabled={submitting}>
                        {submitting ? t('writingFull.starting') : t('writingFull.startBtn')}
                    </button>
                    <p className="wf-note">{t('writingFull.costNote')}</p>
                </div>
            </div>
        </Layout>
    );
}
