import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import { showConfirm } from '../common/ConfirmService';
import { useLang } from '../../i18n/LanguageContext';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';

interface SurveyItem {
    id: number;
    username: string;
    prep_duration: string;
    target_band: string;
    q_all_skills: number;
    q_reading_relevant: number;
    q_listening_clear: number;
    q_speaking_anxiety: number;
    q_writing_feedback: number;
    q_vocab_memory: number;
    q_easy_navigate: number;
    q_recommend: number;
    most_useful: string;
    improvements: string;
    other_comments: string;
    created_at: string;
}

interface PaginatedResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: SurveyItem[];
}

interface SurveyStats {
    total: number;
    averages: Record<string, number | null>;
    prepDurationDist: Record<string, number>;
    targetBandDist: Record<string, number>;
}

// 与 UserSurvey 一致的字段 ↔ 短键映射（profile.survey.bShort.<key>）。
const RATING_FIELDS = [
    { field: 'q_all_skills', key: 'allSkills' },
    { field: 'q_reading_relevant', key: 'readingRelevant' },
    { field: 'q_listening_clear', key: 'listeningClear' },
    { field: 'q_speaking_anxiety', key: 'speakingAnxiety' },
    { field: 'q_writing_feedback', key: 'writingFeedback' },
    { field: 'q_vocab_memory', key: 'vocabMemory' },
    { field: 'q_easy_navigate', key: 'easyNavigate' },
    { field: 'q_recommend', key: 'recommend' },
] as const;

const PREP_OPTIONS = ['lt1m', '1to3m', '3to6m', '6mplus'] as const;
const BAND_OPTIONS = ['5.5-6.0', '6.5', '7.0', '7.5+'] as const;

const PAGE_SIZE = 10;

export default function AdminSurvey() {
    const { t } = useLang();
    const [items, setItems] = useState<SurveyItem[]>([]);
    const [stats, setStats] = useState<SurveyStats | null>(null);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // PNG 导出（复用 speaking_summary 的 html2canvas 写法：截图 → 下载 + 复制剪贴板）
    const questionsRef = useRef<HTMLDivElement>(null);
    const statsRef = useRef<HTMLDivElement>(null);
    // 单份作答的离屏截图源；导出哪一份就先把它渲染进去
    const respondentRef = useRef<HTMLDivElement>(null);
    const [printItem, setPrintItem] = useState<SurveyItem | null>(null);
    // 'q' 题目 / 'r' 汇总 / `c${id}` 某一份作答
    const [exporting, setExporting] = useState<string | null>(null);

    const exportPng = useCallback(async (node: HTMLElement | null, filename: string, kind: string) => {
        if (!node || exporting) return;
        setExporting(kind);
        try {
            const canvas = await html2canvas(node, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#ffffff',
                scale: 2,
                useCORS: true,
            });
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            } catch { /* 部分浏览器不支持写图片剪贴板，静默忽略 */ }
            toast.success(t('common.saved'));
        } catch (e) {
            console.error('Export PNG failed', e);
            toast.error(t('common.error'));
        } finally {
            setExporting(null);
        }
    }, [exporting, t]);

    const today = new Date().toISOString().slice(0, 10);

    // 下载某位用户的作答报告：先同步渲染离屏节点，再截图
    const exportRespondent = useCallback(async (item: SurveyItem) => {
        if (exporting) return;
        flushSync(() => setPrintItem(item));
        const day = item.created_at.slice(0, 10);
        await exportPng(respondentRef.current, `survey-${item.username}-${day}.png`, `c${item.id}`);
        setPrintItem(null);
    }, [exporting, exportPng]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await apiClient.get<SurveyStats>('/admin/surveys/stats');
            setStats(res.data);
        } catch (error) {
            console.error('Failed to fetch survey stats:', error);
        }
    }, []);

    const fetchItems = useCallback(async (page: number) => {
        setIsLoading(true);
        try {
            const res = await apiClient.get<PaginatedResponse>(`/admin/surveys?page=${page}&page_size=${PAGE_SIZE}`);
            setItems(res.data.results);
            setTotalCount(res.data.count);
        } catch (error) {
            console.error('Failed to fetch surveys:', error);
            toast.error(t('common.error'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { fetchItems(currentPage); }, [currentPage, fetchItems]);

    const handleDelete = async (id: number) => {
        if (!(await showConfirm({ message: t('profile.admin.survey.confirmDelete'), danger: true }))) return;
        try {
            await apiClient.delete(`/admin/surveys/${id}/delete`);
            toast.success(t('common.saved'));
            fetchStats();
            if (items.length === 1 && currentPage > 1) {
                setCurrentPage(prev => prev - 1);
            } else {
                fetchItems(currentPage);
            }
        } catch (error) {
            console.error('Failed to delete survey:', error);
            toast.error(t('common.error'));
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const demographics = (item: SurveyItem): string => {
        const parts: string[] = [];
        if (item.prep_duration) parts.push(t(`profile.survey.prepDuration.${item.prep_duration}`));
        if (item.target_band) parts.push(t(`profile.survey.targetBand.${item.target_band}`));
        return parts.length ? parts.join(' · ') : t('profile.admin.survey.anonymous');
    };

    const renderStats = () => {
        if (!stats) return null;
        const hasRatings = RATING_FIELDS.some(({ field }) => stats.averages[field] != null);
        return (
            <div className="survey-stats">
                <div className="stats-block">
                    <h3 className="stats-title">{t('profile.admin.survey.statsTitle')}</h3>
                    {hasRatings ? (
                        <div className="avg-bars">
                            {RATING_FIELDS.map(({ field, key }) => {
                                const avg = stats.averages[field];
                                const pct = avg != null ? (avg / 5) * 100 : 0;
                                return (
                                    <div className="avg-row" key={field}>
                                        <span className="avg-label">{t(`profile.survey.bShort.${key}`)}</span>
                                        <div className="avg-track">
                                            <div className="avg-fill" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="avg-value">{avg != null ? avg.toFixed(2) : t('profile.admin.survey.emptyField')}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="stats-empty">{t('profile.admin.survey.statsEmpty')}</div>
                    )}
                </div>

                <div className="stats-block">
                    <h3 className="stats-title">{t('profile.admin.survey.distTitle')}</h3>
                    <div className="dist-group">
                        <div className="dist-sub">{t('profile.admin.survey.prepDistTitle')}</div>
                        {PREP_OPTIONS.map(opt => (
                            <div className="dist-row" key={opt}>
                                <span className="dist-label">{t(`profile.survey.prepDuration.${opt}`)}</span>
                                <span className="dist-count">{t('profile.admin.survey.respondents').replace('{n}', String(stats.prepDurationDist[opt] || 0))}</span>
                            </div>
                        ))}
                    </div>
                    <div className="dist-group">
                        <div className="dist-sub">{t('profile.admin.survey.bandDistTitle')}</div>
                        {BAND_OPTIONS.map(opt => (
                            <div className="dist-row" key={opt}>
                                <span className="dist-label">{t(`profile.survey.targetBand.${opt}`)}</span>
                                <span className="dist-count">{t('profile.admin.survey.respondents').replace('{n}', String(stats.targetBandDist[opt] || 0))}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
        for (let i = start; i <= end; i++) {
            pages.push(
                <button key={i} className={`page-btn ${currentPage === i ? 'active' : ''}`} onClick={() => setCurrentPage(i)}>
                    {i}
                </button>
            );
        }
        return (
            <div className="pagination">
                <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>&laquo;</button>
                {start > 1 && <span className="dots">...</span>}
                {pages}
                {end < totalPages && <span className="dots">...</span>}
                <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>&raquo;</button>
            </div>
        );
    };

    return (
        <div className="admin-survey">
            <div className="admin-header">
                <h2>{t('profile.admin.survey.heading')}</h2>
                <div className="admin-header-right">
                    <div className="admin-stats-badge">
                        {t('profile.admin.survey.total').replace('{count}', String(stats?.total ?? totalCount))}
                    </div>
                    <button
                        type="button"
                        className="survey-export-btn"
                        disabled={exporting !== null}
                        onClick={() => exportPng(questionsRef.current, `survey-questions-${today}.png`, 'q')}
                    >
                        {exporting === 'q' ? t('profile.admin.survey.exporting') : t('profile.admin.survey.exportQuestions')}
                    </button>
                    <button
                        type="button"
                        className="survey-export-btn"
                        disabled={exporting !== null || !stats}
                        onClick={() => exportPng(statsRef.current, `survey-results-${today}.png`, 'r')}
                    >
                        {exporting === 'r' ? t('profile.admin.survey.exporting') : t('profile.admin.survey.exportResults')}
                    </button>
                </div>
            </div>

            <div ref={statsRef}>
                {renderStats()}
            </div>

            {/* 离屏可打印问卷（导出题目 PNG 的截图源，按 Appendix B 排版） */}
            <div className="survey-print-offscreen" aria-hidden="true">
                <div ref={questionsRef} className="survey-print">
                    <h1 className="sp-title">{t('profile.survey.heading')}</h1>
                    <p className="sp-intro">{t('profile.survey.intro')}</p>

                    <h2 className="sp-section">{t('profile.survey.partADemographics')}</h2>
                    <div className="sp-q">{t('profile.survey.q1Label')}</div>
                    <div className="sp-opts">
                        {PREP_OPTIONS.map(opt => (
                            <span className="sp-opt" key={opt}>☐ {t(`profile.survey.prepDuration.${opt}`)}</span>
                        ))}
                    </div>
                    <div className="sp-q">{t('profile.survey.q2Label')}</div>
                    <div className="sp-opts">
                        {BAND_OPTIONS.map(opt => (
                            <span className="sp-opt" key={opt}>☐ {t(`profile.survey.targetBand.${opt}`)}</span>
                        ))}
                    </div>

                    <h2 className="sp-section">{t('profile.survey.partBEvaluation')}</h2>
                    <p className="sp-hint">{t('profile.survey.ratingHint')}</p>
                    {RATING_FIELDS.map(({ field, key }) => (
                        <div className="sp-rating" key={field}>
                            <span className="sp-rating-q">{t(`profile.survey.b.${key}`)}</span>
                            <span className="sp-scale">1&nbsp;&nbsp;2&nbsp;&nbsp;3&nbsp;&nbsp;4&nbsp;&nbsp;5</span>
                        </div>
                    ))}

                    <h2 className="sp-section">{t('profile.survey.partCOpen')}</h2>
                    <div className="sp-q">{t('profile.survey.c.mostUseful')}</div>
                    <div className="sp-line" />
                    <div className="sp-q">{t('profile.survey.c.improvements')}</div>
                    <div className="sp-line" />
                    <div className="sp-q">{t('profile.survey.c.otherComments')}</div>
                    <div className="sp-line" />
                </div>

                {/* 单份作答报告（点卡片下载按钮时才有内容） */}
                <div ref={respondentRef} className="survey-print">
                    {printItem && (
                        <>
                            <h1 className="sp-title">{t('profile.admin.survey.reportTitle')}</h1>
                            <p className="sp-intro">
                                @{printItem.username} · {new Date(printItem.created_at).toLocaleString()}
                            </p>

                            <h2 className="sp-section">{t('profile.survey.partADemographics')}</h2>
                            <div className="sp-a-row">
                                <span className="sp-a-q">{t('profile.survey.q1Label')}</span>
                                <span className="sp-a-v">
                                    {printItem.prep_duration
                                        ? t(`profile.survey.prepDuration.${printItem.prep_duration}`)
                                        : t('profile.survey.notAnswered')}
                                </span>
                            </div>
                            <div className="sp-a-row">
                                <span className="sp-a-q">{t('profile.survey.q2Label')}</span>
                                <span className="sp-a-v">
                                    {printItem.target_band
                                        ? t(`profile.survey.targetBand.${printItem.target_band}`)
                                        : t('profile.survey.notAnswered')}
                                </span>
                            </div>

                            <h2 className="sp-section">{t('profile.survey.partBEvaluation')}</h2>
                            <p className="sp-hint">{t('profile.survey.ratingHint')}</p>
                            {RATING_FIELDS.map(({ field, key }) => (
                                <div className="sp-rating" key={field}>
                                    <span className="sp-rating-q">{t(`profile.survey.b.${key}`)}</span>
                                    <span className="sp-answer-val">{printItem[field] || '—'}</span>
                                </div>
                            ))}

                            <h2 className="sp-section">{t('profile.survey.partCOpen')}</h2>
                            <div className="sp-q">{t('profile.survey.c.mostUseful')}</div>
                            <div className="sp-a-text">{printItem.most_useful || t('profile.survey.notAnswered')}</div>
                            <div className="sp-q">{t('profile.survey.c.improvements')}</div>
                            <div className="sp-a-text">{printItem.improvements || t('profile.survey.notAnswered')}</div>
                            <div className="sp-q">{t('profile.survey.c.otherComments')}</div>
                            <div className="sp-a-text">{printItem.other_comments || t('profile.survey.notAnswered')}</div>
                        </>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="loading-state">{t('common.loading')}</div>
            ) : items.length === 0 ? (
                <div className="empty-state">{t('profile.admin.survey.noData')}</div>
            ) : (
                <div className="survey-list">
                    {items.map(item => (
                        <div key={item.id} className="survey-card">
                            <div className="survey-card-head">
                                <span className="survey-card-user">@{item.username}</span>
                                <span className="survey-card-demo">{demographics(item)}</span>
                                <span className="survey-card-date">{new Date(item.created_at).toLocaleString()}</span>
                                <button
                                    type="button"
                                    className="download-btn"
                                    disabled={exporting !== null}
                                    title={t('profile.admin.survey.downloadReport')}
                                    onClick={() => exportRespondent(item)}
                                >
                                    {exporting === `c${item.id}`
                                        ? t('profile.admin.survey.exporting')
                                        : `↓ ${t('profile.admin.survey.downloadReport')}`}
                                </button>
                                <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                                    {t('profile.admin.survey.delete')}
                                </button>
                            </div>

                            <div className="survey-card-ratings">
                                {RATING_FIELDS.map(({ field, key }) => (
                                    <div className="rating-chip" key={field}>
                                        <span className="rating-chip-label">{t(`profile.survey.bShort.${key}`)}</span>
                                        <span className="rating-chip-value">{item[field] || t('profile.admin.survey.emptyField')}</span>
                                    </div>
                                ))}
                            </div>

                            {(item.most_useful || item.improvements || item.other_comments) && (
                                <div className="survey-card-open">
                                    {item.most_useful && (
                                        <div className="open-row">
                                            <span className="open-label">{t('profile.admin.survey.mostUsefulLabel')}</span>
                                            <span className="open-text">{item.most_useful}</span>
                                        </div>
                                    )}
                                    {item.improvements && (
                                        <div className="open-row">
                                            <span className="open-label">{t('profile.admin.survey.improvementsLabel')}</span>
                                            <span className="open-text">{item.improvements}</span>
                                        </div>
                                    )}
                                    {item.other_comments && (
                                        <div className="open-row">
                                            <span className="open-label">{t('profile.admin.survey.otherLabel')}</span>
                                            <span className="open-text">{item.other_comments}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {renderPagination()}

            <style>{`
                .admin-survey {
                    padding: 20px;
                    max-width: 960px;
                }
                .admin-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .admin-header h2 {
                    margin: 0;
                    font-size: 1.25rem;
                    color: var(--color-text);
                }
                .admin-header-right {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .admin-stats-badge {
                    color: var(--color-text-secondary);
                    font-size: 0.85rem;
                    background: var(--color-bg);
                    padding: 4px 12px;
                    border-radius: 20px;
                    border: 1px solid var(--color-border);
                }
                .survey-export-btn {
                    padding: 6px 14px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    background: var(--color-primary);
                    color: #fff;
                    border: 1px solid var(--color-primary);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.18s ease;
                    white-space: nowrap;
                }
                .survey-export-btn:hover:not(:disabled) {
                    background: var(--color-primary-hover);
                    border-color: var(--color-primary-hover);
                }
                .survey-export-btn:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }
                /* 离屏可打印问卷：定位到视口外，仅作 html2canvas 截图源 */
                .survey-print-offscreen {
                    position: fixed;
                    left: -10000px;
                    top: 0;
                    pointer-events: none;
                }
                .survey-print {
                    width: 720px;
                    box-sizing: border-box;
                    padding: 40px 44px;
                    background: #ffffff;
                    color: #1a1a1a;
                    font-size: 15px;
                    line-height: 1.6;
                    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
                }
                .survey-print .sp-title {
                    margin: 0 0 6px;
                    font-size: 22px;
                    font-weight: 800;
                    color: #0d9488;
                }
                .survey-print .sp-intro {
                    margin: 0 0 20px;
                    color: #555;
                    font-size: 13.5px;
                }
                .survey-print .sp-section {
                    margin: 22px 0 12px;
                    padding-bottom: 6px;
                    border-bottom: 2px solid #0d9488;
                    font-size: 16px;
                    font-weight: 700;
                    color: #0d9488;
                }
                .survey-print .sp-hint {
                    margin: 0 0 14px;
                    font-size: 12.5px;
                    color: #777;
                    font-style: italic;
                }
                .survey-print .sp-q {
                    margin: 12px 0 6px;
                    font-weight: 600;
                    color: #1a1a1a;
                }
                .survey-print .sp-opts {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px 22px;
                    margin-bottom: 6px;
                }
                .survey-print .sp-opt {
                    font-size: 14px;
                    color: #333;
                }
                .survey-print .sp-rating {
                    display: flex;
                    /* 不能用 baseline：带 padding 的色块会被抬高，html2canvas 再按基线
                       画数字，两头一凑数字就跑到框外。改成 center + 固定行高。 */
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                    padding: 7px 0;
                    border-bottom: 1px dashed #e0e0e0;
                }
                .survey-print .sp-rating-q {
                    color: #1a1a1a;
                }
                .survey-print .sp-scale {
                    flex-shrink: 0;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 1px;
                    color: #0d9488;
                    font-weight: 700;
                }
                .survey-print .sp-line {
                    height: 0;
                    border-bottom: 1px solid #cfcfcf;
                    margin: 4px 0 10px;
                }
                /* 单份作答报告专用 */
                .survey-print .sp-answer-val {
                    flex-shrink: 0;
                    width: 30px;
                    height: 26px;
                    /* line-height 比 height 小 4px 是实测校准值：html2canvas 画文字
                       比浏览器低约 2px，26/26 会把数字压到框底。26/22 实测居中。 */
                    line-height: 22px;
                    padding: 0;
                    text-align: center;
                    font-weight: 800;
                    font-size: 15px;
                    color: #fff;
                    background: #0d9488;
                    border-radius: 6px;
                }
                .survey-print .sp-a-row {
                    display: flex;
                    justify-content: space-between;
                    gap: 18px;
                    padding: 7px 0;
                    border-bottom: 1px dashed #e0e0e0;
                }
                .survey-print .sp-a-q { color: #1a1a1a; }
                .survey-print .sp-a-v { flex-shrink: 0; font-weight: 700; color: #0d9488; }
                .survey-print .sp-a-text {
                    margin: 0 0 8px;
                    padding: 8px 12px;
                    background: #f5f5f5;
                    border-radius: 6px;
                    font-size: 14px;
                    color: #333;
                    white-space: pre-wrap;
                    word-break: break-word;
                    min-height: 18px;
                }
                .survey-stats {
                    display: grid;
                    grid-template-columns: 1.4fr 1fr;
                    gap: 16px;
                    margin-bottom: 24px;
                }
                .stats-block {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 20px;
                }
                .stats-title {
                    margin: 0 0 16px;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--color-primary);
                }
                .avg-bars {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .avg-row {
                    display: grid;
                    grid-template-columns: 110px 1fr 44px;
                    align-items: center;
                    gap: 10px;
                }
                .avg-label {
                    font-size: 0.82rem;
                    color: var(--color-text);
                }
                .avg-track {
                    height: 10px;
                    background: var(--color-bg);
                    border-radius: 999px;
                    overflow: hidden;
                    border: 1px solid var(--color-border);
                }
                .avg-fill {
                    height: 100%;
                    background: var(--color-primary);
                    border-radius: 999px;
                    transition: width 0.4s ease;
                }
                .avg-value {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--color-text);
                    text-align: right;
                }
                .stats-empty {
                    color: var(--color-text-secondary);
                    font-size: 0.85rem;
                    padding: 20px 0;
                    text-align: center;
                }
                .dist-group {
                    margin-bottom: 14px;
                }
                .dist-group:last-child {
                    margin-bottom: 0;
                }
                .dist-sub {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                    margin-bottom: 8px;
                }
                .dist-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85rem;
                    padding: 4px 0;
                    color: var(--color-text);
                }
                .dist-count {
                    color: var(--color-text-secondary);
                }
                .survey-list {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .survey-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                    padding: 18px 20px;
                    animation: surveyFadeIn 0.3s ease-out;
                }
                .survey-card-head {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                    margin-bottom: 14px;
                }
                .survey-card-user {
                    font-weight: 700;
                    color: var(--color-text);
                }
                .survey-card-demo {
                    font-size: 0.82rem;
                    color: var(--color-primary);
                    background: rgba(13, 148, 136, 0.08);
                    padding: 2px 10px;
                    border-radius: 999px;
                }
                .survey-card-date {
                    font-size: 0.78rem;
                    color: var(--color-text-secondary);
                    margin-left: auto;
                }
                .download-btn {
                    padding: 5px 12px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    background: rgba(13, 148, 136, 0.1);
                    color: var(--color-primary);
                    border: 1px solid rgba(13, 148, 136, 0.28);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                    font-family: inherit;
                }
                .download-btn:hover:not(:disabled) {
                    background: var(--color-primary);
                    color: #fff;
                    border-color: var(--color-primary);
                }
                .download-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .delete-btn {
                    padding: 5px 12px;
                    font-size: 0.82rem;
                    background: rgba(244, 67, 54, 0.1);
                    color: #f44336;
                    border: 1px solid rgba(244, 67, 54, 0.2);
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .delete-btn:hover {
                    background: #f44336;
                    color: #fff;
                }
                .survey-card-ratings {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                .rating-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: var(--color-bg);
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    padding: 4px 10px;
                    font-size: 0.8rem;
                }
                .rating-chip-label {
                    color: var(--color-text-secondary);
                }
                .rating-chip-value {
                    font-weight: 700;
                    color: var(--color-primary);
                }
                .survey-card-open {
                    border-top: 1px solid var(--color-border);
                    padding-top: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .open-row {
                    display: flex;
                    gap: 10px;
                    font-size: 0.88rem;
                    line-height: 1.5;
                }
                .open-label {
                    flex-shrink: 0;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                    min-width: 72px;
                }
                .open-text {
                    color: var(--color-text);
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-top: 24px;
                }
                .page-btn {
                    padding: 8px 14px;
                    border: 1px solid var(--color-border);
                    background: var(--color-surface);
                    color: var(--color-text);
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .page-btn:hover:not(:disabled) {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                }
                .page-btn.active {
                    background: #0d9488;
                    color: #fff !important;
                    border-color: #0d9488;
                    box-shadow: 0 2px 8px rgba(13, 148, 136, 0.28);
                }
                .page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .dots {
                    color: var(--color-text-secondary);
                }
                .loading-state, .empty-state {
                    text-align: center;
                    padding: 60px;
                    color: var(--color-text-secondary);
                    background: var(--color-surface);
                    border-radius: 12px;
                    border: 1px dashed var(--color-border);
                }
                @keyframes surveyFadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 720px) {
                    .survey-stats {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
