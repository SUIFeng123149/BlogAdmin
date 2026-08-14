// PDF 课件 → Markdown 转换服务
// 复用 admin/lib/pdf2md.py（Python + pdfplumber），通过子进程执行转换。
// 依赖：本机需安装 python3 与 pdfplumber（pip install pdfplumber）。

import { config } from "../config.mjs";
import { decodeImageDataUrl } from "../lib/storage.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { unlink, writeFile, readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

// 尝试可用的 Python 解释器（按优先级）
const PYTHON_CANDIDATES = ["python3", "python"];

async function findPython() {
	for (const candidate of PYTHON_CANDIDATES) {
		try {
			const { stdout } = await execFileAsync(candidate, [
				"-c",
				"import pdfplumber",
			]);
			if (!String(stdout).includes("Error")) return candidate;
		} catch {
			// 尝试下一个候选
		}
	}
	throw new Error("PDF 转换需要 Python 环境，请先安装 python3 与 pdfplumber（pip install pdfplumber）。");
}

/**
 * 将 PDF 课件转换为 Markdown。
 * body: { name: 文件名, data: base64 Data URL }
 * 返回 { markdown, title }
 */
export async function pdfToMarkdown(body) {
	const { mime, bytes } = decodeImageDataUrl(body.data, ["application/pdf"]);
	if (!/\.pdf$/i.test(String(body.name || "")))
		throw new Error("请上传 .pdf 格式的文件。");
	if (bytes.length > 50 * 1024 * 1024)
		throw new Error("PDF 过大，请上传小于 50 MB 的文件。");

	const python = await findPython();
	const scriptPath = join(config.root, "admin", "lib", "pdf2md.py");
	const id = randomUUID();
	const inputPath = join(tmpdir(), `mizuki-pdf-${id}.pdf`);
	const outputPath = join(tmpdir(), `mizuki-pdf-${id}.md`);

	try {
		await writeFile(inputPath, bytes);
		// stderr 中可能出现 pdfminer 的非致命警告（如字体描述缺失时的
		// "Could not get FontBBox ..."），不代表转换失败。
		// 成功与否以退出码 + 输出文件内容为准：execFile 在非 0 退出时
		// 会 reject（error.message 含 stderr 便于排查），此处无需再判 stderr。
		await execFileAsync(python, [scriptPath, inputPath, outputPath], {
			timeout: 120_000,
			maxBuffer: 20 * 1024 * 1024,
		});
		const markdown = await readFile(outputPath, "utf8");
		if (!markdown.trim())
			throw new Error("PDF 中未识别到可转换的文本内容。");
		return {
			markdown,
			title: basename(String(body.name || ""), ".pdf").trim(),
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// 若输出文件已生成（转换成功但随后读取出错等），尽力返回已转换内容
		throw new Error(
			message.includes("pdfplumber") || message.includes("Python")
				? message
				: `PDF 转换失败：${message}`,
		);
	} finally {
		await unlink(inputPath).catch(() => {});
		await unlink(outputPath).catch(() => {});
	}
}
