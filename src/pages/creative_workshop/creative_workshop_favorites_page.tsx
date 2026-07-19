import { useEffect, useState } from 'react';
import { showConfirm } from '../../components/common/ConfirmService';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import {
    deleteCreativeWorkshopProject,
    listCreativeWorkshopProjects,
    toggleCreativeWorkshopFavorite,
    type CreativeWorkshopProject,
} from '../../api/creative_workshop';
import { formatTime } from '../../utils/format';
import '../../styles/creative_workshop.css';

export default function CreativeWorkshopFavoritesPage() {
    const { t } = useLang();
    const navigate = useNavigate();
    const [items, setItems] = useState<CreativeWorkshopProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const { projects } = await listCreativeWorkshopProjects(true);
                setItems(projects);
            } catch {
                showToast(t('creativeWorkshop.loadFail'), 'error');
            } finally {
                setLoading(false);
            }
        })();
    }, [t]);

    const handleUnfavorite = async (item: CreativeWorkshopProject) => {
        try {
            await toggleCreativeWorkshopFavorite(item.id, false);
            setItems((prev) => prev.filter((project) => project.id !== item.id));
            showToast(t('creativeWorkshop.unfavoriteSuccess'), 'success');
        } catch {
            showToast(t('creativeWorkshop.favoriteFail'), 'error');
        }
    };

    const handleDelete = async (item: CreativeWorkshopProject) => {
        const confirmed = await showConfirm({
            message: t('creativeWorkshop.deleteConfirm').replace('{title}', item.title),
            danger: true,
        });
        if (!confirmed) return;

        setDeletingId(item.id);
        try {
            await deleteCreativeWorkshopProject(item.id);
            setItems((prev) => prev.filter((project) => project.id !== item.id));
            showToast(t('creativeWorkshop.deleteSuccess'), 'success');
        } catch {
            showToast(t('creativeWorkshop.deleteFail'), 'error');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Layout
            pageTitle={t('creativeWorkshop.favoritesTitle')}
            pageSubtitle={t('creativeWorkshop.favoritesSubtitle')}
            headerRight={
                <button className="cw-favorites-entry" onClick={() => navigate('/creative-workshop')}>
                    {t('creativeWorkshop.backToHome')}
                </button>
            }
        >
            <div className="cw-page-wrap">

                <section className="cw-list-card">
                    {loading ? (
                        <div className="cw-empty">{t('common.loading')}</div>
                    ) : items.length === 0 ? (
                        <div className="cw-empty">{t('creativeWorkshop.emptyFavorites')}</div>
                    ) : (
                        <div className="cw-list">
                            {items.map((item) => (
                                <article className="cw-item" key={item.id}>
                                    <div className="cw-item-top">
                                        <h3>{item.title}</h3>
                                        <div className="cw-item-top-actions">
                                            <button
                                                className="cw-star active"
                                                onClick={() => handleUnfavorite(item)}
                                                title={t('creativeWorkshop.unfavoriteBtn')}
                                            >
                                                ★
                                            </button>
                                            <button
                                                className="cw-delete-btn"
                                                onClick={() => handleDelete(item)}
                                                disabled={deletingId === item.id}
                                                title={t('creativeWorkshop.deleteBtn')}
                                            >
                                                {deletingId === item.id ? t('common.loading') : t('creativeWorkshop.deleteBtn')}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="cw-item-desc">{item.method_prompt}</p>
                                    <div className="cw-item-bottom">
                                        <span>{t('creativeWorkshop.updatedAt').replace('{time}', formatTime(item.updated_at))}</span>
                                        <button
                                            className="cw-open-btn"
                                            onClick={() => navigate(`/creative-workshop/pages/${item.id}`)}
                                        >
                                            {t('creativeWorkshop.openPage')}
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
