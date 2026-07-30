import { config } from "../config.mjs";
import { quoteYaml } from "../utils.mjs";
import { readFile, writeFile } from "node:fs/promises";

function settingValue(source, expression, fallback) {
	return source.match(expression)?.[1] ?? fallback;
}

export async function readSettings() {
	const source = await readFile(config.configPath, "utf8");
	return {
		title: settingValue(source, /title:\s*"([^"]*)"/, ""),
		subtitle: settingValue(source, /subtitle:\s*"([^"]*)"/, ""),
		profileName: settingValue(source, /export const profileConfig[\s\S]*?name:\s*"([^"]*)"/, ""),
		profileBio: settingValue(source, /export const profileConfig[\s\S]*?bio:\s*"([^"]*)"/, ""),
		themeHue: Number(settingValue(source, /hue:\s*(\d+)/, "35")),
		bannerEnabled:
			settingValue(
				source,
				/banner:\s*\{[\s\S]*?enable:\s*(true|false)/,
				"true",
			) === "true",
		commentsEnabled:
			settingValue(
				source,
				/export const commentConfig[\s\S]*?enable:\s*(true|false)/,
				"false",
			) === "true",
		musicEnabled:
			settingValue(
				source,
				/export const musicPlayerConfig[\s\S]*?enable:\s*(true|false)/,
				"false",
			) === "true",
		ogImagesEnabled:
			settingValue(source, /generateOgImages:\s*(true|false)/, "false") ===
			"true",
		announcementEnabled:
			settingValue(
				 source,
				/export const announcementConfig[\s\S]*?enable:\s*(true|false)/,
				"false",
			) === "true",
		announcementContent: settingValue(
			source,
			/export const announcementConfig[\s\S]*?content:\s*"([^"]*)"/,
			"",
		),
	};
}

export async function writeSettings(data) {
	let source = await readFile(config.configPath, "utf8");
	const replace = (pattern, value) => {
		source = source.replace(pattern, value);
	};
	replace(/title:\s*"[^"]*"/, `title: ${quoteYaml(data.title)}`);
	replace(/subtitle:\s*"[^"]*"/, `subtitle: ${quoteYaml(data.subtitle)}`);
	replace(/(export const profileConfig[\s\S]*?name:\s*)"[^"]*"/, `$1${quoteYaml(data.profileName)}`);
	replace(/(export const profileConfig[\s\S]*?bio:\s*)"[^"]*"/, `$1${quoteYaml(data.profileBio)}`);
	replace(
		/hue:\s*\d+/,
		`hue: ${Math.max(0, Math.min(360, Number(data.themeHue) || 0))}`,
	);
	replace(
		/(banner:\s*\{[\s\S]*?enable:\s*)(true|false)/,
		`$1${Boolean(data.bannerEnabled)}`,
	);
	replace(
		/(export const commentConfig[\s\S]*?enable:\s*)(true|false)/,
		`$1${Boolean(data.commentsEnabled)}`,
	);
	replace(
		/(export const musicPlayerConfig[\s\S]*?enable:\s*)(true|false)/,
		`$1${Boolean(data.musicEnabled)}`,
	);
	replace(
		/generateOgImages:\s*(true|false)/,
		`generateOgImages: ${Boolean(data.ogImagesEnabled)}`,
	);
	replace(
		/(export const announcementConfig[\s\S]*?enable:\s*)(true|false)/,
		`$1${Boolean(data.announcementEnabled)}`,
	);
	replace(
		/(export const announcementConfig[\s\S]*?content:\s*)"[^"]*"/,
		`$1${quoteYaml(data.announcementContent)}`,
	);
	await writeFile(`${config.configPath}.backup`, await readFile(config.configPath));
	await writeFile(config.configPath, source, "utf8");
}
