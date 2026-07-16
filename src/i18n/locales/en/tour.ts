// English copy — shape is enforced against the zh source of truth.
import type * as zh from '../zh/tour';

export const tour: typeof zh.tour = {
  startBtn: 'Guided Tour',
  startHint: 'A hands-on walk through the whole platform',
  progress: 'Stop {current} / {total}',
  skip: 'Skip tour',
  prev: 'Back',
  next: 'Next',
  finish: 'Finish tour',
  waiting: 'Heading to the next stop…',
  steps: {
    welcome: {
      title: '👋 Welcome to aIELTS',
      desc: 'An AI-powered all-in-one IELTS prep platform: practice, marking, and vocabulary in one place. I will walk you around the whole platform, jumping to each page automatically. Hit "Next" to set off!',
    },
    checkin: {
      title: 'Daily Check-in',
      desc: 'Check in every day for 1,000 AT coins, with milestone bonuses at 7 / 30 / 100 / 365-day streaks. AT coins are the platform currency — every AI practice run is billed with them.',
    },
    sidebar: {
      title: 'Sidebar Navigation',
      desc: 'This button opens the sidebar anytime: question bank, vocabulary, store, feedback, notes, and the creative workshop are all one click away.',
    },
    hub: {
      title: 'AI Practice Hub',
      desc: 'The heart of your practice: AI-personalised training for Listening, Speaking, Reading, and Writing, plus the AI question bank and more — everything starts here.',
    },
    reading: {
      title: 'AI Reading',
      desc: 'AI generates academic passages and multiple question types to the IELTS syllabus, then pinpoints the answer sentence and explains every question after marking.',
    },
    listening: {
      title: 'AI Listening',
      desc: 'AI writes listening scripts and synthesises lifelike audio in multiple accents, paired with gap-fill and other question types — listen, answer, and review in one flow.',
    },
    writing: {
      title: 'AI Writing Marking',
      desc: 'Task 1 charts / maps + Task 2 essays. Submissions are scored on the four official criteria (TR · CC · LR · GRA) with sentence-level suggestions, plus dedicated AI teacher lessons.',
    },
    speaking: {
      title: 'AI Speaking Partner',
      desc: 'Talk with an AI examiner in real time across Parts 1–3. Your speech is transcribed line by line, and you get a report on Fluency, Vocabulary, Grammar, and Pronunciation.',
    },
    vocab: {
      title: 'Vocabulary Training',
      desc: 'Smart flashcards driven by the FSRS-4.5 memory algorithm: reviews are scheduled automatically, with multiple training modes, notebooks, and up to 3 learning plans at your own pace.',
    },
    store: {
      title: 'AT Coins & Store',
      desc: 'Your AT coin balance lives here. Earn coins through check-ins and events, and redeem handy items like make-up cards in the store.',
    },
    profile: {
      title: 'Profile Centre',
      desc: 'Avatar and profile, the learning dashboard, the calendar heatmap, your backpack, and feedback all live here. Check the User Manual whenever you want the full details of a feature.',
    },
    assistant: {
      title: 'Global AI Assistant',
      desc: 'This floating ball in the corner follows you on every page: translate, ask questions, screenshot-and-ask, and even quick check-in.',
    },
    end: {
      title: '🎉 Tour complete!',
      desc: 'You have now toured every core feature of aIELTS. You can restart the guided tour from the home page anytime. Now, go start your first practice!',
    },
  },
};
