export function validateAlbumId(value) {
	const id = String(value || "").trim();
	if (!id || id.length > 80 || id.includes("..") || /[\\/:*?"<>|]/.test(id))
		throw new Error("Invalid album identifier");
	return id;
}

export function normalizeAlbumInfo(value = {}) {
	return {
		title: String(value.title || ""),
		description: String(value.description || ""),
		date: /^\d{4}-\d{2}-\d{2}$/.test(value.date || "") ? value.date : "",
		location: String(value.location || ""),
		tags: Array.isArray(value.tags)
			? value.tags.map((tag) => String(tag).trim()).filter(Boolean)
			: [],
		layout: value.layout === "masonry" ? "masonry" : "grid",
		columns:
			Number(value.columns) >= 1 && Number(value.columns) <= 6
				? Number(value.columns)
				: 3,
		hidden: value.hidden === true,
	};
}
