# Rootline — Claude Code Project Brief

> "Every name. Every branch. Every story."
> A mobile family tree app that solves large-family name blindness.

---

## What this is

Rootline is a React Native (Expo) mobile app with a Node/Express API backend.
The core product is a **relationship engine** — a BFS graph traversal that takes
any two people in a family tree and returns the shortest relationship path plus
a human-readable label ("Your uncle", "Your first cousin once removed").

The brand uses the **Warm Earth palette** (#1C1008 bark, #B07D4A amber, #F7F0E6 cream)
with **Cormorant Garamond** for display and **DM Sans** for body text.

---

## Monorepo structure

```
rootline/
├── CLAUDE.md            ← you are here
├── packages/
│   ├── engine/          # Pure TypeScript relationship engine — NO framework deps
│   │   └── src/
│   │       ├── types.ts
│   │       ├── graph.ts     # buildAdjacency(), bfsPath(), getSiblings()
│   │       ├── labels.ts    # generateLabel() — [up,up,down] → "Your uncle"
│   │       ├── index.ts     # RelationshipEngine class (public API)
│   │       └── engine.test.ts  # 36 tests — keep all green
│   ├── api/             # Express REST API
│   │   └── src/
│   │       ├── index.ts
│   │       └── routes/relationships.ts
│   └── app/             # Expo Router React Native app
│       ├── app/
│       │   ├── _layout.tsx
│       │   ├── (tabs)/index.tsx    # Home feed
│       │   ├── (tabs)/tree.tsx     # SVG tree
│       │   └── member/[id].tsx     # Dynamic profile route
│       └── src/
│           ├── theme/index.ts      # ALL design tokens
│           ├── store/familyStore.ts
│           ├── hooks/useRelationship.ts
│           ├── screens/MemberProfileScreen.tsx
│           ├── components/TabIcon.tsx
│           └── lib/
│               ├── supabase.ts
│               ├── db.ts
│               └── schema.sql
```

---

## Essential commands

```bash
# Engine — run constantly, must stay green
cd packages/engine && npm test

# API
cd packages/api && npm run dev        # port 3001

# App
cd packages/app && npx expo start
cd packages/app && npx expo start --ios
cd packages/app && npx expo start --android
```

---

## Engine rules — read before touching graph.ts or labels.ts

1. **Only two edge types stored**: `parent` and `spouse`. Siblings/cousins are derived.
2. **Direction convention**: parent→child = `'down'`, child→parent = `'up'`, spouse = `'spouse'`
3. **Label pattern**: count ups-before-pivot (u) and downs-after-pivot (d)
   - [up] → father/mother | [up,up] → grandfather | [up,down] → brother/sister
   - [up,up,down] → uncle/aunt | [up,up,down,down] → first cousin
4. **BFS only** — guarantees shortest path = most natural label. Never DFS.
5. **Gender of TARGET** determines suffix (M/F/NB).
6. **RelationshipResult discriminated union** — always narrow with `if (!r.found) return`.

---

## Design system

```ts
// Colours — packages/app/src/theme/index.ts
bark:   '#1C1008'   // dark background
amber:  '#B07D4A'   // primary action
sand:   '#E8C99A'   // text on dark
cream:  '#F7F0E6'   // light background

// Fonts
'CormorantGaramond-Medium'  // display, names
'DMSans-Regular'            // body
'DMSans-Medium'             // buttons
'IBMPlexMono-Regular'       // mono/meta
```

---

## State management

Zustand store (`src/store/familyStore.ts`) is the single source of truth.
DB ops in `src/lib/db.ts` write to Supabase AND update the store immediately.
Never bypass the store in components.

```ts
const { graph, currentUserId } = useFamilyStore()
```

---

## Database (Supabase)

- `.env` keys: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Schema: run `packages/app/src/lib/schema.sql` once in Supabase SQL Editor
- Key function: `get_tree_graph(treeId)` returns full FamilyGraph JSON
- Realtime: `subscribeToTree(treeId)` syncs all members live

---

## What's built vs TODO

### ✅ Done
- Relationship engine (36 tests passing)
- BFS traversal + label generation (all relationship types)
- Birthday notification strings
- Express API routes
- Home feed, Tree view, Member profile screens
- Supabase schema + RLS + realtime
- Zustand store + design tokens

### 🔲 Next (in order)
1. Onboarding flow — `app/onboarding/`
2. Add member form (modal)
3. Invite/claim system
4. Family tab (all members, sorted by closeness)
5. Profile tab (edit own profile)
6. Push notifications (birthday reminders)
7. Real font files (replace stubs with @expo-google-fonts)

---

## Conventions

- TypeScript strict — no `any` without comment
- Functional components only
- `StyleSheet.create()` always — no inline style objects
- Named exports for components, default exports for page files only
- Engine functions are pure — no side effects, no async
- Never put business logic in components

---

## The one thing that must never break

```bash
cd packages/engine && npm test
# Must always see: Tests: 36 passed, 36 total
```

The relationship path explainer is the core product. Run tests before every push.
