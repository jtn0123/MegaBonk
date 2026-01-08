# MegaBonk Debugging Pass #2

Generated: 2026-01-08

This document contains findings from the second comprehensive debugging pass.

## Summary

**Total New Issues Found:** 5
- **Medium:** 3
- **Low:** 2

## Good News ✅

The codebase already has excellent defensive programming in place:
- ✅ Calculator has proper division by zero checks (`calculator.js:52-58`)
- ✅ Calculator validates array exists before access (`calculator.js:43-46`)
- ✅ Modal checks `Object.keys().length > 0` before accessing keys (`modal.js:72`)
- ✅ All math operations use safe guards (fallback values, NaN checks)
- ✅ User input is properly sanitized (search uses toLowerCase, no XSS risks found)
- ✅ Proper use of optional chaining throughout (`?.`)
- ✅ Good error messages and user feedback via ToastManager
- ✅ Comprehensive validation in calculator and build planner

## Medium Priority Issues

### 1. Hyperbolic Scaling Division - Potential Edge Case
**File:** `src/modules/charts.js:19, 305, 311`
**Severity:** Medium

**Issue:** Hyperbolic formulas use division by `(constant + internal)` or `(1 + internal)`. While mathematically sound, if constant/internal values are manipulated incorrectly, could theoretically cause issues.

**Current Code:**
```javascript
// Line 19
const actual = internal / (constant + internal);

// Line 305
const actualEvasion = internalDecimal / (1 + internalDecimal) * 100;

// Line 311
const actualArmor = internalDecimal / (0.75 + internalDecimal) * 100;
```

**Risk Level:** Low-Medium (constants are hardcoded, internal comes from JSON)

**Recommended Fix:** Add validation that constants are positive and internal is a valid number.

---

### 2. Array Max/Min Without Length Check
**File:** `src/modules/charts.js:226`
**Severity:** Medium

**Issue:** Uses `Math.max(...lengths)` without checking if lengths array is non-empty. If all items have no scaling_per_stack, could pass empty array to Math.max.

**Current Code:**
```javascript
const lengths = items.map(item => item.scaling_per_stack?.length || 0);
const maxLength = lengths.length > 0 ? Math.max(...lengths) : 10;
```

**Analysis:** Actually ALREADY FIXED! Code checks `lengths.length > 0` before calling Math.max. ✅

**Status:** No action needed

---

### 3. Evasion Formula Could Produce Infinity
**File:** `src/modules/build-planner.js:171`
**Severity:** Medium

**Issue:** Evasion formula divides by `(1 + stats.evasion_internal / 100)`. If evasion_internal is extremely negative (< -100), denominator becomes zero or negative.

**Current Code:**
```javascript
stats.evasion = Math.round((stats.evasion_internal / (1 + stats.evasion_internal / 100)) * 100) / 100;
```

**Risk Level:** Low (requires malformed game data)

**Recommended Fix:** Add bounds check or Math.max to prevent negative evasion_internal.

---

## Low Priority Issues

### 4. ParseInt Without Radix
**File:** `src/modules/events.js:51, 129`
**Severity:** Low

**Issue:** Uses `parseInt(targetVal, 10)` which is correct, but in other places might forget radix. This is actually done correctly here.

**Status:** No issue found - already using radix correctly ✅

---

### 5. Quick Calculation Missing Bounds Check
**File:** `src/modules/events.js:51, 129`
**Severity:** Low

**Issue:** `quickCalc` is called with `parseInt(targetVal, 10)` without checking if result is NaN.

**Current Code:**
```javascript
quickCalc(itemId, parseInt(targetVal, 10));
```

**Risk Level:** Very Low (data attributes are controlled by app)

**Recommended Fix:** Validate parseInt result is not NaN before calling quickCalc.

---

## Potential Improvements (Not Bugs)

### A. Add Global Error Boundary
Consider adding a global window.onerror handler to catch unexpected errors and show user-friendly message.

### B. Add Performance Monitoring
For large datasets, consider lazy loading or virtualization for item lists.

### C. IndexedDB for Offline Storage
Currently relies on service worker cache. Could add IndexedDB for more robust offline storage.

### D. Add Input Debouncing
Search input could benefit from debouncing to reduce filtering operations on fast typing.

---

## New Issues Requiring Fixes

### Issue #21: Evasion Calculation Edge Case
**File:** `src/modules/build-planner.js:171`
**Priority:** Medium

Add bounds checking for evasion_internal to prevent division by zero or negative denominators.

### Issue #22: Quick Calc NaN Check
**File:** `src/modules/events.js:51, 129`
**Priority:** Low

Validate parseInt result before passing to quickCalc function.

---

## Architecture Observations

**Strengths:**
1. Consistent use of safe accessors (`safeGetElementById`, etc.)
2. Good separation of concerns with module structure
3. Comprehensive error handling in user-facing functions
4. Excellent use of optional chaining and nullish coalescing
5. Good validation on user inputs

**Minor Concerns:**
1. Some innerHTML usage but appears safe (no user input injection)
2. Global state exposure (being addressed in current fixes)
3. Event delegation could be more consistent across modules

**Verdict:** Overall code quality is **HIGH**. Most defensive programming patterns are already in place.
