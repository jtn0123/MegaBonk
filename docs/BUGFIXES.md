# Bug Fixes Documentation

This document catalogs significant bug fixes in the codebase. Each entry includes the issue, solution, and affected code.

## Accessibility & UX Bugs

### #12: Null Element and Value Handling in Filters
**Location:** `src/modules/filters.ts:517`
**Issue:** Code didn't handle both null element AND null value, causing crashes
**Fix:** Complete optional chaining: `element?.value ?? defaultValue`
**Impact:** Prevents crashes when DOM elements are missing

### #14: Magic Numbers as Constants
**Location:** `src/modules/constants.ts:102`
**Issue:** Hardcoded numbers scattered throughout code
**Fix:** Centralized magic numbers as named constants
**Impact:** Improved maintainability and code clarity

### Label Accessibility (WCAG Level A)
**Location:** `src/modules/filters.ts:412`
**Issue:** Filter labels missing `for` attributes, breaking screen reader support
**Fix:** Added proper `for` attributes linking labels to inputs
**Impact:** Improved accessibility for screen reader users

### Keyboard Navigation for Modals
**Location:** `src/modules/events.ts:85`
**Issue:** No keyboard support for breakpoint cards and Escape key for modals
**Fix:** Added keyboard event handlers for Enter/Space on cards, Escape for modals
**Impact:** Full keyboard navigation support

## Data Handling Bugs

### Undefined/Null Item Values
**Location:** `src/modules/filters.ts:362`
**Issue:** Filtering crashed when item properties were undefined/null
**Fix:** Added null checks before accessing item properties
**Impact:** Robust filtering even with incomplete data

### Invalid Date Handling
**Location:** `src/modules/filters.ts:629`
**Issue:** Invalid dates caused sort failures
**Fix:** Put invalid dates at end of sorted list
**Impact:** Sorting works even with malformed date data

### Date Validation in Changelog
**Location:** `src/modules/changelog.ts:139` (#6)
**Issue:** Invalid dates passed to date formatter caused crashes
**Fix:** Validate date is valid before formatting
**Impact:** Changelog renders even with bad data

## Security Bugs

### XSS Prevention in Changelog
**Location:** `src/modules/changelog.ts:100`
**Issue:** User-provided content rendered without escaping, XSS vulnerability
**Fix:** Escape all user content using textContent, not innerHTML
**Impact:** Prevents cross-site scripting attacks

## Performance & Race Condition Bugs

### #9, #10: Chart Initialization Race Condition
**Locations:**
- `src/modules/renderers.ts:246` (#9)
- `src/modules/modal.ts:387` (#10)
- `src/modules/renderers.ts:368`

**Issue:** setTimeout unreliable for chart initialization, causing missing charts
**Fix:** Use requestAnimationFrame for reliable rendering sync
**Impact:** Charts render consistently

### Stale Chart Initialization
**Location:** `src/modules/modal.ts:389`
**Issue:** Modal changes could trigger stale chart initialization
**Fix:** Use session ID to cancel stale initialization attempts
**Impact:** No memory leaks from orphaned chart instances

### Search Input Debounce
**Location:** `src/modules/events.ts:357`
**Issue:** Search triggered re-render on every keystroke, poor performance
**Fix:** Added debounce to batch renders
**Impact:** Smooth search experience even with large datasets

## State Management Bugs

### #11: Silent Modal Failures
**Location:** `src/modules/modal.ts:256`
**Issue:** Modal errors failed silently, confusing users
**Fix:** Show error toast when modal fails to load
**Impact:** Users see clear error messages

### Window.currentTab Sync
**Location:** `src/modules/events.ts:563`
**Issue:** External code relied on window.currentTab being in sync
**Fix:** Keep window.currentTab updated alongside internal state
**Impact:** Third-party integrations work correctly

### Separate User Data from Indicator
**Location:** `src/modules/events.ts:53`
**Issue:** User data and visual indicators mixed in same element
**Fix:** Use textContent for data, separate span for indicator
**Impact:** Cleaner DOM structure, easier to style

### ARIA State Updates
**Location:** `src/modules/changelog.ts:303`
**Issue:** Screen readers didn't know when sections expanded/collapsed
**Fix:** Update aria-expanded attribute on state changes
**Impact:** Better screen reader experience

## Bug Fix Guidelines

When fixing bugs:

1. **Add inline comment** explaining the fix:
   ```typescript
   // Bug fix: Handle null values to prevent crashes
   if (value !== null && value !== undefined) {
       // ...
   }
   ```

2. **Add test** to prevent regression:
   ```javascript
   it('should handle null values without crashing', () => {
       expect(() => myFunction(null)).not.toThrow();
   });
   ```

3. **Update this document** with:
   - Issue description
   - Solution implemented
   - Code location
   - Impact on users

4. **Consider refactoring** if fix is complex or repeated:
   - Extract to utility function
   - Document in code architecture

## See Also

- [Testing Guide](./TESTING.md) - How to run tests
- [Contributing Guide](../CONTRIBUTING.md) - Code standards
