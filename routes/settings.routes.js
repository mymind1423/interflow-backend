import express from "express";
import { getSettings, updateSetting } from "../controllers/settings.controller.js";

const router = express.Router();

router.get("/", getSettings);
router.put("/:key", updateSetting);

export default router;
