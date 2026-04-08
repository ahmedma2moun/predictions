# WhatsApp Notifications — CallMeBot Implementation Plan

Send a WhatsApp message to all users when a match is added or a score is submitted.
Uses **CallMeBot** — free, no Meta account, no business number, no template approval.

---

## How CallMeBot Works

1. Each user sends one opt-in message to CallMeBot on WhatsApp → they receive a personal API key back.
2. Your server sends a `GET` request per user using their key.
3. Messages arrive on the user's phone from CallMeBot's shared number.

**API endpoint:**
```
GET https://api.callmebot.com/whatsapp.php?phone=PHONE&text=MESSAGE&apikey=APIKEY
```

No auth token on your side — each user's `apikey` is the credential.

---

## Phase 1 — User Opt-In (one-time per user)

### Step 1 — Each User Registers with CallMeBot

Each friend must do this **once** from their own phone:

1. Add the number **+34 644 59 19 98** to WhatsApp contacts (name it anything, e.g. "CallMeBot").
2. Send the message: `I allow callmebot to send me messages`
3. They receive a reply containing their personal API key, e.g.: `Your WhatsApp number has been registered. ApiKey: 1234567`
4. They share that API key with the admin (via the app or directly).

> The admin then enters each user's phone + API key in the Users page.

---

## Phase 2 — Database Changes

### Step 2 — Add `phone` and `whatsappApiKey` to User

In [prisma/schema.prisma](../prisma/schema.prisma), add two optional fields to the `User` model:

```prisma
model User {
  id              Int           @id @default(autoincrement())
  name            String
  email           String        @unique
  password        String
  role            Role          @default(user)
  avatarUrl       String?
  phone           String?       // E.164 format: +201012345678
  whatsappApiKey  String?       // CallMeBot API key for this user
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  predictions     Prediction[]
  groupMembers    GroupMember[]
}
```

Run the migration:

```bash
npx prisma migrate dev --name add_user_whatsapp
```

---

## Phase 3 — Notification Service

### Step 3 — Create the Notification Service

Create [src/lib/whatsapp.ts](../src/lib/whatsapp.ts):

```typescript
type WhatsAppRecipient = { phone: string; whatsappApiKey: string };

async function sendMessage(recipient: WhatsAppRecipient, text: string) {
  const url = new URL('https://api.callmebot.com/whatsapp.php');
  url.searchParams.set('phone', recipient.phone);
  url.searchParams.set('text', text);
  url.searchParams.set('apikey', recipient.whatsappApiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error(`[WhatsApp] Failed to send to ${recipient.phone}: HTTP ${res.status}`);
  }
}

export async function notifyMatchAdded(
  recipients: WhatsAppRecipient[],
  homeTeam: string,
  awayTeam: string,
  kickoff: string
) {
  const text = `New match added! 🏟️\n\n${homeTeam} vs ${awayTeam}\nKickoff: ${kickoff}\n\nSubmit your prediction before the match starts.`;
  await Promise.allSettled(recipients.map(r => sendMessage(r, text)));
}

export async function notifyScoreSubmitted(
  recipients: WhatsAppRecipient[],
  homeTeam: string,
  homeScore: number,
  awayTeam: string,
  awayScore: number
) {
  const text = `Results are in! ⚽\n\n${homeTeam} ${homeScore} – ${awayScore} ${awayTeam}\n\nCheck the leaderboard to see your points.`;
  await Promise.allSettled(recipients.map(r => sendMessage(r, text)));
}
```

Key differences from the Meta plan:
- No `Authorization` header, no `WHATSAPP_TOKEN` env var needed.
- Free-form text — no template approval required.
- Recipients carry both `phone` + `whatsappApiKey`.

---

## Phase 4 — Admin UI Changes

### Step 4 — Add Phone + API Key Fields to Users Page

In [src/app/(app)/admin/users/page.tsx](../src/app/(app)/admin/users/page.tsx), extend the edit/create user form with two new fields:

- **WhatsApp Phone** — text input, placeholder `+201012345678`
- **CallMeBot API Key** — text input, placeholder `1234567`

Update the `PATCH` call to include `phone` and `whatsappApiKey` in the request body.

### Step 5 — Update the Users API

In [src/app/api/admin/users/route.ts](../src/app/api/admin/users/route.ts), update the `PATCH` handler to accept and save both fields:

```typescript
// Inside PATCH handler, alongside existing name/role/password handling:
if (phone !== undefined) data.phone = phone || null;
if (whatsappApiKey !== undefined) data.whatsappApiKey = whatsappApiKey || null;
```

Also update the `GET` handler's `select` to include `phone` and `whatsappApiKey` so the admin UI can display current values.

---

## Phase 5 — Hook Into App Events

### Step 6 — Notify on Match Added

In [src/app/api/admin/matches/route.ts](../src/app/api/admin/matches/route.ts), after `createMany()` inserts new matches, add the notification call.

The right place is after the `inserted += toCreate.length` block inside the `fetch` / `fetch-month` action:

```typescript
import { notifyMatchAdded } from '@/lib/whatsapp';
import { formatKickoff } from '@/lib/utils';

// After createMany — still inside the league loop
if (toCreate.length > 0) {
  // ... existing createMany call ...

  const recipients = await prisma.user.findMany({
    where: { phone: { not: null }, whatsappApiKey: { not: null } },
    select: { phone: true, whatsappApiKey: true },
  });
  const rList = recipients.map(u => ({ phone: u.phone!, whatsappApiKey: u.whatsappApiKey! }));

  for (const f of toCreate) {
    await notifyMatchAdded(
      rList,
      f.teams.home.name,
      f.teams.away.name,
      formatKickoff(new Date(f.fixture.date))
    );
  }
}
```

> This fires once per newly inserted match (not per existing/skipped one).

### Step 7 — Notify on Score Submitted

The score submission happens inside the `fetch-results` action in the same [matches/route.ts](../src/app/api/admin/matches/route.ts), after `scoresProcessed` is set to `true`.

Add the notification after `await prisma.match.update({ ..., data: { scoresProcessed: true } })`:

```typescript
import { notifyScoreSubmitted } from '@/lib/whatsapp';

// After scoresProcessed = true update, still inside the match loop:
const recipients = await prisma.user.findMany({
  where: { phone: { not: null }, whatsappApiKey: { not: null } },
  select: { phone: true, whatsappApiKey: true },
});
const rList = recipients.map(u => ({ phone: u.phone!, whatsappApiKey: u.whatsappApiKey! }));

await notifyScoreSubmitted(
  rList,
  match.homeTeamName,
  homeScore,
  match.awayTeamName,
  awayScore
);
```

> Move the `findMany` for recipients outside the match loop if multiple matches are processed at once — one DB query per batch, not per match.

---

## Phase 6 — Testing Checklist

- [ ] Prisma migration run — `phone` and `whatsappApiKey` columns exist in `users` table
- [ ] One test user has sent the opt-in message to CallMeBot and received their API key
- [ ] Admin entered the test user's phone + API key via the Users admin page
- [ ] Triggered a match fetch from the admin panel → WhatsApp message received
- [ ] Triggered a results fetch → WhatsApp message received with the correct score
- [ ] Verified that users with `null` phone or `null` whatsappApiKey are silently skipped

---

## Cost & Limitations Summary

| Item | Detail |
|------|--------|
| Cost | Free |
| Account required | None (no Meta, no API key on your side) |
| Template approval | Not required — send any text |
| Sender number | CallMeBot's shared number (not yours) |
| Rate limit | ~1 message/second per recipient — fine for a friend group |
| Opt-in | Required once per user (WhatsApp message to CallMeBot) |
| Message direction | Server → user only (cannot receive replies) |

---

## Compared to the Meta Plan

| | Meta Cloud API | CallMeBot |
|---|---|---|
| Setup time | ~1 hour | ~5 minutes |
| Business account | Required | Not required |
| Dedicated number | Required | Not required |
| Template approval | Required | Not required |
| Per-user API key | No | Yes |
| Sender identity | Your number | CallMeBot shared number |
| Cost | Free (1k/mo) | Free |
