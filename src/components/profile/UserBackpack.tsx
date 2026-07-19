import { useEffect, useState, useCallback, useMemo } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { getBackpack, type BackpackItem } from '../../api/backpack';
import { checkinApi, type CheckinStatusResponse } from '../../api/checkin';
import { showToast } from '../common/Toast';

interface UserBackpackProps {
    onBack: () => void;
}

interface ItemMeta { name: string; icon: string; desc: string; use: string; }

export default function UserBackpack({ onBack }: UserBackpackProps) {
    const { lang, t } = useLang();

    const [items, setItems] = useState<BackpackItem[]>([]);
    const [status, setStatus] = useState<CheckinStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [makeupOpen, setMakeupOpen] = useState(false);
    const [busyDate, setBusyDate] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const [bpRes, st] = await Promise.all([getBackpack(), checkinApi.getStatus()]);
            setItems(bpRes.items || []);
            setStatus(st);
            if ((bpRes.items || []).every(i => i.item_type !== 'makeup_card' || i.quantity <= 0)) {
                setMakeupOpen(false);
            }
        } catch {
            /* ignore — 保持空态 */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const makeupCards = items.find(i => i.item_type === 'makeup_card')?.quantity ?? 0;

    // 最近 window 天内的漏签日（过去、未签、不早于注册日），最近的排前面
    const missedDays = useMemo(() => {
        if (!status) return [] as string[];
        const windowN = status.makeup_window_days || 7;
        const checked = new Set(status.calendar.filter(e => e.checked).map(e => e.date));
        const reg = status.registered_date || '';
        const base = new Date(`${status.today}T00:00:00`);
        const out: string[] = [];
        for (let i = 1; i <= windowN; i++) {
            const d = new Date(base);
            d.setDate(d.getDate() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (reg && key < reg) continue;
            if (!checked.has(key)) out.push(key);
        }
        return out;
    }, [status]);

    const fmtDate = (iso: string) => {
        const d = new Date(`${iso}T00:00:00`);
        return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
            month: 'short', day: 'numeric', weekday: 'short',
        });
    };

    const handleMakeup = async (date: string) => {
        setBusyDate(date);
        try {
            const res = await checkinApi.makeup(date);
            if (res.ok) {
                showToast(res.message || t('profile.backpack.makeup.success'), 'success');
                await load();
            } else {
                showToast(res.message || t('profile.backpack.makeup.noCard'), 'error');
            }
        } catch (e) {
            showToast((e as { message?: string })?.message || t('profile.backpack.makeup.noCard'), 'error');
        } finally {
            setBusyDate(null);
        }
    };

    const windowN = status?.makeup_window_days || 7;
    const hasItems = items.some(i => i.quantity > 0);

    return (
        <div className="user-backpack">
            <div className="backpack-header">
                <button className="back-button" onClick={onBack}>
                    ← {t('profile.menu.home')}
                </button>
                <h2>🎒 {t('profile.menu.backpack')}</h2>
            </div>

            <div className="backpack-content">
                {loading ? (
                    <div className="empty-backpack"><p>{t('profile.backpack.loading')}</p></div>
                ) : !hasItems ? (
                    <div className="empty-backpack">
                        <div className="empty-icon">📂</div>
                        <p>{t('profile.backpack.empty')}</p>
                        <p className="empty-hint">{t('profile.backpack.emptyHint')}</p>
                    </div>
                ) : (
                    <div className="bp-grid">
                        {items.filter(i => i.quantity > 0).map(item => {
                            const metaMap = t('profile.backpack.items', { returnObjects: true }) as Record<string, ItemMeta>;
                            const meta = metaMap[item.item_type];
                            const name = meta?.name ?? item.item_type;
                            const icon = meta?.icon ?? '📦';
                            const desc = (meta?.desc ?? '').replace('{n}', String(windowN));
                            const isCard = item.item_type === 'makeup_card';
                            return (
                                <div className="bp-item" key={item.item_type}>
                                    <div className="bp-item-icon">{icon}</div>
                                    <div className="bp-item-body">
                                        <div className="bp-item-name">
                                            {name}
                                            <span className="bp-item-qty">×{item.quantity}</span>
                                        </div>
                                        {desc && <div className="bp-item-desc">{desc}</div>}
                                        {isCard && (
                                            <button
                                                className="bp-use-btn"
                                                onClick={() => setMakeupOpen(o => !o)}
                                            >
                                                {meta?.use}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {makeupOpen && makeupCards > 0 && (
                    <div className="bp-makeup-panel">
                        <div className="bp-makeup-title">{t('profile.backpack.makeup.title')}</div>
                        <div className="bp-makeup-hint">{t('profile.backpack.makeup.hint').replace('{bonus}', '1,000')}</div>
                        {missedDays.length === 0 ? (
                            <div className="bp-makeup-empty">{t('profile.backpack.makeup.noGap').replace('{n}', String(windowN))}</div>
                        ) : (
                            <div className="bp-makeup-days">
                                {missedDays.map(day => (
                                    <button
                                        key={day}
                                        className="bp-makeup-day"
                                        disabled={busyDate !== null}
                                        onClick={() => handleMakeup(day)}
                                    >
                                        {busyDate === day ? '…' : fmtDate(day)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .user-backpack {
                    padding: 20px;
                }
                .backpack-header {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 25px;
                }
                .back-button {
                    background: none;
                    border: 1px solid var(--color-border);
                    padding: 5px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    color: var(--color-text-secondary);
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .back-button:hover {
                    background: var(--color-bg);
                    color: var(--color-text);
                }
                .backpack-content {
                    background: var(--color-bg);
                    border-radius: 12px;
                    min-height: 400px;
                    padding: 24px;
                    border: 1px solid var(--color-border);
                }
                .empty-backpack {
                    text-align: center;
                    color: var(--color-text-secondary);
                    padding: 60px 0;
                }
                .empty-icon {
                    font-size: 3rem;
                    margin-bottom: 15px;
                    opacity: 0.5;
                }
                .empty-hint {
                    font-size: 0.85rem;
                    margin-top: 5px;
                }
                .bp-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 16px;
                }
                .bp-item {
                    display: flex;
                    gap: 14px;
                    padding: 16px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                }
                .bp-item-icon {
                    font-size: 2rem;
                    line-height: 1;
                    flex-shrink: 0;
                }
                .bp-item-body { flex: 1; min-width: 0; }
                .bp-item-name {
                    font-weight: 600;
                    color: var(--color-text);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .bp-item-qty {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--color-primary);
                    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
                    padding: 1px 8px;
                    border-radius: 999px;
                }
                .bp-item-desc {
                    font-size: 0.82rem;
                    color: var(--color-text-secondary);
                    line-height: 1.5;
                    margin-top: 4px;
                }
                .bp-use-btn {
                    margin-top: 10px;
                    padding: 6px 16px;
                    border: none;
                    border-radius: 8px;
                    background: var(--color-primary);
                    color: #fff;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.18s;
                }
                .bp-use-btn:hover { background: var(--color-primary-hover, #0f766e); }
                .bp-makeup-panel {
                    margin-top: 20px;
                    padding: 18px;
                    background: var(--color-surface);
                    border: 1px solid var(--color-border);
                    border-radius: 12px;
                }
                .bp-makeup-title {
                    font-weight: 600;
                    color: var(--color-text);
                    margin-bottom: 4px;
                }
                .bp-makeup-hint {
                    font-size: 0.8rem;
                    color: var(--color-text-secondary);
                    margin-bottom: 14px;
                }
                .bp-makeup-empty {
                    font-size: 0.9rem;
                    color: var(--color-text-secondary);
                    text-align: center;
                    padding: 12px 0;
                }
                .bp-makeup-days {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .bp-makeup-day {
                    padding: 8px 14px;
                    border: 1px solid var(--color-border);
                    border-radius: 8px;
                    background: var(--color-bg);
                    color: var(--color-text);
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.18s;
                }
                .bp-makeup-day:hover:not(:disabled) {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                }
                .bp-makeup-day:disabled { opacity: 0.5; cursor: default; }
            `}</style>
        </div>
    );
}
