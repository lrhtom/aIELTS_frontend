import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import {
    deleteCreativeWorkshopProject,
    getCreativeWorkshopProject,
    toggleCreativeWorkshopFavorite,
    type CreativeWorkshopProject,
} from '../../api/creative_workshop';
import '../../styles/creative_workshop.css';

export default function CreativeWorkshopPreviewPage() {
    const { translations: t } = useLang();
    const navigate = useNavigate();
    const { id } = useParams();

    const [project, setProject] = useState<CreativeWorkshopProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        (async () => {
            if (!id) {
                showToast(t.creativeWorkshop.invalidProject, 'error');
                navigate('/creative-workshop', { replace: true });
                return;
            }

            const projectId = Number(id);
            if (!Number.isFinite(projectId)) {
                showToast(t.creativeWorkshop.invalidProject, 'error');
                navigate('/creative-workshop', { replace: true });
                return;
            }

            try {
                const { project: data } = await getCreativeWorkshopProject(projectId);
                setProject(data);
            } catch {
                showToast(t.creativeWorkshop.loadDetailFail, 'error');
                navigate('/creative-workshop', { replace: true });
            } finally {
                setLoading(false);
            }
        })();
    }, [id, navigate, t.creativeWorkshop.invalidProject, t.creativeWorkshop.loadDetailFail]);

    const handleToggleFavorite = async () => {
        if (!project) return;
        try {
            const next = !project.is_favorited;
            await toggleCreativeWorkshopFavorite(project.id, next);
            setProject((prev) => (prev ? { ...prev, is_favorited: next } : prev));
            showToast(next ? t.creativeWorkshop.favoriteSuccess : t.creativeWorkshop.unfavoriteSuccess, 'success');
        } catch {
            showToast(t.creativeWorkshop.favoriteFail, 'error');
        }
    };

    const handleDelete = async () => {
        if (!project) return;
        const confirmed = window.confirm(
            t.creativeWorkshop.deleteConfirm.replace('{title}', project.title),
        );
        if (!confirmed) return;

        setDeleting(true);
        try {
            await deleteCreativeWorkshopProject(project.id);
            showToast(t.creativeWorkshop.deleteSuccess, 'success');
            navigate('/creative-workshop', { replace: true });
        } catch {
            showToast(t.creativeWorkshop.deleteFail, 'error');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Layout>
            <div className="cw-page-wrap">
                <header className="cw-page-header">
                    <div>
                        <h1>{project?.title || t.creativeWorkshop.previewTitle}</h1>
                        <p>{t.creativeWorkshop.previewSubtitle}</p>
                    </div>
                    <div className="cw-preview-actions">
                        <button className="cw-favorites-entry" onClick={() => navigate('/creative-workshop')}>
                            {t.creativeWorkshop.backToHome}
                        </button>
                        <button
                            className={`cw-favorites-entry alt ${project?.is_favorited ? 'active' : ''}`}
                            onClick={handleToggleFavorite}
                            disabled={!project}
                        >
                            {project?.is_favorited ? t.creativeWorkshop.unfavoriteBtn : t.creativeWorkshop.favoriteBtn}
                        </button>
                        <button
                            className="cw-favorites-entry danger"
                            onClick={handleDelete}
                            disabled={!project || deleting}
                        >
                            {deleting ? t.common.loading : t.creativeWorkshop.deleteBtn}
                        </button>
                    </div>
                </header>

                <section className="cw-preview-card">
                    {loading ? (
                        <div className="cw-empty">{t.common.loading}</div>
                    ) : (
                        <iframe
                            title={project?.title || 'creative-workshop-preview'}
                            className="cw-preview-frame"
                            srcDoc={project?.generated_html || ''}
                            sandbox="allow-scripts allow-forms allow-modals allow-popups"
                        />
                    )}
                </section>
            </div>
        </Layout>
    );
}
