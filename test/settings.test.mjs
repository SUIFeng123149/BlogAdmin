import assert from "node:assert/strict";
import test from "node:test";
import { parseAdvancedJson } from "../lib/settings.mjs";

test("rejects invalid advanced settings JSON", () => {
	assert.throws(() => parseAdvancedJson("{bad}"), /JSON/i);
});

test("accepts an object as advanced settings JSON", () => {
	assert.deepEqual(parseAdvancedJson('{"announcement":{"enable":true}}'), {
		announcement: { enable: true },
	});
});
