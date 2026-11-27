const assert = require("node:assert/strict");
const test = require("node:test");
const { hashPassword, verifyPassword } = require("../../password");

test("a password hash accepts the correct password only", async () => {
  const password = "Cinema test password";
  const hash = await hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("incorrect password", hash), false);
  assert.equal(await verifyPassword(password, "malformed hash"), false);
});

test("hashing the same password twice produces distinct salted hashes", async () => {
  const password = "Cinema test password";
  assert.notEqual(await hashPassword(password), await hashPassword(password));
});
