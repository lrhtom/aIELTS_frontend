import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './home_page';
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
import SettingsPage from './settings_page';
import PromptPage from './prompt_page';
import ToastContainer from '../components/Toast';
import ChromeOnlyGuard from '../components/ChromeOnlyGuard';

export default function App() {
  return (
    <ChromeOnlyGuard>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/practice" element={<PracticeHub />} />
        <Route path="/practice/ai" element={<AIPractice />} />
        <Route path="/practice/ai/reading" element={<WordSelection_page />} />
        <Route path="/practice/ai/listening" element={<ListeningConfig />} />
        <Route path="/reading" element={<Reading_page />} />
        <Route path="/listening" element={<ListeningPage />} />
        <Route path="/speaking" element={<Speaking />} />
        <Route path="/speaking/chat" element={<SpeakingChatPage />} />
        <Route path="/writing" element={<Writing_page />} />
        <Route path="/writing/correction" element={<WritingCorrectionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/prompts" element={<PromptPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ChromeOnlyGuard>
  );
}
