// Mizuki 管理后台 - 入口点
// 将请求分发至路由层处理

import { createServer } from "node:http";
import { config } from "./config.mjs";
import { handleApi } from "./routes/index.mjs";
import {
	serveMarkedJs,
	servePublicFile,
	serveStaticAsset,
} from "./routes/static.mjs";
import { json } from "./utils.mjs";

const server = createServer(async (request, response) => {
	try {
		const url = new URL(
			request.url || "/",
			`http://${request.headers.host || "localhost"}`,
		);
		const pathname = url.pathname;

		if (pathname === "/assets/js/marked.min.js")
			return await serveMarkedJs(response);

		if (
			pathname.startsWith("/assets/images/") ||
			pathname.startsWith("/assets/diary/") ||
			pathname.startsWith("/assets/anime/") ||
			pathname.startsWith("/assets/music/")
		)
			return await serveStaticAsset(response, pathname);

		if (pathname.startsWith("/api/"))
			return await handleApi(request, response, pathname);

		if (request.method !== "GET" && request.method !== "HEAD")
			return json(response, 405, { error: "Method not allowed." });

		return await servePublicFile(response, pathname);
	} catch (error) {
		if (response.headersSent || response.writableEnded) {
			response.destroy(error instanceof Error ? error : undefined);
			return;
		}
		const message =
			error instanceof Error ? error.message : "Unexpected server error.";
		json(response, message.includes("ENOENT") ? 404 : 400, { error: message });
	}
});

server.listen(config.port, config.host, () =>
	console.log(`云栖小筑 管理后台运行于 http://${config.host}:${config.port}`),
);
