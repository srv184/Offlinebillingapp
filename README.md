# Offline Billing & Inventory Management App

A production-oriented, fully offline React Native (Expo + TypeScript) billing
and inventory app: articles/inventory, customer billing with a persistent
draft cart, PIN-protected auth with inactivity timeout, dual-redundant SQLite
storage with automatic failover and recovery, local printing, Excel export,
and database backup/restore. No cloud database, no internet dependency for
any core workflow.

## Before you run it

This project was written and organized in an environment with no Android/iOS
emulator and no network access, so it has **not** been through
`npm install`, a TypeScript compile, or an on-device run. Every file is real,
complete implementation code (no `TODO` / `Coming Soon` stubs anywhere), but
you should treat the first `npm install && npx tsc --noEmit` as the actual
"does this compile" check, and budget time for the on-device QA pass in
[Testing](#testing) before calling it production-ready. A few specific things
to double check after installing, called out inline below, are the
`expo-sqlite` async API surface (it evolved across SDK versions) and printer
behavior on real hardware.

## Getting started

```bash
npm install
npx expo start
```

This app uses only Expo config plugins (`expo-sqlite`, `expo-secure-store`,
`expo-print`) and no other custom native code, so it should run in Expo Go
on SDK 51, or via a dev client / `expo run:android` / `expo run:ios` for a
closer-to-production build.

### Android production build

```bash
npx expo prebuild --platform android
eas build --platform android --profile production
# or, for a local build:
cd android && ./gradlew assembleRelease
```

### iOS build

```bash
npx expo prebuild --platform ios
eas build --platform ios --profile production
# or open ios/*.xcworkspace in Xcode and archive
```

Update `app.json`'s `ios.bundleIdentifier` / `android.package` before
building for real distribution.

## Architecture

```
src/
  types/            Shared domain types (Article, Bill, CartItem, ...)
  constants/         Config: table names, timeouts, secure-store keys
  database/
    schema.ts              CREATE TABLE statements (single source of truth)
    DatabaseConnection.ts   One SQLite handle: open, migrate, health-check
    DualDatabaseManager.ts  Applies every write to primary + secondary,
                            idempotent replay, health/failover orchestration
    SyncJournal.ts          Crash-safe append-only log of in-flight writes
    RecoveryService.ts      Rebuilds a corrupted DB from the healthy one
  repositories/       ONLY layer allowed to write SQL (Article, Bill,
                      Draft, Settings) -- screens never touch SQL directly
  services/           Business logic: Authentication, Billing, Inventory,
                      BillNumber, Printing, ExcelExport, Backup
  storage/            expo-secure-store wrapper (PIN storage only)
  authentication/     AuthContext (lock state) + lifecycle wiring
  navigation/          Root/tab/stack navigators + BillingCartContext (draft)
  screens/            One file per screen in the spec (Home, Add Article,
                      Billing, Generated Bill, Bill History, Bill Detail,
                      Settings, Setup, PIN)
  components/         Small shared UI pieces
  utils/              Pure, dependency-light helpers (validation,
                      formatting, id generation, PIN hashing) -- these are
                      what __tests__/ exercises without any native module
__tests__/           Jest unit tests for the pure business logic
```

### Why two databases, and how they actually stay in sync

Every write in the app is expressed as a small, static list of SQL
statements (a `WriteOperation`) built by a repository. `DualDatabaseManager`
applies that operation to whichever database is currently active inside a
single SQLite transaction, then replays the *same* operation against the
standby database. Each database tracks which operation IDs it has already
applied (`applied_operations` table), so replaying an operation a database
already has is a guaranteed no-op -- that's what makes it safe to retry
after a crash instead of needing true distributed two-phase commit.

A separate flat file (`sync_journal.jsonl`, outside both SQLite files) records
operation intent *before* any SQL runs, and its status is updated as the
operation lands on each database. On every app startup,
`DualDatabaseManager.reconcileJournal()` replays anything not yet marked
`both_ok`. This is what section 53's "transaction journal so an interrupted
sync can be detected and reconciled" maps to concretely.

Startup health check flow (`DualDatabaseManager.initialize`):
1. Open + migrate both databases.
2. `PRAGMA integrity_check` + required-table check on both (not just "does
   the file exist").
3. If primary is healthy, use it.
4. Else if secondary is healthy, switch to secondary, then rebuild a fresh
   primary from secondary's verified data (`RecoveryService`), and switch
   back to the rebuilt primary once it passes its own health check.
5. If neither is healthy, surface a clear error screen (see `App.tsx`)
   telling the user to restore from a backup file.

### Bill numbering, and Save/Print idempotency

`bill_counter` is a one-row table incremented as part of the same
transaction that inserts the bill + bill_items + deducts inventory, so a
bill number is never "claimed" without the rest of the bill committing too.
Before finalizing, `BillRepository.findFinalizedBillForDraft(draftId)`
checks whether the current draft already produced a finalized bill --
covering both a fast double-tap (see the in-memory lock in
`BillingService.finalizeActiveDraft`) and the harder case of the process
being killed mid-transaction and relaunched. "Print Bill" always runs the
same finalize path as "Save Bill" first (section 20), so it can never create
a second bill.

### Draft persistence

The active cart (customer name, line items, quantities, sizes) is mirrored
into `draft_bills` / `draft_bill_items` on every change (debounced ~300ms).
`BillingCartContext` reloads it on mount, so navigating to another tab and
back -- or fully killing and relaunching the app -- restores the in-progress
bill. Finalizing (Save/Print) clears the draft.

### Authentication

The PIN is never stored in SQLite or in plaintext: `AuthenticationService`
salts and SHA-256 hashes it (`utils/pinHash.ts`) and stores only the salt +
hash via `expo-secure-store` (Android Keystore / iOS Keychain). Lock state
is decided purely by comparing "now" against a persisted
`lastAuthenticatedAt` timestamp and the configured timeout -- never by
guessing whether the process was "still in memory."

## Testing

`npm test` runs Jest against the parts of the business logic that have no
native dependency: validation rules, bill total/idempotency math, bill
number formatting, and the salted-PIN-hash comparison logic (with
`expo-crypto`'s digest mocked, since it needs a native binding that Jest's
Node environment doesn't have). These are real, meaningful tests -- but they
intentionally don't cover anything that needs SQLite, secure storage, the
print dialog, or React Native rendering, because none of those run under
plain Jest/Node.

The manual, on-device pass in section 55 of the original spec still needs
to happen on a real emulator/device. A suggested run-through:

- [ ] First launch → setup screen → PIN + confirm → Home
- [ ] Force-quit and reopen immediately → no PIN prompt (within timeout)
- [ ] Force-quit, wait past the configured timeout, reopen → PIN required
- [ ] Add 3+ articles with different prices/sizes/quantities; search them
- [ ] Start a bill, add multiple items, change quantity/size, background the
      app, return to Billing → draft is still there
- [ ] Generate → Edit (back to cart) → Generate again → Save
- [ ] Confirm inventory decreased by exactly the billed quantity
- [ ] Print an existing saved bill from Bill History; confirm it does NOT
      create a duplicate bill
- [ ] Rapidly double-tap Save/Print on a fresh bill; confirm only one bill
      exists afterward
- [ ] Export Excel; open the workbook and check all 4 sheets
- [ ] Create a backup, then corrupt/delete the primary database file
      directly (e.g. via a file manager or `adb shell`) and relaunch;
      confirm the app switches to the recovery database and rebuilds a
      fresh primary
- [ ] Restore from a backup file and confirm data reappears correctly

## A few implementation notes worth knowing about

- **expo-sqlite API surface**: this code targets the async API shipped with
  Expo SDK 51 (`openDatabaseAsync`, `execAsync`, `runAsync`, `getAllAsync`,
  `getFirstAsync`, `withTransactionAsync`). If you upgrade the SDK, check
  `expo-sqlite`'s changelog for signature changes before assuming this layer
  still compiles as-is.
- **Printing** goes through `expo-print`'s `printAsync({ html })`, which
  hands off to the OS's native print flow (AirPrint on iOS, the Android
  print service) — actual printer discovery and Bluetooth/Wi-Fi printer
  support depends entirely on the OS and printer, not this app.
- **Restore** replaces both the primary and secondary database files with
  the validated backup and reinitializes the dual-database manager; it
  does not attempt to merge data with what was already on the device.
- **Concurrency assumption**: this is a single-user, single-device app.
  The bill-numbering and finalize logic relies on that (documented in
  `BillRepository.finalize`'s doc comment) rather than implementing a full
  distributed compare-and-swap, which would be overkill here.
