# AMPlifier

AMPlifier is an academic management app for tracking assessment scores, planning schoolwork, and exploring grade scenarios. Google sign-in and Cloud Firestore keep each student's workspace private to their account.

## Run locally

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local`, add your Firebase web app configuration, then restart Vite. In development, the sign-in page also offers **Explore with sample data**, an offline preview that never writes to Firebase.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | Grading-engine and data unit tests (Vitest) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run build` | Production bundle in `dist/` |
| `npm run check` | Typecheck, tests, and build in one go |
| `npm run mcp -- --backup <file>` | MCP server for Claude and other AI clients (see below) |

## Features

- **Overview** — current-period, year-to-date, and projected final averages; a term trend (recorded vs projected); rule-based insights (below passing, declines, weakest component, inconsistent results, biggest lever on the average); upcoming deadlines.
- **Gradebook** — per-subject component breakdown with weights, grade-after-each-assessment timeline, filterable assessment records with edit and undo-able delete, and a spreadsheet-style grid for official report-card grades.
- **Report card** — every term grade labeled *Actual*, *Estimated*, or *Projected*, with per-subject and general finals; print or save as PDF.
- **Simulator** — stack several hypothetical scores, see the effect on the subject and period average, and solve "what score do I need on the next assessment?". Nothing is saved.
- **Forecast** — final-average target, autosaved term assumptions, conservative / realistic / optimistic scenario comparison, and the grade needed per subject and overall.
- **Tasks**, **Schedule** (Mon–Sat timetable), **Notes** (Drive-backed attachments), **Community** (opt-in profiles, friends, chats, groups).
- **Settings** — school details, subject management (add, rename with cascade, recolor, reorder, remove), per-subject weights, passing grade, optional DepEd transmutation, JSON/CSV export.
- Global search (`Ctrl`/`⌘` + `K`) across pages, subjects, assessments, and tasks.

## Grading rules

All calculations live in `src/engine` and are covered by tests in `src/engine/__tests__`.

- **Component score** = total points earned ÷ total points possible × 100 (DepEd percentage-score method).
- **Term grade** = component scores weighted by the subject's WW / PT / Exam weights. Components with no records yet are left out and the remaining weights are re-normalised, so an incomplete term is estimated from what has been recorded.
- **Grade scale** — *Weighted percentage* (default) uses that value directly; *DepEd transmuted* converts it with the DepEd Order No. 8, s. 2015 table (60 → 75, 84 → 90, 100 → 100).
- **Term precedence** — an official report-card grade (*Actual*) overrides an *Estimated* grade, which overrides a *Projected* assumption.
- **Averages** — each term counts equally toward a subject's final; each subject counts equally toward the general average. Missing terms are excluded, never counted as zero.
- Displayed grades are rounded to one decimal; the "score needed" solver compares against that displayed value.

## Architecture

```
src/
  engine/       Pure, tested grade logic: calculator, transmutation, reportCard, simulator, insights, periods
  lib/          Dates, record normalisers and subject-rename cascade, local cache
  state/        useWorkspace (load, live sync, persistence); academicModel + useAcademicModel (derived figures)
  mcp/          Node-only MCP server for external AI clients (never imported by the app)
  services/     Firebase auth, Firestore, Google Drive
  components/   layout/, views/, dialogs/, ui/ primitives, plus auth/setup/notes/community screens
  styles/       app.css (design tokens + components) and legacy.css (auth, setup, notes, community)
```

Every mutation updates React state first, then the per-account browser cache, then Firestore. Settings edits are debounced and written key-by-key, and incoming snapshots never overwrite settings the student is still editing.

## Connect Claude (MCP server)

AMPlifier ships a [Model Context Protocol](https://modelcontextprotocol.io) server so Claude, or any MCP client, can read your grades and run what-if experiments. Its numbers come from the same `src/engine` code and `deriveAcademicModel` the app uses, so they always match what you see on screen.

**Data source.** The server reads one student's own JSON backup: *Settings → Data & backup → JSON backup* (`format: "amplifier-backup"`, `version: 2`). It has no Firebase credentials and can never see another account. The file is re-read on every tool call, so exporting a fresh backup to the same path updates Claude without a restart. Keep the backup somewhere private; it contains your full academic record.

**Tools.** Every tool is read-only. Simulations work on copies and never change the backup.

| Tool | Permission | What it answers |
|---|---|---|
| `get_academic_overview` | READ | Current, year-to-date, and projected averages; each subject's grade and status; insights; upcoming counts |
| `get_subject_grades` | READ | One subject's components and weights, term grades with source, grade needed per remaining term |
| `get_assessment_history` | READ | Recorded scores with percentages, filterable by subject, period, component |
| `get_upcoming_assessments` | READ | Open tasks and future-dated assessments, including overdue items |
| `simulate_grade` | SIMULATE | Subject and period average after hypothetical scores (`simulateSubject`) |
| `get_grade_requirements` | SIMULATE | Minimum score on the next assessment for a target (`requiredScore`), plus the per-term grade needed for a final target |
| `forecast_general_average` | SIMULATE | Final general average under conservative / realistic / optimistic, saved, or custom assumptions |
| `compare_quarters` | SIMULATE | Term-by-term averages and each subject's change between two terms |

**Write access is disabled.** No WRITE tools are registered, and the server only ever opens the backup for reading. Starting it with `--allow-writes` is refused. Adding or editing records still happens in the app.

### Claude Code

From the AMPlifier folder (after `npm install`):

```sh
claude mcp add amplifier -- npx tsx src/mcp/main.ts --backup "C:/path/to/amplifier-backup.json"
```

Then ask, for example, *"Using AMPlifier, what do I need on my next Math exam (out of 40) to reach 90 this quarter?"*. Run `/mcp` inside Claude Code to check the connection.

### Claude Desktop

Add this to `claude_desktop_config.json` (*Settings → Developer → Edit Config*), using absolute paths, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "amplifier": {
      "command": "node",
      "args": [
        "C:/DEV/AMPlifier/node_modules/tsx/dist/cli.mjs",
        "C:/DEV/AMPlifier/src/mcp/main.ts",
        "--backup", "C:/Users/you/Documents/amplifier-backup.json"
      ]
    }
  }
}
```

Instead of `--backup`, you can set `"env": { "AMPLIFIER_BACKUP": "..." }`. Each student points the server at their own backup; run one server entry per student if several people share a computer.

**Troubleshooting.** Run `npm run mcp -- --backup <file>` in a terminal: it prints `AMPlifier MCP server ready (read-only)` to stderr, or the reason the backup was rejected (wrong file, or an older backup version). Press `Ctrl+C` to stop.

**Bundle boundary.** `@modelcontextprotocol/sdk`, `zod`, and `tsx` are dev dependencies used only by `src/mcp`. Nothing in the app imports that folder (a test enforces this), so none of it reaches the Vite bundle.

## Data and privacy

Each account stores its workspace in `users/{uid}`. Firestore rules in `firestore.rules` restrict workspace data to its owner and protect social profiles, connections, group invitations, and member-only chat messages. If a workspace has no cloud assessment or task fields yet, the app migrates that account's existing browser-local records to Firestore once. New PDF and DOCX note attachments are uploaded to a private `AMPlifier Notes` folder in the student's own Google Drive; Firestore stores only the Drive file ID and metadata.

Firebase web configuration is included in the browser bundle by Vite, so those values identify the project and are not server secrets. Never put service-account keys or other private credentials in a `VITE_` variable.

## Firebase setup

1. Create a Firebase project and register a Web app. Copy the web app configuration into `.env.local` using the keys in `.env.example`.
2. In Firebase Authentication, enable Google and add local and production domains to the authorized domains list.
3. Create a Cloud Firestore database and deploy the rules in `firestore.rules`. Social discovery starts disabled; users must opt in before their name, photo, handle, and optional bio appear in the directory.
4. In the same Google Cloud project, enable the Google Drive API. The first time a student connects Drive, AMPlifier requests the limited `drive.file` permission.
5. Restart Vite after changing `.env.local`.

## UI design

Design tokens (colour, type, radius, spacing) are defined once at the top of `src/styles/app.css`; chart colours mirror them in `src/components/charts/chartTheme.ts`. The identity is a sage-green accent with Crimson Pro display type and Atkinson Hyperlegible body text. Grade provenance is always shown with a text badge (Actual / Estimated / Projected), never colour alone. Background research for the design lives in [`design-system/amplifier/MASTER.md`](design-system/amplifier/MASTER.md).
