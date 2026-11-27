const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const test = require("node:test");
const jwt = require("jsonwebtoken");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("customer authentication API", {
  skip: testDatabaseUrl ? false : "Set TEST_DATABASE_URL to a separate migrated database",
}, async (t) => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const secret = randomUUID() + randomUUID();
  process.env.JWT_SECRET = secret;

  const app = require("../../server");
  const prisma = require("../../db");
  const server = app.listen(0, "127.0.0.1");
  const email = "auth-test-" + randomUUID() + "@example.com";
  const password = "Cinema test password";
  let user;

  t.after(async () => {
    try {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    } finally {
      try {
        await prisma.user.deleteMany({ where: { email } });
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port + "/api/auth";

  async function request(route, { body, token } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = "Bearer " + token;

    const response = await fetch(base + route, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return { status: response.status, data: await response.json() };
  }

  await t.test("rejects invalid registration input and normalizes valid registration", async () => {
    const invalid = await request("/register", {
      body: { name: "Tester", email, password: "short" },
    });
    assert.equal(invalid.status, 400);

    const result = await request("/register", {
      body: { name: " Tester ", email: " " + email.toUpperCase() + " ", password, role: "ADMIN" },
    });
    assert.equal(result.status, 201);
    user = result.data.user;
    assert.deepEqual(user, { id: user.id, name: "Tester", email, role: "CUSTOMER" });
    assert.ok(user.id);
  });

  await t.test("rejects duplicate registration and an incorrect password", async () => {
    assert.equal((await request("/register", {
      body: { name: "Tester", email, password },
    })).status, 409);
    assert.equal((await request("/login", {
      body: { email, password: "incorrect" },
    })).status, 401);
  });

  await t.test("logs in, verifies the token, and rejects invalid sessions", async () => {
    const login = await request("/login", { body: { email, password } });
    assert.equal(login.status, 200);
    assert.deepEqual(login.data.user, user);
    const { token } = login.data;
    assert.equal(typeof token, "string");
    assert.deepEqual(await request("/me", { token }), { status: 200, data: { user } });
    assert.equal((await request("/me")).status, 401);
    const invalidToken = jwt.sign({}, "another signing key", { subject: user.id });
    assert.equal((await request("/me", { token: invalidToken })).status, 401);
    const expired = jwt.sign({}, secret, { subject: user.id, expiresIn: -60 });
    assert.equal((await request("/me", { token: expired })).status, 401);

    await prisma.user.update({ where: { id: user.id }, data: { role: "STAFF" } });
    assert.equal((await request("/me", { token })).data.user.role, "STAFF");

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    assert.equal((await request("/me", { token })).status, 401);
    assert.equal((await request("/login", { body: { email, password } })).status, 401);
  });
});
