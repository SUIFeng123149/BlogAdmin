import assert from "node:assert/strict";
import test from "node:test";
import { parseGitStatus } from "../lib/resources.mjs";

test("parses porcelain git status into changed paths", () => {
	assert.deepEqual(parseGitStatus(" M src/config.ts\n?? public/a.webp\n"), [
		"src/config.ts",
		"public/a.webp",
	]);
});
