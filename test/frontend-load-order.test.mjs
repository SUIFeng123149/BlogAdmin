// 前端脚本加载顺序回归测试
// 用 vm 在共享全局作用域下按 index.html 顺序执行每个 /js/*.js 模块，
// 复现浏览器逐 <script> 加载行为。任何模块在顶层抛错（ReferenceError /
// TypeError / TDZ）都会中断后续加载 —— 此处断言全程无错误。
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = resolve(fileURLToPath(new URL("..", import.meta.url)), "public");

// 最小 DOM stub（只提供模块顶层执行需要的成员）
function stubNode() {
	const handler = {
		get(_target, prop) {
			if (prop === "classList")
				return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
			if (prop === "style" || prop === "dataset") return {};
			if (prop === "elements") return new Proxy({}, { get: () => stubNode(), set: () => true });
			if (prop === "children") return [];
			if (prop === "parentElement") return stubNode();
			if (typeof prop === "symbol") return undefined;
			const methods = new Set([
				"closest", "querySelectorAll", "querySelector", "addEventListener",
				"append", "remove", "reset", "focus", "click", "setAttribute",
				"getAttribute", "removeAttribute", "prepend", "replaceWith",
				"removeChild", "appendChild", "insertBefore", "contains", "toggle",
				"add", "before", "after", "insertAdjacentHTML", "getBoundingClientRect",
			]);
			if (methods.has(prop))
				return () =>
					prop === "closest"
						? stubNode()
						: prop === "querySelectorAll"
							? []
							: prop === "querySelector"
								? stubNode()
								: undefined;
			return undefined;
		},
		set() { return true; },
	};
	return new Proxy(function () {}, handler);
}

function buildSandbox() {
	const sandbox = {};
	const context = createContext(sandbox);
	sandbox.window = sandbox;
	sandbox.document = {
		querySelector: () => stubNode(),
		querySelectorAll: () => [],
		getElementById: () => stubNode(),
		createElement: () => stubNode(),
		createTextNode: () => stubNode(),
		addEventListener: () => {},
		body: stubNode(),
	};
	sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
	sandbox.location = { reload() {}, href: "" };
	sandbox.fetch = async () => ({ ok: true, json: async () => ({}), status: 200 });
	sandbox.FormData = class { get() { return ""; } };
	sandbox.FileReader = class { readAsDataURL() {} };
	sandbox.URL = { createObjectURL: () => "", revokeObjectURL: () => {} };
	sandbox.navigator = {};
	sandbox.confirm = () => false;
	sandbox.alert = () => {};
	sandbox.console = console;
	// 定时器 stub 为 no-op：验证目标是顶层执行无错，而非真实轮询行为。
	// 真实 setInterval 会保持事件循环活跃导致测试挂起。
	sandbox.setTimeout = () => 0;
	sandbox.clearTimeout = () => {};
	sandbox.setInterval = () => 0;
	sandbox.clearInterval = () => {};
	sandbox.Promise = Promise;
	return { context };
}

test("every js module executes in page order without top-level errors", async () => {
	const html = await readFile(join(publicDir, "index.html"), "utf8");
	const srcs = [...html.matchAll(/<script src="(\/js\/[^"]+)"/g)].map((m) => m[1]);
	assert.ok(srcs.length >= 20, `JS 模块引用过少: ${srcs.length}`);

	const { context } = buildSandbox();
	const errors = [];
	for (const src of srcs) {
		const code = await readFile(join(publicDir, src.replace(/^\//, "")), "utf8");
		try {
			runInContext(code, context, { filename: src });
		} catch (error) {
			errors.push(
				`${src}: ${error instanceof Error ? error.name + ": " + error.message : String(error)}`,
			);
		}
	}
	assert.deepEqual(errors, [], "以下模块顶层执行抛错（会中断后续加载）");
});

test("core data variables are initialized after all modules load", async () => {
	const html = await readFile(join(publicDir, "index.html"), "utf8");
	const srcs = [...html.matchAll(/<script src="(\/js\/[^"]+)"/g)].map((m) => m[1]);
	const { context } = buildSandbox();
	for (const src of srcs) {
		const code = await readFile(join(publicDir, src.replace(/^\//, "")), "utf8");
		runInContext(code, context, { filename: src });
	}
	for (const name of ["activeCollection", "currentSlug", "categoryOptions", "postForm"]) {
		assert.notEqual(
			runInContext(`typeof ${name}`, context),
			"undefined",
			`全局变量 ${name} 未初始化（可能是 TDZ 中断导致）`,
		);
	}
});
