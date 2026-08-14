import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeAlbumInfo, validateAlbumId } from "../lib/albums.mjs";

test("rejects an unsafe album identifier", () => {
	assert.throws(() => validateAlbumId("../outside"), /invalid/i);
});

test("normalizes local album metadata", () => {
	assert.deepEqual(normalizeAlbumInfo({ title: "旅行", columns: 9 }), {
		title: "旅行",
		description: "",
		date: "",
		location: "",
		tags: [],
		layout: "grid",
		columns: 3,
		hidden: false,
	});
});

test("provides an album workspace in the admin interface", async () => {
	const page = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
	const scripts = await readFile(new URL("../public/js/03-nav-controls.js", import.meta.url), "utf8");
	assert.match(scripts, /dataset\.view="albums"/);
	assert.match(page, /id="albums"/);
	assert.match(scripts, /main.*append\(.*albums.*workspace/s);
});
