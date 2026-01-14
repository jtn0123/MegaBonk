# Test Coverage Improvement Plan

## Current State
- **Current Coverage:** 29%
- **Target Coverage:** 90%
- **Gap:** 61 percentage points
- **Lines to Cover:** ~10,675 additional lines
- **Estimated Effort:** 40-80 hours

## Reality Check

Achieving 90% coverage is a massive undertaking that requires:
- Writing 2,000-3,000 test cases
- Testing thousands of code paths
- Mocking complex dependencies
- Handling edge cases and error conditions

**Recommended Approach:** Incremental improvement over multiple sprints

## Phased Approach to 90% Coverage

### Phase 1: Quick Wins (29% → 50%) - 8-12 hours
**Target Modules:**
1. ✅ data-service.ts (17% → 80%) - Pure functions, easy to test
2. calculator.ts (25% → 90%) - Expand existing tests
3. compare.ts (43% → 85%) - Expand existing tests
4. utils.ts (91% → 95%) - Fill remaining gaps
5. synergy.ts (96% → 100%) - Nearly complete

**Expected Gain:** +21 percentage points

### Phase 2: Core Features (50% → 70%) - 16-24 hours
**Target Modules:**
1. modal.ts (3% → 60%) - High user interaction
2. build-planner.ts (13% → 60%) - Core business logic
3. filters.ts (65% → 85%) - Expand existing
4. events.ts (72% → 85%) - Expand existing
5. renderers.ts (93% → 98%) - Fill gaps

**Expected Gain:** +20 percentage points

### Phase 3: Advanced Features (70% → 85%) - 12-20 hours
**Target Modules:**
1. computer-vision.ts (8% → 40%) - Complex algorithms, partial coverage acceptable
2. ocr.ts (78% → 90%) - Expand existing
3. logger.ts (89% → 95%) - Fill gaps
4. changelog.ts (0% → 70%) - Basic rendering tests
5. advisor.ts (0% → 50%) - Core recommendation logic

**Expected Gain:** +15 percentage points

### Phase 4: Polish (85% → 90%) - 8-12 hours
**Target Modules:**
1. scan-build.ts (0% → 30%) - Requires canvas, limited coverage acceptable
2. cv-enhanced.ts (0% → 30%) - Complex CV, partial coverage acceptable
3. script.ts (0% → 50%) - Main entry point, integration tests
4. Fill remaining gaps across all modules

**Expected Gain:** +5 percentage points

## Module-by-Module Strategy

### High Priority (Biggest Impact)

#### data-service.ts (379 lines, 17% → 80%)
**Why:** Fundamental to all data operations, pure functions
**Tests Needed:** ~40 tests
- ✅ loadDataFromUrls (15 tests written)
- ✅ getDataForTabFromData (10 tests written)
- fetchWithTimeout (5 tests)
- fetchWithRetry (10 tests)
- validateData (5 tests)
- DOM helpers (5 tests)

#### calculator.ts (~250 lines, 25% → 90%)
**Why:** Pure business logic, already has test infrastructure
**Tests Needed:** ~30 tests
- computeBreakpoint edge cases (15 tests)
- populateCalculatorItems (5 tests)
- calculateBreakpoint UI (5 tests)
- Error handling (5 tests)

#### compare.ts (~260 lines, 43% → 85%)
**Why:** Pure comparison logic, testable
**Tests Needed:** ~25 tests
- compareItems (10 tests)
- renderComparison (8 tests)
- Edge cases (7 tests)

### Medium Priority (Good ROI)

#### modal.ts (956 lines, 3% → 60%)
**Why:** High user interaction, complex but testable
**Tests Needed:** ~80 tests
- showModal (20 tests)
- renderItemModal (15 tests)
- renderWeaponModal (15 tests)
- renderTomeModal (10 tests)
- renderCharacterModal (10 tests)
- renderShrineModal (5 tests)
- closeModal (5 tests)

#### build-planner.ts (879 lines, 13% → 60%)
**Why:** Core feature, business logic
**Tests Needed:** ~70 tests
- Build creation (20 tests)
- Tome selection (15 tests)
- Item management (15 tests)
- URL encoding/decoding (10 tests)
- Validation (10 tests)

### Lower Priority (Specialized/Complex)

#### computer-vision.ts (2047 lines, 8% → 40%)
**Why:** Complex algorithms, partial coverage acceptable
**Tests Needed:** ~100 tests (selective)
- Grid detection (20 tests)
- Template matching (20 tests)
- Color analysis (15 tests)
- Icon detection (20 tests)
- Edge cases (25 tests)

## Testing Guidelines

### What to Test
- ✅ Pure functions (highest priority)
- ✅ Business logic
- ✅ Data transformations
- ✅ Validation logic
- ✅ Error handling
- ✅ Edge cases

### What to Skip (Lower Priority)
- ❌ Complex DOM manipulation (test at E2E level)
- ❌ Chart rendering (test at E2E level)
- ❌ Global state changes (test at integration level)
- ❌ External API calls (mock and test minimally)

### Test Patterns

**Pure Function Pattern:**
```javascript
describe('pureFunctionName', () => {
    it('should handle valid input', () => {
        expect(fn(validInput)).toBe(expectedOutput);
    });

    it('should handle edge case', () => {
        expect(fn(edgeCase)).toBe(expectedBehavior);
    });

    it('should handle errors', () => {
        expect(() => fn(invalidInput)).toThrow();
    });
});
```

**DOM Function Pattern:**
```javascript
describe('domFunction', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="target"></div>';
    });

    it('should update DOM correctly', () => {
        domFunction();
        expect(document.getElementById('target')).toBeDefined();
    });
});
```

## Progress Tracking

| Phase | Target Coverage | Status | Completion Date |
|-------|----------------|--------|-----------------|
| Phase 1 | 29% → 50% | 🟡 In Progress | TBD |
| Phase 2 | 50% → 70% | ⚪ Not Started | TBD |
| Phase 3 | 70% → 85% | ⚪ Not Started | TBD |
| Phase 4 | 85% → 90% | ⚪ Not Started | TBD |

## Next Steps

1. ✅ Complete data-service.ts tests
2. Write calculator.ts comprehensive tests
3. Write compare.ts comprehensive tests
4. Run full test suite to validate Phase 1 progress
5. Adjust plan based on actual coverage gains
6. Proceed to Phase 2

## Resources Needed

- **Time:** 40-80 hours total
- **Tools:** vitest, @vitest/coverage-v8
- **Documentation:** Module APIs, business logic specs
- **Team:** 1-2 developers dedicated to testing

## Success Metrics

- Coverage increases by 5-10% per week
- No reduction in coverage from new code
- All tests pass consistently
- Memory issues resolved (heap limits)
- CI/CD pipeline green

## See Also

- [Testing Guide](./TESTING.md) - How to run tests
- [Bug Fixes](./BUGFIXES.md) - Known issues
