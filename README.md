# CodeHS Auto Typer / Ghost Typer

A userscript that types code into the CodeHS editor one keystroke at a time, for situations where you can't paste directly (a broken `V` or `C` key, a locked-down keyboard, and so on).

Paste your source into the panel, click the editor, and the script types it out with the right indentation and with the editor's auto-closed brackets handled correctly.

## Features

- **Keystroke-style typing.** Characters are sent through key and input events, so the editor treats them like normal typing.
- **Indentation that doesn't drift.** CodeHS auto-indents, so the script types every line flush-left and lets the editor place it. No Tab presses, no doubled indents.
- **Two modes, chosen automatically by URL.**
  - **Non-student mode:** pages starting with `https://codehs.com/sandbox/id` or `https://codehs.com/share/`.
  - **Student mode:** every other page on `codehs.com`. The editor here auto-completes brackets and quotes, so when the next character to type is a closer that is already there, the script presses Arrow Right to skip over it instead of typing it again.
- **Adjustable speed** from 20 to 220 WPM, or a 600 WPM fast mode.
- **Optional humanized typing:** variable rhythm, occasional typos that get corrected, and random pauses. All of it is adjustable or can be turned off.
- **Pause, resume, and cancel** at any time. Clicking outside the editor while typing auto-pauses; clicking back in resumes.
- **Runs only on `codehs.com`.**

## Installation

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new script and replace its contents with [`codehs-ghost-typer.user.js`](codehs-ghost-typer.user.js), or open the raw file if your manager offers to install it directly.
3. Save. If you are updating, replace the old script's contents rather than adding a second copy.

The script uses `@grant none` so it runs in the page's own context and can read the editor's state. Adding other `@grant` permissions will sandbox it and break student mode.

## Usage

1. Open a CodeHS editor and click inside it.
2. A small prompt appears in the bottom-right corner: **"CodeHS text input detected. Stream code?"** Click **Yes**.
3. Paste your code into the text area. The panel shows which mode is active.
4. Adjust the settings if you like, then click **Start Typing**.
5. During the 3-second countdown, click back into the editor at the spot where the code should begin.
6. Use **Pause** or **Stop & Cancel** as needed.

### Settings

| Setting | What it does |
| --- | --- |
| Speed (WPM) | Typing speed. Up to 220, or 600 in Fast Mode. |
| Error Rate | Chance per character of a typo that is then corrected (humanized only). |
| Consistency | How even the timing is. Lower values mean more variation (humanized only). |
| Break Chance / Duration | Chance of a random pause at spaces, newlines, and punctuation, and how long it lasts (humanized only). |
| Humanized | Typos, rhythm variation, and breaks. |
| Fast Mode | Constant speed, no typos, no breaks. |
| Strip indentation | Types lines flush-left so the IDE's auto-indent places them. On by default, and always on in student mode. |

## How it works

**Indentation.** The editor copies the previous line's indent on Enter, adds a level after an opening bracket, and outdents when you type a closing brace. Trying to predict that with a counter drifts quickly, so the script skips leading whitespace entirely and lets the editor do the work.

**Student mode.** Before typing a closing character, the script reads the editor's real state through its Ace instance:

- If the character right after the cursor is the same closer, it presses Arrow Right instead of typing it.
- If the editor pushed an auto-inserted `}` onto the next line (after typing `{` and Enter), and the next source line starts with a closer, it moves down to that closer rather than pressing Enter and typing a second one.

## Compatibility

- Built for the CodeHS editor, which is based on [Ace](https://ace.c9.io/).
- Developed and used with Violentmonkey. Tampermonkey should work the same, as long as the script stays on `@grant none`.
- Desktop browsers only.

## Troubleshooting

- **Doubled closing brackets in student mode:** the script couldn't find the Ace editor. Check the browser console for a `[Ghost Typer]` warning.
- **Odd behavior next to an autocomplete popup:** Arrow Down can interact with open suggestion lists. Dismiss the popup and try again.
- **Wrong mode shown:** the mode is read from the top-level page URL. Confirm the address starts with one of the non-student prefixes above.
- **Text appears in the wrong place:** make sure you click into the editor during the countdown, and keep the cursor where you want the code to start.

## Responsible use

This tool automates typing. It does not change what you are allowed to submit. Use it only where automation and outside code are permitted, and follow your school's and instructor's academic integrity rules.

## License

Add a license of your choice before publishing, for example MIT.
