import { VERSION } from "../config.js";

export function getNeosantaraUserAgent(version = VERSION): string {
	const runtime = process.versions.bun ? "bun" : "node";
	return `neo-code/${version} (${process.platform}; ${runtime}; ${process.arch})`;
}
