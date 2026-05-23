import React, { useState, useMemo, useEffect } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { manualData } from '../../data/manualData';
import type { ManualSection } from '../../data/manualData';

/**
 * UserManual Component
 * Featuring real-time search, breadcrumbs, and a fully collapsible sidebar (Total Hide Mode).
 */
const UserManual: React.FC = () => {
    const { lang, translations: t } = useLang();
    const data = manualData[lang];

    const [searchQuery, setSearchQuery] = useState('');
    const [expandedSections, setExpandedSections] = useState<string[]>([]);
    const [activeSectionId, setActiveSectionId] = useState<string>('');
    const [activeSubsectionId, setActiveSubsectionId] = useState<string>('');
    const [isSidebarClosed, setIsSidebarClosed] = useState(false);

    // Initialize first item on first load
    useEffect(() => {
        if (data.length > 0 && !activeSubsectionId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setExpandedSections([data[0].id]);
            setActiveSectionId(data[0].id);
            setActiveSubsectionId(data[0].subsections[0].id);
        }
    }, [data, activeSubsectionId]);

    // Handle real-time search filtering
    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return data;

        const q = searchQuery.toLowerCase();
        return data.map(section => {
            const matchingSubsections = section.subsections.filter(sub =>
                sub.title.toLowerCase().includes(q) ||
                sub.content.toLowerCase().includes(q) ||
                sub.keywords?.some(k => k.toLowerCase().includes(q))
            );

            if (matchingSubsections.length > 0) {
                return { ...section, subsections: matchingSubsections };
            }
            return null;
        }).filter(Boolean) as ManualSection[];
    }, [data, searchQuery]);

    // Auto-expand sections when searching to show matched results
    useEffect(() => {
        if (searchQuery.trim()) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setExpandedSections(filteredData.map(s => s.id));
        }
    }, [filteredData, searchQuery]);

    const toggleSection = (id: string) => {
        setExpandedSections(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const handleSubsectionClick = (sectionId: string, subsectionId: string) => {
        setActiveSectionId(sectionId);
        setActiveSubsectionId(subsectionId);
    };

    const activeSection = data.find(s => s.id === activeSectionId);
    const activeSubsection = activeSection?.subsections.find(sub => sub.id === activeSubsectionId);

    return (
        <div className="manual-container optimized">
            <div className="manual-header">
                <div className="manual-header-left">
                    <h2>{t.auth.manualTitle}</h2>
                </div>
                <div className="manual-search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder={t.auth.manualSearch}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="manual-search-input"
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>✕</button>
                    )}
                </div>
            </div>

            <div className="manual-layout">
                {/* Left Sidebar */}
                <aside className={`manual-sidebar-wrapper ${isSidebarClosed ? 'closed' : ''}`}>
                    <div className="manual-sidebar">
                        <nav className="manual-nav">
                            {filteredData.length > 0 ? (
                                filteredData.map((section) => (
                                    <div key={section.id} className="manual-nav-group">
                                        <button
                                            className={`manual-group-trigger ${expandedSections.includes(section.id) ? 'expanded' : ''}`}
                                            onClick={() => toggleSection(section.id)}
                                        >
                                            <span className="group-icon">{section.icon}</span>
                                            <span className="group-title">{section.title}</span>
                                            <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>

                                        <div className={`manual-sub-list ${expandedSections.includes(section.id) ? 'open' : ''}`}>
                                            {section.subsections.map((sub) => (
                                                <button
                                                    key={sub.id}
                                                    className={`manual-sub-item ${activeSubsectionId === sub.id ? 'active' : ''}`}
                                                    onClick={() => handleSubsectionClick(section.id, sub.id)}
                                                >
                                                    {sub.title}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="manual-nav-empty">
                                    {t.auth.manualEmpty}
                                </div>
                            )}
                        </nav>
                    </div>
                </aside>

                {/* Toggle Handle - sibling in flex row, always visible */}
                <button
                    className={`manual-toggle-handle ${isSidebarClosed ? 'closed' : ''}`}
                    onClick={() => setIsSidebarClosed(!isSidebarClosed)}
                    title={isSidebarClosed ? (lang === 'zh' ? '展开目录' : 'Expand sidebar') : (lang === 'zh' ? '收起目录' : 'Collapse sidebar')}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={`toggle-icon ${isSidebarClosed ? 'closed' : ''}`}
                    >
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                {/* Right Content Area */}
                <main className="manual-content">
                    {activeSubsection ? (
                        <div className="manual-detail-card fade-in">
                            <nav className="manual-breadcrumbs">
                                <span>{activeSection?.title}</span>
                                <span className="breadcrumb-separator">/</span>
                                <span className="current">{activeSubsection.title}</span>
                            </nav>

                            <div className="detail-header">
                                <span className="detail-icon">{activeSection?.icon}</span>
                                <div className="detail-titles">
                                    <span className="detail-parent-title">{activeSection?.title}</span>
                                    <h3>{activeSubsection.title}</h3>
                                </div>
                            </div>

                            <div className="detail-body">
                                <div className="content-paragraph">
                                    {activeSubsection.content}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="manual-empty-state fade-in">
                            <div className="empty-icon">📖</div>
                            <h3>{t.auth.manualTitle}</h3>
                            <p>{t.auth.manualSearch}</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default UserManual;
