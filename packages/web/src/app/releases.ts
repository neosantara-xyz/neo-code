import fs from "node:fs";
import path from "node:path";
import type { ChangelogEntry } from "@/components/ui/8bit/blocks/team2";

interface ReleaseNote {
	date: string;
	mode: string;
	notes: string;
	version: string;
}

const RELEASE_NOTES_PATH = path.resolve(process.cwd(), "../../releases/NOTES.md");

function formatReleaseDate(rawDate: string): string {
	const date = new Date(`${rawDate}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return rawDate;
	return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatReleaseTitle(release: ReleaseNote): string {
	const scopeMatch = /^([a-z]+)\(([^)]+)\):\s*(.+)$/i.exec(release.notes);
	if (!scopeMatch) return `v${release.version}`;

	const [, type, scope, summary] = scopeMatch;
	const label = `${type} ${scope}`.toUpperCase();
	return `v${release.version} - ${label}: ${summary}`;
}

function formatReleaseDescription(notes: string): string {
	const cleaned = notes.replace(/^[a-z]+\([^)]+\):\s*/i, "").replace(/^[a-z]+:\s*/i, "");
	return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function loadLatestReleaseEntries(limit = 4): ChangelogEntry[] {
	if (!fs.existsSync(RELEASE_NOTES_PATH)) return [];

	const content = fs.readFileSync(RELEASE_NOTES_PATH, "utf-8");
	const releases: ReleaseNote[] = [];
	const blocks = content.split(/\n(?=## v)/g);

	for (const block of blocks) {
		const header = /^## v([^\s]+)\s+\(([^)]+)\)/m.exec(block);
		if (!header) continue;

		const mode = /^-\s+mode:\s+(.+)$/m.exec(block)?.[1]?.trim() ?? "patch";
		const notes = /^-\s+notes:\s+(.+)$/m.exec(block)?.[1]?.trim();
		if (!notes) continue;

		releases.push({
			version: header[1],
			date: header[2],
			mode,
			notes,
		});
	}

	return releases
		.slice(-limit)
		.reverse()
		.map((release, index) => ({
			date: formatReleaseDate(release.date),
			title: formatReleaseTitle(release),
			description: formatReleaseDescription(release.notes),
			badge: index === 0 ? "LATEST" : release.mode.toUpperCase(),
		}));
}
