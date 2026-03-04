import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function sha256(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
}

// POST /api/license/generate
export const generateLicense = async (req, res) => {
    try {
        const licenseKey = crypto.randomUUID();
        const keyHash = sha256(licenseKey);

        await prisma.license.create({
            data: { keyHash },
        });

        res.status(201).json({ licenseKey });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// POST /api/license/redeem
export const redeemLicense = async (req, res) => {
    try {
        const { licenseKey } = req.body;

        if (!licenseKey) {
            return res.status(400).json({ message: "License key is required" });
        }

        const keyHash = sha256(licenseKey);
        const license = await prisma.license.findUnique({ where: { keyHash } });

        if (!license) {
            return res.status(404).json({ message: "Invalid license key" });
        }

        if (license.redeemed) {
            return res.status(409).json({ message: "License already redeemed" });
        }

        const existingLicense = await prisma.license.findUnique({ where: { userId: req.user.id } });
        if (existingLicense) {
            return res.status(409).json({ message: "User already has a license" });
        }

        await prisma.license.update({
            where: { keyHash },
            data: { redeemed: true, userId: req.user.id },
        });

        res.status(200).json({ message: "License redeemed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};
