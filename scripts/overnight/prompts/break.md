# Stage: break-it

The task below is implemented and passes the gate. Try to break it. You are in its worktree; the change is staged (`git diff --cached <base>`; the base is named below).

Write new tests, in new files named `*.adversarial.test.ts` next to the code (or a new `test(...)` block in `e2e/demo-path.spec.ts` for flow screens), aimed at:

- edge cases in input: empty, very long, unicode, a missing field, a malformed id or token
- races: parallel calls on one card (exactly one wins, side effects run once)
- the CLAUDE.md rules the change touches: crisis and sensitive text, anonymity, nothing posted without a tap, sign-in required, expiry
- each acceptance criterion from the spec, approached from an angle the existing tests miss

Don't change the code under test, and don't edit or delete existing tests. Run your new tests. Keep the ones that pass as regression tests. Keep the failing ones too, if you're confident the code is wrong (the next stage fixes the code). Delete any failing test whose expectation you aren't sure of. Report each scenario in `tried`.
