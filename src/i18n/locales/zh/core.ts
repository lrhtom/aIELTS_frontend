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
  customPrompt: {
    title: '自定义提示词指令（可选 · 高级）',
    warning: '⚠️ 谨慎使用：自定义指令拥有【最高优先级】，会压过题目内容 / 难度 / 风格等默认设定，可能导致题目跑偏、内容不符合雅思规范或额外消耗 AT。不确定就别开启。（仅输出格式与安全限制不可被覆盖。）',
    ack: '我已了解上述风险，仍要使用',
    placeholder: '例：题目围绕“环境保护”主题；难度对齐雅思 7 分；多用被动语态……',
  },
};

export const components = {
  questionRenderer: {
    typeAnswer: '输入答案…',
    answerRemaining: '回答剩余题目：',
    removeHeading: '移除标题',
    dropHeading: '拖放标题到此处',
    correctIs: '❌（正确答案：{a}）',
    unsupportedType: '暂不支持的题型：{t}，请重新生成或反馈给我们',
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
  customModel: {
    // 下拉选择器
    addOption: '＋ 添加自定义模型',
    customTag: '自定义',
    // 弹窗
    addTitle: '添加自定义模型',
    editTitle: '编辑自定义模型',
    nameLabel: '模型名称',
    namePlaceholder: '例：gpt-4o-mini（将作为请求中的 model 值）',
    urlLabel: '接口链接',
    urlPlaceholder: 'https://api.openai.com/v1/chat/completions',
    keyLabel: 'SK 密钥',
    keyPlaceholder: 'sk-...',
    keyKeepHint: '留空则保持原密钥不变',
    test: '测试',
    testing: '测试中…',
    save: '保存',
    cancel: '取消',
    errName: '请填写模型名称',
    errUrl: '接口链接必须以 http(s):// 开头',
    errKey: '请填写 SK 密钥',
    saveFail: '保存失败',
    // 设置页管理面板
    managerTitle: '自定义模型管理',
    managerDesc: '添加你自己的 OpenAI 兼容模型（自带密钥，调用不消耗 AT）。',
    addBtn: '添加自定义模型',
    empty: '还没有自定义模型',
    edit: '编辑',
    delete: '删除',
    deleteConfirm: '确定删除该自定义模型？',
    deleteFail: '删除失败',
    loadFail: '加载失败',
    // 测试结果（与后端 ping status 对应）
    testOk: '连接正常',
    testAuth: '鉴权失败（密钥或权限有误）',
    testRateLimited: '被限流，请稍后再试',
    testReqError: '端点在线但请求被拒（模型名/参数/链接有误）',
    testError: '连接失败（链接不可达或超时）',
    testUnconfigured: '配置不完整',
    // 帮助面板：常见导入示例
    helpAria: '查看导入示例',
    helpIntro: '本平台支持任意 OpenAI 兼容的 /chat/completions 接口。以下为常见服务的填写示例，点“填入”可一键填充：',
    helpFill: '填入',
    helpNote: '要点：模型名称就是请求里的 model 值；接口链接要填 chat/completions 的完整地址。',
    helpOllamaNote: 'Ollama：先本地运行 ollama serve，SK 可随意填。本平台部署在本机时可直连 localhost；线上部署需让服务器能访问到该地址（公网地址或内网穿透）。',
    pOllama: 'Ollama（本地模型）',
    pOpenai: 'OpenAI',
    pDeepseek: 'DeepSeek',
    pQwen: '通义千问（DashScope 兼容模式）',
    pOpenrouter: 'OpenRouter',
    // 官方模型测试区（设置页面板底部）
    officialTitle: '官方模型测试',
    officialDesc: '测试平台官方模型的连通性。使用平台密钥，测试成功按实际 token 消耗扣 AT（失败不扣费）。',
    officialCostNote: '本次消耗 {n} AT',
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
  estimatedBand: '预估雅思分',
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
