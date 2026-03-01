import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './home_page';
import WordSelection_page from './WordSelection_page';
import Reading_page from './reading_page';
import Listen_page from './listen_page';
import Speaking from './speaking';
import Writing_page from './writing_page';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/practice" element={<WordSelection_page />} />
      <Route path="/reading" element={<Reading_page />} />
      <Route path="/listening" element={<Listen_page />} />
      <Route path="/speaking" element={<Speaking />} />
      <Route path="/writing" element={<Writing_page />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
