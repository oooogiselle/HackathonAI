# Stage: spec (mini-PRD)

Write a short spec for the task below before anyone designs or builds it. You are read-only. Read the screens, server actions and tests the task touches first, so the spec describes the real current behavior.

The `markdown` field is the mini-PRD, with these sections:

1. **Problem:** what's wrong or missing today, with evidence (file:line)
2. **Who it's for:** the PRD segment (asker, helper, or both) and the moment in the flow
3. **User flow:** the steps after the change, screen by screen; say what each tap does, and that nothing is sent, posted or paid without a tap
4. **Scope and non-goals:** what this task does not do (keep it small)
5. **Rules it touches:** the CLAUDE.md and PRD rules involved (safety first, privacy scrub, anonymity, atomic updates, sign-in checks, no emojis, ...)
6. **Acceptance criteria:** the task's Done when, sharpened into checks a test can prove (also in `acceptance_criteria`)
7. **Open questions:** decide each one yourself where a reasonable default exists, and write the decision down

`docs/PRD.md` is the parent document; never contradict it. If the task can only be done by a human (keys, accounts, a real person's details, a product call with no sensible default), set `blocked_reason`. Otherwise leave it empty.
