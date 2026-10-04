import { readPGN, splitPGN, parseHeaders } from "./parser";

const files = [
  "1001_Chess_Exercises_for_Beginners.pgn",
  "The Woodpecker Method.pgn",
];

for (const filename of files) {
  console.log("\n========================================");
  console.log(filename);
  console.log("========================================");

  const pgn = readPGN(filename);
  const blocks = splitPGN(pgn);

  let printed = 0;

  for (const block of blocks) {
    const headers = parseHeaders(block);

    // Only show blocks that contain FEN.
    if (!headers["FEN"]) {
      continue;
    }

    console.log(`\nPuzzle ${printed + 1}:`);
    console.log(headers);

    printed++;

    if (printed >= 5) {
      break;
    }
  }
}

