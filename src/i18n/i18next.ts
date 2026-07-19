// i18next 引擎实例（裸 i18next，不接 react-i18next）。
//
// 设计要点：
// - React 的响应式渲染仍由 LanguageContext 负责：切语言时 Context 的 `lang`
//   state 变化触发重渲染，useLang() 内部据此重新取 getFixedT(lang)。i18next 的
//   changeLanguage 本身不会触发 React 重渲染 —— 这正是"裸 i18next 在 React 里能
//   用"的关键：把渲染层留给 Context，把翻译引擎（插值 / 复数 / 回退）交给 i18next。
// - 文案本体沿用现有 locales/<lang>/index.ts 汇总的 zh / en 两棵树，整棵挂到单一
//   命名空间 'translation' 下，键路径 1:1 对应原来的属性访问路径（mock.config.title）。
// - 类型安全靠 i18next.d.ts 的 CustomTypeOptions 增强（resources.translation =
//   typeof zh），t('mock.config.title') 仍有补全、写错 key 仍编译报错。
import i18n from 'i18next';
import { zh } from './locales/zh';
import { en } from './locales/en';
import type { Lang } from './translations';

const saved = localStorage.getItem('ielts_lang');
const initialLng: Lang = saved === 'zh' ? 'zh' : 'en';

// initImmediate: false → 内联资源同步装载，import 后即可 getFixedT，无需 await。
void i18n.init({
    lng: initialLng,
    fallbackLng: 'en',
    resources: {
        zh: { translation: zh },
        en: { translation: en },
    },
    defaultNS: 'translation',
    keySeparator: '.',
    nsSeparator: false, // 单命名空间，键里不含 ':'，关闭 ns 前缀解析更安全
    returnNull: false,
    returnEmptyString: false,
    returnObjects: true, // 数组/对象叶子（如 config.rules.items）原样返回
    initAsync: false, // v26：原 initImmediate:false —— 内联资源同步装载
    interpolation: {
        // React 自身会转义；我们的文案是纯文本，无需 i18next 再转义。
        escapeValue: false,
    },
});

export default i18n;
