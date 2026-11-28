require("dotenv").config();

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "Admin Movie Management API",
  {
    skip: testDatabaseUrl
      ? false
      : "Set TEST_DATABASE_URL to a separate migrated test database",
  },
  async (t) => {
    process.env.DATABASE_URL = testDatabaseUrl;

    const secret = randomUUID() + randomUUID();
    process.env.JWT_SECRET = secret;

    const prisma = require("../../db");
    const app = require("../../server");

    const adminId = randomUUID();
    const staffId = randomUUID();

    let server;
    let baseUrl;

    const adminToken = jwt.sign({}, secret, {
      subject: adminId,
      algorithm: "HS256",
    });

    const staffToken = jwt.sign({}, secret, {
      subject: staffId,
      algorithm: "HS256",
    });

    async function request(path, options = {}) {
      return fetch(`${baseUrl}/api/admin/movies${path}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers ?? {}),
        },
      });
    }

    async function adminRequest(path, options = {}) {
      return request(path, {
        ...options,
        headers: {
          Authorization: `Bearer ${adminToken}`,
          ...(options.headers ?? {}),
        },
      });
    }

    async function createMovie(title = "Test Movie") {
      return prisma.movie.create({
        data: {
          title,
          durationMin: 120,
        },
      });
    }

    t.after(async () => {
      if (server) {
        server.close();
        await once(server, "close");
      }

      await prisma.movie.deleteMany({
        where: { title: { startsWith: "Test Movie" } },
      });

      await prisma.user.deleteMany({
        where: { id: { in: [adminId, staffId] } },
      });

      await prisma.$disconnect();
    });

    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          name: "Test Admin",
          email: `${adminId}@test.local`,
          passwordHash: "test-password-hash",
          role: "ADMIN",
        },
        {
          id: staffId,
          name: "Test Staff",
          email: `${staffId}@test.local`,
          passwordHash: "test-password-hash",
          role: "STAFF",
        },
      ],
    });

    server = app.listen(0);
    await once(server, "listening");

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    await t.test("rejects requests without authentication", async () => {
      const response = await request("/");
      assert.equal(response.status, 401);
    });

    await t.test("rejects non-admin users", async () => {
      const response = await request("/", {
        headers: { Authorization: `Bearer ${staffToken}` },
      });

      assert.equal(response.status, 403);
    });

    await t.test("creates a movie", async () => {
      const response = await adminRequest("/", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Movie Create",
          durationMin: 120,
          genre: "Action",
        }),
      });

      assert.equal(response.status, 201);

      const data = await response.json();
      assert.equal(data.movie.title, "Test Movie Create");
      assert.equal(data.movie.durationMin, 120);
      assert.equal(data.movie.genre, "Action");
    });

    await t.test("rejects invalid movie data", async () => {
      const response = await adminRequest("/", {
        method: "POST",
        body: JSON.stringify({
          title: "",
          durationMin: -10,
        }),
      });

      assert.equal(response.status, 400);
    });

    await t.test("lists movies", async () => {
      const movie = await createMovie("Test Movie List");

      const response = await adminRequest("/");
      assert.equal(response.status, 200);

      const data = await response.json();
      assert.ok(data.movies.some((item) => item.id === movie.id));
    });

    await t.test("updates a movie", async () => {
      const movie = await createMovie("Test Movie Update");

      const response = await adminRequest(`/${movie.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Test Movie Updated" }),
      });

      assert.equal(response.status, 200);

      const data = await response.json();
      assert.equal(data.movie.title, "Test Movie Updated");
    });

    await t.test("rejects invalid update fields", async () => {
      const movie = await createMovie("Test Movie Invalid Update");

      const response = await adminRequest(`/${movie.id}`, {
        method: "PATCH",
        body: JSON.stringify({ unknownField: "value" }),
      });

      assert.equal(response.status, 400);
    });

    await t.test("archives a movie", async () => {
      const movie = await createMovie("Test Movie Archive");

      const response = await adminRequest(`/${movie.id}/archive`, {
        method: "PATCH",
      });

      assert.equal(response.status, 200);

      const data = await response.json();
      assert.equal(data.movie.status, "ARCHIVED");
    });

    await t.test("restores an archived movie", async () => {
      const movie = await prisma.movie.create({
        data: {
          title: "Test Movie Restore",
          durationMin: 100,
          status: "ARCHIVED",
        },
      });

      const response = await adminRequest(`/${movie.id}/restore`, {
        method: "PATCH",
        body: JSON.stringify({ status: "NOW_SHOWING" }),
      });

      assert.equal(response.status, 200);

      const data = await response.json();
      assert.equal(data.movie.status, "NOW_SHOWING");
    });

    await t.test("rejects restoring a movie with an invalid status", async () => {
      const movie = await createMovie("Test Movie Invalid Restore");

      const response = await adminRequest(`/${movie.id}/restore`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      assert.equal(response.status, 400);
    });

    await t.test("deletes a movie", async () => {
      const movie = await createMovie("Test Movie Delete");

      const response = await adminRequest(`/${movie.id}`, {
        method: "DELETE",
      });

      assert.equal(response.status, 200);

      const deletedMovie = await prisma.movie.findUnique({
        where: { id: movie.id },
      });

      assert.equal(deletedMovie, null);
    });

    await t.test("returns 404 when updating a missing movie", async () => {
      const response = await adminRequest(`/${randomUUID()}`, {
        method: "PATCH",
        body: JSON.stringify({ title: "Missing Movie" }),
      });

      assert.equal(response.status, 404);
    });
  }
);
