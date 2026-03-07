// word_selection_store — 仅导出词汇输入的初始值（localStorage 读取）
// 页面组件中用 useState 管理
export function getInitialVocabInput(): string {
    return localStorage.getItem('ielts_target_vocab') ?? '';
}
