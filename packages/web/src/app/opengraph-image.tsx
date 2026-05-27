import { ImageResponse } from "next/og";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE_SIZE, SITE_NAME } from "./seo";

export const alt = DEFAULT_TITLE;
export const contentType = "image/png";
export const size = OG_IMAGE_SIZE;
export const dynamic = "force-static";

const MASCOT_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="104" viewBox="0 0 256 208"><rect width="256" height="208" fill="none"/><g shape-rendering="crispEdges"><rect x="32" y="16" width="48" height="64" fill="#d97824"/><rect x="48" y="32" width="32" height="48" fill="#f2dfbc"/><rect x="176" y="16" width="48" height="64" fill="#d97824"/><rect x="176" y="32" width="32" height="48" fill="#f2dfbc"/><rect x="64" y="64" width="128" height="80" fill="#d97824"/><rect x="48" y="80" width="160" height="48" fill="#d97824"/><rect x="64" y="128" width="128" height="32" fill="#d97824"/><rect x="80" y="128" width="96" height="48" fill="#f2dfbc"/><rect x="64" y="144" width="128" height="32" fill="#f2dfbc"/><rect x="96" y="80" width="16" height="16" fill="#f2dfbc"/><rect x="112" y="96" width="16" height="16" fill="#f2dfbc"/><rect x="96" y="112" width="16" height="16" fill="#f2dfbc"/><rect x="128" y="112" width="32" height="16" fill="#f2dfbc"/><rect x="80" y="128" width="16" height="32" fill="#050505"/><rect x="160" y="128" width="16" height="32" fill="#050505"/><rect x="112" y="160" width="32" height="16" fill="#050505"/></g></svg>')}`;

export default function Image() {
	return new ImageResponse(
		(
			<div
				style={{
					background: "#09090b",
					color: "#fafafa",
					display: "flex",
					flexDirection: "column",
					fontFamily: "monospace",
					height: "100%",
					justifyContent: "space-between",
					padding: 64,
					width: "100%",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 16 }}>
					<img src={MASCOT_SVG} width={48} height={40} />
					<div style={{ color: "#a1a1aa", fontSize: 28, letterSpacing: 0, textTransform: "uppercase" }}>{SITE_NAME}</div>
				</div>
				<div style={{ display: "flex", flexDirection: "column" }}>
					<div style={{ fontSize: 72, fontWeight: 800, letterSpacing: 0, lineHeight: 1.08, maxWidth: 880 }}>{DEFAULT_TITLE}</div>
					<div style={{ color: "#d4d4d8", fontSize: 30, lineHeight: 1.45, marginTop: 28, maxWidth: 760 }}>{DEFAULT_DESCRIPTION}</div>
				</div>
				<div style={{ color: "#a1a1aa", fontSize: 24 }}>code.neosantara.xyz</div>
			</div>
		),
		size,
	);
}
