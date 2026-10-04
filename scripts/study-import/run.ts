import { parsePGN } from "./parser";

import { classifyStudy } from "./classifier";

import { validateLessons } from "./validator";

import { importStudy } from "./firebaseImport";

// ============================================================
// FILES
// ============================================================

const files = [
  "lichess_study_endgame-1899-2000_by_The_karan01_2024.11.11.pgn",

  "lichess_study_endgame-2200-2399_by_The_karan01_2024.11.11.pgn",
 
];

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(
    "\n========================================",
  );

  console.log(
    "        STUDY IMPORT PIPELINE",
  );

  console.log(
    "========================================\n",
  );

  for (const filename of files) {
    console.log(
      `\n📖 Processing: ${filename}`,
    );

    // --------------------------------------------------------
    // PARSE
    // --------------------------------------------------------

    const rawLessons =
      parsePGN(filename);

    console.log(
      `   Parsed lessons: ${rawLessons.length}`,
    );

    // --------------------------------------------------------
    // CLASSIFY
    // --------------------------------------------------------

    const {
      study,
      lessons,
    } = classifyStudy(
      rawLessons,
      filename,
    );

    console.log(
      `   Study: ${study.title}`,
    );

    console.log(
      `   Rating: ${
        study.ratingMin ?? "?"
      }-${
        study.ratingMax ?? "?"
      }`,
    );

    console.log(
      `   Lessons: ${study.lessonCount}`,
    );

    // --------------------------------------------------------
    // VALIDATE
    // --------------------------------------------------------

    const {
      validLessons,
      invalidLessons,
    } = validateLessons(
      lessons,
    );

    console.log(
      `\n   ✅ Valid: ${validLessons.length}`,
    );

    console.log(
      `   ❌ Invalid: ${invalidLessons.length}`,
    );

    // --------------------------------------------------------
    // SAMPLE
    // --------------------------------------------------------

    const sample =
      validLessons.slice(0, 2);

    for (const lesson of sample) {
      console.log(
        "\n   ------------------------------",
      );

      console.log(
        `   Lesson: ${lesson.title}`,
      );

      console.log(
        `   Order: ${lesson.lessonOrder}`,
      );

      console.log(
        `   FEN: ${lesson.fen}`,
      );

      console.log(
        `   Moves: ${lesson.moves.length}`,
      );

      console.log(
        `   Variations: ${lesson.variations.length}`,
      );

      console.log(
        `   Intro comment: ${
          lesson.introComment
            ? "Yes"
            : "No"
        }`,
      );

      if (lesson.moves[0]) {
        console.log(
          `   First move: ${
            lesson.moves[0].san
          }`,
        );
      }

      if (
        lesson.moves[0]?.comment
      ) {
        console.log(
          `   First move comment: ${
            lesson.moves[0].comment
          }`,
        );
      }
    }

    // --------------------------------------------------------
    // FIREBASE IMPORT
    // --------------------------------------------------------

    const result =
      await importStudy(
        study,
        validLessons,
      );

    console.log(
      `   ☁️ Firebase: ${
        result.lessonsWritten
      } lessons imported.`,
    );
  }

  // ==========================================================
  // DONE
  // ==========================================================

  console.log(
    "\n========================================",
  );

  console.log(
    "              DONE",
  );

  console.log(
    "========================================\n",
  );
}

// ============================================================
// ERROR HANDLING
// ============================================================

main().catch((error) => {
  console.error(
    "\n❌ Study import failed:",
    error,
  );

  process.exit(1);
});