import { relative, isAbsolute } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export function assertPathInside(root, target) {
	const relativePath = relative(root, target);
	if (
		relativePath === "" ||
		relativePath.startsWith("..") ||
		isAbsolute(relativePath)
	)
		throw new Error("Path is outside the allowed root");
	return target;
}

export function decodeImageDataUrl(data, allowedMimes) {
	const match = String(data || "").match(/^data:([^;]+);base64,([\s\S]+)$/);
	if (!match || !allowedMimes.includes(match[1].toLowerCase()))
		throw new Error("Unsupported file type");
	return {
		mime: match[1].toLowerCase(),
		bytes: Buffer.from(match[2], "base64"),
	};
}

export async function writeTextWithBackup(file, content) {
	const source = await readFile(file, "utf8");
	await writeFile(`${file}.backup`, source, "utf8");
	await writeFile(file, content, "utf8");
}
