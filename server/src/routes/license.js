import express from "express";
import { protect } from "../middleware/auth.js";
import { generateLicense, redeemLicense } from "../controllers/licenseController.js";

const router = express.Router();

router.post("/generate", protect, generateLicense);
router.post("/redeem", protect, redeemLicense);

export default router;
