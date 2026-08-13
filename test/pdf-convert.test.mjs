import assert from "node:assert/strict";
import test from "node:test";
import { decodeImageDataUrl } from "../lib/storage.mjs";

const pdfBase64 = Buffer.from("%PDF-1.4 fake content").toString("base64");

test("accepts a pdf data url", () => {
	const { mime, bytes } = decodeImageDataUrl(
		`data:application/pdf;base64,${pdfBase64}`,
		["application/pdf"],
	);
	assert.equal(mime, "application/pdf");
	assert.equal(bytes.toString("utf8"), "%PDF-1.4 fake content");
});

test("rejects a non-pdf mime when only pdf is allowed", () => {
	assert.throws(
		() =>
			decodeImageDataUrl(`data:image/png;base64,${pdfBase64}`, [
				"application/pdf",
			]),
		/Unsupported file type/,
	);
});
