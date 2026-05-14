export type SkillsCommand =
	| { action: "help" }
	| { action: "list" }
	| { action: "install"; source: string; local: boolean }
	| { action: "error"; message: string };

const INSTALL_USAGE = "Usage: /skills install <source> [-l|--local]";

export function parseSkillsCommand(text: string): SkillsCommand {
	const args = text.trim().split(/\s+/).slice(1);
	const action = args[0];

	if (!action || action === "help" || action === "--help" || action === "-h") {
		return { action: "help" };
	}

	if (action === "list" || action === "ls") {
		return { action: "list" };
	}

	if (action === "install" || action === "add") {
		const installArgs = args.slice(1);
		let local = false;
		let source: string | undefined;

		for (const arg of installArgs) {
			if (arg === "-l" || arg === "--local") {
				local = true;
				continue;
			}
			if (arg.startsWith("-")) {
				return { action: "error", message: `Unknown option for /skills install: ${arg}` };
			}
			if (source) {
				return { action: "error", message: INSTALL_USAGE };
			}
			source = arg;
		}

		if (!source) {
			return { action: "error", message: INSTALL_USAGE };
		}

		return { action: "install", source, local };
	}

	return { action: "error", message: `Unknown /skills command: ${action}` };
}
