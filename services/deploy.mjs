import { config } from "../config.mjs";

export async function triggerDeploy() {
	if (!config.deployHookUrl) return { status: "not-configured" };
	try {
		const response = await fetch(config.deployHookUrl, { method: "POST" });
		return {
			status: response.ok ? "triggered" : "failed",
			code: response.status,
		};
	} catch (error) {
		return {
			status: "failed",
			message:
				error instanceof Error ? error.message : "Unknown deployment error",
		};
	}
}
