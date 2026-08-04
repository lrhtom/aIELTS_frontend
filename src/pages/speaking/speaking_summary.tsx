import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import Layout from '../../components/layout/Layout';
import { useLang } from '../../i18n/LanguageContext';
import { getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import '../../styles/speaking_summary.css';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    scores?: {
        grammar?: number;
        vocab?: number;
        relevance?: number;
        coherence?: number;
        depth?: number;
        accuracy?: number;
        pronunciation?: number;
        completeness?: number;
        fluency?: number;
        are_a?: number;
        are_r?: number;
        are_e?: number;
    };
}

interface Word {
    en: string;
    zh?: string;
    count: number;
}

/** Round to nearest 0.5 */
const to05 = (n: number) => Math.round(n * 2) / 2;
/** Azure 100-scale → 9.0-scale */
const azureTo9 = (v: number | undefined) => v != null ? to05(v * 9 / 100) : 0;

type DimKey = string;

// -- Aggregate statistics (pure functions: rendering and the bank write-back share one definition) ----------------------
const CORE_DIM_KEYS = ['accuracy', 'pronunciation', 'fluency', 'completeness', 'grammar', 'vocab', 'relevance'];

function activeKeysFor(mode?: string): string[] {
    if (mode === 'part1') return [...CORE_DIM_KEYS, 'are_a', 'are_r', 'are_e'];
    if (mode === 'part2' || mode === 'part3') return [...CORE_DIM_KEYS, 'coherence', 'depth'];
    if (mode === 'fullTest') return [...CORE_DIM_KEYS, 'are_a', 'are_r', 'are_e', 'coherence', 'depth'];
    return [...CORE_DIM_KEYS];
}

function computeRounds(chatHistory: ChatMessage[]) {
    // Always pull all possible dimensions so that fullTest mode (which shows
    // are_a/r/e + coherence/depth together) never leaks undefined into averages.
    return chatHistory
        .filter(m => m.role === 'assistant' && m.scores)
        .map((m, i) => {
            const sc = m.scores!;
            const vals: Record<string, number> = {
                accuracy:      azureTo9(sc.accuracy),
                pronunciation: azureTo9(sc.pronunciation),
                fluency:       azureTo9(sc.fluency),
                completeness:  azureTo9(sc.completeness),
                grammar:       sc.grammar ?? 0,
                vocab:         sc.vocab ?? 0,
                relevance:     sc.relevance ?? 0,
                coherence:     sc.coherence ?? 0,
                depth:         sc.depth ?? 0,
                are_a:         sc.are_a ?? 0,
                are_r:         sc.are_r ?? 0,
                are_e:         sc.are_e ?? 0,
            };
            return { round: i + 1, ...vals };
        });
}

function computeSummaryStats(chatHistory: ChatMessage[], mode?: string) {
    const keys = activeKeysFor(mode);
    const rounds = computeRounds(chatHistory);
    const count = rounds.length || 1;
    const avgs: Record<DimKey, number> = {};
    for (const k of keys) {
        avgs[k] = to05(rounds.reduce((a, r) => a + ((r as Record<string, number>)[k] ?? 0), 0) / count);
    }
    const allAvgValues = Object.values(avgs);
    const overall = allAvgValues.length ? to05(allAvgValues.reduce((a, v) => a + v, 0) / allAvgValues.length) : 0;
    return { rounds, avgs, overall };
}

interface SummaryNavState {
    chatHistory: ChatMessage[];
    scenarioPrompt: string;
    words: Word[];
    mode?: string;
    /** The bank session id when arriving from the chat page; when set, the summary is written back to the bank */
    sessionId?: number | null;
    /** Full mock: the back button returns to the mock exam hub */
    mockId?: number;
}

export default function SpeakingSummaryPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useLang();

    const DIMS = [
        { key: 'accuracy',      label: t('speakingConfig.summary.metricAccuracy'),       azure: true,  color: '#6366f1' },
        { key: 'pronunciation', label: t('speakingConfig.summary.metricPronunciation'),  azure: true,  color: '#818cf8' },
        { key: 'fluency',       label: t('speakingConfig.summary.metricFluency'),        azure: true,  color: '#3b82f6' },
        { key: 'completeness',  label: t('speakingConfig.summary.metricCompleteness'),   azure: true,  color: '#06b6d4' },
        { key: 'grammar',       label: t('speakingConfig.summary.metricGrammar'),        azure: false, color: '#8b5cf6' },
        { key: 'vocab',         label: t('speakingConfig.summary.metricVocab'),          azure: false, color: '#7c3aed' },
        { key: 'relevance',     label: t('speakingConfig.summary.metricRelevance'),      azure: false, color: '#f59e0b' },
    ] as const;
    const captureRef = useRef<HTMLDivElement>(null);
    const [sharing, setSharing] = useState(false);

    const handleShare = async () => {
        if (!captureRef.current || sharing) return;
        setSharing(true);
        try {
            const canvas = await html2canvas(captureRef.current, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#ffffff',
                scale: 2,
                useCORS: true,
            });
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) return;

            // 1. download locally
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `speaking-report-${new Date().toISOString().slice(0, 10)}.png`;
            a.click();
            URL.revokeObjectURL(url);

            // 2. copy to clipboard
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
            } catch {
                // some browsers cannot write images to the clipboard, ignore silently
            }
        } catch (e) {
            console.error('Share failed', e);
        } finally {
            setSharing(false);
        }
    };

    const navState = (location.state ?? null) as SummaryNavState | null;
    const [searchParams] = useSearchParams();
    const bankIdRaw = searchParams.get('bankId');
    const bankId = bankIdRaw && !Number.isNaN(Number(bankIdRaw)) ? Number(bankIdRaw) : null;
    const [data, setData] = useState<SummaryNavState | null>(navState);
    const [loadFailed, setLoadFailed] = useState(false);

    // -- Opened from the AI bank (?bankId=): fetch the stored conversation and config to render the report ----------
    useEffect(() => {
        if (data || !bankId) return;
        getAIQuestion(bankId).then(detail => {
            const ua = (detail.userAnswer || {}) as Record<string, unknown>;
            const content = (detail.content || {}) as Record<string, unknown>;
            setData({
                chatHistory: Array.isArray(ua.chatHistory) ? ua.chatHistory as ChatMessage[] : [],
                scenarioPrompt: String(content.scenarioPrompt || ''),
                words: Array.isArray(ua.words) ? ua.words as Word[] : [],
                mode: String(ua.activeMode || detail.subtype || 'chat'),
            });
        }).catch(() => setLoadFailed(true));
    }, [bankId, data]);

    // -- First arrival from the chat page (with sessionId): write the summary back to the bank --------------------
    // Once written, the session counts as having a result in the bank and clicking the card lands on this report.
    const savedRef = useRef(false);
    useEffect(() => {
        if (savedRef.current || !navState?.sessionId || !navState.chatHistory?.length) return;
        savedRef.current = true;
        const stats = computeSummaryStats(navState.chatHistory, navState.mode);
        submitAIQuestion(navState.sessionId, {
            chatHistory: navState.chatHistory,
            words: navState.words ?? [],
            activeMode: navState.mode ?? 'chat',
            scenarioPrompt: navState.scenarioPrompt ?? '',
            finished: true,
        }, {
            mode: navState.mode ?? 'chat',
            overall: stats.overall,
            dims: stats.avgs,
            rounds: stats.rounds.length,
            savedAt: new Date().toISOString(),
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const mockIdRaw = searchParams.get('mockId');
    const mockId = navState?.mockId ?? (mockIdRaw && !Number.isNaN(Number(mockIdRaw)) ? Number(mockIdRaw) : null);
    const backTarget = mockId ? `/mock/${mockId}` : (bankId ? '/practice/ai/bank?skill=speaking' : '/speaking');

    if (!data) {
        if (bankId && !loadFailed) {
            return (
                <Layout>
                    <div className="ss-empty">
                        <h2>{t('speakingConfig.summary.loadingReport')}</h2>
                    </div>
                </Layout>
            );
        }
        return (
            <Layout>
                <div className="ss-empty">
                    <h2>{t('speakingConfig.summary.noData')}</h2>
                    <button className="ss-back-btn" onClick={() => navigate(backTarget)}>{t('speakingConfig.scenarioSummary.backBtn')}</button>
                </div>
            </Layout>
        );
    }

    const { chatHistory, scenarioPrompt, words, mode } = data;
    const isPart1 = mode === 'part1';
    const isPart2 = mode === 'part2';
    const isPart3 = mode === 'part3';
    const isFullTest = mode === 'fullTest';

    let activeDims: Array<{ key: string, label: string, azure: boolean, color: string }> = [...DIMS];
    if (isPart1) {
        activeDims = [
            ...DIMS,
            { key: 'are_a', label: '🇦 Answer', azure: false, color: '#f43f5e' },
            { key: 'are_r', label: '🇷 Reason', azure: false, color: '#f97316' },
            { key: 'are_e', label: '🇪 Example', azure: false, color: '#eab308' },
        ];
    } else if (isPart2 || isPart3) {
        activeDims = [
            ...DIMS,
            { key: 'coherence', label: t('speakingConfig.summary.metricCoherence'), azure: false, color: '#22c55e' },
            { key: 'depth', label: t('speakingConfig.summary.metricDepth'), azure: false, color: '#ef4444' },
        ];
    } else if (isFullTest) {
        // Full Test: include all possible dimensions
        activeDims = [
            ...DIMS,
            { key: 'are_a', label: '🇦 Answer', azure: false, color: '#f43f5e' },
            { key: 'are_r', label: '🇷 Reason', azure: false, color: '#f97316' },
            { key: 'are_e', label: '🇪 Example', azure: false, color: '#eab308' },
            { key: 'coherence', label: t('speakingConfig.summary.metricCoherence'), azure: false, color: '#22c55e' },
            { key: 'depth', label: t('speakingConfig.summary.metricDepth'), azure: false, color: '#ef4444' },
        ];
    }

    // Always via computeSummaryStats, so rendering and the bank write-back stay in step
    // (activeDims' key order matches activeKeysFor(mode) exactly; this only adds display labels and colours)
    const { rounds, avgs, overall } = computeSummaryStats(chatHistory, mode);

    // Vocab coverage
    const usedWords = words.filter(w => w.count > 0).length;
    const totalWords = words.length;
    const coveragePercent = totalWords ? Math.round((usedWords / totalWords) * 100) : 0;

    const pct = (score: number) => Math.round((score / 9) * 100);

    return (
        <Layout>
            <div className="ss-root" ref={captureRef}>
                <header className="ss-header">
                    <h1>{isFullTest ? t('speakingConfig.summary.fullTestTitle') : t('speakingConfig.scenarioSummary.title')}</h1>
                    <p>{isFullTest ? t('speakingConfig.summary.fullTestSubtitle') : t('speakingConfig.scenarioSummary.subtitle')}</p>
                </header>

                {/* Hero scores */}
                <div className="ss-hero-card">
                    <div className="ss-hero-grid">
                        <div className="ss-hero-item">
                            <span className="ss-hero-label">{t('speakingConfig.scenarioSummary.overallScore')}</span>
                            <span className="ss-hero-value ss-primary">{overall}</span>
                            <span className="ss-hero-unit">/ 9.0</span>
                        </div>
                        <div className="ss-hero-item">
                            <span className="ss-hero-label">{t('speakingConfig.scenarioSummary.vocabCoverage')}</span>
                            <span className="ss-hero-value ss-secondary">{usedWords}/{totalWords}</span>
                            <span className="ss-hero-unit">{coveragePercent}%</span>
                        </div>
                    </div>

                    {/* 7-dimension bars */}
                    <div className="ss-bars">
                        {activeDims.map(dim => (
                            <div className="ss-bar-row" key={dim.key}>
                                <span className="ss-bar-label">{dim.label}</span>
                                <div className="ss-bar-track">
                                    <div className="ss-bar-fill" style={{ width: `${pct(avgs[dim.key])}%`, background: dim.color }} />
                                </div>
                                <span className="ss-bar-score">{avgs[dim.key]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Per-round detail table */}
                {rounds.length > 0 && (
                    <div className="ss-section">
                        <h3 className="ss-section-title">{t('speakingConfig.summary.perRoundHeading')}</h3>
                        <div className="ss-table-wrap">
                            <table className="ss-table">
                                <thead>
                                    <tr>
                                        <th>{t('speakingConfig.summary.colRound')}</th>
                                        {activeDims.map(d => <th key={d.key}>{d.label.slice(2)}</th>)}
                                        <th>{t('speakingConfig.summary.colAvg')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rounds.map(r => {
                                        const roundAvg = to05(activeDims.reduce((a, d) => a + (r as any)[d.key], 0) / activeDims.length);
                                        return (
                                            <tr key={r.round}>
                                                <td className="ss-td-round">R{r.round}</td>
                                                {activeDims.map(d => <td key={d.key}>{(r as any)[d.key]}</td>)}
                                                <td className="ss-td-avg">{roundAvg}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="ss-tr-summary">
                                        <td className="ss-td-round">{t('speakingConfig.summary.avgRow')}</td>
                                        {activeDims.map(d => <td key={d.key}>{avgs[d.key]}</td>)}
                                        <td className="ss-td-avg">{overall}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Scenario description */}
                {scenarioPrompt && !isPart1 && (
                    <div className="ss-section">
                        <h3 className="ss-section-title">{t('speakingConfig.summary.scenarioHeading')}</h3>
                        <div className="ss-scenario-quote">"{scenarioPrompt}"</div>
                    </div>
                )}

                {/* Vocabulary review */}
                {words.length > 0 && (
                    <div className="ss-section">
                        <h3 className="ss-section-title">{t('speakingConfig.summary.vocabHeading')}</h3>
                        <div className="ss-word-chips">
                            {words.map((w, i) => (
                                <span key={i} className={`ss-chip ${w.count > 0 ? 'ss-chip-used' : ''}`}>
                                    {w.en} {w.count > 0 && <span className="ss-chip-count">×{w.count}</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="ss-footer">
                    <button className="ss-share-btn" onClick={handleShare} disabled={sharing}>
                        {sharing ? t('speakingConfig.summary.sharing') : t('speakingConfig.summary.shareBtn')}
                    </button>
                    <button className="ss-back-btn" onClick={() => navigate(backTarget)}>
                        {t('speakingConfig.scenarioSummary.backBtn')}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
