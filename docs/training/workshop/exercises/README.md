# State Management Workshop Exercises

This directory contains hands-on exercises for the State Management Workshop.

## Exercise Structure

Each exercise folder contains:

- `starter.tsx` - Starting code with TODOs
- `solution.tsx` - Complete solution with explanations
- `README.md` - Exercise instructions and hints
- `tests.spec.ts` - Test cases to validate your solution

## Exercises by Difficulty

### 🟢 Beginner (15-20 minutes each)

1. **01-first-query**: Convert Redux to React Query
2. **04-ui-slice**: Create your first Redux UI slice
3. **07-basic-selector**: Write memoized selectors

### 🟡 Intermediate (20-30 minutes each)

2. **02-mutations**: Implement optimistic updates
3. **05-form-draft**: Manage form drafts with Redux
4. **08-prefetching**: Implement data prefetching

### 🔴 Advanced (30-45 minutes each)

3. **03-dependent-queries**: Chain dependent API calls
4. **06-real-time**: WebSocket + React Query integration
5. **09-full-feature**: Build a complete feature

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run workshop
```

3. Navigate to an exercise:

```bash
cd exercises/01-first-query
```

4. Open `starter.tsx` and follow the TODOs

5. Run tests to verify your solution:

```bash
npm test 01-first-query
```

## Tips for Success

1. **Read the Hints**: Each exercise has hints in the README
2. **Use TypeScript**: Let the types guide you
3. **Check the Tests**: Tests show expected behavior
4. **Ask Questions**: Workshop facilitators are here to help
5. **Compare Solutions**: Review solutions after attempting

## Quick Reference

### React Query Imports

```typescript
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
```

### Redux Imports

```typescript
import { useSelector, useDispatch } from 'react-redux';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
```

## Workshop Commands

```bash
# Run specific exercise tests
npm test <exercise-number>

# Run all exercise tests
npm test:all

# Check your solution
npm run check <exercise-number>

# Get hints for an exercise
npm run hint <exercise-number>

# Reset exercise to starter code
npm run reset <exercise-number>
```

## Evaluation Criteria

Each exercise is evaluated on:

- ✅ Functionality (does it work?)
- ✅ Type Safety (proper TypeScript usage)
- ✅ Best Practices (following patterns from guidelines)
- ✅ Performance (efficient implementation)
- ✅ Error Handling (graceful failure)

## Need Help?

- Check the solution file for the complete answer
- Review the [State Management Guidelines](../../guidelines/STATE-MANAGEMENT-GUIDELINES.md)
- Ask in Slack: #workshop-help
- Raise your hand for in-person assistance

Happy coding! 🚀
