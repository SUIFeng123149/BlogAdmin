export function parseGitStatus(output) {
	return String(output || "")
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => line.slice(3).trim());
}
