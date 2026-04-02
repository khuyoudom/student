const test = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");

const { toObjectId, getDb } = require("../src/config/mongodb");

test("toObjectId returns null for invalid values", () => {
  assert.equal(toObjectId(null), null);
  assert.equal(toObjectId(""), null);
  assert.equal(toObjectId("not-a-valid-objectid"), null);
});

test("toObjectId returns ObjectId for valid values", () => {
  const source = new ObjectId().toString();
  const objectId = toObjectId(source);

  assert.ok(objectId instanceof ObjectId);
  assert.equal(objectId.toString(), source);
});

test("getDb throws when MongoDB has not been connected", () => {
  assert.throws(() => getDb(), /MongoDB is not connected/);
});
