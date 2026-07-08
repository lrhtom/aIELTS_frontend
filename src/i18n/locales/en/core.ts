// English copy — shape is enforced against the zh source of truth.
import type * as zh from '../zh/core';

export const navbar: typeof zh.navbar = {
  goals: {
    noGoal: 'No Goal',
    countdown: '🎯 {days} days left until exam on {date} | Target {score}',
    examDay: '🎯 Today is the exam day, good luck! 🎉 | Target {score}',
    examPassed: '🎯 Congratulations on completing your exam! 🎉 | Target {score}',
  },
};

export const nav: typeof zh.nav = {
  home: 'Home',
  practice: 'Practice',
  settings: 'Settings',
  prompts: 'Prompt Hub',
  collapse: 'Collapse',
  vocab: 'Vocabulary',
  sidebarTitle: 'Navigation',
  store: 'Store',
  workshop: 'Creative Workshop',
  feedback: 'Feedback',
  notebook: 'Notes',
};

export const common: typeof zh.common = {
  back: 'Back',
  confirm: 'Confirm',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Error',
  loading: 'Loading...',
  home: 'Home',
  underline: 'Underline',
  optional: 'optional',
  planImport: {
    placeholder: "-- Select a plan to import today's words --",
    importing: 'Importing...',
    btn: "⬇ Import today's words",
    noWords: 'This plan has no words to study today',
    failed: 'Import failed',
    success: 'Imported {n} words',
    skipped: 'Imported {n} words, {s} skipped due to missing Chinese meaning',
  },
  customQuestion: {
    sectionTitle: 'Custom name & description',
    sectionDesc: 'Optional. Leave empty to use the AI default title; no description shown in the bank card.',
    nameLabel: 'Name',
    namePlaceholder: 'e.g., Family education · MCQ · 6.5',
    descLabel: 'Description',
    descPlaceholder: "e.g., Education topic for this week's revision",
  },
};

export const components: typeof zh.components = {
  questionRenderer: {
    typeAnswer: 'Type your answer…',
    answerRemaining: 'Answer the remaining questions:',
    removeHeading: 'Remove heading',
    dropHeading: 'Drop a heading here',
    correctIs: '❌ (correct: {a})',
  },
  vocabInput: {
    label: 'Vocab Added',
    invalidLines: 'invalid format(s)',
    placeholder: 'ubiquitous - 普遍存在的\nmitigate - 减轻\nephemeral - 短暂的\n\nOne per line: word - Chinese meaning',
    formatDesc: 'One word per line, format: word - meaning (must include EN + ZH)',
    toastHint: 'Format error: need EN word and ZH meaning',
  },
  aiModel: {
    label: 'AI Model',
    desc: 'Select the engine for generation and correction',
  },
  toast: {
    errorTitle: 'Error',
  },
};

export const results: typeof zh.results = {
  analysis: 'Analysis & Explanations',
  originalPassage: 'Review Passage',
  hidePassage: 'Hide Passage',
  showPassage: 'Show Passage',
  targetVocab: 'Target Vocabulary',
  yourAnswer: 'Your Answer',
  correctAnswer: 'Correct Answer',
  acceptableAnswers: 'Acceptable Answers',
  statusCorrect: 'Correct',
  statusIncorrect: 'Incorrect',
  explanation: 'Explanation',
};

export const billing: typeof zh.billing = {
  insufficientBalance: 'Insufficient AT Balance',
  checkingBalance: 'Checking AT balance...',
  estimateCost: 'This {service} practice will consume about <strong>{estimatedCost} AT coins</strong>.',
  currentBalance: 'Your current balance is <strong>{balance} AT coins</strong>.',
  goToRecharge: 'Go to Recharge',
  tryAnyway: 'Try Anyway',
  consumedToast: 'Consumed {n} AT coins',
  refundToast: 'AI failed, {n} AT coins refunded',
  needMoreBalance: '{message} (Need {required} AT, current {current} AT)',
  requestFailed: 'Request failed',
  estimatedShort: 'AT balance may be insufficient (estimated)',
};

export const chromeOnlyGuard: typeof zh.chromeOnlyGuard = {
  warningTitle: 'Browser Compatibility Notice:',
  warningDesc: 'Chrome browser is recommended for the full voice experience.',
  copyUrl: '📋 Copy URL',
};

export const errorBoundary: typeof zh.errorBoundary = {
  heading: 'Something went wrong',
  hint: 'Please refresh the page or contact support.',
};
