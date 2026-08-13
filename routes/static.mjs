import { config } from "../config.mjs";
import { text } from "../utils.mjs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { getObject } from "../lib/oss.mjs";

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

function contentTypeFor(extension) {
	return (
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
							: extension === ".svg"
								? "image/svg+xml"
								: "application/octet-stream"
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
	const type = contentTypeFor(extension);

	// 优先本地；媒体已迁移 OSS，本地缺失时回退到 OSS 读取
	try {
		const content = await readFile(asset);
		response.writeHead(200, {
			"Content-Type": type,
			"Cache-Control": "no-store",
		});
		return response.end(content);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	try {
		const { content } = await getObject(urlPathname.replace(/^\//, ""));
		response.writeHead(200, {
			"Content-Type": type,
			"Cache-Control": "no-store",
		});
		return response.end(content);
	} catch (error) {
		if (error.code === "NoSuchKey" || error.code === "NoSuchObject")
			return text(response, 404, "Not found.");
		throw error;
	}
}

export async function servePublicFile(response, urlPathname) {
	if (urlPathname === "/") urlPathname = "/index.html";
	const file = resolve(config.publicDir, `.${urlPathname}`);
	if (!file.startsWith(config.publicDir)) return text(response, 403, "Forbidden.");
	const extension = extname(file).toLowerCase();
	const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(extension);
	if (isImage) {
		const type =
			extension === ".webp" ? "image/webp"
			: extension === ".png" ? "image/png"
			: extension === ".gif" ? "image/gif"
			: extension === ".svg" ? "image/svg+xml"
			: "image/jpeg";
		const content = await readFile(file);
		response.writeHead(200, {
			"Content-Type": type,
			"Cache-Control": "public, max-age=86400",
		});
		return response.end(content);
	}
	const contentType =
		extension === ".css"
			? "text/css; charset=utf-8"
			: extension === ".js"
				? "application/javascript; charset=utf-8"
				: extension === ".html"
					? "text/html; charset=utf-8"
					: extension === ".woff2"
						? "font/woff2"
						: extension === ".ttf"
							? "font/ttf"
							: "text/plain; charset=utf-8";
	/* 字体文件是二进制，必须以 buffer 读取，否则 utf8 转码会损坏 */
	if (extension === ".woff2" || extension === ".ttf") {
		const content = await readFile(file);
		response.writeHead(200, {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=86400",
		});
		return response.end(content);
	}
	return text(response, 200, await readFile(file, "utf8"), contentType);
}
