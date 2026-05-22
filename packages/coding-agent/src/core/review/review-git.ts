import { spawnSync } from "node:child_process";

/**
 * Lightweight git helpers used by `/review` to populate the picker with
 * branches and commits, and to resolve merge bases up front so the prompt
 * does not have to compute it later.
 *
 * Failures are intentionally swallowed and surfaced as `null` / empty
 * lists. The picker falls back to a generic prompt and the LLM can
 * still drive `git` from the bash tool.
 */

interface GitResult {
	ok: boolean;
	stdout: string;
	stderr: string;
}

function runGit(cwd: string, args: string[]): GitResult {
	try {
		const result = spawnSync("git", ["--no-optional-locks", ...args], {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return {
			ok: result.status === 0,
			stdout: result.stdout.trim(),
			stderr: result.stderr.trim(),
		};
	} catch {
		return { ok: false, stdout: "", stderr: "spawn failed" };
	}
}

export function isGitRepository(cwd: string): boolean {
	return runGit(cwd, ["rev-parse", "--show-toplevel"]).ok;
}

export function getCurrentBranch(cwd: string): string | null {
	const result = runGit(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
	if (!result.ok) return null;
	return result.stdout || null;
}

export interface BranchInfo {
	name: string;
	isCurrent: boolean;
}

/**
 * Lists local branches, current branch first. Returns an empty array when
 * the cwd is not a git repository.
 */
export function listLocalBranches(cwd: string): BranchInfo[] {
	if (!isGitRepository(cwd)) return [];
	const current = getCurrentBranch(cwd);
	const result = runGit(cwd, ["for-each-ref", "--sort=-committerdate", "--format=%(refname:short)", "refs/heads"]);
	if (!result.ok) return [];
	const names = result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	const out: BranchInfo[] = [];
	for (const name of names) {
		out.push({ name, isCurrent: current === name });
	}
	out.sort((a, b) => (a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1));
	return out;
}

export interface CommitInfo {
	sha: string;
	subject: string;
	relativeDate: string;
}

/**
 * Lists recent commits on the current branch, newest first.
 */
export function listRecentCommits(cwd: string, limit = 50): CommitInfo[] {
	if (!isGitRepository(cwd)) return [];
	const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
	const sep = "\u001f";
	const result = runGit(cwd, ["log", `--max-count=${safeLimit}`, `--pretty=format:%H${sep}%s${sep}%cr`]);
	if (!result.ok) return [];
	const out: CommitInfo[] = [];
	for (const line of result.stdout.split(/\r?\n/)) {
		if (!line) continue;
		const parts = line.split(sep);
		if (parts.length < 3) continue;
		const [sha, subject, relativeDate] = parts;
		if (!sha || !subject) continue;
		out.push({ sha, subject, relativeDate: relativeDate ?? "" });
	}
	return out;
}

/**
 * Resolve the merge base between HEAD and a base branch. Tries upstream
 * tracking first (`base@{upstream}`) so the comparison matches what would
 * actually be merged, then falls back to the local ref.
 */
export function resolveMergeBase(cwd: string, baseBranch: string): string | null {
	if (!isGitRepository(cwd)) return null;
	const upstream = runGit(cwd, ["merge-base", "HEAD", `${baseBranch}@{upstream}`]);
	if (upstream.ok && upstream.stdout) return upstream.stdout;
	const local = runGit(cwd, ["merge-base", "HEAD", baseBranch]);
	if (local.ok && local.stdout) return local.stdout;
	return null;
}

/**
 * Fetch the subject line for a commit. Returns null when the SHA cannot be
 * resolved, e.g. typo or commit not yet fetched.
 */
export function getCommitSubject(cwd: string, sha: string): string | null {
	if (!isGitRepository(cwd) || !sha) return null;
	const result = runGit(cwd, ["log", "--max-count=1", "--pretty=format:%s", sha]);
	if (!result.ok) return null;
	return result.stdout || null;
}
