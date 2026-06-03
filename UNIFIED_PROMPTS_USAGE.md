# Unified Chess Analysis Prompts - Usage Guide

## Overview

This document explains how to use the new unified prompt methods that have been added to the chess analysis system for testing purposes. The unified prompts follow your custom prompt structure and use a hybrid approach for better reliability.

## New Methods Added

### 1. `generateUnifiedExecutiveSummary(games, username)`
- **Purpose**: Generates executive summary using your unified prompt structure
- **Location**: `src/services/geminiService.ts`
- **Usage**: Replaces the original `generateExecutiveSummary` method for testing

### 2. `generateUnifiedAnalysis(games, username)`
- **Purpose**: Combines Recurring Weaknesses, Middlegame, and Endgame analysis in a single API call
- **Location**: `src/services/geminiService.ts`
- **Usage**: Hybrid approach - generates core analysis sections together for better consistency

### 3. `generateReportWithUnifiedPrompts(request)`
- **Purpose**: Complete report generation using the new unified methods
- **Location**: `src/services/reportService.ts`
- **Usage**: Alternative to the original `generateReport` method

## Hybrid Approach Strategy

The system now uses a hybrid approach that balances reliability with consistency:

1. **Executive Summary**: Separate API call (simple data structure)
2. **Core Analysis**: Combined API call for:
   - Recurring Weaknesses (3 items)
   - Middlegame Mastery Focus
   - Endgame Technique Review
3. **Improvement Plan**: Separate API call (uses updated prompt structure)

## How to Test

### Option 1: Use the new unified report generation method

```typescript
// In your component or service
import { reportService } from './services/reportService';

// Generate report with unified prompts
const report = await reportService.generateReportWithUnifiedPrompts({
  username: 'your-username',
  platform: 'chess.com',
  gameCount: 20,
  rated: true
});
```

### Option 2: Test individual methods

```typescript
// Test individual unified methods
import { geminiService } from './services/geminiService';

// Test executive summary
const executiveSummary = await geminiService.generateUnifiedExecutiveSummary(games, username);

// Test core analysis (weaknesses + middlegame + endgame)
const unifiedAnalysis = await geminiService.generateUnifiedAnalysis(games, username);
// Returns: { recurringWeaknesses, middlegameAnalysis, endgameAnalysis }
```

## Key Features of the Unified Prompts

### 1. Consistent Voice and Tone
- Uses "Pawnsposes" persona consistently
- Maintains world-renowned Grandmaster coach voice
- Encouraging but direct tone throughout

### 2. Positional Chess Focus
- Emphasizes strategic mistakes over tactical blunders
- Targets players rated 1300-2600
- Focuses on sophisticated positional concepts

### 3. Comprehensive Analysis Areas
The unified prompts cover all the chess concepts you specified:
- **Weaknesses**: Outposts, weak squares, pawn breaks, piece activity, etc.
- **Middlegame**: Planning, space advantage, piece coordination, etc.
- **Endgame**: Opposition, pawn endgames, rook technique, etc.

### 4. Detailed Examples
- 3 concrete examples per weakness
- Game number, move number, and position context
- Explanation of why moves were mistakes
- Superior plans and future ideas

## Error Handling

The unified methods include the same robust error handling as the original methods:
- Exponential backoff for rate limiting
- Retry logic for transient failures
- Detailed error messages for debugging

## Performance Considerations

- **Faster**: Fewer API calls due to hybrid approach
- **More Reliable**: Core analysis generated in one consistent context
- **Cost Effective**: Reduced API usage compared to separate calls

## Migration Path

The new methods are added alongside existing ones, so you can:
1. Test the unified prompts without breaking existing functionality
2. Compare results between old and new methods
3. Gradually migrate to unified prompts once tested

## Fallback Strategy

If the unified methods fail, the system can fall back to the original separate methods:

```typescript
// Fallback example
try {
  const unifiedAnalysis = await geminiService.generateUnifiedAnalysis(games, username);
  return unifiedAnalysis;
} catch (error) {
  // Fall back to separate methods
  const recurringWeaknesses = await geminiService.generateRecurringWeaknesses(games, username);
  const middlegameAnalysis = await geminiService.generateMiddleGameAnalysis(games, username);
  const endgameAnalysis = await geminiService.generateEndgameAnalysis(games, username);
  
  return { recurringWeaknesses, middlegameAnalysis, endgameAnalysis };
}
```

## Next Steps

1. **Test the unified methods** with sample data
2. **Compare output quality** between old and new methods
3. **Monitor performance** and error rates
4. **Refine prompts** based on test results
5. **Implement full migration** once satisfied with results

The unified prompts are now ready for testing and should provide more consistent, higher-quality analysis aligned with your specific requirements.