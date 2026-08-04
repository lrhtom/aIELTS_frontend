// word_selection_store - only exports the initial value of the vocabulary input (read from localStorage)
// the page component manages it with useState
export function getInitialVocabInput(): string {
    return localStorage.getItem('ielts_target_vocab') ?? '';
}
