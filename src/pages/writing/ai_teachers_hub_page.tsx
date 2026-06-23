import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useLang } from '../../i18n/LanguageContext';

export default function AiTeachersHubPage() {
    const { lang, translations: t } = useLang();
    const navigate = useNavigate();

    return (
        <Layout
            pageTitle={t.writingHub?.teachersHub?.pageTitle || 'AI Writing Teachers'}
            pageSubtitle={t.writingHub?.teachersHub?.pageSubtitle || 'Choose your AI writing tutoring mode'}
            backUrl="/writing"
            backText={t.writingHub?.backToPractice || 'Back'}
        >
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.5rem',
                    marginTop: '2rem'
                }}>
                    <button
                        style={{
                            padding: '1.5rem',
                            borderRadius: '12px',
                            border: '2px solid var(--color-primary)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                        onClick={() => navigate('/writing/correction')}
                    >
                        <span style={{ fontSize: '24px' }}>📝</span>
                        <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub?.correction?.title || 'AI 写作批改'}</div>
                        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            {t.writingHub?.correction?.desc || '提交作文，获取多维度评分与修改建议'}
                        </div>
                    </button>

                    <button
                        style={{
                            padding: '1.5rem',
                            borderRadius: '12px',
                            border: '2px solid var(--color-primary)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                        onClick={() => navigate('/writing/task1-ai-teacher')}
                    >
                        <span style={{ fontSize: '24px' }}>📈</span>
                        <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub?.teachersHub?.task1Title || 'Task 1 AI Teacher'}</div>
                        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            {t.writingHub?.teachersHub?.task1Desc || 'Smart chart trend extraction and data comparison guidance'}
                        </div>
                    </button>

                    <button
                        style={{
                            padding: '1.5rem',
                            borderRadius: '12px',
                            border: '2px solid var(--color-primary)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                        onClick={() => navigate('/writing/ai-teacher')}
                    >
                        <span style={{ fontSize: '24px' }}>👨‍🏫</span>
                        <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub?.teachersHub?.task2Title || 'Task 2 AI Teacher'}</div>
                        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            {t.writingHub?.teachersHub?.task2Desc || 'Rapid decoding and paragraph-level deep guidance'}
                        </div>
                    </button>

                    <button
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            padding: '24px',
                            borderRadius: '16px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-background-soft)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                        onClick={() => navigate('/writing/ai-teachers/records')}
                    >
                        <span style={{ fontSize: '24px' }}>📂</span>
                        <div style={{ fontSize: '18px', fontWeight: '600' }}>{t.writingHub?.teachersHub?.recordsTitle || 'Service Records'}</div>
                        <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            {t.writingHub?.teachersHub?.recordsDesc || 'Review past corrections and AI lessons'}
                        </div>
                    </button>
                </div>
            </div>
        </Layout>
    );
}
