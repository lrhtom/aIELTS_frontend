import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import translate from 'translate';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiClient, fetchStream } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';

async function readSseStream(
    response: Response,
    onMessage: (data: any) => void
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

        let parsed: any;
        try {
            parsed = JSON.parse(payload);
        } catch (e) {
            console.warn('SSE JSON parse error', e, payload);
            return;
        }

        // 业务回调错误需要向外抛出，避免被当作 JSON 解析错误吞掉。
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
type AssistantAction = 'translate' | 'personal-agent' | null;
type TranslateEngine = 'google' | 'deepl' | 'libre' | 'yandex';

interface BrowserSpeechRecognitionResultAlternative {
    transcript?: string;
}

interface BrowserSpeechRecognitionResultEntry {
    [index: number]: BrowserSpeechRecognitionResultAlternative | undefined;
    0?: BrowserSpeechRecognitionResultAlternative;
}

interface BrowserSpeechRecognitionEventLike {
    results?: ArrayLike<BrowserSpeechRecognitionResultEntry>;
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

function mapSpeechRecognitionError(errorCode: string) {
    if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        return '未获得麦克风权限，请允许浏览器访问麦克风后重试。';
    }
    if (errorCode === 'no-speech') {
        return '未检测到语音输入，请靠近麦克风后重试。';
    }
    if (errorCode === 'audio-capture') {
        return '麦克风不可用，请检查录音设备。';
    }
    if (errorCode === 'network') {
        return '语音识别网络异常，请稍后重试。';
    }
    return '语音识别失败，请稍后重试。';
}

function buildPersonalAgentSystemPrompt(profile: PersonalAgentProfile) {
    const normalized = {
        name: profile.name.trim() || '我的个人 AI Agent',
        role: profile.role.trim() || '你是一位可靠、耐心、结果导向的学习教练。',
        goal: profile.goal.trim() || '帮助我拆解任务并给出可执行建议。',
        style: profile.style.trim() || '先结论，再步骤，使用简洁清晰的中文。',
    };

    return [
        `你是 ${normalized.name}。`,
        '## 核心身份',
        normalized.role,
        '## 目标',
        normalized.goal,
        '## 回复风格',
        normalized.style,
        '## 执行规则',
        '1. 如果信息不完整，先列出你需要的最少补充信息。',
        '2. 优先给出可直接执行的方案和示例。',
        '3. 回答使用 Markdown，关键步骤使用编号列表。',
        '4. 若有风险或不确定项，明确写出假设与备选方案。',
    ].join('\n\n');
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
        // 浏览器/代码分析
        '点击', 'click', 'selector', '选择器', 'playwright', 'dom', '页面元素',
        '浏览器 agent', 'browser agent', '自动化', '填入', '按钮',
        '当前页面', '页面内容', '分析页面', '分析网页', '当前网页', '网页内容', '看看页面',
        '前端代码', '前端代码dom', '前端目录', '源码', '代码结构',
        '读取代码', '代码', '代码目录', 'react', '查看文件', '实现任务', '多轮任务',
        // 数据查询 / Agent 工具意图
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

const STEP_LABEL: Record<string, string> = {
    thinking: '思考中',
    action: '调用工具',
    observation: '观察结果',
    final: '完成',
    error: '出错',
};

export default function GlobalAssistantBall() {
    const navigate = useNavigate();
    const location = useLocation();
    const { lang } = useLang();
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
    const [isTranslating, setIsTranslating] = useState(false);
    const [isVoiceListening, setIsVoiceListening] = useState(false);
    const [agentProfile, setAgentProfile] = useState<PersonalAgentProfile>({
        name: '我的雅思教练',
        role: '你是一位专注雅思备考的私人 AI 学习教练。',
        goal: '帮助我制定每天可执行的学习计划，并及时纠正表达问题。',
        style: '先给结论，再给分步骤建议，内容简洁且可落地。',
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
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }

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
            showToast('请输入要翻译的文本', 'error');
            return;
        }

        if (sourceLang !== 'auto' && sourceLang === targetLang) {
            showToast('源语言和目标语言不能相同', 'error');
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

            setTranslatedText(decodeHtmlEntities(translated));
            showToast('翻译完成', 'success');
        } catch (error) {
            console.error('Translate failed', error);
            showToast('翻译失败，请稍后再试', 'error');
        } finally {
            setIsTranslating(false);
        }
    }, [inputText, sourceLang, targetLang]);

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
            const transcript = Array.from(event.results ?? [])
                .map((result) => String(result?.[0]?.transcript || '').trim())
                .filter(Boolean)
                .join(' ')
                .trim();

            if (!transcript) {
                return;
            }

            setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
        };

        recognition.onerror = (event) => {
            const message = mapSpeechRecognitionError(String(event.error || '').trim());
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
    }, [activeAction, isVoiceListening, sourceLang]);

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
            showToast('没有可播放的文本', 'error');
            return;
        }

        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            showToast('当前浏览器不支持语音播放', 'error');
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(trimmed);
        utterance.lang = detectSpeechLangFromText(trimmed, lang);
        utterance.rate = 0.96;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
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
            showToast('请先完整填写个人 AI Agent 的四项设定', 'error');
            return;
        }

        try {
            window.localStorage.setItem(PERSONAL_AGENT_STORAGE_KEY, JSON.stringify(normalizedProfile));
            setAgentProfile(normalizedProfile);
            showToast('个人 AI Agent 设定已保存', 'success');
        } catch (error) {
            console.error('Save personal agent profile failed', error);
            showToast('保存失败，请稍后再试', 'error');
        }
    };

    const handleResetAgentChat = () => {
        setAgentMessages([]);
        setExpandedAgentMessageIds({});
        setBrowserAgentSessionId(null);
        setAgentSteps([]);
        setIsAgentRunning(false);
        setIsAgentThinkingExpanded(false);
        showToast('已清空对话', 'success');
    };

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
                routeReason = '后端已禁用 MCP route，使用前端回退路由。';
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
                    summary: `路由判定：${routeMode}${routeReason ? `（${routeReason}）` : ''}`,
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

                        await readSseStream(response, (data: any) => {
                            const serverRequestId = String(data?.mcp?.request_id || '').trim();
                            if (serverRequestId && serverRequestId !== mcpRequestId) {
                                // 多用户并发防护：仅消费当前请求 ID 对应的 SSE 事件。
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
                            throw new Error('Agent 未返回结果');
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
                    summary: 'open_pages 模式已禁用，自动降级到 direct。',
                }]);
            }

            const systemPrompt = buildPersonalAgentSystemPrompt(agentProfile);
            const assistId = `${Date.now()}-a-${Math.random().toString(16).slice(2, 8)}`;

            const response = await fetchStream('/assistant/personal-chat', {
                method: 'POST',
                body: {
                    messages: messagePayload,
                    ui_lang: lang,
                    dom_context: domContext,
                    agent_profile: agentProfile,
                    system_prompt: systemPrompt,
                }
            });

            let receivedReply = false;
            await readSseStream(response, (data: any) => {
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
                throw new Error('AI 未返回内容，请稍后重试');
            }

        } catch (error) {
            console.error('Agent chat failed', error);
            const responseData = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
            const backendMessage = String(responseData?.error || responseData?.message || (error as Error).message || '').trim();
            showToast(backendMessage || '个人 AI Agent 回复失败，请稍后再试', 'error');
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
                aria-label="打开智能助手"
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
                        <div className="assistant-panel-title">智能助手</div>
                        <button
                            type="button"
                            className="assistant-panel-close-btn"
                            title="收起助手"
                            aria-label="收起助手"
                            onClick={() => {
                                setMenuOpen(false);
                                setActiveAction(null);
                                if (dockSide && !isHovering) setIsRevealed(false);
                            }}
                        >
                            ×
                        </button>
                    </div>
                    <div className="assistant-option-list">
                        <button
                            type="button"
                            className={`assistant-option-btn ${activeAction === 'translate' ? 'is-active' : ''}`}
                            onClick={() => setActiveAction(prev => (prev === 'translate' ? null : 'translate'))}
                        >
                            翻译
                        </button>
                        <button
                            type="button"
                            className={`assistant-option-btn ${activeAction === 'personal-agent' ? 'is-active' : ''}`}
                            onClick={() => setActiveAction(prev => (prev === 'personal-agent' ? null : 'personal-agent'))}
                        >
                            个人 AI Agent
                        </button>
                        <button type="button" className="assistant-option-btn" disabled>
                            改写（即将上线）
                        </button>
                        <button type="button" className="assistant-option-btn" disabled>
                            总结（即将上线）
                        </button>
                    </div>

                    {activeAction === 'translate' && (
                        <div className="assistant-translate-panel">
                            <div className="assistant-translate-lang-row">
                                <label>
                                    源语言
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
                                    title="互换源语言和目标语言"
                                    aria-label="互换源语言和目标语言"
                                >
                                    ⇄
                                </button>
                                <label>
                                    目标语言
                                    <select value={targetLang} onChange={e => setTargetLang(e.target.value)}>
                                        <option value="en">English</option>
                                        <option value="zh-CN">中文</option>
                                        <option value="ja">日本語</option>
                                        <option value="es">Español</option>
                                    </select>
                                </label>
                            </div>

                            <div className="assistant-translate-field-head">
                                <span>原文</span>
                                <div className="assistant-translate-btn-group">
                                    <button
                                        type="button"
                                        className="assistant-voice-btn"
                                        onClick={handleSpeakSourceText}
                                        title="朗读原文"
                                        aria-label="朗读原文"
                                    >
                                        🔊
                                    </button>
                                    <button
                                        type="button"
                                        className={`assistant-voice-input-btn ${isVoiceListening ? 'is-listening' : ''}`}
                                        onClick={isVoiceListening ? handleStopVoiceForTranslate : handleStartVoiceForTranslate}
                                        title={isVoiceListening ? '停止语音输入' : '开始语音输入'}
                                        aria-label={isVoiceListening ? '停止语音输入' : '开始语音输入'}
                                    >
                                        {isVoiceListening ? '🎤⏹' : '🎤'}
                                    </button>
                                </div>
                            </div>

                            <textarea
                                className="assistant-translate-input"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="输入要翻译的内容或点击麦克风进行语音输入"
                            />

                            <button
                                type="button"
                                className="assistant-translate-submit"
                                disabled={isTranslating}
                                onClick={handleTranslate}
                            >
                                {isTranslating ? '翻译中...' : '开始翻译'}
                            </button>

                            <div className="assistant-translate-field-head">
                                <span>译文</span>
                                <button
                                    type="button"
                                    className="assistant-voice-btn"
                                    onClick={handleSpeakTranslatedText}
                                    title="朗读译文"
                                    aria-label="朗读译文"
                                >
                                    🔊
                                </button>
                            </div>

                            <div className="assistant-translate-output" aria-live="polite">
                                {translatedText || '翻译结果将显示在这里'}
                            </div>
                        </div>
                    )}

                    {activeAction === 'personal-agent' && (
                        <div className="assistant-agent-panel">
                            <p className="assistant-agent-tip">
                                配置你的专属助手角色，然后直接在下方聊天。
                            </p>

                            <div className="assistant-agent-actions">
                                <button
                                    type="button"
                                    className="assistant-agent-btn is-secondary"
                                    onClick={() => setIsAgentConfigExpanded(prev => !prev)}
                                >
                                    {isAgentConfigExpanded ? '收起设定' : '展开设定'}
                                </button>
                                <button type="button" className="assistant-agent-btn" onClick={handleResetAgentChat}>
                                    清空对话
                                </button>
                            </div>

                            {isAgentConfigExpanded && (
                                <div className="assistant-agent-config-wrap">
                                    <div className="assistant-agent-config-grid">
                                        <label className="assistant-agent-field">
                                            Agent 名称
                                            <input
                                                type="text"
                                                value={agentProfile.name}
                                                onChange={e => handleAgentFieldChange('name', e.target.value)}
                                                placeholder="例如：我的雅思冲刺教练"
                                            />
                                        </label>

                                        <label className="assistant-agent-field">
                                            核心身份
                                            <textarea
                                                value={agentProfile.role}
                                                onChange={e => handleAgentFieldChange('role', e.target.value)}
                                                placeholder="描述这个 Agent 是谁"
                                            />
                                        </label>

                                        <label className="assistant-agent-field">
                                            主要目标
                                            <textarea
                                                value={agentProfile.goal}
                                                onChange={e => handleAgentFieldChange('goal', e.target.value)}
                                                placeholder="描述它最重要的任务"
                                            />
                                        </label>

                                        <label className="assistant-agent-field">
                                            回复风格
                                            <textarea
                                                value={agentProfile.style}
                                                onChange={e => handleAgentFieldChange('style', e.target.value)}
                                                placeholder="描述希望它如何回答"
                                            />
                                        </label>
                                    </div>

                                    <button type="button" className="assistant-agent-btn is-secondary" onClick={handleSaveAgentProfile}>
                                        保存设定
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
                                                Show thinking
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
                                                                        {STEP_LABEL[s.type] || s.type}
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
                                                                                {s.status === 'ok' ? '成功' : '失败'}
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
                                                        正在初始化思考流程...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {agentMessages.length === 0 && !isAgentReplying && (
                                    <div className="assistant-agent-empty">
                                        请输入你的问题，我会按当前 Agent 设定和你连续对话。
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
                                                {isAssistantMessage ? agentProfile.name || '个人 AI Agent' : '你'}
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
                                                    {isExpanded ? '收起' : '展开全文'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}

                                {shouldShowAgentPendingBubble && (
                                    <div className="assistant-agent-bubble is-assistant is-pending">
                                        <div className="assistant-agent-bubble-role">{agentProfile.name || '个人 AI Agent'}</div>
                                        <div className="assistant-agent-pending-text">
                                            <span className="assistant-agent-pending-label">正在思考</span>
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
                                    placeholder="输入消息，按 Enter 发送，Shift + Enter 换行"
                                />
                                <button
                                    type="button"
                                    className="assistant-agent-send-btn"
                                    onClick={() => {
                                        void handleSendAgentMessage();
                                    }}
                                    disabled={isAgentReplying || !agentInputText.trim()}
                                >
                                    {isAgentReplying ? '回复中...' : '发送'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
