import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { appendCustomDeck, createCustomDeck } from '../../api/custom_memory';
import '../../styles/practice_page.css';
import '../../styles/custom_memory_cards.css';

interface CreateLocationState {
    prefillDeckId?: number;
    prefillTitle?: string;
    prefillDailyCount?: number;
}

export default function CustomMemoryCreatePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const [targetDeckId, setTargetDeckId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [dailyCount, setDailyCount] = useState(20);
    const [frontText, setFrontText] = useState('');
    const [backText, setBackText] = useState('');
    const [batchByLine, setBatchByLine] = useState(true);
    const [creating, setCreating] = useState(false);

    const estimatedCount = useMemo(() => {
        if (!batchByLine) {
            return frontText.trim() ? 1 : 0;
        }
        return frontText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .length;
    }, [batchByLine, frontText]);

    const submitText = useMemo(() => {
        if (batchByLine) {
            const frontLines = frontText.split(/\r?\n/).map((line) => line.trim());
            const backLines = backText.split(/\r?\n/).map((line) => line.trim());
            const merged: string[] = [];

            for (let i = 0; i < frontLines.length; i += 1) {
                const front = frontLines[i];
                if (!front) continue;
                const back = backLines[i] || '';
                merged.push(back ? `${front} - ${back}` : front);
            }

            return merged.join('\n');
        }

        const frontSingle = frontText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' ');
        const backSingle = backText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' ');

        if (!frontSingle) return '';
        return backSingle ? `${frontSingle} - ${backSingle}` : frontSingle;
    }, [backText, batchByLine, frontText]);

    useEffect(() => {
        const state = location.state as CreateLocationState | null;
        if (!state) return;

        if (typeof state.prefillDeckId === 'number' && Number.isFinite(state.prefillDeckId) && state.prefillDeckId > 0) {
            setTargetDeckId(Math.round(state.prefillDeckId));
        }

        if (typeof state.prefillTitle === 'string' && state.prefillTitle.trim()) {
            setTitle(state.prefillTitle.trim());
        }

        if (typeof state.prefillDailyCount === 'number' && Number.isFinite(state.prefillDailyCount)) {
            setDailyCount(Math.min(200, Math.max(1, Math.round(state.prefillDailyCount))));
        }
    }, [location.state]);

    const handleCreate = async () => {
        const normalizedTitle = title.trim();
        const text = submitText;
        if (!normalizedTitle) {
            showToast('请先填写计划名称', 'error');
            return;
        }
        if (!Number.isInteger(dailyCount) || dailyCount < 1 || dailyCount > 200) {
            showToast('每日学习卡片数量必须在 1-200 之间', 'error');
            return;
        }
        if (!text) {
            showToast('请先输入要制作记忆卡的文本', 'error');
            return;
        }

        setCreating(true);
        try {
            if (targetDeckId !== null) {
                const { cards_added } = await appendCustomDeck(targetDeckId, text);
                showToast(`已添加 ${cards_added} 张卡片`, 'success');
                navigate('/vocabulary/plans', { replace: true });
                return;
            }

            const { deck, cards } = await createCustomDeck(normalizedTitle, text, dailyCount);
            if (!cards.length) {
                showToast('今日学习卡片已完成，或暂无可学习卡片', 'success');
                return;
            }
            navigate('/vocabulary/custom-cards/study', {
                state: {
                    deckId: deck.id,
                    deckTitle: deck.title,
                    dailyCount: deck.daily_count,
                    cards,
                },
            });
        } catch (e: unknown) {
            const msg = (e as any)?.response?.data?.error || '创建记忆卡失败，请稍后再试'; // eslint-disable-line @typescript-eslint/no-explicit-any
            showToast(msg, 'error');
        } finally {
            setCreating(false);
        }
    };

    return (
        <Layout
    pageTitle={targetDeckId !== null ? '添加自定义记忆卡' : '自定义记忆卡'}
    pageSubtitle="\n                        {targetDeckId !== null\n                            ? '当前为添加模式：将把卡片追加到已有卡组。'\n                            : '输入文本后自动生成记忆卡，复习调度使用和背单词一致的 FSRS 算法。'}\n                    "
    backUrl='/vocabulary/plans'
    backText='返回词汇学习'
>
            <div className="config-page-wrap cm-create-wrap">
                <div className="config-card">
                    <h3>计划名称</h3>
                    <input
                        className="cm-input"
                        type="text"
                        value={title}
                        maxLength={100}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="例如：雅思高频句 / 阅读错题 / 自定义笔记"
                        disabled={targetDeckId !== null}
                    />
                </div>

                <div className="config-card">
                    <h3>每日学习卡片数量（1-200）</h3>
                    <input
                        className="cm-input"
                        type="number"
                        min={1}
                        max={200}
                        value={dailyCount}
                        onChange={(e) => setDailyCount(Number(e.target.value))}
                        disabled={targetDeckId !== null}
                    />
                </div>

                <div className="config-card">
                    <h3>输入文本</h3>
                    <label className="cm-check-row">
                        <input
                            type="checkbox"
                            checked={batchByLine}
                            onChange={(e) => setBatchByLine(e.target.checked)}
                        />
                        <span>使用换行自动判断批导入（按行匹配正面与背面）</span>
                    </label>
                    <div className="cm-dual-grid">
                        <div>
                            <div className="cm-field-title">正面</div>
                            <textarea
                                className="cm-textarea cm-textarea-short"
                                value={frontText}
                                onChange={(e) => setFrontText(e.target.value)}
                                placeholder={batchByLine
                                    ? [
                                        '每行一条正面内容：',
                                        'abandon',
                                        'sustainable',
                                        'This sentence is important.',
                                    ].join('\n')
                                    : '输入单张卡片的正面内容（可多行，将自动合并）'}
                            />
                        </div>

                        <div>
                            <div className="cm-field-title">背面</div>
                            <textarea
                                className="cm-textarea cm-textarea-short"
                                value={backText}
                                onChange={(e) => setBackText(e.target.value)}
                                placeholder={batchByLine
                                    ? [
                                        '每行一条背面内容（可留空）：',
                                        '放弃',
                                        '可持续的',
                                        '这句话在雅思写作中很重要。',
                                    ].join('\n')
                                    : '输入单张卡片的背面内容（可选）'}
                            />
                        </div>
                    </div>

                    <textarea
                        className="cm-hidden-textarea"
                        readOnly
                        value={submitText}
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                    <p className="cm-hint">
                        当前预计导入 <strong>{estimatedCount}</strong> 张；系统会自动去重；单次最多创建 300 张卡片。
                    </p>
                </div>

                <div className="config-card">
                    <button
                        className="skill-btn reading"
                        style={{ width: '100%' }}
                        disabled={creating}
                        onClick={handleCreate}
                    >
                        {targetDeckId !== null
                            ? (creating ? '添加中...' : '添加到卡组')
                            : (creating ? '创建中...' : '开始学习自定义记忆卡')}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
