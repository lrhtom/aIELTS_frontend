import { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '../components/layout/Layout';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { BookOpen, Headphones, Mic, PenTool, Gift, ArrowUpRight, ArrowRight, Compass } from 'lucide-react';
import { startTour, TOUR_SEEN_KEY } from '../components/tour/TourGuide';
import { checkinApi, type CheckinStatusResponse } from '../api/checkin';
import { useAuth } from '../contexts/AuthContext';
import '../styles/home_page.css';

const skillIcons = [BookOpen, Headphones, Mic, PenTool];

// Real product screenshots under frontend/public/home/ (user-supplied 2026-07-16).
// Missing files fall back to a styled placeholder tile.
const stageImages = ['/home/stage_listening.png', '/home/stage_writing.png', '/home/stage_speaking.png'];
const galleryImages = ['/home/gallery_reading.png', '/home/gallery_map.png'];

function getMilestoneHint(count: number, tpl: string): string | null {
    const next = [7, 30, 100, 365, 1000].find(n => n > count && n - count <= 5);
    if (!next) return null;
    return tpl.replace('{remain}', String(next - count)).replace('{next}', String(next));
}

/*
 * Hand-drawn SVG doodles floating around the hero (collage layers).
 * Each layer is positioned by CSS vars and parallax-shifted by
 * calc(var(--hp-scroll) * var(--pf)) — the ChatGPT overview technique:
 * one scroll listener writes a single CSS var, layers multiply it by
 * their own static factor for differential parallax.
 */
function DoodleAsterisk() {
    return (
        <svg viewBox="0 0 64 64" fill="none" stroke="var(--color-text)" strokeWidth="5" strokeLinecap="round">
            <path d="M32 6v52M9 19l46 26M55 19L9 45" />
        </svg>
    );
}
function DoodleSquiggle() {
    return (
        <svg viewBox="0 0 120 48" fill="none" stroke="var(--color-accent-sky)" strokeWidth="7" strokeLinecap="round">
            <path d="M6 40 Q24 8 40 26 T74 22 T114 10" />
        </svg>
    );
}
function DoodleCircle() {
    return (
        <svg viewBox="0 0 72 72" fill="none" stroke="var(--color-accent-coral)" strokeWidth="5" strokeLinecap="round">
            <path d="M36 8c17 0 28 10 28 26S51 62 34 63 8 53 8 38 19 8 36 8c9 0 16 3 21 8" />
        </svg>
    );
}
function DoodleBook() {
    return (
        <svg viewBox="0 0 80 64" fill="none" stroke="var(--color-primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M40 14C33 8 22 6 10 8v44c12-2 23 0 30 6 7-6 18-8 30-6V8c-12-2-23 0-30 6zM40 14v44" />
        </svg>
    );
}
function DoodleHeadphones() {
    return (
        <svg viewBox="0 0 72 64" fill="none" stroke="var(--color-accent-purple)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 44V34C10 19 22 8 36 8s26 11 26 26v10" />
            <rect x="6" y="40" width="14" height="18" rx="6" />
            <rect x="52" y="40" width="14" height="18" rx="6" />
        </svg>
    );
}
function DoodleBand() {
    return (
        <svg viewBox="0 0 84 56" fill="none">
            <rect x="2" y="2" width="80" height="52" rx="26" stroke="var(--color-accent-green)" strokeWidth="5" fill="var(--color-surface)" />
            <text x="42" y="37" textAnchor="middle" fontSize="24" fontWeight="800" fill="var(--color-accent-green)" fontFamily="inherit">7.5</text>
        </svg>
    );
}
function DoodleStar() {
    return (
        <svg viewBox="0 0 56 56" fill="none" stroke="var(--color-accent-rose)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M28 4c2 11 5 17 9 20-4 3-7 9-9 20-2-11-5-17-9-20 4-3 7-9 9-20z" />
        </svg>
    );
}

interface DoodleLayer {
    id: string;
    x: string;      // % of the deco box
    y: string;
    w: number;      // px
    rot: number;    // deg
    dur: number;    // weightless-float period (s)
    delay: number;  // negative = phase offset so layers drift out of sync
    pf?: number;    // parallax factor (hero only)
    node: React.ReactNode;
}

const heroDoodles: DoodleLayer[] = [
    { id: 'asterisk', x: '7%', y: '22%', w: 56, rot: -12, pf: -0.24, dur: 7, delay: -1, node: <DoodleAsterisk /> },
    { id: 'book', x: '11%', y: '68%', w: 88, rot: 6, pf: -0.1, dur: 10, delay: -4, node: <DoodleBook /> },
    { id: 'band', x: '19%', y: '42%', w: 76, rot: -5, pf: -0.32, dur: 8, delay: -6, node: <DoodleBand /> },
    { id: 'squiggle', x: '90%', y: '20%', w: 120, rot: 8, pf: -0.28, dur: 9, delay: -2, node: <DoodleSquiggle /> },
    { id: 'headphones', x: '86%', y: '58%', w: 78, rot: 10, pf: -0.14, dur: 11, delay: -7, node: <DoodleHeadphones /> },
    { id: 'circle', x: '93%', y: '80%', w: 64, rot: 0, pf: -0.2, dur: 6.5, delay: -3, node: <DoodleCircle /> },
];

// Sparse accents for the rest of the page — kept small, near section edges
const stageDoodles: DoodleLayer[] = [
    { id: 'st-circle', x: '4%', y: '16%', w: 44, rot: 12, dur: 9, delay: -2, node: <DoodleCircle /> },
    { id: 'st-star', x: '96%', y: '78%', w: 44, rot: -8, dur: 7, delay: -5, node: <DoodleStar /> },
];
const featureDoodles: DoodleLayer[] = [
    { id: 'ft-squiggle', x: '91%', y: '10%', w: 92, rot: -4, dur: 8.5, delay: -1, node: <DoodleSquiggle /> },
    { id: 'ft-book', x: '6%', y: '86%', w: 60, rot: -9, dur: 10, delay: -6, node: <DoodleBook /> },
];
const galleryDoodles: DoodleLayer[] = [
    { id: 'gl-asterisk', x: '5%', y: '10%', w: 40, rot: 18, dur: 7.5, delay: -3, node: <DoodleAsterisk /> },
    { id: 'gl-band', x: '95%', y: '9%', w: 62, rot: 7, dur: 9.5, delay: -5, node: <DoodleBand /> },
];
const newsDoodles: DoodleLayer[] = [
    { id: 'nw-star', x: '9%', y: '72%', w: 34, rot: 0, dur: 8, delay: -7, node: <DoodleStar /> },
    { id: 'nw-headphones', x: '92%', y: '28%', w: 54, rot: -11, dur: 11, delay: -4, node: <DoodleHeadphones /> },
];
// CTA doodles sit in the whitespace above the banner (y negative) so they
// don't get covered by the banner surface.
const ctaDoodles: DoodleLayer[] = [
    { id: 'ct-star', x: '7%', y: '-14%', w: 40, rot: 10, dur: 8.5, delay: -2, node: <DoodleStar /> },
    { id: 'ct-squiggle', x: '93%', y: '-10%', w: 72, rot: 6, dur: 9, delay: -6, node: <DoodleSquiggle /> },
];

// Layer stack: .hp-layer (position + rotation) > .hp-float (weightless bob)
// > svg (scroll parallax via --pf, hero only)
function renderDoodles(layers: DoodleLayer[]) {
    return layers.map(d => (
        <div
            key={d.id}
            className="hp-layer"
            style={{
                '--x': d.x, '--y': d.y, '--w': `${d.w}px`,
                '--rot': `${d.rot}deg`, '--pf': d.pf ?? 0,
            } as React.CSSProperties}
        >
            <div className="hp-float" style={{ '--fd': `${d.dur}s`, '--fdel': `${d.delay}s` } as React.CSSProperties}>
                {d.node}
            </div>
        </div>
    ));
}

export default function HomePage() {
    const { t } = useLang();
    const { user } = useAuth();
    const [checkinStatus, setCheckinStatus] = useState<CheckinStatusResponse | null>(null);
    const [checkingIn, setCheckingIn] = useState(false);
    const [rewardMsg, setRewardMsg] = useState('');
    const [chapter, setChapter] = useState(0);
    const [brokenImgs, setBrokenImgs] = useState<Record<string, boolean>>({});
    const heroRef = useRef<HTMLElement | null>(null);
    const stageRef = useRef<HTMLElement | null>(null);

    const markBroken = (src: string) => setBrokenImgs(prev => (prev[src] ? prev : { ...prev, [src]: true }));

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
                setRewardMsg(t('assistant.checkin.successMessage').replace('{bonus}', (res.bonus ?? 0).toLocaleString()));
                await loadCheckinStatus();
            } else {
                setRewardMsg(t('assistant.checkin.alreadyMessage'));
            }
        } catch {
            setRewardMsg(t('home.checkin.errorToast'));
        } finally {
            setCheckingIn(false);
        }
    };

    // Sticky offset = real navbar height (navbar is position:sticky in layout.css)
    useEffect(() => {
        const nav = document.querySelector<HTMLElement>('.navbar');
        if (nav) document.documentElement.style.setProperty('--hp-nav-h', `${nav.offsetHeight}px`);
    }, []);

    // Scroll driver: one rAF-throttled listener writes --hp-scroll (px) and
    // --hp-intro (1→0 fade of the hero collage) for parallax, plus
    // --hp-progress (0→1 travel through the stage track) for the progress bar.
    // Parallax respects prefers-reduced-motion; the progress bar is
    // informational and keeps updating either way.
    useEffect(() => {
        const root = heroRef.current;
        const stage = stageRef.current;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let raf = 0;
        const onScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                const y = window.scrollY;
                if (root && !reduced) {
                    root.style.setProperty('--hp-scroll', `${y}px`);
                    root.style.setProperty('--hp-intro', String(Math.max(0, Math.min(1, 1 - y / 640))));
                }
                if (stage) {
                    const total = stage.offsetHeight - window.innerHeight;
                    const p = total > 0 ? Math.max(0, Math.min(1, -stage.getBoundingClientRect().top / total)) : 0;
                    stage.style.setProperty('--hp-progress', String(p));
                    // Chapter derives from track progress — robust against
                    // scroll jumps, unlike point sentinels.
                    setChapter(Math.min(2, Math.floor(p * 3)));
                }
            });
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
    }, []);

    // Reveal-on-scroll for regular sections (kept from V1). A fallback timer
    // reveals anything still hidden after the page settles so below-the-fold
    // sections never stay at opacity:0 in a full-page screenshot (or if the
    // viewer never scrolls) — the entrance animation still plays for anyone
    // who scrolls within the timeout.
    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
        document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
        const fallback = window.setTimeout(() => {
            document.querySelectorAll('.scroll-animate:not(.in-view)').forEach(el => el.classList.add('in-view'));
        }, 1500);
        return () => { observer.disconnect(); window.clearTimeout(fallback); };
    }, [user]);

    const chapters = t('home.stage.chapters', { returnObjects: true }) as { tag: string; title: string; desc: string }[];

    const jumpToChapter = (i: number) => {
        const el = stageRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        window.scrollTo({ top: window.scrollY + rect.top + (total * i) / 3 + 8, behavior: 'smooth' });
    };

    const renderScreen = (src: string, alt: string, extraClass = '') => (
        brokenImgs[src] ? (
            <div className={`hp-screen-placeholder ${extraClass}`}>
                <span className="hp-screen-placeholder-icon">🖼️</span>
                <span>{t('home.stage.placeholder')}</span>
                <code>{src}</code>
            </div>
        ) : (
            <img className={extraClass} src={src} alt={alt} onError={() => markBroken(src)} />
        )
    );

    return (
        <Layout>
            {/* ═══ Hero — oversized headline + doodle collage with parallax ═══ */}
            <section className="hp-hero" ref={heroRef}>
                <div className="hp-collage" aria-hidden="true">
                    {renderDoodles(heroDoodles)}
                </div>
                <h1 className="hp-headline">
                    {t('home.hero2.pre')}
                    <br />
                    <span className="hp-accent">{t('home.hero2.accent')}</span>
                    <br />
                    {t('home.hero2.post')}
                </h1>
                <p className="hp-hero-sub">{t('home.hero2.sub')}</p>
                <div className="hp-hero-actions">
                    <Link to="/practice" className="hp-pill">{t('home.hero2.ctaPrimary')}</Link>
                    {user && (
                        <button
                            type="button"
                            className="tour-start-btn"
                            title={t('tour.startHint')}
                            onClick={startTour}
                        >
                            <Compass size={17} />
                            {t('tour.startBtn')}
                            {!localStorage.getItem(TOUR_SEEN_KEY) && <span className="tour-pulse-dot" />}
                        </button>
                    )}
                    <Link to="/practice" className="hp-textlink">
                        {t('home.hero2.ctaSecondary')} <ArrowUpRight size={16} />
                    </Link>
                </div>
            </section>

            {/* ═══ Daily check-in — banner row right below the hero (logged-in only) ═══ */}
            {user && (
                <section className="hp-banner-wrap hp-checkin-wrap scroll-animate">
                    <div className="hp-banner">
                        <div className="hp-banner-main">
                            <h2 className="hp-banner-title"><Gift size={22} /> {t('home.checkin.heading')}</h2>
                            <div className="hp-checkin-stats">
                                <span className="hp-checkin-stat">
                                    <b>{checkinStatus?.today_checked ? '✅' : checkingIn ? '⏳' : '🗓️'}</b>
                                    {t('home.checkin.todayLabel')}
                                </span>
                                <span className="hp-checkin-stat">
                                    <b>{checkinStatus?.current_streak ?? '--'}</b>
                                    {t('home.checkin.streakLabel')}
                                </span>
                                <span className="hp-checkin-stat">
                                    <b>{checkinStatus?.total_checkins ?? '--'}</b>
                                    {t('home.checkin.totalLabel')}
                                </span>
                                {checkinStatus?.today_bonus ? (
                                    <span className="hp-checkin-stat bonus">
                                        <b>+{checkinStatus.today_bonus.toLocaleString()}</b>
                                        {t('home.checkin.rewardLabel')}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <button
                            className="hp-pill"
                            onClick={handleCheckin}
                            disabled={checkinStatus?.today_checked || checkingIn}
                        >
                            {checkinStatus?.today_checked
                                ? t('home.checkin.btnDone')
                                : checkingIn ? t('home.checkin.btnChecking') : t('home.checkin.btnCheckin')}
                        </button>
                    </div>
                    {(rewardMsg || (checkinStatus && !checkinStatus.today_checked)) && (
                        <div className="hp-banner-foot">
                            {rewardMsg && (
                                <p className={`hp-checkin-msg${checkinStatus?.today_checked ? ' done' : ''}`}>{rewardMsg}</p>
                            )}
                            {checkinStatus && !checkinStatus.today_checked && (
                                <p className="hp-checkin-hint">
                                    {getMilestoneHint(checkinStatus.current_streak, t('home.checkin.milestoneHint'))}
                                </p>
                            )}
                            <p className="hp-checkin-rules">{t('home.checkin.rules')}</p>
                        </div>
                    )}
                </section>
            )}

            {/* ═══ Scrollytelling stage (desktop): sticky mockup + sentinel-driven chapters ═══ */}
            <section className="hp-stage-outer" ref={stageRef} aria-label={t('home.stage.srHint')}>
                <div className="hp-stage-sticky">
                    <div className="hp-deco" aria-hidden="true">{renderDoodles(stageDoodles)}</div>
                    <div className="hp-stage-inner">
                        <div className="hp-chapter-tabs" role="tablist">
                            {chapters.map((c, i) => (
                                <button
                                    key={c.tag}
                                    role="tab"
                                    aria-selected={i === chapter}
                                    className={`hp-chapter-tab${i === chapter ? ' active' : ''}`}
                                    onClick={() => jumpToChapter(i)}
                                >
                                    {c.tag}
                                </button>
                            ))}
                        </div>
                        <div className="hp-stage-progress" aria-hidden="true">
                            <div className="hp-stage-progress-fill" />
                        </div>
                        <div className="hp-mockup">
                            <div className="hp-mockup-bar">
                                <span className="hp-dot r" /><span className="hp-dot y" /><span className="hp-dot g" />
                                <span className="hp-mockup-url">aielts.xyz</span>
                            </div>
                            <div className="hp-mockup-body">
                                {chapters.map((c, i) => (
                                    <div key={c.tag} className={`hp-screen${i === chapter ? ' active' : ''}`}>
                                        {renderScreen(stageImages[i], c.title)}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="hp-chapter-caption" key={chapter}>
                            <span className="hp-chapter-index">{chapter + 1} / {chapters.length}</span>
                            <h3>{chapters[chapter].title}</h3>
                            <p>{chapters[chapter].desc}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mobile fallback for the stage: stacked cards */}
            <section className="hp-stage-mobile">
                {chapters.map((c, i) => (
                    <div key={c.tag} className="hp-stage-mobile-card scroll-animate">
                        <div className="hp-mockup">
                            <div className="hp-mockup-bar">
                                <span className="hp-dot r" /><span className="hp-dot y" /><span className="hp-dot g" />
                                <span className="hp-mockup-url">aielts.xyz</span>
                            </div>
                            <div className="hp-mockup-body">{renderScreen(stageImages[i], c.title, 'static')}</div>
                        </div>
                        <h3>{c.title}</h3>
                        <p>{c.desc}</p>
                    </div>
                ))}
            </section>

            {/* ═══ Skills — horizontal scroll-snap carousel ═══ */}
            <section className="hp-features scroll-animate">
                <div className="hp-deco" aria-hidden="true">{renderDoodles(featureDoodles)}</div>
                <h2 className="hp-h2">{t('home.skills.heading')}</h2>
                <div className="hp-snap-row">
                    {(t('home.skills.items', { returnObjects: true }) as { title: string; desc: string; link: string }[]).map((item, i) => {
                        const Icon = skillIcons[i];
                        return (
                            <Link to={item.link} key={item.title} className="hp-feature-card">
                                <div className="hp-feature-icon"><Icon size={26} /></div>
                                <h3>{item.title}</h3>
                                <p>{item.desc}</p>
                                <span className="hp-feature-link">
                                    {t('home.hero.startPractice')} <ArrowRight size={15} />
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </section>

            {/* ═══ How it works — compact 3-step row ═══ */}
            <section className="hp-steps scroll-animate">
                <h2 className="hp-h2">{t('home.howItWorks.heading')}</h2>
                <div className="hp-steps-row">
                    {(t('home.howItWorks.steps', { returnObjects: true }) as { title: string; desc: string }[]).map((step, i) => (
                        <div key={step.title} className="hp-step">
                            <span className="hp-step-num">{i + 1}</span>
                            <h3>{step.title}</h3>
                            <p>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ Gallery — user-supplied photos ═══ */}
            <section className="hp-gallery scroll-animate">
                <div className="hp-deco" aria-hidden="true">{renderDoodles(galleryDoodles)}</div>
                <h2 className="hp-h2">{t('home.gallery.heading')}</h2>
                <p className="hp-h2-sub">{t('home.gallery.sub')}</p>
                <div className="hp-gallery-grid">
                    {(t('home.gallery.items', { returnObjects: true }) as { caption: string }[]).map((item, i) => (
                        <figure key={i} className="hp-gallery-item">
                            {brokenImgs[galleryImages[i]] ? (
                                <div className="hp-gallery-placeholder">
                                    <span>📷</span>
                                    <span>{t('home.gallery.photoPlaceholder')}</span>
                                    <code>{galleryImages[i]}</code>
                                </div>
                            ) : (
                                <img src={galleryImages[i]} alt={item.caption} onError={() => markBroken(galleryImages[i])} />
                            )}
                            <figcaption>{item.caption}</figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            {/* ═══ Announcements ═══ */}
            <section className="hp-news scroll-animate">
                <div className="hp-deco" aria-hidden="true">{renderDoodles(newsDoodles)}</div>
                <h2 className="hp-h2">{t('home.announcements.heading')}</h2>
                <div className="hp-news-list">
                    {(t('home.announcements.items', { returnObjects: true }) as { date: string; tag: string; content: string }[]).map((item, i) => (
                        <div key={i} className="hp-news-item">
                            <span className="hp-news-date">{item.date}</span>
                            <span className={`hp-news-tag ${item.tag === '新功能' || item.tag === 'New' ? 'new' : item.tag === '优化' || item.tag === 'Optimization' ? 'update' : 'community'}`}>
                                {item.tag}
                            </span>
                            <span className="hp-news-content">{item.content}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ Final CTA banner ═══ */}
            <section className="hp-banner-wrap scroll-animate">
                <div className="hp-deco" aria-hidden="true">{renderDoodles(ctaDoodles)}</div>
                <div className="hp-banner hp-banner-cta">
                    <h2 className="hp-banner-title">{t('home.ctaBanner.title')}</h2>
                    <Link to="/practice" className="hp-pill">
                        {t('home.ctaBanner.btn')} <ArrowRight size={15} />
                    </Link>
                </div>
            </section>

            {/* ═══ Footer ═══ */}
            <footer className="footer">
                <span>{t('home.footer')}</span>
                <div className="footer-links">
                    <Link to="/feedback">{t('home.footerFeedback')}</Link>
                    <span className="footer-sep">·</span>
                    <Link to="/profile">{t('home.footerManual')}</Link>
                </div>
            </footer>
        </Layout>
    );
}
