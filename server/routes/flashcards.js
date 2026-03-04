const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();
const getDueDate = require('../functions/dueDate');

//Flashcard CRUD routes:

router.post('/', async (req, res) => {
    const { front, back, tags, deckId } = req.body;

    if (!front || !front.trim() || !back || !back.trim()) {
        return res.status(400).json({ error: 'Front and back of card are required.' });
    }

    try {
        const card = await prisma.flashcard.create({
            data: {
                front: front,
                back: back,
                tags: tags,
                deckId: Number(deckId),
            }
        });

        res.status(201).json(card);
    } catch (err) {
        console.error('Error creating card:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:deckId', async (req, res) => {
    const deckId = Number(req.params.deckId);
    try {
        let cards;
        cards = await prisma.flashcard.findMany({
            where: {
                deckId: deckId,
            },
            orderBy: { reviewedAt: 'asc' },
            take: 50,
        })

        res.json(cards);
    } catch (err) {
        console.error('Error fetching cards:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/', async (req, res) => {
    const { id, front, back, tags, deckId } = req.body;

    if (!front || !front.trim() || !back || !back.trim()) {
        return res.status(400).json({ error: 'Front and back of card are required.' });
    }

    try {
        const card = await prisma.flashcard.update({
            where: {
                id: id,
                deckId: deckId
            },
            data: {
                front: front,
                back: back,
                tags: tags,
            }
        })
    } catch (err) {
        console.error('Error updating card:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

router.delete('/', async (req, res) => {
    const { id, deckId } = req.body;
    try {
        const card = await prisma.flashcard.delete({
            where: {
                id: id,
                deckId: deckId
            }
        })
    } catch (err) {
        console.error('Error deleting card:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Flashcard confidence route



router.patch(`/review`, async (req, res) => {
    const { id, confidenceMod, deckId } = req.body;
    // Set new due date
    // Invalidate queries in hook
    // If isNew set isNew false
    try {
        const card = await prisma.$transaction(async (tx) => {

            const currentDate = new Date()

            const existing = await tx.flashcard.findUnique({
                where: { id },
                select: { confidence: true, deckId: true, isNew: true }
            });
            if (!existing || existing.deckId !== deckId) {
                throw new Error('Card not found for this deck');
            }

            const newConfidence = existing.confidence + confidenceMod;
            const newDueDate = getDueDate(currentDate, newConfidence);

            return tx.flashcard.update({
                where: { id },
                data: {
                    confidence: newConfidence,
                    reviewedAt: new Date(),
                    dueDate: newDueDate,
                },
            });
        });

        res.json(card);
    } catch (err) {
        console.error('Error updating confidence:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = router;