import Layout from '../components/layout/Layout';
import { useLang } from '../i18n/LanguageContext';

export default function OtherPracticePage() {
    const { t } = useLang();

    return (
        <Layout
            pageTitle={t('aiPractice.otherPageTitle')}
            pageSubtitle={t('aiPractice.otherPageSubtitle')}
            backUrl="/practice/ai"
            backText={t('aiPractice.backToPractice')}
        >
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-bg)', borderRadius: '12px', marginTop: '2rem' }}>
                <span style={{ fontSize: '3rem', marginBottom: '1rem', display: 'inline-block' }}>🧩</span>
                <h2>{t('aiPractice.comingSoon')}</h2>
            </div>
        </Layout>
    );
}
