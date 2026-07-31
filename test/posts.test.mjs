import assert from "node:assert/strict";
import test from "node:test";
import {
	isVerificationStale,
	serializePost,
	verificationStaleAfterDays,
} from "../lib/posts.mjs";

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

test("marks verified articles stale after the configured verification interval", () => {
	assert.equal(verificationStaleAfterDays, 180);
	assert.equal(isVerificationStale("2026-01-01", "2026-06-30"), true);
	assert.equal(isVerificationStale("2026-01-02", "2026-06-30"), false);
	assert.equal(isVerificationStale("", "2026-06-30"), false);
});
