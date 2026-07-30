// Audio conversion utilities for admin
// - NCM (NetEase Cloud Music) decryption
// - General audio format conversion via ffmpeg

import crypto from "node:crypto";
import { execFile } from "node:child_process";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

// Verified keys from ncm-decrypt package (working implementation)
const ncmCoreKey = Buffer.from("687a4852416d736f356b496e62617857", "hex");

/**
 * Decrypt an NCM file buffer, returning the inner audio stream.
 * Algorithm verified against the ncm-decrypt package.
 */
export function decryptNCM(buffer) {
	if (buffer.length < 16) throw new Error("无效的 NCM 文件（文件过小）。");
	// Check magic: "CTENFDAM"
	if (
		buffer[0] !== 0x43 || buffer[1] !== 0x54 || buffer[2] !== 0x45 ||
		buffer[3] !== 0x4e || buffer[4] !== 0x46 || buffer[5] !== 0x44 ||
		buffer[6] !== 0x41 || buffer[7] !== 0x4d
	)
		throw new Error("无效的 NCM 文件（魔数错误）。");

	const dv = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	let offset = 10; // skip 8-byte magic + 2-byte gap

	// --- Read and decrypt key ---
	const keyLen = dv.getUint32(offset, true);
	offset += 4;
	const cipherText = buffer.slice(offset, offset + keyLen);
	offset += keyLen;

	// XOR with 0x64
	for (let i = 0; i < cipherText.length; i++) cipherText[i] ^= 0x64;

	// AES-128-ECB decrypt with auto-padding
	const decipher = crypto.createDecipheriv("aes-128-ecb", ncmCoreKey, null);
	let decryptedFull = decipher.update(cipherText);
	try {
		decryptedFull = Buffer.concat([decryptedFull, decipher.final()]);
	} catch {
		// final() may fail on edge cases; update() data is sufficient
	}

	// Skip first 17 bytes of decrypted key (verified algorithm)
	const decryptedKey = decryptedFull.subarray(17);
	if (decryptedKey.length === 0) throw new Error("NCM 密钥数据过短");

	// --- Build key box (RC4-style) ---
	const box = new Uint8Array(256);
	for (let i = 0; i < 256; i++) box[i] = i;
	let j = 0;
	for (let i = 0; i < 256; i++) {
		j = (box[i] + j + decryptedKey[i % decryptedKey.length]) & 0xff;
		const tmp = box[i];
		box[i] = box[j];
		box[j] = tmp;
	}

	// --- Pre-compute 256-byte key stream ---
	const keyStream = new Uint8Array(256);
	for (let i = 0; i < 256; i++) {
		const i2 = (i + 1) & 0xff;
		const si = box[i2];
		const sj = box[(i2 + si) & 0xff];
		keyStream[i] = box[(si + sj) & 0xff];
	}

	// --- Skip metadata ---
	const metaDataLen = dv.getUint32(offset, true);
	offset += 4;
	if (metaDataLen > 0) {
		offset += metaDataLen;
	} else {
		offset += 1;
	}

	// --- Skip to audio data ---
	// offset += uint32_at(offset + 5) + 13
	const audioSkip = dv.getUint32(offset + 5, true);
	offset += audioSkip + 13;

	// --- Decrypt audio ---
	if (offset >= buffer.length)
		throw new Error("NCM 文件损坏（未找到音频数据）。");

	const audioLen = buffer.length - offset;
	const result = Buffer.alloc(audioLen);
	for (let cur = 0; cur < audioLen; cur++) {
		result[cur] = buffer[offset + cur] ^ keyStream[cur & 0xff];
	}

	return result;
}

/**
 * Convert audio data to MP3 using ffmpeg.
 */
export async function convertToMp3(inputBuffer, inputFormat, bitRate = 192) {
	const ffmpegPath = ffmpeg.path;
	return new Promise((resolve, reject) => {
		const child = execFile(
			ffmpegPath,
			[
				"-y",
				"-f", inputFormat,
				"-i", "pipe:0",
				"-c:a", "libmp3lame",
				"-b:a", `${bitRate}k`,
				"-f", "mp3",
				"pipe:1",
			],
			{ maxBuffer: 200 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (error) {
					const msg = stderr?.toString() || error.message;
					const lines = msg.split(/\r?\n/).filter(l =>
						l.includes("Error") || l.includes("error") ||
						l.includes("Invalid") || l.includes("failed") ||
						l.includes("Failed") || l.includes("missing") ||
						l.includes("Missing")
					);
					const shortMsg = lines.length > 0
						? lines.join("; ").slice(0, 200)
						: msg.split(/\r?\n/).slice(-3).join("; ").slice(0, 200);
					reject(new Error(`转换失败: ${shortMsg}`));
					return;
				}
				resolve(Buffer.from(stdout));
			},
		);
		child.stdin.write(inputBuffer);
		child.stdin.end();
	});
}

/**
 * Detect the inner audio format by checking header magic.
 */
export function detectAudioFormat(buffer) {
	if (buffer.length < 4) return "mp3";
	if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return "mp3";
	if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "mp3";
	if (buffer.slice(0, 4).toString("ascii") === "fLaC") return "flac";
	if (buffer.slice(0, 4).toString("ascii") === "OggS") return "ogg";
	if (buffer.slice(0, 4).toString("ascii") === "RIFF") return "wav";
	return "mp3";
}

/**
 * Format a file size into a human-readable string.
 */
export function formatSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1048576).toFixed(2)} MB`;
}
