import { useLang } from '../i18n/LanguageContext';
import Layout from '../components/layout/Layout';
import UserFeedback from '../components/profile/UserFeedback';
import '../styles/feedback_page.css';

export default function FeedbackPage() {
    const { translations: t } = useLang();

    return (
        <Layout
            pageTitle={`🐛 ${t.profile.feedback.title}`}
            pageSubtitle={t.profile.feedback.desc}
        >
            <div className="feedback-page">
                <UserFeedback />
            </div>
        </Layout>
    );
}
