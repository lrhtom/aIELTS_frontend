// English copy — shape is enforced against the zh source of truth.
import type * as zh from '../zh/writing';

export const writingHub: typeof zh.writingHub = {
  backToPractice: 'Back to AI Practice',
  heading: 'Writing Hall (Writing)',
  subheading: 'Choose the type of writing practice you want to do',
  practiceMode: 'Practice Mode',
  correction: {
    title: 'AI Writing Correction',
    desc: 'Paste your IELTS Task 1 or Task 2 essay here, and the AI examiner will deeply correct and grade it based on the four official IELTS scoring criteria.',
  },
  task1: {
    title: 'Task 1 Practice',
    desc: 'Specialized training for IELTS Task 1. We provide random chart, map, and flowchart questions to help you learn how to construct advanced vocabulary.',
  },
  task2: {
    title: 'Task 2 Practice',
    desc: "In-depth training for IELTS Task 2. You can choose different types of prompts or challenge the AI model's innovative prediction questions.",
  },
  full: {
    title: 'Full Writing Set (Task 1 + Task 2)',
    desc: 'Generate a Task 1 and a Task 2 prompt in one go, saved as a single card in your bank. No timer, no fixed order — attempt and grade each whenever you like.',
  },
  opinionDrill: {
    title: '🧠 Opinion Drill Board',
    desc: 'Generate a full set of opinion questions in one round and get grammar, relevance, and vocabulary scoring summaries question by question.',
  },
  typingChat: {
    title: '💬 Typing Chat Mode',
    desc: 'Chat with AI via pure text, apply your target vocabulary in real scenarios to improve writing expression.',
  },
  perspective: {
    title: '🎯 Perspective Training',
    desc: 'Enter an IELTS writing topic and AI will generate a high-scoring opinion and a common mistake version to improve your expression quality.',
  },
  aiTeacher: {
    title: 'AI Writing Teacher',
    desc: 'Includes AI grading and 1-on-1 tutoring for Task 1 and Task 2.',
  },
  teachersHub: {
    pageTitle: 'AI Writing Teachers',
    pageSubtitle: 'Choose your AI writing tutoring mode',
    task1Title: 'Task 1 AI Teacher',
    task1Desc: 'Smart chart trend extraction and data comparison guidance',
    task2Title: 'Task 2 AI Teacher',
    task2Desc: 'Rapid decoding and paragraph-level deep guidance',
    recordsTitle: 'Service Records',
    recordsDesc: 'Review past corrections and AI lessons',
  },
  records: {
    pageTitle: 'Service Records',
    pageSubtitle: 'Review your past writing practices and AI feedback',
    backToHub: 'Back to Hub',
    searchPlaceholder: 'Search titles...',
    allTypes: 'All Types',
    loading: 'Loading...',
    empty: 'No service records found',
    deleteConfirm: 'Are you sure to delete this record?',
    deleteSuccess: 'Deleted successfully',
    deleteFail: 'Delete failed',
    loadFail: 'Failed to load records',
    error: 'Error loading records',
    viewerNotSupported: 'Viewer not supported for this type',
    serviceTypes: {
      correction: '📝 Correction',
      task1_teacher: '📊 Task 1 Teacher',
      task2_teacher: '🧠 Task 2 Teacher',
      opinion_drill: '💡 Opinion Drill',
      typing_chat: '💬 Typing Chat',
    },
  },
};

export const writingPerspective: typeof zh.writingPerspective = {
  heading: '🎯 Writing Perspective Training',
  subheading:
    'Enter an IELTS writing topic and AI will generate a high-scoring opinion and a common mistake version for comparison',
  backToHall: '← Back to Writing Hall',
  inputTitle: 'Writing Topic',
  inputDesc:
    'Enter an IELTS writing topic. AI will generate a high-scoring opinion and a common mistake opinion in response.',
  placeholder:
    'Enter an IELTS writing topic here, e.g.: Some people think that remote work greatly improves individual productivity. To what extent do you agree or disagree?',
  analyzeBtn: '🔍 Analyze',
  analyzingBtn: 'Analyzing...',
  loadingTitle: 'Analyzing...',
  loadingDesc: 'AI is generating a high-scoring opinion and a common mistake version for your topic',
  emptyTitle: 'Awaiting Analysis',
  emptyDesc:
    'Enter an IELTS writing topic on the left and click "Analyze". AI will show you a high-scoring opinion and a common mistake version.',
  goodBadge: 'High Score',
  goodTitle: 'High-Scoring Opinion',
  badBadge: 'Mistake',
  badTitle: 'Common Mistake Opinion',
  reasonLabel: "Why it's wrong",
  expandBtn: 'Expand',
  collapseBtn: 'Collapse',
  ideaLabel: 'Idea',
  explainLabel: 'Why (Logic)',
  exampleLabel: 'Example (Scenario)',
  toastEmptyTopic: 'Please enter an IELTS writing topic first',
  toastSuccess: 'Analysis complete!',
  toastError: 'Analysis failed, please retry',
  examplesTitle: 'Quick try: click an example topic below',
  example1: 'Does remote work improve productivity?',
  example2: 'Government or individuals: who should protect the environment?',
  example3: 'Can free university education promote social mobility?',
};

export const task1Selection: typeof zh.task1Selection = {
  backToWriting: 'Back to Writing Hub',
  heading: '📝 IELTS Task 1 Category Training',
  subheading: 'Please select the Task 1 type you want to focus on',
  types: {
    chart: {
      title: 'Chart Question',
      nameEn: 'Chart',
      desc: 'Exercises covering line, bar, pie charts and tables',
    },
    map: {
      title: 'Map Question',
      nameEn: 'Map',
      desc: 'Describe spatial language such as facility changes and orientation',
    },
    flowchart: {
      title: 'Flowchart',
      nameEn: 'Flowchart',
      desc: 'Describe step-by-step processes like industrial manufacturing',
    },
    random: {
      title: 'Random Selection',
      nameEn: 'Random Selection',
      desc: 'System will randomly pick one from the above three categories',
    },
  },
  beta: 'Beta',
  startBtn: '🚀 Start Training',
  comingSoon: 'Coming Soon: ',
  mapMode: {
    heading: '🗺️ Map generation mode',
    subheading:
      'Pick how the map image is produced — the IELTS question text is always written by the text model you chose above.',
    differencesTitle: 'How they differ',
    svg: {
      badge: 'SVG · Line-art',
      title: 'SVG line-art map',
      summary:
        'Your text AI emits structured JSON; the server renders it into a classic IELTS-style black-and-white schematic map.',
      bullets: [
        'Fully driven by your chosen text AI (DeepSeek / Gemini / GPT-5 etc.)',
        'Visually closest to a real IELTS exam paper (line-art, icons, hatch fills)',
        'Fast, cheap, only consumes the text model AT',
        'Deterministic — no image files stored anywhere',
      ],
      cost: 'AT cost: text model only (usually tens of AT)',
    },
    raster: {
      badge: 'Raster · FLUX.2-pro',
      title: 'FLUX.2-pro raster map',
      summary:
        'The text AI writes the prompt; the actual image is rendered by Azure Black Forest Labs FLUX.2-pro as a PNG.',
      bullets: [
        'Image model is fixed to FLUX.2-pro (independent of your text-AI choice)',
        'Richer, more "illustrated" look — good for irregular layouts',
        'Each image is stored in your bank; deleting the question deletes the file',
        'Diffusion models may slightly misspell labels (known limitation)',
      ],
      cost: 'AT cost: text model + fixed image cost (10,000 AT per image)',
    },
  },
};

export const chartSelection: typeof zh.chartSelection = {
  backToHub: 'Back to Task 1 Selection',
  heading: '📊 Chart Question',
  subheading: 'Choose the chart type for your next Task 1 practice',
  types: {
    line: {
      title: 'Line Graph',
      nameEn: 'Line graph',
    },
    pie: {
      title: 'Pie Chart',
      nameEn: 'Pie chart',
    },
    bar: {
      title: 'Bar Chart',
      nameEn: 'Bar chart',
    },
    horizontal: {
      title: 'Horizontal Chart',
      nameEn: 'Horizontal chart',
    },
    table: {
      title: 'Table',
      nameEn: 'Table/chart',
    },
    mixed: {
      title: 'Mixed Chart',
      nameEn: 'Mixed chart',
    },
    random: {
      title: 'Random',
      nameEn: 'Random',
    },
  },
  startBtn: 'Start Practice',
};

export const task2Selection: typeof zh.task2Selection = {
  backToWriting: 'Back to Writing Hub',
  heading: '🖋️ IELTS Task 2 Category Training',
  subheading: 'Please select the essay structure you want to challenge',
  topicLabel: 'AI Topic Category (Single Choice)',
  topicHint:
    'Random: system picks one regular category and sends it to AI. Innovation: AI invents a new topic category directly.',
  topics: {
    all: 'All',
    education: 'Education',
    technology: 'Technology',
    culture: 'Tradition & Culture',
    urbanization: 'Urbanization & Globalization',
    government: 'Government',
    environment: 'Environment',
    media: 'Media',
    society: 'Social Life',
    abstract: 'Abstract Topics',
    random: 'Random',
    innovation: 'Innovation',
  },
  types: {
    opinion: {
      title: 'Opinion Essay',
      nameEn: 'Opinion Essay',
      desc: 'State your clear position on a social phenomenon (Agree/Disagree etc.)',
    },
    report: {
      title: 'Report',
      nameEn: 'Report',
      desc: 'Analyze causes of a phenomenon and propose solutions (Cause & Solution)',
    },
    mixed: {
      title: 'Mixed Essay',
      nameEn: 'Mixed Essay',
      desc: 'Answer two or more different questions (e.g., Cause + Opinion)',
    },
    random: {
      title: 'Random Selection',
      nameEn: 'Random Selection',
      desc: 'System randomly picks from common IELTS topics and question types',
    },
    innovation: {
      title: 'AI Creative Task',
      nameEn: 'AI Creative Task',
      desc: 'Break the mold! AI examiner generates novel IELTS trend prediction prompts',
    },
  },
  startBtn: '🚀 Get Random Prompt and Start',
};

export const task2OpinionSelection: typeof zh.task2OpinionSelection = {
  backToTask2Selection: 'Back to Task 2 Selection',
  heading: '⚖️ Opinion Essay Sub-topic Practice',
  subheading: 'Please select the specific Opinion derived structure you want to break through',
  types: {
    agree: {
      title: 'Agree/Disagree',
      nameEn: 'Agree/Disagree',
      desc: 'Given a view, asks "To what extent do you agree or disagree?"',
    },
    discuss: {
      title: 'Discuss both views',
      nameEn: 'Discuss both views',
      desc: 'Given two opposing views, asks "Discuss both views and give your opinion"',
    },
    advantages: {
      title: 'Advantages/Disadvantages',
      nameEn: 'Advantages/Disadvantages',
      desc: 'Analyze a practice: "Do the advantages outweigh the disadvantages?"',
    },
    random: {
      title: 'Random Selection',
      nameEn: 'Random Selection',
      desc: 'System will randomly pick from the above opinion structures',
    },
  },
  startBtn: '🚀 Start Sub-topic Quiz',
};

export const task2OpinionDrill: typeof zh.task2OpinionDrill = {
  backToTask2Selection: 'Back to Writing Hub',
  backToSetup: 'Back to Drill Setup',
  heading: '🧠 Opinion Drill Board',
  subheading:
    'Set question count and topics, generate a full round at once, answer one by one, and get a final summary.',
  countLabel: 'Questions per round (1-10)',
  countHint: 'Recommended: 3-5 questions per round.',
  categoriesLabel: 'Topic filters (multi-select)',
  randomHint: 'If none is selected, AI will generate questions randomly.',
  startBtn: '🚀 Start Answering',
  generatingTitle: 'Generating your question set…',
  generatingDesc: 'AI will return the full question array in one response.',
  progress: 'Progress: Question {current} / {total}',
  questionLabel: 'Current Question',
  answerLabel: 'Your Answer',
  answerPlaceholder: 'Write your answer for this question, then submit for evaluation.',
  submitBtn: 'Submit & Evaluate',
  evaluatingTitle: 'Evaluating…',
  currentResultTitle: 'Result for This Question',
  nextQuestionBtn: 'Next Question',
  viewSummaryBtn: 'View Round Summary',
  summaryTitle: 'Round Summary',
  summaryDesc: 'Below are per-question scores and feedback, plus round averages.',
  overallAvg: 'Average Overall',
  grammar: 'Grammar',
  relevance: 'Relevance',
  vocabulary: 'Vocabulary',
  feedback: 'AI Feedback',
  referenceAnswer: 'Reference Answer',
  restartBtn: 'Start Another Round',
  backBtn: 'Back to Task 2',
  emptyAnswer: 'Please enter your answer first',
  startFail: 'Failed to generate the question set',
  evalFail: 'Failed to evaluate this answer',
  countRangeError: 'Question count must be an integer between 1 and 10',
  missingConfig: 'Round setup is missing. Please return to the setup page and start again.',
  wordCount: '{n} words',
  categories: {
    education: 'Education',
    technology: 'Technology',
    culture: 'Tradition & Culture',
    urbanization: 'Urbanization & Globalization',
    government: 'Government',
    environment: 'Environment',
    media: 'Media',
    society: 'Social Life',
    abstract: 'Abstract Topics',
    random: 'Random',
  },
};

export const badExampleTypes: typeof zh.badExampleTypes = {
  wordy: 'Wordy / Empty',
  absolute: 'Overly Absolute',
  superficial: 'Superficial',
  illogical: 'Lacks Persuasion',
  colloquial: 'Overly Colloquial',
  example_dump: 'Example Dumping',
  memorized_template: 'Memorized Template',
  copy_prompt: 'Copying Prompt',
  copied_prompt: 'Copying Prompt',
  unclear_position: 'Unclear Position',
  too_broad: 'Too Broad',
  wordy_background: 'Wordy Background',
  new_idea_in_conclusion: 'New Idea in Conclusion',
  vague_summary: 'Vague Summary',
};

export const writingFull = {
  // Config page
  configTitle: 'Full Writing Set',
  configSubtitle: 'Generate a Task 1 and a Task 2 prompt in one go',
  backToWriting: 'Back to Writing Hub',
  task1Label: 'Task 1 type',
  task2Label: 'Task 2 type',
  task1Types: {
    random: '🎲 Random',
    line: '📈 Line chart',
    bar: '📊 Bar chart',
    pie: '🥧 Pie chart',
    horizontal: '🛶 Horizontal bar',
    table: '🧮 Table',
    mixed: '🔀 Mixed charts',
    flowchart: '⚙️ Process diagram',
    map: '🗺️ Map',
  },
  task2Types: {
    opinion: 'Opinion',
    opinion_agree: 'Agree / disagree',
    opinion_discuss: 'Discuss both views',
    opinion_advantages: 'Advantages vs disadvantages',
    report: 'Report',
    mixed: 'Mixed',
  },
  customNameLabel: 'Custom name (optional)',
  customNamePlaceholder: 'Leave blank for the default title',
  startBtn: 'Generate full set',
  starting: 'Submitting…',
  costNote: 'Each task calls the AI separately and is charged by actual usage. Generation runs in the background — you can leave this page.',
  toastStarted: 'Generation started, hang tight',
  toastStartFail: 'Could not start generation, please retry',
  // Hub page
  hubTitle: 'Full Writing Set',
  hubSubtitle: 'Two prompts, attempted and graded independently — no timer, no fixed order',
  backToBank: '📚 Back to Bank',
  loading: 'Loading…',
  loadFail: 'Failed to load',
  notFound: 'This writing set was not found',
  progress: 'Attempted {answered}/2 · Graded {graded}/2',
  untitled: '(generating)',
  slots: { task1: 'Task 1', task2: 'Task 2' },
  status: {
    generating: '⏳ Generating',
    failed: '⚠️ Generation failed',
    ready: 'Not attempted',
    answered: 'Attempted',
    graded: 'Graded',
  },
  startTaskBtn: 'Start',
  continueBtn: 'Continue',
  viewCorrection: 'View feedback',
};
