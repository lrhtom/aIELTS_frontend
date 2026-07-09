// English copy — shape is enforced against the zh source of truth.
import type * as zh from '../zh/aiPractice';

export const aiPractice: typeof zh.aiPractice = {
  backToPractice: 'Back to Hub',
  heading: 'AI Smart Practice',
  subheading: 'Powered by DeepSeek/Gemini/GPT for personalized content',
  otherPageTitle: 'Other Practice',
  otherPageSubtitle: 'More AI practice modules coming soon...',
  reading: {
    title: 'AI Reading',
    desc: 'Dynamic IELTS reading passages generated based on your vocabulary level.',
  },
  listening: {
    title: 'AI Listening',
    desc: 'IELTS-style audio materials to train your hearing and word capturing.',
  },
  speaking: {
    title: 'AI Speaking',
    desc: '1:1 simulated dialogue with AI for pronunciation and grammar feedback.',
  },
  writing: {
    title: 'AI Writing',
    desc: 'Get professional feedback on vocabulary, grammar, and coherence.',
  },
  others: {
    title: 'Other Practice',
    desc: 'Miscellaneous AI tasks',
  },
  bank: {
    title: 'AI Question Bank',
    desc: 'View and re-attempt every generated listening / reading / writing / speaking question.',
  },
  comingSoon: 'More modules for preparation are in development...',
};

export const aiBank: typeof zh.aiBank = {
  pageTitle: 'AI Question Bank',
  pageSubtitle: 'Every generated listening / reading / writing / speaking item is saved here for re-attempt.',
  backToAI: 'Back to AI Practice',
  tabs: {
    listening: 'Listening',
    reading: 'Reading',
    writing: 'Writing',
    speaking: 'Speaking',
  },
  statusPending: 'Pending',
  statusInProgress: 'In progress',
  statusAnswered: 'Answered',
  statusRedone: 'Redone',
  statusGenerating: '⏳ Generating',
  statusFailed: '⚠️ Generation failed',
  untitled: 'this item',
  unnamedFallback: '(Untitled)',
  loading: 'Loading…',
  emptyTitle: 'No {label} items yet',
  emptyHint: 'Generate one first.',
  generatedAt: 'Generated {time}',
  lastAttemptAt: '· Last attempt {time}',
  deleteBtn: 'Delete',
  deleteAriaLabel: 'Delete item',
  favoriteAriaLabel: 'Favorite item',
  unfavoriteAriaLabel: 'Remove from favorites',
  favoriteFail: 'Failed to update favorite, please retry',
  deleteConfirm: 'Delete "{title}"? This cannot be undone.',
  deleteSuccess: 'Deleted',
  deleteFail: 'Delete failed',
  loadFail: 'Failed to load bank',
  toastGeneratedSaved: 'Question generated and saved to AI Bank',
  toastMissingContent: 'Question content missing',
  toastStillGenerating: 'Still generating, please wait…',
  toastGenerationFailed: 'Generation failed. Delete and retry.',
  backToBank: '📚 Back to Bank',
  redoBtn: '🔁 Redo',
};
