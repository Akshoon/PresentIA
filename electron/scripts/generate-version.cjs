const fs = require("fs");
const path = require("path");

const electronRoot = path.join(__dirname, "..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(electronRoot, "package.json"), "utf8"),
);
let existing = {};
try {
  existing = JSON.parse(
    fs.readFileSync(path.join(electronRoot, "version.json"), "utf8"),
  );
} catch (_) {}

const version = pkg.version;

const update = {
  version,
  message: process.env.UPDATE_MESSAGE || existing.message || "",
  downloads: {
    linux: `https://github.com/presentia/presentia/releases/download/electron-v${version}/PresentIA-${version}.deb`,
    mac: `https://github.com/presentia/presentia/releases/download/electron-v${version}/PresentIA-${version}.dmg`,
    windows: `https://github.com/presentia/presentia/releases/download/electron-v${version}/PresentIA-${version}.exe`,
  },
};

fs.writeFileSync(
  path.join(electronRoot, "version.json"),
  JSON.stringify(update, null, 2),
);

console.log("version.json generated");
