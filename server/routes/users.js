const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require("../middleware/auth/requireAuth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// get user
router.get("/me", async (req, res) => {
    const userId = req.user.body;

    try {
        const user = prisma.user.findUnique({
            where: userId,
            select: { email: true, username: true, profilePicture: true }
        });

        if (!user) res.status(404).json({ error: "user not found" });

        res.json(user);
    } catch (e) {
        console.error("error fetching user", e);
        res.status(401).json({ error: "error fetching user" });
    }
});

module.exports = router;