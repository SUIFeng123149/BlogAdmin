import { json, text } from "../utils.mjs";
import { readBody, isAuthenticated } from "../auth.mjs";
import {
	listPosts,
	readPost,
	createPost,
	updatePost,
	deletePost,
	savePostAsset,
	listStalePosts,
	reverifyPosts,
} from "../services/posts.mjs";
import { readSettings, writeSettings } from "../services/settings.mjs";
import {
	readCollection,
	writeCollection,
} from "../services/collections.mjs";
import { readAlbum, listAlbums, writeAlbum } from "../services/albums.mjs";
import {
	saveCollectionMedia,
	deleteCollectionMedia,
	convertToWebp,
	convertAudio,
	getWorkspaceStatus,
} from "../services/media.mjs";
import {
	readTagLibrary,
	addToTagLibrary,
	readArtistLibrary,
	getCategoryOptions,
	getTechStack,
	getDataTaxonomies,
} from "../services/library.mjs";
import { triggerDeploy } from "../services/deploy.mjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { sessions, parseCookies } from "../auth.mjs";
import { config } from "../config.mjs";
import { basename, extname, join } from "node:path";

export async function handleApi(request, response, pathname) {
	if (pathname === "/api/login" && request.method === "POST") {
		const body = await readBody(request);
		const supplied = Buffer.from(String(body.password || ""));
		const expected = Buffer.from(config.password);
		if (
			supplied.length !== expected.length ||
			!timingSafeEqual(supplied, expected)
		)
			return json(response, 401, { error: "密码错误。" });
		const token = randomBytes(32).toString("hex");
		sessions.set(token, { expires: Date.now() + 8 * 60 * 60 * 1000 });
		response.writeHead(204, {
			"Set-Cookie": `mizuki_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
			"Cache-Control": "no-store",
		});
		return response.end();
	}
	if (pathname === "/api/logout" && request.method === "POST") {
		response.writeHead(204, {
			"Set-Cookie":
				"mizuki_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
		});
		return response.end();
	}
	if (!isAuthenticated(request))
		return json(response, 401, { error: "需要身份验证。" });
	if (pathname === "/api/session")
		return json(response, 200, { authenticated: true });
	if (pathname === "/api/workspace" && request.method === "GET")
		return json(response, 200, await getWorkspaceStatus());
	if (pathname === "/api/convert-webp" && request.method === "POST") {
		const body = await readBody(request);
		return json(response, 200, await convertToWebp(body));
	}
	if (pathname === "/api/convert-audio" && request.method === "POST") {
		const body = await readBody(request);
		return json(response, 200, await convertAudio(body));
	}
	if (pathname === "/api/pdf-to-markdown" && request.method === "POST") {
		const { pdfToMarkdown } = await import("../services/pdf-convert.mjs");
		return json(response, 200, await pdfToMarkdown(await readBody(request)));
	}
	if (pathname === "/api/albums" && request.method === "GET")
		return json(response, 200, { items: await listAlbums() });
	if (pathname === "/api/albums" && request.method === "POST") {
		const body = await readBody(request);
		const { validateAlbumId } = await import("../lib/albums.mjs");
		const id = validateAlbumId(body.id || body.title);
		return json(response, 201, { item: await writeAlbum(id, body) });
	}
	if (pathname.startsWith("/api/albums/") && request.method === "GET") {
		const id = decodeURIComponent(pathname.slice("/api/albums/".length));
		return json(response, 200, { item: await readAlbum(id) });
	}
	if (pathname.startsWith("/api/albums/") && request.method === "PUT") {
		const id = decodeURIComponent(pathname.slice("/api/albums/".length));
		return json(response, 200, { item: await writeAlbum(id, await readBody(request)) });
	}
	if (pathname === "/api/posts" && request.method === "GET")
		return json(response, 200, await listPosts());
	if (pathname === "/api/posts/stale" && request.method === "GET")
		return json(response, 200, { items: await listStalePosts() });
	if (pathname === "/api/posts/reverify" && request.method === "POST") {
		const body = await readBody(request);
		return json(
			response,
			200,
			await reverifyPosts(
				Array.isArray(body.slugs) ? body.slugs.map(String) : [],
			),
		);
	}
	const assetMatch = pathname.match(/^\/api\/posts\/([^/]+)\/assets\/([^/]+)$/);
	if (assetMatch && request.method === "GET") {
		const { assetDirectoryForSlug } = await import("../utils.mjs");
		const slug = decodeURIComponent(assetMatch[1]);
		const filename = basename(decodeURIComponent(assetMatch[2]));
		const extension = extname(filename).toLowerCase();
		const contentType =
			extension === ".webp"
				? "image/webp"
				: extension === ".mp4"
					? "video/mp4"
					: extension === ".webm"
						? "video/webm"
						: "application/octet-stream";
		const { readFile } = await import("node:fs/promises");
		const asset = await readFile(join(assetDirectoryForSlug(slug), filename));
		response.writeHead(200, {
			"Content-Type": contentType,
			"Cache-Control": "no-store",
		});
		return response.end(asset);
	}
	if (assetMatch && request.method === "DELETE") {
		const { assertPathInside } = await import("../lib/storage.mjs");
		const { assetDirectoryForSlug } = await import("../utils.mjs");
		const { unlink } = await import("node:fs/promises");
		const slug = decodeURIComponent(assetMatch[1]);
		const filename = basename(decodeURIComponent(assetMatch[2]));
		const directory = assetDirectoryForSlug(slug);
		const target = join(directory, filename);
		assertPathInside(directory, target);
		await unlink(target);
		return json(response, 200, { deleted: filename });
	}
	if (pathname.startsWith("/api/posts/") && request.method === "GET") {
		const slug = decodeURIComponent(pathname.slice("/api/posts/".length));
		return json(response, 200, await readPost(slug));
	}
	if (pathname === "/api/posts" && request.method === "POST") {
		const body = await readBody(request);
		try {
			const result = await createPost(body);
			return json(response, 201, result);
		} catch (error) {
			if (error.message === "此文件名已存在。")
				return json(response, 409, { error: "此文件名已存在。" });
			throw error;
		}
	}
	if (
		pathname.startsWith("/api/posts/") &&
		pathname.endsWith("/assets") &&
		request.method === "POST"
	) {
		const slug = decodeURIComponent(
			pathname.slice("/api/posts/".length, -"/assets".length),
		);
		return json(
			response,
			201,
			await savePostAsset(slug, await readBody(request)),
		);
	}
	if (pathname.startsWith("/api/posts/") && request.method === "PUT") {
		const currentSlug = decodeURIComponent(
			pathname.slice("/api/posts/".length),
		);
		return json(response, 200, await updatePost(currentSlug, await readBody(request)));
	}
	if (pathname.startsWith("/api/posts/") && request.method === "DELETE") {
		const slug = decodeURIComponent(pathname.slice("/api/posts/".length));
		return json(response, 200, await deletePost(slug));
	}
	if (pathname === "/api/options/categories" && request.method === "GET")
		return json(response, 200, await getCategoryOptions());
	if (pathname === "/api/options/artists" && request.method === "GET")
		return json(response, 200, await readArtistLibrary());
	if (pathname === "/api/options/tech-stack" && request.method === "GET")
		return json(response, 200, await getTechStack());
	if (pathname === "/api/options/data-taxonomies" && request.method === "GET")
		return json(response, 200, await getDataTaxonomies());
	if (pathname === "/api/tags" && request.method === "GET")
		return json(response, 200, await readTagLibrary());
	if (pathname === "/api/tags" && request.method === "POST") {
		const body = await readBody(request);
		return json(response, 201, await addToTagLibrary([body.tag]));
	}
	const collectionAssetMatch = pathname.match(/^\/api\/data\/([^/]+)\/assets$/);
	if (collectionAssetMatch && request.method === "POST") {
		const collection = decodeURIComponent(collectionAssetMatch[1]);
		return json(
			response,
			201,
			await saveCollectionMedia(collection, await readBody(request)),
		);
	}
	const collectionAssetDeleteMatch = pathname.match(/^\/api\/data\/([^/]+)\/assets\/([^/]+)$/);
	if (collectionAssetDeleteMatch && request.method === "DELETE")
		return json(response, 200, await deleteCollectionMedia(
			decodeURIComponent(collectionAssetDeleteMatch[1]),
			decodeURIComponent(collectionAssetDeleteMatch[2]),
		));
	if (pathname === "/api/data/projects/remote" && request.method === "GET") {
		const { previewRemoteProjects } = await import(
			"../services/remote-projects.mjs"
		);
		return json(response, 200, await previewRemoteProjects());
	}
	if (pathname === "/api/data/projects/sync" && request.method === "POST") {
		const { syncRemoteProjects } = await import(
			"../services/remote-projects.mjs"
		);
		const body = await readBody(request);
		return json(
			response,
			200,
			await syncRemoteProjects({
				mode: body.mode || "add-only",
				ids: Array.isArray(body.ids) ? body.ids : undefined,
			}),
		);
	}
	if (pathname === "/api/data" && request.method === "GET") {
		const { dataCollections } = await import("../services/collections.mjs");
		return json(response, 200, Object.keys(dataCollections));
	}
	if (pathname.startsWith("/api/data/") && request.method === "GET") {
		return json(
			response,
			200,
			await readCollection(
				decodeURIComponent(pathname.slice("/api/data/".length)),
			),
		);
	}
	if (pathname.startsWith("/api/data/") && request.method === "PUT") {
		const name = decodeURIComponent(pathname.slice("/api/data/".length));
		const body = await readBody(request);
		await writeCollection(name, body.items);
		return json(response, 200, { deployment: await triggerDeploy() });
	}
	if (pathname === "/api/settings" && request.method === "GET")
		return json(response, 200, await readSettings());
	if (pathname === "/api/settings" && request.method === "PUT") {
		await writeSettings(await readBody(request));
		return json(response, 200, { deployment: await triggerDeploy() });
	}
	return json(response, 404, { error: "未找到。" });
}
