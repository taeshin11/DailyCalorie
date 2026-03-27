// ===== TDEE Calculator & Macro Dashboard =====

// Google Sheets Webhook Placeholder
const GOOGLE_SHEETS_WEBHOOK_URL = "";

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

// ===== TDEE Calculation (Mifflin-St Jeor) =====
function calculateTDEE(gender, age, weightKg, heightCm, activityMultiplier) {
    let bmr;
    if (gender === "male") {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
        bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
    const tdee = bmr * activityMultiplier;
    return { bmr: Math.round(bmr), tdee: Math.round(tdee) };
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
    resultsSection.classList.remove("hidden");
    renderChart(macros);
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

    if (lastTDEE > 0) {
        var macros = calculateMacros(lastTDEE, dietKey);
        updateMacroUI(macros, lastTDEE);
        renderChart(macros);
    }
}

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
    if (!GOOGLE_SHEETS_WEBHOOK_URL) return;

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
    var result = calculateTDEE(gender, age, weightKg, heightCm, activityMultiplier);
    var macros = calculateMacros(result.tdee, currentDiet);

    updateResults(result.bmr, result.tdee, activityMultiplier, macros, weightKg, heightCm);

    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    saveToLocalStorage();

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

// ===== Init =====
loadFromLocalStorage();
