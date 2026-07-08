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
        date: '2026-03-20',
        tag: 'New',
        content: 'AI Writing correction is live with real-time feedback.',
      },
      {
        date: '2026-03-15',
        tag: 'Optimization',
        content: 'Improved voice recognition for speaking practice.',
      },
      {
        date: '2026-03-10',
        tag: 'Community',
        content: 'Join our study group and work together with peers.',
      },
    ],
  },
  footer: '© 2026 aIELTS. All rights reserved.',
  footerFeedback: 'Feedback',
  footerManual: 'User Manual',
  checkin: {
    heading: 'Daily Check-in',
    todayLabel: 'Today',
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
