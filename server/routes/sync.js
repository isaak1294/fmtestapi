const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require("../middleware/auth/requireAuth");

const router = express.Router();
const prisma = new PrismaClient();

function parseSince(q) {
    const s = String(q ?? "");
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? new Date("1970-01-01T00:00:00Z") : d;
}

// GET /v1/sync/pull?since=ISO
router.get('/pull', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const since = parseSince(req.query.since);

        const [decks, flashcards] = await Promise.all([
            prisma.deck.findMany({
                where: { userId, updatedAt: { gt: since } },
                select: {
                    id: true, title: true, description: true, reviewedAt: true, isDeleted: true, updatedAt: true,
                },
                orderBy: { updatedAt: "asc" }
            }),
            prisma.flashcard.findMany({
                where: { userId, updatedAt: { gt: since } },
                select: {
                    id: true, deckId: true, front: true, back: true, confidence: true, dueDate: true, reviewedAt: true, isDeleted: true, updatedAt: true,
                },
                orderBy: { updatedAt: 'asc' },
            }),
        ]);

        const serverTime = new Date().toISOString();

        res.json({
            decks: decks.map(d => ({
                id: d.id,
                title: d.title,
                description: d.description ?? null,
                reviewedAt: d.reviewedAt.toISOString(),
                isDeleted: d.isDeleted,
                updatedAt: d.updatedAt.toISOString(),
            })),
            flashcards: flashcards.map(f => ({
                id: f.id,
                deckId: f.deckId,
                front: f.front,
                back: f.back,
                confidence: f.confidence,
                dueDate: f.dueDate ? f.dueDate.toISOString() : null,
                reviewedAt: f.reviewedAt.toISOString(),
                isDeleted: f.isDeleted,
                updatedAt: f.updatedAt.toISOString(),
            })),
            serverTime,
        });
    } catch (e) {
        console.error("Error pulling in sync:", e)
        res.status(500).json({ error: "Error pulling in sync" })
    }
});


// POST /v1/sync/push
// Body:
// {
//   since: "2025-08-30T00:00:00.000Z",
//   decks: [{ id, title, description, reviewedAt, isDeleted, updatedAt }],
//   flashcards: [{ id, deckId, front, back, confidence, dueDate, reviewedAt, isDeleted, updatedAt }]
// }
router.post("/push", requireAuth, async (req, res) => {
    const userId = req.user.id;
    const body = req.body || {};
    const decks = Array.isArray(body.decks) ? body.decks : [];
    const cards = Array.isArray(body.flashcards) ? body.flashcards : [];

    const idMappings = { decks: [], flashcards: [] };

    try {
        await prisma.$transaction(async (tx) => {
            // Upsert decks handling negative temp IDs
            for (const d of decks) {
                const data = {
                    userId,
                    title: d.title,
                    description: d.description ?? null,
                    reviewedAt: new Date(d.reviewedAt),
                    isDeleted: d.isDeleted | 0,
                };

                // handle negative temp IDs
                if (d.id < 0) {
                    const created = await tx.deck.create({ data, select: { id: true } });
                    idMappings.decks.push({ tempId: d.id, id: created.id });
                } else {
                    const existing = await tx.deck.findFirst({ where: { id: d.id, user: userId } });
                    if (!existing) {
                        await tx.deck.create({ data: { id: d.id, ...data } });
                    } else {
                        if (new Date(d.updatedAt) > existing.updatedAt) {
                            await tx.deck.update({ where: { id: d.id }, data });
                        }
                    }
                }
            }

            // Build a map for deck temp-id remap in case any card references a negative ID
            const deckIdMap = new Map(idMappings.decks.map(m => [m.tempId, m.id]));

            // Upsert Flashcards
            for (const f of cards) {
                // remap negative deck IDs
                let deckId = f.deckId;
                if (deckId < 0) {
                    const mapped = deckIdMap.get(deckId);
                    if (!mapped) throw new Error(`Unknown temp deckId ${deckId} for flashcard`);
                    deckId = mapped;
                }

                const data = {
                    userId,
                    deckId,
                    front: f.front,
                    back: f.back,
                    confidence: f.confidence | 0,
                    dueDate: f.dueDate ? new Date(f.dueDate) : null,
                    reviewedAt: new Date(f.reviewedAt),
                    isDeleted: f.isDeleted | 0,
                };

                // remap negative card IDs
                if (f.id < 0) {
                    const created = await tx.flashcard.create({ data, select: { id: true } });
                    idMappings.flashcards.push({ tempId: f.id, id: created.id });
                } else {
                    const existing = await tx.flashcard.findFirst({ where: { id: f.id, userId } });
                    if (!existing) {
                        await tx.flashcard.create({ data: { id: f.id, ...data } });
                    } else {
                        if (new Date(f.updatedAt) > existing.updatedAt) {
                            await tx.flashcard.update({ where: { id: f.id }, data });
                        }
                    }
                }
            }
        });

        res.json({ ok: true, idMappings });
    } catch (e) {
        console.error("sync push error:", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;