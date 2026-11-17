# GE150 Pro Editor

[![Release](https://img.shields.io/github/v/release/klaushofrichter/ge150pro-editor)](https://github.com/klaushofrichter/ge150pro-editor/releases)
[![PR checks](https://github.com/klaushofrichter/ge150pro-editor/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/klaushofrichter/ge150pro-editor/actions/workflows/pr-checks.yml)
[![Deploy](https://github.com/klaushofrichter/ge150pro-editor/actions/workflows/deploy-pages.yml/badge.svg?branch=production)](https://github.com/klaushofrichter/ge150pro-editor/actions/workflows/deploy-pages.yml)
[![Dependabot](https://img.shields.io/badge/dependabot-enabled-025E8C?logo=dependabot&logoColor=white)](https://github.com/klaushofrichter/ge150pro-editor/security/dependabot)

<!-- No version numbers in this text: the release badge carries the version. -->

An editor for the **Mooer GE150 Pro** guitar multi-effects pedal that runs in the browser. Connect the pedal by USB,
open the page in Chrome or Edge, and edit presets, effects and settings in real time, arrange the 200 preset slots,
and keep backups. Nothing to install, and nothing leaves your computer.

**Open it: <https://klaushofrichter.github.io/ge150pro-editor/>** — or [try the demo](https://klaushofrichter.github.io/ge150pro-editor/?demo)
without a pedal (made-up presets).

Unofficial: not affiliated with or endorsed by Mooer. Product and model names are those of their owners and are used
only to describe what the pedal does.

![The editor: preset list, signal chain and the AMP module's parameters](docs/screenshots/editor.png)

## What it does

| Area | |
|---|---|
| Presets | All 200 presets (banks 1–50, A–D): select, rename, store, step through them; unsaved changes are marked |
| Effects | The nine modules (FX/COMP, DS/OD, AMP, CAB, NS GATE, EQ, MOD, DELAY, REVERB): on/off, model and every parameter, in real time and in both directions (turn a knob on the pedal and the slider follows) |
| Expression pedal | Module and parameter it controls, EXP VOL switch and range, the controlled value live |
| System | Input and USB levels, display brightness, cab simulation on the outputs, global EQ, spill-over, display language |
| Drum machine | Shows play state, mode, style, BPM and volume (the pedal does not accept drum machine control over USB) |
| Files | Import and export `.mo` presets, compatible with Mooer's editor; browse a folder of `.mo` files |
| Arrange and back up | See below |

### Arrange and back up

![Arranging: swapped presets and banks are highlighted, M and N mark presets that differ from the original set](docs/screenshots/arrange.png)

- **Arrange** the 200 slots on one screen: drag a preset onto another to swap them, drag a bank's title to swap whole
  banks. Click a slot to **make it empty**, **duplicate** the preset into another slot under a new name (or
  Option-drag it), **rename** it, or **replace it with a `.mo` file**, for example one downloaded from elsewhere (pick
  it, or drop it from the Finder onto the slot). Every change is pending, highlighted and can be undone.
- **Write** the changed slots to the pedal: after a warning, the editor saves a backup of the pedal, writes each slot
  (about a third of a second per preset, a progress bar shows where it is, and it can stop between presets), then
  reads every preset back and compares.
- **Backups** are kept in the browser. Export one as a single file, or as a folder of `.mo` files named `01A Name.mo`
  … `50D Name.mo` with a `manifest.json` that describes the set (name, kind, dates, where it came from, a checksum per
  file). Importing a folder places it by its manifest and reports any file that has changed since.
- **The original:** the factory presets become a locked backup that cannot be changed or deleted. Presets are then
  marked **M** (modified: a factory name with another sound) or **N** (new: a name the factory set does not have,
  copies and renamed presets included).
- **Review differences:** for a modified preset or one with unsaved changes, a window lists every setting that differs
  from the original preset of the same name and from the last saved state, with **Restore original** (loaded as
  unsaved changes; Save keeps them) and **Restore last saved**.

### The factory presets

They come with Mooer's own editor download; this repository contains no firmware and nothing taken from it.

1. On [Mooer's download page](https://www.mooeraudio.com/Downloads_xq/6.html), download the GE150 Pro package **for
   Mac** (a `.zip`). It works on any computer: nothing gets installed, the editor only reads the file.
2. In the editor, open **Arrange and back up presets** (the grid icon next to PRESET) and, under **Backups**, choose
   **Read the factory presets from Mooer's download**, then the `.zip`.
3. **🔒 Factory presets** appears at the top of the backups; **Show** puts them in the grid.

The editor unpacks the `.zip` and its disk image in the browser, finds the factory table in the firmware inside and
accepts it only if it matches the known factory table byte for byte. The `.dmg` on its own, or the firmware file
(`GE150PRO_V2.1.x.mr`) of an installed Mooer editor, work too. To keep the factory presets as files, run

```sh
node scripts/extract-factory.mjs ge150_pro_v2.1.4_mac.zip factory-presets
```

which writes the 200 presets as `.mo` files with a manifest (kind `original`, immutable) into a new folder and makes it
read-only.

## Requirements

- Google Chrome or Microsoft Edge on a computer (Windows, macOS, Linux): the page talks to the pedal over
  [WebHID](https://developer.mozilla.org/docs/Web/API/WebHID_API). Safari and Firefox do not support it.
  Phones cannot connect and get a short "desktop only" notice instead of the editor (with a way to look anyway).
- The pedal connected by USB, and Mooer's editor closed: only one program can use the pedal at a time.
- Tested with firmware V2.1.2.
- **Linux:** Chrome needs permission to open the pedal, otherwise connecting fails with "Could not open the GE150 Pro".
  Add a udev rule once, then unplug and replug the pedal:

  ```bash
  echo 'KERNEL=="hidraw*", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="5703", MODE="0660", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/70-ge150pro.rules
  sudo udevadm control --reload-rules && sudo udevadm trigger
  ```

  Use Chrome from google.com (`.deb`/`.rpm`); Flatpak and Snap builds are sandboxed away from USB devices.

## Good to know

- On the first visit a panel explains what the editor is, how to get the factory presets in, and links the
  [terms of use](https://klaushofrichter.github.io/ge150pro-editor/terms.html) ([TERMS.md](TERMS.md)): you use it at
  your own risk. It stays away once the terms are accepted (remembered in the
  browser, until the terms change) and the ⓘ button in the header shows it again.

  <img src="docs/screenshots/welcome.png" alt="The first-visit panel" width="600">

- The first **Connect device** asks Chrome for permission to use the pedal; the page connects by itself afterwards.
- Changes to effects are live on the pedal but not stored until you save the preset (the disk icon). Arrangements are
  written only with **Write … to the pedal**, which always asks first.
- The editor sends only commands observed between Mooer's editor and the pedal; it never sends a factory reset or a
  firmware update. The protocol is described in [docs/protocol.md](docs/protocol.md).
- Backups live in your browser, for this page's address. Export them to keep a copy elsewhere or to move them to
  another browser.

## Development

```sh
npm ci
npm run dev           # http://localhost:5173 (add ?demo for the demo)
npm test              # unit tests
npm run check         # type check
npm run e2e           # browser tests on the built app (demo mode)
npm run screenshots   # renders docs/screenshots/
```

Node 26 (`.nvmrc`). Type checking uses TypeScript 7 (`@typescript/native`, through `svelte-check --tsgo`); TypeScript 6
is installed as `typescript` because svelte-check still needs it. Branches: work on a feature branch, open a pull request to `main`; a release is a pull request
from `main` to `production`. `production` is protected (the `test`, `e2e` and `codeql` checks must pass), and every
push to it publishes the app on GitHub Pages with a calendar version (`YYYY.MM.DD.N`, shown in the tools panel and as
a GitHub release).

## License and terms

The source code is under the [MIT license](LICENSE). Using the app is subject to the [terms of use](TERMS.md).
