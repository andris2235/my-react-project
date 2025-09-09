import { Router } from "express"
import streamRouter from "./streamRouter"

import healthController from "../controllers/HealthController";
//just
const router = Router()
router.get('/api/ping', healthController.ping);
router.use('/stream', streamRouter)



export default router