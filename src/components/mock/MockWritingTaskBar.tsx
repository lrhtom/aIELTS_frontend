// 全套模拟 · 写作 Task 1 / Task 2 底部切换条 —— 仿听力/阅读的 Part 切换布局，
// 两篇作文在页面间直接互跳（sessionStorage 草稿各自持久化，切换不丢正文），
// 不再经大厅往返。已提交的任务显示 ✅ 且不可再进。
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMockDetail, type MockDetail } from '../../api/mock';
import { mockWritingTaskRoute } from './mock_writing_routes';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/mock.css';

interface Props {
    mockId: number;
    current: 'task1' | 'task2';
}

export function MockWritingTaskBar({ mockId, current }: Props) {
    const navigate = useNavigate();
    const { t } = useLang();
    const [detail, setDetail] = useState<MockDetail | null>(null);

    useEffect(() => {
        let cancelled = false;
        getMockDetail(mockId).then(d => { if (!cancelled) setDetail(d); }).catch(() => { /* 拿不到就不显示切换条 */ });
        return () => { cancelled = true; };
    }, [mockId]);

    if (!detail) return null;
    const wv = detail.parts.writing;

    const routeFor = (sub: 'task1' | 'task2'): string | null =>
        mockWritingTaskRoute(mockId, sub, sub === 'task1' ? wv.task1 : wv.task2);

    const renderTab = (sub: 'task1' | 'task2', label: string) => {
        const target = sub === 'task1' ? wv.task1 : wv.task2;
        const isCurrent = sub === current;
        const answered = Boolean(target?.isAnswered);
        const route = routeFor(sub);
        return (
            <button
                type="button"
                className={`mock-taskbar-tab ${isCurrent ? 'is-current' : ''} ${answered ? 'is-done' : ''}`}
                disabled={isCurrent || answered || !route}
                onClick={() => { if (route) navigate(route); }}
            >
                {label}{answered ? ' ✅' : ''}
            </button>
        );
    };

    return (
        <div className="mock-writing-taskbar">
            {renderTab('task1', t('mock.examMode.switchTask1'))}
            {renderTab('task2', t('mock.examMode.switchTask2'))}
        </div>
    );
}
