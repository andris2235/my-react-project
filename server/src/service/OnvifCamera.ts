//@ts-ignore
import { OnvifDevice } from "node-onvif";
import * as winston from "winston";
import "winston-daily-rotate-file";
import errorHandler from "../utils/erronHandler";

const transport = new winston.transports.DailyRotateFile({
  filename: "logs/camera-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "30d",
});

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [transport],
});

export interface CameraConfig {
  name: string;
  xaddr: string;
  user: string;
  pass: string;
}

class OnvifController {
  private devices: Map<string, OnvifDevice> = new Map();
  private ready: Map<string, boolean> = new Map();

  constructor(private cameras: CameraConfig[]) { }

  // ОБНОВЛЕННЫЙ initAll() - запускает retry для всех камер
  public async initAll() {
    try {
      console.log(`[OnvifController] Initializing ${this.cameras.length} cameras...`);

      for (const cam of this.cameras) {
        this.initCameraWithRetry(cam); // Запускаем async, не ждем
      }

      return { success: true, message: "Camera initialization started" };
    } catch (error) {
      return errorHandler(error);
    }
  }

  // НОВЫЙ метод с retry (заменяет старый initCamera)
  private async initCameraWithRetry(config: CameraConfig, attempt: number = 1): Promise<void> {
    try {
      console.log(`[Camera ${config.name}] Initializing... (attempt ${attempt})`);

      const device = new OnvifDevice({
        xaddr: config.xaddr,
        user: config.user,
        pass: config.pass,
      });

      // ⏱️ Инициализация с таймаутом 10 секунд
      await Promise.race([
        device.init(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Camera init timeout")), 10000)
        )
      ]);

      // ✅ Успех!
      this.devices.set(config.name, device);
      this.ready.set(config.name, true);

      logger.info(`Camera "${config.name}" initialized successfully`);
      console.log(`✅ Camera ${config.name} initialized successfully`);

    } catch (err: any) {
      // ❌ Ошибка - логируем и планируем retry
      this.ready.set(config.name, false);

      logger.error(`Camera "${config.name}" initialization failed`, {
        attempt,
        error: err.message
      });

      console.error(`❌ Camera ${config.name} init failed (attempt ${attempt}):`, err.message);

      // 🔄 Retry через 30 секунд
      console.log(`🔄 Camera ${config.name} will retry in 30 seconds...`);
      setTimeout(() => {
        this.initCameraWithRetry(config, attempt + 1);
      }, 30000);
    }
  }


  public async moveCamera(name: string, x: number, y: number, z: number) {
    const device = this.devices.get(name);
    if (!device || !this.ready.get(name)) {
      const errMsg = `Камера "${name}" не готова к движению`;
      logger.error(errMsg);
      return { success: false, message: errMsg }
    }
    try {
      await device.ptzMove({ speed: { x, y, z } });
      logger.info(
        `Камера "${name}" начала движение с параметрами x:${x}, y:${y}, z:${z}`
      );
      return { success: true, message: "" };
    } catch (err: any) {
      logger.error(`Ошибка движения камеры "${name}": ${err.message}`);
      return errorHandler(err);
    }
  }

  public async stopCamera(name: string) {
    const device = this.devices.get(name);
    if (!device || !this.ready.get(name)) {
      const errMsg = `Камера "${name}" не готова к остановке`;
      logger.error(errMsg);
      return { success: false, message: errMsg };
    }
    try {
      await device.ptzStop();
      logger.info(`Движение камеры "${name}" остановлена`);
      return { success: true, message: "" };
    } catch (err: any) {
      logger.error(`Ошибка остановки камеры "${name}": ${err.message}`);
      return errorHandler(err);
    }
  }
}
const cameras: CameraConfig[] = [
  {
    name: "cam1",
    xaddr: process.env.FIRST_CAMERA_ADDR ?? "",
    user: process.env.FIRST_CAMERA_USER ?? "",
    pass: process.env.FIRST_CAMERA_PASS ?? "",
  },
  {
    name: "cam2",
    xaddr: process.env.SECOND_CAMERA_ADDR ?? "",
    user: process.env.SECOND_CAMERA_USER ?? "",
    pass: process.env.SECOND_CAMERA_PASS ?? "",
  },
];
const onvifController = new OnvifController(cameras)
export default onvifController