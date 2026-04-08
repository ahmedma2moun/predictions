# GREEN-API WhatsApp Notifications — Implementation Plan

Send WhatsApp messages to all users when a match is added or a score is submitted.
Uses **GREEN-API** — a third-party WhatsApp gateway that works with a regular WhatsApp number (no Meta Business Account required).

---

## Pros & Cons vs Meta Official API

### Pros

| | Detail |
|---|---|
| **No Business account needed** | Works with any regular WhatsApp number |
| **No template approval** | Send free-form messages anytime, no waiting for Meta review |
| **Faster to set up** | ~15 minutes vs ~1 hour for the official Meta flow |
| **Free trial** | 3-month free trial included |
| **No 24h window restriction** | Can message freely without users needing to message first |

### Cons

| | Detail |
|---|---|
| **Unofficial / ToS risk** | Uses an unofficial WhatsApp bridge — Meta can ban the linked number at any time |
| **Not scalable** | Works through a linked phone that must stay connected (battery, internet, etc.) |
| **Paid after trial** | ~$15/month vs Meta official API which is free up to 1,000 messages/month |
| **Less reliable** | Third-party intermediary; outages and number bans are outside your control |
| **Privacy** | Messages route through GREEN-API servers, not Meta directly |
| **No official support** | If your number gets banned, there is no recourse |

---

## Prerequisites

- A GREEN-API account (free trial at green-api.com)
- A WhatsApp number to link (your personal number or a dedicated SIM)
- A Vercel deployment (already in place)

---

## Phase 1 — GREEN-API Setup (one-time, ~15 minutes)

### Step 1 — Create a GREEN-API Account

1. Go to `green-api.com` → **Sign Up**
2. Create a new **Instance**
3. From the instance dashboard, copy:
   - `idInstance` — your instance ID
   - `apiTokenInstance` — your API token

### Step 2 — Link Your WhatsApp Number

1. In the instance dashboard, click **Scan QR Code**
2. Open WhatsApp on your phone → **Linked Devices** → **Link a Device**
3. Scan the QR code shown in GREEN-API dashboard
4. The instance status should change to **Authorized**

> Keep the phone connected to the internet. If it disconnects long enough, the session may expire and need re-scanning.

---

## Phase 2 — Database Changes

### Step 3 — Add `phone` Field to User

In [prisma/schema.prisma](../prisma/schema.prisma), add the `phone` field to the `User` model:

```prisma
model User {
  id           Int           @id @default(autoincrement())
  name         String
  email        String        @unique
  password     String
  role         Role          @default(user)
  phone        String?       // WhatsApp number in E.164 format: +201012345678
  // ... rest of existing relations
}
```

Run the migration:

```bash
npx prisma migrate dev --name add_user_phone
```

### Step 4 — Populate Phone Numbers

Two options:
- **Admin UI**: add a phone number field to the Users management page so admin can fill in each user's number
- **Quick seed**: manually run a Prisma script or psql update to set phone numbers for existing users

Phone numbers must be in **E.164 format** (e.g., `+201012345678`).

---

## Phase 3 — Environment Variables

### Step 5 — Add Env Vars

Add to `.env.local` and Vercel project settings:

```env
GREEN_API_INSTANCE_ID=your_instance_id
GREEN_API_TOKEN=your_api_token
```

---

## Phase 4 — Notification Service

### Step 6 — Create the Notification Service

Create [src/lib/whatsapp.ts](../src/lib/whatsapp.ts):

```typescript
const BASE = `https://api.green-api.com/waInstance${process.env.GREEN_API_INSTANCE_ID}`;

async function sendMessage(phone: string, message: string) {
  // GREEN-API expects chatId format: 201012345678@c.us (no + prefix)
  const chatId = phone.replace('+', '') + '@c.us';

  const res = await fetch(`${BASE}/sendMessage/${process.env.GREEN_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(`[GREEN-API] Failed to send to ${phone}:`, err);
  }
}

export async function notifyMatchAdded(
  phones: string[],
  homeTeam: string,
  awayTeam: string,
  kickoff: string
) {
  const message = `New match added!\n\n${homeTeam} vs ${awayTeam}\nKickoff: ${kickoff}\n\nSubmit your prediction before the match starts.`;
  await Promise.allSettled(phones.map(phone => sendMessage(phone, message)));
}

export async function notifyScoreSubmitted(
  phones: string[],
  homeTeam: string,
  homeScore: string,
  awayTeam: string,
  awayScore: string
) {
  const message = `Results are in!\n\n${homeTeam} ${homeScore} \u2013 ${awayScore} ${awayTeam}\n\nCheck the leaderboard to see your points.`;
  await Promise.allSettled(phones.map(phone => sendMessage(phone, message)));
}
```

---

## Phase 5 — Hook Into App Events

### Step 7 — Notify on Match Added

In [src/app/api/admin/matches/route.ts](../src/app/api/admin/matches/route.ts), after matches are successfully inserted:

```typescript
import { notifyMatchAdded } from '@/lib/whatsapp';
import { formatKickoff } from '@/lib/utils';

// After matches are created — inside the POST handler
const users = await prisma.user.findMany({
  where: { phone: { not: null } },
  select: { phone: true },
});
const phones = users.map(u => u.phone!);

for (const match of newMatches) {
  await notifyMatchAdded(
    phones,
    match.homeTeamName,
    match.awayTeamName,
    formatKickoff(match.kickoffTime)
  );
}
```

> `newMatches` = the array of matches you just created (track which ones are actually new via `createMany` skip duplicates result or by comparing before/after counts).

### Step 8 — Notify on Score Submitted

In [src/app/api/admin/results/route.ts](../src/app/api/admin/results/route.ts), after updating scores:

```typescript
import { notifyScoreSubmitted } from '@/lib/whatsapp';

const users = await prisma.user.findMany({
  where: { phone: { not: null } },
  select: { phone: true },
});
const phones = users.map(u => u.phone!);

await notifyScoreSubmitted(
  phones,
  match.homeTeamName,
  String(resultHomeScore),
  match.awayTeamName,
  String(resultAwayScore)
);
```

---

## Phase 6 — Testing Checklist

- [ ] GREEN-API account created and instance set up
- [ ] WhatsApp number linked (instance status: Authorized)
- [ ] `GREEN_API_INSTANCE_ID` and `GREEN_API_TOKEN` added to `.env.local`
- [ ] `GREEN_API_INSTANCE_ID` and `GREEN_API_TOKEN` added to Vercel env vars
- [ ] Prisma migration run and `phone` column exists in `users` table
- [ ] At least one user has a phone number set in the DB
- [ ] Test by calling `sendMessage` directly in a local script first
- [ ] Trigger a match add from the admin panel → WhatsApp message received
- [ ] Submit a score from the admin panel → WhatsApp message received

---

## Cost Summary

| Item | Cost |
|------|------|
| GREEN-API account | Free (3-month trial) |
| GREEN-API after trial | ~$15/month |
| Vercel hosting | Already in use |

**Total: $0 for 3 months, then ~$15/month.**

---

## Limitations & Notes

- **ToS risk**: GREEN-API is an unofficial bridge. Meta can ban the linked WhatsApp number without warning. Not recommended for production-critical use.
- **Phone must stay online**: The linked phone needs to remain connected. Long disconnections may require re-scanning the QR code.
- **chatId format**: GREEN-API requires `201012345678@c.us` — strip the `+` from E.164 format and append `@c.us`.
- **Free-form messages**: Unlike the Meta official API, no template approval is needed — you can send any text.
- **Rate limits**: GREEN-API recommends not exceeding ~10 messages/second on the free tier. Fine for a small friend group.
