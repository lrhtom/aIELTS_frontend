import { useEffect, useState } from 'react';
import { listVocabBooks, listBookWords } from '../api/learning_plan';
import type { VocabCard } from '../api/vocab';
import {
    LIUHONGBO_BOOK_KEYWORDS,
    pickUniqueZh,
    shuffleArray,
    type StudyMode,
} from '../utils/vocab_flashcard_utils';

interface UseChoiceOptionsArgs {
    mode: StudyMode;
    cards: VocabCard[];
    queue: number[];
    visitKey: number;
}

export interface ChoiceOption {
    zh: string;
    correct: boolean;
}

/**
 * Owns the "刘洪波雅思真经" distractor pool + per-card choice generation
 * for the 4选1 mode. Only re-runs when the visible card changes.
 */
export function useChoiceOptionsPool({
    mode,
    cards,
    queue,
    visitKey,
}: UseChoiceOptionsArgs): ChoiceOption[] {
    const [liuhongboZhPool, setLiuhongboZhPool] = useState<string[]>([]);
    const [liuhongboLoaded, setLiuhongboLoaded] = useState(false);
    const [choices, setChoices] = useState<ChoiceOption[]>([]);

    useEffect(() => {
        if (mode !== 'choice' || liuhongboLoaded) return;

        let cancelled = false;

        const loadLiuhongboPool = async () => {
            try {
                const { books } = await listVocabBooks();
                const targetBook = books.find((book) => {
                    const normalized = `${book.name} ${book.description}`.toLowerCase();
                    return LIUHONGBO_BOOK_KEYWORDS.some((keyword) =>
                        normalized.includes(keyword.toLowerCase()),
                    );
                });

                if (!targetBook) return;

                const { words } = await listBookWords(targetBook.id, 1, 5000);
                const pool = Array.from(
                    new Set(
                        words
                            .map((item) => (item.zh_brief ?? '').trim())
                            .filter((item) => !!item),
                    ),
                );

                if (!cancelled) {
                    setLiuhongboZhPool(pool);
                }
            } catch (error) {
                console.warn('[词汇学习] 加载刘洪波词书干扰项失败，继续使用本地选项池', error);
            } finally {
                if (!cancelled) {
                    setLiuhongboLoaded(true);
                }
            }
        };

        loadLiuhongboPool();

        return () => {
            cancelled = true;
        };
    }, [mode, liuhongboLoaded]);

    useEffect(() => {
        if (mode !== 'choice' || !cards.length || queue.length === 0) return;
        const ci = queue[0];
        const current = cards[ci];
        if (!current) return;

        const currentZh = (current.zh ?? '').trim();
        const excludedZh = new Set<string>();
        if (currentZh) excludedZh.add(currentZh);

        const localZhPool = cards
            .filter((_, i) => i !== ci && !!_.zh)
            .map((card) => card.zh.trim());

        const wrongFromLocal = pickUniqueZh(localZhPool, excludedZh, 3);
        wrongFromLocal.forEach((zh) => excludedZh.add(zh));

        const wrongFromLiuhongbo = pickUniqueZh(
            liuhongboZhPool,
            excludedZh,
            Math.max(0, 3 - wrongFromLocal.length),
        );
        wrongFromLiuhongbo.forEach((zh) => excludedZh.add(zh));

        const wrong3 = [...wrongFromLocal, ...wrongFromLiuhongbo];

        const opts = shuffleArray<ChoiceOption>([
            { zh: currentZh || current.zh, correct: true },
            ...wrong3.map((zh) => ({ zh, correct: false })),
        ]);

        setChoices(opts);
    }, [visitKey, mode, cards, queue, liuhongboZhPool]);

    return choices;
}
