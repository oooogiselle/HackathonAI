# Ask: Demo Video Script

About 2:55 · 1920×1080 · Owner: Sophia (story and video)

On screen the whole time: "Prototype · sample helpers · payment mocked"

Demo ask, used throughout: "Could someone with a car help me pick up a mini fridge in West Lebanon tomorrow, 4–5 p.m.? About 40 minutes. $15."

| # | Time | Screen | Narration |
| --- | --- | --- | --- |
| 1 | 0:00–0:15 | **Hook.** A teammate tells a real story to camera, or campus b-roll with their voice. | *(Replace with a real story.)* "My first term here, I needed a ride to pick something up. I knew people would probably help. I just couldn't bring myself to ask." |
| 2 | 0:15–0:35 | **Problem.** Simulated group chat, "Dartmouth '29 · 1,148 members". Mina's ask gets buried by 12 unrelated messages, then "20 minutes later · no replies". Labeled "Simulated chat · fictional names". | "Most of us would happily help a friend. Asking is the hard part, especially when you're new and far from home. Group chats make it harder: you're asking hundreds of people at once, and if no one answers, your message is buried in twenty minutes." |
| 3 | 0:35–0:55 | **Messy need.** Home: type "i bought a mini fridge off marketplace but i don't have a car and idk who to ask…", then tap through the two clarify questions. | "This is Ask. You just type what you need, however messy. Ask asks at most two quick questions, so you don't have to figure out what details matter." |
| 4 | 0:55–1:10 | **Draft + price.** The drafted ask appears; zoom in on the suggested $15. | "It turns that into a clear, small ask, with a time, a size, and a fair price it suggests. You can edit anything. Nothing goes out until you tap." |
| 5 | 1:10–1:25 | **Board + privacy check.** Post to board → privacy check shows what it removed, with Undo → anonymous card on the board. | "You can post it anonymously. Ask's privacy check shows exactly what it removed before anything is shared." |
| 6 | 1:25–1:40 | **GroupMe.** Share to GroupMe preview, then the real test GroupMe on a phone showing the bot's post. | "One more tap, and our bot posts the same card to a group chat. It only posts; it never reads the group's messages." |
| 7 | 1:40–2:00 | **Claim, two phones.** Helper opens the link → helper setup ("I can accept payment") → I can help. Asker's board card turns "Already taken"; asker confirms the helper; bot posts "Covered, thanks to whoever helped!" | "A student in that chat taps the link. No app to download. Because this ask is paid, they confirm they can accept payment first, so students on visas who can't are never offered paid asks. They claim it, and it's taken everywhere at once. The group sees it's covered, without ever learning who asked." |
| 8 | 2:00–2:15 | **Pay to hold + done.** Task page with a public meeting spot → mocked "Pay $17.28 and hold" ($15 + 10% fee + card processing) → helper taps Done → asker confirms → thank-you note. | "The asker pays through Ask, and the money is held until the help is done. They meet somewhere public. When both say it's done, the helper is paid, and the asker writes a thank-you in their own words." |
| 9 | 2:15–2:30 | **Told, not shown.** Three cards, each marked "Planned": Private matching · Calendar free/busy · Escrow via Stripe. | "You can also send an ask privately to two or three helpers who are free at that time. Payment is designed to be held by Stripe and released only when both sides confirm the help is done." |
| 10 | 2:30–2:45 | **What could go wrong.** "Write my essay" → redirect to the writing center; crisis message → 988 and campus counseling. | "We designed for what could go wrong. Ask won't turn academic dishonesty into a task. Anything that sounds like a crisis goes to professionals, never to peers. And helpers set weekly limits, so no one burns out. If anyone suggests paying outside Ask or asks for an ID number, Ask warns both of them." |
| 11 | 2:45–2:55 | **Close.** Ask logo, "AI can make asking easier. Only people can help." | "AI can make asking easier. Only people can help." |

## Before recording

- [ ] Deployed link, merged demo path on `dev`
- [ ] Team checks the sample "You're not the only one" tips and counts (`src/lib/ask/common-needs.ts`)
- [ ] `GROUPME_BOT_ID` set in Vercel; bot posts to the test GroupMe
- [ ] Demo ask priced at $15; the claim page shows the mocked helper setup
- [ ] Two identities (asker and helper) and a way to reset the ask
- [ ] Real Dartmouth counseling number on the crisis screen
- [ ] Hook story from a teammate
- [ ] Narration recorded per segment (`01-hook.m4a` … `11-close.m4a`)

## Claims to verify before using them anywhere

Checked Oct 31:

- Penn State time-banking research: confirmed ([EurekAlert](https://www.eurekalert.org/news-releases/645910)).
- "About 15% of Dartmouth's Class of 2029": confirmed ([The Dartmouth](https://www.thedartmouth.com/article/2025/09/despite-tightened-visa-policies-all-international-members-of-the-class-of-2029-were-able-to-matriculate)).
- Dormzi and Taskloop exist; "stalled" is not sourced and FavorIt could not be found. Say "earlier campus task apps like Dormzi and Taskloop" and don't claim they failed.
- Meta Muse: real, but disputed. Say "Meta's Muse agent was accused in September of reading a user's private texts (Meta disputes it)", not that it did ([TechCrunch](https://techcrunch.com/2026/09/30/meta-disputes-claim-that-muse-read-a-users-private-messages-without-permission/)).

