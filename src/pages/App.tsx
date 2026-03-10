import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './home_page';
import ProtectedRoute from '../components/ProtectedRoute';
import PracticeHub from './practice_hub';
import AIPractice from './ai_practice';
import WordSelection_page from './WordSelection_page';
import ListeningConfig from './listening_config';
import Reading_page from './reading_page';
import ListeningPage from './listening_page';
import Speaking from './speaking';
import SpeakingChatPage from './speaking_chat';
import Writing_page from './writing_page';
import WritingCorrectionPage from './writing_correction_page';
import ChartSelectionPage from './chart_selection_page';
import ChartPracticePage from './chart_practice_page';
import SettingsPage from './settings_page';
import PromptPage from './prompt_page';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ProfilePage from './profile_page';
import ToastContainer from '../components/Toast';
import ChromeOnlyGuard from '../components/ChromeOnlyGuard';
import ATBalanceMonitor from '../components/ATBalanceMonitor';

export default function App() {
  return (
    <ChromeOnlyGuard>
      <ToastContainer />
      <ATBalanceMonitor />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route path="/practice" element={<ProtectedRoute><PracticeHub /></ProtectedRoute>} />
        <Route path="/practice/ai" element={<ProtectedRoute><AIPractice /></ProtectedRoute>} />
        <Route path="/practice/ai/reading" element={<ProtectedRoute><WordSelection_page /></ProtectedRoute>} />
        <Route path="/practice/ai/listening" element={<ProtectedRoute><ListeningConfig /></ProtectedRoute>} />
        <Route path="/reading" element={<ProtectedRoute><Reading_page /></ProtectedRoute>} />
        <Route path="/listening" element={<ProtectedRoute><ListeningPage /></ProtectedRoute>} />
        <Route path="/speaking" element={<ProtectedRoute><Speaking /></ProtectedRoute>} />
        <Route path="/speaking/chat" element={<ProtectedRoute><SpeakingChatPage /></ProtectedRoute>} />
        <Route path="/writing" element={<ProtectedRoute><Writing_page /></ProtectedRoute>} />
        <Route path="/writing/correction" element={<ProtectedRoute><WritingCorrectionPage /></ProtectedRoute>} />
        <Route path="/writing/chart" element={<ProtectedRoute><ChartSelectionPage /></ProtectedRoute>} />
        <Route path="/writing/chart/doing" element={<ProtectedRoute><ChartPracticePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/prompts" element={<ProtectedRoute><PromptPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ChromeOnlyGuard>
  );
}
