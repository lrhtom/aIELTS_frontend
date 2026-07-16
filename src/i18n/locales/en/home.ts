// English copy — shape is enforced against the zh source of truth.
import type * as zh from '../zh/home';

export const home: typeof zh.home = {
  hero: {
    title: 'Master IELTS with aIELTS',
    subtitle: 'AI-powered all-in-one IELTS learning platform to help you break through linguistic barriers.',
    subsubtitle: 'AI-Powered IELTS Full-Skill Practice Platform',
    startPractice: 'Start Practice',
    vocab: 'Vocabulary',
  },
  skills: {
    heading: 'Comprehensive Coverage',
    items: [
      {
        title: 'Reading',
        desc: 'AI-generated reading passages and questions with precise sentence location and detailed explanations.',
        link: '/practice/ai/reading',
      },
      {
        title: 'Listening',
        desc: 'AI-generated listening audio and questions, supporting various accents and scenarios.',
        link: '/practice/ai/listening',
      },
      {
        title: 'Speaking',
        desc: 'AI voice conversation practice with real-time transcription and scoring, covering Parts 1-3.',
        link: '/speaking',
      },
      {
        title: 'Writing',
        desc: 'Task 1 charts + Task 2 essays, with AI scoring, corrections, and improvement suggestions.',
        link: '/writing',
      },
    ],
  },
  howItWorks: {
    heading: 'Get Started in 3 Steps',
    steps: [
      {
        title: 'Choose a Skill',
        desc: 'Pick from Reading, Listening, Speaking, or Writing for targeted practice',
      },
      {
        title: 'AI Generates Content',
        desc: 'AI intelligently creates personalized exercises and mock tests based on the IELTS syllabus',
      },
      {
        title: 'Practice & Get Feedback',
        desc: 'Receive detailed AI scoring, mistake analysis, and improvement tips after each session',
      },
    ],
  },
  announcements: {
    heading: 'Latest Updates',
    items: [
      {
        date: '2026-07-09',
        tag: 'New',
        content: 'Favorites arrive for the AI question bank and study plans — pinned to the top for one-tap access to what you use most.',
      },
      {
        date: '2026-07-06',
        tag: 'Optimization',
        content: 'Redesigned the study-plan page with an independently scrolling word list for smoother management.',
      },
      {
        date: '2026-07-03',
        tag: 'New',
        content: 'Task 1 now generates Map questions — AI draws a clear map for broader coverage.',
      },
    ],
  },
  // ── V2 home (scrollytelling layout modeled on chatgpt.com/overview, 2026-07-16) ──
  hero2: {
    pre: 'Now you can',
    accent: 'practice, get scored & build vocab',
    post: 'all in one place.',
    sub: 'The AI-powered IELTS prep platform',
    ctaPrimary: 'Get started',
    ctaSecondary: 'Browse question bank',
  },
  stage: {
    srHint: 'Scroll to explore three core features',
    placeholder: 'Product screenshot pending',
    chapters: [
      {
        tag: 'Listening',
        title: 'AI Listening Practice',
        desc: 'AI-generated audio with matching questions — multiple accents and scenarios, instant answers and explanations.',
      },
      {
        tag: 'Writing',
        title: 'AI Writing Feedback',
        desc: 'Task 1 charts + Task 2 essays. Submit and get sentence-level corrections, band scores, and rewrites in seconds.',
      },
      {
        tag: 'Speaking',
        title: 'AI Speaking Partner',
        desc: 'Press and talk — real-time AI conversation with live transcription and multi-dimensional scoring across Parts 1-3.',
      },
    ],
  },
  gallery: {
    heading: 'More features at a glance',
    sub: 'From authentic reading passages to AI-drawn map questions, every detail is built for score gains.',
    photoPlaceholder: 'Image pending',
    items: [
      { caption: 'AI Reading: answer sentences highlighted and traced back to the passage' },
      { caption: 'Task 1 Maps: AI-generated maps that mirror the real exam' },
    ],
  },
  ctaBanner: {
    title: 'Start your IELTS journey today',
    btn: 'Start practicing',
  },
  footer: '© 2026 aIELTS. All rights reserved.',
  footerFeedback: 'Feedback',
  footerManual: 'User Manual',
  checkin: {
    heading: 'Daily Check-in',
    todayLabel: 'Today',
    streakLabel: 'Day Streak',
    totalLabel: 'Total',
    rewardLabel: "Today's AT Reward",
    btnCheckin: '📋 Check in for AT',
    btnChecking: 'Checking in...',
    btnDone: 'Checked in ✓',
    errorToast: 'Check-in failed, please retry',
    milestoneHint: '{remain} days until the {next}-day milestone!',
    rules: 'Rewards: 1,000 AT daily | 7-day +10k | 30-day +30k | 100-day +100k | 365-day +1M | 1000-day +10M',
  },
};

export const practiceHub: typeof zh.practiceHub = {
  backToHome: 'Back to Home',
  heading: 'IELTS Practice Hub',
  subheading: 'Choose your practice mode and start your efficiency journey',
  realPractice: {
    title: 'Real Past Papers',
    desc: 'Challenge yourself with real IELTS exam questions for authentic experience.',
  },
  aiPractice: {
    title: 'AI Personalized Training',
    desc: 'Intelligent question generation tailored to your personal weaknesses.',
  },
  comingSoon: 'More practice modes are coming soon...',
};
