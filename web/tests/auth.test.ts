import assert from "node:assert/strict";
import test from "node:test";
import { isDevelopmentAuthBypassEnabled } from "../lib/development.ts";

test("local auth bypass requires both development mode and the explicit dev flag", () => {
  assert.equal(isDevelopmentAuthBypassEnabled(true, "1"), true);
  assert.equal(isDevelopmentAuthBypassEnabled(false, "1"), false);
  assert.equal(isDevelopmentAuthBypassEnabled(true, undefined), false);
});
