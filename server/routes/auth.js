// routes/auth.js
const express = require("express");
const argon2 = require("argon2");
const { PrismaClient } = require("@prisma/client");
const { signAccessToken, generateRefreshToken } = require("../middleware/auth/tokens");

const router = express.Router();
const prisma = new PrismaClient();

const REFRESH_TTL_DAYS = parseInt(process.env.REFRESH_TTL_DAYS || "30", 10);

function addDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function issueTokensForUser(userId, email) {
    // FIX: correct function name signAccessToken (was signAccessToekn)
    const access_token = signAccessToken({ sub: userId, email });
    const token = generateRefreshToken();
    const expiresAt = addDays(new Date(), REFRESH_TTL_DAYS);

    await prisma.refreshToken.create({
        data: { userId, token, expiresAt },
    });

    return {
        access_token,
        refresh_token: token, // FIX: use refresh_token key (your client expects this)
        token_type: "Bearer",
        expires_in: 60 * 15, // keep in sync with your ACCESS_TTL
    };
}

/** POST /v1/auth/register */
router.post("/register", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: "email and password required" });
    }

    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ error: "email already in use" });
        }

        // FIX: argon2 API is argon2.hash(...)
        const passwordHash = await argon2.hash(password);

        const user = await prisma.user.create({
            data: { email, passwordHash },
        });

        const tokens = await issueTokensForUser(user.id, user.email);
        return res.status(201).json(tokens);
    } catch (e) {
        console.error("register error:", e);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/** POST /v1/auth/login */
router.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: "email and password required" });
    }

    try {
        // FIX: await the query
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: "invalid credentials" });

        // FIX: argon2.verify(hash, password)
        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) return res.status(401).json({ error: "invalid credentials" });

        const tokens = await issueTokensForUser(user.id, user.email);
        return res.json(tokens);
    } catch (e) {
        console.error("login error:", e);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/** POST /v1/auth/refresh */
router.post("/refresh", async (req, res) => {
    try {
        const { refresh_token } = req.body || {};
        if (!refresh_token) return res.status(400).json({ error: "refresh_token required" });

        const rt = await prisma.refreshToken.findUnique({ where: { token: refresh_token } });
        if (!rt || rt.revokedAt) return res.status(401).json({ error: "invalid refresh token" });
        if (rt.expiresAt < new Date()) {
            await prisma.refreshToken.delete({ where: { id: rt.id } });
            return res.status(401).json({ error: "refresh token expired" });
        }

        // FIX: correct await + property path
        const user = await prisma.user.findUnique({ where: { id: rt.userId } });
        if (!user) return res.status(401).json({ error: "user not found" });

        // rotate old refresh token
        await prisma.refreshToken.update({
            where: { id: rt.id },
            data: { revokedAt: new Date() },
        });

        const tokens = await issueTokensForUser(user.id, user.email);
        return res.json(tokens);
    } catch (e) {
        console.error("refresh error:", e);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/** POST /v1/auth/logout */
router.post("/logout", async (req, res) => {
    try {
        const { refresh_token } = req.body || {};
        if (!refresh_token) return res.status(400).json({ error: "refresh_token required" });

        await prisma.refreshToken.updateMany({
            where: { token: refresh_token, revokedAt: null },
            data: { revokedAt: new Date() },
        });

        return res.json({ ok: true });
    } catch (e) {
        console.error("logout error:", e);
        return res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
