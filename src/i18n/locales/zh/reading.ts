// Chinese copy (the type source of truth) - the en side references this file with typeof.

export const readingConfig = {
  backToAI: '返回 AI 练习',
  heading: '阅读练习配置',
  subheading: '定制专属于您的阅读训练材料',
  targetScore: '目标 Band 分数',
  modeToggle: {
    label: '练习模式',
    single: '单一题型',
    full: '综合套题（3 篇 passage）',
  },
  questionType: {
    label: '题型选择',
    groups: {
      choice: '选择题',
      judgement: '判断题',
      matching: '匹配题',
      completion: '填空题',
    },
    multipleChoice: {
      title: '选择题 MCQ',
      desc: '一篇文章 + 5 道 A/B/C/D 单选',
    },
    trueFalse: {
      title: 'True/False/Not Given',
      desc: '判断陈述句是否符合原文事实',
    },
    yesNo: {
      title: 'Yes/No/Not Given',
      desc: '判断陈述句是否符合作者观点',
    },
    matchingHeadings: {
      title: '段落配标题',
      desc: '给每个段落从标题池中挑选主旨',
    },
    matchingInfo: {
      title: '信息在哪段',
      desc: '判断每条信息出现在哪个段落',
    },
    matchingFeatures: {
      title: '特征匹配',
      desc: '把陈述归类到人物 / 理论 / 类别',
    },
    matchingSentence: {
      title: '句子头尾配对',
      desc: '给句首选择对应的句尾',
    },
    sentenceCompletion: {
      title: '句子填空',
      desc: '按原文原词补全独立句子',
    },
    summaryCompletion: {
      title: '摘要填空',
      desc: '一段摘要 + 词库选空',
    },
    noteCompletion: {
      title: '笔记/表格/流程填空',
      desc: '按结构化布局补全笔记',
    },
    shortAnswer: {
      title: '简答题',
      desc: '按原文原词回答 wh- 问题',
    },
  },
  judgementMode: {
    label: '判断题模式',
    easy: {
      title: '简单模式（True / False）',
      desc: '只提供 True 与 False 两个选项。',
    },
    normal: {
      title: '正常模式（True / False / Not Given）',
      desc: '提供 True、False、Not Given 三个选项。',
    },
  },
  wordCount: {
    label: '答案词数上限',
    min: '最少',
    max: '最多',
    hintExact: '恰好 {n} 个词',
    hintRange: '{min}-{max} 个词',
  },
  topic: {
    label: '话题选择',
    desc: '指定文章主题；不选则从题材池随机抽取',
    random: '随机（默认）',
    list: {
      archaeology: '考古与古文明',
      marine_biology: '海洋生物与生态',
      urban_planning: '城市规划',
      language: '语言习得与语言学',
      climate: '气候变化与环境',
      trade_history: '古代贸易与经济史',
      cognition: '认知科学与记忆',
      renewable_energy: '可再生能源技术',
      food_history: '食物与农业史',
      space: '太空探索与天文',
      animal_behaviour: '动物行为学',
      architecture: '建筑史',
      social_psychology: '社会心理学',
      education: '教育改革',
      medicine_history: '医学史与公共卫生',
      anthropology: '文化人类学',
      geology: '地质与地球科学',
      transport: '交通与出行创新',
      music_history: '音乐与乐器史',
      psychology_work: '职场心理学',
    } as Record<string, string>,
  },
  fullTest: {
    title: '综合套题',
    desc: '3 篇 passage，每篇 ~13 题，总共 40 题；混合多种题型',
    summary: '3 篇文章 · 40 题 · 60 分钟',
    startBtn: '开始综合套题',
    scope: {
      label: '生成范围',
      all: '全部 3 篇',
      single: '只生成 1 篇',
    },
    singlePassage: {
      label: '选择文章',
      p1: 'Passage 1（较易）',
      p2: 'Passage 2（中等）',
      p3: 'Passage 3（较难）',
    },
    singleMix: {
      label: '题型组合',
      desc: '勾选 2-3 种题型；不选则用系统预设组合',
      clear: '清空',
    },
  },
  customVocab: {
    label: '使用您的专属词汇库',
    desc: '开启后，AI 将在文章中优先融入您提供的信息',
  },
  absurdMode: {
    label: '🎭 荒唐模式',
    desc: '开启后，AI 生成的文章将充满有趣的笑话，帮助记忆',
  },
  startBtn: '开始生成文章',
  toast: {
    noVocab: '请先输入一些目标词汇',
  },
};

export const readingDetails = {
  dictionary: '词典',
  questions: '题目',
  questionsMcq: '题目（选择题）',
  questionsTrueFalseEasy: '题目（判断题：True / False）',
  questionsTrueFalseNormal: '题目（判断题：True / False / Not Given）',
  time: '耗时',
  hideTargets: '隐藏目标词',
  showTargets: '显示目标词',
  submitConfirm: '您还有未完成的题目，确定要交卷吗？',
  writingPassage: 'AI 正在为您编写雅思阅读文章...',
  // Landing copy for opening or refreshing /reading with no generation config
  noConfigTitle: '还没有可做的阅读题',
  noConfigDesc: '阅读练习需要先在配置页选好词汇、难度和题型再生成。直接打开这个网址不会自动出题，以免误消耗 AT。',
  noConfigGoConfig: '去配置并生成',
  noConfigGoBank: '从题库选一套',
  searchPlaceholder: '🔍 搜索单词或释义...',
  underline: '下划线',
  submitBtn: '提交答案',
  absurdMode: '🎭 荒唐模式',
  absurdModeOn: '开',
  absurdModeOff: '关',
  toastReqFail: '请求失败',
  toastSaveFail: '保存作答失败，但本次成绩已显示',
  exitConfirm: '确定要退出练习吗？未提交的进度可能会丢失',
  exitBtn: '退出练习',
  questionNav: {
    jumpTo: '跳转到第 {n} 题',
    progress: '{answered} / {total}',
    barLabel: '题号导航',
  },
};
