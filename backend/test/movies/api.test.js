const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("public movie browsing API", {
  skip: testDatabaseUrl ? false : "Set TEST_DATABASE_URL to a separate migrated database",
}, async (t) => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const prisma = require("../../db");
  const app = require("../../server");
  const suffix = randomUUID();
  const movieIds = [];
  const hallIds = [];
  const showtimeIds = [];
  const server = app.listen(0, "127.0.0.1");

  t.after(async () => {
    try {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      await prisma.$transaction([
        prisma.showtime.deleteMany({ where: { id: { in: showtimeIds } } }),
        prisma.movie.deleteMany({ where: { id: { in: movieIds } } }),
        prisma.hall.deleteMany({ where: { id: { in: hallIds } } }),
      ]);
    } finally {
      await prisma.$disconnect();
    }
  });

  function createMovie(title, status) {
    const id = randomUUID();
    movieIds.push(id);
    return prisma.movie.create({
      data: { id, title: title + " " + suffix, status, durationMin: 112, genre: "Drama" },
    });
  }

  function createHall(name, isActive) {
    const id = randomUUID();
    hallIds.push(id);
    return prisma.hall.create({
      data: { id, name: name + " " + suffix, isActive },
    });
  }

  function createShowtime(movie, hall, hoursFromNow, status) {
    const id = randomUUID();
    showtimeIds.push(id);
    const startTime = new Date(Date.now() + hoursFromNow * 3_600_000);
    return prisma.showtime.create({
      data: {
        id,
        movieId: movie.id,
        hallId: hall.id,
        startTime,
        endTime: new Date(startTime.getTime() + 2 * 3_600_000),
        status,
        basePrice: "125.50",
      },
    });
  }

  await once(server, "listening");
  const endpoint = "http://127.0.0.1:" + server.address().port + "/api/movies";
  const omega = await createMovie("Zeta", "NOW_SHOWING");
  const alpha = await createMovie("Alpha", "NOW_SHOWING");
  const coming = await createMovie("Future", "COMING_SOON");
  const archived = await createMovie("Archive", "ARCHIVED");
  const openHall = await createHall("Open", true);
  const closedHall = await createHall("Closed", false);

  const later = await createShowtime(alpha, openHall, 48, "SCHEDULED");
  const first = await createShowtime(alpha, openHall, 24, "SCHEDULED");
  await createShowtime(alpha, openHall, -24, "SCHEDULED");
  await createShowtime(alpha, openHall, 36, "CANCELLED");
  await createShowtime(alpha, openHall, 40, "COMPLETED");
  await createShowtime(alpha, closedHall, 30, "SCHEDULED");

  await t.test("lists only now-showing movies in title order", async () => {
    const response = await fetch(endpoint);
    assert.equal(response.status, 200);
    const { movies } = await response.json();
    const fixtures = movies.filter((movie) => movieIds.includes(movie.id));
    assert.deepEqual(fixtures.map((movie) => movie.id), [alpha.id, omega.id]);
    assert.equal(fixtures[0].genre, "Drama");
    assert.equal(fixtures[0].showDates.length, 2);
    assert.deepEqual(fixtures[1].showDates, []);
  });

  await t.test("returns movie details with only future scheduled screenings in active halls", async () => {
    const response = await fetch(endpoint + "/" + alpha.id);
    assert.equal(response.status, 200);
    const { movie } = await response.json();
    assert.equal(movie.title, alpha.title);
    assert.deepEqual(movie.showtimes.map((showtime) => showtime.id), [first.id, later.id]);
    assert.equal(movie.showtimes[0].startTime, first.startTime.toISOString());
    assert.equal(movie.showtimes[0].basePrice, "125.5");
    assert.match(movie.showtimes[0].cinemaDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(movie.showtimes[0].hall, { name: openHall.name });
  });

  await t.test("returns an empty showtime list for a movie without screenings", async () => {
    const response = await fetch(endpoint + "/" + omega.id);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).movie.showtimes, []);
  });

  await t.test("returns 404 for unknown and non-public movies", async () => {
    for (const id of [randomUUID(), archived.id, coming.id]) {
      const response = await fetch(endpoint + "/" + id);
      assert.equal(response.status, 404);
    }
  });
});
