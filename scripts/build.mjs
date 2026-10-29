import { build } from "esbuild";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
const emulator = process.argv.includes("--emulators");
let config = null;
if (emulator)
  config = {
    apiKey: "demo-frame-public-key",
    authDomain: "demo-frame.firebaseapp.com",
    projectId: "demo-frame",
    appId: "demo-frame",
  };
else if (process.env.FRAME_FIREBASE_CONFIG)
  config = JSON.parse(process.env.FRAME_FIREBASE_CONFIG);
else {
  try {
    config = JSON.parse(await readFile(".firebase-web.json", "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (config) {
  for (const field of ["apiKey", "authDomain", "projectId", "appId"])
    if (
      typeof config[field] !== "string" ||
      !config[field] ||
      /COPY_|YOUR_/.test(config[field])
    )
      throw new Error(`Missing real Firebase ${field}.`);
  // Only public browser configuration is accepted; no service-account or private key fields.
  if (
    Object.keys(config).some(
      (key) =>
        ![
          "apiKey",
          "authDomain",
          "projectId",
          "appId",
          "messagingSenderId",
          "storageBucket",
          "measurementId",
        ].includes(key),
    )
  )
    throw new Error("Only public Firebase web configuration may be bundled.");
}
if (process.env.FRAME_REQUIRE_ACCOUNTS === "true" && !config)
  throw new Error(
    "Production account deployment requires FRAME_FIREBASE_CONFIG.",
  );
await mkdir("dist/vendor", { recursive: true });
await build({
  entryPoints: ["src/firebase-client.js"],
  outfile: "dist/vendor/accounts.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  legalComments: "linked",
});
await writeFile(
  "dist/account-config.js",
  `// Generated public browser configuration. Never put server credentials here.\nexport const accountConfig = ${JSON.stringify(config)};\nexport const useEmulators = ${emulator};\n`,
);
const pkg = JSON.parse(
  await readFile("node_modules/firebase/package.json", "utf8"),
);
await copyFile(
  "licenses/FIREBASE-LICENSE.txt",
  "dist/vendor/FIREBASE-LICENSE.txt",
);
console.log(
  `Built Firebase ${pkg.version} account client (${emulator ? "local emulator" : config ? "configured project" : "accounts unconfigured; guest mode only"}).`,
);
