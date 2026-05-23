import { apiClient } from './client';

export interface CreativeWorkshopProject {
    id: number;
    title: string;
    method_prompt: string;
    generated_html?: string;
    is_favorited: boolean;
    ai_provider: string;
    created_at: string;
    updated_at: string;
}

export async function listCreativeWorkshopProjects(onlyFavorited = false) {
    const resp = await apiClient.get('/creative-workshop/projects/', {
        params: onlyFavorited ? { favorited: 1 } : undefined,
    });
    return resp.data as {
        projects: CreativeWorkshopProject[];
    };
}

export async function generateCreativeWorkshopProject(methodPrompt: string, title = '') {
    const resp = await apiClient.post('/creative-workshop/projects/generate/', {
        method_prompt: methodPrompt,
        title,
    });

    return resp.data as {
        project: CreativeWorkshopProject;
        atConsumed?: number;
    };
}

export async function editCreativeWorkshopProject(projectId: number, instruction: string, aiProvider?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {};
    if (aiProvider) {
        config.headers = { 'X-AI-Provider': aiProvider };
    }
    const resp = await apiClient.post(`/creative-workshop/projects/${projectId}/edit/`, {
        instruction,
    }, config);

    return resp.data as {
        project: CreativeWorkshopProject;
        atConsumed?: number;
    };
}

export async function getCreativeWorkshopProject(projectId: number) {
    const resp = await apiClient.get(`/creative-workshop/projects/${projectId}/`);
    return resp.data as {
        project: CreativeWorkshopProject;
    };
}

export async function deleteCreativeWorkshopProject(projectId: number) {
    await apiClient.delete(`/creative-workshop/projects/${projectId}/`);
}

export async function toggleCreativeWorkshopFavorite(projectId: number, isFavorited?: boolean) {
    const payload = isFavorited === undefined ? {} : { is_favorited: isFavorited };
    const resp = await apiClient.post(`/creative-workshop/projects/${projectId}/favorite/`, payload);
    return resp.data as {
        is_favorited: boolean;
        project: CreativeWorkshopProject;
    };
}
