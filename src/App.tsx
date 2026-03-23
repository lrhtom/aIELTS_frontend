import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/guards/ProtectedRoute';
import ToastContainer from './components/common/Toast';
import ChromeOnlyGuard from './components/guards/ChromeOnlyGuard';
import ATBalanceMonitor from './components/billing/ATBalanceMonitor';

// 通用页面 
import HomePage from './pages/home_page';
import PracticeHub from './pages/practice_hub';
import AIPractice from './pages/ai_practice';
import ProfilePage from './pages/profile_page';
import PromptPage from './pages/prompt_page';
import SettingsPage from './pages/settings_page';

// 认证
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// 阅读
import WordSelection_page from './pages/reading/WordSelection_page';
import Reading_page from './pages/reading/reading_page';

// 听力
import ListeningConfig from './pages/listening/listening_config';
import ListeningPage from './pages/listening/listening_page';

// 口语
import Speaking from './pages/speaking/speaking';
import SpeakingChatPage from './pages/speaking/speaking_chat';
import SpeakingSummaryPage from './pages/speaking/speaking_summary';

// 写作
import Writing_page from './pages/writing/writing_page';
import WritingCorrectionPage from './pages/writing/writing_correction_page';
import Task1SelectionPage from './pages/writing/task1_selection_page';
import Task2SelectionPage from './pages/writing/task2_selection_page';
import Task2OpinionSelectionPage from './pages/writing/task2_opinion_selection_page';
import Task2PracticePage from './pages/writing/task2_practice_page';
import ChartSelectionPage from './pages/writing/chart_selection_page';
import ChartPracticePage from './pages/writing/chart_practice_page';

// 词汇
import VocabularyPracticePage from './pages/vocabulary/vocabulary_practice_page';
import VocabularyTrainingPage from './pages/vocabulary/vocabulary_training_page';
import VocabularyTrainingDoingPage from './pages/vocabulary/vocabulary_training_doing_page';
import VocabularyFlashcardDoingPage from './pages/vocabulary/vocabulary_flashcard_doing_page';
import NotebookListPage from './pages/vocabulary/notebook_list_page';
import NotebookDetailPage from './pages/vocabulary/notebook_detail_page';
import LearningPlanListPage from './pages/vocabulary/learning_plan_list_page';
import LearningPlanDetailPage from './pages/vocabulary/learning_plan_detail_page';
import VocabBookListPage from './pages/vocabulary/vocab_book_list_page';
import VocabBookDetailPage from './pages/vocabulary/vocab_book_detail_page';

export default function App() {
  return (
    <ChromeOnlyGuard>
      <ToastContainer />
      <ATBalanceMonitor />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/vocabulary" element={<ProtectedRoute><VocabularyPracticePage /></ProtectedRoute>} />
        <Route path="/vocabulary/practice" element={<ProtectedRoute><VocabularyTrainingPage /></ProtectedRoute>} />
        <Route path="/vocabulary/practice/:mode/doing" element={<ProtectedRoute><VocabularyTrainingDoingPage /></ProtectedRoute>} />
        <Route path="/vocabulary/flashcard" element={<Navigate to="/vocabulary/plans" replace />} />
        <Route path="/vocabulary/flashcard/doing" element={<ProtectedRoute><VocabularyFlashcardDoingPage /></ProtectedRoute>} />
        <Route path="/vocabulary/notebook" element={<ProtectedRoute><NotebookListPage /></ProtectedRoute>} />
        <Route path="/vocabulary/notebook/:id" element={<ProtectedRoute><NotebookDetailPage /></ProtectedRoute>} />
        <Route path="/vocabulary/plans" element={<ProtectedRoute><LearningPlanListPage /></ProtectedRoute>} />
        <Route path="/vocabulary/plans/:id" element={<ProtectedRoute><LearningPlanDetailPage /></ProtectedRoute>} />
        <Route path="/vocabulary/books" element={<ProtectedRoute><VocabBookListPage /></ProtectedRoute>} />
        <Route path="/vocabulary/books/:id" element={<ProtectedRoute><VocabBookDetailPage /></ProtectedRoute>} />

        {/* Protected Routes */}
        <Route path="/practice" element={<ProtectedRoute><PracticeHub /></ProtectedRoute>} />
        <Route path="/practice/ai" element={<ProtectedRoute><AIPractice /></ProtectedRoute>} />
        <Route path="/practice/ai/reading" element={<ProtectedRoute><WordSelection_page /></ProtectedRoute>} />
        <Route path="/practice/ai/listening" element={<ProtectedRoute><ListeningConfig /></ProtectedRoute>} />
        <Route path="/reading" element={<ProtectedRoute><Reading_page /></ProtectedRoute>} />
        <Route path="/listening" element={<ProtectedRoute><ListeningPage /></ProtectedRoute>} />
        <Route path="/speaking" element={<ProtectedRoute><Speaking /></ProtectedRoute>} />
        <Route path="/speaking/chat" element={<ProtectedRoute><SpeakingChatPage /></ProtectedRoute>} />
        <Route path="/speaking/summary" element={<ProtectedRoute><SpeakingSummaryPage /></ProtectedRoute>} />
        <Route path="/writing" element={<ProtectedRoute><Writing_page /></ProtectedRoute>} />
        <Route path="/writing/correction" element={<ProtectedRoute><WritingCorrectionPage /></ProtectedRoute>} />
        <Route path="/writing/task1" element={<ProtectedRoute><Task1SelectionPage /></ProtectedRoute>} />
        <Route path="/writing/task2" element={<ProtectedRoute><Task2SelectionPage /></ProtectedRoute>} />
        <Route path="/writing/task2/opinion" element={<ProtectedRoute><Task2OpinionSelectionPage /></ProtectedRoute>} />
        <Route path="/writing/task2/doing" element={<ProtectedRoute><Task2PracticePage /></ProtectedRoute>} />
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
