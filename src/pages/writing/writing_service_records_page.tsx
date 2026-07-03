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

const EN_TAG_MAP: Record<string, string> = {
    '教育类': 'Education',
    '科技类': 'Technology',
    '传统与文化类': 'Culture',
    '城市化与环境类': 'Urbanization',
    '政府与社会类': 'Government',
    '环境类': 'Environment',
    '媒体类': 'Media',
    '社会类': 'Society',
    '抽象与现代类': 'Abstract',
    '创新类': 'Innovation',
    '同意与否类 (Agree / Disagree)': 'Agree / Disagree',
    '双边讨论类 (Discuss both views)': 'Discuss both views',
    '优缺点类 (Advantages / Disadvantages)': 'Advantages / Disadvantages',
    '动态图 (Dynamic)': 'Dynamic',
    '静态图 (Static)': 'Static',
    '折线图 (Line Chart)': 'Line Chart',
    '饼状图 (Pie Chart)': 'Pie Chart',
    '柱状图 (Bar Chart)': 'Bar Chart',
    '表格题 (Table)': 'Table',
    '混合图 (Mixed)': 'Mixed',
    '地图题 (Map)': 'Map',
    '流程图 (Flowchart)': 'Flowchart',
};

export default function WritingServiceRecordsPage() {
    const { lang, translations } = useLang();
    const t = translations.writingHub?.records;
    const navigate = useNavigate();
    
    const translateTag = (zhTag: string | undefined) => {
        if (!zhTag) return null;
        if (lang === 'zh') return zhTag;
        return EN_TAG_MAP[zhTag] || zhTag;
    };

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
                showToast(t?.loadFail || 'Failed to load records', 'error');
            }
        } catch (error) {
            console.error('Failed to fetch records:', error);
            showToast(t?.error || 'Error loading records', 'error');
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
            showToast(t?.viewerNotSupported || 'Viewer not supported for this type', 'info');
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!window.confirm(t?.deleteConfirm || 'Are you sure to delete this record?')) return;
        try {
            const res = await apiClient.delete<{status: string}>(`/writing/records/${id}`);
            if (res.data.status === 'success') {
                showToast(t?.deleteSuccess || 'Deleted successfully', 'success');
                fetchRecords();
            } else {
                showToast(t?.deleteFail || 'Delete failed', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast(t?.deleteFail || 'Delete error', 'error');
        }
    };

    return (
        <Layout
            pageTitle={t?.pageTitle || 'Service Records'}
            pageSubtitle={t?.pageSubtitle || 'Review your past writing practices and AI feedback'}
            backUrl="/writing/ai-teachers"
            backText={t?.backToHub || 'Back'}
        >
            <div className="wsr-container">
                <div className="wsr-filters">
                    <input 
                        type="text" 
                        placeholder={t?.searchPlaceholder || 'Search titles...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="wsr-search-input"
                    />
                    <select 
                        value={serviceType} 
                        onChange={(e) => setServiceType(e.target.value)}
                        className="wsr-type-select"
                    >
                        <option value="">{t?.allTypes || 'All Types'}</option>
                        {Object.entries(t?.serviceTypes || {}).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="wsr-loading">{t?.loading || 'Loading...'}</div>
                ) : records.length === 0 ? (
                    <div className="wsr-empty">{t?.empty || 'No service records found'}</div>
                ) : (
                    <div className="wsr-list">
                        {records.map(record => (
                                <div className="wsr-card" key={record.id} onClick={() => handleCardClick(record)}>
                                <div className="wsr-card-header">
                                    <span className="wsr-badge">{(t?.serviceTypes as any)?.[record.service_type] || record.service_type}</span>
                                    <button className="wsr-delete-btn" onClick={(e) => handleDelete(e, record.id)}>
                                        &times;
                                    </button>
                                </div>
                                <div className="wsr-card-title">{record.title}</div>
                                
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
                                    {record.service_type === 'task2_teacher' && (
                                        <>
                                            {record.subject_category_zh && <span style={{ padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', backgroundColor: '#e0e7ff', color: '#4f46e5', fontWeight: 600 }}>{translateTag(record.subject_category_zh)}</span>}
                                            {record.question_type_zh && <span style={{ padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', backgroundColor: '#fae8ff', color: '#c026d3', fontWeight: 600 }}>{translateTag(record.question_type_zh)}</span>}
                                        </>
                                    )}
                                    {record.service_type === 'task1_teacher' && (
                                        <>
                                            {record.dynamism_zh && <span style={{ padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', backgroundColor: '#dbeafe', color: '#2563eb', fontWeight: 600 }}>{translateTag(record.dynamism_zh)}</span>}
                                            {record.chart_category_zh && <span style={{ padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', backgroundColor: '#fce7f3', color: '#db2777', fontWeight: 600 }}>{translateTag(record.chart_category_zh)}</span>}
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
