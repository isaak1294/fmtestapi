const express = require('express');
const cors = require('cors');

const flashcardRoutes = require('./routes/flashcards');
const deckRoutes = require('./routes/decks');
const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const usersRoutes = require('./routes/users');

const app = express();

console.log(
    "types:",
    typeof flashcardRoutes,
    typeof deckRoutes,
    typeof authRoutes,
    typeof syncRoutes,
    typeof usersRoutes
);

app.use(cors());
app.use(express.json());

app.use('/v1/flashcards', flashcardRoutes);
app.use('/v1/decks', deckRoutes);
app.use('/v1/auth', authRoutes);
app.use('/v1/sync', syncRoutes);
app.use('/v1/users', usersRoutes)

const PORT = process.env.PORT || 4000;
app.listen(PORT);
console.log(`server running on ${PORT}`)

module.exports = app;