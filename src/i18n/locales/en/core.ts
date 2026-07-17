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
  customPrompt: {
    title: 'Custom Prompt Instruction (optional · advanced)',
    warning: '⚠️ Use with care: a custom instruction takes HIGHEST priority and overrides the default topic / difficulty / style, so it may derail the question, produce off-spec IELTS content, or cost extra AT. Leave it off if unsure. (Only the output format and safety limits cannot be overridden.)',
    ack: 'I understand the risks and still want to use it',
    placeholder: 'e.g. Center the topic on "environmental protection"; calibrate to IELTS band 7; prefer the passive voice…',
  },
};

export const components: typeof zh.components = {
  questionRenderer: {
    typeAnswer: 'Type your answer…',
    answerRemaining: 'Answer the remaining questions:',
    removeHeading: 'Remove heading',
    dropHeading: 'Drop a heading here',
    correctIs: '❌ (correct: {a})',
    unsupportedType: 'Unsupported question type: {t}. Please regenerate or send us feedback.',
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
  customModel: {
    // dropdown selector
    addOption: '＋ Add custom model',
    customTag: 'custom',
    // modal
    addTitle: 'Add custom model',
    editTitle: 'Edit custom model',
    nameLabel: 'Model name',
    namePlaceholder: 'e.g. gpt-4o-mini (sent as the request "model" field)',
    urlLabel: 'API URL',
    urlPlaceholder: 'https://api.openai.com/v1/chat/completions',
    keyLabel: 'SK key',
    keyPlaceholder: 'sk-...',
    keyKeepHint: 'Leave blank to keep the existing key',
    test: 'Test',
    testing: 'Testing…',
    save: 'Save',
    cancel: 'Cancel',
    errName: 'Please enter a model name',
    errUrl: 'API URL must start with http(s)://',
    errKey: 'Please enter the SK key',
    saveFail: 'Save failed',
    // settings manager panel
    managerTitle: 'Custom model management',
    managerDesc: 'Add your own OpenAI-compatible model (your own key; calls cost no AT).',
    addBtn: 'Add custom model',
    empty: 'No custom models yet',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Delete this custom model?',
    deleteFail: 'Delete failed',
    loadFail: 'Failed to load',
    // test results (map to backend ping status)
    testOk: 'Connection OK',
    testAuth: 'Auth failed (bad key or permissions)',
    testRateLimited: 'Rate limited, try again later',
    testReqError: 'Endpoint online but request rejected (model/params/URL)',
    testError: 'Connection failed (unreachable or timeout)',
    testUnconfigured: 'Incomplete configuration',
    // Help panel: common import examples
    helpAria: 'Show import examples',
    helpIntro: 'Any OpenAI-compatible /chat/completions endpoint works. Examples for common services — click "Fill" to auto-populate:',
    helpFill: 'Fill',
    helpNote: 'Tips: the model name is the "model" value in the request; the URL must be the full chat/completions address.',
    helpOllamaNote: 'Ollama: run "ollama serve" first; any SK works. Reachable via localhost only when this platform runs on the same machine; a remote deployment needs a URL the server can reach (public address or a tunnel).',
    pOllama: 'Ollama (local model)',
    pOpenai: 'OpenAI',
    pDeepseek: 'DeepSeek',
    pQwen: 'Qwen (DashScope compatible mode)',
    pOpenrouter: 'OpenRouter',
    // Official model test section (bottom of the settings panel)
    officialTitle: 'Official model test',
    officialDesc: 'Test connectivity of the platform-provided models. Uses the platform key — a successful test is billed in AT by actual token usage (failed tests are free).',
    officialCostNote: 'cost {n} AT',
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
  estimatedBand: 'Est. IELTS Band',
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
