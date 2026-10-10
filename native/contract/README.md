# Contract fixtures

`fixtures/*.json` is the shared definition of the `/api/mobile/*` wire format for both native apps.
The iOS (`native/ios/FootballPredictionsTests`) and Android (`native/android/app/src/test`) test suites decode
**every** file here into their DTOs; a fixture without a decoding test fails the suite.

## Provenance

The initial set was derived from `mobile/src/types/api.ts`, `src/lib/game/types.ts` and the route handlers in
`src/app/api/mobile/**` (no live capture was possible without credentials). Re-capture with a **test account**
when convenient:

```sh
TOKEN=$(curl -s -X POST $BASE/api/mobile/auth/login -H 'content-type: application/json' \
  -d '{"email":"<test>","password":"<pw>"}' | jq -r .token)
curl -s $BASE/api/mobile/matches?status=scheduled -H "authorization: Bearer $TOKEN" | jq . > fixtures/matches-list.json
```

Scrub tokens, emails and any real names before committing.

## Rules

- IDs are strings on the wire **except** the Club/Slip/Reminders payloads, which use numeric ids (see `game-hub.json`, `slip.json`, `reminders.json`).
- When an API response changes: update the fixture here, then the DTO on **both** platforms, then the web frontend.
