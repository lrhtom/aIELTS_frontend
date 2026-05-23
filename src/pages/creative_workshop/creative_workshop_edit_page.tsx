import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import AiModelSelector from '../../components/common/AiModelSelector';
import {
    getCreativeWorkshopProject,
    editCreativeWorkshopProject,
    type CreativeWorkshopProject,
} from '../../api/creative_workshop';
import '../../styles/creative_workshop.css';

export default function CreativeWorkshopEditPage() {
    const { translations: t } = useLang();
    const navigate = useNavigate();
    const { id } = useParams();

    const [project, setProject] = useState<CreativeWorkshopProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [instruction, setInstruction] = useState('');
    const [aiProvider, setAiProvider] = useState<string>('');

    useEffect(() => {
        (async () => {
            if (!id) {
                showToast(t.creativeWorkshop?.invalidProject || '无效的项目', 'error');
                navigate('/creative-workshop', { replace: true });
                return;
            }

            const projectId = Number(id);
            if (!Number.isFinite(projectId)) {
                showToast(t.creativeWorkshop?.invalidProject || '无效的项目', 'error');
                navigate('/creative-workshop', { replace: true });
                return;
            }

            try {
                const { project: data } = await getCreativeWorkshopProject(projectId);
                setProject(data);
            } catch {
                showToast(t.creativeWorkshop?.loadDetailFail || '加载项目失败', 'error');
                navigate('/creative-workshop', { replace: true });
            } finally {
                setLoading(false);
            }
        })();
    }, [id, navigate, t.creativeWorkshop]);

    const handleEdit = async () => {
        if (!project || !instruction.trim()) {
            showToast('请输入修改指令');
            return;
        }

        setEditing(true);
        try {
            const { project: newProject } = await editCreativeWorkshopProject(project.id, instruction, aiProvider || undefined);
            showToast('修改成功，已为您生成新的版本（Fork）', 'success');
            navigate(`/creative-workshop/edit/${newProject.id}`, { replace: true });
            setProject(newProject);
            setInstruction('');
        } catch (err: unknown) {
            const error = err as { message?: string };
            showToast(error.message || 'AI 编辑失败', 'error');
        } finally {
            setEditing(false);
        }
    };

    return (
        <div className="cw-fullscreen-wrap cw-edit-layout">
            <header className="cw-fullscreen-header">
                <div className="cw-fullscreen-title">
                    <h1>{project?.title ? `${project.title} (AI Edit)` : 'AI Edit'}</h1>
                </div>
                <div className="cw-preview-actions">
                    <button className="cw-favorites-entry" onClick={() => navigate('/creative-workshop')}>
                        {t.creativeWorkshop?.backToHome || '返回工坊首页'}
                    </button>
                    <button className="cw-favorites-entry alt" onClick={() => navigate(`/creative-workshop/pages/${project?.id}`)}>
                        全屏预览
                    </button>
                </div>
            </header>

            <div className="cw-edit-content">
                <div className="cw-edit-preview">
                    {loading ? (
                        <div className="cw-empty">{t.common.loading}</div>
                    ) : (
                        <iframe
                            title={project?.title || 'creative-workshop-preview'}
                            className="cw-fullscreen-frame"
                            srcDoc={project?.generated_html || ''}
                            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
                        />
                    )}
                </div>

                <div className="cw-edit-panel">
                    <h3>AI 助手修改</h3>
                    <p className="cw-edit-desc">输入您想要的增删改查操作，AI 将为您生成一个新的分支版本。</p>
                    
                    <textarea
                        className="cw-edit-textarea"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="例如：把背景改成深色模式，增加一个重试按钮..."
                        disabled={editing || loading}
                    />

                    <div style={{ marginTop: '12px' }}>
                        <AiModelSelector 
                            description="" 
                            onModelChange={(p) => setAiProvider(p)} 
                        />
                    </div>

                    <button 
                        className="cw-generate-btn" 
                        style={{ marginTop: '16px', width: '100%', padding: '12px' }}
                        onClick={handleEdit}
                        disabled={editing || loading || !instruction.trim()}
                    >
                        {editing ? 'AI 正在全力修改中...' : '提交修改'}
                    </button>
                </div>
            </div>
        </div>
    );
}
