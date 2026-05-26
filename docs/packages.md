# Packages

Neo Code packages bundle extensions, skills, prompt templates, and themes so you
can share them through npm or git. A package can declare resources in
`package.json` under the `neo-code` key, or use conventional directories.

## Install and Manage

> **Security:** Packages run with full system access. Extensions execute
> arbitrary code, and skills can instruct the model to perform any action
> including running executables. Review source code before installing
> third-party packages.

```bash
neo install npm:@foo/bar@1.0.0
neo install git:github.com/user/repo@v1
neo install https://github.com/user/repo
neo install /absolute/path/to/package
neo install ./relative/path/to/package

neo remove npm:@foo/bar
neo list                     # show installed packages
neo update                   # update neo and all non-pinned packages
neo update --extensions      # update packages only
neo update --self            # update neo only
neo update --self --force    # reinstall neo even if current
neo update npm:@foo/bar      # update one package
neo config                   # enable/disable resources
```

By default, `install` and `remove` write to global settings
(`~/.neo-code/agent/settings.json`). Use `-l` for project settings
(`.neo-code/settings.json`).

To try a package without installing:

```bash
neo -e npm:@foo/bar
neo -e git:github.com/user/repo
```

## Package Sources

### npm

```
npm:@scope/pkg@1.2.3
npm:pkg
```

- Versioned specs are pinned and skipped by `neo update`.
- Set `npmCommand` in settings to use a wrapper (e.g. `["mise", "exec", "node@20", "--", "npm"]`).

### git

```
git:github.com/user/repo@v1
git:git@github.com:user/repo@v1
https://github.com/user/repo@v1
ssh://git@github.com/user/repo@v1
```

- Refs pin the package and skip updates.
- Cloned to `~/.neo-code/agent/git/<host>/<path>` (global) or `.neo-code/git/<host>/<path>` (project).
- Runs `npm install` after clone/pull if `package.json` exists.

### Local Paths

```
/absolute/path/to/package
./relative/path/to/package
```

Added to settings without copying. Relative paths resolve against the settings file.

## Creating a Package

Add a manifest to `package.json`:

```json
{
  "name": "my-neo-package",
  "keywords": ["neo-code-package"],
  "neosantara": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Paths are relative to the package root. Arrays support glob patterns and `!exclusions`.

Without a manifest, Neo Code auto-discovers from conventional directories:

- `extensions/` — `.ts` and `.js` files
- `skills/` — `SKILL.md` folders and top-level `.md` files
- `prompts/` — `.md` files
- `themes/` — `.json` files

## Dependencies

Runtime dependencies belong in `dependencies`. Neo Code runs `npm install --omit=dev`
after clone, so `devDependencies` are not available at runtime. When `npmCommand`
is configured, git packages use plain `install` for compatibility.

Core packages are bundled by Neo Code. If you import these, list them in
`peerDependencies` with `"*"` range:
- `@neosantara/ai`
- `@neosantara/agent-core`
- `@neosantara/code`
- `@neosantara/tui`
- `typebox`

## Package Filtering

Filter what a package loads using the object form in settings:

```json
{
  "packages": [
    "npm:simple-pkg",
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": []
    }
  ]
}
```

- Omit a key to load all of that type.
- Use `[]` to load none of that type.
- `!pattern` excludes matches.

## Scope and Deduplication

Packages can appear in both global and project settings. If the same package
appears in both, the project entry wins. Identity is determined by:

- npm: package name
- git: repository URL without ref
- local: resolved absolute path
