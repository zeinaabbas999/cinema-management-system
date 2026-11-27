const { Router } = require("express");
const prisma = require("./db");

const movies = Router();
const publicMovie = { status: "NOW_SHOWING" };
const cinemaDate = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Africa/Cairo",
});

function upcomingShowtimes() {
  return { status: "SCHEDULED", startTime: { gt: new Date() }, hall: { isActive: true } };
}

const movieCard = {
  id: true,
  title: true,
  genre: true,
  durationMin: true,
  language: true,
  ageRating: true,
  posterUrl: true,
};

movies.get("/", async (_req, res) => {
  try {
    const list = await prisma.movie.findMany({
      where: publicMovie,
      select: {
        ...movieCard,
        showtimes: {
          where: upcomingShowtimes(),
          select: { startTime: true },
          orderBy: { startTime: "asc" },
        },
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    });
    const result = list.map(({ showtimes, ...movie }) => ({
      ...movie,
      showDates: [...new Set(showtimes.map(({ startTime }) => cinemaDate.format(startTime)))],
    }));
    return res.json({ movies: result });
  } catch (error) {
    console.error("Movie catalog lookup failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not load movies." });
  }
});

movies.get("/:movieId", async (req, res) => {
  try {
    const movie = await prisma.movie.findFirst({
      where: { ...publicMovie, id: req.params.movieId },
      select: {
        ...movieCard,
        description: true,
        trailerUrl: true,
        showtimes: {
          where: upcomingShowtimes(),
          orderBy: [{ startTime: "asc" }, { id: "asc" }],
          select: {
            id: true,
            startTime: true,
            endTime: true,
            basePrice: true,
            hall: { select: { name: true } },
          },
        },
      },
    });

    if (!movie) {
      return res.status(404).json({ message: "Movie not found." });
    }

    return res.json({
      movie: {
        ...movie,
        showtimes: movie.showtimes.map((showtime) => ({
          ...showtime,
          cinemaDate: cinemaDate.format(showtime.startTime),
        })),
      },
    });
  } catch (error) {
    console.error("Movie details lookup failed:", error.code ?? error.name);
    return res.status(500).json({ message: "Could not load this movie." });
  }
});

module.exports = movies;
