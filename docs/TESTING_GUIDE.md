# healthFlip: step-by-step test guide

This guide walks through every feature on the iPhone, in an order where each step sets up the next. Each step lists what to do and what you should see (✅). It takes about 45 minutes end to end.

## 0. Before you start

- **Which build:** the phone has the **Release** build, which talks to production (`https://healthflip-api.vercel.app`). It doesn't need your Mac or Metro.
- **Sample reports:** AirDrop the files in `docs/test-samples/` to the phone and save them to **Files**:
  - `sample-lipid-report.pdf` and `sample-lipid-report.png`: cholesterol, sugar and vitamin D are out of range;
  - `sample-kidney-report.pdf`: creatinine, eGFR and urea are out of range.
  - Also save `sample-lipid-report.png` to **Photos**, so you can test the photo upload.
- **Food photos:** have a real plate of food ready, or a food photo in Photos.
- **Start fresh:** if you've used the app before, go to Profile (top-left avatar), then **Reset healthFlip** → **Reset everything**.

## 1. Onboarding (chat with Flip)

1. Open healthFlip.
   - ✅ The boot screen says "Welcome! Glad you're here", then Flip's chat opens: "What should I call you?"
2. Type `I'm Priya` and send.
   - ✅ Your answer shows as "Priya". Flip asks your age.
3. Type `16`.
   - ✅ Flip kindly says plans are for adults 18+ and asks again. Type `30`.
4. Height: type `5'5`. Weight: tap or type `143 lb`.
   - ✅ Both are accepted (about 165 cm and 64.9 kg).
5. Tap **Female**, then **Moderately active**, then **Maintain**.
   - ✅ The header counts up to "7 of 7". Flip builds your plan and shows a card with calories and protein/carbs/fat, plus a short explanation.
6. Tap your earlier "30" answer.
   - ✅ Flip re-asks only your age. Answer `31`; the rest of your answers are kept.
7. Tap **Adjust calories**, then tap **+** twice.
   - ✅ The calories go up by 100 and the macros scale with them.
8. Tap **Start with this plan**.
   - ✅ Home opens with "Hi, Priya!" and the toast "Your plan is ready".

## 2. Home at a glance

1. Look at the top card.
   - ✅ It shows **Eaten 0 kcal**, **Left** (your target) and the ring. There's no calendar strip and no steps.
2. Tap **Details**.
   - ✅ It shows macro bars, "Goal: … kcal", Flip's nudge, and **Edit goal** and **Recalculate plan**. Close the app and reopen it: Details stays open. Tap **Less** to collapse it.
3. Check below the card.
   - ✅ An **Upload a test report** row, and the empty state "No meals yet … Log with Flip".

## 3. Logging meals (the **+** button)

### 3a. Typed meal with the item checklist
1. Tap **+** in the bottom bar.
   - ✅ The "Log a meal" chat opens. Flip asks what you had for the current meal, and that meal's tab is highlighted.
2. Tap **Lunch**, then type `2 rotis, a bowl of dal and some pickle` and send.
   - ✅ An estimate card lists **Roti, Dal, Pickle**. Each has a checkbox, `~grams`, −/+ buttons and kcal. Flip asks you to untick anything wrong or say what's missing.
3. Untick **Pickle**.
   - ✅ Pickle is struck through and the card's total kcal and macros drop.
4. Tap **+** next to Dal twice.
   - ✅ Dal goes up by 20 g and the totals rise.
5. Type `a glass of sweet lassi` and send.
   - ✅ "Added Sweet lassi…" appears and Lassi joins the list, ticked.
6. Tap **Log it**.
   - ✅ Flip says "Logged! … kcal left today. Anything else?"
7. Tap **Done**.
   - ✅ Home shows the meal named after its items (e.g. "Roti, Dal, Sweet lassi") with the time and "Lunch". **Eaten** and **Left** update, and the toast says "Meal logged. Nice one!"
8. Tap the meal.
   - ✅ Meal detail shows the note "Items: Roti ~80 g, Dal ~220 g, …". **Edit** opens the form, and **Delete** removes the meal after confirming.

### 3b. Photo meal
1. Tap **+**, then the **camera** icon, and photograph a plate. (Or use the **photo** icon to pick one.)
   - ✅ Your photo appears as a thumbnail, then a checklist of the foods Flip sees with weights. iPhone HEIC photos work.
2. Adjust anything, then tap **Log it** → **Done**.
   - ✅ The meal appears on Home.

### 3c. Correcting an estimate without items
- If an estimate comes back without a checklist (rare), tap **Not quite**, type e.g. `only 1 roti`, and send.
  - ✅ Flip re-estimates.

### 3d. Pick from list, and "Ask Flip"
1. Tap **+** → **Pick from list**, then the food dropdown.
   - ✅ The list sits above the keyboard and the form's other fields hide while it's open. "Your meals" shows the meal you logged in 3a with a **Flip** tag, above "Common foods".
2. Pick your saved meal.
   - ✅ Its calories and macros fill in. Save it.
3. Open **+** → **Pick from list** again and search `jalebi`.
   - ✅ "No foods match" appears, with **Ask Flip to estimate "jalebi"**.
4. Tap it.
   - ✅ The chat opens and Flip estimates jalebi straight away, keeping the meal type you had chosen.

## 4. Talking to Flip (voice)

1. On Home, tap **Ask Flip** (the pill above the nav).
   - ✅ The orb screen opens, connects, and Flip greets you by name.
2. Say: *"I had two idlis with sambar for breakfast."*
   - ✅ Flip replies and a meal card appears. Tap **Add** (or tap the mic): it's logged, and Home updates behind the voice screen.
3. Say: *"I'm vegetarian and allergic to peanuts."*
   - ✅ The notes "Remembered: …" appear.
4. Say: *"Make me a 3-day meal plan."*
   - ✅ "Creating your meal plan…" changes to "Saved … to Plans".
5. Say: *"Make me a workout plan."*
   - ✅ Flip kindly says workout plans aren't available yet.
6. Try Hindi or Hinglish: *"Maine aaj dal chawal khaya."*
   - ✅ The meal card still appears.
7. Tap the **keyboard** button.
   - ✅ The voice session ends and the text chat opens.

## 5. Health reports

### 5a. Upload, review and save
1. On Home, tap **Upload a test report**.
   - ✅ The Health reports screen has Camera / Photos / PDF buttons and the "file is never stored" note.
2. Tap **PDF** and choose `sample-lipid-report.pdf`.
   - ✅ "Reading your report…" with the orb, for 10–30 s.
3. Check the review screen.
   - ✅ Flip's summary ends with "discuss with your doctor".
   - ✅ The values are grouped as Lipids, Blood sugar, Vitamins & minerals, Thyroid and Vitals. Each shows its value, unit and **lab range**, and a flag: LDL 162 is **High**, HDL 38 is **Low**, TSH 2.1 is **In range**.
   - ✅ "Flip's food suggestions" holds food-level tips only, with no medication.
   - ✅ A **Daily water goal: 2.5–3 L** box is ticked.
4. Untick **TSH**.
   - ✅ The save button now says "Save 8 values".
5. Tap **Save**.
   - ✅ The report detail opens, and the toast says "Report saved…". Allow notifications when iOS asks.
6. Go back to Home.
   - ✅ The row shows "Full body checkup · date · 8 values to watch", and the **water card** shows "0 / 3 L".

### 5b. Kidney safety check
1. Open Health reports → **PDF** → `sample-kidney-report.pdf`.
   - ✅ Creatinine and urea are **High** and eGFR is **Low**.
   - ✅ **There is no water goal box.** Instead: "Ask your doctor how much fluid is right for you."
2. Tap back to discard it without saving (or save it, then delete it in 5d).

### 5c. Photo upload
- Use **Photos** and pick `sample-lipid-report.png`. You can multi-select up to 5 pages.
  - ✅ The same values are read as from the PDF.

### 5d. How reports shape the rest of the app
1. On the report detail, tap **Make a meal plan from this**.
   - ✅ Plans opens a new meal plan form with **Use my latest report** switched on. Create the plan.
   - ✅ The plan favours high-fibre, low-fried meals, and one tip mentions following your doctor's advice.
2. Log a sugary or fried snack in **+** (e.g. `2 samosas and a coke`).
   - ✅ The estimate card shows a green tip linked to your report.
3. On the report detail, tap **Ask Flip about this**, then say *"What does my LDL mean?"*
   - ✅ A calm, informational answer that compares the value with the lab range and suggests your doctor. No diagnosis.
4. On the report detail, tap **Delete report** → **Delete**.
   - ✅ It's removed and the Home row updates.

## 6. Water and reminders

1. On the water card, tap **+ 250 ml** twice.
   - ✅ It shows 0.5 / 3 L and the bar fills. **Long-press** to add 500 ml. **Undo** removes the last entry.
2. Tap **•••** → **Test: every 30 s**, then lock the phone.
   - ✅ "Flip 💧 (test)" notifications arrive every 30 seconds, 10 times. With the app open, they still show as banners.
3. Tap **•••** → **Remind me every 2 h**.
   - ✅ The test reminders stop. The card shows "Next reminder …" on the hour.
4. **•••** → **Change goal to 2.5 L** updates the card. **Remove water goal** hides the card and cancels reminders.
5. (Optional) In iOS Settings, turn healthFlip's notifications off, then set a goal again.
   - ✅ The app offers **Open Settings**.

## 7. Home Screen and Lock Screen widgets

1. Long-press the Home Screen → **+** → search **healthFlip**, and add the **small** and **medium** widgets.
   - ✅ They have a frosted glass look, with the ring showing kcal left, eaten / target, macro bars, and the water bar (if you have a goal) plus Flip's nudge or the next reminder.
2. Log a meal or some water in the app, then go back to the Home Screen.
   - ✅ The widgets update within a few seconds.
3. Tap **Log meal** on the medium widget.
   - ✅ The app opens straight into the add-meal chat. Tapping the water row or the ring opens Home.
4. Lock Screen: long-press it → **Customize** → add the **circular** and **rectangular** healthFlip widgets.
   - ✅ They show kcal left and water.
5. Switch the phone to Dark Mode.
   - ✅ The widgets turn into dark glass.
6. (Optional) After midnight.
   - ✅ The widget starts the new day at 0 eaten.

## 8. Plans tab

1. Open **Plans**.
   - ✅ Only **New meal plan** is offered. The plan Flip made by voice is listed.
2. Create a 7-day vegetarian plan.
   - ✅ The preview shows meals per day, and nothing is saved until you tap **Save plan**. Peanuts never appear, because of the allergy you mentioned in step 4.
3. Tap **Download PDF**.
   - ✅ The PDF opens in the iOS viewer and can be shared or saved.
4. Delete a plan.
   - ✅ It disappears from the list.

## 9. Profile and memory

1. Tap the avatar on Home.
   - ✅ Your details, **What Flip remembers** ("Vegetarian", "Allergic to peanuts"), **Health reports**, and **Reset healthFlip**.
2. Delete a memory (trash icon).
   - ✅ It's gone. Flip won't use it any more.
3. Change your weight and save.
   - ✅ You're offered "Recalculate my plan", which opens the chat at the goal question with "Welcome back, Priya!".

## 10. Progress and Tips

1. **Progress**
   - ✅ The last 7 or 30 days, averages, a calorie trend chart and a daily log. Tapping a day opens it read-only on Home, and **Back** returns to today.
2. **Tips**
   - ✅ Tips you can filter by category; tap one to read it.

## 11. Edge cases

| Try this | ✅ Expected |
|---|---|
| Airplane mode, then open the app | "We can't reach healthFlip" with **Retry**. Turn the network back on and Retry: it recovers |
| Airplane mode during **+** → send a meal | A friendly error and a **Try again** chip |
| A report photo that isn't a lab report (e.g. a selfie) | "That doesn't look like a health report…" |
| Very large PDF (> ~3 MB) | "That PDF is too large to upload… try photos of the pages" |
| Pull down on Home | It refreshes |
| Reset healthFlip (Profile) | Everything is cleared, reminders are cancelled, the widget goes empty, and onboarding starts again |

## 12. Backend checks (optional, from a Mac)

```bash
curl https://healthflip-api.vercel.app/health      # {"service":"healthflip-api","status":"ok"}
curl https://healthflip-api.vercel.app/health/ai   # {"provider":"gemini","live":true}
```

## Going back to development mode

The Release build doesn't use Metro. To test code changes live:
1. Start Postgres, the API (`npm run dev`) and Metro (`npm start`).
2. Rebuild and install the **Debug** configuration with `xcodebuild` / `devicectl` (see TECHNICAL_GUIDE).

The app then talks to your Mac's API instead of production.
