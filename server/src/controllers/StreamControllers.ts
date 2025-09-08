import { NextFunction, Request, Response } from "express";
import ApiError from "../error/ApiError";
import { setPreset } from "../service/multiviewer";
import onvifController from "../service/OnvifCamera";
import { TvState } from "../types/tv";
import { sendToTV } from "../service/sendToTv";

const CMD_POWER_ON = Buffer.from([0xAA, 0x11, 0x01, 0x01, 0x01, 0x14]);
const CMD_POWER_OFF = Buffer.from([0xAA, 0x11, 0x01, 0x01, 0x00, 0x13]);

// 📊 ПРОСТОЙ LOGGER)
const logger = {
  info: (message: string, context?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, context || '');
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} ${message}`, context || '');
  },
  error: (message: string, context?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, context || '');
  },
  debug: (message: string, context?: any) => {
    console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`, context || '');
  }
};

class StreamControllers {
  async setTv(req: Request, res: Response, next: NextFunction) {
    // 🏷️ Создаем уникальный ID операции для отслеживания
    const operationId = `tv-${req.params.state}-${Date.now()}`;

    // ⏱️ Засекаем время начала операции
    const startTime = Date.now();

    try {
      // 📥 Извлекаем параметры запроса
      const state = req.params.state as TvState;

      // 📊 ЛОГИРУЕМ НАЧАЛО операции со всеми деталями
      logger.info(`[${operationId}] TV control started`, {
        state,                              // Включаем или выключаем
        ip: req.ip,                        // IP адрес клиента
        userAgent: req.get('User-Agent'),  // Браузер/устройство
        timestamp: new Date().toISOString() // Точное время
      });

      // 🎯 Определяем команду для отправки
      const command = state === "off" ? CMD_POWER_OFF : CMD_POWER_ON;

      // 📊 Логируем детали команды
      logger.debug(`[${operationId}] Sending TV command`, {
        state,
        commandBytes: Array.from(command).map(b => `0x${b.toString(16).toUpperCase()}`),
        commandLength: command.length
      });

      // 🚀 Выполняем команду
      const result = await sendToTV(command);

      if (!result) {
        // ❌ TV не ответил или отклонил команду
        const duration = Date.now() - startTime;
        logger.error(`[${operationId}] TV command rejected`, {
          state,
          duration,                        // Сколько времени заняло
          tvResponse: result,              // Что ответил TV
          reason: "tv_rejected_command"
        });
        return next(ApiError.internal("TV command failed"));
      }

      // ✅ УСПЕХ - логируем результат
      const duration = Date.now() - startTime;
      logger.info(`[${operationId}] TV control success`, {
        state,
        duration,                          // Время выполнения
        performance: duration < 1000 ? "fast" :
          duration < 3000 ? "normal" : "slow", // Оценка скорости
        tvResponse: result
      });

      // 📤 Возвращаем успешный ответ
      return res.status(200).json({
        status: "ok",
        state,
        operationId,                       // ID для клиента (для отладки)
        duration
      });

    } catch (error: any) {
      // 🚨 КРИТИЧЕСКАЯ ОШИБКА - логируем все детали
      const duration = Date.now() - startTime;
      logger.error(`[${operationId}] TV control failed`, {
        state: req.params.state,
        duration,
        error: error.message,              // Текст ошибки
        errorType: error.constructor.name, // Тип ошибки
        stack: error.stack,                // Полный stack trace
        ip: req.ip,
        userAgent: req.get('User-Agent'),

        // 🔍 Системная информация для диагностики
        serverUptime: process.uptime(),    // Сколько работает сервер
        memoryUsage: process.memoryUsage(), // Использование памяти
        timestamp: new Date().toISOString()
      });

      return next(ApiError.internal(`TV error: ${error.message}`));
    }
  }

  async setPreset(req: Request, res: Response, next: NextFunction) {
    // 🏷️ Уникальный ID для отслеживания preset операции
    const operationId = `preset-${req.params.n}-${Date.now()}`;
    const startTime = Date.now();

    try {
      const n = parseInt(req.params.n, 10);

      // 📊 ЛОГИРУЕМ НАЧАЛО операции
      logger.info(`[${operationId}] Preset change started`, {
        preset: n,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      // ✅ Валидация входных данных
      if (n < 1 || n > 4) {
        // ⚠️ ПРЕДУПРЕЖДЕНИЕ о неверных данных
        logger.warn(`[${operationId}] Invalid preset number`, {
          preset: n,
          validRange: "1-4",
          ip: req.ip,
          reason: "validation_failed"
        });
        return next(ApiError.badRequest("Invalid preset number"));
      }

      // 📊 Логируем начало выполнения команды
      logger.debug(`[${operationId}] Executing multiviewer preset command`, {
        preset: n,
        timeout: 15000
      });

      // 🎯 Выполняем команду с таймаутом
      const result = await Promise.race([
        setPreset(n),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Preset timeout")), 15000)
        )
      ]);

      if (!result) {
        // ❌ Мультивьювер отклонил команду
        const duration = Date.now() - startTime;
        logger.error(`[${operationId}] Multiviewer preset rejected`, {
          preset: n,
          duration,
          multiviewerResponse: result,
          reason: "multiviewer_rejected"
        });
        return next(ApiError.internal("Multiviewer preset failed"));
      }

      // ✅ УСПЕХ
      const duration = Date.now() - startTime;
      logger.info(`[${operationId}] Preset change success`, {
        preset: n,
        duration,
        performance: duration < 2000 ? "fast" :
          duration < 5000 ? "normal" : "slow",
        multiviewerResponse: result
      });

      return res.json({
        status: "ok",
        preset: n,
        operationId,
        duration
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;

      // 🚨 Определяем тип ошибки для лучшей диагностики
      const errorType = error.message.includes("timeout") ? "timeout" :
        error.message.includes("network") ? "network" :
          error.message.includes("ECONNREFUSED") ? "connection_refused" :
            "unknown";

      logger.error(`[${operationId}] Preset change failed`, {
        preset: req.params.n,
        duration,
        error: error.message,
        errorType,
        stack: error.stack,
        ip: req.ip,
        userAgent: req.get('User-Agent'),

        // 📊 Дополнительная диагностика
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });

      return next(ApiError.internal(`Preset error: ${error.message}`));
    }
  }

  async moveCamera(req: Request, res: Response, next: NextFunction) {
    // 🏷️ ID операции с информацией о камере и координатах
    const { cam } = req.params;
    const { x, y, z } = req.body;
    const operationId = `move-${cam}-${Date.now()}`;
    const startTime = Date.now();

    try {
      // 📊 ЛОГИРУЕМ НАЧАЛО движения камеры
      logger.info(`[${operationId}] Camera move started`, {
        camera: cam,
        coordinates: { x, y, z },
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      // ✅ Валидация данных
      if (!cam || typeof z !== "number" || typeof x !== "number" || typeof y !== "number") {
        logger.warn(`[${operationId}] Invalid camera move parameters`, {
          camera: cam,
          coordinates: { x, y, z },
          reason: "missing_or_invalid_coordinates",
          ip: req.ip
        });
        return next(ApiError.badRequest("Incomplete data"));
      }

      // 🔍 Дополнительная валидация диапазона координат
      if (Math.abs(x) > 1 || Math.abs(y) > 1 || Math.abs(z) > 1) {
        logger.warn(`[${operationId}] Camera coordinates out of range`, {
          camera: cam,
          coordinates: { x, y, z },
          validRange: "[-1, 1]",
          reason: "coordinates_out_of_range"
        });
        return next(ApiError.badRequest("Camera coordinates must be between -1 and 1"));
      }

      // 📊 Логируем отправку ONVIF команды
      logger.debug(`[${operationId}] Sending ONVIF move command`, {
        camera: cam,
        coordinates: { x, y, z },
        timeout: 10000,
        protocol: "ONVIF"
      });

      // 🎯 Выполняем ONVIF команду с таймаутом
      const { success, message } = await Promise.race([
        onvifController.moveCamera(cam, x, y, z),
        new Promise<{ success: boolean, message: string }>((_, reject) =>
          setTimeout(() => reject(new Error("ONVIF timeout")), 10000)
        )
      ]);

      if (!success) {
        // ❌ Камера отклонила команду
        const duration = Date.now() - startTime;
        logger.error(`[${operationId}] Camera move rejected`, {
          camera: cam,
          coordinates: { x, y, z },
          duration,
          cameraResponse: message,
          reason: "camera_rejected_command"
        });
        return next(ApiError.internal(`Camera move failed: ${message}`));
      }

      // ✅ УСПЕХ
      const duration = Date.now() - startTime;
      logger.info(`[${operationId}] Camera move success`, {
        camera: cam,
        coordinates: { x, y, z },
        duration,
        performance: duration < 1000 ? "fast" :
          duration < 3000 ? "normal" : "slow",
        cameraResponse: message
      });

      res.json({
        status: "ok",
        action: "move",
        cam,
        coordinates: { x, y, z },
        operationId,
        duration
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;

      // 🔍 Анализируем тип ошибки камеры
      const errorType = error.message.includes("timeout") ? "onvif_timeout" :
        error.message.includes("ONVIF") ? "onvif_protocol_error" :
          error.message.includes("network") ? "network_error" :
            error.message.includes("Unauthorized") ? "authentication_error" :
              "unknown_camera_error";

      logger.error(`[${operationId}] Camera move failed`, {
        camera: cam,
        coordinates: req.body,
        duration,
        error: error.message,
        errorType,
        stack: error.stack,
        ip: req.ip,
        userAgent: req.get('User-Agent'),

        // 📊 Техническая диагностика
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });

      return next(ApiError.internal(`Camera move error: ${error.message}`));
    }
  }

  async stopCamera(req: Request, res: Response, next: NextFunction) {
    const { cam } = req.params;
    const operationId = `stop-${cam}-${Date.now()}`;
    const startTime = Date.now();

    try {
      // 📊 ЛОГИРУЕМ НАЧАЛО остановки камеры
      logger.info(`[${operationId}] Camera stop started`, {
        camera: cam,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      if (!cam) {
        logger.warn(`[${operationId}] Missing camera ID`, {
          reason: "no_camera_specified",
          ip: req.ip
        });
        return next(ApiError.badRequest("Incomplete data"));
      }

      // 📊 Логируем ONVIF stop команду
      logger.debug(`[${operationId}] Sending ONVIF stop command`, {
        camera: cam,
        timeout: 5000,
        protocol: "ONVIF"
      });

      // 🎯 Выполняем команду остановки с коротким таймаутом
      const { success, message } = await Promise.race([
        onvifController.stopCamera(cam),
        new Promise<{ success: boolean, message: string }>((_, reject) =>
          setTimeout(() => reject(new Error("ONVIF timeout")), 5000)
        )
      ]);

      if (!success) {
        const duration = Date.now() - startTime;
        logger.error(`[${operationId}] Camera stop rejected`, {
          camera: cam,
          duration,
          cameraResponse: message,
          reason: "camera_rejected_stop"
        });
        return next(ApiError.internal(`Camera stop failed: ${message}`));
      }

      // ✅ УСПЕХ
      const duration = Date.now() - startTime;
      logger.info(`[${operationId}] Camera stop success`, {
        camera: cam,
        duration,
        performance: duration < 500 ? "fast" :
          duration < 1500 ? "normal" : "slow",
        cameraResponse: message
      });

      res.json({
        status: "ok",
        action: "stop",
        cam,
        operationId,
        duration
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(`[${operationId}] Camera stop failed`, {
        camera: cam,
        duration,
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });

      return next(ApiError.internal(`Camera stop error: ${error.message}`));
    }
  }
}

const streamControllers = new StreamControllers();
export default streamControllers;
