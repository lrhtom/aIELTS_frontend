import Layout from '../components/Layout';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/practice_page.css';

export default function ChartSelectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [selectedChart, setSelectedChart] = useState<string>('line');

    const chartTypes = [
        { id: 'line', icon: '📈', nameZh: '折线图', nameEn: 'Line graph' },
        { id: 'pie', icon: '🥧', nameZh: '饼状图', nameEn: 'Pie chart' },
        { id: 'bar', icon: '📊', nameZh: '柱状图', nameEn: 'Bar chart' },
        { id: 'horizontal', icon: '🛶', nameZh: '横向图', nameEn: 'Horizontal chart' },
        { id: 'table', icon: '🧮', nameZh: '表格', nameEn: 'Table/chart' },
        { id: 'random', icon: '🎲', nameZh: '随机', nameEn: 'Random' }
    ];

    const handleStart = () => {
        navigate(`/writing/chart/doing?type=${selectedChart}`);
    };

    return (
        <Layout>
            <div className="practice-hub-container" style={{ padding: '2rem' }}>
                <div className="practice-header">
                    <Link to="/writing" className="back-link">← AI写作大厅</Link>
                    <h1>📊 图表题 (Chart Question)</h1>
                    <p>选择接下来的 Task 1 小作文要挑战的图表类型</p>
                </div>

                <div className="config-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '2rem' }}>

                    <div className="chart-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {chartTypes.map(chart => (
                            <button
                                key={chart.id}
                                className={`chart-card-btn ${selectedChart === chart.id ? 'active' : ''}`}
                                onClick={() => setSelectedChart(chart.id)}
                            >
                                <span className="chart-icon">{chart.icon}</span>
                                <div className="chart-title">
                                    {chart.nameZh}
                                </div>
                                <div className="chart-desc">
                                    {chart.nameEn}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <button
                            className="primary-button"
                            style={{ padding: '12px 48px', fontSize: '1.1rem' }}
                            onClick={handleStart}
                        >
                            开始练习
                        </button>
                    </div>

                </div>
            </div>
        </Layout>
    );
}
