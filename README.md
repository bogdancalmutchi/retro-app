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

SprintEcho is invite only. An admin sends you a link, you follow it, pick your
own password, and you're in — the password is never chosen for you and never
travels over chat.

Invite links are single use and expire after seven days. Only a hash of the link
is stored, so it cannot be shown again after it is created; a lost link means
revoking it and issuing a new one.

If an admin has instead reset your password for you, you'll be asked to choose
your own the first time you sign in.

## Running it locally

By default `npm run dev` talks to the **live** Firebase project, so anything you
create or close there lands on real retros. To work against local emulators with
throwaway data instead:

```bash
npm run dev:local
```

That one command builds the functions, starts the auth, firestore and functions
emulators, seeds them, and serves the app pointed at them. Stopping it with
Ctrl-C shuts the emulators down too, which also discards the data — every run
starts from the same fixture. Note that the emulators are wrapped in
`emulators:exec`, so Vite's interactive keyboard shortcuts are not available.

The steps are also available separately, in three terminals, when you want the
emulators to outlive a restart of the app:

```bash
npm run emulators          # auth on 9099, firestore on 8080
npm run seed               # throwaway users, sprints, notes and an invite
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

`npm run emulators` starts only auth and firestore. Use `npm run emulators:all`
if you also need the Cloud Functions — invites, temporary passwords, or the AI
summary. It builds `functions/` first. `dev:local` already includes them.

There is no way to create the first admin through the app, by design: invites can
only be issued by an existing admin. Bootstrapping a real environment means
creating the Auth user and its `users/{uid}` document directly with `isAdmin:
true`, then letting the `syncUserClaims` trigger push the claim. `functions/scripts/seed.js`
does exactly that for the local fixture.

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
