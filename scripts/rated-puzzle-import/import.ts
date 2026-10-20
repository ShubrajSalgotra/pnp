import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const {
  initializeApp,
  cert,
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

const main = async () => {
  /*
  |--------------------------------------------------------------------------
  | SERVICE ACCOUNT
  |--------------------------------------------------------------------------
  */

  const serviceAccountPath = path.resolve(
    process.cwd(),
    "serviceAccountKey.json",
  );

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `serviceAccountKey.json not found at: ${serviceAccountPath}`,
    );
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf-8"),
  );

  /*
  |--------------------------------------------------------------------------
  | FIREBASE ADMIN INITIALIZE
  |--------------------------------------------------------------------------
  */

  initializeApp({
    credential: cert(serviceAccount),
  });

  const db = getFirestore();

  console.log("✅ Firebase Admin initialized.");

  /*
  |--------------------------------------------------------------------------
  | CSV PATH
  |--------------------------------------------------------------------------
  */

  const csvPath = path.resolve(
    process.cwd(),
    "scripts",
    "rated-puzzle-import",
    "pawnsposes_puzzles_rated_with_keyIdea.csv",
  );

  if (!fs.existsSync(csvPath)) {
    throw new Error(
      `CSV file not found at: ${csvPath}`,
    );
  }

  console.log(`📄 CSV: ${csvPath}`);

  /*
  |--------------------------------------------------------------------------
  | CSV ROW TYPE
  |--------------------------------------------------------------------------
  */

  interface RatedPuzzleRow {
    puzzle_id: string;

    source: string;
    chapter: string;
    book_level: string;
    book_no: string;

    fen: string;
    to_move: string;

    book_solution: string;
    book_solution_uci: string;

    rated_moves?: string;

    required_solution: string;
    required_solution_uci: string;

    model_rating?: string;
    est_rating: string;
    level?: string;

    solution_check?: string;
    alt_move?: string;
    book_move_eval?: string;
    alt_move_eval?: string;
    confidence?: string;
    note?: string;

    /*
    |--------------------------------------------------------------------------
    | HINT DATA
    |--------------------------------------------------------------------------
    */

    hint1?: string;
    hint2?: string;
    keyIdea?: string;
  }

  /*
  |--------------------------------------------------------------------------
  | READ CSV
  |--------------------------------------------------------------------------
  */

  const csvContent = fs.readFileSync(
    csvPath,
    "utf-8",
  );

  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as RatedPuzzleRow[];

  console.log(
    `\nFound ${rows.length} rows in CSV.\n`,
  );

  /*
  |--------------------------------------------------------------------------
  | VALIDATION
  |--------------------------------------------------------------------------
  */

  const seenIds = new Set<string>();

  const validRows: RatedPuzzleRow[] = [];

  for (const row of rows) {
    const puzzleId = String(
      row.puzzle_id ?? "",
    ).trim();

    const fen = String(
      row.fen ?? "",
    ).trim();

    const toMove = String(
      row.to_move ?? "",
    ).trim();

    const requiredSolution = String(
      row.required_solution_uci ?? "",
    ).trim();

    const rating = Number(
      row.est_rating,
    );

    /*
    |--------------------------------------------------------------------------
    | PUZZLE ID
    |--------------------------------------------------------------------------
    */

    if (!puzzleId) {
      console.warn(
        "⚠️ Skipping row: missing puzzle_id",
      );

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | DUPLICATE ID
    |--------------------------------------------------------------------------
    */

    if (seenIds.has(puzzleId)) {
      throw new Error(
        `Duplicate puzzle_id found inside CSV: ${puzzleId}`,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | FEN
    |--------------------------------------------------------------------------
    */

    if (!fen) {
      console.warn(
        `⚠️ Skipping ${puzzleId}: missing FEN`,
      );

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | TO MOVE
    |--------------------------------------------------------------------------
    */

    if (!toMove) {
      console.warn(
        `⚠️ Skipping ${puzzleId}: missing to_move`,
      );

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | SOLUTION
    |--------------------------------------------------------------------------
    */

    if (!requiredSolution) {
      console.warn(
        `⚠️ Skipping ${puzzleId}: missing required_solution_uci`,
      );

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | RATING
    |--------------------------------------------------------------------------
    */

    if (!Number.isFinite(rating)) {
      console.warn(
        `⚠️ Skipping ${puzzleId}: invalid est_rating`,
      );

      continue;
    }

    /*
    |--------------------------------------------------------------------------
    | VALID
    |--------------------------------------------------------------------------
    */

    seenIds.add(puzzleId);

    validRows.push(row);
  }

  /*
  |--------------------------------------------------------------------------
  | VALIDATION SUMMARY
  |--------------------------------------------------------------------------
  */

  console.log(
    `Valid puzzles: ${validRows.length}`,
  );

  console.log(
    `Unique puzzle IDs: ${seenIds.size}`,
  );

  /*
  |--------------------------------------------------------------------------
  | BATCH SIZE
  |--------------------------------------------------------------------------
  |
  | Firestore maximum = 500 operations.
  | We use 450 for safety.
  |
  */

  const BATCH_SIZE = 450;

  let written = 0;

  /*
  |--------------------------------------------------------------------------
  | IMPORT
  |--------------------------------------------------------------------------
  */

  for (
    let i = 0;
    i < validRows.length;
    i += BATCH_SIZE
  ) {
    const chunk = validRows.slice(
      i,
      i + BATCH_SIZE,
    );

    const batch = db.batch();

    console.log(
      `\nProcessing batch ${
        Math.floor(i / BATCH_SIZE) + 1
      }...`,
    );

    /*
    |--------------------------------------------------------------------------
    | EACH PUZZLE
    |--------------------------------------------------------------------------
    */

    for (const row of chunk) {
      const puzzleId =
        row.puzzle_id.trim();

      /*
      |--------------------------------------------------------------------------
      | FIRESTORE DOCUMENT
      |--------------------------------------------------------------------------
      */

      const puzzleRef = db
        .collection("puzzles")
        .doc(puzzleId);

      /*
      |--------------------------------------------------------------------------
      | REQUIRED SOLUTION UCI
      |--------------------------------------------------------------------------
      */

      const requiredSolutionUci =
        row.required_solution_uci
          .split(/\s+/)
          .map((move) => move.trim())
          .filter(Boolean);

      /*
      |--------------------------------------------------------------------------
      | RATED MOVES
      |--------------------------------------------------------------------------
      */

      const ratedMoves =
        row.rated_moves
          ? row.rated_moves
              .split(/\s+/)
              .map((move) => move.trim())
              .filter(Boolean)
          : [];

      /*
      |--------------------------------------------------------------------------
      | HINTS
      |--------------------------------------------------------------------------
      */

      const hint1 = String(
        row.hint1 ?? "",
      ).trim();

      const hint2 = String(
        row.hint2 ?? "",
      ).trim();

      const keyIdea = String(
        row.keyIdea ?? "",
      ).trim();

      /*
      |--------------------------------------------------------------------------
      | FIRESTORE DATA
      |--------------------------------------------------------------------------
      */

      const puzzleData = {
        /*
        |--------------------------------------------------------------------------
        | CORE PUZZLE
        |--------------------------------------------------------------------------
        */

        puzzleId,

        fen: row.fen.trim(),

        toMove: row.to_move.trim(),

        requiredSolutionUci,

        ratedMoves,

        estRating: Number(
          row.est_rating,
        ),

        /*
        |--------------------------------------------------------------------------
        | HINT / IDEA
        |--------------------------------------------------------------------------
        */

        hint1,

        hint2,

        keyIdea,

        /*
        |--------------------------------------------------------------------------
        | SOURCE
        |--------------------------------------------------------------------------
        */

        source:
          row.source?.trim() || "",

        chapter:
          row.chapter?.trim() || "",

        bookLevel:
          row.book_level?.trim() || "",

        bookNo:
          row.book_no?.trim() || "",

        /*
        |--------------------------------------------------------------------------
        | UPDATED
        |--------------------------------------------------------------------------
        */

        updatedAt:
          FieldValue.serverTimestamp(),
      };

      /*
      |--------------------------------------------------------------------------
      | SET DOCUMENT
      |--------------------------------------------------------------------------
      |
      | merge:true means:
      |
      | Existing puzzle -> UPDATE
      | New puzzle      -> CREATE
      |
      */

      batch.set(
        puzzleRef,
        puzzleData,
        {
          merge: true,
        },
      );
    }

    /*
    |--------------------------------------------------------------------------
    | COMMIT
    |--------------------------------------------------------------------------
    */

    await batch.commit();

    written += chunk.length;

    console.log(
      `✅ Imported ${written}/${validRows.length}`,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FINAL RESULT
  |--------------------------------------------------------------------------
  */

  console.log("\n=================================");
  console.log("       PUZZLE IMPORT DONE");
  console.log("=================================");

  console.log(
    `Total CSV rows: ${rows.length}`,
  );

  console.log(
    `Valid puzzles: ${validRows.length}`,
  );

  console.log(
    `Written: ${written}`,
  );

  console.log(
    "Collection: puzzles",
  );

  console.log(
    "Fields: fen, toMove, requiredSolutionUci, ratedMoves, estRating",
  );

  console.log(
    "Hints: hint1, hint2, keyIdea",
  );

  console.log(
    "Mode: merge/update existing documents",
  );

  console.log("=================================\n");
};

/*
|--------------------------------------------------------------------------
| RUN
|--------------------------------------------------------------------------
*/

main().catch((error) => {
  console.error(
    "\n❌ PUZZLE IMPORT FAILED\n",
  );

  console.error(error);

  process.exit(1);
});