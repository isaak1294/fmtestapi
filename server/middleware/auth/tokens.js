const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_TTL = process.env.ACCESS_TTL ?? "15m";
const JWT_SECRET = process.env.JWT_SECRET;

function signAccessToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function verifyAccessToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

function generateRefreshToken() {
    return crypto.randomBytes(48).toString("hex");
}


module.exports = { signAccessToken, verifyAccessToken, generateRefreshToken }
