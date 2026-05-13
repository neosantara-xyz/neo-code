// Static Neosantara image model registry. No built-in image models are registered.

import type { ImagesApi, ImagesModel } from "./types.js";

export const IMAGE_MODELS = {
	neosantara: {},
} as const satisfies Record<string, Record<string, ImagesModel<ImagesApi>>>;
