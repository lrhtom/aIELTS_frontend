// i18n 公共入口 — 文案本体按「语言 × 页面」存放在 ./locales/<lang>/<module>.ts
// - zh 是类型真源：Translations = typeof zh，en(及未来语言)靠 typeof 约束，漏 key 即编译错误
// - 新增一门语言：复制 locales/zh/ 目录结构并翻译 → Lang 联合类型加成员 → translations 注册一行
// - 组件消费方式不变：useLang() → t.<namespace>.<key>
import { zh } from './locales/zh';
import { en } from './locales/en';

export type Lang = 'zh' | 'en';

export type Translations = typeof zh;

export const translations: Record<Lang, Translations> = { zh, en };
