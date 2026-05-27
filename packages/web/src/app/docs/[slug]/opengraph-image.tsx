import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { DEFAULT_DESCRIPTION, OG_IMAGE_SIZE, SITE_NAME } from "../../seo";
import { loadDoc, loadDocs } from "../data";

export const contentType = "image/png";
export const size = OG_IMAGE_SIZE;

export function generateStaticParams() {
	return loadDocs().map((doc) => ({ slug: doc.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const doc = loadDoc(slug);
	if (!doc) notFound();

	return (
		<ImageResponse {...size}>
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
				<div style={{ color: "#a1a1aa", fontSize: 28, letterSpacing: 0, textTransform: "uppercase" }}>{SITE_NAME} Docs</div>
				<div>
					<div style={{ fontSize: 70, fontWeight: 800, letterSpacing: 0, lineHeight: 1.08, maxWidth: 920 }}>{doc.entry.title}</div>
					<div style={{ color: "#d4d4d8", fontSize: 30, lineHeight: 1.45, marginTop: 28, maxWidth: 820 }}>
						{doc.entry.description || DEFAULT_DESCRIPTION}
					</div>
				</div>
				<div style={{ color: "#a1a1aa", fontSize: 24 }}>code.neosantara.xyz/docs/{doc.entry.slug}</div>
			</div>
		</ImageResponse>
	);
}
