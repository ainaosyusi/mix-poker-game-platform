# Mix Poker App - Refactoring & Test Issues List

> Updated: 2026-01-28
> Purpose: Track refactoring opportunities and testing gaps/issues after recent fixes.

---

## Refactoring Issues (Code Health)

1) **Session/connection ownership tracking is scattered**
   - **Area**: `server/index.ts`
   - **Symptoms**: roomId saved in `socket.data`, room membership in `socket.rooms`, userId in `socket.data.user`.
   - **Impact**: disconnect/cleanup logic can diverge; reconnection logic requires repeated checks.
   - **Next**: introduce a single `SessionStore` (socketId → {userId, roomId, seatIndex, resumeToken}) and use it as source of truth.

2) **room-state-update broadcasting duplicated across handlers**
   - **Area**: `server/index.ts`
   - **Symptoms**: multiple call sites; risk of bypassing sanitization if any path misses the helper.
   - **Impact**: security/visibility bugs (hand leakage, wrong perspective).
   - **Next**: enforce `broadcastRoomState()` usage via a linter rule or central wrapper; consider moving to `RoomManager`/`GameEngine` event.

3) **Room state mutations spread across event handlers**
   - **Area**: `server/index.ts` (join/leave/sit/quick-join)
   - **Symptoms**: business logic duplicated (seat handling, pending flags, room cleanup).
   - **Impact**: higher risk of divergent behavior and race conditions.
   - **Next**: move seat/join/leave logic into `RoomManager` with clear atomic methods.

4) **Player removal during hand is racy**
   - **Area**: quick-join cleanup + `handleRoomExit`
   - **Symptoms**: removal + fold processing happening out of order in some flows.
   - **Impact**: potential for phantom players or skipped turns.
   - **Next**: unify removal into a single flow: mark `pendingLeave` → resolve action → finalize cleanup.

5) **Action token & rate-limit logic interleaved with game logic**
   - **Area**: `server/index.ts` `player-action`
   - **Symptoms**: a single handler performs validation, rate-limits, action processing, and timers.
   - **Impact**: harder to test; brittle in edge cases.
   - **Next**: extract `validateActionRequest()` and `processActionRequest()` for unit testing.

6) **Client state is split between props and socket events**
   - **Area**: `client/src/Table.tsx`, `client/src/components/table/PokerTable.tsx`
   - **Symptoms**: `yourSocketId` prop vs `socket.id` usage.
   - **Impact**: mismatch risk after reconnects; UI inconsistencies.
   - **Next**: move socket + socketId into a shared context store (Zustand/Jotai).

7) **Error handling is inconsistent (alert/console)**
   - **Area**: client/server
   - **Symptoms**: mix of `alert()` and console logs; missing UI surfacing.
   - **Impact**: hard to debug from UI; inconsistent UX.
   - **Next**: standardize to a client toast system + server error codes.

8) **Preset room configs are hardcoded**
   - **Area**: `server/roomDefinitions.ts`
   - **Impact**: difficult to test variants or run isolated rooms.
   - **Next**: load from config or allow dynamic rooms in test mode.

---

## Test Issues / Gaps

1) **Integration tests depend on preset rooms**
   - **File**: `server/tests/v036-integration-test.ts`
   - **Issue**: no isolated room creation; tests can fail if rooms are occupied.
   - **Fix**: add a test-only create-room API or `TEST_MODE` room factory.

2) **Tests rely on real timing and auto-start**
   - **Issue**: `AUTO_START_DELAY_MS` and timers introduce flakes.
   - **Fix**: expose test hooks to force start or shorten timers in test env.

3) **Socket disconnect cleanup not explicitly verified on server side**
   - **Issue**: client polling used for verification; could miss server-side state.
   - **Fix**: add a test-only admin endpoint to inspect room state.

4) **Unit tests for game engine are thin compared to integration**
   - **Issue**: many edge cases only covered by integration tests.
   - **Fix**: add targeted unit tests for `GameEngine`, `PotManager`, `ShowdownManager`.

5) **Static-code tests are brittle**
   - **Issue**: tests parse file contents to verify fixes.
   - **Fix**: replace with runtime assertions or proper unit tests.

6) **Test suite requires running dev server**
   - **Issue**: slower and more fragile in CI.
   - **Fix**: allow in-process server start in tests or use `supertest` + socket test utilities.

7) **No load/soak tests**
   - **Issue**: multi-room and multi-player scaling not covered.
   - **Fix**: add a scripted load test for 10–50 clients.

---

## Next Actions (Suggested Order)

1) Create a test-only room creation endpoint or local factory (unblocks flaky integration tests).
2) Extract session store (socketId/userId/roomId) and use it in join/leave/disconnect.
3) Add unit tests for `GameEngine` + `ShowdownManager` edge cases.
4) Introduce test hooks to skip timers / force start.

