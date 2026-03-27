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
let lastTDEE = 0;

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

// ===== Update UI =====
function updateResults(bmr, tdee, activityMultiplier, macros, weightKg, heightCm) {
    const prevTDEE = lastTDEE;
    lastTDEE = tdee;

    animateValue(document.getElementById("tdee-value"), prevTDEE, tdee, 600);
    document.getElementById("bmr-value").textContent = bmr.toLocaleString();
    document.getElementById("multiplier-value").textContent = activityMultiplier + "x";

    document.getElementById("cut-value").textContent = Math.max(1200, tdee - 500).toLocaleString();
    document.getElementById("maintain-value").textContent = tdee.toLocaleString();
    document.getElementById("bulk-value").textContent = (tdee + 500).toLocaleString();

    // BMI
    const bmi = calculateBMI(weightKg, heightCm);
    const bmiCat = getBMICategory(bmi);
    document.getElementById("bmi-value").textContent = bmi.toFixed(1);
    document.getElementById("bmi-value").className = "text-2xl font-bold " + bmiCat.color;
    document.getElementById("bmi-label").textContent = bmiCat.label;
    document.getElementById("bmi-label").className = "text-sm mb-3 " + bmiCat.color;
    document.getElementById("bmi-dot").style.left = bmiCat.pct + "%";

    updateMacroUI(macros, tdee);
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
