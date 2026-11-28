const express = require("express");
const cors = require("cors");
require("dotenv").config();
const prisma = require("./db");
const { hashPassword, verifyPassword } = require("./password");
const jwt = require("jsonwebtoken");
const { getJwtSecret, requireAuth } = require("./auth");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/api/health", (req, res) => {
  res.json({
    status: "success",
    message: "Cinema Management System API is running!",
  });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};

  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!cleanName || cleanName.length > 100) {
    return res
      .status(400)
      .json({ message: "Enter a name of 1 to 100 characters." });
  }

  if (
    cleanEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
  ) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  if (
    typeof password !== "string" ||
    password.length < 15 ||
    password.length > 128
  ) {
    return res
      .status(400)
      .json({ message: "Use a password of 15 to 128 characters." });
  }

  try {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        role: "CUSTOMER",
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return res.status(201).json({ user });
  } catch (error) {
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ message: "An account with that email already exists." });
    }

    console.error("Registration failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not create the account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const cleanEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  if (
    !cleanEmail ||
    cleanEmail.length > 254 ||
    typeof password !== "string" ||
    !password ||
    password.length > 128
  ) {
    return res.status(400).json({ message: "Enter your email and password." });
  }

  const jwtSecret = getJwtSecret();

  if (!jwtSecret) {
    console.error("JWT_SECRET must be at least 32 bytes.");
    return res.status(500).json({ message: "Login is unavailable." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });

    if (
      !user ||
      !user.isActive ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign({}, jwtSecret, {
      algorithm: "HS256",
      subject: user.id,
      expiresIn: "1h",
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not log in." });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

app.use("/api/movies", require("./movies"));
app.use("/api/admin/movies", require("./adminMovies"));
app.use("/api/bookings/:bookingId/snacks", require("./snackPreorders"));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
