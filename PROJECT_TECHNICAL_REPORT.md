# Pawnsposes Project Technical Report

This report reflects the current implementation in the repository as it exists today. It is intended for another developer or AI to understand the project without reading the entire repository.

---

## 1. PRODUCT OVERVIEW

### What the product currently does
This is a chess improvement / player dashboard application focused on:
- importing a player’s games from Lichess and Chess.com
- analyzing game archives and generating personality / performance reports
- showing player performance metrics and recent games on a dashboard
- tracking recurring tactical and positional weaknesses
- generating puzzle/training flows from the user’s own games and external puzzle data
- reviewing games with board visualization and analysis

### Main user types / roles
The application defines the following role values:
- child
- parent
- coach
- admin

These are declared in the TypeScript model, but the current implementation mostly enforces user ownership rather than role-based route control.

### Main features already implemented
- Firebase email/password authentication and Google sign-in
- protected routes and redirect logic
- user profile sync into Firestore
- Lichess and Chess.com game import via PGN APIs
- report generation from imported chess games
- student dashboard with synced ratings, game record, and summary cards
- game review with board display and evaluation data
- puzzle trainer experience, including weakness-based puzzles
- puzzle progress tracking and streaks
- local cache + Firestore sync
- avatar upload to Firebase Storage
- Stockfish integration for engine-based analysis

### Main user flow
1. User signs up or logs in.
2. They connect a chess username on Lichess or Chess.com.
3. The app imports their recent or full game history.
4. The profile is stored under the authenticated user.
5. The dashboard loads the profile, stats, and games.
6. The user can:
   - open a report
   - review games
   - run puzzle/training flows
   - inspect weaknesses and analysis
7. Data is persisted in Firestore and optionally cached locally.

---

## 2. COMPLETE TECH STACK

### Frontend
- Framework: React 19 with Create React App / react-scripts
- Language: TypeScript
- Styling: Tailwind CSS
- UI/component libraries:
  - Radix UI primitives (dialog, dropdown, tabs, toast)
  - custom UI wrappers under `src/components/ui`
  - Lucide React icons
- State management:
  - React component state
  - React Context for auth and theme
  - no Redux / Zustand / React Query store is present
- Routing:
  - React Router v7
- Chess-related libraries:
  - `chess.js`
  - `react-chessboard`
  - `@chrisoakman/chessboardjs`
  - `stockfish` worker from `public/stockfish.js`
- Other important packages:
  - `firebase`
  - `@google/generative-ai`
  - `html2canvas`, `html2pdf.js`, `jsPDF`
  - `@react-pdf/renderer`
  - `clsx`, `tailwind-merge`, `class-variance-authority`

### Backend
The repo does not contain a real backend implementation.
- no Next.js API routes
- no Node/Express server
- no separate backend folder
- no Firebase Cloud Functions folder
- no backend service in this repo

What actually exists:
- direct Firebase client SDK usage in the frontend
- external REST calls to Lichess and Chess.com from browser code
- a legacy `api.ts` stub, but it is not the active architecture of the current app

### Firebase
The codebase uses:
- Firebase Authentication: yes
- Firestore: yes
- Realtime Database: no evidence of use
- Firebase Storage: yes, for avatars
- Cloud Functions: no
- Firebase Hosting: not present in the repo config
- Firebase Admin SDK: no evidence
- Security Rules: yes
- Additional Firebase services: none beyond Auth, Firestore, Storage

> No secret keys, tokens, or credentials are included in this report.

---

## 3. PROJECT FOLDER STRUCTURE

```text
project/
├── src/
│   ├── App.tsx
│   ├── index.css
│   ├── index.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── GameImport.tsx
│   │   ├── GameViewer.tsx
│   │   ├── GamesList.tsx
│   │   ├── Navbar.tsx
│   │   ├── PuzzleTrainer.tsx
│   │   ├── ReportPopup.tsx
│   │   ├── ReportGenerator.tsx
│   │   └── ...
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── hooks/
│   │   ├── useChessboardInteraction.ts
│   │   ├── useChessSounds.ts
│   │   └── useAsync.ts
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── GameAnalysisPage.tsx
│   │   ├── GameReviewPage.tsx
│   │   ├── PuzzlesPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── ...
│   ├── services/
│   │   ├── firebase.ts
│   │   ├── profileAnalysisService.ts
│   │   ├── userDataService.ts
│   │   ├── userProfileService.ts
│   │   ├── gameImport.ts
│   │   ├── reportService.ts
│   │   ├── puzzleService.ts
│   │   ├── weaknessPuzzleService.ts
│   │   ├── stockfishService.ts
│   │   └── ...
│   ├── types/
│   │   ├── game.ts
│   │   ├── report.ts
│   │   ├── profileAnalysis.ts
│   │   ├── userData.ts
│   │   └── puzzle.ts
│   └── utils/
│       ├── fenExtractor.ts
│       ├── gameReviewAnalysis.ts
│       ├── chessboardTheme.ts
│       ├── opponentStats.ts
│       └── ...
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── stockfish.js
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── README.md
└── ...
```

### Folder purposes
- `src/pages`: page-level screens like dashboard, report, puzzles, profile, register
- `src/components`: reusable UI and chess analysis widgets
- `src/services`: external integrations and business logic
- `src/contexts`: global auth and theme providers
- `src/hooks`: board interaction and audio helpers
- `src/types`: TypeScript interfaces and schema objects
- `src/utils`: chess parsing, evaluation, and positional utilities
- `public`: static files and the Stockfish worker
- `firebase.json`: Firebase configuration
- `firestore.rules`: Firestore permissions
- `storage.rules`: Storage permissions

---

## 4. FIREBASE ARCHITECTURE

### Firebase initialization
The app initializes Firebase in `src/services/firebase.ts`:

```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

### Client SDK usage
- Auth: `src/contexts/AuthContext.tsx`
- Firestore: `src/services/profileAnalysisService.ts`, `src/services/userDataService.ts`, `src/services/userProfileService.ts`
- Storage: `src/services/userDataService.ts`

### Admin SDK usage
There is no Admin SDK in this repo.

### Authentication flow
The app handles:
- email/password sign-in
- Google OAuth sign-in
- `onAuthStateChanged` listener
- auth token stored in `localStorage` as `authToken`

After login:
- user profile is synced via `userProfileService.ensureProfile`
- the user doc is upserted under `users/{uid}`
- a local cache is used as immediate fallback if Firestore is slow or unavailable

### Database access flow
Typical pattern:

`React component -> service layer -> Firestore / Storage -> UI state`

Examples:
- `DashboardPage` loads profile and stats through `profileAnalysisService`
- `PuzzlesPage` loads analysis context through `userDataService`
- `AuthContext` syncs the user document using `userProfileService`

### Storage usage
Used for:
- avatar images only
- path pattern: `avatars/{userId}.jpg`
- rules allow owners to upload and delete their own avatar

### Cloud Functions usage
No Cloud Functions are used or present.

### Security rules
The app uses Firestore and Storage rules in:
- `firestore.rules`
- `storage.rules`

These rules are owner-based and identity-based, not role-based.

---

## 5. CURRENT DATABASE STRUCTURE

### `users/{userId}`
Purpose:
- user profile
- preferences
- basic identity and metadata

Fields:
- `id`
- `email`
- `displayName`
- `role`
- `isPremium`
- `avatarUrl`
- `preferences`
- `createdAt`
- `updatedAt`

Relationships:
- root identity object for every user
- parent of all user-private subcollections

Reads:
- auth/user profile sync
- dashboard and profile screens

Writes:
- `userProfileService.saveProfile`
- `AuthContext` profile sync

### `users/{userId}/analysis/profile`
Purpose:
- profile metadata for chess analysis
- references a report and game archive

Fields:
- `userId`
- `platform`
- `username`
- `gameLimit`
- `syncAllGames`
- `rated`
- `analyzedGameIds`
- `reportId`
- `gamesCount`
- `lastCheckedAt`
- `lastAnalyzedAt`
- `updatedAt`

Relationships:
- one profile document per user
- linked to `users/{userId}/games/{gameId}`
- report is stored in a separate report doc

Reads:
- dashboard, profile analysis service

Writes:
- `profileAnalysisService.saveProfile`

### `users/{userId}/games/{gameId}`
Purpose:
- imported chess games for the user

Fields:
- `id`
- `pgn`
- `white`
- `black`
- `result`
- `timeControl`
- `opening`
- `date`
- `site`
- `url`
- `moves`
- `analyzed`

Relationships:
- linked to the user’s profile and dashboard
- used heavily in report generation and review flows

Reads:
- dashboard, game review, profile analysis

Writes:
- `profileAnalysisService.writeGamesSubcollection`

### `users/{userId}/reports/{reportId}`
Purpose:
- saved chess report documents

Fields:
- `id`
- `userId`
- `username`
- `platform`
- `gameCount`
- `generatedAt`
- `executiveSummary`
- `recurringWeaknesses`
- `openingAnalysis`
- `middleGameAnalysis`
- `endgameAnalysis`
- `improvementPlan`
- `scoutIntel`
- `rawGameData`

Reads:
- dashboard
- reports page
- profile review pages

Writes:
- `userDataService.saveReport`
- `profileAnalysisService.saveProfile`

### `users/{userId}/opponentReports/{reportId}`
Purpose:
- saved opponent reports / scouting intel

Fields:
- similar to report objects, sometimes opponent-specific

Reads:
- userDataService and opponent report UI

Writes:
- `userDataService.saveOpponentReports`

### `users/{userId}/gameAnalyses/{analysisId}`
Purpose:
- compact summary of recent game analysis

Fields:
- `gameId`
- `moves`
- `whiteAccuracy`
- `blackAccuracy`
- `totalMistakes`
- `openingEvaluation`
- `criticalMoments`
- `analyzedAt`
- `engineUsed`
- `depth`

Reads:
- puzzle page for training context

Writes:
- `userDataService.saveGameAnalyses`

### `users/{userId}/gameReviews/{gameId}`
Purpose:
- detailed review analysis for one game

Fields:
- `gameId`
- `userId`
- `depth`
- `analyzedAt`
- `whiteAccuracy`
- `blackAccuracy`
- `analysis`

Reads:
- game review features

Writes:
- `userDataService.saveGameReview`

### `users/{userId}/puzzleProgress/stats`
Purpose:
- aggregate puzzle status for a user

Fields:
- `userId`
- `solved`
- `failed`
- `streak`
- `bestStreak`
- `lastCategory`
- `targetRating`
- `byCategory`
- `updatedAt`

Reads:
- `PuzzleTrainer` loads this on startup

Writes:
- `userDataService.savePuzzleProgress`

### `users/{userId}/puzzleHistory/{entryId}`
Purpose:
- record of individual puzzle attempts

Fields:
- `id`
- `userId`
- `puzzleId`
- `category`
- `rating`
- `solved`
- `streakAfter`
- `createdAt`

Writes:
- `userDataService.recordPuzzleAttempt`

### `users/{userId}/stats/current`
Purpose:
- compact summary of dashboard stats

Fields:
- `userId`
- `platform`
- `username`
- `ratings`
- `wins`
- `losses`
- `draws`
- `winRate`
- `gamesCount`
- `averageAccuracy`
- `lastReportId`
- `updatedAt`

Writes:
- `userDataService.saveStats`

### `chessAccounts/{platform_username}`
Purpose:
- prevent duplicate account ownership across users

Fields:
- `userId`
- `platform`
- `username`
- `updatedAt`

Reads:
- registration workflow checks this to see whether a chess username is already taken

Writes:
- `profileAnalysisService.saveProfile`

---

## 6. USER ROLES AND AUTHORIZATION

### Roles
The app supports:
- child
- parent
- coach
- admin

This is defined in `src/types/index.ts` and appears in `RegisterPage`.

### How users sign in
- email/password via Firebase Auth
- Google OAuth via `GoogleAuthProvider`
- `onAuthStateChanged` is used to track user presence

### Where role is stored
- in the Firestore user document under `users/{uid}`
- also in the local app state

### How protected routes work
The route guards in `src/App.tsx`:
- `ProtectedRoute` checks `currentUser`
- `PublicRoute` redirects logged-in users away from login/register pages

### How permissions are enforced
Current enforcement is:
- frontend route gating by authentication state
- Firestore owner-only rules via `users/{userId}`

There is no strong role-based authorization layer such as:
- teacher across student sets
- coach access to a cohort
- admin management panels

The rules do not reference role values, they only enforce user ownership.

---

## 7. STUDENT DASHBOARD

### Route/path
- `/dashboard`

### Main component
- `src/pages/DashboardPage.tsx`

### Features currently displayed
- profile avatar and identity
- connect chess account form
- live ratings cards
- game count and win/draw/loss summary
- recent games list
- refresh analysis button
- report popup and report generation flow

### How student data is fetched
The dashboard loads:
- `profileAnalysisService.loadProfile(currentUser?.id)`
- live ratings from Lichess / Chess.com APIs
- then saves aggregated stats via `userDataService.saveStats`

### Which Firebase collections it uses
- `users/{userId}`
- `users/{userId}/analysis/profile`
- `users/{userId}/games`
- `users/{userId}/reports`
- `users/{userId}/stats/current`

### Existing progress / analytics system
The dashboard stores:
- ratings
- total games
- win/loss/draw results
- win rate
- last report id
- average accuracy

This is saved via `PlayerStatsSnapshot`.

### Where a new “Practice Puzzles” feature would naturally fit
The natural home for it is:
- `src/pages/PuzzlesPage.tsx`
- `src/components/PuzzleTrainer.tsx`

This is already the training/puzzle module and includes puzzle-progress tracking.

---

## 8. CHESS FUNCTIONALITY

### Existing chessboard library
The project already uses:
- `chess.js`
- `react-chessboard`

Evidence:
- `src/components/PuzzleTrainer.tsx`
- `src/pages/GameReviewPage.tsx`
- `src/pages/OpponentPracticePage.tsx`
- `src/hooks/useChessboardInteraction.ts`

### Existing chess.js usage
It is used to:
- create board states
- generate legal moves
- validate move legality
- work with FEN states
- manage puzzle move checking

### How board positions are represented
Board state is represented mainly as:
- FEN strings
- chess.js board objects
- PGN text for imported games

### How moves are validated
Validation relies on `chess.js` and board interaction logic in:
- `src/hooks/useChessboardInteraction.ts`
- `src/components/PuzzleTrainer.tsx`

### Whether FEN is already used
Yes, extensively.
Examples:
- `src/utils/fenExtractor.ts`
- `src/utils/gameReviewAnalysis.ts`
- puzzle start positions
- board/position analysis

### Whether PGN is already used
Yes, heavily.
Examples:
- import of user game archives in `src/services/gameImport.ts`
- PGN parsing and move extraction
- game metadata and review logic

### Existing game / puzzle components that could be reused
- `src/components/PuzzleTrainer.tsx`
- `src/pages/PuzzlesPage.tsx`
- `src/pages/GameReviewPage.tsx`
- `src/components/GameViewer.tsx`
- `src/hooks/useChessboardInteraction.ts`
- `src/services/puzzleService.ts`
- `src/services/weaknessPuzzleService.ts`

These are the main existing components relevant to a future puzzle system.

---

## 9. DATA FETCHING PATTERN

The app uses:

`Component -> service layer -> Firestore / external API -> UI state`

### Important services
- `src/services/profileAnalysisService.ts`
- `src/services/userDataService.ts`
- `src/services/userProfileService.ts`
- `src/services/gameImport.ts`
- `src/services/reportService.ts`
- `src/services/puzzleService.ts`
- `src/services/weaknessPuzzleService.ts`

### Important hooks
- `src/hooks/useChessboardInteraction.ts`
- `src/hooks/useAsync.ts`
- `src/contexts/AuthContext.tsx`

### Context providers
- `src/contexts/AuthContext.tsx`
- `src/contexts/ThemeContext.tsx`

### Utilities
- `src/utils/fenExtractor.ts`
- `src/utils/gameReviewAnalysis.ts`
- `src/utils/opponentStats.ts`
- `src/utils/reportStats.ts`

The app does not use a formal repository layer; it uses service objects and utility helpers.

---

## 10. CURRENT DATA WRITE PATTERN

Typical flow:

`Student action -> React component -> service function -> Firestore -> UI update`

Examples:
- user profile updates go through `AuthContext` and `userProfileService`
- report generation saves under `users/{uid}/reports`
- puzzle progress writes to `users/{uid}/puzzleProgress/stats`
- large game analysis writes use `writeBatch`

### Write methods used
- `setDoc`
- `writeBatch`
- `deleteDoc`
- `getDoc` / `getDocs`
- `merge: true` writes are common

### Realtime listeners
No broad use of `onSnapshot` was found in the current implementation. Data access is mostly on-demand with local caching.

---

## 11. FIREBASE SECURITY

### Firestore rules
The current rules in `firestore.rules` permit:
- owner-only access to `users/{userId}` and its subcollections
- no delete for the root user document
- `chessAccounts/{accountId}` access is restricted to the owning user for updates/deletes, but read is allowed for any signed-in user

### What students can read/write
Students can:
- read and update their own user profile
- read/write their own reports, stats, games, puzzle progress, and review data

### What teachers/admins can read/write
No role-based teacher/admin rules are implemented.

### Security concerns relevant to adding puzzles
If puzzle content is stored under a user-owned doc, it will be safe by default.
If shared puzzle content is introduced, you will need explicit rules for:
- shared public / team / topic collections
- write permissions for admin or content-curation roles

---

## 12. EXISTING PROGRESS / ANALYTICS SYSTEM

The project already stores:
- student progress
- scores
- attempts
- activity timestamps
- completion / sync state
- accuracy
- streaks
- topic/category progress

### Existing schema
From `src/types/userData.ts`:

```ts
export interface PuzzleProgress {
  userId: string;
  solved: number;
  failed: number;
  streak: number;
  bestStreak: number;
  lastCategory: PuzzleTrainingCategory | null;
  targetRating: number | null;
  byCategory?: Partial<Record<PuzzleTrainingCategory, number>>;
  updatedAt: string;
}
```

```ts
export interface PuzzleHistoryEntry {
  id: string;
  userId: string;
  puzzleId: string;
  category: PuzzleTrainingCategory | null;
  rating: number | null;
  solved: boolean;
  streakAfter: number;
  createdAt: string;
}
```

This is the closest reusable foundation for a future puzzle progress system.

---

## 13. DEPENDENCIES RELEVANT TO PUZZLE FEATURE

From `package.json`:

- chessboard rendering:
  - `react-chessboard`
  - `@chrisoakman/chessboardjs`
- chess move validation:
  - `chess.js`
- PGN parsing:
  - custom parsing exists in `src/services/gameImport.ts`
  - no dedicated PGN package is clearly central to the app
- FEN handling:
  - `chess.js`
  - `src/utils/fenExtractor.ts`
- Firebase:
  - `firebase`
- state management:
  - React Context only

---

## 14. LICHESS INTEGRATION CHECK

### Existing Lichess usage
The repository already calls Lichess APIs in:
- `src/services/gameImport.ts`
- `src/services/puzzleService.ts`
- `src/services/weaknessPuzzleService.ts`
- `src/pages/DashboardPage.tsx`

Examples include:
- `/api/games/user/{username}`
- `/api/user/{username}`
- puzzle rating queries
- PGN import of game archives

### What does not exist
- Lichess Study import pipeline
- Study ID handling
- Lichess iframe embed
- direct “study-to-puzzle” import flow in the app

There is a legacy API stub mentioning a Lichess study creation endpoint, but it is not the active architecture in the current repo.

---

## 15. BEST INTEGRATION POINTS

### Lichess Study
Not currently implemented.
Best current parser/import area:
- `src/services/gameImport.ts`

### PGN / FEN importer
Best current handling:
- `src/services/gameImport.ts`
- `src/utils/fenExtractor.ts`
- `src/utils/gameReviewAnalysis.ts`

### Firebase layer for puzzle storage
Best current targets:
- `src/services/userDataService.ts`
- `src/services/profileAnalysisService.ts`

### Student dashboard
Best fit:
- `src/pages/DashboardPage.tsx`
- `src/pages/PuzzlesPage.tsx`

### Interactive chessboard
Best fit:
- `src/components/PuzzleTrainer.tsx`
- `src/hooks/useChessboardInteraction.ts`
- `src/pages/GameReviewPage.tsx`

### Move validation
Best fit:
- `chess.js`
- `src/hooks/useChessboardInteraction.ts`
- `src/components/PuzzleTrainer.tsx`

### Student progress tracking
Best current schema:
- `src/types/userData.ts`
- `src/services/userDataService.ts`

This is the most reusable data model already present.

---

## 16. FILES LIKELY TO BE INVOLVED

| File | Current purpose | Why it may matter for puzzle system |
|---|---|---|
| `src/pages/PuzzlesPage.tsx` | Puzzle page | Natural entry point for topic-wise puzzle flows |
| `src/components/PuzzleTrainer.tsx` | Interactive trainer UI | Directly relevant to solving and validation |
| `src/services/puzzleService.ts` | Puzzle selection logic | Current puzzle orchestration layer |
| `src/services/weaknessPuzzleService.ts` | Mine puzzle candidates from games | Closest existing problem-extraction flow |
| `src/services/gameImport.ts` | Parse PGN and import games | Relevant to Lichess Study / PGN import |
| `src/utils/fenExtractor.ts` | Extract FEN positions | Useful for starting positions |
| `src/utils/gameReviewAnalysis.ts` | Analyze moves and timing | Supports move evaluation and hints |
| `src/services/stockfishService.ts` | Engine evaluation | Useful for answer checking and hints |
| `src/services/userDataService.ts` | Firestore persistence | Best location for puzzle progress/history storage |
| `src/types/userData.ts` | Progress schema | Existing progress model to reuse |
| `src/types/puzzle.ts` | Puzzle model | Current puzzle type definitions |
| `src/services/firebase.ts` | Firebase setup | Needed for new puzzle collections |
| `src/contexts/AuthContext.tsx` | Auth and user sync | Needed for user-scoped puzzle progress |
| `src/pages/DashboardPage.tsx` | Student dashboard | Placement for puzzle cards and activity |
| `firestore.rules` | Security rules | Required for new puzzle collections |

---

## 17. MISSING PIECES

Based only on the current codebase, the following do not exist for a complete puzzle system:

- topic-wise puzzle collection in Firestore
- Lichess Study import pipeline
- real PGN/FEN importer for custom study content
- shared puzzle library model
- topic taxonomy / curriculum mapping
- puzzle metadata schema for topic, lesson, difficulty, tags, source, solution path
- interactive puzzle validation tied to stored solutions
- per-user puzzle answer tracking beyond generic history
- teacher/coach assignment model
- end-to-end import from Lichess study to Firebase to dashboard

What does exist instead:
- generic puzzle trainer UI
- puzzle progress schema
- chessboard interaction and move validation primitives
- engine-based analysis
- user-scoped data persistence

---

## 18. FINAL ARCHITECTURE SUMMARY

### Current application architecture
```text
Student Browser
      ↓
React SPA
      ↓
Firebase Auth
      ↓
Firestore + Storage
      ↓
User profiles / reports / games / puzzle progress / stats
      ↓
Dashboard / reports / puzzle trainer / game review
```

### Future puzzle integration points
```text
Lichess Study
      ↓
PGN / FEN importer
      ↓
existing Firebase service layer
      ↓
future puzzle / topic collections
      ↓
existing student dashboard + puzzle trainer
      ↓
interactive chessboard + move validation + progress tracking
```

This is the practical connection path based on current code.

---

## 19. IMPORTANT FILE CONTENT FOR NEXT CHAT

### package.json dependencies
```json
"dependencies": {
  "@chrisoakman/chessboardjs": "^1.0.0",
  "@google/generative-ai": "^0.24.1",
  "chess.js": "^1.4.0",
  "firebase": "^11.10.0",
  "react": "^19.1.0",
  "react-chessboard": "^5.1.0",
  "react-router-dom": "^7.6.3",
  "react-scripts": "^5.0.1",
  "stockfish": "^18.0.8",
  "tailwindcss": "^3.4.17",
  "typescript": "^4.9.5"
}
```

### Firebase initialization
```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

### Auth sync pattern
```ts
const syncProfile = useCallback(async (
  authUser: FirebaseUser,
  overrides: Parameters<typeof userProfileService.ensureProfile>[1] = {}
): Promise<User> => {
  return await userProfileService.ensureProfile(authUser, overrides);
}, []);
```

### User profile model
```ts
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'child' | 'parent' | 'coach' | 'admin';
  isPremium: boolean;
  avatarUrl?: string | null;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt?: Date;
}
```

### Puzzle progress model
```ts
export interface PuzzleProgress {
  userId: string;
  solved: number;
  failed: number;
  streak: number;
  bestStreak: number;
  lastCategory: PuzzleTrainingCategory | null;
  targetRating: number | null;
  byCategory?: Partial<Record<PuzzleTrainingCategory, number>>;
  updatedAt: string;
}
```

```ts
export interface PuzzleHistoryEntry {
  id: string;
  userId: string;
  puzzleId: string;
  category: PuzzleTrainingCategory | null;
  rating: number | null;
  solved: boolean;
  streakAfter: number;
  createdAt: string;
}
```

### Firebase security rules excerpt
```rules
match /users/{userId} {
  allow read, create, update: if isOwner(userId);
  allow delete: if false;

  match /analysis/{docId} {
    allow read, write: if isOwner(userId);
  }

  match /games/{gameId} {
    allow read, write: if isOwner(userId);
  }

  match /reports/{reportId} {
    allow read, write: if isOwner(userId);
  }

  match /puzzleProgress/{docId} {
    allow read, write: if isOwner(userId);
  }
}
```

### Existing puzzle trainer entry point
```tsx
const PuzzleTrainer: React.FC<PuzzleTrainerProps> = ({
  analysis,
  platform,
  username,
  games,
  rated
}) => {
  ...
};
```

### Chess import / PGN parsing
```ts
private parsePGN(pgn: string): string[] {
  const cleanPgn = pgn.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '');
  const moveRegex = /\d+\.\s*([NBRQK]?[a-h]?[1-8]?[x]?[a-h][1-8](?:=[NBRQK])?[+#]?|O-O(?:-O)?)\s*([NBRQK]?[a-h]?[1-8]?[x]?[a-h][1-8](?:=[NBRQK])?[+#]?|O-O(?:-O)?)?/g;
}
```

### Dashboard data loading pattern
```ts
profileAnalysisService.loadProfile(currentUser?.id)
userDataService.loadGameAnalyses(currentUser?.id)
userDataService.saveStats({ ... })
```

### Read/write reality
This app is currently a Firebase-backed React SPA with:
- Firebase Auth for identity
- Firestore for per-user data
- Storage for avatars
- Lichess/Chess.com API imports for game data
- chess.js + board UI for chess logic and display
- Stockfish for engine evaluation
- an existing puzzle/training module, but no complete topic-wise puzzle import system yet

---

## Final summary
The repository is a strong chess analysis and training dashboard that already has the core infrastructure for:
- user auth
- chess archive import
- game analysis and rating dashboards
- board-based review
- puzzle trainer flow
- user progress tracking

What it does not yet have is a complete end-to-end puzzle system for Lichess Study imports, topic-wise puzzle storage, and user puzzle assignment. The best integration points are clearly the existing puzzle trainer, Firestore service layer, and chess parsing utilities.
