import assert from "node:assert/strict";
import test from "node:test";
import { assertPathInside, decodeImageDataUrl } from "../lib/storage.mjs";

test("rejects a path outside the declared root", () => {
	assert.throws(
		() => assertPathInside("C:/blog", "C:/other/file.jpg"),
		/outside/i,
	);
});

test("decodes only allowed image data URLs", () => {
	assert.throws(
		() =>
			decodeImageDataUrl("data:text/plain;base64,SGk=", ["image/webp"]),
		/type/i,
	);
});
