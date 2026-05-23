export interface ApiRouteTreeNode {
    name: string;
    attributes?: Record<string, string>;
    children?: ApiRouteTreeNode[];
}

export const apiRouteTree: ApiRouteTreeNode = {
    name: 'API /api/',
    children: [
        {
            name: 'auth',
            attributes: { count: '10', module: 'routeVis.moduleNames.auth' },
            children: [
                { name: 'POST /register', attributes: { handler: 'UserRegistrationView' } },
                { name: 'POST /send-code', attributes: { handler: 'SendVerificationCodeView' } },
                { name: 'POST /login', attributes: { handler: 'CustomLoginView (JWT)' } },
                { name: 'POST /token/refresh', attributes: { handler: 'TokenRefreshView' } },
                { name: 'GET|PUT /profile', attributes: { handler: 'UserProfileView' } },
                { name: 'GET|PUT /settings', attributes: { handler: 'UserSettingsView' } },
                { name: 'POST /avatar', attributes: { handler: 'AvatarUploadView' } },
                { name: 'DELETE /delete-account', attributes: { handler: 'DeleteAccountView' } },
                { name: 'GET|PUT /background', attributes: { handler: 'BackgroundSettingsView' } },
                { name: 'POST /background/image', attributes: { handler: 'BackgroundImageUploadView' } },
            ],
        },
        {
            name: 'balance',
            attributes: { count: '4', module: 'routeVis.moduleNames.balance' },
            children: [
                { name: 'GET /', attributes: { handler: 'get_balance' } },
                { name: 'POST /check', attributes: { handler: 'check_balance' } },
                { name: 'POST /consume', attributes: { handler: 'consume_at' } },
                { name: 'POST /add', attributes: { handler: 'add_at' } },
            ],
        },
        {
            name: 'store',
            attributes: { count: '6', module: 'routeVis.moduleNames.store' },
            children: [
                { name: 'GET /products', attributes: { handler: 'list_products' } },
                { name: 'POST /purchase', attributes: { handler: 'purchase_product' } },
                { name: 'GET /cart/', attributes: { handler: 'cart_list' } },
                { name: 'POST /cart/add', attributes: { handler: 'cart_add' } },
                { name: 'POST /cart/remove', attributes: { handler: 'cart_remove' } },
                { name: 'POST /cart/checkout', attributes: { handler: 'cart_checkout' } },
            ],
        },
        {
            name: 'reading',
            attributes: { count: '1', module: 'routeVis.moduleNames.reading' },
            children: [
                { name: 'POST /generate', attributes: { handler: 'generate_reading' } },
            ],
        },
        {
            name: 'listening',
            attributes: { count: '2', module: 'routeVis.moduleNames.listening' },
            children: [
                { name: 'POST /generate', attributes: { handler: 'generate_listening' } },
                { name: 'POST /audio', attributes: { handler: 'generate_listening_audio' } },
            ],
        },
        {
            name: 'speaking',
            attributes: { count: '14', module: 'routeVis.moduleNames.speaking' },
            children: [
                { name: 'POST /chat', attributes: { handler: 'speaking_chat' } },
                { name: 'POST /transcribe', attributes: { handler: 'speaking_transcribe' } },
                { name: 'POST /check-scenario', attributes: { handler: 'check_scenario' } },
                { name: 'POST /scenario-chat', attributes: { handler: 'scenario_chat' } },
                { name: 'POST /scenario/random', attributes: { handler: 'generate_random_scenario' } },
                { name: 'POST /part1/generate', attributes: { handler: 'generate_part1_questions' } },
                { name: 'POST /part1/evaluate', attributes: { handler: 'evaluate_part1_answer' } },
                { name: 'POST /part1/summary', attributes: { handler: 'generate_part1_summary' } },
                { name: 'POST /part2/generate', attributes: { handler: 'generate_part2_questions' } },
                { name: 'POST /part2/evaluate', attributes: { handler: 'evaluate_part2_answer' } },
                { name: 'POST /part2/summary', attributes: { handler: 'generate_part2_summary' } },
                { name: 'POST /part3/generate', attributes: { handler: 'generate_part3_questions' } },
                { name: 'POST /part3/evaluate', attributes: { handler: 'evaluate_part3_answer' } },
                { name: 'POST /part3/summary', attributes: { handler: 'generate_part3_summary' } },
            ],
        },
        {
            name: 'writing',
            attributes: { count: '7', module: 'routeVis.moduleNames.writing' },
            children: [
                { name: 'POST /generate', attributes: { handler: 'generate_writing' } },
                { name: 'POST /chart/generate', attributes: { handler: 'generate_chart' } },
                { name: 'POST /chart/evaluate', attributes: { handler: 'evaluate_chart' } },
                { name: 'POST /task2/generate', attributes: { handler: 'generate_task2' } },
                { name: 'POST /task2/evaluate', attributes: { handler: 'evaluate_task2' } },
                { name: 'POST /task2/opinion-drill/generate', attributes: { handler: 'generate_opinion_drill_questions' } },
                { name: 'POST /task2/opinion-drill/evaluate', attributes: { handler: 'evaluate_opinion_drill_answer' } },
            ],
        },
        {
            name: 'vocab',
            attributes: { count: '7', module: 'routeVis.moduleNames.fsrs' },
            children: [
                { name: 'POST /sync', attributes: { handler: 'VocabSyncView' } },
                { name: 'GET /cards', attributes: { handler: 'VocabCardsView' } },
                { name: 'POST /review', attributes: { handler: 'VocabReviewView' } },
                { name: 'POST /custom-memory/decks/', attributes: { handler: 'CustomMemoryDeckCreateView' } },
                { name: 'POST /custom-memory/decks/:pk/append/', attributes: { handler: 'CustomMemoryDeckAppendView' } },
                { name: 'POST /custom-memory/decks/:pk/start/', attributes: { handler: 'CustomMemoryDeckStartView' } },
                { name: 'POST /custom-memory/review/', attributes: { handler: 'CustomMemoryReviewView' } },
            ],
        },
        {
            name: 'notebooks',
            attributes: { count: '4', module: 'routeVis.moduleNames.notebooks' },
            children: [
                { name: 'GET|POST /', attributes: { handler: 'NotebookListView' } },
                { name: 'GET|PUT /:pk/', attributes: { handler: 'NotebookDetailView' } },
                { name: 'GET|POST /:pk/words/', attributes: { handler: 'NotebookWordListView' } },
                { name: 'GET|PUT|DELETE /:pk/words/:eid/', attributes: { handler: 'NotebookWordDetailView' } },
            ],
        },
        {
            name: 'plans',
            attributes: { count: '8', module: 'routeVis.moduleNames.plans' },
            children: [
                { name: 'GET|POST /', attributes: { handler: 'PlanListView' } },
                { name: 'GET|PUT|DELETE /:pk/', attributes: { handler: 'PlanDetailView' } },
                { name: 'GET|POST /:pk/words/', attributes: { handler: 'PlanWordListView' } },
                { name: 'GET|PUT|DELETE /:pk/words/:eid/', attributes: { handler: 'PlanWordDetailView' } },
                { name: 'POST /:pk/start/', attributes: { handler: 'PlanStartView' } },
                { name: 'GET /learning-time/today/', attributes: { handler: 'LearningTimeTodayView' } },
                { name: 'GET /vocab/books/', attributes: { handler: 'VocabBookListView' } },
                { name: 'GET /vocab/books/:pk/words/', attributes: { handler: 'VocabBookWordsView' } },
            ],
        },
        {
            name: 'prompts',
            attributes: { count: '3', module: 'routeVis.moduleNames.prompts' },
            children: [
                { name: 'GET /', attributes: { handler: 'prompt_list' } },
                { name: 'POST /:pk/like/', attributes: { handler: 'prompt_like' } },
                { name: 'POST /:pk/favorite/', attributes: { handler: 'prompt_favorite' } },
            ],
        },
        {
            name: 'creative-workshop',
            attributes: { count: '4', module: 'routeVis.moduleNames.creative' },
            children: [
                { name: 'GET /projects/', attributes: { handler: 'CreativeWorkshopProjectListView' } },
                { name: 'POST /projects/generate/', attributes: { handler: 'CreativeWorkshopProjectGenerateView' } },
                { name: 'GET /projects/:pk/', attributes: { handler: 'CreativeWorkshopProjectDetailView' } },
                { name: 'POST /projects/:pk/favorite/', attributes: { handler: 'CreativeWorkshopProjectFavoriteView' } },
            ],
        },
        {
            name: 'assistant',
            attributes: { count: '5', module: 'routeVis.moduleNames.assistant' },
            children: [
                { name: 'POST /personal-chat', attributes: { handler: 'personal_agent_chat' } },
                { name: 'GET /mcp/capabilities', attributes: { handler: 'assistant_mcp_capabilities' } },
                { name: 'POST /mcp/route', attributes: { handler: 'assistant_mcp_route' } },
                { name: 'POST /mcp/open-pages', attributes: { handler: 'assistant_mcp_open_pages' } },
                { name: 'POST /mcp/react-browser', attributes: { handler: 'assistant_mcp_react_browser' } },
            ],
        },
        {
            name: 'admin',
            attributes: { count: '6', module: 'routeVis.moduleNames.admin' },
            children: [
                { name: 'GET /feedback', attributes: { handler: 'AdminFeedbackListView' } },
                { name: 'PATCH /feedback/:pk', attributes: { handler: 'AdminFeedbackUpdateView' } },
                { name: 'DELETE /feedback/:pk/delete', attributes: { handler: 'AdminFeedbackDeleteView' } },
                { name: 'GET /users', attributes: { handler: 'AdminUserListView' } },
                { name: 'PATCH /users/:pk/ban', attributes: { handler: 'AdminUserBanToggleView' } },
                { name: 'DELETE /users/:pk/delete', attributes: { handler: 'AdminUserDeleteView' } },
            ],
        },
        {
            name: 'feedback',
            attributes: { count: '1', module: 'routeVis.moduleNames.feedback' },
            children: [
                { name: 'POST /submit', attributes: { handler: 'FeedbackCreateView' } },
            ],
        },
    ],
};
