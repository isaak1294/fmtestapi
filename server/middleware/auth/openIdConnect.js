const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const router = express.Router();
const cors = require('cors');

require('dotenv').config();

const app = express();

app.use(cors({
    origin: process.env.EXPO_BASE_URL,
    credentials: true,
}));

//Google OaAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
    const user = {
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        picture: profile.photos?.[0]?.value
    };
    return done(null, user);
}));

app.use(passport.initialize());

// Start login process
app.get('auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);


// Handle callback and issue JWT
app.get('/auth/google/callback',
    passport.authenticate('google', { session: false }),
    (req, res) => {
        const user = req.user
        const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });

        // http cookify
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 360000
        });

        // redirect with token
        res.redirect(`${process.env.EXPO_BASE_URL}/auth/callback?token=${token}`);
    }
);


// Protected route to fetch user
app.get('api/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return res.json(decoded);
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;