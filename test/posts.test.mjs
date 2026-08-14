import assert from "node:assert/strict";
import test from "node:test";
import {
	FEATURED_LIMIT,
	assertFeaturedLimit,
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

test("featured limit allows reaching the cap", () => {
	assert.doesNotThrow(() =>
		assertFeaturedLimit(FEATURED_LIMIT - 1, true),
	);
});

test("featured limit rejects exceeding the cap", () => {
	assert.throws(
		() => assertFeaturedLimit(FEATURED_LIMIT, true),
		/精选最多 6 篇/,
	);
	assert.throws(
		() => assertFeaturedLimit(FEATURED_LIMIT + 2, true),
		/精选最多 6 篇/,
	);
});

test("featured limit ignores non-featured saves", () => {
	assert.doesNotThrow(() => assertFeaturedLimit(100, false));
	assert.doesNotThrow(() => assertFeaturedLimit(100, undefined));
});
