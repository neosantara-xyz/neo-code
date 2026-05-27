import { ImageResponse } from "next/og";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE_SIZE, SITE_NAME } from "./seo";

export const alt = DEFAULT_TITLE;
export const contentType = "image/png";
export const size = OG_IMAGE_SIZE;
export const dynamic = "force-static";

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
				<div style={{ color: "#a1a1aa", fontSize: 28, letterSpacing: 0, textTransform: "uppercase" }}>{SITE_NAME}</div>
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
