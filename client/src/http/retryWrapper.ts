import { AxiosError } from 'axios';

interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
}

export async function withRetry<T>(
    requestFn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await requestFn();
        } catch (error) {
            // Последняя попытка - бросаем ошибку
            if (attempt === maxRetries) {
                throw error;
            }

            // Проверяем, стоит ли повторять запрос
            if (error instanceof AxiosError) {
                const status = error.response?.status;
                // Не повторяем для клиентских ошибок (4xx)
                if (status && status >= 400 && status < 500) {
                    throw error;
                }
            }

            // Экспоненциальная задержка с jitter
            const delay = Math.min(
                baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
                maxDelay
            );

            console.warn(`Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new Error('Max retries exceeded');
}
