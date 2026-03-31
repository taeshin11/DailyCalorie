// ===== TDEE Calculator & Macro Dashboard =====

// Google Sheets Webhook Placeholder
const GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxgPKsI400PFBzPAoqqYeFYTsBGL4Pnwg_vynZu0VOu42PkK-JIoyw7lVOKIrHU2dPC/exec";

// ===== Cookie Consent =====
function hasConsentChoice() { return localStorage.getItem("tdee_consent") !== null; }
function hasConsented() { return localStorage.getItem("tdee_consent") === "true"; }
function acceptCookies() {
    localStorage.setItem("tdee_consent", "true");
    document.getElementById("cookie-consent").style.display = "none";
}
function declineCookies() {
    localStorage.setItem("tdee_consent", "false");
    document.getElementById("cookie-consent").style.display = "none";
}
(function showConsentBanner() {
    if (!hasConsentChoice()) {
        var banner = document.getElementById("cookie-consent");
        if (banner) banner.style.display = "block";
    }
})();

// DOM Elements
const form = document.getElementById("tdee-form");
const resultsSection = document.getElementById("results");

// State
let macroChart = null;
let currentUnit = "metric";
let currentDiet = "balanced";
let currentMeals = 3;
let lastTDEE = 0;
let lastBMR = 0;
let lastWeightKg = 0;
let lastHeightCm = 0;
let lastGender = "male";
let lastAge = 0;

// Diet plan presets: { carbs%, protein%, fat% }
const DIET_PLANS = {
    "balanced":      { carbs: 0.50, protein: 0.30, fat: 0.20, label: "Balanced" },
    "low-carb":      { carbs: 0.25, protein: 0.35, fat: 0.40, label: "Low Carb" },
    "high-protein":  { carbs: 0.30, protein: 0.40, fat: 0.30, label: "High Protein" },
    "keto":          { carbs: 0.05, protein: 0.25, fat: 0.70, label: "Keto" },
};

// ===== Unit Toggle =====
function setUnit(unit) {
    currentUnit = unit;
    document.getElementById("btn-metric").classList.toggle("active", unit === "metric");
    document.getElementById("btn-imperial").classList.toggle("active", unit === "imperial");

    if (unit === "imperial") {
        document.getElementById("height-metric").classList.add("hidden");
        document.getElementById("height-imperial").classList.remove("hidden");
        document.getElementById("weight-label").textContent = "Weight (lbs)";
        document.getElementById("weight").placeholder = "154";
    } else {
        document.getElementById("height-metric").classList.remove("hidden");
        document.getElementById("height-imperial").classList.add("hidden");
        document.getElementById("weight-label").textContent = "Weight (kg)";
        document.getElementById("weight").placeholder = "70";
    }

    saveToLocalStorage();
}

// ===== TDEE Calculation (Mifflin-St Jeor / Katch-McArdle) =====
function calculateTDEE(gender, age, weightKg, heightCm, activityMultiplier, bodyFatPct) {
    let bmr;
    let formula = "mifflin";
    if (bodyFatPct && bodyFatPct > 0) {
        // Katch-McArdle (more accurate when body fat is known)
        var leanMass = weightKg * (1 - bodyFatPct / 100);
        bmr = 370 + (21.6 * leanMass);
        formula = "katch";
    } else if (gender === "male") {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
    const tdee = bmr * activityMultiplier;
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), formula: formula };
}

// ===== BMI Calculation =====
function calculateBMI(weightKg, heightCm) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
}

function getBMICategory(bmi) {
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-300", pct: (bmi / 40) * 100 };
    if (bmi < 25)   return { label: "Normal weight", color: "text-emerald-300", pct: (bmi / 40) * 100 };
    if (bmi < 30)   return { label: "Overweight", color: "text-amber-300", pct: (bmi / 40) * 100 };
    return { label: "Obese", color: "text-red-300", pct: Math.min((bmi / 40) * 100, 98) };
}

// ===== Macro Calculation =====
function calculateMacros(tdee, dietKey) {
    const plan = DIET_PLANS[dietKey];
    const carbsCal = tdee * plan.carbs;
    const proteinCal = tdee * plan.protein;
    const fatCal = tdee * plan.fat;

    return {
        carbs:   { grams: Math.round(carbsCal / 4), kcal: Math.round(carbsCal), pct: Math.round(plan.carbs * 100) },
        protein: { grams: Math.round(proteinCal / 4), kcal: Math.round(proteinCal), pct: Math.round(plan.protein * 100) },
        fat:     { grams: Math.round(fatCal / 9), kcal: Math.round(fatCal), pct: Math.round(plan.fat * 100) },
    };
}

// ===== Animated Number Counter =====
function animateValue(el, start, end, duration) {
    const range = end - start;
    if (range === 0) { el.textContent = end.toLocaleString(); return; }
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = Math.round(start + range * eased);
        el.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ===== Try Example (Demo) =====
function tryExample() {
    setUnit("metric");
    var maleRadio = document.querySelector('input[name="gender"][value="male"]');
    if (maleRadio) maleRadio.checked = true;
    document.getElementById("age").value = "25";
    document.getElementById("weight").value = "70";
    document.getElementById("height").value = "175";
    document.getElementById("activity").value = "1.55";
    form.dispatchEvent(new Event("submit"));
}

// ===== Show/Hide Math Breakdown =====
function toggleMath() {
    var el = document.getElementById("math-breakdown");
    var btn = document.getElementById("math-toggle-btn");
    if (el.classList.contains("hidden")) {
        el.classList.remove("hidden");
        btn.textContent = "Hide calculation";
    } else {
        el.classList.add("hidden");
        btn.textContent = "Show calculation";
    }
}

function updateMathBreakdown(gender, age, weightKg, heightCm, activityMultiplier, bmr, tdee, formulaType, bodyFatPct) {
    var el = document.getElementById("math-breakdown");
    var html = "";

    if (formulaType === "katch" && bodyFatPct > 0) {
        var leanMass = (weightKg * (1 - bodyFatPct / 100)).toFixed(1);
        html =
            '<p class="text-indigo-400/80 mb-1 font-sans text-[10px] uppercase tracking-wider">Katch-McArdle Formula (body fat known)</p>' +
            '<p>Lean Mass = ' + weightKg.toFixed(1) + ' x (1 - ' + bodyFatPct + '%) = ' + leanMass + ' kg</p>' +
            '<p>BMR = 370 + (21.6 x ' + leanMass + ')</p>' +
            '<p class="text-indigo-200">BMR = <strong>' + bmr.toLocaleString() + ' kcal</strong></p>';
    } else {
        var genderOffset = gender === "male" ? "+ 5" : "- 161";
        html =
            '<p class="text-indigo-400/80 mb-1 font-sans text-[10px] uppercase tracking-wider">Mifflin-St Jeor Equation (' + gender + ')</p>' +
            '<p>BMR = (10 x ' + weightKg.toFixed(1) + ') + (6.25 x ' + heightCm.toFixed(1) + ') - (5 x ' + age + ') ' + genderOffset + '</p>' +
            '<p>BMR = ' + (10 * weightKg).toFixed(0) + ' + ' + (6.25 * heightCm).toFixed(0) + ' - ' + (5 * age) + ' ' + genderOffset + '</p>' +
            '<p class="text-indigo-200">BMR = <strong>' + bmr.toLocaleString() + ' kcal</strong></p>';
    }

    html +=
        '<p class="mt-2">TDEE = BMR x Activity Multiplier</p>' +
        '<p>TDEE = ' + bmr.toLocaleString() + ' x ' + activityMultiplier + '</p>' +
        '<p class="text-emerald-300">TDEE = <strong>' + tdee.toLocaleString() + ' kcal/day</strong></p>';

    el.innerHTML = html;
}

// ===== Activity Level Data =====
var ACTIVITY_LEVELS = [
    { value: 1.2,   label: "Sedentary" },
    { value: 1.375, label: "Lightly Active" },
    { value: 1.55,  label: "Moderately Active" },
    { value: 1.725, label: "Very Active" },
    { value: 1.9,   label: "Extra Active" },
];

// ===== Update UI =====
function updateResults(bmr, tdee, activityMultiplier, macros, weightKg, heightCm) {
    var prevTDEE = lastTDEE;
    lastTDEE = tdee;
    lastBMR = bmr;
    lastWeightKg = weightKg;
    lastHeightCm = heightCm;
    lastGender = document.querySelector('input[name="gender"]:checked').value;
    lastAge = parseFloat(document.getElementById("age").value);

    animateValue(document.getElementById("tdee-value"), prevTDEE, tdee, 600);
    document.getElementById("bmr-value").textContent = bmr.toLocaleString();
    document.getElementById("multiplier-value").textContent = activityMultiplier + "x";

    document.getElementById("cut-value").textContent = Math.max(1200, tdee - 500).toLocaleString();
    document.getElementById("maintain-value").textContent = tdee.toLocaleString();
    document.getElementById("bulk-value").textContent = (tdee + 500).toLocaleString();

    // BMI
    var bmi = calculateBMI(weightKg, heightCm);
    var bmiCat = getBMICategory(bmi);
    document.getElementById("bmi-value").textContent = bmi.toFixed(1);
    document.getElementById("bmi-value").className = "text-2xl font-bold " + bmiCat.color;
    document.getElementById("bmi-label").textContent = bmiCat.label;
    document.getElementById("bmi-label").className = "text-sm mb-3 " + bmiCat.color;
    document.getElementById("bmi-dot").style.left = bmiCat.pct + "%";

    // Water intake: ~33ml per kg body weight
    var waterLiters = (weightKg * 0.033).toFixed(1);
    document.getElementById("water-value").textContent = waterLiters + "L";

    // Minimum protein recommendation: 0.8g per kg (sedentary) to 1.6g (active)
    var proteinPerKg = activityMultiplier >= 1.55 ? 1.6 : (activityMultiplier >= 1.375 ? 1.2 : 0.8);
    document.getElementById("protein-rec-value").textContent = Math.round(weightKg * proteinPerKg) + "g";

    // Goal weight label
    document.getElementById("goal-weight-label").textContent = "Target Weight (" + (currentUnit === "imperial" ? "lbs" : "kg") + ")";

    updateMacroUI(macros, tdee);
    updateActivityTable(bmr, activityMultiplier);
    updateMealPlan(macros);
    updateBodyComposition(weightKg, heightCm, lastGender, lastAge);
    updateZigzag(tdee);
    updateEquivalents(tdee);
    updateTips();
    resultsSection.classList.remove("hidden");
    renderChart(macros);
    renderMealLog();
    staggerReveal();
    showConfetti();
}

function updateMacroUI(macros, tdee) {
    document.getElementById("carbs-grams").textContent = macros.carbs.grams + "g";
    document.getElementById("carbs-kcal").textContent = macros.carbs.kcal.toLocaleString();
    document.getElementById("carbs-bar").style.width = macros.carbs.pct + "%";
    document.getElementById("carbs-pct").textContent = "(" + macros.carbs.pct + "%)";

    document.getElementById("protein-grams").textContent = macros.protein.grams + "g";
    document.getElementById("protein-kcal").textContent = macros.protein.kcal.toLocaleString();
    document.getElementById("protein-bar").style.width = macros.protein.pct + "%";
    document.getElementById("protein-pct").textContent = "(" + macros.protein.pct + "%)";

    document.getElementById("fat-grams").textContent = macros.fat.grams + "g";
    document.getElementById("fat-kcal").textContent = macros.fat.kcal.toLocaleString();
    document.getElementById("fat-bar").style.width = macros.fat.pct + "%";
    document.getElementById("fat-pct").textContent = "(" + macros.fat.pct + "%)";

    document.getElementById("chart-center-cal").textContent = tdee.toLocaleString();
}

// ===== Diet Plan Selector =====
function selectDiet(dietKey) {
    currentDiet = dietKey;
    document.querySelectorAll(".diet-btn").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.diet === dietKey);
    });

    // Show/hide custom sliders
    var sliders = document.getElementById("custom-sliders");
    if (dietKey === "custom") {
        sliders.classList.remove("hidden");
    } else {
        sliders.classList.add("hidden");
    }

    if (lastTDEE > 0) {
        var macros = calculateMacros(lastTDEE, dietKey);
        updateMacroUI(macros, lastTDEE);
        renderChart(macros);
    }
}

// ===== Custom Macro Sliders =====
function onCustomSlider() {
    var c = parseInt(document.getElementById("slider-carbs").value);
    var p = parseInt(document.getElementById("slider-protein").value);
    var f = parseInt(document.getElementById("slider-fat").value);
    var total = c + p + f;

    document.getElementById("slider-carbs-val").textContent = c + "%";
    document.getElementById("slider-protein-val").textContent = p + "%";
    document.getElementById("slider-fat-val").textContent = f + "%";

    var msgEl = document.getElementById("slider-total-msg");
    if (total === 100) {
        msgEl.innerHTML = '<span class="text-emerald-400">Total: 100%</span>';
    } else {
        msgEl.innerHTML = '<span class="text-red-400">Total: ' + total + '% (must equal 100%)</span>';
    }

    // Update custom diet plan
    DIET_PLANS["custom"] = { carbs: c / 100, protein: p / 100, fat: f / 100, label: "Custom (" + c + "/" + p + "/" + f + ")" };

    if (total === 100 && lastTDEE > 0) {
        var macros = calculateMacros(lastTDEE, "custom");
        updateMacroUI(macros, lastTDEE);
        renderChart(macros);
    }
}
// Init custom plan
DIET_PLANS["custom"] = { carbs: 0.50, protein: 0.30, fat: 0.20, label: "Custom" };

// ===== Chart.js Doughnut Chart =====
function renderChart(macros) {
    const ctx = document.getElementById("macro-chart").getContext("2d");
    const data = [macros.carbs.kcal, macros.protein.kcal, macros.fat.kcal];

    if (macroChart) {
        macroChart.data.datasets[0].data = data;
        macroChart.update();
        return;
    }

    macroChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Carbs", "Protein", "Fat"],
            datasets: [{
                data: data,
                backgroundColor: ["#f59e0b", "#10b981", "#a855f7"],
                borderColor: ["#d97706", "#059669", "#9333ea"],
                borderWidth: 2,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: "65%",
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "rgba(15, 10, 46, 0.9)",
                    titleColor: "#c7d2fe",
                    bodyColor: "#e0e7ff",
                    borderColor: "rgba(99, 102, 241, 0.3)",
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            var label = context.label;
                            var value = context.raw;
                            var total = context.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                            var pct = Math.round((value / total) * 100);
                            return label + ": " + value + " kcal (" + pct + "%)";
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                duration: 800,
                easing: "easeOutQuart",
            }
        },
    });
}

// ===== Data Collection (Google Sheets) =====
function sendToGoogleSheets(data) {
    if (!GOOGLE_SHEETS_WEBHOOK_URL || !hasConsented()) return;

    fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    }).catch(function() {
        // Silent fail — do not interrupt UX
    });
}

// ===== Inline Error Display =====
function showError(msg) {
    var el = document.getElementById("form-error");
    if (!el) {
        el = document.createElement("div");
        el.id = "form-error";
        el.setAttribute("role", "alert");
        el.className = "bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3 mt-2";
        form.insertBefore(el, form.querySelector("button"));
    }
    el.textContent = msg;
}

function clearErrors() {
    var el = document.getElementById("form-error");
    if (el) el.remove();
}

// ===== Form Validation =====
function validateForm(age, weight, height) {
    if (!age || age < 10 || age > 120) return "Please enter a valid age (10-120).";
    if (currentUnit === "metric") {
        if (!weight || weight < 20 || weight > 400) return "Please enter a valid weight (20-400 kg).";
        if (!height || height < 50 || height > 300) return "Please enter a valid height (50-300 cm).";
    } else {
        if (!weight || weight < 44 || weight > 882) return "Please enter a valid weight (44-882 lbs).";
        if (!height || height < 0) return "Please enter a valid height.";
    }
    return null;
}

// ===== Unit Conversion =====
function getWeightKg(rawWeight) {
    return currentUnit === "imperial" ? rawWeight * 0.453592 : rawWeight;
}

function getHeightCm() {
    if (currentUnit === "imperial") {
        var ft = parseFloat(document.getElementById("height-ft").value) || 0;
        var inches = parseFloat(document.getElementById("height-in").value) || 0;
        return (ft * 30.48) + (inches * 2.54);
    }
    return parseFloat(document.getElementById("height").value);
}

// ===== LocalStorage =====
function saveToLocalStorage() {
    try {
        var data = {
            unit: currentUnit,
            gender: document.querySelector('input[name="gender"]:checked').value,
            age: document.getElementById("age").value,
            weight: document.getElementById("weight").value,
            height: document.getElementById("height").value,
            heightFt: document.getElementById("height-ft").value,
            heightIn: document.getElementById("height-in").value,
            activity: document.getElementById("activity").value,
            diet: currentDiet,
        };
        localStorage.setItem("tdee_inputs", JSON.stringify(data));
    } catch(e) {}
}

function loadFromLocalStorage() {
    try {
        var raw = localStorage.getItem("tdee_inputs");
        if (!raw) return;
        var data = JSON.parse(raw);

        if (data.unit) setUnit(data.unit);
        if (data.gender) {
            var radio = document.querySelector('input[name="gender"][value="' + data.gender + '"]');
            if (radio) radio.checked = true;
        }
        if (data.age) document.getElementById("age").value = data.age;
        if (data.weight) document.getElementById("weight").value = data.weight;
        if (data.height) document.getElementById("height").value = data.height;
        if (data.heightFt) document.getElementById("height-ft").value = data.heightFt;
        if (data.heightIn) document.getElementById("height-in").value = data.heightIn;
        if (data.activity) document.getElementById("activity").value = data.activity;
        if (data.diet) selectDiet(data.diet);
    } catch(e) {}
}

// ===== Activity Level Comparison Table =====
function updateActivityTable(bmr, currentMultiplier) {
    var tbody = document.getElementById("activity-table-body");
    tbody.innerHTML = "";
    ACTIVITY_LEVELS.forEach(function(level) {
        var cal = Math.round(bmr * level.value);
        var diff = cal - Math.round(bmr * currentMultiplier);
        var diffText = diff === 0 ? "-" : (diff > 0 ? "+" : "") + diff.toLocaleString();
        var isCurrent = level.value === currentMultiplier;
        var row = document.createElement("tr");
        row.className = (isCurrent ? "activity-row-current " : "") + "border-b border-indigo-500/5";
        row.innerHTML =
            '<td class="py-2.5 pr-4 text-indigo-100' + (isCurrent ? ' font-semibold' : '') + '">' +
                level.label + (isCurrent ? ' <span class="text-xs text-indigo-400">(current)</span>' : '') +
            '</td>' +
            '<td class="py-2.5 px-2 text-right font-mono' + (isCurrent ? ' text-emerald-300 font-semibold' : ' text-indigo-200') + '">' +
                cal.toLocaleString() +
            '</td>' +
            '<td class="py-2.5 pl-2 text-right text-xs hidden sm:table-cell ' +
                (diff > 0 ? 'text-blue-300' : diff < 0 ? 'text-red-300' : 'text-indigo-300/40') + '">' +
                diffText +
            '</td>';
        tbody.appendChild(row);
    });
}

// ===== Meal Planner =====
function setMeals(n) {
    currentMeals = n;
    document.querySelectorAll(".meal-btn").forEach(function(btn) {
        btn.classList.toggle("active", parseInt(btn.dataset.meals) === n);
    });
    if (lastTDEE > 0) {
        var macros = calculateMacros(lastTDEE, currentDiet);
        updateMealPlan(macros);
    }
}

function updateMealPlan(macros) {
    var grid = document.getElementById("meal-grid");
    grid.innerHTML = "";
    var mealNames3 = ["Breakfast", "Lunch", "Dinner"];
    var mealNames4 = ["Breakfast", "Lunch", "Snack", "Dinner"];
    var mealNames5 = ["Breakfast", "Snack", "Lunch", "Snack", "Dinner"];
    var names = currentMeals === 3 ? mealNames3 : currentMeals === 4 ? mealNames4 : mealNames5;

    // Adjust grid columns
    grid.className = "grid grid-cols-1 gap-3";
    if (currentMeals <= 3) grid.className += " sm:grid-cols-3";
    else if (currentMeals === 4) grid.className += " sm:grid-cols-2 md:grid-cols-4";
    else grid.className += " sm:grid-cols-3 md:grid-cols-5";

    for (var i = 0; i < currentMeals; i++) {
        var carbsG = Math.round(macros.carbs.grams / currentMeals);
        var proteinG = Math.round(macros.protein.grams / currentMeals);
        var fatG = Math.round(macros.fat.grams / currentMeals);
        var totalCal = Math.round((macros.carbs.kcal + macros.protein.kcal + macros.fat.kcal) / currentMeals);

        var card = document.createElement("div");
        card.className = "glass rounded-xl p-4 text-center border border-indigo-500/10";
        card.innerHTML =
            '<p class="text-xs text-indigo-400/80 uppercase tracking-wider mb-2">' + names[i] + '</p>' +
            '<p class="text-lg font-bold text-white mb-2">' + totalCal.toLocaleString() + ' <span class="text-xs text-indigo-300/40 font-normal">kcal</span></p>' +
            '<div class="flex justify-center gap-3 text-[10px]">' +
                '<span class="text-amber-300">C: ' + carbsG + 'g</span>' +
                '<span class="text-emerald-300">P: ' + proteinG + 'g</span>' +
                '<span class="text-purple-300">F: ' + fatG + 'g</span>' +
            '</div>';
        grid.appendChild(card);
    }
}

// ===== Weight Goal Timeline =====
function calculateGoalTimeline() {
    if (lastTDEE === 0 || lastWeightKg === 0) return;

    var goalWeightRaw = parseFloat(document.getElementById("goal-weight").value);
    if (!goalWeightRaw || goalWeightRaw <= 0) {
        document.getElementById("goal-result").classList.add("hidden");
        return;
    }

    var goalWeightKg = currentUnit === "imperial" ? goalWeightRaw * 0.453592 : goalWeightRaw;
    var ratePerWeek = parseFloat(document.getElementById("goal-rate").value);
    var diff = lastWeightKg - goalWeightKg;
    var isLosing = diff > 0;
    var absDiff = Math.abs(diff);

    if (absDiff < 0.1) {
        document.getElementById("goal-result").classList.remove("hidden");
        document.getElementById("goal-direction").textContent = "You're already there!";
        document.getElementById("goal-weeks").textContent = "0 weeks";
        document.getElementById("goal-detail").textContent = "Your current weight matches your goal.";
        document.getElementById("goal-calories").textContent = "";
        return;
    }

    var weeks = Math.ceil(absDiff / ratePerWeek);
    var calAdjust = Math.round(ratePerWeek * 7700 / 7); // 7700 kcal per kg of body weight

    document.getElementById("goal-result").classList.remove("hidden");
    document.getElementById("goal-direction").textContent = isLosing ? "Weight Loss Goal" : "Weight Gain Goal";
    document.getElementById("goal-weeks").textContent = weeks + (weeks === 1 ? " week" : " weeks");

    var unit = currentUnit === "imperial" ? "lbs" : "kg";
    var displayDiff = currentUnit === "imperial" ? (absDiff / 0.453592).toFixed(1) : absDiff.toFixed(1);
    document.getElementById("goal-detail").textContent = displayDiff + " " + unit + " to " + (isLosing ? "lose" : "gain") + " (~" + Math.round(weeks / 4.33) + " months)";
    document.getElementById("goal-calories").textContent = "Eat " + (isLosing ? (lastTDEE - calAdjust) : (lastTDEE + calAdjust)).toLocaleString() + " kcal/day (" + (isLosing ? "-" : "+") + calAdjust + " from TDEE)";
}

// ===== Body Composition Estimate =====
function estimateBodyFat(bmi, age, gender) {
    // Deurenberg formula: BF% = 1.20 × BMI + 0.23 × Age - 10.8 × sex - 5.4 (sex: 1=male, 0=female)
    var sex = gender === "male" ? 1 : 0;
    var bf = (1.20 * bmi) + (0.23 * age) - (10.8 * sex) - 5.4;
    return Math.max(3, Math.min(bf, 60));
}

function updateBodyComposition(weightKg, heightCm, gender, age) {
    var bmi = calculateBMI(weightKg, heightCm);
    var bf = estimateBodyFat(bmi, age, gender);
    var leanMass = weightKg * (1 - bf / 100);
    var heightM = heightCm / 100;
    var idealLow = (18.5 * heightM * heightM).toFixed(0);
    var idealHigh = (24.9 * heightM * heightM).toFixed(0);

    document.getElementById("bodyfat-value").textContent = bf.toFixed(1) + "%";
    var unit = currentUnit === "imperial" ? "lbs" : "kg";
    var lm = currentUnit === "imperial" ? (leanMass / 0.453592).toFixed(0) : leanMass.toFixed(1);
    document.getElementById("lean-mass-value").textContent = lm + " " + unit;

    if (currentUnit === "imperial") {
        idealLow = (idealLow / 0.453592).toFixed(0);
        idealHigh = (idealHigh / 0.453592).toFixed(0);
    }
    document.getElementById("ideal-weight-value").textContent = idealLow + "-" + idealHigh + " " + unit;
}

// ===== Zigzag Calorie Cycling =====
function updateZigzag(tdee) {
    var grid = document.getElementById("zigzag-grid");
    grid.innerHTML = "";
    var days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    // Pattern: alternate high and low days, totaling 7 x tdee
    var pattern = [1.0, 0.85, 1.1, 0.9, 1.15, 0.85, 1.15];
    var total = 0;
    var maxCal = tdee * 1.15;

    for (var i = 0; i < 7; i++) {
        var cal = Math.round(tdee * pattern[i]);
        total += cal;
        var barPct = Math.round((cal / maxCal) * 100);
        var isHigh = pattern[i] >= 1.0;

        var col = document.createElement("div");
        col.className = "flex flex-col items-center";
        col.innerHTML =
            '<div class="text-[10px] font-mono mb-1 ' + (isHigh ? 'text-emerald-300' : 'text-amber-300') + '">' + cal.toLocaleString() + '</div>' +
            '<div class="w-full bg-white/5 rounded-full overflow-hidden" style="height:60px">' +
                '<div class="zigzag-day w-full rounded-full ' + (isHigh ? 'bg-gradient-to-t from-emerald-500/60 to-emerald-400/30' : 'bg-gradient-to-t from-amber-500/60 to-amber-400/30') + '" style="height:' + barPct + '%;margin-top:' + (100 - barPct) + '%"></div>' +
            '</div>' +
            '<div class="text-[10px] text-indigo-300/40 mt-1">' + days[i] + '</div>';
        grid.appendChild(col);
    }

    document.getElementById("zigzag-weekly").textContent = total.toLocaleString();
    document.getElementById("zigzag-avg").textContent = Math.round(total / 7).toLocaleString();
}

// ===== Calorie Equivalents =====
function updateEquivalents(tdee) {
    var grid = document.getElementById("equivalents-grid");
    grid.innerHTML = "";
    var items = [
        { emoji: "&#127829;", name: "Slices of Pizza", cal: 285 },
        { emoji: "&#127828;", name: "Big Macs", cal: 550 },
        { emoji: "&#129385;", name: "Chicken Breasts", cal: 165 },
        { emoji: "&#127834;", name: "Bowls of Rice", cal: 206 },
        { emoji: "&#127822;", name: "Apples", cal: 95 },
        { emoji: "&#129371;", name: "Avocados", cal: 240 },
        { emoji: "&#127846;", name: "Scoops Ice Cream", cal: 137 },
        { emoji: "&#129382;", name: "Eggs", cal: 78 },
    ];

    items.forEach(function(item) {
        var count = (tdee / item.cal).toFixed(1);
        var card = document.createElement("div");
        card.className = "equiv-card glass rounded-xl p-3 text-center border border-indigo-500/10";
        card.innerHTML =
            '<div class="text-2xl mb-1">' + item.emoji + '</div>' +
            '<div class="text-lg font-bold text-white">' + count + '</div>' +
            '<div class="text-[10px] text-indigo-300/50">' + item.name + '</div>';
        grid.appendChild(card);
    });
}

// ===== History Tracker =====
function saveToHistory(data) {
    try {
        var history = JSON.parse(localStorage.getItem("tdee_history") || "[]");
        history.unshift({
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            tdee: data.tdee,
            bmr: data.bmr,
            bmi: calculateBMI(data.weightKg, data.heightCm).toFixed(1),
            weight: data.weightKg,
            diet: currentDiet,
        });
        if (history.length > 20) history = history.slice(0, 20);
        localStorage.setItem("tdee_history", JSON.stringify(history));
        renderHistory();
        renderHistoryChart();
    } catch(e) {}
}

function renderHistory() {
    try {
        var history = JSON.parse(localStorage.getItem("tdee_history") || "[]");
        var list = document.getElementById("history-list");
        if (history.length === 0) {
            list.innerHTML = '<p class="text-xs text-indigo-300/40 text-center py-2">No calculations yet</p>';
            return;
        }
        list.innerHTML = "";
        history.forEach(function(entry) {
            var unit = currentUnit === "imperial" ? "lbs" : "kg";
            var w = currentUnit === "imperial" ? (entry.weight / 0.453592).toFixed(0) : entry.weight.toFixed(1);
            var row = document.createElement("div");
            row.className = "flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition text-xs";
            row.innerHTML =
                '<div class="text-indigo-300/60">' + entry.date + ' ' + entry.time + '</div>' +
                '<div class="flex gap-4">' +
                    '<span class="text-indigo-200">' + w + ' ' + unit + '</span>' +
                    '<span class="text-emerald-300 font-semibold">' + entry.tdee.toLocaleString() + ' kcal</span>' +
                    '<span class="text-indigo-300/40">BMI ' + entry.bmi + '</span>' +
                '</div>';
            list.appendChild(row);
        });
    } catch(e) {}
}

function clearHistory() {
    localStorage.removeItem("tdee_history");
    renderHistory();
}

// ===== Share (Web Share API) =====
function shareResults() {
    if (lastTDEE === 0) return;
    var macros = calculateMacros(lastTDEE, currentDiet);
    var text = "My TDEE: " + lastTDEE.toLocaleString() + " kcal/day | " +
        "Macros (" + DIET_PLANS[currentDiet].label + "): " +
        macros.carbs.grams + "g carbs, " + macros.protein.grams + "g protein, " + macros.fat.grams + "g fat";

    if (navigator.share) {
        navigator.share({ title: "My TDEE Results", text: text, url: window.location.href }).catch(function(){});
    } else {
        navigator.clipboard.writeText(text).then(function() {
            var btn = document.getElementById("share-btn-text");
            btn.textContent = "Link copied!";
            setTimeout(function() { btn.textContent = "Share"; }, 2000);
        });
    }
}

// ===== Staggered Reveal Animation =====
function staggerReveal() {
    var sections = resultsSection.querySelectorAll(".glass, .result-card, .grid");
    sections.forEach(function(el) { el.classList.add("reveal"); });
    sections.forEach(function(el, i) {
        setTimeout(function() { el.classList.add("visible"); }, i * 80);
    });
}

// ===== Copy Results =====
function copyResults() {
    if (lastTDEE === 0) return;
    var macros = calculateMacros(lastTDEE, currentDiet);
    var bmi = calculateBMI(lastWeightKg, lastHeightCm);
    var text = "TDEE Calculator Results\n" +
        "========================\n" +
        "TDEE: " + lastTDEE.toLocaleString() + " kcal/day\n" +
        "BMR: " + lastBMR.toLocaleString() + " kcal\n" +
        "BMI: " + bmi.toFixed(1) + "\n\n" +
        "Calorie Goals:\n" +
        "  Lose: " + Math.max(1200, lastTDEE - 500).toLocaleString() + " kcal\n" +
        "  Maintain: " + lastTDEE.toLocaleString() + " kcal\n" +
        "  Gain: " + (lastTDEE + 500).toLocaleString() + " kcal\n\n" +
        "Macros (" + DIET_PLANS[currentDiet].label + "):\n" +
        "  Carbs: " + macros.carbs.grams + "g (" + macros.carbs.pct + "%)\n" +
        "  Protein: " + macros.protein.grams + "g (" + macros.protein.pct + "%)\n" +
        "  Fat: " + macros.fat.grams + "g (" + macros.fat.pct + "%)\n\n" +
        "Calculated at dailycalorie.app";

    navigator.clipboard.writeText(text).then(function() {
        var btn = document.getElementById("copy-btn-text");
        btn.textContent = "Copied!";
        setTimeout(function() { btn.textContent = "Copy Results"; }, 2000);
    });
}

// ===== Print =====
function printResults() {
    window.print();
}

// ===== Exercise Calorie Burn =====
function calcExercise() {
    if (lastWeightKg === 0) return;
    var met = parseFloat(document.getElementById("exercise-type").value);
    var mins = parseFloat(document.getElementById("exercise-mins").value) || 30;
    // Calories = MET × weight(kg) × duration(hrs)
    var cal = Math.round(met * lastWeightKg * (mins / 60));
    var foodEquiv = (cal / 285).toFixed(1); // pizza slices

    document.getElementById("exercise-result").classList.remove("hidden");
    document.getElementById("exercise-cal").textContent = cal.toLocaleString() + " kcal";
    document.getElementById("exercise-detail").textContent = mins + " min = ~" + foodEquiv + " slices of pizza worth of energy";
}

// ===== Theme Toggle =====
function toggleTheme() {
    var isLight = document.body.classList.toggle("light");
    document.getElementById("theme-icon-dark").classList.toggle("hidden", isLight);
    document.getElementById("theme-icon-light").classList.toggle("hidden", !isLight);
    try { localStorage.setItem("tdee_theme", isLight ? "light" : "dark"); } catch(e) {}
}

function loadTheme() {
    try {
        var theme = localStorage.getItem("tdee_theme");
        if (theme === "light") {
            document.body.classList.add("light");
            document.getElementById("theme-icon-dark").classList.add("hidden");
            document.getElementById("theme-icon-light").classList.remove("hidden");
        }
    } catch(e) {}
}

// ===== History Chart =====
var historyChart = null;
function renderHistoryChart() {
    try {
        var history = JSON.parse(localStorage.getItem("tdee_history") || "[]");
        var section = document.getElementById("history-chart-section");
        if (history.length < 2) {
            section.classList.add("hidden");
            return;
        }
        section.classList.remove("hidden");

        var entries = history.slice(0, 10).reverse();
        var labels = entries.map(function(e) { return e.date; });
        var tdeeData = entries.map(function(e) { return e.tdee; });
        var bmiData = entries.map(function(e) { return parseFloat(e.bmi); });

        var ctx = document.getElementById("history-chart").getContext("2d");

        if (historyChart) {
            historyChart.data.labels = labels;
            historyChart.data.datasets[0].data = tdeeData;
            historyChart.data.datasets[1].data = bmiData;
            historyChart.update();
            return;
        }

        historyChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "TDEE",
                        data: tdeeData,
                        borderColor: "#6366f1",
                        backgroundColor: "rgba(99,102,241,0.1)",
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: "#6366f1",
                        yAxisID: "y",
                    },
                    {
                        label: "BMI",
                        data: bmiData,
                        borderColor: "#10b981",
                        backgroundColor: "rgba(16,185,129,0.1)",
                        fill: false,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: "#10b981",
                        borderDash: [5, 5],
                        yAxisID: "y1",
                    }
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: "index" },
                plugins: {
                    legend: { display: true, position: "top", labels: { color: "#a5b4fc", font: { size: 10 }, boxWidth: 12 } },
                    tooltip: {
                        backgroundColor: "rgba(15, 10, 46, 0.9)",
                        titleColor: "#c7d2fe",
                        bodyColor: "#e0e7ff",
                        borderColor: "rgba(99,102,241,0.3)",
                        borderWidth: 1,
                        cornerRadius: 8,
                    }
                },
                scales: {
                    x: { grid: { color: "rgba(99,102,241,0.06)" }, ticks: { color: "#6366f180", font: { size: 9 } } },
                    y: { position: "left", grid: { color: "rgba(99,102,241,0.06)" }, ticks: { color: "#6366f180", font: { size: 9 } } },
                    y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { color: "#10b98180", font: { size: 9 } } },
                }
            }
        });
    } catch(e) {}
}

// ===== FAQ Toggle =====
function toggleFaq(btn) {
    var answer = btn.nextElementSibling;
    var icon = btn.querySelector(".faq-toggle");
    answer.classList.toggle("open");
    icon.classList.toggle("open");
}

// ===== Form Submit Handler =====
form.addEventListener("submit", function(e) {
    e.preventDefault();
    clearErrors();

    var gender = document.querySelector('input[name="gender"]:checked').value;
    var age = parseFloat(document.getElementById("age").value);
    var rawWeight = parseFloat(document.getElementById("weight").value);
    var heightCm = getHeightCm();
    var activityMultiplier = parseFloat(document.getElementById("activity").value);

    var error = validateForm(age, rawWeight, heightCm);
    if (error) {
        showError(error);
        return;
    }

    var weightKg = getWeightKg(rawWeight);
    var bodyFatInput = parseFloat(document.getElementById("bodyfat-input").value) || 0;
    var result = calculateTDEE(gender, age, weightKg, heightCm, activityMultiplier, bodyFatInput);
    updateMathBreakdown(gender, age, weightKg, heightCm, activityMultiplier, result.bmr, result.tdee, result.formula, bodyFatInput);
    var macros = calculateMacros(result.tdee, currentDiet);

    updateResults(result.bmr, result.tdee, activityMultiplier, macros, weightKg, heightCm);

    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    saveToLocalStorage();

    saveToHistory({
        tdee: result.tdee,
        bmr: result.bmr,
        weightKg: weightKg,
        heightCm: heightCm,
    });

    sendToGoogleSheets({
        gender: gender,
        age: age,
        weight_kg: weightKg,
        height_cm: heightCm,
        activity: activityMultiplier,
        bmr: result.bmr,
        tdee: result.tdee,
        diet: currentDiet,
        unit: currentUnit,
        timestamp: new Date().toISOString(),
    });
});

// ===== Food Database (per 100g) =====
var FOOD_DB = [
    { name: "Chicken Breast (grilled)", cal: 165, carbs: 0, protein: 31, fat: 3.6 },
    { name: "Salmon (baked)", cal: 208, carbs: 0, protein: 20, fat: 13 },
    { name: "White Rice (cooked)", cal: 130, carbs: 28, protein: 2.7, fat: 0.3 },
    { name: "Brown Rice (cooked)", cal: 112, carbs: 24, protein: 2.3, fat: 0.8 },
    { name: "Pasta (cooked)", cal: 131, carbs: 25, protein: 5, fat: 1.1 },
    { name: "Whole Wheat Bread", cal: 247, carbs: 41, protein: 13, fat: 3.4 },
    { name: "Egg (boiled)", cal: 155, carbs: 1.1, protein: 13, fat: 11 },
    { name: "Banana", cal: 89, carbs: 23, protein: 1.1, fat: 0.3 },
    { name: "Apple", cal: 52, carbs: 14, protein: 0.3, fat: 0.2 },
    { name: "Avocado", cal: 160, carbs: 9, protein: 2, fat: 15 },
    { name: "Sweet Potato", cal: 86, carbs: 20, protein: 1.6, fat: 0.1 },
    { name: "Broccoli", cal: 34, carbs: 7, protein: 2.8, fat: 0.4 },
    { name: "Spinach", cal: 23, carbs: 3.6, protein: 2.9, fat: 0.4 },
    { name: "Greek Yogurt", cal: 59, carbs: 3.6, protein: 10, fat: 0.7 },
    { name: "Oatmeal (cooked)", cal: 68, carbs: 12, protein: 2.4, fat: 1.4 },
    { name: "Almonds", cal: 579, carbs: 22, protein: 21, fat: 50 },
    { name: "Peanut Butter", cal: 588, carbs: 20, protein: 25, fat: 50 },
    { name: "Beef Steak (lean)", cal: 271, carbs: 0, protein: 26, fat: 18 },
    { name: "Ground Turkey", cal: 170, carbs: 0, protein: 21, fat: 9.4 },
    { name: "Tuna (canned)", cal: 116, carbs: 0, protein: 26, fat: 0.8 },
    { name: "Cottage Cheese", cal: 98, carbs: 3.4, protein: 11, fat: 4.3 },
    { name: "Milk (whole)", cal: 61, carbs: 4.8, protein: 3.2, fat: 3.3 },
    { name: "Milk (skim)", cal: 34, carbs: 5, protein: 3.4, fat: 0.1 },
    { name: "Cheddar Cheese", cal: 403, carbs: 1.3, protein: 25, fat: 33 },
    { name: "Tofu (firm)", cal: 76, carbs: 1.9, protein: 8, fat: 4.8 },
    { name: "Lentils (cooked)", cal: 116, carbs: 20, protein: 9, fat: 0.4 },
    { name: "Black Beans (cooked)", cal: 132, carbs: 24, protein: 8.9, fat: 0.5 },
    { name: "Quinoa (cooked)", cal: 120, carbs: 21, protein: 4.4, fat: 1.9 },
    { name: "Pizza Slice (cheese)", cal: 266, carbs: 33, protein: 11, fat: 10 },
    { name: "Big Mac", cal: 257, carbs: 20, protein: 13, fat: 14 },
    { name: "French Fries", cal: 312, carbs: 41, protein: 3.4, fat: 15 },
    { name: "Ice Cream (vanilla)", cal: 207, carbs: 24, protein: 3.5, fat: 11 },
    { name: "Chocolate (dark)", cal: 546, carbs: 60, protein: 5, fat: 31 },
    { name: "Orange", cal: 47, carbs: 12, protein: 0.9, fat: 0.1 },
    { name: "Strawberries", cal: 32, carbs: 7.7, protein: 0.7, fat: 0.3 },
    { name: "Blueberries", cal: 57, carbs: 14, protein: 0.7, fat: 0.3 },
    { name: "Olive Oil (1 tbsp)", cal: 884, carbs: 0, protein: 0, fat: 100 },
    { name: "Honey (1 tbsp)", cal: 304, carbs: 82, protein: 0.3, fat: 0 },
    { name: "Protein Shake", cal: 120, carbs: 3, protein: 24, fat: 1.5 },
    { name: "Granola Bar", cal: 471, carbs: 64, protein: 10, fat: 20 },
];

// Food search
var foodSearchEl = document.getElementById("food-search");
if (foodSearchEl) {
    foodSearchEl.addEventListener("input", function() {
        var q = this.value.toLowerCase().trim();
        var container = document.getElementById("food-results");
        if (q.length < 2) { container.innerHTML = ""; return; }

        var matches = FOOD_DB.filter(function(f) { return f.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
        container.innerHTML = "";
        if (matches.length === 0) {
            container.innerHTML = '<p class="text-xs text-indigo-300/40 text-center py-2">No results found</p>';
            return;
        }
        matches.forEach(function(food) {
            var row = document.createElement("div");
            row.className = "food-row flex items-center justify-between px-3 py-2";
            row.innerHTML =
                '<div>' +
                    '<div class="text-xs text-indigo-100">' + food.name + '</div>' +
                    '<div class="text-[10px] text-indigo-300/40">per 100g</div>' +
                '</div>' +
                '<div class="flex gap-3 text-[10px] items-center">' +
                    '<span class="text-amber-300">C:' + food.carbs + 'g</span>' +
                    '<span class="text-emerald-300">P:' + food.protein + 'g</span>' +
                    '<span class="text-purple-300">F:' + food.fat + 'g</span>' +
                    '<span class="text-white font-semibold text-xs ml-1">' + food.cal + '</span>' +
                    '<button onclick="addFoodToLog(\'' + food.name.replace(/'/g, "\\'") + '\',' + food.cal + ')" class="text-indigo-400 hover:text-indigo-200 text-xs ml-1">+ Log</button>' +
                '</div>';
            container.appendChild(row);
        });
    });
}

// ===== Daily Meal Log =====
function getMealLog() {
    try {
        var today = new Date().toISOString().slice(0, 10);
        var raw = localStorage.getItem("tdee_meal_log_" + today);
        return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
}

function saveMealLog(log) {
    try {
        var today = new Date().toISOString().slice(0, 10);
        localStorage.setItem("tdee_meal_log_" + today, JSON.stringify(log));
    } catch(e) {}
}

function addFoodToLog(name, cal) {
    var log = getMealLog();
    log.push({ name: name, cal: cal, time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) });
    saveMealLog(log);
    renderMealLog();
}

function addToMealLog() {
    var name = document.getElementById("log-food-name").value.trim();
    var cal = parseInt(document.getElementById("log-food-cal").value);
    if (!name || !cal || cal <= 0) return;
    addFoodToLog(name, cal);
    document.getElementById("log-food-name").value = "";
    document.getElementById("log-food-cal").value = "";
}

function removeMealLogItem(idx) {
    var log = getMealLog();
    log.splice(idx, 1);
    saveMealLog(log);
    renderMealLog();
}

function clearMealLog() {
    var today = new Date().toISOString().slice(0, 10);
    localStorage.removeItem("tdee_meal_log_" + today);
    renderMealLog();
}

function renderMealLog() {
    var log = getMealLog();
    var list = document.getElementById("meal-log-list");
    var target = lastTDEE || 2000;
    document.getElementById("log-target").textContent = target.toLocaleString();

    if (log.length === 0) {
        list.innerHTML = '<p class="text-xs text-indigo-300/40 text-center py-2">No foods logged today</p>';
        document.getElementById("log-total").textContent = "0";
        document.getElementById("log-bar").style.width = "0%";
        document.getElementById("log-remaining").innerHTML = '<span class="text-indigo-300/40">' + target.toLocaleString() + ' kcal remaining</span>';
        return;
    }

    var total = log.reduce(function(s, i) { return s + i.cal; }, 0);
    var pct = Math.min((total / target) * 100, 100);
    document.getElementById("log-total").textContent = total.toLocaleString();
    document.getElementById("log-bar").style.width = pct + "%";

    var remaining = target - total;
    if (remaining > 0) {
        document.getElementById("log-remaining").innerHTML = '<span class="text-emerald-400">' + remaining.toLocaleString() + ' kcal remaining</span>';
    } else {
        document.getElementById("log-remaining").innerHTML = '<span class="text-red-400">' + Math.abs(remaining).toLocaleString() + ' kcal over target</span>';
        document.getElementById("log-bar").classList.add("from-red-500", "to-red-400");
        document.getElementById("log-bar").classList.remove("from-indigo-500", "to-purple-500");
    }
    if (remaining >= 0) {
        document.getElementById("log-bar").classList.remove("from-red-500", "to-red-400");
        document.getElementById("log-bar").classList.add("from-indigo-500", "to-purple-500");
    }

    list.innerHTML = "";
    log.forEach(function(item, idx) {
        var row = document.createElement("div");
        row.className = "flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/5 transition text-xs";
        row.innerHTML =
            '<div class="flex items-center gap-2">' +
                '<span class="text-indigo-300/40">' + item.time + '</span>' +
                '<span class="text-indigo-100">' + item.name + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
                '<span class="text-white font-semibold">' + item.cal + ' kcal</span>' +
                '<button onclick="removeMealLogItem(' + idx + ')" class="text-red-400/40 hover:text-red-300 text-[10px]">x</button>' +
            '</div>';
        list.appendChild(row);
    });
}

// ===== Personalized Tips =====
function updateTips() {
    var tips = [];
    if (lastTDEE === 0) return;

    var bmi = calculateBMI(lastWeightKg, lastHeightCm);
    var bf = estimateBodyFat(bmi, lastAge, lastGender);
    var activity = parseFloat(document.getElementById("activity").value);

    if (bmi < 18.5) tips.push({ icon: "&#9888;&#65039;", text: "Your BMI indicates you're underweight. Consider a caloric surplus of 300-500 kcal above TDEE with strength training to build lean mass." });
    if (bmi >= 25 && bmi < 30) tips.push({ icon: "&#128161;", text: "Your BMI is in the overweight range. A moderate deficit of 400-500 kcal below TDEE combined with regular exercise can help reach a healthy weight." });
    if (bmi >= 30) tips.push({ icon: "&#9888;&#65039;", text: "Your BMI suggests obesity. Consult a healthcare provider for personalized guidance. Start with a 500 kcal deficit and focus on whole foods." });

    if (activity <= 1.2) tips.push({ icon: "&#127939;", text: "Your activity level is sedentary. Even adding 30 minutes of walking daily can increase your TDEE by ~200 kcal and improve cardiovascular health." });
    if (activity >= 1.725) tips.push({ icon: "&#128170;", text: "Great activity level! Make sure you're eating enough protein (1.6-2.0g per kg) to support muscle recovery and growth." });

    var proteinG = calculateMacros(lastTDEE, currentDiet).protein.grams;
    var proteinPerKg = proteinG / lastWeightKg;
    if (proteinPerKg < 1.2 && activity >= 1.55) tips.push({ icon: "&#129385;", text: "Your protein intake (" + proteinPerKg.toFixed(1) + "g/kg) may be low for your activity level. Consider the High Protein diet preset or aim for 1.6g+ per kg." });

    if (bf > 25 && lastGender === "male") tips.push({ icon: "&#128200;", text: "Estimated body fat is " + bf.toFixed(0) + "%. Combining resistance training with a moderate deficit is the most effective approach for fat loss." });
    if (bf > 32 && lastGender === "female") tips.push({ icon: "&#128200;", text: "Estimated body fat is " + bf.toFixed(0) + "%. A combination of cardio and strength training with a caloric deficit can help improve body composition." });

    tips.push({ icon: "&#128167;", text: "Aim for " + (lastWeightKg * 0.033).toFixed(1) + "L of water daily. Proper hydration boosts metabolism and helps control appetite." });

    if (lastTDEE > 2500) tips.push({ icon: "&#127858;", text: "With a TDEE of " + lastTDEE.toLocaleString() + " kcal, consider splitting into 4-5 smaller meals to maintain energy levels and avoid blood sugar spikes." });

    var container = document.getElementById("tips-list");
    container.innerHTML = "";
    tips.slice(0, 5).forEach(function(tip) {
        var div = document.createElement("div");
        div.className = "tip-card glass rounded-lg px-4 py-3 text-xs text-indigo-200/80 leading-relaxed";
        div.innerHTML = '<span class="mr-1">' + tip.icon + '</span> ' + tip.text;
        container.appendChild(div);
    });
}

// ===== Export CSV =====
function exportCSV() {
    try {
        var history = JSON.parse(localStorage.getItem("tdee_history") || "[]");
        if (history.length === 0) return;
        var csv = "Date,Time,TDEE,BMR,BMI,Weight_kg,Diet\n";
        history.forEach(function(e) {
            csv += e.date + "," + e.time + "," + e.tdee + "," + e.bmr + "," + e.bmi + "," + (e.weight || "") + "," + (e.diet || "") + "\n";
        });
        var blob = new Blob([csv], { type: "text/csv" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "tdee_history.csv";
        a.click();
        URL.revokeObjectURL(a.href);
    } catch(e) {}
}

// ===== Confetti =====
var hasShownConfetti = false;
function showConfetti() {
    if (hasShownConfetti) return;
    hasShownConfetti = true;
    var canvas = document.getElementById("confetti-canvas");
    canvas.style.display = "block";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var ctx = canvas.getContext("2d");
    var particles = [];
    var colors = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

    for (var i = 0; i < 120; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 8 + 4,
            h: Math.random() * 6 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            vy: Math.random() * 3 + 2,
            vx: (Math.random() - 0.5) * 2,
            rot: Math.random() * 360,
            vr: (Math.random() - 0.5) * 10,
        });
    }

    var frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var alive = false;
        particles.forEach(function(p) {
            p.y += p.vy;
            p.x += p.vx;
            p.rot += p.vr;
            p.vy += 0.05;
            if (p.y < canvas.height + 20) alive = true;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        frame++;
        if (alive && frame < 180) {
            requestAnimationFrame(animate);
        } else {
            canvas.style.display = "none";
        }
    }
    requestAnimationFrame(animate);
}

// ===== Back to Top =====
window.addEventListener("scroll", function() {
    var btn = document.getElementById("back-to-top");
    if (window.scrollY > 400) { btn.classList.add("show"); }
    else { btn.classList.remove("show"); }
});

// ===== Keyboard Shortcuts =====
document.addEventListener("keydown", function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        form.dispatchEvent(new Event("submit"));
    }
});

// ===== Init =====
loadFromLocalStorage();
loadTheme();
renderHistory();
renderHistoryChart();
renderMealLog();

// ===== Visitor Counter (Today + Total) =====
(function() {
    try {
        var totalKey = "tdee_visitors";
        var today = new Date().toISOString().slice(0, 10);
        var todayKey = "tdee_visited_" + today;
        var todayCountKey = "tdee_today_count_" + today;
        var lastDateKey = "tdee_last_date";

        // Reset today's count if it's a new day
        var lastDate = localStorage.getItem(lastDateKey);
        if (lastDate !== today) {
            localStorage.setItem(lastDateKey, today);
            localStorage.setItem(todayCountKey, "0");
        }

        var totalCount = parseInt(localStorage.getItem(totalKey) || "0");
        var todayCount = parseInt(localStorage.getItem(todayCountKey) || "0");

        if (!sessionStorage.getItem("tdee_session")) {
            sessionStorage.setItem("tdee_session", "1");
            totalCount++;
            todayCount++;
            localStorage.setItem(totalKey, totalCount.toString());
            localStorage.setItem(todayCountKey, todayCount.toString());
        }

        var totalEl = document.getElementById("visitor-count");
        var todayEl = document.getElementById("visitor-today");
        if (totalEl) totalEl.textContent = totalCount.toLocaleString();
        if (todayEl) todayEl.textContent = todayCount.toLocaleString();
    } catch(e) {}
})();

// ===== Email Results =====
function emailResults() {
    if (lastTDEE === 0) return;
    var macros = calculateMacros(lastTDEE, currentDiet);
    var bmi = calculateBMI(lastWeightKg, lastHeightCm);
    var subject = encodeURIComponent("My TDEE Results - " + lastTDEE + " kcal/day");
    var body = encodeURIComponent(
        "TDEE Calculator Results\n" +
        "========================\n\n" +
        "TDEE: " + lastTDEE.toLocaleString() + " kcal/day\n" +
        "BMR: " + lastBMR.toLocaleString() + " kcal\n" +
        "BMI: " + bmi.toFixed(1) + "\n\n" +
        "Calorie Goals:\n" +
        "  Lose weight: " + Math.max(1200, lastTDEE - 500).toLocaleString() + " kcal (-500)\n" +
        "  Maintain: " + lastTDEE.toLocaleString() + " kcal\n" +
        "  Gain weight: " + (lastTDEE + 500).toLocaleString() + " kcal (+500)\n\n" +
        "Macros (" + DIET_PLANS[currentDiet].label + "):\n" +
        "  Carbs: " + macros.carbs.grams + "g (" + macros.carbs.pct + "%)\n" +
        "  Protein: " + macros.protein.grams + "g (" + macros.protein.pct + "%)\n" +
        "  Fat: " + macros.fat.grams + "g (" + macros.fat.pct + "%)\n\n" +
        "Water: " + (lastWeightKg * 0.033).toFixed(1) + "L/day\n\n" +
        "Calculated at https://dailycalorie-app.vercel.app/"
    );
    window.location.href = "mailto:?subject=" + subject + "&body=" + body;
}

// ===== Social Share Functions =====
var SHARE_URL = "https://dailycalorie-app.vercel.app/";
var SHARE_TITLE = "Free TDEE Calculator & Macro Dashboard";
var SHARE_TEXT = "Calculate your daily calories and macros for free! Check out this TDEE calculator:";

function shareToTwitter() {
    window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(SHARE_TEXT) + "&url=" + encodeURIComponent(SHARE_URL), "_blank", "width=550,height=420");
}
function shareToFacebook() {
    window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(SHARE_URL), "_blank", "width=550,height=420");
}
function shareToReddit() {
    window.open("https://reddit.com/submit?url=" + encodeURIComponent(SHARE_URL) + "&title=" + encodeURIComponent(SHARE_TITLE), "_blank", "width=550,height=420");
}
function shareToWhatsApp() {
    window.open("https://wa.me/?text=" + encodeURIComponent(SHARE_TEXT + " " + SHARE_URL), "_blank");
}
function shareToKakao() {
    window.open("https://story.kakao.com/share?url=" + encodeURIComponent(SHARE_URL), "_blank", "width=550,height=420");
}
function copyShareLink() {
    navigator.clipboard.writeText(SHARE_URL).then(function() {
        var el = document.getElementById("copy-link-text");
        if (el) { el.textContent = "Copied!"; setTimeout(function() { el.textContent = "Copy Link"; }, 2000); }
    });
}

// ===== Feedback Button =====
function openFeedback() {
    var lang = (typeof currentLang !== "undefined" && currentLang) || "en";
    var subjects = {
        en: "DailyCalorie Feedback / Improvement Suggestion",
        ko: "DailyCalorie 피드백 / 개선 제안",
        ja: "DailyCalorie フィードバック / 改善提案",
        zh: "DailyCalorie 反馈 / 改进建议",
        es: "DailyCalorie Comentarios / Sugerencia de mejora",
        pt: "DailyCalorie Feedback / Sugestão de melhoria",
        de: "DailyCalorie Feedback / Verbesserungsvorschlag",
        fr: "DailyCalorie Retour / Suggestion d'amélioration",
        hi: "DailyCalorie प्रतिक्रिया / सुधार सुझाव",
        vi: "DailyCalorie Phản hồi / Đề xuất cải tiến",
        th: "DailyCalorie ข้อเสนอแนะ / ข้อเสนอแนะเพื่อการปรับปรุง",
    };
    var bodies = {
        en: "Hi DailyCalorie Team,\n\nI'd like to suggest the following improvement:\n\n[Your suggestion here]\n\n---\nSent from DailyCalorie Calculator",
        ko: "안녕하세요 DailyCalorie 팀,\n\n다음과 같은 개선을 제안하고 싶습니다:\n\n[여기에 제안 내용을 적어주세요]\n\n---\nDailyCalorie 계산기에서 전송됨",
        ja: "DailyCalorieチームへ\n\n以下の改善を提案したいです:\n\n[ここに提案を記入してください]\n\n---\nDailyCalorie計算機から送信",
        zh: "DailyCalorie团队：\n\n我想建议以下改进：\n\n[请在此输入您的建议]\n\n---\n来自DailyCalorie计算器",
    };
    var subject = encodeURIComponent(subjects[lang] || subjects.en);
    var body = encodeURIComponent(bodies[lang] || bodies.en);
    window.location.href = "mailto:taeshinkim11@gmail.com?subject=" + subject + "&body=" + body;
}

// ===== Multi-Language System with Auto-Detection =====
var LANG_NAMES = {
    en: "English", ko: "한국어", ja: "日本語", zh: "中文", es: "Español",
    pt: "Português", de: "Deutsch", fr: "Français", hi: "हिन्दी", vi: "Tiếng Việt", th: "ไทย"
};
var LANG_HTML = { en: "en", ko: "ko", ja: "ja", zh: "zh", es: "es", pt: "pt", de: "de", fr: "fr", hi: "hi", vi: "vi", th: "th" };

var TRANSLATIONS = {
    ko: {
        "TDEE Calculator": "TDEE 계산기",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "총 일일 에너지 소비량과 맞춤 매크로 분석을 계산하세요",
        "Your Details": "신체 정보 입력", "Gender": "성별", "Male": "남성", "Female": "여성", "Age": "나이",
        "Weight (kg)": "체중 (kg)", "Weight (lbs)": "체중 (lbs)", "Height (cm)": "키 (cm)", "Height": "키",
        "Activity Level": "활동 수준", "Calculate TDEE": "TDEE 계산하기",
        "Sedentary (little or no exercise)": "비활동적 (운동 거의 없음)",
        "Lightly Active (1-3 days/week)": "가벼운 활동 (주 1-3일)",
        "Moderately Active (3-5 days/week)": "보통 활동 (주 3-5일)",
        "Very Active (6-7 days/week)": "매우 활동적 (주 6-7일)",
        "Extra Active (intense daily training)": "극도로 활동적 (매일 강도 높은 훈련)",
        "Your Daily Energy Expenditure": "일일 에너지 소비량", "calories / day": "칼로리 / 일",
        "Lose Weight": "체중 감량", "Maintain": "유지", "Gain Weight": "체중 증가",
        "Body Mass Index (BMI)": "체질량지수 (BMI)", "Macronutrient Breakdown": "영양소 비율",
        "Balanced": "균형", "Low Carb": "저탄수화물", "High Protein": "고단백", "Keto": "키토", "Custom": "맞춤",
        "Carbs": "탄수화물", "Protein": "단백질", "Fat": "지방",
        "TDEE by Activity Level": "활동 수준별 TDEE", "Meal Planner": "식단 플래너",
        "Daily Recommendations": "일일 권장량", "Weight Goal Timeline": "체중 목표 타임라인",
        "Body Composition Estimate": "체성분 추정", "7-Day Calorie Cycling": "7일 칼로리 사이클링",
        "Exercise Calorie Burn": "운동 칼로리 소모", "History": "기록",
        "Personalized Tips": "맞춤 팁", "Food Lookup": "음식 검색",
        "Today's Meal Log": "오늘의 식단 기록", "Frequently Asked Questions": "자주 묻는 질문",
        "Understanding Your TDEE: The Complete Guide": "TDEE 이해하기: 완벽 가이드",
        "Found this helpful? Share with friends!": "도움이 되셨나요? 친구에게 공유하세요!",
        "Copy Results": "결과 복사", "Share": "공유", "Export CSV": "CSV 내보내기", "Print": "인쇄", "Copy Link": "링크 복사",
        "Feedback": "피드백", "Suggest Improvement": "개선 제안",
        "About Us": "소개", "How to Use": "사용 방법", "Privacy Policy": "개인정보처리방침", "Terms of Service": "이용약관",
        "Metric": "미터법", "Imperial": "야드파운드법",
        "Try Example": "예시 보기", "Optional: Body Fat %": "선택: 체지방률 %",
        "Show Calculation Math": "계산 수식 보기", "Clear History": "기록 삭제",
        "Calorie Equivalents": "칼로리 등가물", "Email Results": "결과 이메일 보내기",
    },
    ja: {
        "TDEE Calculator": "TDEE計算機",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "1日の総エネルギー消費量とマクロ栄養素の内訳を計算",
        "Your Details": "あなたの情報", "Gender": "性別", "Male": "男性", "Female": "女性", "Age": "年齢",
        "Weight (kg)": "体重 (kg)", "Weight (lbs)": "体重 (lbs)", "Height (cm)": "身長 (cm)", "Height": "身長",
        "Activity Level": "活動レベル", "Calculate TDEE": "TDEEを計算",
        "Sedentary (little or no exercise)": "座りがち（運動なし）",
        "Lightly Active (1-3 days/week)": "軽い活動（週1-3日）",
        "Moderately Active (3-5 days/week)": "適度な活動（週3-5日）",
        "Very Active (6-7 days/week)": "活発（週6-7日）",
        "Extra Active (intense daily training)": "非常に活発（毎日激しいトレーニング）",
        "Your Daily Energy Expenditure": "1日のエネルギー消費量", "calories / day": "カロリー / 日",
        "Lose Weight": "減量", "Maintain": "維持", "Gain Weight": "増量",
        "Body Mass Index (BMI)": "ボディマス指数 (BMI)", "Macronutrient Breakdown": "マクロ栄養素の内訳",
        "Balanced": "バランス", "Low Carb": "低炭水化物", "High Protein": "高タンパク", "Keto": "ケトジェニック", "Custom": "カスタム",
        "Carbs": "炭水化物", "Protein": "タンパク質", "Fat": "脂質",
        "TDEE by Activity Level": "活動レベル別TDEE", "Meal Planner": "食事プランナー",
        "Daily Recommendations": "1日の推奨", "Weight Goal Timeline": "目標体重タイムライン",
        "Body Composition Estimate": "体組成推定", "7-Day Calorie Cycling": "7日間カロリーサイクリング",
        "Exercise Calorie Burn": "運動消費カロリー", "History": "履歴",
        "Personalized Tips": "パーソナルアドバイス", "Food Lookup": "食品検索",
        "Today's Meal Log": "今日の食事記録", "Frequently Asked Questions": "よくある質問",
        "Understanding Your TDEE: The Complete Guide": "TDEEを理解する：完全ガイド",
        "Found this helpful? Share with friends!": "役に立ちましたか？友達にシェアしよう！",
        "Copy Results": "結果をコピー", "Share": "シェア", "Export CSV": "CSVエクスポート", "Print": "印刷", "Copy Link": "リンクをコピー",
        "Feedback": "フィードバック", "Suggest Improvement": "改善を提案",
        "About Us": "サイト紹介", "How to Use": "使い方", "Privacy Policy": "プライバシー", "Terms of Service": "利用規約",
        "Metric": "メートル法", "Imperial": "ヤード・ポンド法",
        "Try Example": "例を見る", "Optional: Body Fat %": "任意：体脂肪率 %",
    },
    zh: {
        "TDEE Calculator": "TDEE计算器",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "计算您的每日总能量消耗和个性化宏量营养素分配",
        "Your Details": "您的信息", "Gender": "性别", "Male": "男", "Female": "女", "Age": "年龄",
        "Weight (kg)": "体重 (kg)", "Weight (lbs)": "体重 (lbs)", "Height (cm)": "身高 (cm)", "Height": "身高",
        "Activity Level": "活动水平", "Calculate TDEE": "计算TDEE",
        "Sedentary (little or no exercise)": "久坐（几乎不运动）",
        "Lightly Active (1-3 days/week)": "轻度活动（每周1-3天）",
        "Moderately Active (3-5 days/week)": "中度活动（每周3-5天）",
        "Very Active (6-7 days/week)": "重度活动（每周6-7天）",
        "Extra Active (intense daily training)": "极度活动（每天高强度训练）",
        "Your Daily Energy Expenditure": "您的每日能量消耗", "calories / day": "千卡 / 天",
        "Lose Weight": "减重", "Maintain": "维持", "Gain Weight": "增重",
        "Body Mass Index (BMI)": "身体质量指数 (BMI)", "Macronutrient Breakdown": "宏量营养素分配",
        "Balanced": "均衡", "Low Carb": "低碳水", "High Protein": "高蛋白", "Keto": "生酮", "Custom": "自定义",
        "Carbs": "碳水", "Protein": "蛋白质", "Fat": "脂肪",
        "TDEE by Activity Level": "按活动水平的TDEE", "Meal Planner": "膳食计划",
        "Daily Recommendations": "每日建议", "Weight Goal Timeline": "体重目标时间表",
        "Body Composition Estimate": "身体成分估算", "7-Day Calorie Cycling": "7天热量循环",
        "Exercise Calorie Burn": "运动消耗卡路里", "History": "历史记录",
        "Personalized Tips": "个性化建议", "Food Lookup": "食物查询",
        "Today's Meal Log": "今日饮食记录", "Frequently Asked Questions": "常见问题",
        "Understanding Your TDEE: The Complete Guide": "了解TDEE：完整指南",
        "Found this helpful? Share with friends!": "觉得有帮助？分享给朋友！",
        "Copy Results": "复制结果", "Share": "分享", "Export CSV": "导出CSV", "Print": "打印", "Copy Link": "复制链接",
        "Feedback": "反馈", "Suggest Improvement": "提出改进建议",
        "About Us": "关于我们", "How to Use": "使用说明", "Privacy Policy": "隐私政策", "Terms of Service": "服务条款",
        "Metric": "公制", "Imperial": "英制",
    },
    es: {
        "TDEE Calculator": "Calculadora TDEE",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "Calcula tu gasto energético diario total y tu desglose de macronutrientes",
        "Your Details": "Tus datos", "Gender": "Género", "Male": "Hombre", "Female": "Mujer", "Age": "Edad",
        "Weight (kg)": "Peso (kg)", "Weight (lbs)": "Peso (lbs)", "Height (cm)": "Altura (cm)", "Height": "Altura",
        "Activity Level": "Nivel de actividad", "Calculate TDEE": "Calcular TDEE",
        "Sedentary (little or no exercise)": "Sedentario (poco o ningún ejercicio)",
        "Lightly Active (1-3 days/week)": "Ligeramente activo (1-3 días/sem)",
        "Moderately Active (3-5 days/week)": "Moderadamente activo (3-5 días/sem)",
        "Very Active (6-7 days/week)": "Muy activo (6-7 días/sem)",
        "Extra Active (intense daily training)": "Extra activo (entrenamiento intenso diario)",
        "Your Daily Energy Expenditure": "Tu gasto energético diario", "calories / day": "calorías / día",
        "Lose Weight": "Perder peso", "Maintain": "Mantener", "Gain Weight": "Ganar peso",
        "Body Mass Index (BMI)": "Índice de masa corporal (IMC)", "Macronutrient Breakdown": "Distribución de macronutrientes",
        "Balanced": "Equilibrada", "Low Carb": "Baja en carbos", "High Protein": "Alta en proteína", "Keto": "Keto", "Custom": "Personalizada",
        "Carbs": "Carbos", "Protein": "Proteína", "Fat": "Grasa",
        "TDEE by Activity Level": "TDEE por nivel de actividad", "Meal Planner": "Planificador de comidas",
        "Daily Recommendations": "Recomendaciones diarias", "Weight Goal Timeline": "Cronograma de meta de peso",
        "Body Composition Estimate": "Estimación de composición corporal", "7-Day Calorie Cycling": "Ciclo calórico de 7 días",
        "Exercise Calorie Burn": "Calorías quemadas con ejercicio", "History": "Historial",
        "Personalized Tips": "Consejos personalizados", "Food Lookup": "Buscar alimentos",
        "Today's Meal Log": "Registro de comidas de hoy", "Frequently Asked Questions": "Preguntas frecuentes",
        "Understanding Your TDEE: The Complete Guide": "Entendiendo tu TDEE: La guía completa",
        "Found this helpful? Share with friends!": "¿Te fue útil? ¡Comparte con amigos!",
        "Copy Results": "Copiar resultados", "Share": "Compartir", "Export CSV": "Exportar CSV", "Print": "Imprimir", "Copy Link": "Copiar enlace",
        "Feedback": "Comentarios", "Suggest Improvement": "Sugerir mejora",
        "About Us": "Sobre nosotros", "How to Use": "Cómo usar", "Privacy Policy": "Política de privacidad", "Terms of Service": "Términos de servicio",
        "Metric": "Métrico", "Imperial": "Imperial",
    },
    pt: {
        "TDEE Calculator": "Calculadora TDEE",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "Calcule seu gasto energético diário total e a distribuição de macronutrientes",
        "Your Details": "Seus dados", "Gender": "Gênero", "Male": "Masculino", "Female": "Feminino", "Age": "Idade",
        "Weight (kg)": "Peso (kg)", "Weight (lbs)": "Peso (lbs)", "Height (cm)": "Altura (cm)", "Height": "Altura",
        "Activity Level": "Nível de atividade", "Calculate TDEE": "Calcular TDEE",
        "Sedentary (little or no exercise)": "Sedentário (pouco ou nenhum exercício)",
        "Lightly Active (1-3 days/week)": "Levemente ativo (1-3 dias/sem)",
        "Moderately Active (3-5 days/week)": "Moderadamente ativo (3-5 dias/sem)",
        "Very Active (6-7 days/week)": "Muito ativo (6-7 dias/sem)",
        "Extra Active (intense daily training)": "Extra ativo (treino intenso diário)",
        "Your Daily Energy Expenditure": "Seu gasto energético diário", "calories / day": "calorias / dia",
        "Lose Weight": "Perder peso", "Maintain": "Manter", "Gain Weight": "Ganhar peso",
        "Body Mass Index (BMI)": "Índice de massa corporal (IMC)", "Macronutrient Breakdown": "Distribuição de macronutrientes",
        "Balanced": "Equilibrada", "Low Carb": "Low Carb", "High Protein": "Alta proteína", "Keto": "Keto", "Custom": "Personalizada",
        "Carbs": "Carboidratos", "Protein": "Proteína", "Fat": "Gordura",
        "Meal Planner": "Planejador de refeições", "History": "Histórico",
        "Frequently Asked Questions": "Perguntas frequentes",
        "Found this helpful? Share with friends!": "Achou útil? Compartilhe com amigos!",
        "Copy Results": "Copiar resultados", "Share": "Compartilhar", "Export CSV": "Exportar CSV", "Print": "Imprimir", "Copy Link": "Copiar link",
        "Feedback": "Feedback", "Suggest Improvement": "Sugerir melhoria",
        "About Us": "Sobre nós", "How to Use": "Como usar", "Privacy Policy": "Política de privacidade", "Terms of Service": "Termos de serviço",
        "Metric": "Métrico", "Imperial": "Imperial",
    },
    de: {
        "TDEE Calculator": "TDEE-Rechner",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "Berechnen Sie Ihren täglichen Gesamtenergieverbrauch und individuelle Makronährstoffverteilung",
        "Your Details": "Ihre Daten", "Gender": "Geschlecht", "Male": "Männlich", "Female": "Weiblich", "Age": "Alter",
        "Weight (kg)": "Gewicht (kg)", "Weight (lbs)": "Gewicht (lbs)", "Height (cm)": "Größe (cm)", "Height": "Größe",
        "Activity Level": "Aktivitätslevel", "Calculate TDEE": "TDEE berechnen",
        "Sedentary (little or no exercise)": "Sitzend (wenig oder kein Sport)",
        "Lightly Active (1-3 days/week)": "Leicht aktiv (1-3 Tage/Woche)",
        "Moderately Active (3-5 days/week)": "Mäßig aktiv (3-5 Tage/Woche)",
        "Very Active (6-7 days/week)": "Sehr aktiv (6-7 Tage/Woche)",
        "Extra Active (intense daily training)": "Extrem aktiv (tägliches intensives Training)",
        "Your Daily Energy Expenditure": "Ihr täglicher Energieverbrauch", "calories / day": "Kalorien / Tag",
        "Lose Weight": "Abnehmen", "Maintain": "Halten", "Gain Weight": "Zunehmen",
        "Body Mass Index (BMI)": "Body-Mass-Index (BMI)", "Macronutrient Breakdown": "Makronährstoffverteilung",
        "Balanced": "Ausgewogen", "Low Carb": "Low Carb", "High Protein": "High Protein", "Keto": "Keto", "Custom": "Individuell",
        "Carbs": "Kohlenhydrate", "Protein": "Eiweiß", "Fat": "Fett",
        "Meal Planner": "Mahlzeitenplaner", "History": "Verlauf",
        "Frequently Asked Questions": "Häufig gestellte Fragen",
        "Found this helpful? Share with friends!": "War das hilfreich? Teile es mit Freunden!",
        "Copy Results": "Ergebnisse kopieren", "Share": "Teilen", "Export CSV": "CSV exportieren", "Print": "Drucken", "Copy Link": "Link kopieren",
        "Feedback": "Feedback", "Suggest Improvement": "Verbesserung vorschlagen",
        "About Us": "Über uns", "How to Use": "Anleitung", "Privacy Policy": "Datenschutz", "Terms of Service": "Nutzungsbedingungen",
        "Metric": "Metrisch", "Imperial": "Imperial",
    },
    fr: {
        "TDEE Calculator": "Calculateur TDEE",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "Calculez votre dépense énergétique quotidienne totale et votre répartition en macronutriments",
        "Your Details": "Vos informations", "Gender": "Genre", "Male": "Homme", "Female": "Femme", "Age": "Âge",
        "Weight (kg)": "Poids (kg)", "Weight (lbs)": "Poids (lbs)", "Height (cm)": "Taille (cm)", "Height": "Taille",
        "Activity Level": "Niveau d'activité", "Calculate TDEE": "Calculer le TDEE",
        "Sedentary (little or no exercise)": "Sédentaire (peu ou pas d'exercice)",
        "Lightly Active (1-3 days/week)": "Légèrement actif (1-3 jours/sem)",
        "Moderately Active (3-5 days/week)": "Modérément actif (3-5 jours/sem)",
        "Very Active (6-7 days/week)": "Très actif (6-7 jours/sem)",
        "Extra Active (intense daily training)": "Extrêmement actif (entraînement intensif quotidien)",
        "Your Daily Energy Expenditure": "Votre dépense énergétique quotidienne", "calories / day": "calories / jour",
        "Lose Weight": "Perdre du poids", "Maintain": "Maintenir", "Gain Weight": "Prendre du poids",
        "Body Mass Index (BMI)": "Indice de masse corporelle (IMC)", "Macronutrient Breakdown": "Répartition des macronutriments",
        "Balanced": "Équilibré", "Low Carb": "Faible en glucides", "High Protein": "Riche en protéines", "Keto": "Keto", "Custom": "Personnalisé",
        "Carbs": "Glucides", "Protein": "Protéines", "Fat": "Lipides",
        "Meal Planner": "Planificateur de repas", "History": "Historique",
        "Frequently Asked Questions": "Questions fréquentes",
        "Found this helpful? Share with friends!": "Utile ? Partagez avec vos amis !",
        "Copy Results": "Copier les résultats", "Share": "Partager", "Export CSV": "Exporter CSV", "Print": "Imprimer", "Copy Link": "Copier le lien",
        "Feedback": "Retour", "Suggest Improvement": "Suggérer une amélioration",
        "About Us": "À propos", "How to Use": "Comment utiliser", "Privacy Policy": "Confidentialité", "Terms of Service": "Conditions d'utilisation",
        "Metric": "Métrique", "Imperial": "Impérial",
    },
    hi: {
        "TDEE Calculator": "TDEE कैलकुलेटर",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "अपने कुल दैनिक ऊर्जा व्यय और मैक्रोन्यूट्रिएंट विभाजन की गणना करें",
        "Your Details": "आपकी जानकारी", "Gender": "लिंग", "Male": "पुरुष", "Female": "महिला", "Age": "आयु",
        "Weight (kg)": "वज़न (kg)", "Weight (lbs)": "वज़न (lbs)", "Height (cm)": "ऊंचाई (cm)", "Height": "ऊंचाई",
        "Activity Level": "गतिविधि स्तर", "Calculate TDEE": "TDEE गणना करें",
        "Sedentary (little or no exercise)": "गतिहीन (कम या कोई व्यायाम नहीं)",
        "Lightly Active (1-3 days/week)": "हल्का सक्रिय (सप्ताह में 1-3 दिन)",
        "Moderately Active (3-5 days/week)": "मध्यम सक्रिय (सप्ताह में 3-5 दिन)",
        "Very Active (6-7 days/week)": "बहुत सक्रिय (सप्ताह में 6-7 दिन)",
        "Extra Active (intense daily training)": "अति सक्रिय (दैनिक गहन प्रशिक्षण)",
        "Your Daily Energy Expenditure": "आपका दैनिक ऊर्जा व्यय", "calories / day": "कैलोरी / दिन",
        "Lose Weight": "वज़न कम करें", "Maintain": "बनाए रखें", "Gain Weight": "वज़न बढ़ाएं",
        "Body Mass Index (BMI)": "बॉडी मास इंडेक्स (BMI)", "Macronutrient Breakdown": "मैक्रोन्यूट्रिएंट विभाजन",
        "Balanced": "संतुलित", "Low Carb": "कम कार्ब", "High Protein": "उच्च प्रोटीन", "Keto": "कीटो", "Custom": "कस्टम",
        "Carbs": "कार्ब्स", "Protein": "प्रोटीन", "Fat": "वसा",
        "Meal Planner": "भोजन योजना", "History": "इतिहास",
        "Frequently Asked Questions": "अक्सर पूछे जाने वाले प्रश्न",
        "Found this helpful? Share with friends!": "क्या यह मददगार था? दोस्तों के साथ साझा करें!",
        "Feedback": "प्रतिक्रिया", "Suggest Improvement": "सुधार सुझाएं",
        "About Us": "हमारे बारे में", "How to Use": "कैसे उपयोग करें", "Privacy Policy": "गोपनीयता नीति", "Terms of Service": "सेवा की शर्तें",
        "Metric": "मीट्रिक", "Imperial": "इम्पीरियल",
    },
    vi: {
        "TDEE Calculator": "Máy tính TDEE",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "Tính tổng năng lượng tiêu hao hàng ngày và phân bổ dinh dưỡng đa lượng",
        "Your Details": "Thông tin của bạn", "Gender": "Giới tính", "Male": "Nam", "Female": "Nữ", "Age": "Tuổi",
        "Weight (kg)": "Cân nặng (kg)", "Weight (lbs)": "Cân nặng (lbs)", "Height (cm)": "Chiều cao (cm)", "Height": "Chiều cao",
        "Activity Level": "Mức độ hoạt động", "Calculate TDEE": "Tính TDEE",
        "Sedentary (little or no exercise)": "Ít vận động (ít hoặc không tập)",
        "Lightly Active (1-3 days/week)": "Hơi năng động (1-3 ngày/tuần)",
        "Moderately Active (3-5 days/week)": "Năng động vừa (3-5 ngày/tuần)",
        "Very Active (6-7 days/week)": "Rất năng động (6-7 ngày/tuần)",
        "Extra Active (intense daily training)": "Cực kỳ năng động (tập luyện cường độ cao mỗi ngày)",
        "Your Daily Energy Expenditure": "Năng lượng tiêu hao hàng ngày", "calories / day": "calo / ngày",
        "Lose Weight": "Giảm cân", "Maintain": "Duy trì", "Gain Weight": "Tăng cân",
        "Balanced": "Cân bằng", "Low Carb": "Ít tinh bột", "High Protein": "Giàu đạm", "Keto": "Keto", "Custom": "Tùy chỉnh",
        "Carbs": "Tinh bột", "Protein": "Đạm", "Fat": "Chất béo",
        "Frequently Asked Questions": "Câu hỏi thường gặp",
        "Found this helpful? Share with friends!": "Hữu ích? Chia sẻ với bạn bè!",
        "Feedback": "Phản hồi", "Suggest Improvement": "Đề xuất cải tiến",
        "About Us": "Về chúng tôi", "How to Use": "Hướng dẫn", "Privacy Policy": "Chính sách bảo mật", "Terms of Service": "Điều khoản dịch vụ",
    },
    th: {
        "TDEE Calculator": "เครื่องคำนวณ TDEE",
        "Calculate your Total Daily Energy Expenditure & personalized macro breakdown": "คำนวณพลังงานที่ใช้ต่อวันและสัดส่วนสารอาหารเฉพาะบุคคล",
        "Your Details": "ข้อมูลของคุณ", "Gender": "เพศ", "Male": "ชาย", "Female": "หญิง", "Age": "อายุ",
        "Weight (kg)": "น้ำหนัก (kg)", "Weight (lbs)": "น้ำหนัก (lbs)", "Height (cm)": "ส่วนสูง (cm)", "Height": "ส่วนสูง",
        "Activity Level": "ระดับกิจกรรม", "Calculate TDEE": "คำนวณ TDEE",
        "Sedentary (little or no exercise)": "นั่งทำงาน (ออกกำลังกายน้อยหรือไม่ออก)",
        "Lightly Active (1-3 days/week)": "ออกกำลังกายเบา (1-3 วัน/สัปดาห์)",
        "Moderately Active (3-5 days/week)": "ออกกำลังกายปานกลาง (3-5 วัน/สัปดาห์)",
        "Very Active (6-7 days/week)": "ออกกำลังกายหนัก (6-7 วัน/สัปดาห์)",
        "Extra Active (intense daily training)": "ออกกำลังกายหนักมาก (ฝึกหนักทุกวัน)",
        "Your Daily Energy Expenditure": "พลังงานที่ใช้ต่อวัน", "calories / day": "แคลอรี / วัน",
        "Lose Weight": "ลดน้ำหนัก", "Maintain": "รักษาน้ำหนัก", "Gain Weight": "เพิ่มน้ำหนัก",
        "Balanced": "สมดุล", "Low Carb": "คาร์บต่ำ", "High Protein": "โปรตีนสูง", "Keto": "คีโต", "Custom": "กำหนดเอง",
        "Carbs": "คาร์บ", "Protein": "โปรตีน", "Fat": "ไขมัน",
        "Frequently Asked Questions": "คำถามที่พบบ่อย",
        "Found this helpful? Share with friends!": "เป็นประโยชน์ไหม? แชร์ให้เพื่อน!",
        "Feedback": "ข้อเสนอแนะ", "Suggest Improvement": "แนะนำการปรับปรุง",
        "About Us": "เกี่ยวกับเรา", "How to Use": "วิธีใช้", "Privacy Policy": "นโยบายความเป็นส่วนตัว", "Terms of Service": "เงื่อนไขการใช้งาน",
    }
};

// Detect language: URL param > localStorage > browser language > default English
function detectLanguage() {
    // 1. Check URL parameter ?lang=xx
    var params = new URLSearchParams(window.location.search);
    var urlLang = params.get("lang");
    if (urlLang && LANG_NAMES[urlLang]) return urlLang;

    // 2. Check localStorage (user's previous choice)
    var saved = localStorage.getItem("tdee_lang");
    if (saved && LANG_NAMES[saved]) return saved;

    // 3. Auto-detect from browser language
    var browserLang = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    // Map browser language codes to our supported languages
    var langMap = {
        "ko": "ko", "kr": "ko",
        "ja": "ja", "jp": "ja",
        "zh": "zh", "zh-cn": "zh", "zh-tw": "zh", "zh-hk": "zh",
        "es": "es", "es-mx": "es", "es-ar": "es",
        "pt": "pt", "pt-br": "pt",
        "de": "de", "de-at": "de", "de-ch": "de",
        "fr": "fr", "fr-ca": "fr",
        "hi": "hi",
        "vi": "vi",
        "th": "th",
    };
    // Try exact match first, then prefix
    if (langMap[browserLang]) return langMap[browserLang];
    var prefix = browserLang.split("-")[0];
    if (langMap[prefix]) return langMap[prefix];

    return "en";
}

var currentLang = detectLanguage();

function toggleLangMenu() {
    var menu = document.getElementById("lang-menu");
    if (menu) menu.classList.toggle("hidden");
}

// Close lang menu when clicking outside
document.addEventListener("click", function(e) {
    var menu = document.getElementById("lang-menu");
    var btn = document.getElementById("lang-toggle");
    if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add("hidden");
    }
});

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem("tdee_lang", lang);
    // Update URL parameter without reload
    var url = new URL(window.location);
    if (lang === "en") {
        url.searchParams.delete("lang");
    } else {
        url.searchParams.set("lang", lang);
    }
    history.replaceState(null, "", url);
    // Close menu and apply
    var menu = document.getElementById("lang-menu");
    if (menu) menu.classList.add("hidden");
    applyLanguage();
}

// Legacy support: migrate "kr" to "ko"
(function() {
    var saved = localStorage.getItem("tdee_lang");
    if (saved === "kr") { localStorage.setItem("tdee_lang", "ko"); currentLang = "ko"; }
})();

function applyLanguage() {
    // Update toggle button text
    var currentLabel = document.getElementById("lang-current");
    if (currentLabel) currentLabel.textContent = (LANG_NAMES[currentLang] || "English").substring(0, 6);
    document.documentElement.lang = LANG_HTML[currentLang] || "en";

    // Highlight active language in menu
    document.querySelectorAll(".lang-option").forEach(function(el) {
        el.classList.remove("text-white", "bg-white/10");
    });

    if (currentLang === "en") {
        // Restore original — reload is simplest for static site
        if (localStorage.getItem("tdee_lang_applied") && localStorage.getItem("tdee_lang_applied") !== "en") {
            localStorage.setItem("tdee_lang_applied", "en");
            location.reload();
        }
        return;
    }

    var dict = TRANSLATIONS[currentLang];
    if (!dict) return;

    // Translate text nodes that match dictionary keys
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
        var node = walker.currentNode;
        var trimmed = node.textContent.trim();
        if (dict[trimmed]) {
            node.textContent = node.textContent.replace(trimmed, dict[trimmed]);
        }
    }
    // Translate placeholders and labels
    document.querySelectorAll("[placeholder]").forEach(function(el) {
        var ph = el.getAttribute("placeholder");
        if (dict[ph]) el.setAttribute("placeholder", dict[ph]);
    });
    // Translate select options
    document.querySelectorAll("select option").forEach(function(el) {
        var txt = el.textContent.trim();
        if (dict[txt]) el.textContent = dict[txt];
    });
    // Translate aria-labels
    document.querySelectorAll("[aria-label]").forEach(function(el) {
        var al = el.getAttribute("aria-label");
        if (dict[al]) el.setAttribute("aria-label", dict[al]);
    });
    // Translate title attributes
    document.querySelectorAll("[title]").forEach(function(el) {
        var t = el.getAttribute("title");
        if (dict[t]) el.setAttribute("title", dict[t]);
    });
    localStorage.setItem("tdee_lang_applied", currentLang);

    // Update meta tags for international SEO
    var metaDescriptions = {
        ko: "최고의 무료 TDEE 계산기 2026. Mifflin-St Jeor 공식으로 기초대사량을 계산하세요. 매크로, BMI, 식단 플랜 제공. 회원가입 불필요.",
        ja: "最高の無料TDEEカロリー計算機2026。基礎代謝量を計算し、マクロ栄養素、BMI、食事プランを取得。登録不要。",
        zh: "最佳免费TDEE计算器2026。使用Mifflin-St Jeor公式计算基础代谢率。获取宏量营养素、BMI、膳食计划。无需注册。",
        es: "La mejor calculadora TDEE gratuita 2026. Calcula tu gasto energético diario con la ecuación Mifflin-St Jeor. Macros, IMC y planes de comidas. Sin registro.",
        pt: "Melhor calculadora TDEE gratuita 2026. Calcule seu gasto energético diário com a equação Mifflin-St Jeor. Macros, IMC e planos de refeição. Sem cadastro.",
        de: "Bester kostenloser TDEE-Rechner 2026. Berechnen Sie Ihren täglichen Energieverbrauch mit der Mifflin-St Jeor-Gleichung. Makros, BMI und Mahlzeitenpläne. Keine Anmeldung.",
        fr: "Meilleur calculateur TDEE gratuit 2026. Calculez votre dépense énergétique quotidienne avec l'équation Mifflin-St Jeor. Macros, IMC et plans repas. Sans inscription.",
        hi: "सर्वश्रेष्ठ मुफ्त TDEE कैलकुलेटर 2026। Mifflin-St Jeor समीकरण से अपना दैनिक ऊर्जा व्यय गणना करें। मैक्रो, BMI और भोजन योजना। साइनअप की आवश्यकता नहीं।",
        vi: "Máy tính TDEE miễn phí tốt nhất 2026. Tính tổng năng lượng tiêu hao hàng ngày bằng công thức Mifflin-St Jeor. Macro, BMI và kế hoạch bữa ăn. Không cần đăng ký.",
        th: "เครื่องคำนวณ TDEE ฟรีดีที่สุด 2026 คำนวณพลังงานที่ใช้ต่อวันด้วยสมการ Mifflin-St Jeor รับมาโคร BMI และแผนอาหาร ไม่ต้องสมัครสมาชิก",
    };
    var metaTitles = {
        ko: "무료 TDEE 계산기 & 매크로 대시보드 2026 | 일일 칼로리 계산",
        ja: "無料TDEE計算機＆マクロダッシュボード2026 | 1日のカロリーを計算",
        zh: "免费TDEE计算器和宏量营养素仪表板2026 | 计算每日卡路里",
        es: "Calculadora TDEE Gratis y Panel de Macros 2026 | Calcula Tus Calorías Diarias",
        pt: "Calculadora TDEE Grátis e Painel de Macros 2026 | Calcule Suas Calorias Diárias",
        de: "Kostenloser TDEE-Rechner & Makro-Dashboard 2026 | Berechne Deine Täglichen Kalorien",
        fr: "Calculateur TDEE Gratuit & Tableau de Macros 2026 | Calculez Vos Calories Quotidiennes",
        hi: "मुफ्त TDEE कैलकुलेटर और मैक्रो डैशबोर्ड 2026 | अपनी दैनिक कैलोरी गणना करें",
        vi: "Máy Tính TDEE Miễn Phí & Bảng Macro 2026 | Tính Calo Hàng Ngày",
        th: "เครื่องคำนวณ TDEE ฟรี & แดชบอร์ดมาโคร 2026 | คำนวณแคลอรีประจำวัน",
    };
    if (metaTitles[currentLang]) document.title = metaTitles[currentLang];
    var descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && metaDescriptions[currentLang]) descMeta.setAttribute("content", metaDescriptions[currentLang]);
}

// Apply language on load
document.addEventListener("DOMContentLoaded", function() {
    applyLanguage();
});

// Service Worker Registration
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function() {});
}
