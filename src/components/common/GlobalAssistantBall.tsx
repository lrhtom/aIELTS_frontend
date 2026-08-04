import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

import translate from 'translate';
import { cancelSpeak, speakText as speakTextUtil, speakWord } from '../../utils/speak';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiClient, fetchStream, assistantApi } from '../../api/client';
import { checkinApi } from '../../api/checkin';
import { useLang } from '../../i18n/LanguageContext';
import type { TFunction } from 'i18next';

async function readSseStream(
    response: Response,
    onMessage: (data: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
) {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const flushSseEvent = (rawEvent: string) => {
        const eventText = String(rawEvent || '').trim();
        if (!eventText) {
            return;
        }

        const dataLines: string[] = [];
        for (const rawLine of eventText.split(/\r?\n/)) {
            if (!rawLine || rawLine.startsWith(':')) {
                continue;
            }

            if (rawLine.startsWith('data:')) {
                dataLines.push(rawLine.slice(5).trimStart());
            }
        }

        const payload = (dataLines.length > 0 ? dataLines.join('\n') : eventText).trim();
        if (!payload || payload === '[DONE]') {
            return;
        }

        let parsed: any; // eslint-disable-line @typescript-eslint/no-explicit-any
        try {
            parsed = JSON.parse(payload);
        } catch (e) {
            console.warn('SSE JSON parse error', e, payload);
            return;
        }

        // Errors from the business callback must propagate, or they get swallowed as JSON parse errors.
        onMessage(parsed);
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() || '';

            for (const rawEvent of events) {
                flushSseEvent(rawEvent);
            }
        }

        const tail = buffer.trim();
        if (tail) {
            flushSseEvent(tail);
        }
    } finally {
        reader.releaseLock();
    }
}
import { showToast } from './Toast';
import '../../styles/global_assistant_ball.css';

type DockSide = 'left' | 'right' | null;
type AssistantAction = 'translate' | 'personal-agent' | 'todo' | 'shortcuts' | null;
type TranslateEngine = 'google' | 'deepl' | 'libre' | 'yandex';

interface BrowserSpeechRecognitionResultAlternative {
    transcript?: string;
}

interface BrowserSpeechRecognitionResultEntry {
    [index: number]: BrowserSpeechRecognitionResultAlternative | undefined;
    0?: BrowserSpeechRecognitionResultAlternative;
    isFinal?: boolean;
    length?: number;
}

interface BrowserSpeechRecognitionEventLike {
    results?: ArrayLike<BrowserSpeechRecognitionResultEntry>;
    // Index of the first result that changed in this event; in continuous mode
    // `results` is cumulative, so only entries from here on are new.
    resultIndex?: number;
}

interface BrowserSpeechRecognitionErrorEventLike {
    error?: string;
}

interface BrowserSpeechRecognitionInstance {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives?: number;
    onresult: ((event: BrowserSpeechRecognitionEventLike) => void) | null;
    onerror: ((event: BrowserSpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognitionInstance;

interface Position {
    x: number;
    y: number;
}

interface DragState {
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
}

interface PersonalAgentProfile {
    name: string;
    role: string;
    goal: string;
    style: string;
}

interface AgentChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface AgentStep {
    id: string;
    type: 'thinking' | 'action' | 'observation' | 'final' | 'error';
    step?: number;
    action?: string;
    params?: Record<string, string>;
    reason?: string;
    summary?: string;
    reply?: string;
    status?: string;
}

interface AssistantMcpOpenPagesResponse {
    handled?: boolean;
    action?: 'list_all_pages' | 'open_page' | string;
    navigate_to?: string | null;
    reply?: string;
}

type AssistantRouteMode = 'direct' | 'open_pages' | 'react_agent';

interface AssistantMcpRouteResponse {
    handled?: boolean;
    mode?: AssistantRouteMode | string;
    reason?: string;
    confidence?: number;
}

interface AssistantMcpCapabilities {
    route?: {
        enabled?: boolean;
        modes?: string[];
    };
    open_pages?: {
        enabled?: boolean;
        rate_limit?: {
            max_calls?: number;
            window_seconds?: number;
        };
    };
    react_agent?: {
        enabled?: boolean;
        max_steps?: number;
        session_ttl_seconds?: number;
        tools?: string[];
    };
    dom_context?: {
        supported?: boolean;
        max_elements?: number;
        max_text_chars?: number;
        max_selector_chars?: number;
    };
}

interface AssistantMcpCapabilitiesResponse {
    handled?: boolean;
    capabilities?: AssistantMcpCapabilities;
    mcp?: {
        version?: string;
        endpoint?: string;
        request_id?: string;
    };
}

interface DomContextElement {
    tag: string;
    selector: string;
    role?: string;
    text?: string;
    attrs: Record<string, string>;
}

interface TodoItem {
    id: string | number;
    text: string;
    done: boolean;
    createdAt: number;
}

interface ShortcutItem {
    id: string | number;
    title: string;
    url: string;
    createdAt: number;
    openInNewTab?: boolean;
}

interface DomContextPayload {
    url: string;
    title: string;
    path: string;
    viewport: {
        width: number;
        height: number;
    };
    activeSelector: string | null;
    elements: DomContextElement[];
}

const BALL_SIZE = 56;
const EDGE_PEEK = 14;
const EDGE_DETECT = 52;
const EDGE_REVEAL_GAP = 8;
const SAFE_PADDING = 12;
const PERSONAL_AGENT_STORAGE_KEY = 'aielts.personal_agent_profile_v1';
const AGENT_MESSAGE_COLLAPSE_THRESHOLD = 280;
const DOM_CONTEXT_MAX_ELEMENTS = 120;
const DOM_CONTEXT_MAX_TEXT = 120;
const DOM_CONTEXT_MAX_SELECTOR = 220;

const SUPPORTED_TRANSLATE_ENGINES: TranslateEngine[] = ['google', 'deepl', 'libre', 'yandex'];
const configuredTranslateEngine = import.meta.env.VITE_TRANSLATE_ENGINE as TranslateEngine | undefined;
translate.engine = configuredTranslateEngine && SUPPORTED_TRANSLATE_ENGINES.includes(configuredTranslateEngine)
    ? configuredTranslateEngine
    : 'google';
translate.cache = 30 * 60 * 1000;

const configuredTranslateKey = import.meta.env.VITE_TRANSLATE_KEY as string | undefined;
if (configuredTranslateKey) {
    translate.key = configuredTranslateKey;
}

function getViewportSize() {
    if (typeof window === 'undefined') {
        return { width: 1280, height: 720 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function getDockedX(side: Exclude<DockSide, null>, isRevealed: boolean, viewportWidth: number) {
    if (side === 'left') {
        return isRevealed ? EDGE_REVEAL_GAP : -BALL_SIZE + EDGE_PEEK;
    }
    return isRevealed ? viewportWidth - BALL_SIZE - EDGE_REVEAL_GAP : viewportWidth - EDGE_PEEK;
}

function decodeHtmlEntities(value: string) {
    if (typeof window === 'undefined') {
        return value;
    }

    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
}

function mapLangToSpeechLang(lang: string) {
    if (lang === 'zh-CN') return 'zh-CN';
    if (lang === 'ja') return 'ja-JP';
    if (lang === 'es') return 'es-ES';
    return 'en-US';
}

function mapLangToTranslateLang(lang: string) {
    if (lang === 'zh-CN') return 'zh';
    return lang;
}

function detectSpeechLangFromText(text: string, fallbackLang: string) {
    if (/[\u3040-\u30ff]/.test(text)) return 'ja-JP';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    if (/[\u00C0-\u017F]/.test(text)) return 'es-ES';
    return mapLangToSpeechLang(fallbackLang);
}

/** Whether the translation is a **single English word** (hyphens and apostrophes allowed), which decides whether to show synonyms. */
function isSingleEnglishWord(text: string) {
    return /^[A-Za-z][A-Za-z'-]*$/.test(text.trim());
}

/**
 * Fetch English near-synonyms (Datamuse: no key required, CORS-friendly).
 * - rel_syn: strict synonyms (mostly single words), shown first;
 * - ml (means-like): similar in meaning, and includes **multi-word phrases**.
 * The two are merged and deduplicated, so even a single-word translation can yield multi-word phrases. Any failure degrades silently to an empty array.
 */
async function fetchEnglishSynonyms(word: string): Promise<string[]> {
    const query = encodeURIComponent(word.trim());
    const endpoints = [
        `https://api.datamuse.com/words?rel_syn=${query}&max=10`,
        `https://api.datamuse.com/words?ml=${query}&max=12`,
    ];

    const fetchOne = async (url: string): Promise<Array<{ word?: string }>> => {
        try {
            const resp = await fetch(url);
            if (!resp.ok) {
                return [];
            }
            return (await resp.json()) as Array<{ word?: string }>;
        } catch {
            return [];
        }
    };

    try {
        // rel_syn first (closer in meaning), ml after (adding multi-word phrases).
        const groups = await Promise.all(endpoints.map(fetchOne));
        const lower = word.trim().toLowerCase();
        const seen = new Set<string>();
        const list: string[] = [];

        for (const group of groups) {
            for (const item of group) {
                const candidate = String(item?.word || '').trim();
                const key = candidate.toLowerCase();
                if (!candidate || key === lower || seen.has(key)) {
                    continue;
                }
                seen.add(key);
                list.push(candidate);
            }
        }

        return list.slice(0, 10);
    } catch {
        return [];
    }
}

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const speechWindow = window as Window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor;
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };

    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function mapSpeechRecognitionError(errorCode: string, t: TFunction<'translation'>) {
    if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        return t('assistant.speech.noMicPermission');
    }
    if (errorCode === 'no-speech') {
        return t('assistant.speech.noSpeech');
    }
    if (errorCode === 'audio-capture') {
        return t('assistant.speech.micUnavailable');
    }
    if (errorCode === 'network') {
        return t('assistant.speech.networkError');
    }
    return t('assistant.speech.genericError');
}

function trimCompactText(value: string, maxLen: number) {
    return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function buildDomSelector(el: Element) {
    const parts: string[] = [];
    let current: Element | null = el;

    const maxDepth = 5;
    let depth = 0;

    while (current && depth < maxDepth) {
        const tag = current.tagName.toLowerCase();
        const htmlEl = current as HTMLElement;

        if (htmlEl.id) {
            parts.unshift(`${tag}#${htmlEl.id}`);
            break;
        }

        const className = (htmlEl.className || '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .join('.');

        if (className) {
            parts.unshift(`${tag}.${className}`);
        } else {
            const parent = current.parentElement;
            if (!parent) {
                parts.unshift(tag);
                break;
            }
            const siblings = Array.from(parent.children).filter(node => node.tagName === current!.tagName);
            const index = Math.max(1, siblings.indexOf(current) + 1);
            parts.unshift(`${tag}:nth-of-type(${index})`);
        }

        current = current.parentElement;
        depth += 1;
    }

    return parts.join(' > ').slice(0, DOM_CONTEXT_MAX_SELECTOR);
}

function isMeaningfulVisibleElement(el: HTMLElement) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
        return false;
    }

    return true;
}

function collectCurrentPageDomContext(): DomContextPayload | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const selector = [
        'button',
        'a',
        'input',
        'textarea',
        'select',
        '[role]',
        '[aria-label]',
        '[data-testid]',
        'h1',
        'h2',
        'h3',
        'label',
    ].join(',');

    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const unique = new Set<HTMLElement>();
    const elements: DomContextElement[] = [];

    for (const node of nodes) {
        if (elements.length >= DOM_CONTEXT_MAX_ELEMENTS) {
            break;
        }
        if (unique.has(node)) {
            continue;
        }
        unique.add(node);

        if (!isMeaningfulVisibleElement(node)) {
            continue;
        }

        const tag = node.tagName.toLowerCase();
        const role = node.getAttribute('role') || undefined;
        const inputType = node.getAttribute('type')?.toLowerCase() || '';
        if (tag === 'input' && (inputType === 'hidden' || inputType === 'password')) {
            continue;
        }

        const attrs: Record<string, string> = {};
        const attrKeys = ['id', 'class', 'name', 'type', 'placeholder', 'href', 'aria-label', 'data-testid'];
        for (const key of attrKeys) {
            const value = node.getAttribute(key);
            if (value) {
                attrs[key] = trimCompactText(value, DOM_CONTEXT_MAX_TEXT);
            }
        }

        const rawText = tag === 'input' || tag === 'textarea' || tag === 'select'
            ? (node.getAttribute('aria-label') || node.getAttribute('placeholder') || '')
            : (node.innerText || node.textContent || '');
        const text = trimCompactText(rawText, DOM_CONTEXT_MAX_TEXT);

        const isInteractive = ['button', 'a', 'input', 'textarea', 'select'].includes(tag)
            || Boolean(role)
            || node.hasAttribute('onclick');
        if (!text && !isInteractive) {
            continue;
        }

        elements.push({
            tag,
            selector: buildDomSelector(node),
            role,
            text: text || undefined,
            attrs,
        });
    }

    const activeElement = document.activeElement instanceof Element
        ? buildDomSelector(document.activeElement)
        : null;

    return {
        url: window.location.href,
        title: document.title,
        path: window.location.pathname,
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
        activeSelector: activeElement,
        elements,
    };
}

function isAgentQuery(input: string) {
    const text = input.trim().toLowerCase();
    if (!text) {
        return false;
    }

    const keywords = [
        // browser / code analysis
        '点击', 'click', 'selector', '选择器', 'playwright', 'dom', '页面元素',
        '浏览器 agent', 'browser agent', '自动化', '填入', '按钮',
        '当前页面', '页面内容', '分析页面', '分析网页', '当前网页', '网页内容', '看看页面',
        '前端代码', '前端代码dom', '前端目录', '源码', '代码结构',
        '读取代码', '代码', '代码目录', 'react', '查看文件', '实现任务', '多轮任务',
        // data query / agent tool intent
        '分析我的', '学习情况', '学习数据', '学习统计', '学习进度',
        '我的数据', '我的计划', '我的笔记', '我的词汇',
        '查看计划', '查看笔记', '查看统计', '查看数据',
        '帮我分析', '帮我查', '帮我看',
        '搜索单词', '搜词', '查词',
        '笔记本', 'notebook', '词书',
        'agent', '工具', 'tool',
    ];

    return keywords.some(keyword => text.includes(keyword));
}

function isNavigationQuery(input: string) {
    const text = input.trim().toLowerCase();
    if (!text) {
        return false;
    }

    const navAction = ['打开', '进入', '跳转', '访问', '前往', 'go to', 'open', 'visit'];
    const navObject = ['页面', '链接', '路由', '网址', 'path', 'route', 'link', '/'];

    return navAction.some(token => text.includes(token))
        && navObject.some(token => text.includes(token));
}

function isCheckinQuery(input: string) {
    const text = input.trim().toLowerCase();
    if (!text) return false;
    const keywords = ['签到', '打卡', 'check in', 'checkin', 'daily check', 'daily sign'];
    return keywords.some(k => text.includes(k));
}

function normalizeAssistantRouteMode(rawMode: unknown, fallbackMode: AssistantRouteMode): AssistantRouteMode {
    const normalized = String(rawMode || '').trim().toLowerCase();
    if (normalized === 'direct' || normalized === 'open_pages' || normalized === 'react_agent') {
        return normalized;
    }
    return fallbackMode;
}

function createMcpRequestId() {
    return `mcp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function applyMcpCapabilitiesToRouteMode(
    routeMode: AssistantRouteMode,
    query: string,
    capabilities: AssistantMcpCapabilities | null,
): AssistantRouteMode {
    const openPagesEnabled = capabilities?.open_pages?.enabled !== false;
    const reactAgentEnabled = capabilities?.react_agent?.enabled !== false;

    if (routeMode === 'react_agent' && !reactAgentEnabled) {
        return openPagesEnabled && isNavigationQuery(query) ? 'open_pages' : 'direct';
    }

    if (routeMode === 'open_pages' && !openPagesEnabled) {
        return 'direct';
    }

    return routeMode;
}

const STEP_ICON: Record<string, string> = {
    thinking: '💭',
    action: '🔧',
    observation: '📋',
    final: '✅',
    error: '❌',
};

function getStepLabel(type: string, t: TFunction<'translation'>) {
    const labels: Record<string, string> = {
        thinking: t('assistant.agent.thinkingTitle'),
        action: t('assistant.agent.stepAction'),
        observation: t('assistant.agent.stepObservation'),
        final: t('assistant.agent.stepFinal'),
        error: t('assistant.agent.stepError'),
    };
    return labels[type] || type;
}

export default function GlobalAssistantBall() {
    const navigate = useNavigate();
    const location = useLocation();
    const { lang, setLang, t } = useLang();
    const initialViewport = getViewportSize();

    const [viewport, setViewport] = useState(initialViewport);
    const [position, setPosition] = useState<Position>({
        x: Math.max(SAFE_PADDING, initialViewport.width - BALL_SIZE - 24),
        y: Math.max(SAFE_PADDING, initialViewport.height - BALL_SIZE - 128),
    });
    const [dockSide, setDockSide] = useState<DockSide>(null);
    const [isRevealed, setIsRevealed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);

    const [menuOpen, setMenuOpen] = useState(false);
    const [activeAction, setActiveAction] = useState<AssistantAction>(null);
    const replyLockRef = useRef(false);

    const [sourceLang, setSourceLang] = useState('zh-CN');
    const [targetLang, setTargetLang] = useState('en');
    const [inputText, setInputText] = useState('');
    const [translatedText, setTranslatedText] = useState('');
    const [synonyms, setSynonyms] = useState<string[]>([]);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isVoiceListening, setIsVoiceListening] = useState(false);
    const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const synonymReqRef = useRef(0);
    const [agentProfile, setAgentProfile] = useState<PersonalAgentProfile>({
        name: t('assistant.agent.defaultProfile.name'),
        role: t('assistant.agent.defaultProfile.role'),
        goal: t('assistant.agent.defaultProfile.goal'),
        style: t('assistant.agent.defaultProfile.style'),
    });
    const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([]);
    const [agentInputText, setAgentInputText] = useState('');
    const [isAgentReplying, setIsAgentReplying] = useState(false);
    const [isAgentConfigExpanded, setIsAgentConfigExpanded] = useState(false);
    const [expandedAgentMessageIds, setExpandedAgentMessageIds] = useState<Record<string, boolean>>({});
    const [browserAgentSessionId, setBrowserAgentSessionId] = useState<string | null>(null);
    const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
    const [isAgentRunning, setIsAgentRunning] = useState(false);
    const [isAgentThinkingExpanded, setIsAgentThinkingExpanded] = useState(false);
    const [mcpCapabilities, setMcpCapabilities] = useState<AssistantMcpCapabilities | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isCapturing, _setIsCapturing] = useState(false);
    const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
    const [isCheckingIn, setIsCheckingIn] = useState(false);

    // ── Todo list state ──
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [todoInput, setTodoInput] = useState('');

    const handleAddTodo = () => {
        const text = todoInput.trim();
        if (!text) return;
        const item: TodoItem = {
            id: `todo-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            text,
            done: false,
            createdAt: Date.now(),
        };
        setTodos([item, ...todos]); setTodoInput(''); assistantApi.createTodo(item.text).then(savedItem => setTodos(prev => prev.map(t => t.id === item.id ? { ...t, id: savedItem.id } : t))).catch(err => { console.error(err); showToast('Failed to save todo to cloud', 'error'); setTodos(prev => prev.filter(t => t.id !== item.id)); });
    };

    const handleToggleTodo = (id: string | number) => { const item = todos.filter(t => t.id === id)[0]; if (!item) return; const newDone = !item.done; setTodos(todos.map(t => t.id === id ? { ...t, done: newDone } : t)); if (typeof id === 'number' || String(id).indexOf('todo-') !== 0) { assistantApi.updateTodo(id, { done: newDone }).catch(err => { console.error(err); showToast('Failed to sync todo state', 'error'); setTodos(todos); }); } };

    const handleDeleteTodo = (id: string | number) => {
        const backup = [...todos];
        setTodos(prev => prev.filter(item => item.id !== id));
        if (typeof id === 'number' || String(id).indexOf('todo-') !== 0) {
            assistantApi.deleteTodo(id).catch(err => {
                console.error(err);
                showToast('Failed to delete todo', 'error');
                setTodos(backup);
            });
        }
    };

    const handleClearCompletedTodos = () => {
        const remaining = todos.filter(item => !item.done);
        if (remaining.length < todos.length) {
            setTodos(remaining); assistantApi.clearCompletedTodos().catch(err => { console.error(err); showToast('Failed to clear completed todos', 'error'); setTodos(todos); });
            showToast(t('assistant.todo.cleared'), 'success');
        }
    };

    
    // ── Shortcut state ──
    const [customShortcuts, setCustomShortcuts] = useState<ShortcutItem[]>([]);
    
    // ── Data Fetching ──
    const [hasFetchedAssistantData, setHasFetchedAssistantData] = useState(false);

    useEffect(() => {
        if (menuOpen && !hasFetchedAssistantData) {
            setHasFetchedAssistantData(true);
            const loadData = async () => {
                try {
                    const [todosData, shortcutsData] = await Promise.all([
                        assistantApi.getTodos(),
                        assistantApi.getShortcuts()
                    ]);
                    // Map API data to our frontend interfaces
                    const fetchedTodos = todosData.map((item: any) => ({
                        id: item.id,
                        text: item.text,
                        done: item.done,
                        createdAt: new Date(item.created_at).getTime()
                    }));
                    const fetchedShortcuts = shortcutsData.map((item: any) => ({
                        id: item.id,
                        title: item.title,
                        url: item.url,
                        openInNewTab: item.open_in_new_tab,
                        createdAt: new Date(item.created_at).getTime()
                    }));
                    setTodos(fetchedTodos);
                    setCustomShortcuts(fetchedShortcuts);
                } catch (e) {
                    console.error('Failed to fetch assistant data:', e);
                }
            };
            void loadData();
        }
    }, [menuOpen, hasFetchedAssistantData]);
const [shortcutTitleInput, setShortcutTitleInput] = useState('');
    const [shortcutUrlInput, setShortcutUrlInput] = useState('');
    const [shortcutNewTabInput, setShortcutNewTabInput] = useState(true);

    const handleAddShortcut = () => {
        const title = shortcutTitleInput.trim();
        const url = shortcutUrlInput.trim();
        if (!title || !url) return;
        
        // Basic URL validation
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            showToast(t('assistant.shortcuts.invalidUrl'), 'error');
            return;
        }

        const item: ShortcutItem = {
            id: `sc-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            title,
            url,
            createdAt: Date.now(),
            openInNewTab: shortcutNewTabInput,
        };
        // Optimistic update
        setCustomShortcuts(prev => [...prev, item]);
        setShortcutTitleInput('');
        setShortcutUrlInput('');
        setShortcutNewTabInput(true);

        // API Call
        assistantApi.createShortcut({
            title: item.title,
            url: item.url,
            open_in_new_tab: item.openInNewTab || false
        }).then(savedItem => {
            setCustomShortcuts(prev => prev.map(s => s.id === item.id ? { ...s, id: savedItem.id } : s));
        }).catch(err => {
            console.error(err);
            showToast('Failed to save shortcut to cloud', 'error');
            // Rollback optimistic update
            setCustomShortcuts(prev => prev.filter(s => s.id !== item.id));
        });
    };

    const handleDeleteShortcut = (id: string | number, e: React.MouseEvent) => {
        e.stopPropagation();
        const backup = [...customShortcuts];
        setCustomShortcuts(prev => prev.filter(item => item.id !== id));
        if (typeof id === 'number' || String(id).indexOf('sc-') !== 0) {
            assistantApi.deleteShortcut(id).catch(err => {
                console.error(err);
                showToast('Failed to delete shortcut', 'error');
                setCustomShortcuts(backup);
            });
        }
    };

    const handleToggleShortcutNewTab = (id: string | number, e: React.MouseEvent) => {
        e.stopPropagation();
        const itemToUpdate = customShortcuts.find(s => s.id === id);
        if (!itemToUpdate) return;
        
        const newTabStatus = !itemToUpdate.openInNewTab;
        
        // Optimistic update
        setCustomShortcuts(prev => prev.map(s => s.id === id ? { ...s, openInNewTab: newTabStatus } : s));
        
        if (typeof id === 'number' || String(id).indexOf('sc-') !== 0) {
            assistantApi.updateShortcut(id, { open_in_new_tab: newTabStatus }).catch(err => {
                console.error(err);
                showToast('Failed to update shortcut', 'error');
                // Rollback on failure
                setCustomShortcuts(prev => prev.map(s => s.id === id ? { ...s, openInNewTab: !newTabStatus } : s));
            });
        }
    };

    const handleShortcutClick = (item: ShortcutItem) => {
        if (item.openInNewTab !== false) {
            window.open(item.url, '_blank', 'noopener,noreferrer');
        } else {
            window.location.href = item.url;
        }
    };

    const rootRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const movedRef = useRef(false);
    const positionRef = useRef(position);
    const agentChatViewportRef = useRef<HTMLDivElement | null>(null);
    const mcpCapabilitiesRequestedRef = useRef(false);
    const speechRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
    const voiceManualStopRef = useRef(false);

    useEffect(() => {
        positionRef.current = position;
    }, [position]);

    useEffect(() => {
        return () => {
            cancelSpeak();

            const activeRecognition = speechRecognitionRef.current;
            if (activeRecognition) {
                try {
                    activeRecognition.stop();
                } catch {
                    // ignore stop errors during unmount
                }
                speechRecognitionRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const raw = window.localStorage.getItem(PERSONAL_AGENT_STORAGE_KEY);
            if (!raw) {
                return;
            }

            const parsed = JSON.parse(raw) as Partial<PersonalAgentProfile>;
            if (!parsed || typeof parsed !== 'object') {
                return;
            }

            setAgentProfile(prev => ({
                name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : prev.name,
                role: typeof parsed.role === 'string' && parsed.role.trim() ? parsed.role.trim() : prev.role,
                goal: typeof parsed.goal === 'string' && parsed.goal.trim() ? parsed.goal.trim() : prev.goal,
                style: typeof parsed.style === 'string' && parsed.style.trim() ? parsed.style.trim() : prev.style,
            }));
        } catch (error) {
            console.warn('Load personal agent profile failed', error);
        }
    }, []);

    useEffect(() => {
        if (activeAction !== 'personal-agent') {
            return;
        }

        const viewportElement = agentChatViewportRef.current;
        if (!viewportElement) {
            return;
        }

        viewportElement.scrollTop = viewportElement.scrollHeight;
    }, [activeAction, agentMessages, isAgentReplying, agentSteps]);

    useEffect(() => {
        if (!menuOpen || activeAction !== 'personal-agent') {
            return;
        }

        if (mcpCapabilitiesRequestedRef.current) {
            return;
        }
        mcpCapabilitiesRequestedRef.current = true;

        const requestId = createMcpRequestId();
        void apiClient
            .get<AssistantMcpCapabilitiesResponse>('/assistant/mcp/capabilities', {
                headers: {
                    'X-MCP-Request-ID': requestId,
                },
            })
            .then((response) => {
                const capabilities = response.data?.capabilities;
                if (capabilities) {
                    setMcpCapabilities(capabilities);
                }
            })
            .catch((error) => {
                console.warn('MCP capabilities fetch failed, continue with local fallback', error);
            });
    }, [activeAction, menuOpen]);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }

        let cancelled = false;
        checkinApi.getStatus()
            .then((status) => {
                if (!cancelled) {
                    setHasCheckedInToday(status.today_checked ?? false);
                }
            })
            .catch(() => {
                // fail silently — button stays enabled
            });

        return () => { cancelled = true; };
    }, [menuOpen]);

    useEffect(() => {
        const handleResize = () => {
            const nextViewport = getViewportSize();
            setViewport(nextViewport);

            setPosition(prev => {
                const nextY = clamp(prev.y, SAFE_PADDING, nextViewport.height - BALL_SIZE - SAFE_PADDING);

                if (dockSide === 'left' || dockSide === 'right') {
                    return {
                        x: getDockedX(dockSide, isRevealed, nextViewport.width),
                        y: nextY,
                    };
                }

                return {
                    x: clamp(prev.x, SAFE_PADDING, nextViewport.width - BALL_SIZE - SAFE_PADDING),
                    y: nextY,
                };
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [dockSide, isRevealed]);

    useEffect(() => {
        if (dockSide !== 'left' && dockSide !== 'right') {
            return;
        }

        setPosition(prev => ({
            x: getDockedX(dockSide, isRevealed, viewport.width),
            y: prev.y,
        }));
    }, [dockSide, isRevealed, viewport.width]);

    useEffect(() => {
        if (!isDragging) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const dragState = dragRef.current;
            if (!dragState) {
                return;
            }

            const dx = event.clientX - dragState.startPointerX;
            const dy = event.clientY - dragState.startPointerY;

            if (Math.abs(dx) + Math.abs(dy) > 5) {
                movedRef.current = true;
            }

            setPosition({
                x: clamp(dragState.startX + dx, -BALL_SIZE + EDGE_PEEK, viewport.width - EDGE_PEEK),
                y: clamp(dragState.startY + dy, SAFE_PADDING, viewport.height - BALL_SIZE - SAFE_PADDING),
            });
        };

        const handlePointerUp = () => {
            setIsDragging(false);
            dragRef.current = null;

            const current = positionRef.current;
            const nearLeft = current.x <= EDGE_DETECT;
            const nearRight = current.x >= viewport.width - BALL_SIZE - EDGE_DETECT;

            if (nearLeft || nearRight) {
                const nextSide: Exclude<DockSide, null> = nearLeft ? 'left' : 'right';
                const revealAfterDock = menuOpen || isHovering;
                setDockSide(nextSide);
                setIsRevealed(revealAfterDock);

                setPosition(prev => ({
                    x: getDockedX(nextSide, revealAfterDock, viewport.width),
                    y: clamp(prev.y, SAFE_PADDING, viewport.height - BALL_SIZE - SAFE_PADDING),
                }));
                return;
            }

            setDockSide(null);
            setIsRevealed(false);
            setPosition(prev => ({
                x: clamp(prev.x, SAFE_PADDING, viewport.width - BALL_SIZE - SAFE_PADDING),
                y: clamp(prev.y, SAFE_PADDING, viewport.height - BALL_SIZE - SAFE_PADDING),
            }));
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, isHovering, menuOpen, viewport.height, viewport.width]);

    const handleBallPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();

        if (dockSide) {
            setIsRevealed(true);
        }

        movedRef.current = false;
        setIsDragging(true);
        dragRef.current = {
            startPointerX: event.clientX,
            startPointerY: event.clientY,
            startX: positionRef.current.x,
            startY: positionRef.current.y,
        };
    };

    const handleBallClick = () => {
        if (movedRef.current) {
            movedRef.current = false;
            return;
        }

        setMenuOpen(prev => {
            const next = !prev;
            if (next) {
                setIsRevealed(true);
                setActiveAction('translate');
            } else {
                setActiveAction(null);
                if (dockSide && !isHovering) {
                    setIsRevealed(false);
                }
            }
            return next;
        });
    };

    const handleMouseEnter = () => {
        setIsHovering(true);
        if (dockSide) {
            setIsRevealed(true);
        }
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        if (dockSide && !menuOpen && !isDragging) {
            setIsRevealed(false);
        }
    };

    const handleTranslate = useCallback(async () => {
        const trimmed = inputText.trim();
        if (!trimmed) {
            showToast(t('assistant.translate.toastEmpty'), 'error');
            return;
        }

        if (sourceLang !== 'auto' && sourceLang === targetLang) {
            showToast(t('assistant.translate.toastSameLang'), 'error');
            return;
        }

        setIsTranslating(true);
        try {
            const toLang = mapLangToTranslateLang(targetLang);
            const requestedFrom = mapLangToTranslateLang(sourceLang);

            let translated = '';
            translated = await translate(trimmed, {
                from: requestedFrom,
                to: toLang,
            });

            if (!translated?.trim()) {
                throw new Error('empty translation');
            }

            const decoded = decodeHtmlEntities(translated);
            setTranslatedText(decoded);
            setSynonyms([]);
            showToast(t('assistant.translate.toastSuccess'), 'success');

            // When the translation is a single English word, fetch synonyms in the background to widen the range of expressions.
            // Non-blocking; a request sequence number stops a stale result overwriting a newer one.
            const reqId = ++synonymReqRef.current;
            if (toLang === 'en' && isSingleEnglishWord(decoded)) {
                void fetchEnglishSynonyms(decoded).then(syns => {
                    if (synonymReqRef.current === reqId) {
                        setSynonyms(syns);
                    }
                });
            }
        } catch (error) {
            console.error('Translate failed', error);
            showToast(t('assistant.translate.toastFail'), 'error');
        } finally {
            setIsTranslating(false);
        }
    }, [inputText, sourceLang, targetLang]);

    /**
     * Insert recognised speech at the cursor position in the source text box, rather than always appending to the end.
     * When the box is not focused, use its last known cursor position; after inserting, move the cursor past the new content.
     */
    const insertSourceTextAtCursor = useCallback((text: string) => {
        const addition = text.trim();
        if (!addition) {
            return;
        }

        const el = sourceTextareaRef.current;
        if (!el) {
            setInputText(prev => (prev ? `${prev} ${addition}` : addition));
            return;
        }

        const value = el.value;
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
        const insertion = `${needsLeadingSpace ? ' ' : ''}${addition}`;
        const caret = before.length + insertion.length;

        setInputText(`${before}${insertion}${after}`);

        // once React has written the controlled value back, restore the cursor to just after the inserted content.
        requestAnimationFrame(() => {
            const node = sourceTextareaRef.current;
            if (!node) {
                return;
            }
            node.focus();
            try {
                node.setSelectionRange(caret, caret);
            } catch {
                // ignore selection errors
            }
        });
    }, []);

    const handleStartVoiceForTranslate = useCallback(() => {
        const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
        if (!SpeechRecognitionCtor) {
            return;
        }

        if (isVoiceListening) {
            return;
        }

        const activeRecognition = speechRecognitionRef.current;
        if (activeRecognition) {
            try {
                activeRecognition.stop();
            } catch {
                // ignore previous instance stop error
            }
            speechRecognitionRef.current = null;
        }

        const recognition = new SpeechRecognitionCtor();
        const recognitionLang = mapLangToSpeechLang(sourceLang);
        recognition.lang = recognitionLang;
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        voiceManualStopRef.current = false;

        recognition.onresult = (event) => {
            const results = event.results;
            if (!results) {
                return;
            }

            // In continuous mode results accumulate, so take only the final results new to this event,
            // otherwise previously recognised content is inserted again.
            const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
            let addition = '';
            for (let i = startIndex; i < results.length; i += 1) {
                const result = results[i];
                if (result && result.isFinal !== false) {
                    addition += String(result[0]?.transcript || '');
                }
            }

            addition = addition.trim();
            if (!addition) {
                return;
            }

            insertSourceTextAtCursor(addition);
        };

        recognition.onerror = (event) => {
            const message = mapSpeechRecognitionError(String(event.error || '').trim(), t);
            console.warn('Voice input error:', message);
            voiceManualStopRef.current = true;
        };

        recognition.onend = () => {
            if (!voiceManualStopRef.current && activeAction === 'translate') {
                try {
                    recognition.start();
                    return;
                } catch {
                    // fallback to cleanup when restart fails
                }
            }

            setIsVoiceListening(false);
            speechRecognitionRef.current = null;
            voiceManualStopRef.current = false;
        };

        speechRecognitionRef.current = recognition;
        setIsVoiceListening(true);

        try {
            recognition.start();
        } catch (error) {
            console.error('Voice input start failed', error);
            setIsVoiceListening(false);
            speechRecognitionRef.current = null;
            voiceManualStopRef.current = false;
        }
    }, [activeAction, isVoiceListening, sourceLang, insertSourceTextAtCursor]);

    const handleStopVoiceForTranslate = useCallback(() => {
        const activeRecognition = speechRecognitionRef.current;
        if (!activeRecognition) {
            return;
        }

        voiceManualStopRef.current = true;
        try {
            activeRecognition.stop();
        } catch {
            // ignore stop errors
        }
        speechRecognitionRef.current = null;
        setIsVoiceListening(false);
    }, []);

    const handleSwapLanguages = () => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
    };

    const handleSourceLangChange = (nextSourceLang: string) => {
        setSourceLang(nextSourceLang);
        setTargetLang(nextSourceLang === 'zh-CN' ? 'en' : 'zh-CN');
    };

    const speakText = useCallback((text: string, lang: string) => {
        const trimmed = text.trim();
        if (!trimmed) {
            showToast(t('assistant.voice.noText'), 'error');
            return;
        }

        const detectedLang = detectSpeechLangFromText(trimmed, lang);
        if (detectedLang.startsWith('en')) {
            // English uses Youdao's high-quality pronunciation
            speakWord(trimmed);
        } else {
            // Chinese and other languages stay on the browser's native voice
            speakTextUtil(trimmed, detectedLang);
        }
    }, []);

    const handleSpeakSourceText = () => {
        speakText(inputText, sourceLang);
    };

    const handleSpeakTranslatedText = () => {
        speakText(translatedText, targetLang);
    };

    const handleAgentFieldChange = (field: keyof PersonalAgentProfile, value: string) => {
        setAgentProfile(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSaveAgentProfile = () => {
        if (typeof window === 'undefined') {
            return;
        }

        const normalizedProfile: PersonalAgentProfile = {
            name: agentProfile.name.trim(),
            role: agentProfile.role.trim(),
            goal: agentProfile.goal.trim(),
            style: agentProfile.style.trim(),
        };

        if (!normalizedProfile.name || !normalizedProfile.role || !normalizedProfile.goal || !normalizedProfile.style) {
            showToast(t('assistant.agent.toastEmptyProfile'), 'error');
            return;
        }

        try {
            window.localStorage.setItem(PERSONAL_AGENT_STORAGE_KEY, JSON.stringify(normalizedProfile));
            setAgentProfile(normalizedProfile);
            showToast(t('assistant.agent.toastProfileSaved'), 'success');
        } catch (error) {
            console.error('Save personal agent profile failed', error);
            showToast(t('assistant.agent.toastProfileSaveFail'), 'error');
        }
    };

    const handleResetAgentChat = () => {
        setAgentMessages([]);
        setExpandedAgentMessageIds({});
        setBrowserAgentSessionId(null);
        setAgentSteps([]);
        setIsAgentRunning(false);
        setIsAgentThinkingExpanded(false);
        showToast(t('assistant.agent.toastChatCleared'), 'success');
    };

    const handleQuickCheckin = useCallback(async () => {
        if (isCheckingIn || replyLockRef.current || hasCheckedInToday) return;
        setIsCheckingIn(true);
        try {
            const result = await checkinApi.doCheckin();
            if (result.ok) {
                setHasCheckedInToday(true);
            }
            // Compose from structured fields — the backend `message` string is
            // Chinese-only and bypasses i18n.
            const embed = result.ok
                ? `**${t('assistant.checkin.successMessage').replace('{bonus}', (result.bonus ?? 0).toLocaleString())}**\n\n` +
                  `${t('assistant.checkin.balance')}: ${(result.balance ?? 0).toLocaleString()} AT\n` +
                  `${t('assistant.checkin.streak')}: ${result.checkin_streak ?? 0} ${t('assistant.checkin.daysUnit')}\n` +
                  `${t('assistant.checkin.totalCheckins')}: ${result.checkin_count ?? 0} ${t('assistant.checkin.daysUnit')}` +
                  (result.card_awarded
                      ? `\n\n${t('assistant.checkin.cardAwarded').replace('{n}', String(result.checkin_streak ?? 0))}`
                      : '')
                : `**${t('assistant.checkin.alreadyMessage')}**`;
            const assistantMessage: AgentChatMessage = {
                id: `${Date.now()}-a-${Math.random().toString(16).slice(2, 8)}`,
                role: 'assistant',
                content: embed,
            };
            setAgentMessages(prev => [...prev, assistantMessage]);
        } catch {
            showToast(t('assistant.checkin.failMessage'), 'error');
        } finally {
            setIsCheckingIn(false);
        }
    }, [isCheckingIn, hasCheckedInToday, lang]);

    const handleSendAgentMessage = useCallback(async () => {
        if (replyLockRef.current || isAgentReplying) {
            return;
        }

        const trimmed = agentInputText.trim();
        if (!trimmed) {
            return;
        }

        replyLockRef.current = true;
        const userMessage: AgentChatMessage = {
            id: `${Date.now()}-u-${Math.random().toString(16).slice(2, 8)}`,
            role: 'user',
            content: trimmed,
        };

        const nextMessages = [...agentMessages, userMessage];
        const domContext = collectCurrentPageDomContext();
        const messagePayload = nextMessages.map((message: AgentChatMessage) => ({
            role: message.role,
            content: message.content,
        }));

        setAgentMessages(nextMessages);
        setAgentInputText('');
        setAgentSteps([]);
        setIsAgentRunning(false);
        setIsAgentThinkingExpanded(false);
        setIsAgentReplying(true);

        try {
            const mcpRequestId = createMcpRequestId();
            const mcpRouteEnabled = mcpCapabilities?.route?.enabled !== false;
            const mcpOpenPagesEnabled = mcpCapabilities?.open_pages?.enabled !== false;
            const mcpReactAgentEnabled = mcpCapabilities?.react_agent?.enabled !== false;

            // Quick daily check-in — handle before MCP routing
            if (isCheckinQuery(trimmed)) {
                try {
                    const result = await checkinApi.doCheckin();
                    const embed = result.ok
                        ? `**${t('assistant.checkin.successMessage').replace('{bonus}', (result.bonus ?? 0).toLocaleString())}**\n\n` +
                          `${t('assistant.checkin.balance')}: ${(result.balance ?? 0).toLocaleString()} AT\n` +
                          `${t('assistant.checkin.totalCheckins')}: ${result.checkin_count ?? 0} ${t('assistant.checkin.daysUnit')}`
                        : `**${t('assistant.checkin.alreadyMessage')}**`;
                    const assistantMessage: AgentChatMessage = {
                        id: `${Date.now()}-a-${Math.random().toString(16).slice(2, 8)}`,
                        role: 'assistant',
                        content: embed,
                    };
                    setAgentMessages(prev => [...prev, assistantMessage]);
                } catch {
                    const failMessage: AgentChatMessage = {
                        id: `${Date.now()}-a-${Math.random().toString(16).slice(2, 8)}`,
                        role: 'assistant',
                        content: t('assistant.checkin.failMessage'),
                    };
                    setAgentMessages(prev => [...prev, failMessage]);
                }
                setIsAgentReplying(false);
                replyLockRef.current = false;
                return;
            }

            let mcpHandled = false;
            let routeMode: AssistantRouteMode = applyMcpCapabilitiesToRouteMode(
                isNavigationQuery(trimmed)
                ? 'open_pages'
                : (isAgentQuery(trimmed) ? 'react_agent' : 'direct'),
                trimmed,
                mcpCapabilities,
            );
            let routeReason = '';

            if (!mcpRouteEnabled) {
                routeReason = 'MCP route disabled by backend; using client-side fallback routing.';
            } else {
                try {
                    const routeResponse = await apiClient.post<AssistantMcpRouteResponse>('/assistant/mcp/route', {
                        query: trimmed,
                        ui_lang: lang,
                        page_path: location.pathname,
                        dom_context: domContext,
                        messages: messagePayload,
                        request_id: mcpRequestId,
                    });

                    const normalizedMode = normalizeAssistantRouteMode(routeResponse.data?.mode, routeMode);
                    routeMode = applyMcpCapabilitiesToRouteMode(normalizedMode, trimmed, mcpCapabilities);
                    routeReason = String(routeResponse.data?.reason || '').trim();
                } catch (routeError) {
                    console.warn('MCP route failed, fallback to local routing', routeError);
                }
            }

            if (routeReason) {
                setAgentSteps(prev => [...prev, {
                    id: `route-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                    type: 'thinking',
                    summary: `Route: ${routeMode}${routeReason ? ` (${routeReason})` : ''}`,
                }]);
            }

            try {
                if (routeMode === 'react_agent' && mcpReactAgentEnabled) {
                    setIsAgentRunning(true);
                    const response = await fetchStream('/assistant/mcp/react-browser', {
                        method: 'POST',
                        body: {
                            query: trimmed,
                            session_id: browserAgentSessionId,
                            page_path: location.pathname,
                            base_url: typeof window !== 'undefined' ? window.location.origin : undefined,
                            max_steps: 15,
                            ui_lang: lang,
                            dom_context: domContext,
                            messages: messagePayload,
                            request_id: mcpRequestId,
                        }
                    });

                    if (response.headers.get('content-type')?.includes('application/json')) {
                        const json = await response.json();
                        if (json.handled) {
                            mcpHandled = true;
                        }
                    } else {
                        mcpHandled = true;
                        const assistId = `${Date.now()}-a-${Math.random().toString(16).slice(2, 8)}`;
                        let created = false;

                        const appendFinalReplyChunk = (chunk: string) => {
                            const safeChunk = String(chunk || '');
                            if (!safeChunk) return;

                            setAgentMessages(prev => {
                                const existing = prev.find(message => message.id === assistId);
                                if (existing) {
                                    return prev.map(message => message.id === assistId
                                        ? { ...message, content: `${message.content}${safeChunk}` }
                                        : message);
                                }

                                return [...prev, {
                                    id: assistId,
                                    role: 'assistant' as const,
                                    content: safeChunk,
                                }];
                            });
                            created = true;
                        };

                        await readSseStream(response, (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                            const serverRequestId = String(data?.mcp?.request_id || '').trim();
                            if (serverRequestId && serverRequestId !== mcpRequestId) {
                                // Concurrency guard: only consume the SSE events belonging to the current request ID.
                                return;
                            }

                            const stepId = `step-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
                            if (data.type === 'error') {
                                setAgentSteps(prev => [...prev, {
                                    id: stepId,
                                    type: 'error',
                                    summary: data.error || 'Unknown error',
                                }]);
                                setIsAgentRunning(false);
                                throw new Error(data.error);
                            }

                            if (data.type === 'init' && data.session_id) {
                                setBrowserAgentSessionId(data.session_id);
                            }
                            if (data.type === 'thinking') {
                                setAgentSteps(prev => [...prev, {
                                    id: stepId,
                                    type: 'thinking',
                                    step: data.step,
                                }]);
                            }
                            if (data.type === 'action') {
                                setAgentSteps(prev => [...prev, {
                                    id: stepId,
                                    type: 'action',
                                    action: data.action || '',
                                    params: data.params || {},
                                    reason: data.reason || '',
                                }]);
                            }
                            if (data.type === 'observation') {
                                setAgentSteps(prev => [...prev, {
                                    id: stepId,
                                    type: 'observation',
                                    status: data.status || '',
                                    summary: data.summary || '',
                                }]);
                            }
                            if (data.type === 'final_chunk') {
                                flushSync(() => {
                                    appendFinalReplyChunk(String(data.reply || ''));
                                });
                            }
                            if (data.type === 'final_done') {
                                setAgentSteps(prev => [...prev, {
                                    id: stepId,
                                    type: 'final',
                                    reply: created ? '' : (data.reply || ''),
                                }]);
                                setIsAgentRunning(false);
                                if (!created && data.reply) {
                                    appendFinalReplyChunk(String(data.reply));
                                }
                            }
                            if (data.type === 'final') {
                                setAgentSteps(prev => [...prev, {
                                    id: stepId,
                                    type: 'final',
                                    reply: data.reply || '',
                                }]);
                                setIsAgentRunning(false);
                                appendFinalReplyChunk(String(data.reply || ''));
                            }
                        });

                        setIsAgentRunning(false);
                        if (!created) {
                            throw new Error('Agent returned no result');
                        }
                    }
                }
            } catch (reactBrowserError) {
                setIsAgentRunning(false);
                console.warn('Agent stream failed, fallback', reactBrowserError);
            }

            if (mcpHandled) {
                setIsAgentReplying(false);
                replyLockRef.current = false;
                return;
            }

            if (routeMode !== 'direct' && mcpOpenPagesEnabled) {
                try {
                    const mcpResponse = await apiClient.post<AssistantMcpOpenPagesResponse>('/assistant/mcp/open-pages', {
                        query: trimmed,
                        ui_lang: lang,
                        request_id: mcpRequestId,
                    });

                    if (mcpResponse.data?.handled) {
                        const navigateTo = typeof mcpResponse.data.navigate_to === 'string'
                            ? mcpResponse.data.navigate_to.trim()
                            : '';
                        if (navigateTo) {
                            navigate(navigateTo);
                        }

                        const mcpReply = String(mcpResponse.data.reply || '').trim();
                        if (mcpReply) {
                            const assistantMessage: AgentChatMessage = {
                                id: `${Date.now()}-a-${Math.random().toString(16).slice(2, 8)}`,
                                role: 'assistant',
                                content: mcpReply,
                            };
                            setAgentMessages(prev => [...prev, assistantMessage]);
                        }
                        setIsAgentReplying(false);
                        replyLockRef.current = false;
                        return;
                    }
                } catch (mcpError) {
                    console.warn('MCP open-pages failed, fallback to personal-chat', mcpError);
                }
            } else if (routeMode !== 'direct' && !mcpOpenPagesEnabled) {
                setAgentSteps(prev => [...prev, {
                    id: `route-disabled-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                    type: 'thinking',
                    summary: t('assistant.agent.routeOpenPagesDisabled'),
                }]);
            }

            const assistId = `${Date.now()}-a-${Math.random().toString(16).slice(2, 8)}`;

            const response = await fetchStream('/assistant/personal-chat', {
                method: 'POST',
                body: {
                    messages: messagePayload,
                    ui_lang: lang,
                    dom_context: domContext,
                    agent_profile: agentProfile,
                    // system_prompt is built by the backend through skills.py's assistant_build_system_prompt
                }
            });

            let receivedReply = false;
            await readSseStream(response, (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                if (data.error) {
                    throw new Error(data.error);
                }
                if (data.reply) {
                    receivedReply = true;
                    flushSync(() => {
                        setAgentMessages(prev => {
                            const existing = prev.find(m => m.id === assistId);
                            if (existing) {
                                return prev.map(m => m.id === assistId ? { ...m, content: m.content + data.reply } : m);
                            } else {
                                return [...prev, { id: assistId, role: 'assistant' as const, content: data.reply }];
                            }
                        });
                    });
                }
            });

            if (!receivedReply) {
                throw new Error(t('assistant.agent.toastNoReply'));
            }

        } catch (error) {
            console.error('Agent chat failed', error);
            const responseData = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
            const backendMessage = String(responseData?.error || responseData?.message || (error as Error).message || '').trim();
            showToast(backendMessage || t('assistant.agent.toastReplyFail'), 'error');
        } finally {
            setIsAgentReplying(false);
            replyLockRef.current = false;
        }
    }, [
        agentInputText,
        isAgentReplying,
        agentMessages,
        agentProfile,
        navigate,
        lang,
        browserAgentSessionId,
        location.pathname,
        mcpCapabilities,
    ]);

    const handleAgentInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSendAgentMessage();
        }
    };

    const handleScreenshot = useCallback(async () => {
        if (isCapturing || !rootRef.current) return;

        // Temporarily remove the assistant from layout so html2canvas skips it natively.
        // display:none is more reliable than ignoreElements (which can cause internal
        // createPattern errors on zero-size canvases).
        const rootEl = rootRef.current;
        const prevDisplay = rootEl.style.display;
        rootEl.style.display = 'none';

        // Wait two frames for the DOM to reflect the display change
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        // Wait two frames for the DOM to reflect the display change
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        try {
            const { toBlob } = await import('html-to-image');
            
            const blob = await toBlob(document.body, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#fdfdfc',
                pixelRatio: 2,
                filter: (node) => {
                    // Ignore elements with display none or 0 dimensions if needed
                    const el = node as HTMLElement;
                    if (el.tagName === 'CANVAS' || el.tagName === 'SVG' || el.tagName === 'IFRAME' || el.tagName === 'IMG') {
                        const rect = el.getBoundingClientRect();
                        if (rect.width === 0 || rect.height === 0) {
                            return false;
                        }
                    }
                    return true;
                }
            });

            if (!blob) {
                showToast(t('assistant.screenshot.toastGenerateFail'), 'error');
                return;
            }

            const defaultName = `aielts-screenshot-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;

            // Let user choose save location via File System Access API
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: defaultName,
                        types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    showToast(t('assistant.screenshot.toastSaved'), 'success');
                    return;
                } catch (e) {
                    // User cancelled the picker — silently return
                    if ((e as DOMException)?.name === 'AbortError') return;
                    // Fall through to fallback
                }
            }

            // Fallback: auto-download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultName;
            a.click();
            URL.revokeObjectURL(url);

            showToast(t('assistant.screenshot.toastSaved'), 'success');
        } catch (e) {
            console.error('Screenshot failed', e);
            showToast(t('assistant.screenshot.toastFail'), 'error');
        } finally {
            // Restore assistant visibility
            rootRef.current!.style.display = prevDisplay;
        }
    }, [isCapturing]);

    const shouldShowAgentPendingBubble =
        isAgentReplying
        && !isAgentRunning
        && (agentMessages.length === 0 || agentMessages[agentMessages.length - 1]?.role !== 'assistant');

    return (
        <div
            ref={rootRef}
            className={`assistant-root ${isDragging ? 'is-dragging' : ''}`}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                type="button"
                className="assistant-ball"
                aria-label={t('assistant.openAria')}
                onPointerDown={handleBallPointerDown}
                onClick={handleBallClick}
            >
                <span className="assistant-ball-icon">AI</span>
            </button>

            {menuOpen && (
                <div
                    className={`assistant-panel ${dockSide === 'right' ? 'assistant-panel--left' : 'assistant-panel--right'}`}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="assistant-panel-title">{t('assistant.title')}</div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button
                                type="button"
                                className="assistant-panel-lang-btn"
                                title={lang === 'zh' ? t('assistant.switchLangTitleEn') : t('assistant.switchLangTitleZh')}
                                aria-label={lang === 'zh' ? t('assistant.switchLangTitleEn') : t('assistant.switchLangTitleZh')}
                                onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                            >
                                {lang === 'zh' ? t('assistant.switchLangBtnEn') : t('assistant.switchLangBtnZh')}
                            </button>
                            <button
                                type="button"
                                className="assistant-panel-screenshot-btn"
                                title={t('assistant.screenshotTitle')}
                                aria-label={t('assistant.screenshotAria')}
                                disabled={isCapturing}
                                onClick={handleScreenshot}
                            >
                                {isCapturing ? '⏳' : '📷'}
                            </button>
                            <button
                                type="button"
                                className="assistant-panel-close-btn"
                                title={t('assistant.collapseTitle')}
                                aria-label={t('assistant.collapseAria')}
                                onClick={() => {
                                    setMenuOpen(false);
                                    setActiveAction(null);
                                    if (dockSide && !isHovering) setIsRevealed(false);
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <div className="assistant-option-list">
                        <button
                            type="button"
                            className={`assistant-option-btn ${activeAction === 'translate' ? 'is-active' : ''}`}
                            onClick={() => setActiveAction(prev => (prev === 'translate' ? null : 'translate'))}
                        >
                            {t('assistant.actions.translate')}
                        </button>
                        <button
                            type="button"
                            className={`assistant-option-btn ${activeAction === 'personal-agent' ? 'is-active' : ''}`}
                            onClick={() => setActiveAction(prev => (prev === 'personal-agent' ? null : 'personal-agent'))}
                        >
                            {t('assistant.actions.personalAgent')}
                        </button>

                        <button
                            type="button"
                            className={`assistant-option-btn ${activeAction === 'todo' ? 'is-active' : ''}`}
                            onClick={() => setActiveAction(prev => (prev === 'todo' ? null : 'todo'))}
                        >
                            {t('assistant.actions.todoList')}
                        </button>
                        <button
                            type="button"
                            className={`assistant-option-btn ${activeAction === 'shortcuts' ? 'is-active' : ''}`}
                            onClick={() => setActiveAction(prev => (prev === 'shortcuts' ? null : 'shortcuts'))}
                        >
                            {t('assistant.actions.shortcuts')}
                        </button>
                        <button
                            type="button"
                            className="assistant-option-btn is-checkin-btn"
                            onClick={handleQuickCheckin}
                            disabled={isCheckingIn || hasCheckedInToday}
                        >
                            {isCheckingIn ? t('assistant.actions.checking') : hasCheckedInToday ? t('assistant.actions.checkinDone') : t('assistant.actions.checkin')}
                        </button>
                    </div>

                    {activeAction === 'translate' && (
                        <div className="assistant-translate-panel">
                            <div className="assistant-translate-lang-row">
                                <label>
                                    {t('assistant.translate.sourceLang')}
                                    <select value={sourceLang} onChange={e => handleSourceLangChange(e.target.value)}>
                                        <option value="zh-CN">中文</option>
                                        <option value="en">English</option>
                                        <option value="ja">日本語</option>
                                    </select>
                                </label>
                                <button
                                    type="button"
                                    className="assistant-translate-swap-btn"
                                    onClick={handleSwapLanguages}
                                    title={t('assistant.translate.swapTitle')}
                                    aria-label={t('assistant.translate.swapAria')}
                                >
                                    ⇄
                                </button>
                                <label>
                                    {t('assistant.translate.targetLang')}
                                    <select value={targetLang} onChange={e => setTargetLang(e.target.value)}>
                                        <option value="en">English</option>
                                        <option value="zh-CN">中文</option>
                                        <option value="ja">日本語</option>
                                        <option value="es">Español</option>
                                    </select>
                                </label>
                            </div>

                            <div className="assistant-translate-field-head">
                                <span>{t('assistant.translate.sourceText')}</span>
                                <div className="assistant-translate-btn-group">
                                    <button
                                        type="button"
                                        className="assistant-voice-btn"
                                        onClick={handleSpeakSourceText}
                                        title={t('assistant.translate.speakSourceTitle')}
                                        aria-label={t('assistant.translate.speakSourceAria')}
                                    >
                                        🔊
                                    </button>
                                    <button
                                        type="button"
                                        className={`assistant-voice-input-btn ${isVoiceListening ? 'is-listening' : ''}`}
                                        onClick={isVoiceListening ? handleStopVoiceForTranslate : handleStartVoiceForTranslate}
                                        title={isVoiceListening ? t('assistant.translate.stopVoiceTitle') : t('assistant.translate.startVoiceTitle')}
                                        aria-label={isVoiceListening ? t('assistant.translate.stopVoiceTitle') : t('assistant.translate.startVoiceTitle')}
                                    >
                                        {isVoiceListening ? '🎤⏹' : '🎤'}
                                    </button>
                                </div>
                            </div>

                            <textarea
                                ref={sourceTextareaRef}
                                className="assistant-translate-input"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder={t('assistant.translate.inputPlaceholder')}
                            />

                            <button
                                type="button"
                                className="assistant-translate-submit"
                                disabled={isTranslating}
                                onClick={handleTranslate}
                            >
                                {isTranslating ? t('assistant.translate.translating') : t('assistant.translate.translateBtn')}
                            </button>

                            <div className="assistant-translate-field-head">
                                <span>{t('assistant.translate.translatedText')}</span>
                                <button
                                    type="button"
                                    className="assistant-voice-btn"
                                    onClick={handleSpeakTranslatedText}
                                    title={t('assistant.translate.speakTranslatedTitle')}
                                    aria-label={t('assistant.translate.speakTranslatedAria')}
                                >
                                    🔊
                                </button>
                            </div>

                            <div className="assistant-translate-output" aria-live="polite">
                                {translatedText || t('assistant.translate.outputPlaceholder')}
                            </div>

                            {synonyms.length > 0 && (
                                <div className="assistant-translate-synonyms">
                                    <span className="assistant-translate-synonyms-label">
                                        {t('assistant.translate.synonymsLabel')}
                                    </span>
                                    <div className="assistant-translate-synonyms-list">
                                        {synonyms.map(syn => (
                                            <button
                                                key={syn}
                                                type="button"
                                                className="assistant-translate-synonym-chip"
                                                onClick={() => speakText(syn, targetLang)}
                                                title={t('assistant.translate.synonymSpeakTitle')}
                                            >
                                                {syn}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeAction === 'personal-agent' && (
                        <div className="assistant-agent-panel">
                            <p className="assistant-agent-tip">
                                {t('assistant.agent.tip')}
                            </p>

                            <div className="assistant-agent-actions">
                                <button
                                    type="button"
                                    className="assistant-agent-btn is-secondary"
                                    onClick={() => setIsAgentConfigExpanded(prev => !prev)}
                                >
                                    {isAgentConfigExpanded ? t('assistant.agent.collapseConfig') : t('assistant.agent.expandConfig')}
                                </button>
                                <button type="button" className="assistant-agent-btn" onClick={handleResetAgentChat}>
                                    {t('assistant.agent.clearChat')}
                                </button>
                            </div>

                            {isAgentConfigExpanded && (
                                <div className="assistant-agent-config-wrap">
                                    <div className="assistant-agent-config-grid">
                                        <label className="assistant-agent-field">
                                            {t('assistant.agent.nameLabel')}
                                            <input
                                                type="text"
                                                value={agentProfile.name}
                                                onChange={e => handleAgentFieldChange('name', e.target.value)}
                                                placeholder={t('assistant.agent.namePlaceholder')}
                                            />
                                        </label>

                                        <label className="assistant-agent-field">
                                            {t('assistant.agent.roleLabel')}
                                            <textarea
                                                value={agentProfile.role}
                                                onChange={e => handleAgentFieldChange('role', e.target.value)}
                                                placeholder={t('assistant.agent.rolePlaceholder')}
                                            />
                                        </label>

                                        <label className="assistant-agent-field">
                                            {t('assistant.agent.goalLabel')}
                                            <textarea
                                                value={agentProfile.goal}
                                                onChange={e => handleAgentFieldChange('goal', e.target.value)}
                                                placeholder={t('assistant.agent.goalPlaceholder')}
                                            />
                                        </label>

                                        <label className="assistant-agent-field">
                                            {t('assistant.agent.styleLabel')}
                                            <textarea
                                                value={agentProfile.style}
                                                onChange={e => handleAgentFieldChange('style', e.target.value)}
                                                placeholder={t('assistant.agent.stylePlaceholder')}
                                            />
                                        </label>
                                    </div>

                                    <button type="button" className="assistant-agent-btn is-secondary" onClick={handleSaveAgentProfile}>
                                        {t('assistant.agent.saveConfig')}
                                    </button>
                                </div>
                            )}

                            <div className="assistant-agent-chat-window" ref={agentChatViewportRef}>
                                {(agentSteps.length > 0 || isAgentRunning) && (
                                    <div className="assistant-agent-thinking-wrap assistant-agent-thinking-wrap--inline">
                                        <button
                                            type="button"
                                            className="assistant-agent-thinking-head"
                                            onClick={() => setIsAgentThinkingExpanded(prev => !prev)}
                                            aria-expanded={isAgentThinkingExpanded}
                                        >
                                            <span className="assistant-agent-thinking-title">
                                                {t('assistant.agent.thinkingTitle')}
                                                {agentSteps.length > 0 ? ` (${agentSteps.length})` : ''}
                                            </span>
                                            <span className="assistant-agent-thinking-toggle">
                                                {isAgentThinkingExpanded ? '▾' : '▸'}
                                            </span>
                                        </button>

                                        {isAgentThinkingExpanded && (
                                            <div className="assistant-agent-thinking-content">
                                                {agentSteps.length > 0 ? (
                                                    <div className={`agent-step-timeline ${isAgentRunning ? 'is-running' : ''}`}>
                                                        {agentSteps.map((s, idx) => (
                                                            <div
                                                                key={s.id}
                                                                className={`agent-step-item agent-step-item--${s.type} ${idx === agentSteps.length - 1 && isAgentRunning ? 'is-current' : ''}`}
                                                                style={{ animationDelay: `${Math.min(idx * 60, 480)}ms` }}
                                                            >
                                                                <div className={`agent-step-dot ${idx === agentSteps.length - 1 && isAgentRunning ? 'is-pulse' : ''}`}>
                                                                    {STEP_ICON[s.type] || '•'}
                                                                </div>
                                                                <div className="agent-step-body">
                                                                    <div className="agent-step-label">
                                                                        {getStepLabel(s.type, t)}
                                                                        {s.step != null && <span className="agent-step-num"> (Step {s.step})</span>}
                                                                    </div>
                                                                    {s.type === 'thinking' && s.summary && (
                                                                        <div className="agent-step-detail">{s.summary}</div>
                                                                    )}
                                                                    {s.type === 'action' && s.action && (
                                                                        <div className="agent-step-detail">
                                                                            <code>{s.action}</code>
                                                                            {s.params && Object.keys(s.params).length > 0 && (
                                                                                <span className="agent-step-params">
                                                                                    {Object.entries(s.params).map(([k, v]) => `${k}=${v}`).join(', ')}
                                                                                </span>
                                                                            )}
                                                                            {s.reason && <div className="agent-step-reason">{s.reason}</div>}
                                                                        </div>
                                                                    )}
                                                                    {s.type === 'observation' && (
                                                                        <div className="agent-step-detail">
                                                                            <span className={`agent-step-status ${s.status === 'ok' ? 'is-ok' : 'is-err'}`}>
                                                                                {s.status === 'ok' ? t('assistant.agent.stepObsSuccess') : t('assistant.agent.stepObsFail')}
                                                                            </span>
                                                                            {s.summary && <span className="agent-step-summary">{s.summary}</span>}
                                                                        </div>
                                                                    )}
                                                                    {s.type === 'error' && s.summary && (
                                                                        <div className="agent-step-detail agent-step-error-text">{s.summary}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="assistant-agent-thinking-placeholder">
                                                        {t('assistant.agent.thinkingInit')}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {agentMessages.length === 0 && !isAgentReplying && (
                                    <div className="assistant-agent-empty">
                                        {t('assistant.agent.emptyChat')}
                                    </div>
                                )}

                                {agentMessages.map(message => {
                                    const isAssistantMessage = message.role === 'assistant';
                                    const canCollapse = isAssistantMessage && message.content.length > AGENT_MESSAGE_COLLAPSE_THRESHOLD;
                                    const isExpanded = expandedAgentMessageIds[message.id] === true;

                                    return (
                                        <div
                                            key={message.id}
                                            className={`assistant-agent-bubble ${isAssistantMessage ? 'is-assistant' : 'is-user'}`}
                                        >
                                            <div className="assistant-agent-bubble-role">
                                                {isAssistantMessage ? agentProfile.name || t('assistant.agent.fallbackName') : t('assistant.agent.you')}
                                            </div>
                                            <div className={`assistant-agent-bubble-markdown ${canCollapse && !isExpanded ? 'is-collapsed' : ''}`}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>

                                            {canCollapse && (
                                                <button
                                                    type="button"
                                                    className="assistant-agent-bubble-toggle"
                                                    onClick={() => {
                                                        setExpandedAgentMessageIds(prev => ({
                                                            ...prev,
                                                            [message.id]: !prev[message.id],
                                                        }));
                                                    }}
                                                >
                                                    {isExpanded ? t('assistant.agent.collapseMsg') : t('assistant.agent.expandMsg')}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}

                                {shouldShowAgentPendingBubble && (
                                    <div className="assistant-agent-bubble is-assistant is-pending">
                                        <div className="assistant-agent-bubble-role">{agentProfile.name || t('assistant.agent.fallbackName')}</div>
                                        <div className="assistant-agent-pending-text">
                                            <span className="assistant-agent-pending-label">{t('assistant.agent.thinking')}</span>
                                            <span className="assistant-agent-typing-dots" aria-hidden="true">
                                                <i />
                                                <i />
                                                <i />
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="assistant-agent-input-wrap">
                                <textarea
                                    className="assistant-agent-input"
                                    value={agentInputText}
                                    onChange={e => setAgentInputText(e.target.value)}
                                    onKeyDown={handleAgentInputKeyDown}
                                    placeholder={t('assistant.agent.inputPlaceholder')}
                                />
                                <button
                                    type="button"
                                    className="assistant-agent-send-btn"
                                    onClick={() => {
                                        void handleSendAgentMessage();
                                    }}
                                    disabled={isAgentReplying || !agentInputText.trim()}
                                >
                                    {isAgentReplying ? t('assistant.agent.replying') : t('assistant.agent.send')}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeAction === 'todo' && (
                        <div className="assistant-todo-panel">
                            <div className="assistant-todo-input-wrap">
                                <input
                                    type="text"
                                    className="assistant-todo-input"
                                    value={todoInput}
                                    onChange={e => setTodoInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.nativeEvent.isComposing) return;
                                        if (e.key === 'Enter') handleAddTodo();
                                    }}
                                    placeholder={t('assistant.todo.inputPlaceholder')}
                                />
                                <button
                                    type="button"
                                    className="assistant-todo-add-btn"
                                    onClick={handleAddTodo}
                                    disabled={!todoInput.trim()}
                                >
                                    {t('assistant.todo.addBtn')}
                                </button>
                            </div>

                            {todos.length > 0 && (
                                <div className="assistant-todo-meta">
                                    <span className="assistant-todo-remaining">
                                        {t('assistant.todo.remaining').replace('{n}', String(todos.filter(item => !item.done).length))}
                                    </span>
                                    {todos.some(item => item.done) && (
                                        <button
                                            type="button"
                                            className="assistant-todo-clear-btn"
                                            onClick={handleClearCompletedTodos}
                                        >
                                            {t('assistant.todo.cleared')}
                                        </button>
                                    )}
                                </div>
                            )}

                    


                            <div className="assistant-todo-list">
                                {todos.length === 0 ? (
                                    <div className="assistant-todo-empty">{t('assistant.todo.empty')}</div>
                                ) : (
                                    todos.map(item => (
                                        <div
                                            key={item.id}
                                            className={`assistant-todo-item ${item.done ? 'is-done' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                className="assistant-todo-checkbox"
                                                onClick={() => handleToggleTodo(item.id)}
                                                aria-label={item.done ? 'Undo' : 'Done'}
                                            >
                                                {item.done ? '✓' : ''}
                                            </button>
                                            <span className="assistant-todo-text">{item.text}</span>
                                            <button
                                                type="button"
                                                className="assistant-todo-delete-btn"
                                                onClick={() => handleDeleteTodo(item.id)}
                                                aria-label={t('assistant.todo.deleteAria')}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                                        {activeAction === 'shortcuts' && (
                        <div className="assistant-shortcuts-panel">
                            <div className="assistant-shortcuts-input-wrap">
                                <input
                                    type="text"
                                    className="assistant-shortcut-input-title"
                                    value={shortcutTitleInput}
                                    onChange={e => setShortcutTitleInput(e.target.value)}
                                    placeholder={t('assistant.shortcuts.titlePlaceholder')}
                                />
                                <input
                                    type="text"
                                    className="assistant-shortcut-input-url"
                                    value={shortcutUrlInput}
                                    onChange={e => setShortcutUrlInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.nativeEvent.isComposing) return;
                                        if (e.key === 'Enter') handleAddShortcut();
                                    }}
                                    placeholder={t('assistant.shortcuts.urlPlaceholder')}
                                />
                                
                                <div className="assistant-shortcut-options-row">
                                    <label className="assistant-shortcut-newtab-label">
                                        <input
                                            type="checkbox"
                                            checked={shortcutNewTabInput}
                                            onChange={e => setShortcutNewTabInput(e.target.checked)}
                                        />
                                        <span>{t('assistant.shortcuts.newTabLabel')}</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="assistant-shortcut-add-btn"
                                        onClick={handleAddShortcut}
                                        disabled={!shortcutTitleInput.trim() || !shortcutUrlInput.trim()}
                                    >
                                        {t('assistant.shortcuts.addBtn')}
                                    </button>
                                </div>
                            </div>

                            <div className="assistant-shortcuts-list">
                                {customShortcuts.length === 0 ? (
                                    <div className="assistant-shortcuts-empty">{t('assistant.shortcuts.empty')}</div>
                                ) : (
                                    <div className="assistant-shortcuts-grid">
                                        {customShortcuts.map(item => (
                                            <div 
                                                key={item.id} 
                                                className="assistant-shortcut-card" 
                                                onClick={() => handleShortcutClick(item)}
                                                title={item.url}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    className="assistant-shortcut-checkbox"
                                                    checked={!!item.openInNewTab}
                                                    onChange={() => {}}
                                                    onClick={(e) => handleToggleShortcutNewTab(item.id, e)}
                                                    title={t('assistant.shortcuts.newTabLabel')}
                                                />
                                                <span className="shortcut-icon">🔗</span>
                                                <span className="shortcut-label">{item.title}</span>
                                                <button
                                                    type="button"
                                                    className="assistant-shortcut-delete-btn"
                                                    onClick={(e) => handleDeleteShortcut(item.id, e)}
                                                    aria-label={t('assistant.shortcuts.deleteAria')}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}