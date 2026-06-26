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
            attributes: { component: 'HomePage', guard: 'routeVis.guards.public' },
        },
        {
            name: '/login',
            attributes: { component: 'LoginPage', guard: 'routeVis.guards.public' },
        },
        {
            name: '/register',
            attributes: { component: 'RegisterPage', guard: 'routeVis.guards.public' },
        },
        {
            name: 'vocabulary',
            attributes: { module: 'routeVis.moduleNames.vocabulary' },
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
            attributes: { module: 'routeVis.moduleNames.practice' },
            children: [
                { name: '/practice', attributes: { component: 'PracticeHub', guard: 'Protected' } },
                { name: '/practice/ai', attributes: { component: 'AIPractice', guard: 'Protected' } },
                { name: '/practice/ai/reading', attributes: { component: 'WordSelection_page', guard: 'Protected' } },
                { name: '/practice/ai/listening', attributes: { component: 'ListeningConfig', guard: 'Protected' } },
            ],
        },
        {
            name: 'speaking',
            attributes: { module: 'routeVis.moduleNames.speaking' },
            children: [
                { name: '/speaking', attributes: { component: 'Speaking', guard: 'Protected' } },
                { name: '/speaking/chat', attributes: { component: 'SpeakingChatPage', guard: 'Protected', lazy: 'true' } },
                { name: '/speaking/summary', attributes: { component: 'SpeakingSummaryPage', guard: 'Protected' } },
            ],
        },
        {
            name: 'writing',
            attributes: { module: 'routeVis.moduleNames.writing' },
            children: [
                { name: '/writing', attributes: { component: 'Writing_page', guard: 'Protected' } },
                { name: '/writing/chat-config', attributes: { component: 'WritingChatConfigPage', guard: 'Protected' } },
                { name: '/writing/chat', attributes: { component: 'WritingChatPage', guard: 'Protected', lazy: 'true' } },
                { name: '/writing/correction', attributes: { component: 'WritingCorrectionPage', guard: 'Protected' } },
                { name: '/writing/task1', attributes: { component: 'Task1SelectionPage', guard: 'Protected' } },
                { name: '/writing/task2', attributes: { component: 'Task2SelectionPage', guard: 'Protected' } },
                { name: '/writing/task2/opinion', attributes: { component: 'Task2OpinionSelectionPage', guard: 'Protected' } },
                { name: '/writing/task2/opinion-drill', attributes: { component: 'Task2OpinionDrillPage', guard: 'Protected' } },
                { name: '/writing/task2/opinion-drill/generating', attributes: { component: 'Task2OpinionDrillGeneratingPage', guard: 'Protected' } },
                { name: '/writing/task2/opinion-drill/doing', attributes: { component: 'Task2OpinionDrillDoingPage', guard: 'Protected' } },
                { name: '/writing/task2/doing', attributes: { component: 'Task2PracticePage', guard: 'Protected' } },
                { name: '/writing/chart', attributes: { component: 'Navigate→/writing/task1', guard: 'Redirect' } },
                { name: '/writing/chart/doing', attributes: { component: 'ChartPracticePage', guard: 'Protected' } },
            ],
        },
        {
            name: 'creative-workshop',
            attributes: { module: 'routeVis.moduleNames.creative' },
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
