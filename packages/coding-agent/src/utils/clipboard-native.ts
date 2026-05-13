export type ClipboardModule = {
	setText: (text: string) => Promise<void>;
	hasImage: () => boolean;
	getImageBinary: () => Promise<Array<number>>;
};

// Native clipboard addon is intentionally disabled in the Neosantara build.
// Clipboard support still falls back to platform tools where available.
const clipboard: ClipboardModule | null = null;

export { clipboard };
