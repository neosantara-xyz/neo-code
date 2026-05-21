# Termux

Neo Code supports Android/Termux by building from the release source archive or a local source checkout. Desktop binary assets are not used on Termux.

## Install path

```bash
pkg install nodejs-lts git
curl -fsSL https://code.neosantara.xyz/install.sh | sh
neo login
```

The installer detects Termux and links the `neo` command to `$PREFIX/bin` by default. Outside Termux, the default command path is `~/.local/bin`.

Override the command path with:

```bash
curl -fsSL https://code.neosantara.xyz/install.sh | sh -s -- --bin-dir "$HOME/bin"
```

## Touch keyboard extra keys

Run these commands inside the Neo Code TUI:

```txt
/termux-keys show      # preview the Neo layout
/termux-keys apply     # write the layout and back up the previous file
/termux-keys restore   # restore the latest Neo-created backup
```

`/termux-keys apply` writes the Neo `extra-keys` layout to `~/.termux/termux.properties`. It creates the `.termux` directory when needed, saves a timestamped backup before changing an existing file, and runs `termux-reload-settings` if that command is available.

Restart the Termux app if the keyboard layout does not refresh immediately.
