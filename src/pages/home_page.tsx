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

function getMilestoneHint(count: number): string | null {
    const next = [7, 30, 100, 365, 1000].find(n => n > count && n - count <= 5);
    if (!next) return null;
    return `还有 ${next - count} 天到达 ${next} 天里程碑！`;
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
            if (res.ok) {
                setRewardMsg(res.message);
                await loadCheckinStatus();
            } else {
                setRewardMsg(res.message);
            }
        } catch {
            setRewardMsg('签到失败，请稍后重试');
        } finally {
            setCheckingIn(false);
        }
    };

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
                <section className="checkin-section">
                    <div className="checkin-card">
                        <div className="checkin-header">
                            <Gift size={24} />
                            <h2>每日签到</h2>
                        </div>
                        <div className="checkin-body">
                            <div className="checkin-stats">
                                <div className="checkin-stat">
                                    <span className="checkin-stat-value">
                                        {checkinStatus?.today_checked
                                            ? '✅'
                                            : checkingIn ? '⏳' : '🗓️'}
                                    </span>
                                    <span className="checkin-stat-label">今日签到</span>
                                </div>
                                <div className="checkin-stat">
                                    <span className="checkin-stat-value">
                                        {checkinStatus?.total_checkins ?? '--'}
                                    </span>
                                    <span className="checkin-stat-label">累计签到</span>
                                </div>
                                {checkinStatus?.today_bonus ? (
                                    <div className="checkin-stat">
                                        <span className="checkin-stat-value bonus">
                                            +{checkinStatus.today_bonus.toLocaleString()}
                                        </span>
                                        <span className="checkin-stat-label">今日奖励 AT</span>
                                    </div>
                                ) : null}
                            </div>
                            <button
                                className="checkin-btn"
                                onClick={handleCheckin}
                                disabled={checkinStatus?.today_checked || checkingIn}
                            >
                                {checkinStatus?.today_checked
                                    ? '今日已签到 ✓'
                                    : checkingIn ? '签到中...' : '📋 签到领 AT 币'}
                            </button>
                            {rewardMsg && (
                                <p className={`checkin-reward-msg${checkinStatus?.today_checked ? ' done' : ''}`}>
                                    {rewardMsg}
                                </p>
                            )}
                            {checkinStatus && !checkinStatus.today_checked && (
                                <p className="checkin-milestone-hint">
                                    {getMilestoneHint(checkinStatus.total_checkins)}
                                </p>
                            )}
                            <p className="checkin-rules">
                                签到奖励：每日 1,000 AT | 7 天 +1 万 | 30 天 +3 万 | 100 天 +10 万 | 365 天 +100 万 | 1000 天 +1000 万
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* Skills */}
            <section className="skills">
                <h2>{t.home.skills.heading}</h2>
                <div className="skills-grid">
                    {t.home.skills.items.map((item, i) => {
                        const Icon = skillIcons[i];
                        return (
                            <Link to={item.link} key={item.title} className="skill-card">
                                <div className="skill-icon"><Icon size={28} /></div>
                                <h3>{item.title}</h3>
                                <p>{item.desc}</p>
                                <span className="skill-link">开始练习 →</span>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* How it works */}
            <section className="how-it-works">
                <h2>{t.home.howItWorks.heading}</h2>
                <div className="steps-row">
                    {t.home.howItWorks.steps.map((step, i) => {
                        const Icon = stepIcons[i];
                        return (
                            <div key={step.title} className="step-item">
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
            <section className="announcements">
                <h2>{t.home.announcements.heading}</h2>
                <div className="announcement-list">
                    {t.home.announcements.items.map((item, i) => (
                        <div key={i} className="announcement-item">
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
                    <Link to="/profile">{t.home.footerFeedback}</Link>
                    <span className="footer-sep">·</span>
                    <Link to="/profile">{t.home.footerManual}</Link>
                </div>
            </footer>
        </Layout>
    );
}
