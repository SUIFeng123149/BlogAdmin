import { config } from "../config.mjs";
import { text } from "../utils.mjs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

export async function serveMarkedJs(response) {
	const content = await readFile(
		resolve(config.root, "public/assets/js/marked.min.js"),
		"utf8",
	);
	return text(
		response,
		200,
		content,
		"application/javascript; charset=utf-8",
	);
}

export async function serveStaticAsset(response, urlPathname) {
	const asset = resolve(config.root, `public${urlPathname}`);
	const allowed = [
		resolve(config.root, "public/assets/images"),
		resolve(config.root, "public/assets/diary"),
		resolve(config.root, "public/assets/anime"),
		resolve(config.root, "public/assets/music"),
	];
	if (
		!allowed.some(
			(directory) =>
				asset.startsWith(`${directory}\\`) ||
				asset.startsWith(`${directory}/`),
		)
	)
		return text(response, 403, "Forbidden.");
	const extension = extname(asset).toLowerCase();
	const type =
		extension === ".webp"
			? "image/webp"
			: extension === ".jpg" || extension === ".jpeg"
				? "image/jpeg"
				: extension === ".png"
					? "image/png"
					: extension === ".gif"
						? "image/gif"
						: extension === ".mp3"
							? "audio/mpeg"
							: "application/octet-stream";
	response.writeHead(200, {
		"Content-Type": type,
		"Cache-Control": "no-store",
	});
	return response.end(await readFile(asset));
}

export async function servePublicFile(response, urlPathname) {
	if (urlPathname === "/") urlPathname = "/index.html";
	const file = resolve(config.publicDir, `.${urlPathname}`);
	if (!file.startsWith(config.publicDir)) return text(response, 403, "Forbidden.");
	return text(
		response,
		200,
		await readFile(file, "utf8"),
		file.endsWith(".html")
			? "text/html; charset=utf-8"
			: "text/plain; charset=utf-8",
	);
}
