import { Request, Response } from "express";

class HealthController {
    async ping(req: Request, res: Response) {
        res.status(200).json({
            status: "ok",
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    }
}

const healthController = new HealthController();
export default healthController;
