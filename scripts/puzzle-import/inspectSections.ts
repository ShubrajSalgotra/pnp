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

  const sections = new Set<string>();

  for (const block of blocks) {
    const headers = parseHeaders(block);

    if (headers["FEN"] && headers["White"]) {
      sections.add(headers["White"]);
    }
  }

  for (const section of sections) {
    console.log(section);
  }

  console.log(`\nTotal unique White values: ${sections.size}`);
}
