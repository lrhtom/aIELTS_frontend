with open('src/api/learning_plan.ts', 'r', encoding='utf-8') as f:
    code = f.read()

new_api = '''
// ──────────────────────────────────────────────────────────────────────────────
// Story Mode API
// ──────────────────────────────────────────────────────────────────────────────

export interface StoryModeData {
    story_title: string;
    story_text: string;
    clicked_words: string[];
    target_words: string[];
    article_boundaries?: Array<{
        start: number;
        end: number;
        title: string;
    }>;
    cached: boolean;
    atConsumed?: number;
}

export interface StoryModeCompleteResult {
    marked_count: number;
    due_map: Record<string, string>;
}

export async function getStoryMode(
    planId: number,
    refresh?: boolean,
    signal?: AbortSignal,
): Promise<StoryModeData> {
    const resp = await apiClient.get(`/plans/${planId}/story-mode/`, {
        params: refresh ? { refresh: 'true' } : {},
        timeout: 130_000,
        signal,
    });
    return resp.data;
}

export async function completeStoryMode(
    planId: number,
    reviewDays: number,
): Promise<StoryModeCompleteResult> {
    const resp = await apiClient.post(`/plans/${planId}/story-mode/complete/`, {
        reviewDays: reviewDays,
    });
    return resp.data;
}

export async function saveStoryModeProgress(
    planId: number,
    clickedWords: string[],
): Promise<void> {
    await apiClient.post(`/plans/${planId}/story-mode/save/`, {
        clicked_words: clickedWords,
    });
}
'''
if 'export interface StoryModeData' not in code:
    with open('src/api/learning_plan.ts', 'a', encoding='utf-8') as f:
        f.write(new_api)
    print("Added Story Mode API")
