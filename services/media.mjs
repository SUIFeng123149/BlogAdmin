import { config } from "../config.mjs";
import { safeAssetName } from "../utils.mjs";
import { decodeImageDataUrl } from "../lib/storage.mjs";
import { uploadBuffer, deleteObject } from "../lib/oss.mjs";
import { decryptNCM, convertToMp3, detectAudioFormat, formatSize } from "../lib/audio.mjs";
import { basename } from "node:path";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseGitStatus } from "../lib/resources.mjs";

const execFileAsync = promisify(execFile);

const IMAGE_FORMATS = [
	"image/webp",
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/tiff",
	"image/avif",
];

export async function imageToWebp(bytes) {
	try {
		return await sharp(bytes).webp({ quality: 80 }).toBuffer();
	} catch {
		throw new Error("图片文件无效或已损坏。");
	}
}

export async function saveCollectionMedia(collection, body) {
	const match = String(body.data || "").match(
		/^data:([^;]+);base64,([\s\S]+)$/,
	);
	if (!match) throw new Error("上传数据无效。");
	const { mime, bytes } = decodeImageDataUrl(body.data, [
		...IMAGE_FORMATS,
		"audio/mpeg",
	]);
	if (bytes.length > 30 * 1024 * 1024)
		throw new Error("图片过大，请上传小于 30 MB 的文件。");
	const field = body.field || "cover";
	const isImage = IMAGE_FORMATS.includes(mime);
	let keyPrefix;
	let extension;
	let publicPath;
	let output = bytes;
	if (collection === "projects" || collection === "anime" || collection === "diary") {
		if (!isImage) throw new Error("图片格式不支持，请上传 PNG、JPEG、GIF、WebP、TIFF 或 AVIF。");
		if (mime !== "image/webp") output = await imageToWebp(bytes);
		keyPrefix =
			collection === "projects"
				? "assets/images"
				: collection === "anime"
					? "assets/anime"
					: "assets/diary";
		extension = "webp";
		publicPath = keyPrefix;
	} else if (collection === "music" && field === "cover") {
		if (!isImage) throw new Error("音乐封面必须为图片文件。");
		if (mime !== "image/webp") output = await imageToWebp(bytes);
		keyPrefix = "assets/music/cover";
		extension = "webp";
		publicPath = keyPrefix;
	} else if (collection === "music" && field === "url") {
		if (mime !== "audio/mpeg") throw new Error("音乐文件必须为 MP3。");
		keyPrefix = "assets/music/url";
		extension = "mp3";
		publicPath = keyPrefix;
	} else {
		throw new Error("此字段不支持上传。");
	}
	const filename = safeAssetName(body.name, extension);
	const contentType = extension === "mp3" ? "audio/mpeg" : "image/webp";
	await uploadBuffer(`${keyPrefix}/${filename}`, output, contentType);
	return { path: `/${publicPath}/${filename}` };
}

export async function deleteCollectionMedia(collection, filename) {
	const safeName = basename(filename);
	const prefixes = {
		projects: "assets/images",
		anime: "assets/anime",
		diary: "assets/diary",
		music: "assets/music/cover",
		musicUrl: "assets/music/url",
	};
	const prefix = prefixes[collection];
	if (!prefix) throw new Error("此集合不支持删除媒体。");
	await deleteObject(`${prefix}/${safeName}`);
	return { deleted: safeName };
}

export async function convertToWebp(body) {
	const match = String(body.data || "").match(/^data:([^;]+);base64,([\s\S]+)$/);
	if (!match) throw new Error("上传数据无效。");
	const format = match[1];
	if (!/^image\/(png|jpeg|jpg|gif|webp|tiff|avif)$/i.test(format))
		throw new Error("不支持的图片格式，请上传 PNG、JPEG、GIF、TIFF 或 AVIF 格式。");
	const buffer = Buffer.from(match[2], "base64");
	if (buffer.length > 30 * 1024 * 1024)
		throw new Error("图片过大，请上传小于 30 MB 的文件。");
	const quality = Math.min(100, Math.max(1, Number(body.quality) || 80));
	const webpBuffer = await sharp(buffer).webp({ quality }).toBuffer();
	return {
		data: `data:image/webp;base64,${webpBuffer.toString("base64")}`,
		originalName: body.name || "converted",
		originalSize: buffer.length,
		webpSize: webpBuffer.length,
		compression: buffer.length > 0 ? ((1 - webpBuffer.length / buffer.length) * 100).toFixed(1) : "0.0",
	};
}

export async function convertAudio(body) {
	const match = String(body.data || "").match(/^data:([^;]+);base64,([\s\S]+)$/);
	if (!match) throw new Error("上传数据无效。");
	const originalBuffer = Buffer.from(match[2], "base64");
	if (originalBuffer.length > 100 * 1024 * 1024)
		throw new Error("文件过大，请上传小于 100 MB 的文件。");
	const fileName = body.name || "audio";
	const bitRate = Math.min(320, Math.max(64, Number(body.bitRate) || 192));
	let audioBuffer;
	let innerFormat = "mp3";
	let conversionNote = "";
	let mimeType = "audio/mpeg";
	if (/\.ncm$/i.test(fileName)) {
		// NCM decryption
		audioBuffer = decryptNCM(originalBuffer);
		innerFormat = detectAudioFormat(audioBuffer);
		conversionNote = `NCM 解密完成 (内部格式: ${innerFormat.toUpperCase()})`;
	} else {
		// Assume it's a raw audio format
		audioBuffer = originalBuffer;
		innerFormat = detectAudioFormat(audioBuffer);
		conversionNote = `原始格式: ${innerFormat.toUpperCase()}`;
	}
	// For already-playable formats, skip ffmpeg re-encoding (avoids quality loss & bloat)
	const noReencodeFormats = new Set(["mp3", "flac", "ogg", "wav", "m4a", "aac"]);
	if (noReencodeFormats.has(innerFormat)) {
		const mimeMap = {
			mp3: "audio/mpeg",
			flac: "audio/flac",
			ogg: "audio/ogg",
			wav: "audio/wav",
			m4a: "audio/mp4",
			aac: "audio/aac",
		};
		mimeType = mimeMap[innerFormat] || "audio/mpeg";
		return {
			data: `data:${mimeType};base64,${audioBuffer.toString("base64")}`,
			originalName: fileName,
			originalSize: originalBuffer.length,
			mp3Size: audioBuffer.length,
			compression: originalBuffer.length > 0
				? ((1 - audioBuffer.length / originalBuffer.length) * 100).toFixed(1)
				: "0.0",
			note: `${conversionNote} (未重新编码)`,
		};
	}
	// Convert to MP3 via ffmpeg for rare/unplayable formats
	const mp3Buffer = await convertToMp3(audioBuffer, innerFormat, bitRate);
	return {
		data: `data:audio/mpeg;base64,${mp3Buffer.toString("base64")}`,
		originalName: fileName,
		originalSize: originalBuffer.length,
		mp3Size: mp3Buffer.length,
		compression: originalBuffer.length > 0 ? ((1 - mp3Buffer.length / originalBuffer.length) * 100).toFixed(1) : "0.0",
		note: conversionNote,
	};
}

export async function getWorkspaceStatus() {
	const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
		cwd: config.root,
	});
	return { changed: parseGitStatus(stdout) };
}
