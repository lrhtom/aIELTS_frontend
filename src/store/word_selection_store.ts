import { reactive } from '../utils/reactive';

export const wordSelectionStore = reactive({
    vocabInput: localStorage.getItem('ielts_target_vocab') ?? '',
});
