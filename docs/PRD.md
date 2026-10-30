# Ask — Product Requirements Document

Oct 30, 2026 · Giselle · Status: Draft

## Summary

Ask is a mobile web app that helps college students, starting with international students, ask for help. The hard part of getting help isn't finding someone, it's asking. A student types a vague, awkward need; AI turns it into a clear, small ask and suggests who or where to ask: a matched peer, or a partner group chat on GroupMe or Slack through a post-only bot.

AI can make asking easier. Only people can help. The AI never does the helping, never sends anything without the user's OK, and no money changes hands.

## Team and key times

Three builders, one owner per area so nobody blocks anyone. Fill in names and swap areas as you like.

| Role     | Owner        | Owns                                                                                                                                                                   |
| -------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend  | Giselle      | Shared types + mock data, the five AI functions, safety rules, API routes, bot adapters (GroupMe, Slack, mock), claim link + "Covered" follow-up; merges into main     |
| Frontend | [Teammate 2] | All screens from the design, wired to the API (mocks first), mobile layout, empty and error states                                                                     |
| Story    | [Teammate 3] | User testing tonight (5–10 people), pitch + demo script, recording and submitting the video; also GroupMe/Slack test setup, seed helper profiles, safety test examples |

Contract first: in the first 30 minutes, agree on the shared types and mock data together; then backend and frontend build in parallel against mocks.

- Hack started Fri ~5:30 p.m.; no commits before kickoff
- Submission: 2–3 min demo video by Sat 10:00 a.m. via the hackathon form
- Winners announced ~11:00 a.m.
- Design prototype: the "Ask — Prototype" canvas (14 phone screens + laptop view)

## Background

Students hold back from asking for help, especially newcomers far from home. Research on time-banking networks found people are more willing to help than to ask: they bank credits from helping and rarely spend them (Penn State). International students are about 15% of Dartmouth's Class of 2029 (The Dartmouth), and many arrive with no car, no family nearby and no idea who to ask.

Group chats are today's workaround, and they fall short in four ways:

- **Public:** posting to hundreds of people is the scary part, so awkward asks never get posted
- **Split by community:** a country's WeChat group never reaches the senior with a car
- **Buried:** an unanswered ask disappears in 20 minutes
- **No memory:** the same questions come back every term

Campus gig apps (Dormzi, Taskloop, FavorIt) mostly stalled on cold start, and paid tasks can create visa risk for F-1 students. Ask is money-free and works with group chats instead of competing with them.

**Fit with the hackathon.** "AI at 70: What must remain human?" asks every team who it's for, what could go wrong, and how it helps people rather than deciding for them. Ask's answer: the AI lowers the barrier to asking; the helping stays human.

## Objective and success metrics

Show, in a working demo, one awkward need becoming a clear ask that a real person accepts — through both a private match and a real group-chat post.

- [ ] A teammate types a messy need and gets a drafted ask in under 30 seconds
- [ ] The ask is posted to a real test GroupMe group by the bot, only after a tap
- [ ] A second teammate claims it from the link with no account, and the bot posts "Covered"
- [ ] "Write my essay" is redirected; a crisis-type message shows professional resources and is never posted
- [ ] Anonymous posts show what the privacy check removed, with Undo
- [ ] With zero helpers, Ask still drafts the ask and suggests where to send it
- [ ] 5–10 people at the hackathon try it tonight; we quote what they say in the video
- [ ] Video recorded by 9:00 a.m., submitted before 10:00 a.m.

## Who it's for

We launch with international students as askers and upperclassman helpers as supply; the others come later.

| Segment                                       | Their job to be done                                          | Pain                                                 | Role      |
| --------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- | --------- |
| International students                        | Rides at break, storage, first-time US systems (SSN, banking) | No car or family nearby; don't want to burden people | Beachhead |
| Helpers (upperclassmen, peer mentors, alumni) | Feel useful, meet people, pay it forward                      | Don't know who needs what; dread open-ended asks     | Supply    |
| Students between terms                        | Storage, sublets, rides at term boundaries                    | Tight timing; asks too specific for a listserv       | Later     |
| First-years and transfers                     | Learn how things work here                                    | No network yet                                       | Later     |

Out of scope: students who want errands done for pay (paid gig apps already chase them), and mental-health crises, which go to professionals, never peers.

## Value propositions

|              | Askers                                                                                            | Helpers                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Who          | An international student needing practical help                                                   | An upperclassman or alum who likes helping                                   |
| Why          | Get unstuck without feeling like a burden                                                         | Help in small ways that fit their week                                       |
| What before  | Hesitates for days, posts to 300 people, or doesn't ask                                           | Sees scattered asks, or none; vague asks feel like big commitments           |
| How          | AI drafts a clear, small ask and picks who or where to ask; anonymous option with a privacy check | Gets only asks they said they'd enjoy, sized in minutes; sets a weekly limit |
| What after   | Help arrives from a real person, often a new connection                                           | A thank-you note, a new connection, no overload                              |
| Alternatives | Group chats, the international office, asking the same two friends                                | Formal mentoring programs, being the go-to friend                            |

Pitch line: "The hard part of getting help isn't finding someone. It's asking. Ask helps you ask, then gets out of the way so people can help people."

## Solution

A mobile web app: one link works for askers, helpers and group-chat members, with no app store.

_Diagram: how an ask flows · safety first, then a private or group route._ Every ask is checked first; crisis and essay asks never reach a peer. Both routes end the same way: a real person says yes, and the asker writes their own thank-you.

### AI functions

Each is one small function with a simple prompt and a fallback if the API fails.

| Function     | Runs when             | Returns                                                                       |
| ------------ | --------------------- | ----------------------------------------------------------------------------- |
| safetyCheck  | First, on every ask   | none, academic, crisis or sensitive                                           |
| clarify      | After Home            | At most 2 questions with tappable options                                     |
| draftAsk     | After Clarify         | A short, specific, time-bounded ask                                           |
| suggestWhere | After the draft       | 2–3 helpers with a one-line why, plus partner groups; works with zero helpers |
| privacyScrub | Anonymous group posts | Text with identifying details removed, plus a list of what was removed        |

### Group chat bot

- One postToGroup interface with GroupMe, Slack and mock adapters; the mock keeps the demo running without tokens
- Runs only after the user taps "Post to group"
- Post-only: it never reads group messages
- Every post ends with a claim link; helpers claim with first name and school email, no account
- After a claim it posts "Covered, thanks to whoever helped!" and never names an anonymous asker
- Only groups whose admins added the bot; a few posts per group per day at most

### Safety and privacy rules

- Nothing is posted or sent without an explicit tap
- "Write my essay" → redirect to tutoring, the writing center or an extension email
- Crisis-type asks → professional resources only (988 and campus counseling), never matched or posted
- Visa, money and health asks → private only; group sharing is hidden
- Helper contact info is shared only after the asker accepts
- No money, ratings, streaks or leaderboards

## Stack

Next.js (App Router) + TypeScript + Tailwind; Anthropic SDK with the model set by ANTHROPIC_MODEL; mock data tonight, no database schema or auth yet.

## Assumptions and open questions

- Do helpers keep helping with no money? Ask 5–10 people at the hackathon tonight.
- Can we use a real GroupMe test group in the demo video? Ask a mentor.
- Which campus counseling details go on the crisis screen? Need the real number before recording.

## Release

Tonight we ship one ask end to end, private and through a group chat; everything else is a TODO.

- **In the MVP:** the 7-screen ask flow, safety check, privacy scrub, GroupMe + Slack bot with mock fallback, claim page, "Covered" follow-up, seeded fictional helpers.
- **Not now:** database schema, real auth (school-email login), helper inbox and setup beyond the design, notifications, Slack buttons, payments of any kind.

## Tonight's plan

| By             | Milestone                                                                   |
| -------------- | --------------------------------------------------------------------------- |
| Fri 9:00 p.m.  | Starter repo running; Home → Your ask works with real AI                    |
| Fri 11:00 p.m. | Where to ask, Share preview, mock bot post end to end                       |
| Sat 1:00 a.m.  | Real GroupMe post + claim page + "Covered"; safety screens wired            |
| Overnight      | Agents: UI polish to match the design, tests, seed data, edge cases, README |
| Sat 8:00 a.m.  | Merge what works; dry-run the demo                                          |
| Sat 9:00 a.m.  | Record the video                                                            |
| Sat 10:00 a.m. | Submit                                                                      |

## Demo video (2–3 min)

1. **Hook:** a real story from one of us about not asking for help
2. **Problem and insight:** people would rather help than ask; group chats make asking harder
3. **Demo:** messy need → clarify → drafted ask → anonymous post with privacy check → bot posts in GroupMe → teammate claims → Covered → thank-you
4. **What could go wrong:** privacy, misuse, crisis, helper burnout, no money
5. **Close:** "AI can make asking easier. Only people can help."

## Judge Q&A

- **Doesn't GroupMe already do this?** For simple asks, yes. Ask is for the asks people won't post, and it reaches beyond your own circle.
- **Cold start?** It works with zero helpers, and the bot brings existing communities in.
- **What if people only take?** We never make you help before asking; newcomers have the least to give. Helping is small, and we invite people to pay it forward.
- **Why AI?** Turning an anxious, vague need into a clear ask and routing it is a language and judgment problem. The helping stays human.
- **Money?** Free for students; universities would fund it. We never sell data or take a cut.
