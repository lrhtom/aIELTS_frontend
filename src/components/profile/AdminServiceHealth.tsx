import { useCallback, useState } from 'react';
import { apiClient } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import {
    Activity,
    Info,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    MinusCircle,
    Database,
    Server,
    Cpu,
    Image as ImageIcon,
    Mail,
    FlaskConical,
    Coins,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import '../../styles/admin_service_health.css';

// ── Types (mirror backend AdminServiceHealthView payload) ────────────────────
type SvcStatus = 'ok' | 'degraded' | 'down' | 'unconfigured';
type SvcCategory = 'core' | 'ai' | 'email';
type MethodKey = 'db' | 'redis' | 'ai_ping' | 'tcp' | 'email_validate';

interface ServiceItem {
    key: string;
    category: SvcCategory;
    required: boolean;
    status: SvcStatus;
    latency_ms: number | null;
    method_key: MethodKey;
    reason_code: string;
    reason: Record<string, string | number>;
    model: string | null;
    tokens: number | null;
}

interface HealthReport {
    checked_at: string;
    total_ms: number;
    overall: 'ok' | 'degraded' | 'down';
    summary: { ok: number; degraded: number; down: number; unconfigured: number; total: number };
    cost: { total_tokens: number; at_equivalent: number; ai_probe_count: number };
    services: ServiceItem[];
}

// ── Static maps ──────────────────────────────────────────────────────────────
const STATUS_ICON: Record<SvcStatus, LucideIcon> = {
    ok: CheckCircle2,
    degraded: AlertTriangle,
    down: XCircle,
    unconfigured: MinusCircle,
};
const STATUS_CLS: Record<SvcStatus, string> = {
    ok: 'ash-ok',
    degraded: 'ash-degraded',
    down: 'ash-down',
    unconfigured: 'ash-unconf',
};
const CATEGORY_ICON: Record<SvcCategory, LucideIcon> = { core: Server, ai: Cpu, email: Mail };
const CATEGORY_ORDER: SvcCategory[] = ['core', 'ai', 'email'];
const SERVICE_ICON: Record<string, LucideIcon> = {
    database: Database,
    redis: Server,
    ai_image: ImageIcon,
    email: Mail,
};
const METHOD_ICON: Record<MethodKey, LucideIcon> = {
    db: Database,
    redis: Server,
    ai_ping: Cpu,
    tcp: ImageIcon,
    email_validate: Mail,
};
const METHOD_ORDER: MethodKey[] = ['db', 'redis', 'ai_ping', 'tcp', 'email_validate'];

const interp = (tpl: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), tpl);

export default function AdminServiceHealth() {
    const { t } = useLang();

    const [data, setData] = useState<HealthReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const run = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const resp = await apiClient.get<HealthReport>('/admin/service-health');
            setData(resp.data);
        } catch {
            setError(t('profile.admin.serviceHealth.loadFail'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const statusLabel = (s: SvcStatus): string =>
        ({ ok: t('profile.admin.serviceHealth.statusOk'), degraded: t('profile.admin.serviceHealth.statusDegraded'), down: t('profile.admin.serviceHealth.statusDown'), unconfigured: t('profile.admin.serviceHealth.statusUnconfigured') }[s]);
    const catLabel = (c: SvcCategory): string =>
        ({ core: t('profile.admin.serviceHealth.catCore'), ai: t('profile.admin.serviceHealth.catAi'), email: t('profile.admin.serviceHealth.catEmail') }[c]);
    const overallTitle = (o: HealthReport['overall']): string =>
        ({ ok: t('profile.admin.serviceHealth.overallOk'), degraded: t('profile.admin.serviceHealth.overallDegraded'), down: t('profile.admin.serviceHealth.overallDown') }[o]);

    // Backend returns only structured codes; all prose is localized here.
    const names = t('profile.admin.serviceHealth.names', { returnObjects: true }) as Record<string, string>;
    const reasons = t('profile.admin.serviceHealth.reasons', { returnObjects: true }) as Record<string, string>;
    const nameOf = (key: string): string => names[key] ?? key;
    const detailOf = (svc: ServiceItem): string => {
        const tpl = reasons[svc.reason_code];
        const base = tpl ? interp(tpl, svc.reason) : `${svc.reason_code} ${JSON.stringify(svc.reason)}`;
        return svc.model ? `${base} · ${t('profile.admin.serviceHealth.modelLabel')}=${svc.model}` : base;
    };

    return (
        <div className="ash-root">
            {/* Header */}
            <div className="ash-header">
                <div>
                    <h2 className="ash-heading">{t('profile.admin.serviceHealth.heading')}</h2>
                    <p className="ash-desc">{t('profile.admin.serviceHealth.description')}</p>
                </div>
                <button className="ash-run-btn" onClick={() => void run()} disabled={loading}>
                    {loading
                        ? <RefreshCw size={16} className="ash-spin" />
                        : <Activity size={16} />}
                    {loading ? t('profile.admin.serviceHealth.running') : (data ? t('profile.admin.serviceHealth.rerunBtn') : t('profile.admin.serviceHealth.runBtn'))}
                </button>
            </div>

            {/* Test-method explainer (always visible, collapsible) */}
            <details className="ash-methods" open>
                <summary className="ash-methods-summary">
                    <FlaskConical size={15} />
                    {t('profile.admin.serviceHealth.methodTitle')}
                </summary>
                <ul className="ash-methods-list">
                    {METHOD_ORDER.map(mk => {
                        const MIcon = METHOD_ICON[mk];
                        return (
                            <li className="ash-method-item" key={mk}>
                                <MIcon size={14} className="ash-method-icon" />
                                <span>{t(`profile.admin.serviceHealth.methods.${mk}`)}</span>
                            </li>
                        );
                    })}
                </ul>
            </details>

            {/* Probe disclaimer */}
            <div className="ash-note">
                <Info size={15} />
                <span>{t('profile.admin.serviceHealth.probeNote')}</span>
            </div>

            {error && <div className="ash-error">{error}</div>}

            {!data && !error && (
                <div className="ash-empty">{t('profile.admin.serviceHealth.emptyHint')}</div>
            )}

            {data && (
                <>
                    {/* Overall banner */}
                    <div className={`ash-overall is-${data.overall}`}>
                        {(() => {
                            const Icon = STATUS_ICON[data.overall];
                            return <Icon size={26} className="ash-overall-icon" />;
                        })()}
                        <div className="ash-overall-text">
                            <span className="ash-overall-title">{overallTitle(data.overall)}</span>
                            <span className="ash-overall-meta">
                                {interp(t('profile.admin.serviceHealth.lastChecked'), { time: new Date(data.checked_at).toLocaleString() })}
                                {' · '}
                                {interp(t('profile.admin.serviceHealth.totalMs'), { n: data.total_ms })}
                            </span>
                        </div>
                    </div>

                    {/* This-run cost (损耗) */}
                    <div className="ash-cost">
                        <Coins size={16} className="ash-cost-icon" />
                        <span className="ash-cost-title">{t('profile.admin.serviceHealth.costTitle')}:</span>
                        {data.cost.total_tokens > 0 ? (
                            <>
                                <span className="ash-cost-val">{interp(t('profile.admin.serviceHealth.costTokens'), { n: data.cost.total_tokens })}</span>
                                <span className="ash-cost-sub">{interp(t('profile.admin.serviceHealth.costAtEquiv'), { n: data.cost.at_equivalent })}</span>
                                <span className="ash-cost-note">{t('profile.admin.serviceHealth.costNote')}</span>
                            </>
                        ) : (
                            <span className="ash-cost-sub">{t('profile.admin.serviceHealth.costZero')}</span>
                        )}
                    </div>

                    {/* Summary chips */}
                    <div className="ash-summary">
                        {(['ok', 'degraded', 'down', 'unconfigured'] as SvcStatus[]).map(s => (
                            <span
                                key={s}
                                className={`ash-chip is-${s} ${data.summary[s] === 0 ? 'is-zero' : ''}`}
                            >
                                <span className="ash-chip-dot" />
                                {statusLabel(s)} · {data.summary[s]}
                            </span>
                        ))}
                    </div>

                    {/* Grouped service cards */}
                    {CATEGORY_ORDER.map(cat => {
                        const items = data.services.filter(s => s.category === cat);
                        if (items.length === 0) return null;
                        const CatIcon = CATEGORY_ICON[cat];
                        return (
                            <div className="ash-group" key={cat}>
                                <h3 className="ash-group-title">
                                    <CatIcon size={13} />
                                    {catLabel(cat)}
                                </h3>
                                <div className="ash-list">
                                    {items.map(svc => {
                                        const StatusIcon = STATUS_ICON[svc.status];
                                        const SvcIcon = SERVICE_ICON[svc.key] ?? CATEGORY_ICON[svc.category];
                                        return (
                                            <div className={`ash-card ${STATUS_CLS[svc.status]}`} key={svc.key}>
                                                <div className="ash-card-icon">
                                                    <SvcIcon size={18} />
                                                </div>
                                                <div className="ash-card-body">
                                                    <div className="ash-card-name-row">
                                                        <span className="ash-card-name">{nameOf(svc.key)}</span>
                                                        {svc.required && <span className="ash-required">{t('profile.admin.serviceHealth.requiredTag')}</span>}
                                                    </div>
                                                    <span className="ash-card-detail">{detailOf(svc)}</span>
                                                    <span className="ash-card-method">
                                                        {t('profile.admin.serviceHealth.methodLabel')}: {t(`profile.admin.serviceHealth.methods.${svc.method_key}`)}
                                                    </span>
                                                </div>
                                                <div className="ash-card-right">
                                                    <span className="ash-status-pill">
                                                        <StatusIcon size={13} />
                                                        {statusLabel(svc.status)}
                                                    </span>
                                                    {svc.latency_ms != null && (
                                                        <span className="ash-latency">{svc.latency_ms} ms</span>
                                                    )}
                                                    {svc.tokens != null && (
                                                        <span className="ash-tokens">
                                                            <Coins size={11} />
                                                            {svc.tokens} tok
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}
