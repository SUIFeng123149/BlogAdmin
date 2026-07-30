import { config } from "../config.mjs";
import { validateAlbumId, normalizeAlbumInfo } from "../lib/albums.mjs";
import { assertPathInside } from "../lib/storage.mjs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

function albumDirectory(id) {
	const directory = resolve(config.albumsDir, validateAlbumId(id));
	assertPathInside(config.albumsDir, directory);
	return directory;
}

export async function readAlbum(id) {
	const safeId = validateAlbumId(id);
	const directory = albumDirectory(safeId);
	const info = JSON.parse(await readFile(join(directory, "info.json"), "utf8"));
	const files = await readdir(directory, { withFileTypes: true });
	const images = files
		.filter((entry) => entry.isFile() && /\.(avif|gif|jpe?g|png|webp)$/i.test(entry.name))
		.map((entry) => entry.name)
		.sort();
	return { id: safeId, ...normalizeAlbumInfo(info), images };
}

export async function listAlbums() {
	const entries = await readdir(config.albumsDir, { withFileTypes: true }).catch(() => []);
	const albums = await Promise.all(
		entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
			try {
				return await readAlbum(entry.name);
			} catch {
				return null;
			}
		}),
	);
	return albums.filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
}

export async function writeAlbum(id, value) {
	const safeId = validateAlbumId(id);
	const directory = albumDirectory(safeId);
	await mkdir(directory, { recursive: true });
	const infoPath = join(directory, "info.json");
	const source = `${JSON.stringify(normalizeAlbumInfo(value), null, 2)}\n`;
	await writeFile(`${infoPath}.backup`, await readFile(infoPath, "utf8").catch(() => ""), "utf8");
	await writeFile(infoPath, source, "utf8");
	return readAlbum(safeId);
}
