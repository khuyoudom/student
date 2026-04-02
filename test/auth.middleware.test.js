const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const { ensureAuth, ensureAdmin, apiAuth, apiAdmin } = require("../src/middleware/auth");

function makeRes() {
  return {
    statusCode: 200,
    redirectedTo: null,
    jsonBody: null,
    rendered: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    redirect(path) {
      this.redirectedTo = path;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
    render(view, payload) {
      this.rendered = { view, payload };
      return this;
    }
  };
}

test("ensureAuth redirects unauthenticated requests", () => {
  const req = { session: {} };
  const res = makeRes();
  let nextCalled = false;

  ensureAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.redirectedTo, "/login");
});

test("ensureAuth calls next for authenticated requests", () => {
  const req = { session: { user: { id: "123" } } };
  const res = makeRes();
  let nextCalled = false;

  ensureAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.redirectedTo, null);
});

test("ensureAdmin blocks non-admin users", () => {
  const req = { session: { user: { role: "user" } } };
  const res = makeRes();
  let nextCalled = false;

  ensureAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.rendered.view, "error");
});

test("ensureAdmin allows admin users", () => {
  const req = { session: { user: { role: "admin" } } };
  const res = makeRes();
  let nextCalled = false;

  ensureAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("apiAuth returns 401 when token is missing", () => {
  const req = { headers: {} };
  const res = makeRes();
  let nextCalled = false;

  apiAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
});

test("apiAuth returns 401 when token is invalid", () => {
  const req = { headers: { authorization: "Bearer invalid.token" } };
  const res = makeRes();
  let nextCalled = false;

  apiAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Invalid token" });
});

test("apiAuth attaches payload for valid token", () => {
  const token = jwt.sign({ id: "1", role: "admin" }, process.env.JWT_SECRET || "dev-secret");
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = makeRes();
  let nextCalled = false;

  apiAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.apiUser.id, "1");
  assert.equal(req.apiUser.role, "admin");
});

test("apiAdmin blocks non-admin API users", () => {
  const req = { apiUser: { role: "user" } };
  const res = makeRes();
  let nextCalled = false;

  apiAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonBody, { message: "Admin role required" });
});

test("apiAdmin allows admin API users", () => {
  const req = { apiUser: { role: "admin" } };
  const res = makeRes();
  let nextCalled = false;

  apiAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
