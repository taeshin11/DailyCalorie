// ===== TDEE Calculator & Macro Dashboard =====

// Google Sheets Webhook Placeholder
const GOOGLE_SHEETS_WEBHOOK_URL = "";

// DOM Elements
const form = document.getElementById("tdee-form");
const resultsSection = document.getElementById("results");

// Chart instance
let macroChart = null;

// ===== TDEE Calculation (Mifflin-St Jeor) =====
function calculateTDEE(gender, age, weight, height, activityMultiplier) {
    let bmr;
    if (gender === "male") {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
    const tdee = bmr * activityMultiplier;
    return { bmr: Math.round(bmr), tdee: Math.round(tdee) };
}

// ===== Macro Calculation =====
function calculateMacros(tdee) {
    const carbsCal = tdee * 0.50;
    const proteinCal = tdee * 0.30;
    const fatCal = tdee * 0.20;

    return {
        carbs: { grams: Math.round(carbsCal / 4), kcal: Math.round(carbsCal) },
        protein: { grams: Math.round(proteinCal / 4), kcal: Math.round(proteinCal) },
        fat: { grams: Math.round(fatCal / 9), kcal: Math.round(fatCal) },
    };
}

// ===== Update UI =====
function updateResults(bmr, tdee, activityMultiplier, macros) {
    document.getElementById("tdee-value").textContent = tdee.toLocaleString();
    document.getElementById("bmr-value").textContent = bmr.toLocaleString();
    document.getElementById("multiplier-value").textContent = activityMultiplier + "x";

    document.getElementById("cut-value").textContent = Math.max(1200, tdee - 500).toLocaleString();
    document.getElementById("maintain-value").textContent = tdee.toLocaleString();
    document.getElementById("bulk-value").textContent = (tdee + 500).toLocaleString();

    document.getElementById("carbs-grams").textContent = macros.carbs.grams + "g";
    document.getElementById("carbs-kcal").textContent = macros.carbs.kcal.toLocaleString();
    document.getElementById("carbs-bar").style.width = "50%";

    document.getElementById("protein-grams").textContent = macros.protein.grams + "g";
    document.getElementById("protein-kcal").textContent = macros.protein.kcal.toLocaleString();
    document.getElementById("protein-bar").style.width = "30%";

    document.getElementById("fat-grams").textContent = macros.fat.grams + "g";
    document.getElementById("fat-kcal").textContent = macros.fat.kcal.toLocaleString();
    document.getElementById("fat-bar").style.width = "20%";

    document.getElementById("chart-center-cal").textContent = tdee.toLocaleString();

    resultsSection.classList.remove("hidden");

    renderChart(macros);
}

// ===== Chart.js Doughnut Chart =====
function renderChart(macros) {
    const ctx = document.getElementById("macro-chart").getContext("2d");

    if (macroChart) {
        macroChart.data.datasets[0].data = [macros.carbs.kcal, macros.protein.kcal, macros.fat.kcal];
        macroChart.update();
        return;
    }

    macroChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Carbs", "Protein", "Fat"],
            datasets: [{
                data: [macros.carbs.kcal, macros.protein.kcal, macros.fat.kcal],
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
                            const label = context.label;
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = Math.round((value / total) * 100);
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
    let el = document.getElementById("form-error");
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
    const el = document.getElementById("form-error");
    if (el) el.remove();
}

// ===== Form Validation =====
function validateForm(age, weight, height) {
    if (!age || age < 10 || age > 120) return "Please enter a valid age (10-120).";
    if (!weight || weight < 20 || weight > 400) return "Please enter a valid weight (20-400 kg).";
    if (!height || height < 50 || height > 300) return "Please enter a valid height (50-300 cm).";
    return null;
}

// ===== Form Submit Handler =====
form.addEventListener("submit", function(e) {
    e.preventDefault();

    const gender = document.querySelector('input[name="gender"]:checked').value;
    const age = parseFloat(document.getElementById("age").value);
    const weight = parseFloat(document.getElementById("weight").value);
    const height = parseFloat(document.getElementById("height").value);
    const activityMultiplier = parseFloat(document.getElementById("activity").value);

    // Clear previous errors
    clearErrors();

    const error = validateForm(age, weight, height);
    if (error) {
        showError(error);
        return;
    }

    const { bmr, tdee } = calculateTDEE(gender, age, weight, height, activityMultiplier);
    const macros = calculateMacros(tdee);

    updateResults(bmr, tdee, activityMultiplier, macros);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Async data collection
    sendToGoogleSheets({
        gender: gender,
        age: age,
        weight: weight,
        height: height,
        activity: activityMultiplier,
        bmr: bmr,
        tdee: tdee,
        timestamp: new Date().toISOString(),
    });
});
