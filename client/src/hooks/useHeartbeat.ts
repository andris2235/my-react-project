import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

export const useHeartbeat = (intervalMs: number = 15000) => {
    const [isOnline, setIsOnline] = useState(true);
    const [lastPing, setLastPing] = useState<Date | null>(null);

    // ✅ ИСПРАВЛЕНО: Правильная типизация для браузерного setTimeout/setInterval
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    // ✅ Защита от concurrent ping'ов
    const pingInProgress = useRef(false);

    // ✅ AbortController для прерывания зависших запросов
    const abortControllerRef = useRef<AbortController | null>(null);

    const ping = async () => {
        // ✅ Защита от множественных одновременных ping'ов
        if (pingInProgress.current) {
            console.log('Heartbeat: Ping already in progress, skipping');
            return;
        }

        pingInProgress.current = true;

        try {
            // ✅ Отменяем предыдущий запрос если он еще идет
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // ✅ Новый AbortController для текущего запроса
            abortControllerRef.current = new AbortController();

            const response = await axios.get('/api/ping', {
                timeout: 8000, // Сократил таймаут с 10 до 8 секунд
                signal: abortControllerRef.current.signal // Поддержка отмены запроса
            });

            if (response.status === 200) {
                setIsOnline(true);
                setLastPing(new Date());

                // Сбросить таймаут отключения
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                // ✅ ИСПРАВЛЕНО: window.setTimeout для браузерной среды
                timeoutRef.current = window.setTimeout(() => {
                    setIsOnline(false);
                    console.warn('Heartbeat timeout - connection lost');
                }, 30000); // Сократил с 35 до 30 секунд
            }
        } catch (error: any) {
            // ✅ Не логируем отмененные запросы как ошибки
            if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
                console.log('Heartbeat: Request aborted or timed out');
            } else {
                console.error('Heartbeat failed:', error.message || error);
            }
            setIsOnline(false);
        } finally {
            // ✅ Всегда освобождаем флаг, даже при ошибках
            pingInProgress.current = false;
            abortControllerRef.current = null;
        }
    };

    useEffect(() => {
        // Первый пинг сразу
        ping();

        // ✅ ИСПРАВЛЕНО: window.setInterval для браузерной среды
        intervalRef.current = window.setInterval(ping, intervalMs);

        // ✅ Более надежная очистка ресурсов
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null; // Очищаем ref
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null; // Очищаем ref
            }
            // ✅ Отменяем активный запрос при unmount
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            // ✅ Освобождаем флаг
            pingInProgress.current = false;
        };
    }, [intervalMs]);

    const reconnect = () => {
        // ✅ Защита от множественных reconnect'ов
        if (!pingInProgress.current) {
            console.log('Heartbeat: Manual reconnect initiated');
            ping();
        }
    };

    return { isOnline, lastPing, reconnect };
};
