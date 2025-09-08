import { NextFunction, Request, Response } from "express";
import ApiError from "../error/ApiError";
import { setPreset } from "../service/multiviewer";
import onvifController from "../service/OnvifCamera";
import { TvState } from "../types/tv";
import { sendToTV } from "../service/sendToTv";

const CMD_POWER_ON = Buffer.from([0xAA, 0x11, 0x01, 0x01, 0x01, 0x14]);
const CMD_POWER_OFF = Buffer.from([0xAA, 0x11, 0x01, 0x01, 0x00, 0x13]);

class StreamControllers {
  async setTv(req: Request, res: Response, next: NextFunction) {
    try {
      const state = req.params.state as TvState;
      const result = await sendToTV(state === "off" ? CMD_POWER_OFF : CMD_POWER_ON);
      if (!result) {
        return next(ApiError.internal("TV command failed"));
      }
      return res.sendStatus(200);
    } catch (error: any) {
      return next(ApiError.internal(`TV error: ${error.message}`));
    }
  }

  async setPreset(req: Request, res: Response, next: NextFunction) {
    try {
      const n = parseInt(req.params.n, 10);
      if (n < 1 || n > 4) {
        return next(ApiError.badRequest("Invalid preset number"));
      }

      // Добавить await и таймаут
      const result = await Promise.race([
        setPreset(n),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Preset timeout")), 15000)
        )
      ]);

      if (!result) {
        return next(ApiError.internal("Multiviewer preset failed"));
      }
      return res.json({ status: "ok", preset: n });
    } catch (error: any) {
      return next(ApiError.internal(`Preset error: ${error.message}`));
    }
  }

  async moveCamera(req: Request, res: Response, next: NextFunction) {
    try {
      const { cam } = req.params;
      const { x, y, z } = req.body;

      if (!cam || typeof z !== "number" || typeof x !== "number" || typeof y !== "number") {
        return next(ApiError.badRequest("Incomplete data"));
      }

      // Добавить таймаут для ONVIF операций
      const { success, message } = await Promise.race([
        onvifController.moveCamera(cam, x, y, z),
        new Promise<{ success: boolean, message: string }>((_, reject) =>
          setTimeout(() => reject(new Error("ONVIF timeout")), 10000)
        )
      ]);

      if (!success) {
        return next(ApiError.internal(`Camera move failed: ${message}`));
      }
      res.json({ status: "ok", action: "move", cam });
    } catch (error: any) {
      return next(ApiError.internal(`Camera move error: ${error.message}`));
    }
  }

  async stopCamera(req: Request, res: Response, next: NextFunction) {
    try {
      const { cam } = req.params;
      if (!cam) {
        return next(ApiError.badRequest("Incomplete data"));
      }

      // Добавить таймаут для ONVIF операций  
      const { success, message } = await Promise.race([
        onvifController.stopCamera(cam),
        new Promise<{ success: boolean, message: string }>((_, reject) =>
          setTimeout(() => reject(new Error("ONVIF timeout")), 5000)
        )
      ]);

      if (!success) {
        return next(ApiError.internal(`Camera stop failed: ${message}`));
      }
      res.json({ status: "ok", action: "stop", cam });
    } catch (error: any) {
      return next(ApiError.internal(`Camera stop error: ${error.message}`));
    }
  }
}

const streamControllers = new StreamControllers();
export default streamControllers;

