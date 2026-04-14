# Happy Colors Agent Workflow

This repository is used on Windows. Prefer commands that work in Windows shells.

## Shell rules

- Prefer commands that work in both `cmd.exe` and PowerShell when possible.
- Use double quotes in commands. Do not rely on single-quote shell behavior.
- When requesting an external review, pass the review target to the tool explicitly instead of saying "review this diff" without providing the diff.

## Claude review

Use the Claude CLI directly when you want an external review from Claude.

Review the current working diff:

```bash
git diff | claude -p "Review this git diff for bugs, regressions, security issues, and missing tests. Give concise, actionable findings with file paths and line references where possible."
```

Review staged changes only:

```bash
git diff --cached | claude -p "Review this staged git diff for bugs, regressions, security issues, and missing tests. Give concise, actionable findings with file paths and line references where possible."
```

Rules:

- Prefer diff-based review over asking Claude to inspect the whole repository.
- Prioritize bugs, regressions, security issues, and missing tests over style suggestions.
- Treat style-only suggestions as low priority unless style review was explicitly requested.

## Codex review

Use Codex non-interactively when you want a second review pass.

```bash
codex exec --full-auto -m gpt-5.4 "Review the current implementation for bugs, regressions, security issues, and missing tests. Give concise, actionable findings with file paths and line references where possible."
```

Rules:

- Keep the prompt short and explicit.
- Weigh findings on their merits rather than accepting them blindly.

## Reviewing a file directly

If you need to review a specific file instead of a git diff, use the shell-appropriate command below.

PowerShell:

```powershell
Get-Content path\to\file.ts -Raw | claude -p "Review this file for bugs, regressions, security issues, and missing tests."
```

cmd.exe:

```cmd
type path\to\file.ts | claude -p "Review this file for bugs, regressions, security issues, and missing tests."
```

## Suggested workflow

1. Make the code changes.
2. Inspect the relevant diff locally.
3. Run the Claude diff review command.
4. Apply fixes for valid findings.
5. Optionally run a Codex review pass for a second opinion.
6. Run relevant tests before finishing.
