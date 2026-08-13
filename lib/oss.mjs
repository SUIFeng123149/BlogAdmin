import { config } from "../config.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let client = null;
let publicBase = "";

function getClient() {
	if (client) return client;
	const { oss } = config;
	if (!oss?.bucket || !oss?.region || !oss?.accessKeyId || !oss?.accessKeySecret) {
		throw new Error("OSS 未配置，请检查 .env.admin 中的 OSS_* 设置。");
	}
	const OSS = require("ali-oss");
	client = new OSS({
		region: oss.region,
		bucket: oss.bucket,
		accessKeyId: oss.accessKeyId,
		accessKeySecret: oss.accessKeySecret,
	});
	publicBase = `https://${oss.bucket}.${oss.region}.aliyuncs.com`;
	return client;
}

/** 上传 Buffer/string 到 OSS，返回公网 URL */
export async function uploadBuffer(key, data, contentType) {
	const c = getClient();
	await c.put(key, data, {
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
	return `${publicBase}/${key}`;
}

/** 上传到文章资源路径 post-assets/{slug}.assets/{filename} */
export async function uploadPostAsset(slug, filename, data, contentType) {
	const key = `post-assets/${slug}.assets/${filename}`;
	return uploadBuffer(key, data, contentType);
}

/** 删除 OSS 对象（不存在时静默成功） */
export async function deleteObject(key) {
	const c = getClient();
	try {
		await c.delete(key);
	} catch (error) {
		// 404 视为已删除
		if (error.code !== "NoSuchKey") throw error;
	}
}
