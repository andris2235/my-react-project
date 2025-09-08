import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { Express } from "express";
import * as winston from "winston";
import "winston-daily-rotate-file";

const transport = new winston.transports.DailyRotateFile({
  filename: "logs/createStream-%DATE%.log", // Лог-файлы будут называться с датой
  datePattern: "YYYY-MM-DD", // Формат даты
  zippedArchive: true, // Архивировать старые логи
  maxSize: "20m", // Максимальный размер файла (после чего он будет ротироваться)
  maxFiles: "30d", // Хранить логи только за последние 14 дней
});

const logger = winston.createLogger({
  level: "info", // Уровень логирования
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [transport],
});

export interface StreamConfig {
  index: number; // Индекс стрима
  deviceId: number; // ID устройства
  publicDir: string; // Папка для HLS
  streamsList: (number | string)[]; // Список устройств
}

function getFFmpegInputArgs(deviceId: number | string): string[] {
  const platform = os.platform();
  const isPtz = deviceId === "/dev/Ptz_big" || deviceId === "/dev/Ptz_small";
  if (platform === "darwin") {
    // macOS (avfoundation)
    return [
      "-f",
      "avfoundation",
      "-framerate",
      "15",
      "-video_size",
      "640x480",
      "-i",
      `${deviceId}`,
    ];
    } else if (platform === "linux") {
      // Linux (v4l2)
      return [
        "-f",
        "v4l2",
        "-framerate",
        "15",
        "-video_size",
        "640x480",
        // "input_format",
        // isPtz ? "h264" : "yuyv422",
        "-thread_queue_size",
        "512",
        "-i",
        `${deviceId}`,
      ];
    } else {
      throw new Error(`Платформа ${platform} не поддерживается`);
    }
  }

export function createStream(app: Express, config: StreamConfig): void {
  try {
    const folder = path.join(config.publicDir, `stream${config.index + 1}`);

    // Создаём директорию
    if (fs.existsSync(folder)) {
      fs.rmSync(folder, { recursive: true });
    }
    fs.mkdirSync(folder, { recursive: true });

    // HTTP endpoints
    app.get(`/stream${config.index + 1}/index.m3u8`, (_, res) => {
      res.header("Content-Type", "application/vnd.apple.mpegurl");
      res.sendFile(path.join(folder, "index.m3u8"));
    });

    app.get(`/stream${config.index + 1}/:segment.m4s`, (req, res) => {
      res.header("Content-Type", "video/iso.segment");
      res.sendFile(path.join(folder, `${req.params.segment}.m4s`));
    });

    app.get(`/stream${config.index + 1}/init.mp4`, (_, res) => {
      res.header("Content-Type", "video/mp4");
      res.sendFile(path.join(folder, "init.mp4"));
    });

    // Формируем аргументы ffmpeg
    const inputArgs = getFFmpegInputArgs(config.streamsList[config.index]);
    const hlsArgs = [
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-g",
      "30",
      "-sc_threshold",
      "0",
      "-hls_time",
      "1",
      "-hls_list_size",
      "6",
      "-hls_playlist_type",
      "event",
      "-hls_flags",
      "delete_segments+append_list+independent_segments",
      "-hls_segment_type",
      "fmp4",
      "-hls_fmp4_init_filename",
      "init.mp4",
      "-hls_segment_filename",
      path.join(folder, "segment%03d.m4s"),
      path.join(folder, "index.m3u8"),
    ];

    const ffmpegArgs = [...inputArgs, ...hlsArgs];

    // Запуск ffmpeg
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    ffmpeg.stderr.on("data", (data) => {
      console.log(`Stream${config.index + 1}: ${data.toString()}`);
    });

    ffmpeg.on("exit", (code) => {
      logger.info(`Stream${config.index + 1} ffmpeg exited with code ${code}`);
      console.log(`Stream${config.index + 1} ffmpeg exited with code ${code}`);
    });
  } catch (error) {
    logger.error("createStream error", error);
  }
}

export function startSegmentCleaner(
  streamDirs: string[],
  maxSegments: number,
  intervalMs: number
): void {
  try {
    setInterval(() => {
      streamDirs.forEach((STREAM_PATH) => {
        fs.readdir(STREAM_PATH, (err, files) => {
          if (err) {
            logger.error(`Ошибка чтение ${STREAM_PATH}:`, err);
            return;
          }

          const segments = files
            .filter((file) => /^segment\d+\.m4s$/.test(file))
            .sort((a, b) => {
              const numA = parseInt(
                a.replace("segment", "").replace(".m4s", "")
              );
              const numB = parseInt(
                b.replace("segment", "").replace(".m4s", "")
              );
              return numA - numB;
            });

          if (segments.length > maxSegments) {
            const toDelete = segments.slice(0, segments.length - maxSegments);
            toDelete.forEach((file) => {
              fs.unlink(path.join(STREAM_PATH, file), (err) => {
                if (err) {
                  logger.error(`Ошибка удаления ${file}:`, err);
                  console.error(`Ошибка удаления ${file}:`, err);
                }
              });
            });
          }
        });
      });
    }, intervalMs);
  } catch (error) {
    logger.error("startSegmentCleaner error", error);
  }
}
