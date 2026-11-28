const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("customer snack pre-order API", {
  skip: testDatabaseUrl ? false : "Set TEST_DATABASE_URL to a separate migrated database",
}, async (t) => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const secret = randomUUID() + randomUUID();
  process.env.JWT_SECRET = secret;
  const app = require("../../server");
  const prisma = require("../../db");
  const server = app.listen(0, "127.0.0.1");
  const ids = Object.fromEntries(
    ["buyer", "other", "movie", "hall", "showtime", "booking", "popcorn", "soda", "hidden"].map(
      (name) => [name, randomUUID()],
    ),
  );

  t.after(async () => {
    try {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      await prisma.$transaction([
        prisma.snackOrder.deleteMany({ where: { bookingId: ids.booking } }),
        prisma.booking.deleteMany({ where: { id: ids.booking } }),
        prisma.snack.deleteMany({ where: { id: { in: [ids.popcorn, ids.soda, ids.hidden] } } }),
        prisma.showtime.deleteMany({ where: { id: ids.showtime } }),
        prisma.movie.deleteMany({ where: { id: ids.movie } }),
        prisma.hall.deleteMany({ where: { id: ids.hall } }),
        prisma.user.deleteMany({ where: { id: { in: [ids.buyer, ids.other] } } }),
      ]);
    } finally {
      await prisma.$disconnect();
    }
  });

  await once(server, "listening");
  const endpoint = "http://127.0.0.1:" + server.address().port + "/api/bookings/" + ids.booking + "/snacks";
  const token = jwt.sign({}, secret, { subject: ids.buyer });
  const otherToken = jwt.sign({}, secret, { subject: ids.other });
  const later = (minutes) => new Date(Date.now() + minutes * 60_000);
  await prisma.user.createMany({ data: [ids.buyer, ids.other].map((id) => ({
    id, name: "Snack test user", email: id + "@example.com", passwordHash: "unused",
  })) });
  await prisma.movie.create({ data: { id: ids.movie, title: "Snack test movie", durationMin: 90 } });
  await prisma.hall.create({ data: { id: ids.hall, name: ids.hall } });
  await prisma.showtime.create({ data: {
    id: ids.showtime, movieId: ids.movie, hallId: ids.hall,
    startTime: later(60), endTime: later(150), basePrice: "150.00",
  } });
  await prisma.booking.create({ data: {
    id: ids.booking, userId: ids.buyer, showtimeId: ids.showtime,
    holdExpiresAt: later(10), totalAmount: "150.00",
  } });
  await prisma.snack.createMany({ data: [
    { id: ids.popcorn, name: "Popcorn", price: "60.25", stockQuantity: 3 },
    { id: ids.soda, name: "Soda", price: "25.50", stockQuantity: 4 },
    { id: ids.hidden, name: "Hidden snack", price: "10", stockQuantity: 12, isAvailable: false },
  ] });

  async function request({ authorization = token, items } = {}) {
    const headers = {};
    if (authorization) headers.Authorization = "Bearer " + authorization;
    if (items !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(endpoint, {
      method: items === undefined ? "GET" : "PUT",
      headers,
      body: items === undefined ? undefined : JSON.stringify({ items }),
    });
    return { status: response.status, data: await response.json() };
  }

  await t.test("requires authentication and ownership to read or update the draft", async () => {
    assert.equal((await request({ authorization: null })).status, 401);
    assert.equal((await request({ authorization: otherToken })).status, 404);
    assert.equal((await request({ authorization: otherToken, items: [] })).status, 404);
    const { status, data } = await request();
    assert.equal(status, 200);
    assert.ok(data.catalog.some(({ id }) => id === ids.popcorn));
    assert.ok(!data.catalog.some(({ id }) => id === ids.hidden));
    assert.equal(data.order, null);
  });

  await t.test("saves and reloads a draft with server prices and exact totals", async () => {
    const result = await request({ items: [
      { snackId: ids.popcorn, quantity: 2, unitPrice: 1 },
      { snackId: ids.soda, quantity: 1 },
    ] });
    assert.equal(result.status, 200);
    assert.equal(result.data.order.status, "PENDING");
    assert.equal(result.data.snackSubtotal, "146.00");
    assert.equal(result.data.estimatedTotal, "296.00");
    assert.deepEqual((await request()).data.order, result.data.order);
    assert.equal((await prisma.snack.findUniqueOrThrow({ where: { id: ids.popcorn } })).stockQuantity, 3);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: ids.booking } });
    assert.equal(booking.totalAmount.toFixed(2), "150.00");
  });

  await t.test("rejects invalid, unavailable and over-stock quantities and preserves the saved draft", async () => {
    for (const [snackId, quantity, status] of [
      [ids.popcorn, 1.5, 400], [ids.popcorn, 0, 400],
      [ids.popcorn, 4, 409], [ids.hidden, 1, 409],
    ]) {
      assert.equal((await request({ items: [{ snackId, quantity }] })).status, status);
    }
    const duplicate = { snackId: ids.popcorn, quantity: 1 };
    assert.equal((await request({ items: [duplicate, duplicate] })).status, 400);
    assert.equal((await request()).data.snackSubtotal, "146.00");
  });

  await t.test("replaces quantities and removes all items when saved empty", async () => {
    const items = [{ snackId: ids.popcorn, quantity: 1 }];
    const replaced = await request({ items });
    assert.equal(replaced.status, 200);
    assert.equal(replaced.data.order.items.length, 1);
    assert.equal(replaced.data.snackSubtotal, "60.25");
    assert.equal((await request({ items })).data.snackSubtotal, "60.25");
    assert.equal((await request({ items: [] })).data.order, null);
    assert.equal((await request({ items: [] })).data.estimatedTotal, "150.00");
  });

  await t.test("rejects expired and confirmed bookings", async () => {
    await prisma.booking.update({ where: { id: ids.booking }, data: { holdExpiresAt: later(-1) } });
    assert.equal((await request({ items: [] })).status, 409);
    await prisma.booking.update({
      where: { id: ids.booking }, data: { holdExpiresAt: later(10), status: "CONFIRMED" },
    });
    assert.equal((await request()).status, 409);
    assert.equal((await request({ items: [] })).status, 409);
  });
});
