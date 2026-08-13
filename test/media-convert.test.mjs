import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { imageToWebp } from "../services/media.mjs";

test("imageToWebp converts PNG bytes to a valid WebP buffer", async () => {
	const png = await sharp({
		create: {
			width: 8,
			height: 8,
			channels: 3,
			background: { r: 200, g: 30, b: 60 },
		},
	})
		.png()
		.toBuffer();
	const webp = await imageToWebp(png);
	assert.equal(webp.toString("ascii", 0, 4), "RIFF");
	assert.equal(webp.toString("ascii", 8, 12), "WEBP");
});

test("imageToWebp accepts a JPEG input", async () => {
	const jpeg = await sharp({
		create: {
			width: 4,
			height: 4,
			channels: 3,
			background: { r: 0, g: 120, b: 200 },
		},
	})
		.jpeg()
		.toBuffer();
	const webp = await imageToWebp(jpeg);
	assert.equal(webp.toString("ascii", 0, 4), "RIFF");
	assert.equal(webp.toString("ascii", 8, 12), "WEBP");
});

test("imageToWebp throws on invalid image bytes", async () => {
	await assert.rejects(() => imageToWebp(Buffer.from("not an image")), /无效或已损坏/);
});