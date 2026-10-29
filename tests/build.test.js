import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const example = {
  apiKey: "synthetic-public-key",
  authDomain: "example.firebaseapp.com",
  projectId: "example-project",
  appId: "synthetic-public-app",
};
function blocked(config, args = []) {
  return spawnSync(process.execPath, ["scripts/build.mjs", ...args], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    env: {
      ...process.env,
      FRAME_REQUIRE_ACCOUNTS: "true",
      FRAME_FIREBASE_CONFIG: JSON.stringify(config),
    },
  });
}
test("production builds reject missing account configuration", () => {
  const result = blocked(null);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Production account deployment requires/);
});
test("production builds reject local demo projects and emulator mode", () => {
  for (const [config, args] of [
    [{ ...example, projectId: "demo-frame" }, []],
    [example, ["--emulators"]],
  ]) {
    const result = blocked(config, args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Production account deployment requires/);
  }
});
test("builds reject server credentials in public web configuration", () => {
  const result = blocked({
    ...example,
    private_key: "synthetic-never-embed-this",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Only public Firebase web configuration/);
});
