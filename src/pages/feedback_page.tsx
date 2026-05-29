import Layout from '../components/layout/Layout';
import UserFeedback from '../components/profile/UserFeedback';
import '../styles/feedback_page.css';

export default function FeedbackPage() {
    return (
        <Layout>
            <div className="feedback-page">
                <UserFeedback />
            </div>
        </Layout>
    );
}
