# Product Requirements Document (PRD): TDEE & Macro Dashboard

## 1. System Prompt & Harness Design Protocol (CRITICAL INSTRUCTIONS FOR CLAUDE CODE)
You are an autonomous AI coding agent. You MUST strictly follow the "Harness Design" architecture to maintain context, ensure code quality, and operate without human intervention. 

### Phase 1: Initializer Agent Phase (Do this first)
If this is the start of the project, create the following handover files in the root directory before writing any application code:
1. `feature_list.json`: A JSON array tracking all features and milestones (from Section 4 & 5). Track status as "pending", "in_progress", or "completed".
2. `claude-progress.md`: A markdown file acting as your memory. Log current context, what has been built, bugs, and the exact next steps.
3. `init.sh`: A shell script to start a local zero-cost dev server (e.g., `python3 -m http.server 8000` or `npx serve`) and run basic tests.

### Phase 2: Fixed Session Routine
For every task or new session, strictly loop through these steps:
1. **Read Context:** Read `claude-progress.md` and `feature_list.json`.
2. **Execute Init:** Run `init.sh` to test the current environment.
3. **Make (Maker Persona):** Pick ONE "pending" feature from `feature_list.json` and implement the code.
4. **Review (Reviewer Persona):** Switch your persona to "QA Reviewer". Review your own code for bugs, mobile responsiveness, and adherence to the 5 Core Constraints (Ads, Zero Cost, SEO, Data Collection). Fix issues immediately.
5. **Update State:** Mark the feature "completed" in `feature_list.json` and update `claude-progress.md`.
6. **Commit & Push (MANDATORY):** Execute `git add .`, `git commit -m "feat: [description]"`. **CRITICAL: You MUST execute `git push` to the remote repository immediately after completing any Milestone.** Do not wait for human permission.

---

## 2. Product Overview
- **Service Name:** TDEE Calculator & Macro Dashboard
- **Description:** A free web tool where users input their age, height, weight, gender, and activity level to calculate their Total Daily Energy Expenditure (TDEE). The result is displayed alongside a macronutrient breakdown (Carbs, Protein, Fat) using an interactive pie chart.
- **Core Logic:** Mifflin-St Jeor Equation.
- **Visuals:** Chart.js via CDN.

---

## 3. Core Business & Technical Constraints

### 3.1. Fast & Aggressive Monetization (Ads First)
- **Goal:** Generate revenue immediately.
- **Implementation:** Design the UI with highly visible placeholder slots for advertisements (e.g., Top Banner, Sidebar, In-content below the form, Sticky Bottom).
- **Ad Networks:** Prepare `<script>` placeholders for **Google AdSense**. Because AdSense approval is slow, you MUST also add easily swappable HTML/Script placeholders for fast-approval alternative networks like **Adsterra**, **PropellerAds**, or **Monetag**.

### 3.2. Absolute Zero Cost Infrastructure ($0)
- **Architecture:** The project must be entirely static (HTML, CSS, Vanilla JS) so it can be hosted for free on GitHub Pages, Vercel, or Netlify.
- **No Paid Backend:** NO paid databases or Node.js backends. Use free CDNs for styling (e.g., Tailwind CSS via CDN) and charting (Chart.js).

### 3.3. Advanced Search Engine Optimization (SEO)
- **HTML:** Use semantic HTML5 tags (`<main>`, `<section>`, `<article>`).
- **Meta Tags:** Include highly optimized Title, Description, and Keywords targeting "TDEE Calculator", "Macro Calculator", etc. Add Open Graph (OG) and Twitter Card tags.
- **Structured Data:** Implement JSON-LD Schema.org markup for a `SoftwareApplication` or `WebApplication` to ensure high ranking on Google Search.

### 3.4. 100% Responsive Design
- The UI must be Mobile-First.
- Ensure the calculator form and Chart.js dashboard scale perfectly on iPhones, iPads, and desktop monitors without horizontal scrolling.

### 3.5. Free Data Collection (Google Sheets Integration)
- **Goal:** Silently and freely collect inputted data (Age, Gender, Weight, Height, Activity Level, Calculated TDEE) for future use.
- **Implementation:** Whenever a user clicks "Calculate", use a JavaScript `fetch()` POST request (with `mode: 'no-cors'`) to silently send the input data to a **Google Apps Script Web App URL**.
- Leave a placeholder constant `const GOOGLE_SHEETS_WEBHOOK_URL = "";` in the JS file. Ensure this fetch request is asynchronous and does not interrupt the calculator's UX.

---

## 4. Feature Specifications
- **Input Form:** Gender (Radio), Age (Number), Weight (kg), Height (cm), Activity Level (Dropdown: Sedentary 1.2, Light 1.375, Moderate 1.55, Active 1.725, Very Active 1.9).
- **TDEE Logic:**
  - Men BMR = `(10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5`
  - Women BMR = `(10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161`
  - TDEE = BMR × Activity Multiplier.
- **Macro Logic:** Standard balanced diet (50% Carbs, 30% Protein, 20% Fat). 1g Carb/Protein = 4kcal, 1g Fat = 9kcal.
- **Dashboard:** Display TDEE clearly. Render a responsive Pie or Doughnut chart showing the Macro split using Chart.js.

---

## 5. Milestones & Git Strategy
**(CRITICAL: YOU MUST EXECUTE `git push` IMMEDIATELY AFTER FINISHING EACH MILESTONE)**

- **Milestone 1: Harness Setup & Boilerplate**
  - Create the Initializer files (`feature_list.json`, `claude-progress.md`, `init.sh`). Set up the basic HTML/CSS/JS files.
  - *Action:* `git add .` -> `git commit -m "chore: setup harness and boilerplate"` -> **`git push`**

- **Milestone 2: SEO, Ad Slots & Responsive UI Layout**
  - Build the mobile-first layout. Add SEO meta tags, JSON-LD, and advertisement placeholder zones.
  - *Action:* `git add .` -> `git commit -m "feat: responsive UI, SEO, and ad slots"` -> **`git push`**

- **Milestone 3: Core Calculator & Chart.js Integration**
  - Implement Mifflin-St Jeor math logic. Connect Chart.js to render the macro breakdown dynamically.
  - *Action:* `git add .` -> `git commit -m "feat: implement TDEE logic and chart.js dashboard"` -> **`git push`**

- **Milestone 4: Free Data Collection Engine**
  - Implement the `fetch()` API to send user input data asynchronously to the Google Sheets webhook placeholder.
  - *Action:* `git add .` -> `git commit -m "feat: integrate free data collection via Google Sheets webhook"` -> **`git push`**

- **Milestone 5: QA Review & Final Polish**
  - Act as the Reviewer Agent: test UI responsiveness, ensure zero console errors, verify Ad/SEO codes.
  - *Action:* `git add .` -> `git commit -m "fix: final QA, bug fixes, and polish"` -> **`git push`**

**END OF PRD. CLAUDE CODE, START YOUR WORK NOW BY EXECUTING PHASE 1.**