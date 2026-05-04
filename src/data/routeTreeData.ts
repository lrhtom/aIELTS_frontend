export interface RouteTreeNode {
    name: string;
    attributes?: Record<string, string>;
    children?: RouteTreeNode[];
}

export const frontendRouteTree: RouteTreeNode = {
    name: 'aIELTS Routes',
    children: [
        {
            name: '/',
            attributes: { component: 'HomePage', guard: '公开' },
        },
        {
            name: '/login',
            attributes: { component: 'LoginPage', guard: '公开' },
        },
        {
            name: '/register',
            attributes: { component: 'RegisterPage', guard: '公开' },
        },
        {
            name: 'vocabulary',
            attributes: { module: '词汇学习' },
            children: [
                { name: '/vocabulary', attributes: { component: 'VocabularyPracticePage', guard: 'Protected' } },
                { name: '/vocabulary/practice', attributes: { component: 'VocabularyTrainingPage', guard: 'Protected' } },
                { name: '/vocabulary/practice/:mode/doing', attributes: { component: 'VocabularyTrainingDoingPage', guard: 'Protected', lazy: 'true' } },
                { name: '/vocabulary/custom-cards', attributes: { component: 'CustomMemoryCreatePage', guard: 'Protected' } },
                { name: '/vocabulary/custom-cards/study', attributes: { component: 'CustomMemoryStudyPage', guard: 'Protected' } },
                { name: '/vocabulary/custom-cards/result', attributes: { component: 'CustomMemoryResultPage', guard: 'Protected' } },
                { name: '/vocabulary/flashcard → /vocabulary/plans', attributes: { component: 'Navigate(redirect)', guard: '—' } },
                { name: '/vocabulary/flashcard/doing', attributes: { component: 'VocabularyFlashcardDoingPage', guard: 'Protected', lazy: 'true' } },
                { name: '/vocabulary/notebook', attributes: { component: 'NotebookListPage', guard: 'Protected' } },
                { name: '/vocabulary/notebook/:id', attributes: { component: 'NotebookDetailPage', guard: 'Protected', lazy: 'true' } },
                { name: '/vocabulary/plans', attributes: { component: 'LearningPlanListPage', guard: 'Protected' } },
                { name: '/vocabulary/plans/:id', attributes: { component: 'LearningPlanDetailPage', guard: 'Protected', lazy: 'true' } },
                { name: '/vocabulary/books', attributes: { component: 'VocabBookListPage', guard: 'Protected' } },
                { name: '/vocabulary/books/:id', attributes: { component: 'VocabBookDetailPage', guard: 'Protected' } },
            ],
        },
        {
            name: 'practice',
            attributes: { module: '练习中心' },
            children: [
                { name: '/practice', attributes: { component: 'PracticeHub', guard: 'Protected' } },
                { name: '/practice/ai', attributes: { component: 'AIPractice', guard: 'Protected' } },
                { name: '/practice/ai/reading', attributes: { component: 'WordSelection_page', guard: 'Protected' } },
                { name: '/practice/ai/listening', attributes: { component: 'ListeningConfig', guard: 'Protected' } },
            ],
        },
        {
            name: 'speaking',
            attributes: { module: '口语' },
            children: [
                { name: '/speaking', attributes: { component: 'Speaking', guard: 'Protected' } },
                { name: '/speaking/chat', attributes: { component: 'SpeakingChatPage', guard: 'Protected', lazy: 'true' } },
                { name: '/speaking/summary', attributes: { component: 'SpeakingSummaryPage', guard: 'Protected' } },
            ],
        },
        {
            name: 'writing',
            attributes: { module: '写作' },
            children: [
                { name: '/writing', attributes: { component: 'Writing_page', guard: 'Protected' } },
                { name: '/writing/correction', attributes: { component: 'WritingCorrectionPage', guard: 'Protected' } },
                { name: '/writing/task1', attributes: { component: 'Task1SelectionPage', guard: 'Protected' } },
                { name: '/writing/task2', attributes: { component: 'Task2SelectionPage', guard: 'Protected' } },
                { name: '/writing/task2/opinion', attributes: { component: 'Task2OpinionSelectionPage', guard: 'Protected' } },
                { name: '/writing/task2/opinion-drill', attributes: { component: 'Task2OpinionDrillPage', guard: 'Protected' } },
                { name: '/writing/task2/opinion-drill/generating', attributes: { component: 'Task2OpinionDrillGeneratingPage', guard: 'Protected' } },
                { name: '/writing/task2/opinion-drill/doing', attributes: { component: 'Task2OpinionDrillDoingPage', guard: 'Protected' } },
                { name: '/writing/task2/doing', attributes: { component: 'Task2PracticePage', guard: 'Protected' } },
                { name: '/writing/chart', attributes: { component: 'ChartSelectionPage', guard: 'Protected' } },
                { name: '/writing/chart/doing', attributes: { component: 'ChartPracticePage', guard: 'Protected' } },
            ],
        },
        {
            name: 'creative-workshop',
            attributes: { module: '创意工坊' },
            children: [
                { name: '/creative-workshop', attributes: { component: 'CreativeWorkshopPage', guard: 'Protected' } },
                { name: '/creative-workshop/favorites', attributes: { component: 'CreativeWorkshopFavoritesPage', guard: 'Protected' } },
                { name: '/creative-workshop/pages/:id', attributes: { component: 'CreativeWorkshopPreviewPage', guard: 'Protected' } },
            ],
        },
        { name: '/profile', attributes: { component: 'ProfilePage', guard: 'Protected' } },
        { name: '/settings', attributes: { component: 'SettingsPage', guard: 'Protected' } },
        { name: '/prompts', attributes: { component: 'PromptPage', guard: 'Protected' } },
        { name: '/store', attributes: { component: 'StorePage', guard: 'Protected' } },
        { name: '/reading', attributes: { component: 'Reading_page', guard: 'Protected' } },
        { name: '/listening', attributes: { component: 'ListeningPage', guard: 'Protected' } },
    ],
};
