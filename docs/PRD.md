# Ask — Product Requirements Document

Oct 30, 2026 · Giselle · Status: Draft

> Source of truth: [Ask — Product Requirements Document](https://claude.ai/artifact/2qjYXodTL6zJQKQg8cFug6) (Claude Docs). This file is a copy for agents; if they differ, the doc wins.

## Summary

Ask is a mobile web app that helps college students, starting with international students, ask for help. The hard part of getting help isn't finding someone, it's asking. A student types a vague, awkward need; AI turns it into a clear, small ask with a fair price. They send it privately to matched helpers who are free at that time, or post it to the public board. A helper says yes, they meet up, and payment goes through Ask once the help is done.

**AI can make asking easier. Only people can help.** The AI never does the helping and never sends anything without the user's OK. The asker pays through Ask, and the helper is paid once the help is done.

## Team and key times

Three people, one owner per area so nobody blocks anyone.

| Role     | Owner   | Owns                                                                                                                                                                                                                                                                                                       |
| -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend  | Giselle | Shared types + seed data, a small Postgres store, email notifications, the AI functions, safety rules, matching, public board, mocked payment, server actions for asks, helper inbox and matches; then the group chat bot; calendar free/busy is seeded in mock helpers, no Google API; merges into `main` |
| Frontend | Yvonne  | Demo path first: Home → Your ask → public board → GroupMe claim page (with a mocked helper setup step), wired to the API; then the inbox and a "Pay $15" mock screen; mobile layout                                                                                                                        |
| Story    | Sophia  | User testing tonight (5–10 people), pitch + demo script, recording and submitting the video; also seed helper profiles, safety test examples, and the test GroupMe/Slack setup for the bot                                                                                                                 |

**Contract first:** in the first 30 minutes, agree on the shared types and mock data together; then backend and frontend build in parallel against mocks.

- Hack started Fri ~5:30 p.m.; no commits before kickoff
- **Submission: 2–3 min demo video by Sat 10:00 a.m.** via the hackathon form
- Winners announced ~11:00 a.m.
- Design prototype: the "Ask — Prototype" canvas (16 phone screens + laptop view, including price, mocked pay, public board and calendar settings)

## Background

Students hold back from asking for help, especially newcomers far from home. Research on time-banking networks found people are more willing to help than to ask: they bank credits from helping and rarely spend them ([Penn State](https://sciencedaily.com/releases/2016/07/160712110721.htm)). International students are about 15% of Dartmouth's Class of 2029 ([The Dartmouth](https://www.thedartmouth.com/article/2025/09/despite-tightened-visa-policies-all-international-members-of-the-class-of-2029-were-able-to-matriculate)), and many arrive with no car, no family nearby and no idea who to ask.

Group chats are today's workaround, and they fall short in four ways:

- **Public:** posting to hundreds of people is the scary part, so awkward asks never get posted
- **Split by community:** a country's WeChat group never reaches the senior with a car
- **Buried:** an unanswered ask disappears in 20 minutes
- **No memory:** the same questions come back every term

Campus gig apps (Dormzi, Taskloop, FavorIt) mostly stalled on cold start, and paid tasks can create visa risk for F-1 students, so helpers say whether they can accept payment. Ask focuses on the hard part, asking, and lets the asker choose: send it privately to a few people likely to say yes, or post it anonymously to the board.

**Fit with the hackathon.** "AI at 70: What must remain human?" asks every team who it's for, what could go wrong, and how it helps people rather than deciding for them. Ask's answer: the AI lowers the barrier to asking; the helping stays human.

## Objective and success metrics

Show, in a working demo, one awkward need becoming a clear ask that a real person accepts. We assume a community of helpers already exists (seeded profiles).

- [ ] A teammate types a messy need and gets a drafted ask, with a suggested price, in under 30 seconds
- [ ] The ask is posted anonymously to the public board, showing what the privacy check removed
- [ ] The bot posts the same $15 card to our test GroupMe after a tap; a teammate opens the link, completes a mocked helper setup ("I can accept payment" + payout account), claims it in their browser, and the board card shows "Already taken"
- [ ] The bot posts "Covered" in the GroupMe
- [ ] Matched shows a public meeting spot; a mocked "Pay $15" screen and a thank-you close the loop
- [ ] "Write my essay" is redirected; a crisis-type message shows professional resources and is never matched or posted
- [ ] Matching uses seeded free/busy and payment eligibility from mock helper profiles
- [ ] 5–10 people at the hackathon try it tonight; we quote what they say in the video
- [ ] Video recorded by 9:00 a.m., submitted before 10:00 a.m.

## Who it's for

We launch with international students as askers and upperclassman helpers as supply; the others come later.

| Segment                                       | Their job to be done                                          | Pain                                                 | Role          |
| --------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- | ------------- |
| International students                        | Rides at break, storage, first-time US systems (SSN, banking) | No car or family nearby; don't want to burden people | **Beachhead** |
| Helpers (upperclassmen, peer mentors, alumni) | Feel useful, meet people, earn a little, pay it forward       | Don't know who needs what; dread open-ended asks     | **Supply**    |
| Students between terms                        | Storage, sublets, rides at term boundaries                    | Tight timing; asks too specific for a listserv       | Later         |
| First-years and transfers                     | Learn how things work here                                    | No network yet                                       | Later         |

**Out of scope:** mental-health crises, which go to professionals, never peers.

## Value propositions

|                  | Askers                                                                                            | Helpers                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Who**          | An international student needing practical help                                                   | An upperclassman or alum who likes helping                                          |
| **Why**          | Get unstuck without feeling like a burden                                                         | Help in small ways that fit their week                                              |
| **What before**  | Hesitates for days, posts to 300 people, or doesn't ask                                           | Sees scattered asks, or none; vague asks feel like big commitments                  |
| **How**          | AI drafts a clear, small ask and picks who or where to ask; anonymous option with a privacy check | Gets only asks they said they'd enjoy, sized in minutes; sets a weekly limit        |
| **What after**   | Help arrives from a real person, often a new connection                                           | A thank-you note, a new connection, paid for their time if they opt in, no overload |
| **Alternatives** | Group chats, the international office, asking the same two friends                                | Formal mentoring programs, being the go-to friend                                   |

**Pitch line:** "The hard part of getting help isn't finding someone. It's asking. Ask helps you ask, then gets out of the way so people can help people."

## Solution

A mobile web app with two sides: askers write and send asks, helpers get matched asks in an inbox or browse the public board. One link, no app store.

_Diagram in the source doc: how an ask flows · safety first, then a private or group route._

Every ask is checked first; crisis and essay asks never reach a peer. A matched helper says yes or "not this time," and once the help is done the asker pays through Ask and writes their own thank-you.

### AI functions

Each is one small function with a simple prompt and a fallback if the API fails.

| Function     | Runs when           | Returns                                                                                                                      |
| ------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| safetyCheck  | First, on every ask | none, academic, crisis or sensitive                                                                                          |
| clarify      | After Home          | At most 2 questions with tappable options                                                                                    |
| draftAsk     | After Clarify       | A short, specific, time-bounded ask                                                                                          |
| matchHelpers | After the draft     | 2–3 helpers with a one-line why; checks calendar free/busy, respects weekly limits and payment eligibility, and spreads load |

### Helper side

- Helper profile: what they'd enjoy helping with (rides, moving stuff, US paperwork, cooking, language practice, course advice, been through OPT), when they're free, a weekly limit, and whether they can accept payment
- Helper inbox: matched asks sized in minutes with their price, and "I can help" or "Not this time" (no reason needed)
- The asker picks who to ask privately; contact info is shared only after both say yes
- Matched screen suggests a public meeting spot and a short message thread

### Payments

- The asker sets a price when drafting; AI suggests a fair range for the time needed, and $0 makes it a favor
- Payment goes through Stripe: the asker pays when a helper accepts, Stripe holds it, and it is released to the helper when **both** confirm the help is done
- If the asker doesn't respond, payment auto-releases 48 hours after the helper marks it done, unless the asker reports a problem; cancelled before the help → refund
- Helpers turn on "I can accept payment" and connect a payout account; paid asks only go to helpers who can
- Tonight: no Stripe API at all, just a mocked "Pay $15" screen. The hold-and-release design above needs Stripe Connect (helper onboarding, connected accounts, webhooks), which is days of work; we pitch it as the architecture. Later: Stripe Connect payouts and a small platform fee
- Visa note: F-1 students generally can't be paid for off-campus work, so the toggle keeps them from being offered paid asks. Not legal advice; we'll confirm with the international office.

### Public board

- Besides asking matched helpers privately, an asker can post to a public board inside Ask that every helper can see
- **One ask, one card:** an ask shared to a GroupMe by the bot is the same board card, and the GroupMe link opens that card, so it can't be taken twice
- Each card shows the ask, time needed and price; the first helper to tap "I can help" (from the board or a GroupMe link) holds it, the asker confirms, and everyone else sees "Already taken"
- Board posts are anonymous by default and go through the privacy check; crisis and sensitive asks (visa, money, health) can't be posted publicly
- Paid asks on the board show only to helpers who can accept payment; every ask expires at its deadline and leaves the board

### Calendar sync

- Helpers can connect Google Calendar; Ask reads free/busy only, never event titles, so matching suggests people who are actually free at the ask's time
- After a match, Ask offers to add the meetup to both calendars; nothing is added without a tap
- Optional: manual availability still works for anyone who doesn't connect
- Tonight: free/busy is seeded into the mock helper profiles; no Google API or OAuth

### Email notifications

Ask is a web app, so email is how people hear back when they're not looking at it.

- Helpers get an email when a matched ask arrives in their inbox
- Askers get an email when someone claims their ask, from the board or a GroupMe link
- Both get an email when the other side marks the help done, with a link to confirm
- Tonight: emails are logged to the console or sent with a simple email service if time allows

### Safety and privacy rules

- Nothing is sent, posted, paid or added to a calendar without an explicit tap
- "Write my essay" → redirect to tutoring, the writing center or an extension email, and never a paid or public ask
- Crisis-type asks → professional resources only (988 and campus counseling), never matched or posted
- Public board posts are anonymous by default and privacy-checked; sensitive asks stay private
- Contact info is shared only after both sides say yes
- Helpers set their own limits; no one gets flooded
- Stripe holds payment until both sides confirm the help is done (auto-release after 48 hours unless the asker reports a problem); paid asks never reach helpers who can't accept payment
- Calendar access is free/busy only
- Ratings after done (stars, tags, comment, optional tip on paid asks) and earned-only trust points (decided Oct 31). No streaks or leaderboards

### Stack

Next.js (App Router) + TypeScript + Tailwind; Anthropic SDK with the model set by `ANTHROPIC_MODEL`; a small Postgres database for asks and claims, so two phones see the same card in the demo; payments, calendar and school-email sign-up mocked tonight.

### Assumptions and open questions

- We assume an existing pool of helpers; the demo uses 15–20 seeded fictional profiles plus teammates.
- Will askers pay, and what prices feel fair for a ride or 20 minutes of help? Ask 5–10 people at the hackathon tonight.
- Can F-1 students accept payment through Ask in any form? Confirm with the international office before launch.
- Which campus counseling details go on the crisis screen? Need the real number before recording.

## Release

Tonight we ship one ask end to end: privately to matched helpers, on the public board, and through a group chat; everything else is a TODO.

**In the MVP:** the demo path (Home → Clarify → Your ask with a price → public board → bot posts to GroupMe → claim in the browser → Matched → mocked Pay + Thank you), safety check, matching on seeded helpers (with seeded free/busy), "Already taken" across board and GroupMe. The private inbox ships as a simple mock and is told in the story, not demoed.

**Not now:** the Stripe API and Stripe Connect (payment is a mock screen), the Google Calendar API and OAuth (free/busy is seeded), real Dartmouth SSO (accounts use a password plus school-email and phone codes), push notifications, an iOS app, reading group messages.

**Our differentiator: the group chat bot (built second).** It gets an ask into the right chat and reaches people beyond the asker's own circle, which also answers cold start. We build it only after the core flow works end to end.

- **Post-only by construction:** GroupMe bots post messages through GroupMe's bot API, and a bot only receives group messages if a callback URL is registered. We register none, so the bot never receives group messages ([GroupMe bot docs](https://dev.groupme.com/tutorials/bots)).
- **Permission:** a group member creates the bot for that group, ideally with the admin's OK. On joining, the bot posts a short intro: "I post asks from Ask. I can't read your messages. Remove me anytime." For the demo, our own test GroupMe covers this. Slack needs a workspace admin to approve the app.
- **No app download:** each post ends with a link to the ask's board card. Helpers tap it in GroupMe and finish in their browser: a quick account sign-up with their school email (mocked tonight), then, for a paid ask, the helper setup (can you accept payment, plus a payout account) so the payout and visa rules still hold. Tonight's demo uses a $15 ask in GroupMe, so the claim page shows the mocked helper setup before accepting.
- **Anonymous posts** go through a privacy check that shows what was removed, with Undo; after a claim the bot posts "Covered" and never names an anonymous asker.
- **Fallback for any other chat:** if a group hasn't added the bot, Ask offers Copy or the phone's share sheet so the user pastes the polished ask themselves. No bot permission needed, and it works in any group on day one.

### Tonight's plan

| By             | Milestone                                                                              |
| -------------- | -------------------------------------------------------------------------------------- |
| Fri 8:30 p.m.  | Shared types + seed helpers (with free/busy and payment eligibility) locked            |
| Fri 10:00 p.m. | Home → Your ask works with real AI, price suggestion and the safety check              |
| Fri 11:30 p.m. | Public board + matching end to end on seed data                                        |
| Sat 1:00 a.m.  | Bot posts the board card to our test GroupMe; claim page + "Already taken" + "Covered" |
| Sat 2:00 a.m.  | Matched, mocked "Pay $15", Thank you; safety screens wired — **demo path done**        |
| Overnight      | Agents: UI polish to match the design, tests, edge cases, inbox mock, README           |
| Sat 8:00 a.m.  | Merge what works; dry-run the demo                                                     |
| Sat 9:00 a.m.  | Record the video                                                                       |
| Sat 10:00 a.m. | Submit                                                                                 |

### Demo video (2–3 min)

1. Hook: a real story from one of us about not asking for help
2. Problem and insight: people would rather help than ask; group chats make asking harder
3. Demo, one path: messy need → clarify → drafted ask with a suggested $15 price → posted anonymously to the board → the bot shares the same card to GroupMe → a teammate opens the link, sets up as a helper who can accept payment, and claims it; the board shows "Already taken", the bot posts "Covered" → Matched → mocked "Pay $15" + thank-you
4. Told, not shown: the private route to matched helpers, calendar-aware matching, and the Stripe Connect escrow design
5. What could go wrong: privacy, misuse, crisis, helper burnout, payment and F-1 visa eligibility
6. Close: "AI can make asking easier. Only people can help."

### Judge Q&A

- **Doesn't GroupMe already do this?** For simple asks, yes. Ask is for the asks people won't post under their name. You choose: send it privately to a few people likely to say yes, or post it anonymously to the board.
- **Cold start?** We'd launch inside one community (the international students' association) with peer mentors as founding helpers; our post-only group chat bot brings existing communities in.
- **Why not read group chats?** Meta's Muse agent drew backlash in Sept 2026 after reading a user's private texts. Other people in a chat never consented, so Ask never reads them.
- **What if people only take?** We never make you help before asking; newcomers have the least to give. Helping is small, and we invite people to pay it forward.
- **Why AI?** Turning an anxious, vague need into a clear ask and finding the right person is a language and judgment problem. The helping stays human.
- **Money?** Askers pay through Ask, and helpers are paid after the help is done; Ask takes a small fee or is funded by universities. Helpers who can't accept payment (for example, many F-1 students) mark that and only see favors. We never sell data.
