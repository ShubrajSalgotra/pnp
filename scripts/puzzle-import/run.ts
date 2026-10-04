import fs from "fs";
import path from "path";

import { parsePGN } from "./parser";
import { classifyPuzzles } from "./classifier";
import { validatePuzzles } from "./validator";
import { importPuzzles } from "./firebaseImport";

import { ParsedPuzzle } from "./types";

// ============================================================
// CONFIG
// ============================================================

const PGN_DIRECTORY = path.join(
  process.cwd(),
  "scripts",
  "puzzle-import",
  "pgn",
);

const OUTPUT_DIRECTORY = path.join(
  process.cwd(),
  "scripts",
  "puzzle-import",
  "output",
);

// ============================================================
// GET ALL PGN FILES
// ============================================================

function getPGNFiles(): string[] {
  if (!fs.existsSync(PGN_DIRECTORY)) {
    throw new Error(`PGN directory not found: ${PGN_DIRECTORY}`);
  }

  return fs
    .readdirSync(PGN_DIRECTORY)
    .filter((filename) => filename.toLowerCase().endsWith(".pgn"));
}

// ============================================================
// CREATE OUTPUT DIRECTORY
// ============================================================

function ensureOutputDirectory(): void {
  if (!fs.existsSync(OUTPUT_DIRECTORY)) {
    fs.mkdirSync(OUTPUT_DIRECTORY, {
      recursive: true,
    });
  }
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  ensureOutputDirectory();

  const files = getPGNFiles();

  console.log(`Found ${files.length} PGN file(s).`);

  const allPuzzles: ParsedPuzzle[] = [];

  // ----------------------------------------------------------
  // PROCESS EVERY PGN
  // ----------------------------------------------------------

  for (const filename of files) {
    console.log(`\nProcessing: ${filename}`);

    try {
      // ------------------------------------------------------
      // 1. GENERIC PARSER
      // ------------------------------------------------------

      const rawPuzzles = parsePGN(filename);

      console.log(`Parsed: ${rawPuzzles.length}`);

      // ------------------------------------------------------
      // 2. CLASSIFICATION
      // ------------------------------------------------------

      const classified = classifyPuzzles(rawPuzzles, filename);

      // ------------------------------------------------------
      // 3. VALIDATION
      // ------------------------------------------------------

      const validation = validatePuzzles(classified);

      console.log(`Valid: ${validation.valid.length}`);
      console.log(`Invalid: ${validation.invalid.length}`);

      // ------------------------------------------------------
      // SHOW VALIDATION ERRORS
      // ------------------------------------------------------

      if (validation.invalid.length > 0) {
        console.log("\nInvalid puzzle examples:");

        validation.invalid.slice(0, 5).forEach(({ puzzle, errors }) => {
          console.log(puzzle.title, errors);
        });
      }

      // ------------------------------------------------------
      // ADD VALID PUZZLES
      // ------------------------------------------------------

      allPuzzles.push(...validation.valid);

      // ------------------------------------------------------
      // SAVE PER-FILE OUTPUT
      // ------------------------------------------------------

      const outputFilename = filename.replace(/\.pgn$/i, ".json");

      const outputPath = path.join(OUTPUT_DIRECTORY, outputFilename);

      fs.writeFileSync(
        outputPath,
        JSON.stringify(validation.valid, null, 2),
        "utf-8",
      );

      console.log(`Saved: ${outputPath}`);
    } catch (error) {
      console.error(`Failed: ${filename}`);
      console.error(error);
    }
  }

  // ----------------------------------------------------------
  // SAVE ALL PUZZLES
  // ----------------------------------------------------------

  const allOutputPath = path.join(OUTPUT_DIRECTORY, "all-puzzles.json");

  fs.writeFileSync(allOutputPath, JSON.stringify(allPuzzles, null, 2), "utf-8");

  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------

  console.log("\n========================================");
  console.log("IMPORT SUMMARY");
  console.log("========================================");

  console.log("PGN files:", files.length);
  console.log("Total valid puzzles:", allPuzzles.length);
  console.log("Output:", allOutputPath);

  // ----------------------------------------------------------
  // MODULE SUMMARY
  // ----------------------------------------------------------

  const modules = new Map<string, number>();
  const topics = new Map<string, number>();
  const difficulties = new Map<string, number>();

  for (const puzzle of allPuzzles) {
    modules.set(puzzle.moduleName, (modules.get(puzzle.moduleName) ?? 0) + 1);

    if (puzzle.topicName) {
      topics.set(puzzle.topicName, (topics.get(puzzle.topicName) ?? 0) + 1);
    }

    if (puzzle.difficulty) {
      difficulties.set(
        puzzle.difficulty,
        (difficulties.get(puzzle.difficulty) ?? 0) + 1,
      );
    }
  }

  console.log("\nModules:");
  console.table(Object.fromEntries(modules));

  console.log("\nTopics:");
  console.table(Object.fromEntries(topics));

  console.log("\nDifficulties:");
  console.table(Object.fromEntries(difficulties));

  // ==========================================================
  // FIREBASE TEST IMPORT
  // ==========================================================

  console.log("\n========================================");
  console.log("FIREBASE TEST IMPORT");
  console.log("========================================");

  // ----------------------------------------------------------
  // IMPORTANT:
  // Only upload 2 puzzles for the first test.
  // ----------------------------------------------------------

  const testPuzzles = allPuzzles.slice(0, 2);

  console.log(`Uploading ${testPuzzles.length} test puzzles...`);

  try {
    const result = await importPuzzles(testPuzzles);

    console.log("\nFirebase import successful!");

    console.log("Modules:", result.modules);
    console.log("Topics:", result.topics);
    console.log("Puzzles:", result.puzzles);
  } catch (error) {
    console.error("\nFirebase import failed:");
    console.error(error);
  }
}

// ============================================================
// RUN
// ============================================================

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
