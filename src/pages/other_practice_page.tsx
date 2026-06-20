import Layout from '../components/layout/Layout';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';

export default function OtherPracticePage() {
    const { lang } = useLang();
    const t = translations[lang];

    return (
        <Layout
            pageTitle={lang === 'zh' ? '其他练习' : 'Other Practice'}
            pageSubtitle={lang === 'zh' ? '更多智能化练习模块即将上线...' : 'More AI practice modules coming soon...'}
            backUrl="/practice/ai"
            backText={t.aiPractice.backToPractice}
        >
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-bg)', borderRadius: '12px', marginTop: '2rem' }}>
                <span style={{ fontSize: '3rem', marginBottom: '1rem', display: 'inline-block' }}>🧩</span>
                <h2>{t.comingSoon}</h2>
            </div>
        </Layout>
    );
}
