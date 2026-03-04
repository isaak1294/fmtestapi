const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth/requireAuth')

const router = express.Router();
const prisma = new PrismaClient();



//Deck CRUD routes:

router.use(requireAuth);

// get one by id
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const userId = req.user.id;
    const currentDate = new Date();
    try {
        let deck;
        deck = await prisma.deck.findFirst({
            where: {
                id: id,
                userId: userId,
            },
            select: { id: true, title: true, description: true, reviewedAt: true },
        });

        if (!deck) {
            return res.status(404).json({ error: "Deck not found" });
        }


        const [totalCount, dueCount, newCount] = await Promise.all([
            prisma.flashcard.count({ where: { deckId: id } }),
            prisma.flashcard.count({ where: { deckId: id, dueDate: { lte: currentDate } } }),
            prisma.flashcard.count({ where: { deckId: id, dueDate: { equals: null } } }),
        ]);

        const payload = {
            ...deck,
            size: totalCount,
            dueCards: dueCount,
            newCards: newCount,
        };

        res.json(payload);
    } catch (err) {
        console.error("Error fetching decks:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// get all decks
router.get('/', async (req, res) => {
    const currentDate = new Date();
    const userId = req.user.id;

    try {
        const decks = await prisma.deck.findMany({
            where: { userId },
            orderBy: { reviewedAt: 'desc' },
            take: 50,
            select: { id: true, title: true, description: true, reviewedAt: true },
        });

        const deckIds = decks.map(d => d.id);
        if (deckIds.length === 0) return res.json([]);

        const [totalCounts, dueCounts, newCounts] = await Promise.all([
            prisma.flashcard.groupBy({
                by: ['deckId'],
                _count: { _all: true },
                where: { deckId: { in: deckIds } },
            }),
            prisma.flashcard.groupBy({
                by: ['deckId'],
                _count: { _all: true },
                where: { deckId: { in: deckIds }, dueDate: { lte: currentDate } },
            }),
            prisma.flashcard.groupBy({
                by: ['deckId'],
                _count: { _all: true },
                where: { deckId: { in: deckIds }, dueDate: { equals: null } },
            }),
        ]);

        const totalMap = new Map(totalCounts.map(c => [c.deckId, c._count._all]));
        const dueMap = new Map(dueCounts.map(c => [c.deckId, c._count._all]));
        const newMap = new Map(newCounts.map(c => [c.deckId, c._count._all]));

        const payload = decks.map(d => ({
            ...d,
            size: totalMap.get(d.id) ?? 0,
            dueCards: dueMap.get(d.id) ?? 0,
            newCards: newMap.get(d.id) ?? 0,
        }));

        res.json(payload);
    } catch (err) {
        console.error('Error fetching decks:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// create deck
router.post('/', async (req, res) => {
    const { title, description } = req.body || {};
    const userId = req.user.id;

    try {
        if (!title || typeof title !== "string") {
            return res.status(400).json({ error: "title is required" });
        }

        const deck = await prisma.deck.create({
            data: {
                userId,
                title,
                description,
            },
        });

        res.status(201).json(deck)
    } catch (err) {
        console.error("Error creating deck:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//PUT
router.put('/', async (req, res) => {
    const { title, description, id } = req.body
    const userId = req.user.id;
    const deckId = Number(id);

    try {
        const existing = await prisma.deck.findFirst({ where: { id: deckId, userId } });
        if (!existing) return res.status(404).json({ error: "Deck not found" });

        const deck = await prisma.deck.update({
            where: {
                id: deckId,
            },
            data: {
                title,
                description,
            },
            select: { id: true, title: true, description: true, reviewedAt: true },
        });

        res.status(201).json(deck)
    } catch (err) {
        console.error("Error updating deck:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

//DELETE
router.delete('/', async (req, res) => {
    const { id } = req.body || {};
    const userId = req.user.id;
    const deckId = Number(id);

    try {
        const existing = await prisma.deck.findFirst({ where: { id: deckId, userId } });
        if (!existing) return res.status(404).json({ error: "Deck not found" });
        const deck = await prisma.deck.delete({
            where: {
                id: deckId
            }
        });

        res.status(201).json(deck);
    } catch (err) {
        console.error("Error deleting deck:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


//Update review date
router.put('/review', async (req, res) => {
    const { id } = req.body;
    const userId = req.user.id;
    const deckId = Number(id);

    try {
        const existing = await prisma.deck.findFirst({ where: { id: deckId, userId } });
        if (!existing) return res.status(404).json({ error: "Deck not found" });

        const deck = await prisma.deck.update({
            where: {
                id: deckId
            },
            data: {
                reviewedAt: new Date(),
            },
            select: { id: true, title: true, description: true, reviewedAt: true },
        });
        res.status(201).json(deck);
    } catch (err) {
        console.error("Error updating review data:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;

