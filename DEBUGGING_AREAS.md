# MegaBonk Debugging Areas Report

Generated: 2026-01-08

This document identifies areas in the MegaBonk codebase that need debugging or have potential issues.

## Summary

- **Total Issues Found:** 20
- **Critical:** 2
- **High:** 5
- **Medium:** 8
- **Low:** 5

## Critical Issues

### 1. Service Worker - Unhandled Promise Rejections
**File:** `src/sw.js:63-69`
**Severity:** Critical

**Issue:** Nested promise chain for caching can fail silently. If `cache.put()` fails, the error is swallowed and the app continues with potentially stale or missing data.

**Current Code:**
```javascript
return response || fetch(event.request).then(fetchResponse => {
  return caches.open(CACHE_NAME).then(cache => {
    cache.put(event.request, fetchResponse.clone());
    return fetchResponse;
  });
});
```

**Fix:** Add `.catch()` handler to log error and return response anyway.

---

### 2. Data Loading - HTTP Error Check After JSON Parse Attempt
**File:** `src/modules/data-service.js:38-46`
**Severity:** Critical

**Issue:** Code checks for HTTP errors AFTER waiting for all responses, then tries to parse JSON on potentially failed responses. This could cause unhandled promise rejections.

**Current Code:**
```javascript
const failedResponses = responses.filter(r => !r.ok);
if (failedResponses.length > 0) {
    const failedUrls = failedResponses.map(r => r.url).join(', ');
    throw new Error(`Failed to load: ${failedUrls}`);
}

const [items, weapons, ...] = await Promise.all(
    responses.map(r => r.json())
);
```

**Fix:** Check `r.ok` before calling `r.json()` in the map, or filter responses first.

---

## High Severity Issues

### 3. Missing Error Handler on Clipboard API
**File:** `src/modules/build-planner.js:239`
**Severity:** High

**Issue:** `navigator.clipboard.writeText()` promise has `.then()` but no `.catch()`. If clipboard access is denied or fails, error is unhandled. User won't know if clipboard operation failed.

**Current Code:**
```javascript
navigator.clipboard.writeText(buildCode).then(() => {
    ToastManager.success('Build code copied to clipboard!');
});
```

**Fix:** Add `.catch(err => ToastManager.error('Failed to copy: ' + err.message))`.

---

### 4. Modal Chart Initialization Race Condition
**File:** `src/modules/modal.js:144-156`
**Severity:** High

**Issue:** Chart initialization uses recursive `requestAnimationFrame` with retry counter, but doesn't clean up if modal is closed during retries. If user closes modal quickly, `initChart` continues trying to find canvas for up to 50 frames (~830ms), wasting CPU cycles.

**Current Code:**
```javascript
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 50;
const initChart = () => {
    const canvas = document.getElementById(`modal-chart-${data.id}`);
    if (!canvas) {
        initAttempts++;
        if (initAttempts < MAX_INIT_ATTEMPTS) {
            requestAnimationFrame(initChart);
        }
        return;
    }
    // Initialize chart...
};
requestAnimationFrame(initChart);
```

**Fix:** Store handle to cancel animation frame, or check if modal is still open.

---

### 5. Memory Leak - Toast Transition Event Listener
**File:** `src/modules/toast.js:48-55`
**Severity:** High

**Issue:** Event listener added for `transitionend` but if element is removed before transition completes, listener may not fire, creating a memory leak. If CSS transition is disabled or element is removed externally, listener remains.

**Current Code:**
```javascript
setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => {
        if (toast.parentNode) {
            toast.remove();
        }
    });
}, duration);
```

**Fix:** Add timeout fallback to force removal, or use `{ once: true }` option.

---

### 6. Event Listener Accumulation in Modal Tabs
**File:** `src/modules/modal.js:218-223`
**Severity:** High

**Issue:** Event handler is stored on DOM element (`container._tabHandler`) which could accumulate if modal is opened multiple times for same item. If container reference changes or handler isn't properly removed, could lead to duplicate handlers.

**Current Code:**
```javascript
container.removeEventListener('click', container._tabHandler);
container._tabHandler = handleTabClick;
container.addEventListener('click', handleTabClick);
```

**Fix:** Use WeakMap to track handlers per container, or ensure container is cleaned up.

---

### 7. Compare Chart Initialization Without Cleanup Check
**File:** `src/modules/compare.js:162-166`
**Severity:** High

**Issue:** Chart initialization uses `setTimeout` which could execute after modal closes, attempting to initialize chart on non-existent canvas. If user closes modal within 100ms, chart tries to initialize on null canvas.

**Current Code:**
```javascript
if (chartableItems.length >= 2) {
    setTimeout(() => {
        createCompareChart('compare-scaling-chart', chartableItems);
    }, 100);
}
```

**Fix:** Check canvas existence in createCompareChart or verify modal is still open.

---

## Medium Severity Issues

### 8. Missing Null Check in Sort Function
**File:** `src/modules/utils.js:120-121`
**Severity:** Medium

**Issue:** `sortData` function accesses `a.name` and `b.name` without checking if they exist. If an item has undefined/null name, will throw "Cannot read property 'localeCompare' of undefined".

**Current Code:**
```javascript
if (sortBy === 'name') {
    return data.sort((a, b) => a.name.localeCompare(b.name));
}
```

**Fix:** Add fallback: `(a.name || '').localeCompare(b.name || '')`.

---

### 9. Inline onclick Handler Prevents Cleanup
**File:** `src/modules/changelog.js:196-199`
**Severity:** Medium

**Issue:** Changelog expand button uses inline `onclick` attribute instead of proper event delegation. Cannot remove listener properly, creates tight coupling, makes testing harder.

**Fix:** Use event delegation like other modules do.

---

### 10. Double requestAnimationFrame for Chart Init
**File:** `src/modules/renderers.js:155-157`
**Severity:** Medium

**Issue:** Uses nested `requestAnimationFrame` to delay chart initialization, which is fragile and timing-dependent. Relies on browser paint timing. If page is slow, charts may still not be ready.

**Current Code:**
```javascript
requestAnimationFrame(() => {
    requestAnimationFrame(() => initializeItemCharts());
});
```

**Fix:** Use IntersectionObserver or check for canvas existence directly.

---

### 11. State Exposure Inconsistency - Compare Module
**File:** `src/modules/compare.js:214-215`
**Severity:** Medium

**Issue:** Module exposes both mutable array AND getter function, creating confusion about correct usage. External code can mutate `window.compareItems` directly, bypassing module's control flow.

**Current Code:**
```javascript
window.getCompareItems = () => [...compareItems]; // Return a copy
window.compareItems = compareItems; // Keep for backward compatibility
```

**Fix:** Deprecate direct exposure, only use getter, or freeze the array.

---

### 12. State Exposure Inconsistency - Build Planner
**File:** `src/modules/build-planner.js:261-262`
**Severity:** Medium

**Issue:** Same as #11. External code can mutate `window.currentBuild` and break state consistency.

**Current Code:**
```javascript
window.getCurrentBuild = () => ({ ...currentBuild });
window.currentBuild = currentBuild;
```

**Fix:** Only expose getter.

---

### 13. Calculator Button Event Listener Re-added
**File:** `src/modules/renderers.js:17-21`
**Severity:** Medium

**Issue:** Every time calculator tab is rendered, listener is removed and re-added. Unnecessary work, could use event delegation instead.

**Current Code:**
```javascript
const calcBtn = safeGetElementById('calc-button');
if (calcBtn) {
    calcBtn.removeEventListener('click', calculateBreakpoint);
    calcBtn.addEventListener('click', calculateBreakpoint);
}
```

**Fix:** Add listener once via delegation or check if already added.

---

### 14. Missing Validation on buildCodeInput
**File:** `src/modules/build-planner.js` (import flow)
**Severity:** Medium

**Issue:** Build code import doesn't validate all expected properties exist before accessing them, could cause issues with malformed codes.

**Fix:** Add comprehensive validation before applying imported build.

---

### 15. Chart.js Instance Not Stored Consistently
**File:** Multiple chart creation functions
**Severity:** Medium

**Issue:** Some chart instances are stored in maps for cleanup, others aren't. Inconsistent pattern could lead to memory leaks.

**Fix:** Standardize chart instance storage and cleanup across all creation functions.

---

## Low Severity Issues

### 16. Service Worker Catch Only Handles Navigation
**File:** `src/sw.js:71-76`
**Severity:** Low

**Issue:** Catch block only provides fallback for navigation requests, other request types fail silently. Failed requests for JS/CSS/images have no fallback.

**Current Code:**
```javascript
.catch(() => {
    if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
    }
})
```

**Fix:** Add logging or provide generic fallback for all request types.

---

### 17. No Timeout for Data Loading
**File:** `src/modules/data-service.js:27-35`
**Severity:** Low

**Issue:** No timeout on fetch requests. If server hangs, user waits forever with loading spinner. Network timeout could be very long (browser default ~300s).

**Fix:** Wrap fetch in Promise.race with timeout, or use AbortController.

---

### 18. querySelector Without Safe Wrapper
**File:** `src/modules/compare.js:35`
**Severity:** Low

**Issue:** Uses `querySelector` directly instead of safe wrapper, though it does check for null. Inconsistent with rest of codebase.

**Fix:** Use `safeQuerySelector` for consistency.

---

### 19. Error Container Created Multiple Times
**File:** `src/modules/events.js:237-243`
**Severity:** Low

**Issue:** Function creates error container if it doesn't exist, but always replaces innerHTML, which destroys any existing listeners. Works correctly but could be more efficient.

**Fix:** Update text nodes instead of replacing HTML.

---

### 20. Modal Close During Chart Initialization
**File:** `src/modules/modal.js:408-416`
**Severity:** Low

**Issue:** Close modal function waits 300ms for animation but chart init may still be running. Chart initialization could still execute after modal is hidden.

**Current Code:**
```javascript
function closeModal() {
    const modal = safeGetElementById('itemModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}
```

**Fix:** Cancel pending chart initialization in closeModal.

---

## Category Breakdown

### Error Handling (5 issues)
- Missing catch on clipboard API (High)
- Service worker promise chain issues (Critical)
- Data loading HTTP error check (Critical)
- No timeout on data loading (Low)
- Service worker catch incomplete (Low)

### Memory Leaks (4 issues)
- Toast transition listener (High)
- Modal tab handler accumulation (High)
- Chart init race condition (High)
- Calculator button re-adding listener (Medium)

### Race Conditions (3 issues)
- Modal chart initialization (High)
- Compare chart setTimeout (High)
- Double requestAnimationFrame (Medium)

### State Management (2 issues)
- Compare items exposure (Medium)
- Build planner state exposure (Medium)

### Edge Cases (4 issues)
- Sort missing null check (Medium)
- Build code validation (Medium)
- Modal close during init (Low)
- Error container recreation (Low)

### DOM Manipulation (2 issues)
- Inline onclick handler (Medium)
- querySelector without wrapper (Low)

## Recommendations

### Immediate Priority
1. Fix clipboard API error handling (build-planner.js:239)
2. Fix data loading HTTP error checks (data-service.js:38-46)
3. Add error handling to service worker cache operations (sw.js:63-69)

### High Priority
4. Address memory leak in toast transition listener (toast.js:48-55)
5. Fix modal chart initialization race condition (modal.js:144-156)
6. Add cleanup check to compare chart initialization (compare.js:162-166)
7. Resolve event listener accumulation in modal tabs (modal.js:218-223)

### Medium Priority
8. Refactor state exposure patterns for consistency (compare.js, build-planner.js)
9. Add null checks to sort function (utils.js:120-121)
10. Replace inline onclick with event delegation (changelog.js)
11. Standardize chart initialization patterns (renderers.js, modal.js)

### Low Priority
12. Add timeouts to data loading (data-service.js)
13. Improve error logging in service worker (sw.js)
14. Use safe wrappers consistently (compare.js)

## Positive Observations

The codebase shows many good practices:
- Extensive use of optional chaining (`?.`)
- Safe DOM accessor functions (`safeGetElementById`, `safeQuerySelector`)
- Chart.js cleanup in many places
- Comprehensive error display system
- Good test coverage structure

The main issues are concentrated in:
- Async error handling patterns
- Event listener lifecycle management
- Race conditions in chart initialization
- Inconsistent state exposure patterns
