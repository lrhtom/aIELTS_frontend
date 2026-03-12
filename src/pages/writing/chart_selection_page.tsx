import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/practice_page.css';
import { useLang } from '../../i18n/LanguageContext';

export default function ChartSelectionPage() {
    const navigate = useNavigate();
    const { translations: t } = useLang();
    const [selectedChart, setSelectedChart] = useState<string>('line');

    const chartTypes = [
        { id: 'line', icon: '📈', nameZh: t.chartSelection.types.line.title, nameEn: t.chartSelection.types.line.nameEn },
        { id: 'pie', icon: '🥧', nameZh: t.chartSelection.types.pie.title, nameEn: t.chartSelection.types.pie.nameEn },
        { id: 'bar', icon: '📊', nameZh: t.chartSelection.types.bar.title, nameEn: t.chartSelection.types.bar.nameEn },
        { id: 'horizontal', icon: '🛶', nameZh: t.chartSelection.types.horizontal.title, nameEn: t.chartSelection.types.horizontal.nameEn },
        { id: 'table', icon: '🧮', nameZh: t.chartSelection.types.table.title, nameEn: t.chartSelection.types.table.nameEn },
        { id: 'random', icon: '🎲', nameZh: t.chartSelection.types.random.title, nameEn: t.chartSelection.types.random.nameEn }
    ];

    const handleStart = () => {
        if (selectedChart === 'random') {
            const chartPool = ['line', 'pie', 'bar', 'horizontal', 'table'];
            const randomType = chartPool[Math.floor(Math.random() * chartPool.length)];
            navigate(`/writing/chart/doing?type=${randomType}`);
            return;
        }
        
        navigate(`/writing/chart/doing?type=${selectedChart}`);
    };

    return (
        <Layout>
            <div className="practice-hub-container" style={{ padding: '2rem' }}>
                <div className="practice-header">
                    <Link to="/writing/task1" className="back-link">{t.chartSelection.backToHub}</Link>
                    <h1>{t.chartSelection.heading}</h1>
                    <p>{t.chartSelection.subheading}</p>
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
                            {t.chartSelection.startBtn}
                        </button>
                    </div>

                </div>
            </div>
        </Layout>
    );
}
