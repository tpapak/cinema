import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Walk up from output/Test.ReadFixture/ to the project test/ dir
const fixturePath = path.resolve(__dirname, "../../test/fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

export const readFixtureImpl = function (name) {
  return function () {
    return fixtures[name];
  };
};
