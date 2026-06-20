import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { apiClient } from '../../api/client';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/writing_service_records.css';

interface RecordItem {
    id: number;
    service_type: string;
    title: string;
    created_at: string;
    subject_category_zh?: string;
    question_type_zh?: string;
    dynamism_zh?: string;
    chart_category_zh?: string;
}

const SERVICE_TYPE_MAP: Record<string, string> = {
    'correction': '📝 作文批改',
    'task1_teacher': '📊 小作文老师',
    'task2_teacher': '🧠 大作文老师',
    'opinion_drill': '💡 观点特训',
    'typing_chat': '💬 打字聊天'
};

export default function WritingServiceRecordsPage() {
    const { lang } = useLang();
    const navigate = useNavigate();
    
    const [records, setRecords] = useState<RecordItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [serviceType, setServiceType] = useState('');

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (search) query.append('search', search);
            if (serviceType) query.append('service_type', serviceType);
            
            const res = await apiClient.get<{status: string, data: RecordItem[]}>(`/writing/records?${query.toString()}`);
            if (res.data.status === 'success') {
                setRecords(res.data.data);
            } else {
                showToast(lang === 'zh' ? '加载记录失败' : 'Failed to load records', 'error');
            }
        } catch (error) {
            console.error('Failed to fetch records:', error);
            showToast(lang === 'zh' ? '加载出错' : 'Error loading records', 'error');
        } finally {
            setLoading(false);
        }
    }, [search, serviceType, lang]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleCardClick = (record: RecordItem) => {
        const routeMap: Record<string, string> = {
            'correction': '/writing/correction',
            'task1_teacher': '/writing/task1-ai-teacher/lesson',
            'task2_teacher': '/writing/ai-teacher/lesson',
            // other routes can be mapped here as well
        };
        const targetRoute = routeMap[record.service_type];
        if (targetRoute) {
            navigate(targetRoute, { state: { record_id: record.id } });
        } else {
            showToast(lang === 'zh' ? '该记录类型的查看页面暂未支持' : 'Viewer not supported for this type', 'info');
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!window.confirm(lang === 'zh' ? '确定要删除这条记录吗？' : 'Are you sure to delete this record?')) return;
        try {
            const res = await apiClient.delete<{status: string}>(`/writing/records/${id}`);
            if (res.data.status === 'success') {
                showToast(lang === 'zh' ? '删除成功' : 'Deleted successfully', 'success');
                fetchRecords();
            } else {
                showToast(lang === 'zh' ? '删除失败' : 'Delete failed', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast(lang === 'zh' ? '删除出错' : 'Delete error', 'error');
        }
    };

    return (
        <Layout
            pageTitle={lang === 'zh' ? '服务记录' : 'Service Records'}
            pageSubtitle={lang === 'zh' ? '回顾您过去的写作练习与 AI 解析' : 'Review your past writing practices and AI feedback'}
            backUrl="/writing/ai-teachers"
            backText={lang === 'zh' ? '返回大厅' : 'Back'}
        >
            <div className="wsr-container">
                <div className="wsr-filters">
                    <input 
                        type="text" 
                        placeholder={lang === 'zh' ? '搜索标题...' : 'Search titles...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="wsr-search-input"
                    />
                    <select 
                        value={serviceType} 
                        onChange={(e) => setServiceType(e.target.value)}
                        className="wsr-type-select"
                    >
                        <option value="">{lang === 'zh' ? '所有类型' : 'All Types'}</option>
                        {Object.entries(SERVICE_TYPE_MAP).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="wsr-loading">{lang === 'zh' ? '加载中...' : 'Loading...'}</div>
                ) : records.length === 0 ? (
                    <div className="wsr-empty">{lang === 'zh' ? '暂无服务记录' : 'No service records found'}</div>
                ) : (
                    <div className="wsr-list">
                        {records.map(record => (
                                <div className="wsr-card" key={record.id} onClick={() => {
                                    if (record.service_type === 'correction') {
                                        navigate('/writing/correction', { state: { record_id: record.id } });
                                    } else if (record.service_type === 'task1_teacher') {
                                        navigate('/writing/task1-ai-teacher/lesson', { state: { record_id: record.id } });
                                    } else if (record.service_type === 'task2_teacher') {
                                        navigate('/writing/ai-teacher/lesson', { state: { record_id: record.id } });
                                    } else {
                                        showToast(lang === 'zh' ? '该记录类型的查看页面暂未支持' : 'Viewer not supported for this type', 'info');
                                    }
                                }}>
                                <div className="wsr-card-header">
                                    <span className="wsr-badge">{SERVICE_TYPE_MAP[record.service_type] || record.service_type}</span>
                                    <button className="wsr-delete-btn" onClick={(e) => handleDelete(e, record.id)}>
                                        &times;
                                    </button>
                                </div>
                                <div className="wsr-card-title">{record.title}</div>
                                
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                                    {record.service_type === 'task2_teacher' && (
                                        <>
                                            {record.subject_category_zh && <span style={{ padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', backgroundColor: '#e0e7ff', color: '#4f46e5', fontWeight: 600 }}>{record.subject_category_zh}</span>}
                                            {record.question_type_zh && <span style={{ padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', backgroundColor: '#fae8ff', color: '#c026d3', fontWeight: 600 }}>{record.question_type_zh}</span>}
                                        </>
                                    )}
                                    {record.service_type === 'task1_teacher' && (
                                        <>
                                            {record.dynamism_zh && <span style={{ padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', backgroundColor: '#dbeafe', color: '#2563eb', fontWeight: 600 }}>{record.dynamism_zh}</span>}
                                            {record.chart_category_zh && <span style={{ padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', backgroundColor: '#fce7f3', color: '#db2777', fontWeight: 600 }}>{record.chart_category_zh}</span>}
                                        </>
                                    )}
                                </div>

                                <div className="wsr-card-date">{new Date(record.created_at).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
