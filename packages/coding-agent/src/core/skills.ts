import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import ignore from "ignore";
import { homedir } from "os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "path";
import { parse } from "yaml";
import { CONFIG_DIR_NAME, getAgentDir } from "../config.js";
import { parseFrontmatter, stripFrontmatter } from "../utils/frontmatter.js";
import { canonicalizePath } from "../utils/paths.js";
import type { ResourceDiagnostic } from "./diagnostics.js";
import { createSyntheticSourceInfo, type SourceInfo } from "./source-info.js";

/** Max name length per spec */
const MAX_NAME_LENGTH = 64;

/** Max description length per spec */
const MAX_DESCRIPTION_LENGTH = 1024;

const METADATA_DIR_NAME = "agents";
const METADATA_FILE_NAME = "openai.yaml";

const IGNORE_FILE_NAMES = [".gitignore", ".ignore", ".fdignore"];

type IgnoreMatcher = ReturnType<typeof ignore>;

function toPosixPath(p: string): string {
	return p.split(sep).join("/");
}

function prefixIgnorePattern(line: string, prefix: string): string | null {
	const trimmed = line.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith("#") && !trimmed.startsWith("\\#")) return null;

	let pattern = line;
	let negated = false;

	if (pattern.startsWith("!")) {
		negated = true;
		pattern = pattern.slice(1);
	} else if (pattern.startsWith("\\!")) {
		pattern = pattern.slice(1);
	}

	if (pattern.startsWith("/")) {
		pattern = pattern.slice(1);
	}

	const prefixed = prefix ? `${prefix}${pattern}` : pattern;
	return negated ? `!${prefixed}` : prefixed;
}

function addIgnoreRules(ig: IgnoreMatcher, dir: string, rootDir: string): void {
	const relativeDir = relative(rootDir, dir);
	const prefix = relativeDir ? `${toPosixPath(relativeDir)}/` : "";

	for (const filename of IGNORE_FILE_NAMES) {
		const ignorePath = join(dir, filename);
		if (!existsSync(ignorePath)) continue;
		try {
			const content = readFileSync(ignorePath, "utf-8");
			const patterns = content
				.split(/\r?\n/)
				.map((line) => prefixIgnorePattern(line, prefix))
				.filter((line): line is string => Boolean(line));
			if (patterns.length > 0) {
				ig.add(patterns);
			}
		} catch {}
	}
}

export interface SkillFrontmatter {
	name?: string;
	description?: string;
	metadata?: {
		"short-description"?: string;
		[key: string]: unknown;
	};
	"disable-model-invocation"?: boolean;
	[key: string]: unknown;
}

export interface SkillPolicy {
	allowImplicitInvocation?: boolean;
}

export interface SkillInterfaceMetadata {
	displayName?: string;
	shortDescription?: string;
	defaultPrompt?: string;
}

export interface Skill {
	name: string;
	description: string;
	shortDescription?: string;
	interface?: SkillInterfaceMetadata;
	policy?: SkillPolicy;
	filePath: string;
	baseDir: string;
	sourceInfo: SourceInfo;
	disableModelInvocation: boolean;
}

export interface LoadSkillsResult {
	skills: Skill[];
	diagnostics: ResourceDiagnostic[];
}

/**
 * Validate skill name per Agent Skills spec.
 * Returns array of validation error messages (empty if valid).
 */
function validateName(name: string, parentDirName: string): string[] {
	const errors: string[] = [];

	if (name !== parentDirName) {
		errors.push(`name "${name}" does not match parent directory "${parentDirName}"`);
	}

	if (name.length > MAX_NAME_LENGTH) {
		errors.push(`name exceeds ${MAX_NAME_LENGTH} characters (${name.length})`);
	}

	if (!/^[a-z0-9-]+$/.test(name)) {
		errors.push(`name contains invalid characters (must be lowercase a-z, 0-9, hyphens only)`);
	}

	if (name.startsWith("-") || name.endsWith("-")) {
		errors.push(`name must not start or end with a hyphen`);
	}

	if (name.includes("--")) {
		errors.push(`name must not contain consecutive hyphens`);
	}

	return errors;
}

/**
 * Validate description per Agent Skills spec.
 */
function validateDescription(description: string | undefined): string[] {
	const errors: string[] = [];

	if (!description || description.trim() === "") {
		errors.push("description is required");
	} else if (description.length > MAX_DESCRIPTION_LENGTH) {
		errors.push(`description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${description.length})`);
	}

	return errors;
}

function sanitizeSingleLine(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function readStringField(
	value: unknown,
	fieldPath: string,
	maxLength: number,
	metadataPath: string,
	diagnostics: ResourceDiagnostic[],
): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const sanitized = sanitizeSingleLine(value);
	if (!sanitized) {
		return undefined;
	}

	if (sanitized.length > maxLength) {
		diagnostics.push({
			type: "warning",
			message: `${fieldPath} exceeds ${maxLength} characters (${sanitized.length})`,
			path: metadataPath,
		});
		return undefined;
	}

	return sanitized;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function loadSkillAgentsMetadata(
	skillDir: string,
	diagnostics: ResourceDiagnostic[],
): { interface?: SkillInterfaceMetadata; policy?: SkillPolicy } {
	const metadataPath = join(skillDir, METADATA_DIR_NAME, METADATA_FILE_NAME);
	if (!existsSync(metadataPath)) {
		return {};
	}

	try {
		const raw = readFileSync(metadataPath, "utf-8");
		const parsed = asRecord(parse(raw));

		// Parse interface
		let interfaceResult: SkillInterfaceMetadata | undefined;
		const interfaceConfig = asRecord(parsed?.interface);
		if (interfaceConfig) {
			const result: SkillInterfaceMetadata = {};
			const displayName = readStringField(
				interfaceConfig.display_name,
				"interface.display_name",
				MAX_NAME_LENGTH,
				metadataPath,
				diagnostics,
			);
			const shortDescription = readStringField(
				interfaceConfig.short_description,
				"interface.short_description",
				MAX_DESCRIPTION_LENGTH,
				metadataPath,
				diagnostics,
			);
			const defaultPrompt = readStringField(
				interfaceConfig.default_prompt,
				"interface.default_prompt",
				MAX_DESCRIPTION_LENGTH,
				metadataPath,
				diagnostics,
			);

			if (displayName) result.displayName = displayName;
			if (shortDescription) result.shortDescription = shortDescription;
			if (defaultPrompt) result.defaultPrompt = defaultPrompt;

			if (Object.keys(result).length > 0) {
				interfaceResult = result;
			}
		}

		// Parse policy
		let policyResult: SkillPolicy | undefined;
		const policyConfig = asRecord(parsed?.policy);
		if (policyConfig) {
			if (typeof policyConfig.allow_implicit_invocation === "boolean") {
				policyResult = { allowImplicitInvocation: policyConfig.allow_implicit_invocation };
			}
		}

		return { interface: interfaceResult, policy: policyResult };
	} catch (error) {
		const message = error instanceof Error ? error.message : `failed to parse ${METADATA_FILE_NAME}`;
		diagnostics.push({ type: "warning", message, path: metadataPath });
		return {};
	}
}

export interface LoadSkillsFromDirOptions {
	/** Directory to scan for skills */
	dir: string;
	/** Source identifier for these skills */
	source: string;
}

function createSkillSourceInfo(filePath: string, baseDir: string, source: string): SourceInfo {
	switch (source) {
		case "user":
			return createSyntheticSourceInfo(filePath, {
				source: "local",
				scope: "user",
				baseDir,
			});
		case "project":
			return createSyntheticSourceInfo(filePath, {
				source: "local",
				scope: "project",
				baseDir,
			});
		case "path":
			return createSyntheticSourceInfo(filePath, {
				source: "local",
				baseDir,
			});
		default:
			return createSyntheticSourceInfo(filePath, { source, baseDir });
	}
}

/**
 * Load skills from a directory.
 *
 * Discovery rules:
 * - if a directory contains SKILL.md, treat it as a skill root and do not recurse further
 * - otherwise, load direct .md children in the root
 * - recurse into subdirectories to find SKILL.md
 */
export function loadSkillsFromDir(options: LoadSkillsFromDirOptions): LoadSkillsResult {
	const { dir, source } = options;
	return loadSkillsFromDirInternal(dir, source, true);
}

function loadSkillsFromDirInternal(
	dir: string,
	source: string,
	includeRootFiles: boolean,
	ignoreMatcher?: IgnoreMatcher,
	rootDir?: string,
): LoadSkillsResult {
	const skills: Skill[] = [];
	const diagnostics: ResourceDiagnostic[] = [];

	if (!existsSync(dir)) {
		return { skills, diagnostics };
	}

	const root = rootDir ?? dir;
	const ig = ignoreMatcher ?? ignore();
	addIgnoreRules(ig, dir, root);

	try {
		const entries = readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.name !== "SKILL.md") {
				continue;
			}

			const fullPath = join(dir, entry.name);

			let isFile = entry.isFile();
			if (entry.isSymbolicLink()) {
				try {
					isFile = statSync(fullPath).isFile();
				} catch {
					continue;
				}
			}

			const relPath = toPosixPath(relative(root, fullPath));
			if (!isFile || ig.ignores(relPath)) {
				continue;
			}

			const result = loadSkillFromFile(fullPath, source);
			if (result.skill) {
				skills.push(result.skill);
			}
			diagnostics.push(...result.diagnostics);
			return { skills, diagnostics };
		}

		for (const entry of entries) {
			if (entry.name.startsWith(".")) {
				continue;
			}

			// Skip node_modules to avoid scanning dependencies
			if (entry.name === "node_modules") {
				continue;
			}

			const fullPath = join(dir, entry.name);

			// For symlinks, check if they point to a directory and follow them
			let isDirectory = entry.isDirectory();
			let isFile = entry.isFile();
			if (entry.isSymbolicLink()) {
				try {
					const stats = statSync(fullPath);
					isDirectory = stats.isDirectory();
					isFile = stats.isFile();
				} catch {
					// Broken symlink, skip it
					continue;
				}
			}

			const relPath = toPosixPath(relative(root, fullPath));
			const ignorePath = isDirectory ? `${relPath}/` : relPath;
			if (ig.ignores(ignorePath)) {
				continue;
			}

			if (isDirectory) {
				const subResult = loadSkillsFromDirInternal(fullPath, source, false, ig, root);
				skills.push(...subResult.skills);
				diagnostics.push(...subResult.diagnostics);
				continue;
			}

			if (!isFile || !includeRootFiles || !entry.name.endsWith(".md")) {
				continue;
			}

			const result = loadSkillFromFile(fullPath, source);
			if (result.skill) {
				skills.push(result.skill);
			}
			diagnostics.push(...result.diagnostics);
		}
	} catch {}

	return { skills, diagnostics };
}

function loadSkillFromFile(
	filePath: string,
	source: string,
): { skill: Skill | null; diagnostics: ResourceDiagnostic[] } {
	const diagnostics: ResourceDiagnostic[] = [];

	try {
		const rawContent = readFileSync(filePath, "utf-8");
		const { frontmatter } = parseFrontmatter<SkillFrontmatter>(rawContent);
		const skillDir = dirname(filePath);
		const parentDirName = basename(skillDir);
		const agentsMetadata = loadSkillAgentsMetadata(skillDir, diagnostics);

		// Validate description
		const descErrors = validateDescription(frontmatter.description);
		for (const error of descErrors) {
			diagnostics.push({ type: "warning", message: error, path: filePath });
		}

		// Use name from frontmatter, or fall back to parent directory name
		const name = frontmatter.name || parentDirName;

		// Validate name
		const nameErrors = validateName(name, parentDirName);
		for (const error of nameErrors) {
			diagnostics.push({ type: "warning", message: error, path: filePath });
		}

		// Still load the skill even with warnings (unless description is completely missing)
		if (!frontmatter.description || frontmatter.description.trim() === "") {
			return { skill: null, diagnostics };
		}

		return {
			skill: {
				name,
				description: frontmatter.description,
				shortDescription:
					typeof frontmatter.metadata?.["short-description"] === "string"
						? sanitizeSingleLine(frontmatter.metadata["short-description"])
						: undefined,
				interface: agentsMetadata.interface,
				policy: agentsMetadata.policy,
				filePath,
				baseDir: skillDir,
				sourceInfo: createSkillSourceInfo(filePath, skillDir, source),
				disableModelInvocation: frontmatter["disable-model-invocation"] === true,
			},
			diagnostics,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "failed to parse skill file";
		diagnostics.push({ type: "warning", message, path: filePath });
		return { skill: null, diagnostics };
	}
}

function createSkillBlock(skill: Skill): string {
	const content = readFileSync(skill.filePath, "utf-8");
	const body = stripFrontmatter(content).trim();
	const defaultPrompt = skill.interface?.defaultPrompt ? `${skill.interface.defaultPrompt}\n\n` : "";
	return `<skill name="${escapeXml(skill.name)}" location="${escapeXml(skill.filePath)}">\nReferences are relative to ${skill.baseDir}.\n\n${defaultPrompt}${body}\n</skill>`;
}

function parseSlashSkillInvocation(text: string): { skillName: string; args: string } | undefined {
	if (!text.startsWith("/skill:")) return undefined;
	const spaceIndex = text.indexOf(" ");
	const skillName = spaceIndex === -1 ? text.slice(7) : text.slice(7, spaceIndex);
	const args = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1).trim();
	return { skillName, args };
}

function findDollarSkillNames(text: string, skillsByName: Map<string, Skill>): string[] {
	const names: string[] = [];
	const seen = new Set<string>();
	const mentionPattern = /(^|[\s([{])\$([a-z0-9][a-z0-9-]{0,63})(?=$|[\s.,;:!?)}\]])/g;
	let match = mentionPattern.exec(text);
	while (match !== null) {
		const name = match[2];
		if (skillsByName.has(name) && !seen.has(name)) {
			seen.add(name);
			names.push(name);
		}
		match = mentionPattern.exec(text);
	}
	return names;
}

export function expandSkillInvocationText(text: string, skills: Skill[]): string {
	const skillsByName = new Map(skills.map((skill) => [skill.name, skill]));
	const slashInvocation = parseSlashSkillInvocation(text);
	if (slashInvocation) {
		const skill = skillsByName.get(slashInvocation.skillName);
		if (!skill) return text;
		const skillBlock = createSkillBlock(skill);
		return slashInvocation.args ? `${skillBlock}\n\n${slashInvocation.args}` : skillBlock;
	}

	const mentionedSkillNames = findDollarSkillNames(text, skillsByName);
	if (mentionedSkillNames.length === 0) {
		return text;
	}

	const skillBlocks = mentionedSkillNames.map((name) => createSkillBlock(skillsByName.get(name)!));
	return `${skillBlocks.join("\n\n")}\n\n${text}`;
}

export function getSkillDisplayName(skill: Skill): string {
	return skill.interface?.displayName ?? skill.name;
}

export function getSkillDescription(skill: Skill): string {
	return skill.interface?.shortDescription ?? skill.shortDescription ?? skill.description;
}

/** Default character budget for skill metadata in system prompt. */
const DEFAULT_SKILL_METADATA_BUDGET = 8000;

/** Approximate token count (chars / 4). */
function approxTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/** Scope priority: project skills first, then user, then path. */
function skillScopePriority(skill: Skill): number {
	const scope = skill.sourceInfo.scope;
	if (scope === "project") return 0;
	if (scope === "user") return 1;
	return 2;
}

/**
 * Format skills for inclusion in a system prompt.
 * Applies token budget, priority ordering, and progressive disclosure instructions.
 *
 * Skills with disableModelInvocation=true or policy.allowImplicitInvocation=false
 * are excluded (they can only be invoked explicitly via /skill:name or $skill-name).
 */
export function formatSkillsForPrompt(skills: Skill[], contextWindowTokens?: number): string {
	const visibleSkills = skills.filter((s) => !s.disableModelInvocation && s.policy?.allowImplicitInvocation !== false);

	if (visibleSkills.length === 0) {
		return "";
	}

	// Sort by scope priority then name
	const sorted = [...visibleSkills].sort(
		(a, b) => skillScopePriority(a) - skillScopePriority(b) || a.name.localeCompare(b.name),
	);

	// Budget: 2% of context window tokens, or default char budget
	const budget =
		contextWindowTokens && contextWindowTokens > 0
			? { type: "tokens" as const, limit: Math.max(1, Math.floor(contextWindowTokens * 0.02)) }
			: { type: "chars" as const, limit: DEFAULT_SKILL_METADATA_BUDGET };

	const cost = (text: string) => (budget.type === "tokens" ? approxTokens(text) : text.length);

	// Render skill lines within budget
	const skillLines: string[] = [];
	let used = 0;
	for (const skill of sorted) {
		const line = `- ${escapeXml(skill.name)}: ${escapeXml(skill.description)} (file: ${escapeXml(skill.filePath)})`;
		const lineCost = cost(`${line}\n`);
		if (used + lineCost <= budget.limit) {
			skillLines.push(line);
			used += lineCost;
		}
	}

	if (skillLines.length === 0) {
		return "";
	}

	const lines = [
		"\n\n## Skills",
		"A skill is a set of local instructions stored in a SKILL.md file. Each entry below includes a name, description, and file path.",
		"",
		"### Available skills",
		...skillLines,
		"",
		"### How to use skills",
		"- If the user names a skill (with $SkillName or /skill:name) OR the task clearly matches a skill's description, use that skill.",
		"- To use a skill: open its SKILL.md with the read tool. Read only enough to follow the workflow.",
		"- When SKILL.md references relative paths, resolve them relative to the skill directory (parent of SKILL.md).",
		"- If SKILL.md points to references/, load only the specific files needed, not everything.",
		"- If scripts/ exist, prefer running them over rewriting the same code.",
		"- If a skill cannot be applied (missing files, unclear instructions), state the issue and continue with the best fallback.",
		"- Keep context small: summarize long sections instead of pasting them.",
	];

	if (sorted.length > skillLines.length) {
		lines.push(`\n(${sorted.length - skillLines.length} additional skill(s) omitted due to context budget)`);
	}

	return lines.join("\n");
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export interface LoadSkillsOptions {
	/** Working directory for project-local skills. */
	cwd: string;
	/** Agent config directory for global skills. */
	agentDir: string;
	/** Explicit skill paths (files or directories) */
	skillPaths: string[];
	/** Include default skills directories. */
	includeDefaults: boolean;
}

function normalizePath(input: string): string {
	const trimmed = input.trim();
	if (trimmed === "~") return homedir();
	if (trimmed.startsWith("~/")) return join(homedir(), trimmed.slice(2));
	if (trimmed.startsWith("~")) return join(homedir(), trimmed.slice(1));
	return trimmed;
}

function resolveSkillPath(p: string, cwd: string): string {
	const normalized = normalizePath(p);
	return isAbsolute(normalized) ? normalized : resolve(cwd, normalized);
}

/**
 * Load skills from all configured locations.
 * Returns skills and any validation diagnostics.
 */
export function loadSkills(options: LoadSkillsOptions): LoadSkillsResult {
	const { cwd, agentDir, skillPaths, includeDefaults } = options;

	// Resolve agentDir - if not provided, use default from config
	const resolvedAgentDir = agentDir ?? getAgentDir();

	const skillMap = new Map<string, Skill>();
	const realPathSet = new Set<string>();
	const allDiagnostics: ResourceDiagnostic[] = [];
	const collisionDiagnostics: ResourceDiagnostic[] = [];

	function addSkills(result: LoadSkillsResult) {
		allDiagnostics.push(...result.diagnostics);
		for (const skill of result.skills) {
			// Resolve symlinks to detect duplicate files
			const realPath = canonicalizePath(skill.filePath);

			// Skip silently if we've already loaded this exact file (via symlink)
			if (realPathSet.has(realPath)) {
				continue;
			}

			const existing = skillMap.get(skill.name);
			if (existing) {
				collisionDiagnostics.push({
					type: "collision",
					message: `name "${skill.name}" collision`,
					path: skill.filePath,
					collision: {
						resourceType: "skill",
						name: skill.name,
						winnerPath: existing.filePath,
						loserPath: skill.filePath,
					},
				});
			} else {
				skillMap.set(skill.name, skill);
				realPathSet.add(realPath);
			}
		}
	}

	if (includeDefaults) {
		addSkills(loadSkillsFromDirInternal(join(resolvedAgentDir, "skills"), "user", true));
		addSkills(loadSkillsFromDirInternal(resolve(cwd, CONFIG_DIR_NAME, "skills"), "project", true));
	}

	const userSkillsDir = join(resolvedAgentDir, "skills");
	const projectSkillsDir = resolve(cwd, CONFIG_DIR_NAME, "skills");

	const isUnderPath = (target: string, root: string): boolean => {
		const normalizedRoot = resolve(root);
		if (target === normalizedRoot) {
			return true;
		}
		const prefix = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`;
		return target.startsWith(prefix);
	};

	const getSource = (resolvedPath: string): "user" | "project" | "path" => {
		if (!includeDefaults) {
			if (isUnderPath(resolvedPath, userSkillsDir)) return "user";
			if (isUnderPath(resolvedPath, projectSkillsDir)) return "project";
		}
		return "path";
	};

	for (const rawPath of skillPaths) {
		const resolvedPath = resolveSkillPath(rawPath, cwd);
		if (!existsSync(resolvedPath)) {
			allDiagnostics.push({ type: "warning", message: "skill path does not exist", path: resolvedPath });
			continue;
		}

		try {
			const stats = statSync(resolvedPath);
			const source = getSource(resolvedPath);
			if (stats.isDirectory()) {
				addSkills(loadSkillsFromDirInternal(resolvedPath, source, true));
			} else if (stats.isFile() && resolvedPath.endsWith(".md")) {
				const result = loadSkillFromFile(resolvedPath, source);
				if (result.skill) {
					addSkills({ skills: [result.skill], diagnostics: result.diagnostics });
				} else {
					allDiagnostics.push(...result.diagnostics);
				}
			} else {
				allDiagnostics.push({ type: "warning", message: "skill path is not a markdown file", path: resolvedPath });
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "failed to read skill path";
			allDiagnostics.push({ type: "warning", message, path: resolvedPath });
		}
	}

	return {
		skills: Array.from(skillMap.values()),
		diagnostics: [...allDiagnostics, ...collisionDiagnostics],
	};
}
