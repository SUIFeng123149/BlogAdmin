import { config } from "./config.mjs";

const sessions = new Map();

function parseCookies(request) {
	return Object.fromEntries(
		(request.headers.cookie || "")
			.split(";")
			.map((part) => {
				const index = part.indexOf("=");
				return index < 0
					? []
					: [
							part.slice(0, index).trim(),
							decodeURIComponent(part.slice(index + 1).trim()),
						];
			})
			.filter((entry) => entry.length),
	);
}

function isAuthenticated(request) {
	const token = parseCookies(request).mizuki_admin;
	const session = token && sessions.get(token);
	if (!session || session.expires < Date.now()) return false;
	session.expires = Date.now() + 8 * 60 * 60 * 1000;
	return true;
}

async function readBody(request) {
	let data = "";
	for await (const chunk of request) {
		data += chunk;
		if (Buffer.byteLength(data) > config.maxBodySize)
			throw new Error("请求体过大。");
	}
	try {
		return data ? JSON.parse(data) : {};
	} catch {
		throw new Error("无效的 JSON 请求体。");
	}
}

export { sessions, parseCookies, isAuthenticated, readBody };
