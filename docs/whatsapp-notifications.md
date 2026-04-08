# WhatsApp Notifications — Implementation Plan

Send a WhatsApp message to all users when a match is added or a score is submitted.
Uses the **Meta WhatsApp Cloud API free tier** (1,000 free conversations/month — more than enough for a private friend group).

---

## Prerequisites

- A [Meta Business Account](https://business.facebook.com/) (free)
- Your WhatsApp Business number registered and **not** linked to WhatsApp/WhatsApp Business app (Meta requires a clean number — you can use a virtual SIM or unlink your existing one)
- A Vercel deployment (already in place)

---

## Phase 1 — Meta / WhatsApp Setup (one-time, ~1 hour)

### Step 1 — Create a Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com/) → **My Apps** → **Create App**
2. Choose **Business** type
3. Link it to your Meta Business Account

### Step 2 — Add WhatsApp to the App

1. Inside the app dashboard → **Add Product** → **WhatsApp** → **Set Up**
2. Under **WhatsApp → Getting Started**, you'll see a test phone number provided by Meta (use this for testing first)
3. To use your own Business number: **WhatsApp → API Setup → Add phone number** → follow verification steps

### Step 3 — Get Your Credentials

From **WhatsApp → API Setup**, copy:

| Item | Where to find |
|------|--------------|
| `WHATSAPP_TOKEN` | Temporary token (use a **Permanent System User Token** for production — see Step 4) |
| `WHATSAPP_PHONE_ID` | The **Phone number ID** shown on the page (not the actual phone number) |

### Step 4 — Create a Permanent Token (important for Vercel)

1. **Meta Business Settings** → **System Users** → **Add** (name it `predictions-bot`, role: Employee)
2. Assign your WhatsApp app to this system user with **Manage** permission
3. **Generate New Token** → select your app → enable `whatsapp_business_messaging` and `whatsapp_business_management` scopes
4. Copy the generated token — this is your `WHATSAPP_TOKEN`

### Step 5 — Create and Submit Message Templates

You need pre-approved templates for any message you initiate. Submit two:

**Template 1 — Match Added** (name: `match_added`)
```
New match added! 🏟️

{{1}} vs {{2}}
Kickoff: {{3}}

Submit your prediction before the match starts.
```
Category: **Utility** | Language: **English**

**Template 2 — Score Submitted** (name: `score_submitted`)
```
Results are in! ⚽

{{1}} {{2}} – {{3}} {{4}}

Check the leaderboard to see your points.
```
Category: **Utility** | Language: **English**

> Templates are reviewed within a few minutes to a few hours.
> Path: **WhatsApp → Manage → Message Templates → Create Template**

---

## Phase 2 — Database Changes

### Step 6 — Add `phone` Field to User

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

### Step 7 — Populate Phone Numbers

Two options:
- **Admin UI**: add a phone number field to the Users management page so admin can fill in each user's number
- **Quick seed**: manually run a Prisma script or psql update to set phone numbers for existing users

Phone numbers must be in **E.164 format** (e.g., `+201012345678`).

---

## Phase 3 — Notification Service

### Step 8 — Add Env Vars

Add to `.env.local` and Vercel project settings:

```env
WHATSAPP_TOKEN=your_permanent_system_user_token
WHATSAPP_PHONE_ID=your_phone_number_id
```

### Step 9 — Create the Notification Service

Create [src/lib/whatsapp.ts](../src/lib/whatsapp.ts):

```typescript
const BASE_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

async function sendTemplate(
  to: string,
  templateName: string,
  components: { type: string; parameters: { type: string; text: string }[] }[]
) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(`[WhatsApp] Failed to send to ${to}:`, err);
  }
}

export async function notifyMatchAdded(
  phones: string[],
  homeTeam: string,
  awayTeam: string,
  kickoff: string
) {
  await Promise.allSettled(
    phones.map(phone =>
      sendTemplate(phone, 'match_added', [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: homeTeam },
            { type: 'text', text: awayTeam },
            { type: 'text', text: kickoff },
          ],
        },
      ])
    )
  );
}

export async function notifyScoreSubmitted(
  phones: string[],
  homeTeam: string,
  homeScore: string,
  awayTeam: string,
  awayScore: string
) {
  await Promise.allSettled(
    phones.map(phone =>
      sendTemplate(phone, 'score_submitted', [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: homeTeam },
            { type: 'text', text: homeScore },
            { type: 'text', text: awayTeam },
            { type: 'text', text: awayScore },
          ],
        },
      ])
    )
  );
}
```

---

## Phase 4 — Hook Into App Events

### Step 10 — Notify on Match Added

In [src/app/api/admin/matches/route.ts](../src/app/api/admin/matches/route.ts), after matches are successfully inserted into the DB, add:

```typescript
import { notifyMatchAdded } from '@/lib/whatsapp';
import { formatKickoff } from '@/lib/utils';

// After matches are created — inside the POST handler where new matches are inserted
const users = await prisma.user.findMany({
  where: { phone: { not: null } },
  select: { phone: true },
});
const phones = users.map(u => u.phone!);

// Notify once per newly inserted match
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

### Step 11 — Notify on Score Submitted

In [src/app/api/admin/results/route.ts](../src/app/api/admin/results/route.ts) (or wherever scores are saved — likely a `PATCH`/`PUT` route), after updating `resultHomeScore` and `resultAwayScore`:

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

## Phase 5 — User Opt-In (Required by Meta)

Meta requires users to **opt in** before you can message them. For a private friend group the simplest approach:

1. Ask each friend to send **any message** to your WhatsApp Business number once (this opens a 24-hour window)
2. For template messages (utility category), opt-in can be documented outside WhatsApp (e.g., "by joining the group you agree to receive match notifications") — Meta allows this for utility templates
3. Add a note in your app UI: *"To receive WhatsApp notifications, send a message to +XXXXXXXXXXXX"*

---

## Phase 6 — Testing Checklist

- [ ] Meta app created and WhatsApp product added
- [ ] Phone number verified and not linked to any WhatsApp app
- [ ] Permanent system user token generated with correct scopes
- [ ] Both message templates approved (check **WhatsApp → Manage → Templates** — status: `APPROVED`)
- [ ] `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` added to Vercel env vars
- [ ] Prisma migration run and `phone` column exists in `users` table
- [ ] At least one user has a phone number set in the DB
- [ ] Test with Meta's test number first before switching to your real Business number
- [ ] Trigger a match add from the admin panel → WhatsApp message received
- [ ] Submit a score from the admin panel → WhatsApp message received

---

## Cost Summary

| Item | Cost |
|------|------|
| Meta Developer Account | Free |
| WhatsApp Cloud API | Free up to 1,000 conversations/month |
| Template message approval | Free |
| Vercel hosting | Already in use |

**Total: $0/month** for any private group under ~100 users with daily activity.

---

## Limitations & Notes

- **24-hour window**: Free-form messages only work within 24h of a user's last message. Templates (what we're using) bypass this restriction.
- **Number restriction**: Your Business number cannot simultaneously be active in the WhatsApp or WhatsApp Business app. Unlink it there first, or use a dedicated virtual number.
- **Template re-use**: You can re-use the same template multiple times for different matches — just change the variable parameters each call.
- **Rate limits**: Meta allows ~80 messages/second on the free tier. Plenty for a friend group.
