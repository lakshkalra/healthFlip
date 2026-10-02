# healthFlip Phase 2 — Functional Flow Specification

This document defines the functional v0 flow page by page. Visual styling is
intentionally not prescribed here; the final UI will follow the Figma design supplied
for implementation.

## Scope

Phase 2 includes:

- Anonymous guest session creation and local token persistence.
- First-run goal setup.
- Daily calorie dashboard.
- Manual meal creation.
- Meal detail, edit, and delete.
- Loading, empty, validation, retry, unavailable API, and restart states.

Phase 2 excludes AI estimation, photo analysis, voice input, chat, reports, history,
rewards, and settings. The v1 has no sign-up or login; its anonymous device session
is internal only and not shown to the user.

## App-wide startup flow

### Page 0 — App bootstrap

1. The app launches.
2. Read the anonymous guest token from local storage.
3. If no token exists, create a guest session through `POST /v1/guests`.
4. Persist the returned token locally.
5. Request the current goal through `GET /v1/goals/current`.
6. If a goal exists, request the daily dashboard.
7. If no goal exists, open Page 1.
8. If the request fails, show a recoverable error state with Retry.

### Bootstrap states

- Loading: the app is checking local storage and the API.
- First run: no active goal exists; route to goal setup.
- Returning user: active goal exists; route to the dashboard.
- API unavailable: show the error and Retry; do not lose the local token.

## Flow 1 — First-run goal setup

### Page 1 — Goal setup

1. Show the available goal types:
   - Lose weight
   - Maintain weight
   - Gain weight
2. Select `Maintain weight` by default.
3. Show a daily calorie target input.
4. Pre-fill the target with `2000` for the v0 experience.
5. Allow the user to change the target.
6. Submit with `Set my goal`.

### Page 1 validation

- Goal type is required.
- Target must be an integer.
- Target must be between 800 and 6000 kcal.
- Invalid input stays on the page and shows an actionable message.
- The submit action is disabled while saving.
- Duplicate taps must not create duplicate active goals.

### Page 1 save states

1. Submit `PUT /v1/goals/current` with goal type, calorie target, and today’s date.
2. On success, request `GET /v1/dashboard/daily`.
3. Route to Page 2.
4. On failure, stay on Page 1 and show Retry.

## Flow 2 — Daily dashboard

### Page 2 — Today dashboard

1. Show the current date.
2. Show the active daily calorie target.
3. Show consumed calories.
4. Show remaining calories.
5. Show progress toward the target.
6. Show today’s meal count.
7. Show today’s active meals ordered by logged time.
8. Provide the primary `Log a meal` action.
9. Selecting a meal opens Page 4.
10. Pull-to-refresh or an equivalent refresh action reloads the dashboard.

### Page 2 empty state

- Show zero consumed calories.
- Show the full target as remaining calories.
- Show that no meals have been logged.
- Keep `Log a meal` as the primary action.

### Page 2 loading and failure states

- Initial loading: show a loading state before dashboard content is available.
- Refreshing: preserve current content and show a non-blocking refresh state.
- Failure with existing content: preserve the last known content and show Retry.
- Failure without existing content: show a full-page error and Retry.

## Flow 3 — Manual meal entry

### Page 3 — Add meal

1. Open from `Log a meal` on Page 2.
2. Enter a meal name directly, or select a known food from the optional local food
   suggestions.
3. Enter calories.
4. Optionally enter protein.
5. Optionally enter carbohydrates.
6. Optionally enter fat.
7. Optionally enter a note.
8. Use the current time as the v0 logged time.
9. Use `manual` as the v0 source.
10. Select breakfast, lunch, snacks, or dinner; this category is persisted with the meal.
11. Submit with `Save meal`.

### Page 3 validation

- Meal name is required and must not be blank; selecting a suggested food is optional.
- Calories are required and must be a non-negative integer.
- Optional nutrition values must be non-negative integers when provided.
- Show field-level or form-level actionable validation.
- Preserve entered values after validation failure.
- Disable Save meal while the request is in progress.
- Duplicate taps must create only one meal.

### Page 3 save states

1. Submit `POST /v1/meals`.
2. On success, return to Page 2.
3. Reload the daily dashboard.
4. Show the new meal and updated calorie totals.
5. On failure, keep the form values and show Retry.

## Flow 4 — Meal detail and management

### Page 4 — Meal detail

1. Open by selecting a meal on Page 2.
2. Show meal name, logged time, calories, optional nutrition values, and note.
3. Provide `Edit meal`.
4. Provide `Delete meal`.
5. Provide a way back to Page 2.

### Page 5 — Edit meal

1. Open from Page 4.
2. Pre-fill all existing meal values.
3. Allow the same fields as Page 3 to be edited.
4. Validate using the same rules as Page 3.
5. Submit `PATCH /v1/meals/:mealId`.
6. On success, return to Page 2 and reload totals.
7. On failure, preserve edits and show Retry.

### Page 6 — Delete confirmation

1. Open from Page 4 by selecting `Delete meal`.
2. Explain that the meal will be removed from today’s progress.
3. Provide Cancel.
4. Provide Delete.
5. Cancel returns to Page 4 without changes.
6. Delete submits `DELETE /v1/meals/:mealId`.
7. On success, return to Page 2 and reload totals.
8. On failure, keep the meal and show Retry.

## Flow 5 — Edit daily goal

1. Open from the dashboard goal summary.
2. Pre-fill the current goal type and daily calorie target.
3. Apply the same validation as first-run goal setup.
4. Save through `PUT /v1/goals/current`.
5. Return to the dashboard with the updated target and progress.
6. Cancel returns to the dashboard without changing persisted data.

## Persistence and restart flow

1. Create or reuse the guest token.
2. Save a goal.
3. Save one or more meals.
4. Force-close the app.
5. Reopen the app.
6. Reuse the locally stored guest token.
7. Load the same goal and dashboard from the API.
8. Confirm the meals and totals are unchanged.

## Navigation rules

- Page 0 routes to Page 1 or Page 2.
- Page 1 routes to Page 2 after a successful goal save.
- Page 2 routes to Page 3 or Page 4.
- Page 3 routes to Page 2 after a successful meal save.
- Page 4 routes to Page 5 or Page 6.
- Page 5 routes to Page 2 after a successful edit.
- Page 6 routes to Page 2 after a successful delete.
- Back or Cancel never changes persisted data.
- No placeholder navigation item should appear as an active feature in the final Phase 2 implementation.

## Figma handoff requirements

The Figma design should provide frames for:

- Page 0 loading, first run, returning user, and API failure.
- Page 1 default, validation error, saving, and save failure.
- Page 2 populated, empty, refreshing, and failure states.
- Page 3 blank, validation error, saving, and save failure.
- Page 4 normal detail, edit action, and delete action.
- Page 5 pre-filled, validation error, saving, and save failure.
- Page 6 confirmation, deleting, and delete failure.

Once the Figma frames are available, implementation will follow the Figma visual
system while preserving these functional states and API contracts.
