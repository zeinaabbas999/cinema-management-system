const { Router } = require("express");
const prisma = require("./db");
const { requireAuth } = require("./auth");

const adminMovies = Router();

const VALID_STATUSES = ["COMING_SOON", "NOW_SHOWING", "ARCHIVED"];

const STRING_FIELDS = [
  "description",
  "genre",
  "language",
  "ageRating",
  "posterUrl",
  "trailerUrl",
];

// Only administrators can access these routes.
function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required." });
  }

  next();
}

adminMovies.use(requireAuth, requireAdmin);

// Validate optional movie fields.
function validateOptionalFields(body) {
  for (const field of STRING_FIELDS) {
    if (
      body[field] !== undefined &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return `Invalid value for ${field}.`;
    }
  }

  if (
    body.status !== undefined &&
    !VALID_STATUSES.includes(body.status)
  ) {
    return "Invalid movie status.";
  }

  return null;
}

// Get all movies, including archived movies.
adminMovies.get("/", async (req, res) => {
  try {
    const movies = await prisma.movie.findMany({
      orderBy: { title: "asc" },
    });

    return res.json({ movies });
  } catch (error) {
    console.error("Admin movie lookup failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not load movies." });
  }
});

// Add a new movie.
adminMovies.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    const {
      title,
      durationMin,
      status,
    } = body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      !Number.isInteger(durationMin) ||
      durationMin <= 0
    ) {
      return res.status(400).json({
        message: "A title and a positive whole-number duration are required.",
      });
    }

    const validationError = validateOptionalFields(body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const data = {
      title: title.trim(),
      durationMin,
    };

    for (const field of STRING_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (status !== undefined) {
      data.status = status;
    }

    const movie = await prisma.movie.create({ data });

    return res.status(201).json({ movie });
  } catch (error) {
    console.error("Movie creation failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not create movie." });
  }
});

// Edit an existing movie.
adminMovies.patch("/:movieId", async (req, res) => {
  try {
    const body = req.body ?? {};
    const {
      title,
      durationMin,
    } = body;

    const allowedFields = [
      "title",
      "durationMin",
      ...STRING_FIELDS,
      "status",
    ];

    const hasUnknownField = Object.keys(body).some(
      (field) => !allowedFields.includes(field)
    );

    if (hasUnknownField || Object.keys(body).length === 0) {
      return res.status(400).json({
        message: "Provide valid movie fields to update.",
      });
    }

    if (
      (title !== undefined &&
        (typeof title !== "string" || !title.trim())) ||
      (durationMin !== undefined &&
        (!Number.isInteger(durationMin) || durationMin <= 0))
    ) {
      return res.status(400).json({
        message: "Invalid title or duration.",
      });
    }

    const validationError = validateOptionalFields(body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const data = {};

    for (const field of STRING_FIELDS) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    if (title !== undefined) data.title = title.trim();
    if (durationMin !== undefined) data.durationMin = durationMin;
    if (body.status !== undefined) data.status = body.status;

    const movie = await prisma.movie.update({
      where: { id: req.params.movieId },
      data,
    });

    return res.json({ movie });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Movie not found." });
    }

    console.error("Movie update failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not update movie." });
  }
});

// Archive a movie.
adminMovies.patch("/:movieId/archive", async (req, res) => {
  try {
    const movie = await prisma.movie.update({
      where: { id: req.params.movieId },
      data: { status: "ARCHIVED" },
    });

    return res.json({ movie });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Movie not found." });
    }

    console.error("Movie archive failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not archive movie." });
  }
});

// Restore an archived movie to the status specified by the admin.
adminMovies.patch("/:movieId/restore", async (req, res) => {
  try {
    const { status } = req.body ?? {};

    if (!["COMING_SOON", "NOW_SHOWING"].includes(status)) {
      return res.status(400).json({
        message: "Choose COMING_SOON or NOW_SHOWING as the restore status.",
      });
    }

    const existingMovie = await prisma.movie.findUnique({
      where: { id: req.params.movieId },
    });

    if (!existingMovie) {
      return res.status(404).json({ message: "Movie not found." });
    }

    if (existingMovie.status !== "ARCHIVED") {
      return res.status(409).json({
        message: "Only archived movies can be restored.",
      });
    }

    const movie = await prisma.movie.update({
      where: { id: req.params.movieId },
      data: { status },
    });

    return res.json({ movie });
  } catch (error) {
    console.error("Movie restore failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not restore movie." });
  }
});

// Delete a movie.
adminMovies.delete("/:movieId", async (req, res) => {
  try {
    await prisma.movie.delete({
      where: { id: req.params.movieId },
    });

    return res.json({ message: "Movie deleted successfully." });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Movie not found." });
    }

    if (error.code === "P2003" || error.code === "P2014") {
      return res.status(409).json({
        message: "This movie has related records and cannot be deleted. Archive it instead.",
      });
    }

    console.error("Movie deletion failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not delete movie." });
  }
});

module.exports = adminMovies;