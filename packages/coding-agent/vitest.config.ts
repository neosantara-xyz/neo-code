import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const aiSrcIndex = fileURLToPath(new URL("../ai/src/index.ts", import.meta.url));
const aiSrcOAuth = fileURLToPath(new URL("../ai/src/oauth.ts", import.meta.url));
const agentSrcIndex = fileURLToPath(new URL("../agent/src/index.ts", import.meta.url));
const tuiSrcIndex = fileURLToPath(new URL("../tui/src/index.ts", import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		testTimeout: 30000,
		server: {
			deps: {
				external: [/@silvia-odwyer\/photon-node/],
			},
		},
	},
	resolve: {
		alias: [
			{
				find: "@neosantara-xyz/ai/oauth",
				replacement: aiSrcOAuth,
			},
			{
				find: "@neosantara-xyz/ai",
				replacement: aiSrcIndex,
			},
			{
				find: "@neosantara-xyz/agent-core",
				replacement: agentSrcIndex,
			},
			{
				find: "@neosantara-xyz/tui",
				replacement: tuiSrcIndex,
			},
		],
	},
});
