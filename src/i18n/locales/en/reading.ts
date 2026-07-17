// English copy — shape is enforced against the zh source of truth.
import type * as zh from '../zh/reading';

export const readingConfig: typeof zh.readingConfig = {
  backToAI: 'Back to AI Practice',
  heading: 'Reading Configuration',
  subheading: 'Customize your reading training materials',
  targetScore: 'Target Band Score',
  modeToggle: {
    label: 'Practice Mode',
    single: 'Single Question Type',
    full: 'Full Test (3 Passages)',
  },
  questionType: {
    label: 'Question Type',
    groups: {
      choice: 'Multiple Choice',
      judgement: 'Judgement',
      matching: 'Matching',
      completion: 'Completion',
    },
    multipleChoice: {
      title: 'MCQ (A/B/C/D)',
      desc: 'One passage + 5 four-option MCQs',
    },
    trueFalse: {
      title: 'True/False/Not Given',
      desc: 'Judge whether each statement matches facts in the passage',
    },
    yesNo: {
      title: 'Yes/No/Not Given',
      desc: "Judge whether each statement matches the writer's views",
    },
    matchingHeadings: {
      title: 'Matching Headings',
      desc: 'Match each paragraph to a heading from a bank',
    },
    matchingInfo: {
      title: 'Matching Information',
      desc: 'Identify which paragraph contains each piece of info',
    },
    matchingFeatures: {
      title: 'Matching Features',
      desc: 'Classify statements to people / theories / categories',
    },
    matchingSentence: {
      title: 'Matching Sentence Endings',
      desc: 'Match sentence beginnings with correct endings',
    },
    sentenceCompletion: {
      title: 'Sentence Completion',
      desc: 'Complete standalone sentences using words from the passage',
    },
    summaryCompletion: {
      title: 'Summary Completion',
      desc: 'Complete a paraphrased summary using a word bank',
    },
    noteCompletion: {
      title: 'Note / Table / Flow-chart',
      desc: 'Complete structured notes with words from the passage',
    },
    shortAnswer: {
      title: 'Short-Answer Questions',
      desc: 'Answer wh- questions using words from the passage',
    },
  },
  judgementMode: {
    label: 'Judgement Mode',
    easy: {
      title: 'Easy (True / False)',
      desc: 'Only True and False options are provided.',
    },
    normal: {
      title: 'Normal (True / False / Not Given)',
      desc: 'True, False, and Not Given options are provided.',
    },
  },
  wordCount: {
    label: 'Answer Word Limit',
    min: 'Min',
    max: 'Max',
    hintExact: 'Exactly {n} word(s)',
    hintRange: '{min}-{max} words',
  },
  topic: {
    label: 'Topic',
    desc: 'Pick a topic area or leave as random for variety',
    random: 'Random (default)',
    list: {
      archaeology: 'Archaeology & ancient civilisations',
      marine_biology: 'Marine biology & oceans',
      urban_planning: 'Urban planning',
      language: 'Language acquisition & linguistics',
      climate: 'Climate & environment',
      trade_history: 'Ancient trade & economic history',
      cognition: 'Cognitive science & memory',
      renewable_energy: 'Renewable energy tech',
      food_history: 'Food & agriculture history',
      space: 'Space & astronomy',
      animal_behaviour: 'Animal behaviour',
      architecture: 'Architecture history',
      social_psychology: 'Social psychology',
      education: 'Education reform',
      medicine_history: 'History of medicine',
      anthropology: 'Cultural anthropology',
      geology: 'Geology & earth sciences',
      transport: 'Transport & mobility',
      music_history: 'History of music',
      psychology_work: 'Workplace psychology',
    },
  },
  fullTest: {
    title: 'Full Test',
    desc: '3 passages, ~13 questions each, 40 total; mixed question types',
    summary: '3 passages · 40 questions · 60 min',
    startBtn: 'Start Full Test',
    scope: {
      label: 'Scope',
      all: 'All 3 passages',
      single: 'Single passage',
    },
    singlePassage: {
      label: 'Pick passage',
      p1: 'Passage 1 (easier)',
      p2: 'Passage 2 (medium)',
      p3: 'Passage 3 (harder)',
    },
    singleMix: {
      label: 'Question type mix',
      desc: 'Pick 2-3 types; leave empty for the preset mix',
      clear: 'Clear',
    },
  },
  customVocab: {
    label: 'Use Custom Vocabulary',
    desc: 'If enabled, AI will incorporate your words into the passage',
  },
  absurdMode: {
    label: '🎭 Absurd Mode',
    desc: 'When enabled, AI will generate a passage full of jokes to aid memorization',
  },
  startBtn: 'Start Generating Passage',
  toast: {
    noVocab: 'Please enter some target vocabulary first',
  },
};

export const readingDetails: typeof zh.readingDetails = {
  dictionary: 'Dictionary',
  questions: 'Questions',
  time: 'Time',
  hideTargets: '💡 Hide Target Words',
  showTargets: '💡 Show Target Words',
  questionsMcq: 'Questions (Multiple Choice)',
  questionsTrueFalseEasy: 'Questions (True / False)',
  questionsTrueFalseNormal: 'Questions (True / False / Not Given)',
  submitConfirm: 'You have unanswered questions. Submit anyway?',
  writingPassage: 'AI is writing your IELTS reading passage...',
  searchPlaceholder: '🔍 Search word or meaning...',
  underline: 'Underline',
  submitBtn: 'Submit Answers',
  absurdMode: '🎭 Absurd Mode',
  absurdModeOn: 'ON',
  absurdModeOff: 'OFF',
  toastReqFail: 'Request failed',
  toastSaveFail: "Failed to save answers, but this session's results are shown",
  exitConfirm: 'Are you sure you want to exit practice? Unsaved progress may be lost',
  exitBtn: 'Exit Practice',
  questionNav: {
    jumpTo: 'Jump to question {n}',
    progress: '{answered} of {total}',
    barLabel: 'Question navigator',
  },
};
