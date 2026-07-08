// 中文文案（类型真源）— en 侧以 typeof 引用本文件。

export const navbar = {
  goals: {
    noGoal: '暂无目标',
    countdown: '🎯 距离考试时间 {date} 还有 {days} 天 | 目标 {score} 分',
    examDay: '🎯 今天是考试日，祝你屠鸭成功！ 🎉 | 目标 {score} 分',
    examPassed: '🎯 恭喜上岸！ 🎉 | 目标 {score} 分',
  },
};

export const nav = {
  home: '主页',
  practice: '练习',
  settings: '设置',
  prompts: 'AI 提示词',
  collapse: '收起',
  vocab: '背单词',
  sidebarTitle: '导航',
  store: '商店',
  workshop: '创意工坊',
  feedback: '报告反馈',
  notebook: '笔记',
};

export const common = {
  back: '返回',
  confirm: '确定',
  cancel: '取消',
  save: '保存',
  saving: '保存中...',
  saved: '已保存',
  error: '错误',
  loading: '加载中...',
  home: '主页',
  underline: '下划线',
  optional: '可选',
  planImport: {
    placeholder: '-- 选择学习计划导入今日单词 --',
    importing: '导入中...',
    btn: '⬇ 导入今日单词',
    noWords: '该计划今日暂无待学单词',
    failed: '导入失败',
    success: '已导入 {n} 个单词',
    skipped: '已导入 {n} 个单词，{s} 个因缺少中文释义被跳过',
  },
  customQuestion: {
    sectionTitle: '自定义题目',
    sectionDesc: '可选。留空则使用 AI 默认题目名，题库卡不显示简介。',
    nameLabel: '题目名称',
    namePlaceholder: '例：家庭教育 · 单选 · 6.5',
    descLabel: '简介',
    descPlaceholder: '例：本套题围绕教育话题，用于本周复习',
  },
};

export const components = {
  questionRenderer: {
    typeAnswer: '输入答案…',
    answerRemaining: '回答剩余题目：',
    removeHeading: '移除标题',
    dropHeading: '拖放标题到此处',
    correctIs: '❌（正确答案：{a}）',
  },
  vocabInput: {
    label: '已添加词汇',
    invalidLines: '行格式有误',
    placeholder: 'ubiquitous - 普遍存在的\nmitigate - 减轻\nephemeral - 短暂的\n\n每行一个词，格式：单词 - 释义',
    formatDesc: '每行一个，格式：单词 - 中文释义，每行必须同时包含英文和中文',
    toastHint: '格式有误，需同时包含英文单词和中文释义',
  },
  aiModel: {
    label: 'AI 模型',
    desc: '选择后台出题和批改所使用的引擎',
  },
  toast: {
    errorTitle: '异常',
  },
};

export const results = {
  analysis: '结果分析与解析',
  originalPassage: '原文回顾',
  hidePassage: '隐藏原文',
  showPassage: '显示原文',
  targetVocab: '目标词汇',
  yourAnswer: '您的答案',
  correctAnswer: '正确答案',
  acceptableAnswers: '可接受的答案',
  statusCorrect: '正确',
  statusIncorrect: '错误',
  explanation: '解析',
};

export const billing = {
  insufficientBalance: 'AT币余额不足',
  checkingBalance: '检查AT币余额...',
  estimateCost: '本次{service}练习需要消耗约 <strong>{estimatedCost} AT币</strong>。',
  currentBalance: '您的当前余额为 <strong>{balance} AT币</strong>。',
  goToRecharge: '前往充值',
  tryAnyway: '尝试使用',
  consumedToast: '消耗 {n} AT币',
  refundToast: '抱歉，AI操作失败，已退还 {n} AT币',
  needMoreBalance: '{message} (需要{required} AT，当前{current} AT)',
  requestFailed: '请求失败',
  estimatedShort: '预估AT币余额不足',
};

export const chromeOnlyGuard = {
  warningTitle: '浏览器兼容性提示：',
  warningDesc: '推荐使用 Chrome 浏览器以获得完整语音体验。',
  copyUrl: '📋 复制网址',
};

export const errorBoundary = {
  heading: '页面发生错误',
  hint: '请刷新页面或联系技术支持。',
};
