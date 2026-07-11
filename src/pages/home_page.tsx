import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import { BookOpen, Headphones, Mic, PenTool, Sparkles, Target, MessageSquare, Gift } from 'lucide-react';
import { checkinApi, type CheckinStatusResponse } from '../api/checkin';
import { useAuth } from '../contexts/AuthContext';
import '../styles/home_page.css';

const skillIcons = [BookOpen, Headphones, Mic, PenTool];
const stepIcons = [Target, Sparkles, MessageSquare];

function getMilestoneHint(count: number, tpl: string): string | null {
    const next = [7, 30, 100, 365, 1000].find(n => n > count && n - count <= 5);
    if (!next) return null;
    return tpl.replace('{remain}', String(next - count)).replace('{next}', String(next));
}

export default function HomePage() {
    const { lang } = useLang();
    const t = translations[lang];
    const { user } = useAuth();
    const [checkinStatus, setCheckinStatus] = useState<CheckinStatusResponse | null>(null);
    const [checkingIn, setCheckingIn] = useState(false);
    const [rewardMsg, setRewardMsg] = useState('');

    const loadCheckinStatus = useCallback(async () => {
        try {
            const s = await checkinApi.getStatus();
            setCheckinStatus(s);
        } catch { /* not logged in or error */ }
    }, []);

    useEffect(() => { if (user) void loadCheckinStatus(); }, [user, loadCheckinStatus]);

    const handleCheckin = async () => {
        setCheckingIn(true);
        setRewardMsg('');
        try {
            const res = await checkinApi.doCheckin();
            // Backend `message` is Chinese-only; compose from structured fields.
            if (res.ok) {
                setRewardMsg(t.assistant.checkin.successMessage.replace('{bonus}', (res.bonus ?? 0).toLocaleString()));
                await loadCheckinStatus();
            } else {
                setRewardMsg(t.assistant.checkin.alreadyMessage);
            }
        } catch {
            setRewardMsg(t.home.checkin.errorToast);
        } finally {
            setCheckingIn(false);
        }
    };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        const elements = document.querySelectorAll('.scroll-animate');
        elements.forEach(el => observer.observe(el));

        return () => observer.disconnect();
    }, [user]);

    return (
        <Layout>
            {/* Hero */}
            <section className="hero">
                <div className="hero-bg" />
                <h1 className="gradient-text">{t.home.hero.title}</h1>
                <p className="hero-subtitle">{t.home.hero.subtitle}</p>
                <p className="hero-subsub">{t.home.hero.subsubtitle}</p>
                <div className="hero-actions">
                    <Link to="/practice" className="hero-btn">{t.home.hero.startPractice}</Link>
                    <Link to="/vocabulary" className="hero-btn hero-btn-secondary">{t.home.hero.vocab}</Link>
                </div>
            </section>

            {/* Daily Check-in */}
            {user && (
                <section className="checkin-section scroll-animate">
                    <div className="checkin-card">
                        <div className="checkin-header">
                            <Gift size={24} />
                            <h2>{t.home.checkin.heading}</h2>
                        </div>
                        <div className="checkin-body">
                            <div className="checkin-stats">
                                <div className="checkin-stat">
                                    <span className="checkin-stat-value">
                                        {checkinStatus?.today_checked
                                            ? '✅'
                                            : checkingIn ? '⏳' : '🗓️'}
                                    </span>
                                    <span className="checkin-stat-label">{t.home.checkin.todayLabel}</span>
                                </div>
                                <div className="checkin-stat">
                                    <span className="checkin-stat-value">
                                        {checkinStatus?.current_streak ?? '--'}
                                    </span>
                                    <span className="checkin-stat-label">{t.home.checkin.streakLabel}</span>
                                </div>
                                <div className="checkin-stat">
                                    <span className="checkin-stat-value">
                                        {checkinStatus?.total_checkins ?? '--'}
                                    </span>
                                    <span className="checkin-stat-label">{t.home.checkin.totalLabel}</span>
                                </div>
                                {checkinStatus?.today_bonus ? (
                                    <div className="checkin-stat">
                                        <span className="checkin-stat-value bonus">
                                            +{checkinStatus.today_bonus.toLocaleString()}
                                        </span>
                                        <span className="checkin-stat-label">{t.home.checkin.rewardLabel}</span>
                                    </div>
                                ) : null}
                            </div>
                            <button
                                className="checkin-btn"
                                onClick={handleCheckin}
                                disabled={checkinStatus?.today_checked || checkingIn}
                            >
                                {checkinStatus?.today_checked
                                    ? t.home.checkin.btnDone
                                    : checkingIn ? t.home.checkin.btnChecking : t.home.checkin.btnCheckin}
                            </button>
                            {rewardMsg && (
                                <p className={`checkin-reward-msg${checkinStatus?.today_checked ? ' done' : ''}`}>
                                    {rewardMsg}
                                </p>
                            )}
                            {checkinStatus && !checkinStatus.today_checked && (
                                <p className="checkin-milestone-hint">
                                    {getMilestoneHint(checkinStatus.current_streak, t.home.checkin.milestoneHint)}
                                </p>
                            )}
                            <p className="checkin-rules">
                                {t.home.checkin.rules}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* Skills */}
            <section className="skills scroll-animate">
                <h2>{t.home.skills.heading}</h2>
                <div className="skills-grid">
                    {t.home.skills.items.map((item, i) => {
                        const Icon = skillIcons[i];
                        return (
                            <Link to={item.link} key={item.title} className="skill-card" style={{ '--si': i } as React.CSSProperties}>
                                <div className="skill-icon"><Icon size={28} /></div>
                                <h3>{item.title}</h3>
                                <p>{item.desc}</p>
                                <span className="skill-link">{t.home.hero.startPractice} →</span>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* How it works */}
            <section className="how-it-works scroll-animate">
                <h2>{t.home.howItWorks.heading}</h2>
                <div className="steps-row">
                    {t.home.howItWorks.steps.map((step, i) => {
                        const Icon = stepIcons[i];
                        return (
                            <div key={step.title} className="step-item" style={{ '--si': i } as React.CSSProperties}>
                                <div className="step-number">{i + 1}</div>
                                <div className="step-icon"><Icon size={24} /></div>
                                <h3>{step.title}</h3>
                                <p>{step.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Announcements */}
            <section className="announcements scroll-animate">
                <h2>{t.home.announcements.heading}</h2>
                <div className="announcement-list">
                    {t.home.announcements.items.map((item, i) => (
                        <div key={i} className="announcement-item" style={{ '--si': i } as React.CSSProperties}>
                            <span className="announcement-date">{item.date}</span>
                            <div className="announcement-content">
                                <span className={`announcement-tag ${item.tag === '新功能' || item.tag === 'New' ? 'new' : item.tag === '优化' || item.tag === 'Optimization' ? 'update' : 'community'}`}>{item.tag}</span>
                                {item.content}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <span>{t.home.footer}</span>
                <div className="footer-links">
                    <Link to="/feedback">{t.home.footerFeedback}</Link>
                    <span className="footer-sep">·</span>
                    <Link to="/profile">{t.home.footerManual}</Link>
                </div>
            </footer>
        </Layout>
    );
}
