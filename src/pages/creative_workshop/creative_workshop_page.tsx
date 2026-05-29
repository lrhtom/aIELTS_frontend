import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import AiModelSelector from '../../components/common/AiModelSelector';
import {
    deleteCreativeWorkshopProject,
    generateCreativeWorkshopProject,
    listCreativeWorkshopProjects,
    toggleCreativeWorkshopFavorite,
    type CreativeWorkshopProject,
} from '../../api/creative_workshop';
import { formatTime } from '../../utils/format';
import '../../styles/creative_workshop.css';

export default function CreativeWorkshopPage() {
    const { translations: t } = useLang();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<CreativeWorkshopProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [methodPrompt, setMethodPrompt] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const { projects: data } = await listCreativeWorkshopProjects(false);
                setProjects(data);
            } catch {
                showToast(t.creativeWorkshop.loadFail, 'error');
            } finally {
                setLoading(false);
            }
        })();
    }, [t.creativeWorkshop.loadFail]);

    const generatedCount = projects.length;

    const favoriteCount = useMemo(
        () => projects.filter((project) => project.is_favorited).length,
        [projects],
    );

    const handleGenerate = async () => {
        const prompt = methodPrompt.trim();
        if (!prompt) {
            showToast(t.creativeWorkshop.methodRequired, 'error');
            return;
        }

        setSubmitting(true);
        try {
            const { project } = await generateCreativeWorkshopProject(prompt, title.trim());
            setProjects((prev) => [project, ...prev]);
            setMethodPrompt('');
            if (!title.trim()) {
                setTitle('');
            }
            showToast(t.creativeWorkshop.generateSuccess, 'success');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || t.creativeWorkshop.generateFail;
            showToast(msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleFavorite = async (project: CreativeWorkshopProject) => {
        try {
            const target = !project.is_favorited;
            await toggleCreativeWorkshopFavorite(project.id, target);
            setProjects((prev) => prev.map((item) => (
                item.id === project.id ? { ...item, is_favorited: target } : item
            )));
            showToast(target ? t.creativeWorkshop.favoriteSuccess : t.creativeWorkshop.unfavoriteSuccess, 'success');
        } catch {
            showToast(t.creativeWorkshop.favoriteFail, 'error');
        }
    };

    const handleDeleteProject = async (project: CreativeWorkshopProject) => {
        const confirmed = window.confirm(
            t.creativeWorkshop.deleteConfirm.replace('{title}', project.title),
        );
        if (!confirmed) return;

        setDeletingId(project.id);
        try {
            await deleteCreativeWorkshopProject(project.id);
            setProjects((prev) => prev.filter((item) => item.id !== project.id));
            showToast(t.creativeWorkshop.deleteSuccess, 'success');
        } catch {
            showToast(t.creativeWorkshop.deleteFail, 'error');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Layout
            pageTitle={t.creativeWorkshop.title}
            pageSubtitle={t.creativeWorkshop.subtitle}
            headerRight={
                <button
                    className="cw-favorites-entry"
                    onClick={() => navigate('/creative-workshop/favorites')}
                >
                    {t.creativeWorkshop.goToFavorites}
                </button>
            }
        >
            <div className="cw-page-wrap">

                <section className="cw-editor-card">
                    <div className="cw-grid">
                        <label className="cw-field">
                            <span>{t.creativeWorkshop.pageTitleLabel}</span>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={120}
                                placeholder={t.creativeWorkshop.pageTitlePlaceholder}
                            />
                        </label>
                        <label className="cw-field">
                            <span>{t.creativeWorkshop.methodLabel}</span>
                            <textarea
                                value={methodPrompt}
                                onChange={(e) => setMethodPrompt(e.target.value)}
                                maxLength={3000}
                                rows={8}
                                placeholder={t.creativeWorkshop.methodPlaceholder}
                            />
                        </label>
                        <div className="cw-field" style={{ marginTop: '4px' }}>
                            <AiModelSelector description="" />
                        </div>
                    </div>
                    <div className="cw-editor-footer">
                        <div className="cw-counter">
                            <span>{t.creativeWorkshop.totalPages.replace('{n}', String(generatedCount))}</span>
                            <span>{t.creativeWorkshop.totalFavorites.replace('{n}', String(favoriteCount))}</span>
                        </div>
                        <button
                            className="cw-generate-btn"
                            onClick={handleGenerate}
                            disabled={submitting}
                        >
                            {submitting ? t.creativeWorkshop.generatingBtn : t.creativeWorkshop.generateBtn}
                        </button>
                    </div>
                </section>

                <section className="cw-list-card">
                    <div className="cw-section-title">{t.creativeWorkshop.myPagesTitle}</div>
                    {loading ? (
                        <div className="cw-empty">{t.common.loading}</div>
                    ) : projects.length === 0 ? (
                        <div className="cw-empty">{t.creativeWorkshop.emptyPages}</div>
                    ) : (
                        <div className="cw-list">
                            {projects.map((project) => (
                                <article className="cw-item" key={project.id}>
                                    <div className="cw-item-top">
                                        <h3>{project.title}</h3>
                                        <div className="cw-item-top-actions">
                                            <button
                                                className="cw-delete-btn"
                                                style={{ color: '#0369a1', borderColor: '#0ea5e9', background: '#e0f2fe' }}
                                                onClick={() => navigate(`/creative-workshop/edit/${project.id}`)}
                                                title="AI Edit"
                                            >
                                                📝
                                            </button>
                                            <button
                                                className={`cw-star ${project.is_favorited ? 'active' : ''}`}
                                                onClick={() => handleToggleFavorite(project)}
                                                title={project.is_favorited ? t.creativeWorkshop.unfavoriteBtn : t.creativeWorkshop.favoriteBtn}
                                            >
                                                {project.is_favorited ? '★' : '☆'}
                                            </button>
                                            <button
                                                className="cw-delete-btn"
                                                onClick={() => handleDeleteProject(project)}
                                                disabled={deletingId === project.id}
                                                title={t.creativeWorkshop.deleteBtn}
                                            >
                                                {deletingId === project.id ? t.common.loading : t.creativeWorkshop.deleteBtn}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="cw-item-desc">{project.method_prompt}</p>
                                    <div className="cw-item-bottom">
                                        <span>{t.creativeWorkshop.updatedAt.replace('{time}', formatTime(project.updated_at))}</span>
                                        <button
                                            className="cw-open-btn"
                                            onClick={() => navigate(`/creative-workshop/pages/${project.id}`)}
                                        >
                                            {t.creativeWorkshop.openPage}
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </Layout>
    );
}
