// 中文文案（类型真源）— en 侧以 typeof 引用本文件。

export const home = {
  hero: {
    title: '掌握雅思，从 aIELTS 开始',
    subtitle: 'AI 驱动的一站式雅思学习平台，助您突破语言瓶颈，实现留学梦想。',
    subsubtitle: 'AI 驱动的雅思全科练习平台',
    startPractice: '开始练习',
    vocab: '词汇学习',
  },
  skills: {
    heading: '全科覆盖，精准提升',
    items: [
      {
        title: '阅读',
        desc: 'AI 生成雅思阅读文章与题目，智能定位答案句，逐题解析。',
        link: '/practice/ai/reading',
      },
      {
        title: '听力',
        desc: 'AI 生成听力音频与配套题目，支持多种口音和场景模拟。',
        link: '/practice/ai/listening',
      },
      {
        title: '口语',
        desc: 'AI 语音对话练习，实时转录与评分，覆盖 Part 1-3 全部题型。',
        link: '/speaking',
      },
      {
        title: '写作',
        desc: 'Task 1 图表题 + Task 2 议论文，AI 批改打分，给出修改建议。',
        link: '/writing',
      },
    ],
  },
  howItWorks: {
    heading: '三步开始学习',
    steps: [
      {
        title: '选择技能',
        desc: '根据目标选择阅读、听力、口语或写作进行专项练习',
      },
      {
        title: 'AI 生成内容',
        desc: 'AI 根据雅思考纲智能生成个性化练习题和模拟测试',
      },
      {
        title: '练习并获得反馈',
        desc: '完成练习后获得 AI 详细评分、错题解析和提升建议',
      },
    ],
  },
  announcements: {
    heading: '最新动态',
    items: [
      {
        date: '2026-07-09',
        tag: '新功能',
        content: 'AI 题库与单词计划支持「收藏」，收藏内容自动置顶，常用练习一键直达。',
      },
      {
        date: '2026-07-06',
        tag: '优化',
        content: '学习计划详情页焕新布局，单词列表独立滚动，管理更顺手。',
      },
      {
        date: '2026-07-03',
        tag: '新功能',
        content: 'Task 1 小作文新增「地图题」智能出题，AI 生成清晰地图，覆盖更全面。',
      },
    ],
  },
  footer: '© 2026 aIELTS. All rights reserved.',
  footerFeedback: '反馈建议',
  footerManual: '使用手册',
  checkin: {
    heading: '每日签到',
    todayLabel: '今日签到',
    streakLabel: '连续签到',
    totalLabel: '累计签到',
    rewardLabel: '今日奖励 AT',
    btnCheckin: '📋 签到领 AT 币',
    btnChecking: '签到中...',
    btnDone: '今日已签到 ✓',
    errorToast: '签到失败，请稍后重试',
    milestoneHint: '还有 {remain} 天到达 {next} 天里程碑！',
    rules: '签到奖励：每日 1,000 AT | 7 天 +1 万 | 30 天 +3 万 | 100 天 +10 万 | 365 天 +100 万 | 1000 天 +1000 万',
  },
};

export const practiceHub = {
  backToHome: '返回主页',
  heading: '雅思题库',
  subheading: '选择您的练习模式，开启高效提分之旅',
  realPractice: {
    title: '历年真题/模拟题',
    desc: '挑战雅思历年经典真题，还原真实考试体验。',
  },
  aiPractice: {
    title: 'AI 个性化练习',
    desc: '利用 AI 技术，针对您的弱项进行智能出题与分析。',
  },
  comingSoon: '更多练习模式正在开发中，敬请期待...',
};
