// i18next 类型增强 —— 让 t('mock.config.title') 拥有键补全 + 编译期校验。
// resources.translation 直接复用类型真源 Translations(= typeof zh)，因此
// 迁移到函数式 t() 后仍保留原自研系统"漏 key 即编译错误"的核心保证。
import 'i18next';
import type { Translations } from './translations';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        resources: {
            translation: Translations;
        };
        returnNull: false;
    }
}
