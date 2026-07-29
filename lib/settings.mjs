export function parseAdvancedJson(value) {
	let parsed;
	try {
		parsed = JSON.parse(String(value || ""));
	} catch {
		throw new Error("Advanced settings must be valid JSON");
	}
	if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
		throw new Error("Advanced settings must be a JSON object");
	return parsed;
}
