import { useCallback, useRef } from 'react';

import { moveCamera, stopCamera } from '../http/cameraAPI';

import type { ZoomValues } from '../types/zoom';
import type { ClickType } from '../types/joystik';

import { getCameraDelta } from '../utils/func';

// Описание одной команды камере
interface CameraCommand {
    type: 'move' | 'zoom' | 'stop';  // Тип команды  
    data: any;                       // Данные команды (координаты, направление)
    timestamp: number;               // Время создания команды
}

export const useCameraQueue = (cameraId: "cam1" | "cam2") => {
    //  Очередь команд - массив команд, ожидающих выполнения
    const commandQueue = useRef<CameraCommand[]>([]);

    // Флаг "сейчас обрабатываем команду" - предотвращает параллельное выполнение
    const isProcessing = useRef(false);

    // ⏱Время последней выполненной команды - для дебага
    const lastCommandTime = useRef(0);

    // ГЛАВНАЯ ФУНКЦИЯ - обработчик очереди команд
    const processQueue = useCallback(async () => {
        // Если уже обрабатываем ИЛИ очередь пуста - выходим
        if (isProcessing.current || commandQueue.current.length === 0) {
            return; // Ничего не делаем
        }

        // 🔒 Блокируем параллельную обработку
        isProcessing.current = true;

        try {
            // 📤 Берем ПОСЛЕДНЮЮ команду из очереди (самую свежую)
            const latestCommand = commandQueue.current.pop()!;

            // 🗑️ Очищаем всю очередь (отбрасываем старые команды)
            commandQueue.current.length = 0;

            // 📊 Логируем для отладки
            console.log(`[${cameraId}] Выполняем команду:`, latestCommand.type);

            // 🎮 Выполняем команду в зависимости от типа
            switch (latestCommand.type) {
                case 'move':
                    // Двигаем камеру с координатами из команды
                    await moveCamera(latestCommand.data, cameraId);
                    break;

                case 'zoom':
                    // Зумим или останавливаем
                    if (latestCommand.data.zoom === "neutral") {
                        await stopCamera(cameraId); // Останавливаем
                    } else {
                        // Зумим вверх/вниз
                        await moveCamera({
                            x: 0,
                            z: latestCommand.data.zoom === "down" ? -0.5 : 0.5,
                            y: 0
                        }, cameraId);
                    }
                    break;

                case 'stop':
                    // Просто останавливаем камеру
                    await stopCamera(cameraId);
                    break;

                default:
                    console.warn(`[${cameraId}] Неизвестный тип команды:`, latestCommand.type);
            }

            // ✅ Запоминаем время успешного выполнения
            lastCommandTime.current = Date.now();
            console.log(`[${cameraId}] Команда выполнена успешно`);

        } catch (error: any) {
            // ❌ Если команда упала - логируем ошибку
            console.error(`[${cameraId}] Ошибка выполнения команды:`, error.message);
            // НЕ бросаем ошибку дальше, чтобы не сломать интерфейс

        } finally {
            // 🔓 В любом случае разблокируем обработку
            isProcessing.current = false;

            // 🔄 Если накопились новые команды - обрабатываем их через 50мс
            if (commandQueue.current.length > 0) {
                console.log(`[${cameraId}] В очереди еще ${commandQueue.current.length} команд`);
                setTimeout(processQueue, 50); // Небольшая пауза между командами
            }
        }
    }, [cameraId]);

    // 📥 ФУНКЦИЯ добавления команды в очередь
    const queueCommand = useCallback((command: CameraCommand) => {
        // 🧹 Удаляем старые команды (старше 1 секунды) - они уже неактуальны
        const now = Date.now();
        const oldLength = commandQueue.current.length;

        commandQueue.current = commandQueue.current.filter(
            cmd => now - cmd.timestamp < 1000 // Оставляем только свежие команды
        );

        const removedCount = oldLength - commandQueue.current.length;
        if (removedCount > 0) {
            console.log(`[${cameraId}] Удалено ${removedCount} устаревших команд`);
        }

        // ➕ Добавляем новую команду в конец очереди
        commandQueue.current.push(command);
        console.log(`[${cameraId}] Команда добавлена в очередь: ${command.type}`);

        // 🚀 Запускаем обработку очереди
        processQueue();
    }, [processQueue]);

    // 🔍 ПУБЛИЧНАЯ ФУНКЦИЯ для зума (используется в компоненте)
    const handleZoom = useCallback((zoom: ZoomValues) => {
        console.log(`[${cameraId}] Запрос зума:`, zoom);
        queueCommand({
            type: 'zoom',           // Тип команды
            data: { zoom },         // Данные - направление зума
            timestamp: Date.now()   // Текущее время
        });
    }, [queueCommand]);

    // 🕹️ ПУБЛИЧНАЯ ФУНКЦИЯ для движения (используется в компоненте)
    const handleMove = useCallback((pressed: ClickType | null) => {
        console.log(`[${cameraId}] Запрос движения:`, pressed);

        if (!pressed) {
            // Если кнопка отпущена - останавливаем
            queueCommand({
                type: 'stop',
                data: {},
                timestamp: Date.now()
            });
        } else {
            // Если кнопка нажата - двигаем в направлении
            queueCommand({
                type: 'move',
                data: getCameraDelta(pressed), // Функция преобразует направление в координаты
                timestamp: Date.now()
            });
        }
    }, [queueCommand]);

    // 📤 Возвращаем функции для использования в компоненте
    return {
        handleZoom,              // Функция для зума
        handleMove,              // Функция для движения  
        isProcessing: isProcessing.current  // Флаг "выполняется команда"
    };
};
