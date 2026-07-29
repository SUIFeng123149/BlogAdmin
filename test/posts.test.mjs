import assert from "node:assert/strict";
import test from "node:test";
import { serializePost } from "../lib/posts.mjs";

test("serializes homepage placement fields for an article", () => {
	const saved = serializePost({
		title: "Article",
		featured: true,
		contentSection: "technical",
		status: "verified",
	});

	assert.match(saved, /featured: true/);
	assert.match(saved, /contentSection: technical/);
	assert.match(saved, /status: verified/);
});

test("rejects an unknown homepage section", () => {
	assert.throws(
		() => serializePost({ title: "Article", contentSection: "invalid" }),
		/content section/i,
	);
});
