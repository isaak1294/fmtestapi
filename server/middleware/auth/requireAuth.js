const { verifyAccessToken } = require("./tokens");

function requireAuth(req, res, next) {
    const h = req.header("Authorization");
    if (!h || !h.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing bearer token " });
    }
    const token = h.slice("Bearer ".length);


    try {
        const payload = verifyAccessToken(token);
        req.user = { id: payload.sub, email: payload.email };
        next();
    } catch (e) {
        return res.status(401).json({ error: "invalid or expired token" });
    }
}

module.exports = { requireAuth };