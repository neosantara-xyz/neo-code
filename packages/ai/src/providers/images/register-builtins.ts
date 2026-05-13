import { clearImagesApiProviders } from "../../images-api-registry.js";

export function registerBuiltInImagesApiProviders(): void {
	// No built-in image provider is registered in the OpenAI-SDK-only Neosantara build.
}

export function resetImagesApiProviders(): void {
	clearImagesApiProviders();
	registerBuiltInImagesApiProviders();
}

registerBuiltInImagesApiProviders();
