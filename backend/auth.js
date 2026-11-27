const jwt = require("jsonwebtoken");
const prisma = require("./db");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  return secret && Buffer.byteLength(secret, "utf8") >= 32 ? secret : null;
}

async function requireAuth(req, res, next) {
  const match = /^Bearer (\S+)$/i.exec(req.get("Authorization") ?? "");

  if (!match) {
    return res.status(401).json({ message: "Please log in." });
  }

  const secret = getJwtSecret();
  if (!secret) {
    console.error("JWT_SECRET must be at least 32 bytes.");
    return res.status(500).json({ message: "Authentication is unavailable." });
  }

  let claims;
  try {
    claims = jwt.verify(match[1], secret, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({ message: "Please log in again." });
  }

  if (typeof claims?.sub !== "string" || !claims.sub) {
    return res.status(401).json({ message: "Please log in again." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id: claims.sub, isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Please log in again." });
    }

    req.user = user;
  } catch (error) {
    console.error("Current-user lookup failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not load your account." });
  }

  return next();
}

module.exports = { getJwtSecret, requireAuth };
