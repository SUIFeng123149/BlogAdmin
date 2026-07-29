import assert from "node:assert/strict";
import test from "node:test";
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
