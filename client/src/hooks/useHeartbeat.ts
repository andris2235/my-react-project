import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

export const useHeartbeat = (intervalMs: number = 15000) => {
    const [isOnline, setIsOnline] = useState(true);
    const [lastPing, setLastPing] = useState<Date | null>(null);
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const ping = async () => {
        try {
            const response = await axios.get('/api/ping', {
                timeout: 10000, // 10 секунд таймаут
            });

            if (response.status === 200) {
                setIsOnline(true);
                setLastPing(new Date());

                // Сбросить таймаут отключения
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                // Установить новый таймаут
                timeoutRef.current = window.setTimeout(() => {
                    setIsOnline(false);
                    console.warn('Heartbeat timeout - connection lost');
                }, 35000); // 35 секунд до признания отключения
            }
        } catch (error) {
            console.error('Heartbeat failed:', error);
            setIsOnline(false);
        }
    };

    useEffect(() => {
        // Первый пинг сразу
        ping();

        // Повторяющиеся пинги
        intervalRef.current = window.setInterval(ping, intervalMs);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [intervalMs]);

    const reconnect = () => {
        ping();
    };

    return { isOnline, lastPing, reconnect };
};
