import { getApiUrl } from './apiConfig';

const API_URL = `${getApiUrl()}/recommendations`;

export interface RecommendationParams {
    categories: string[];
    prices: string[];
    include_unconfirmed_price: boolean;
    location: string;
    sort_by?: string;
    page_token?: string;
    open_now?: boolean;
}

export const recommendationService = {
    search: async (params: RecommendationParams): Promise<{ results: any[], next_page_token?: string }> => {
        const response = await fetch(`${API_URL}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(params),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Error al obtener recomendaciones');
        }

        return data;
    }
};
