# SprintEcho

A sprint retrospective board for running team retros together, live.

Available at [sprintecho.com](https://sprintecho.com).

## What it does

**Three columns for feedback.** Every retro is organised into *The Good*,
*The Bad*, and *Action Items*. Anyone on the team can add notes to any column.

**Everyone contributes at once.** The board updates live, so notes, votes and
reordering appear for everybody as they happen — no refreshing, no waiting for
one person to type everything up.

**Vote on what matters.** Notes can be liked or disliked, so the team can see
quickly which points resonate and which ones to spend the discussion time on.

**Take turns presenting.** One person can claim the presenter role and
highlight the note being discussed, so everyone is looking at the same thing.
When they're done, someone else picks it up.

**Drag to organise.** Notes can be reordered within a column to group related
points together or rank them.

**AI summary.** At the end of a retro, the board can generate a written summary
of what was raised and what was agreed, so there's something to share without
anyone taking minutes.

**Sprints and teams.** Each retro is its own sprint, kept as a record you can go
back to. Sprints belong to a team, so different teams keep their own boards.

**A hidden bit of fun.** There's an easter egg. You'll find it.

## Getting an account

Sign up with your work email address and pick your team. If an admin has given
you a temporary password, you'll be asked to choose your own the first time you
sign in.

## Running it locally

By default `npm run dev` talks to the **live** Firebase project, so anything you
create or close there lands on real retros. To work against local emulators with
throwaway data instead, use two terminals:

```bash
npm run emulators          # auth on 9099, firestore on 8080
npm run seed               # throwaway users, sprints and notes
npm run dev:emulators      # the app, pointed at the emulators
```

`npm run seed` refuses to run unless the emulator host variables are set, so it
cannot touch production. It is safe to re-run — it deletes what it previously
created first. It prints the accounts it made; they all share the password
`retro-local-pass`.

The seeded data is shaped to reach the states that are otherwise awkward to
produce: team Protoss gets one open sprint plus fourteen closed ones (two pages
of archive), one note is left unpublished so the draft padlock and Publish All
are reachable, and team Tigers is left with no sprints at all for the empty
state.

Use `npm run emulators:all` instead if you need the Cloud Functions too — signup,
temporary passwords, or the AI summary. It builds `functions/` first.

**The emulator does not enforce composite indexes.** A query that needs one will
run fine locally and fail in production with `FAILED_PRECONDITION`, so when you
add or change a `where` clause, add the index to `firestore.indexes.json`, run
`npm run deploy:indexes`, and wait for it to report Enabled before deploying the
app.

## Deploying

```bash
npm run deploy:indexes     # if firestore.indexes.json changed — wait for Enabled
npm run deploy:rules       # if firestore.rules changed
npm run deploy             # builds and publishes to gh-pages
```

Indexes and rules are not deployed by CI, and index builds are asynchronous —
ship them before the bundle that depends on them.
