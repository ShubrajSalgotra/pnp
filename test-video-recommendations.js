// Simple test to verify the enhanced video recommendation system
const { videoRecommendationService } = require('./src/services/videoRecommendationService.ts');

// Test data with specific weakness patterns
const testWeaknesses = [
  {
    title: "Missing pin tactics in middlegame positions",
    description: "Frequently overlooking pin opportunities when opponent pieces are aligned on the same rank, file, or diagonal",
    frequency: 7,
    examples: [
      {
        gameId: "game1",
        moveNumber: 18,
        position: "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R",
        mistake: "Played Nxe5 missing the pin opportunity",
        betterMove: "Bg5 pinning the knight to the queen"
      },
      {
        gameId: "game2", 
        moveNumber: 22,
        position: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R",
        mistake: "Missed Bb5 pinning the knight",
        betterMove: "Bb5 creating a powerful pin"
      }
    ],
    improvementSuggestion: "Practice recognizing pin patterns and piece alignment"
  }
];

const testMiddlegameAnalysis = {
  overallRating: 5,
  strengths: ["Good opening knowledge"],
  weaknesses: ["Tactical awareness", "Pin recognition"],
  patterns: {
    positionalUnderstanding: 6,
    tacticalAwareness: 3,
    planFormation: 5,
    pieceCoordination: 4
  },
  recommendations: ["Focus on pin tactics"],
  examplePositions: []
};

const testEndgameAnalysis = {
  overallRating: 6,
  strengths: ["Basic checkmates"],
  weaknesses: ["Complex endgames"],
  commonMistakes: ["Calculation errors"],
  endgameTypes: [],
  recommendations: [],
  studyMaterial: [],
  examplePositions: []
};

console.log("Testing Enhanced Video Recommendation System...\n");

try {
  const recommendation = videoRecommendationService.getPersonalizedVideoRecommendation(
    testWeaknesses,
    testMiddlegameAnalysis,
    testEndgameAnalysis
  );

  console.log("=== PERSONALIZED VIDEO RECOMMENDATION ===");
  console.log("Title:", recommendation.title);
  console.log("Channel:", recommendation.channel);
  console.log("URL:", recommendation.url);
  console.log("Description:", recommendation.description);
  console.log("Relevant Weakness:", recommendation.relevantWeakness);
  console.log("Duration:", recommendation.duration);
  console.log("Search Query:", recommendation.searchQuery);
  console.log("\n");

  const searchQuery = videoRecommendationService.getSearchQueryForWeakness(
    testWeaknesses,
    testMiddlegameAnalysis,
    testEndgameAnalysis
  );

  console.log("=== DYNAMIC SEARCH QUERY ===");
  console.log("Generated Query:", searchQuery);
  console.log("\nThis query should be much more specific than generic 'chess tactics' searches!");

} catch (error) {
  console.error("Error testing video recommendations:", error);
}