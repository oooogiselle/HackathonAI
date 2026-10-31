# Stage: architecture

Design how to build the approved spec below. You are read-only. Read the code you'll change, and reuse what exists (helpers in `src/lib/ask/`, server action patterns in `src/server/actions/`, UI pieces in `src/components/ask/`) over writing new ones.

The `markdown` field is the design, with these sections:

1. **Approach:** two or three sentences
2. **Files:** each file to change or add, and what changes in it (also list them in `files`)
3. **Data flow:** from the tap to the server action to the store and back; name the functions
4. **Contract changes:** new or changed server actions, inputs (zod) and outputs, as an edit to `docs/contract.md`; write "none" if there are none
5. **State and concurrency:** any state transition as a guarded `UPDATE ... WHERE <expected state> RETURNING`, with side effects only for the request that wins (CLAUDE.md "Concurrency")
6. **Failure modes:** what happens on bad input, a lost race, an expired card, no sign-in, no AI key (canned fallback)
7. **Rejected alternative:** one other way, and why not
8. **Test plan:** each acceptance criterion mapped to a test (file + name, unit or e2e). Write the tests before the code. If a flow screen changes, `e2e/demo-path.spec.ts` changes too (also in `test_plan`).

Keep it the smallest design that meets the acceptance criteria.
