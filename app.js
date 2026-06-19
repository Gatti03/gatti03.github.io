// ==========================================================================
// CONFIGURATION & GLOBAL STATE
// ==========================================================================
const API_URL = window.location.origin.startsWith("http") ? window.location.origin : "http://127.0.0.1:8000";
let apiOnline = false;
let currentFile = null;
let currentScanResult = null;

// ==========================================================================
// DOCUMENT LOAD & INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    checkApiStatus();
});

function initApp() {
    setupNavigation();
    setupImageUpload();
    setupTabs();
    setupModals();
    setupHistory();
    setupRetraining();
}

// ==========================================================================
// API STATUS CHECKING
// ==========================================================================
async function checkApiStatus() {
    const dot = document.getElementById("status-dot");
    const label = document.getElementById("status-label");
    const detail = document.getElementById("status-detail");
    
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        
        if (data.status === "online") {
            apiOnline = true;
            dot.className = "status-dot online";
            label.textContent = "API Online";
            detail.textContent = `Model loaded on ${data.device}`;
            writeConsole("[system] Successfully connected to FastAPI backend.");
            writeConsole(`[system] Neural Network Model loaded on target device: ${data.device}`);
            
            // Set guide sample images to point to the backend
            updateGuideImages();
        } else {
            setApiOfflineState(dot, label, detail);
        }
    } catch (error) {
        setApiOfflineState(dot, label, detail);
    }
}

function setApiOfflineState(dot, label, detail) {
    apiOnline = false;
    dot.className = "status-dot offline";
    label.textContent = "Offline (Demo Mode)";
    detail.textContent = "Running in client-side simulation";
    writeConsole("[warning] Cannot connect to local FastAPI backend.");
    writeConsole("[warning] Running in local simulation mode. Scans will be simulated.");
}

function writeConsole(text) {
    const consoleBox = document.getElementById("console-output");
    if (consoleBox) {
        const timestamp = new Date().toLocaleTimeString();
        consoleBox.innerHTML += `\n[${timestamp}] ${text}`;
        consoleBox.scrollTop = consoleBox.scrollHeight;
    }
}

// Point agronomy guide images to backend samples
function updateGuideImages() {
    document.getElementById("guide-img-n").src = `${API_URL}/samples/sample_nitrogen.png`;
    document.getElementById("guide-img-p").src = `${API_URL}/samples/sample_phosphorus.png`;
    document.getElementById("guide-img-k").src = `${API_URL}/samples/sample_potassium.png`;
    document.getElementById("guide-img-healthy").src = `${API_URL}/samples/sample_healthy.png`;
}

// ==========================================================================
// NAVIGATION CONTROLLER
// ==========================================================================
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabContents = document.querySelectorAll(".tab-content");
    const sectionTitle = document.getElementById("section-title");
    const sectionSubtitle = document.getElementById("section-subtitle");
    
    const titles = {
        "dashboard-section": {
            title: "Diagnostic Desk",
            subtitle: "Analyze maize leaves for crop nutrient deficiencies using Deep Learning"
        },
        "guide-section": {
            title: "Agronomy Guide",
            subtitle: "Detailed physiological catalog of maize leaf nutrient deficiencies"
        },
        "metrics-section": {
            title: "Neural Network Configuration",
            subtitle: "View the convolutional layers, model parameters, and retrain the classifier"
        },
        "history-section": {
            title: "Specimen Field History",
            subtitle: "Historical database of scanned crops and nutrient diagnoses"
        }
    };
    
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const target = item.getAttribute("data-target");
            
            navItems.forEach(nav => nav.classList.remove("active"));
            tabContents.forEach(content => content.classList.remove("active"));
            
            item.classList.add("active");
            document.getElementById(target).classList.add("active");
            
            // Update Headers
            if (titles[target]) {
                sectionTitle.textContent = titles[target].title;
                sectionSubtitle.textContent = titles[target].subtitle;
            }
        });
    });
}

// ==========================================================================
// IMAGE UPLOADER & DRAG-AND-DROP
// ==========================================================================
function setupImageUpload() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const previewContainer = document.getElementById("preview-container");
    const previewImg = document.getElementById("image-preview");
    const prompt = document.getElementById("drop-zone-prompt");
    const btnClear = document.getElementById("btn-clear-preview");
    const btnAnalyze = document.getElementById("btn-analyze");
    const cvCard = document.getElementById("cv-card");
    
    // Drag events
    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        }, false);
    });
    
    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
        }, false);
    });
    
    dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
    
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
    
    btnClear.addEventListener("click", (e) => {
        e.stopPropagation();
        resetUpload();
    });
    
    btnAnalyze.addEventListener("click", () => {
        triggerAnalysis();
    });
    
    function handleFile(file) {
        if (!file.type.startsWith("image/")) {
            alert("Please upload an image file (PNG, JPG).");
            return;
        }
        
        currentFile = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            prompt.classList.add("hidden");
            previewContainer.classList.remove("hidden");
            btnAnalyze.removeAttribute("disabled");
            
            // Execute local computer vision analysis on image load
            previewImg.onload = () => {
                runLocalCV(previewImg);
                cvCard.classList.remove("hidden");
            };
        };
        reader.readAsDataURL(file);
    }
    
    function resetUpload() {
        currentFile = null;
        fileInput.value = "";
        previewImg.removeAttribute("src");
        previewContainer.classList.add("hidden");
        prompt.classList.remove("hidden");
        btnAnalyze.setAttribute("disabled", "true");
        cvCard.classList.add("hidden");
        
        // Reset results section
        document.getElementById("results-display").classList.add("hidden");
        document.getElementById("results-loading").classList.add("hidden");
        document.getElementById("results-empty").classList.remove("hidden");
    }
}

// ==========================================================================
// COMPUTER VISION PROCESSING (HTML5 CANVAS)
// ==========================================================================
function runLocalCV(imgElement) {
    const canvasMask = document.getElementById("canvas-mask");
    const canvasEdges = document.getElementById("canvas-edges");
    
    const ctxMask = canvasMask.getContext("2d");
    const ctxEdges = canvasEdges.getContext("2d");
    
    const size = 128;
    canvasMask.width = size;
    canvasMask.height = size;
    canvasEdges.width = size;
    canvasEdges.height = size;
    
    // Draw scaled down version to extract pixels
    ctxMask.drawImage(imgElement, 0, 0, size, size);
    ctxEdges.drawImage(imgElement, 0, 0, size, size);
    
    const maskData = ctxMask.getImageData(0, 0, size, size);
    const edgesData = ctxEdges.getImageData(0, 0, size, size);
    
    const maskPixels = maskData.data;
    const edgesPixels = edgesData.data;
    
    let rSum = 0, gSum = 0, bSum = 0, leafPixelCount = 0;
    
    // Loop over pixels to run masks
    for (let i = 0; i < maskPixels.length; i += 4) {
        const r = maskPixels[i];
        const g = maskPixels[i+1];
        const b = maskPixels[i+2];
        
        // Background threshold (ignore very dark pixels representing background)
        const brightness = (r + g + b) / 3;
        if (brightness > 35) {
            leafPixelCount++;
            rSum += r;
            gSum += g;
            bSum += b;
            
            // Color Mask enhancement (WOW effect)
            // If yellowed (high red + high green, low blue)
            if (r > 130 && g > 110 && b < 100) {
                // Highlight yellow areas in mask canvas
                maskPixels[i] = 250;     // Boost Red
                maskPixels[i+1] = 200;   // Boost Green
                maskPixels[i+2] = 0;     // Lower Blue
            } 
            // If purpled (high red + high blue, low green)
            else if (r > 100 && b > 100 && g < 100) {
                maskPixels[i] = 160;     // Purple red
                maskPixels[i+1] = 50;
                maskPixels[i+2] = 220;
            }
            // Normal healthy green
            else if (g > r && g > b) {
                maskPixels[i] = r * 0.7; // Dampen red
                maskPixels[i+1] = Math.min(g * 1.3, 255); // Highlight green
                maskPixels[i+2] = b * 0.7;
            }
        }
    }
    ctxMask.putImageData(maskData, 0, 0);
    
    // Run edge detection filter (Sobel approximation for borders)
    const grayscale = [];
    for (let i = 0; i < edgesPixels.length; i += 4) {
        const r = edgesPixels[i];
        const g = edgesPixels[i+1];
        const b = edgesPixels[i+2];
        grayscale.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
    
    // Sobel kernels
    const Gx = [
        -1, 0, 1,
        -2, 0, 2,
        -1, 0, 1
    ];
    const Gy = [
        -1, -2, -1,
         0,  0,  0,
         1,  2,  1
    ];
    
    for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
            let valX = 0;
            let valY = 0;
            
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const pixelVal = grayscale[(y + ky) * size + (x + kx)];
                    const kernelIdx = (ky + 1) * 3 + (kx + 1);
                    valX += pixelVal * Gx[kernelIdx];
                    valY += pixelVal * Gy[kernelIdx];
                }
            }
            
            const mag = Math.min(255, Math.sqrt(valX * valX + valY * valY));
            const idx = (y * size + x) * 4;
            
            // Set edge map to glowing green edges
            edgesPixels[idx] = mag * 0.1;
            edgesPixels[idx+1] = mag;
            edgesPixels[idx+2] = mag * 0.4;
            edgesPixels[idx+3] = 255;
        }
    }
    ctxEdges.putImageData(edgesData, 0, 0);
    
    // Update local color metric ratios
    if (leafPixelCount > 0) {
        const totalIntensity = rSum + gSum + bSum;
        const rPct = Math.round((rSum / totalIntensity) * 100);
        const gPct = Math.round((gSum / totalIntensity) * 100);
        const bPct = Math.round((bSum / totalIntensity) * 100);
        
        document.getElementById("r-percent").textContent = `${rPct}%`;
        document.getElementById("g-percent").textContent = `${gPct}%`;
        document.getElementById("b-percent").textContent = `${bPct}%`;
        
        document.getElementById("r-bar-fill").style.width = `${rPct}%`;
        document.getElementById("g-bar-fill").style.width = `${gPct}%`;
        document.getElementById("b-bar-fill").style.width = `${bPct}%`;
    }
}

// ==========================================================================
// CORE MODEL DIAGNOSTIC SCAN
// ==========================================================================
async function triggerAnalysis() {
    const btnAnalyze = document.getElementById("btn-analyze");
    const scanOverlay = document.getElementById("scan-overlay");
    const resultsEmpty = document.getElementById("results-empty");
    const resultsLoading = document.getElementById("results-loading");
    const resultsDisplay = document.getElementById("results-display");
    const loadingText = document.getElementById("loading-text");
    
    btnAnalyze.setAttribute("disabled", "true");
    scanOverlay.classList.remove("hidden");
    resultsEmpty.classList.add("hidden");
    resultsLoading.classList.remove("hidden");
    resultsDisplay.classList.add("hidden");
    
    // Cycle scanning text overlays
    const loadingPhrases = [
        "Normalizing pixel matrices...",
        "Extracting color histograms...",
        "Executing Conv2D filters...",
        "Evaluating feature maps...",
        "Running Softmax classification..."
    ];
    let phraseIdx = 0;
    const loadingInterval = setInterval(() => {
        if (phraseIdx < loadingPhrases.length) {
            loadingText.textContent = loadingPhrases[phraseIdx++];
        }
    }, 450);
    
    try {
        if (apiOnline) {
            // Live Server Inference
            const formData = new FormData();
            formData.append("file", currentFile);
            
            const response = await fetch(`${API_URL}/predict`, {
                method: "POST",
                body: formData
            });
            
            if (!response.ok) throw new Error("Inference service failed.");
            
            currentScanResult = await response.json();
        } else {
            // Simulated local prediction for offline demonstration
            await new Promise(resolve => setTimeout(resolve, 2000));
            currentScanResult = getSimulatedPrediction();
        }
        
        // Stop scanning animations & render results
        clearInterval(loadingInterval);
        scanOverlay.classList.add("hidden");
        resultsLoading.classList.add("hidden");
        renderResults(currentScanResult);
        btnAnalyze.removeAttribute("disabled");
        
    } catch (error) {
        clearInterval(loadingInterval);
        scanOverlay.classList.add("hidden");
        resultsLoading.classList.add("hidden");
        resultsEmpty.classList.remove("hidden");
        btnAnalyze.removeAttribute("disabled");
        alert(`Analysis error: ${error.message}`);
    }
}

// Generate a simulated model prediction based on canvas ratios
function getSimulatedPrediction() {
    // Read the current bar percentages from CV analysis
    const rVal = parseInt(document.getElementById("r-percent").textContent);
    const gVal = parseInt(document.getElementById("g-percent").textContent);
    const bVal = parseInt(document.getElementById("b-percent").textContent);
    
    // Simulate classification based on the extracted dominant channels
    let predIdx = 3; // Default Healthy
    let confidence = 0.85;
    
    // Logic mapping ratios to classes
    if (rVal > 38 && gVal < 42) {
        // Reddish edges or yellowish tint
        predIdx = Math.random() > 0.5 ? 0 : 2; // N or K
        confidence = 0.72 + Math.random() * 0.20;
    } else if (bVal > 30 && rVal > 32) {
        predIdx = 1; // P deficiency
        confidence = 0.68 + Math.random() * 0.25;
    } else {
        predIdx = 3; // Healthy
        confidence = 0.80 + Math.random() * 0.18;
    }
    
    const db = getDiagnosisDatabaseMock();
    const info = db[predIdx];
    
    // Distribute remaining scores
    const scores = { nitrogen: 0.05, phosphorus: 0.05, potassium: 0.05, healthy: 0.05 };
    const classes = ["nitrogen", "phosphorus", "potassium", "healthy"];
    scores[classes[predIdx]] = confidence;
    
    // Normalize others
    const remaining = 1.0 - confidence;
    let sum = 0;
    classes.forEach((c, idx) => {
        if (idx !== predIdx) {
            const val = Math.random() * remaining;
            scores[c] = val;
            sum += val;
        }
    });
    // scale to sum to remaining
    classes.forEach((c, idx) => {
        if (idx !== predIdx) {
            scores[c] = (scores[c] / sum) * remaining;
        }
    });

    return {
        prediction: info.name,
        prediction_id: info.id,
        confidence: confidence,
        confidence_scores: scores,
        diagnosis: info
    };
}

// ==========================================================================
// RESULTS UI RENDERER
// ==========================================================================
function renderResults(res) {
    const resultsDisplay = document.getElementById("results-display");
    resultsDisplay.classList.remove("hidden");
    
    // Badge and Titles
    const badge = document.getElementById("diagnosis-id-badge");
    badge.className = `diagnosis-badge badge-${res.prediction_id}`;
    badge.textContent = res.prediction_id;
    
    document.getElementById("diagnosis-title").textContent = res.prediction;
    document.getElementById("diagnosis-desc").textContent = res.diagnosis.shortDescription;
    
    // Circular Gauge
    const confidencePct = Math.round(res.confidence * 100);
    document.getElementById("confidence-percent").textContent = `${confidencePct}%`;
    
    const circle = document.getElementById("confidence-circle");
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (res.confidence * circumference);
    circle.style.strokeDashoffset = offset;
    
    // Apply visual color to gauge circle border
    let color = "#10b981"; // healthy green
    if (res.prediction_id === "nitrogen") color = "#fbbf24";
    else if (res.prediction_id === "phosphorus") color = "#a78bfa";
    else if (res.prediction_id === "potassium") color = "#f97316";
    circle.style.stroke = color;
    
    // Update Score Breakdowns
    updateBreakdownBar("breakdown-nitrogen", res.confidence_scores.nitrogen);
    updateBreakdownBar("breakdown-phosphorus", res.confidence_scores.phosphorus);
    updateBreakdownBar("breakdown-potassium", res.confidence_scores.potassium);
    updateBreakdownBar("breakdown-healthy", res.confidence_scores.healthy);
    
    // Populate Detail Tab Content
    populateList("symptoms-list", res.diagnosis.symptoms);
    populateList("causes-list", res.diagnosis.causes);
    document.getElementById("treatment-text").textContent = res.diagnosis.treatmentImmediate;
    populateList("prevention-list", res.diagnosis.preventionLongTerm);
    
    // Write diagnosis info to metrics log console
    writeConsole(`[model] Inference response: Predicted ${res.prediction} with ${confidencePct}% confidence.`);
}

function updateBreakdownBar(elementId, ratio) {
    const item = document.getElementById(elementId);
    const pct = Math.round(ratio * 100);
    item.querySelector(".bar-fill").style.width = `${pct}%`;
    item.querySelector(".val").textContent = `${pct}%`;
}

function populateList(elementId, itemsList) {
    const listElement = document.getElementById(elementId);
    listElement.innerHTML = "";
    itemsList.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        listElement.appendChild(li);
    });
}

// ==========================================================================
// INTERACTIVE TABS CONTROL
// ==========================================================================
function setupTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");
    
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-tab");
            
            tabBtns.forEach(b => b.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(target).classList.add("active");
        });
    });
}

// ==========================================================================
// AGRONOMY GUIDE AND MODAL DIALOGS
// ==========================================================================
function setupModals() {
    const guideCards = document.querySelectorAll(".guide-card");
    const modal = document.getElementById("guide-modal");
    const modalClose = document.getElementById("modal-close");
    
    guideCards.forEach(card => {
        card.addEventListener("click", () => {
            const id = parseInt(card.getAttribute("data-deficiency"));
            openGuideModal(id);
        });
    });
    
    modalClose.addEventListener("click", () => {
        modal.classList.add("hidden");
    });
    
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.add("hidden");
        }
    });
}

function openGuideModal(id) {
    const modal = document.getElementById("guide-modal");
    const title = document.getElementById("modal-deficiency-name");
    const img = document.getElementById("modal-img");
    const desc = document.getElementById("modal-desc");
    const symptoms = document.getElementById("modal-symptoms");
    const causes = document.getElementById("modal-causes");
    const treatment = document.getElementById("modal-treatment");
    
    const db = getDiagnosisDatabaseMock();
    const info = db[id];
    
    title.textContent = info.name;
    desc.textContent = info.shortDescription;
    
    // Assign sample images
    let sampleImgName = `sample_${info.id}.png`;
    img.src = apiOnline ? `${API_URL}/samples/${sampleImgName}` : `https://placehold.co/400x300/101a30/ffffff?text=${info.name}`;
    
    // Populate lists
    symptoms.innerHTML = "";
    info.symptoms.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        symptoms.appendChild(li);
    });
    
    causes.innerHTML = "";
    info.causes.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        causes.appendChild(li);
    });
    
    treatment.textContent = info.treatmentImmediate;
    
    modal.classList.remove("hidden");
}

// ==========================================================================
// SPECIMEN HISTORY MANAGEMENT (LOCAL STORAGE)
// ==========================================================================
function setupHistory() {
    const btnSave = document.getElementById("btn-save-log");
    const btnClear = document.getElementById("btn-clear-history");
    const btnExport = document.getElementById("btn-export-history");
    
    renderHistoryTable();
    
    btnSave.addEventListener("click", () => {
        if (!currentScanResult) return;
        saveScanToHistory(currentScanResult);
    });
    
    btnClear.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear all logged diagnostic history?")) {
            localStorage.removeItem("maize_scan_history");
            renderHistoryTable();
            updateDashboardStats();
            writeConsole("[history] Cleared diagnostic logs.");
        }
    });
    
    btnExport.addEventListener("click", () => {
        exportHistoryToCSV();
    });
}

function saveScanToHistory(res) {
    const history = JSON.parse(localStorage.getItem("maize_scan_history")) || [];
    
    // Setup temporary thumbnail from image preview
    const previewImg = document.getElementById("image-preview");
    
    const record = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        filename: currentFile ? currentFile.name : "camera_capture.png",
        prediction: res.prediction,
        prediction_id: res.prediction_id,
        confidence: Math.round(res.confidence * 100),
        image: previewImg.src // save thumbnail string
    };
    
    // Insert at front
    history.unshift(record);
    localStorage.setItem("maize_scan_history", JSON.stringify(history));
    
    renderHistoryTable();
    updateDashboardStats();
    writeConsole(`[history] Logged specimen scan ID #${record.id} to browser storage.`);
    alert("Scan saved to Field History log!");
}

function renderHistoryTable() {
    const tbody = document.getElementById("history-tbody");
    const history = JSON.parse(localStorage.getItem("maize_scan_history")) || [];
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr class="table-empty-row">
                <td colspan="6">No specimens scanned yet. Diagnostics logged from the Diagnostic Desk appear here.</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = "";
    history.forEach(item => {
        const tr = document.createElement("tr");
        
        // Define glow style according to class
        let classColor = "var(--primary)";
        if (item.prediction_id === "nitrogen") classColor = "var(--warning)";
        else if (item.prediction_id === "phosphorus") classColor = "var(--purple)";
        else if (item.prediction_id === "potassium") classColor = "var(--accent)";
        
        tr.innerHTML = `
            <td>${item.timestamp}</td>
            <td>${item.filename}</td>
            <td>
                <img src="${item.image}" class="history-mini-preview" alt="Leaf Target">
            </td>
            <td>
                <span class="diagnosis-badge badge-${item.prediction_id}">${item.prediction}</span>
            </td>
            <td style="font-weight: 700; color: ${classColor};">${item.confidence}%</td>
            <td>
                <button class="btn-delete-row" data-id="${item.id}" title="Remove entry">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Bind delete row buttons
    tbody.querySelectorAll(".btn-delete-row").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute("data-id"));
            deleteHistoryRow(id);
        });
    });
    
    updateDashboardStats();
}

function deleteHistoryRow(id) {
    let history = JSON.parse(localStorage.getItem("maize_scan_history")) || [];
    history = history.filter(item => item.id !== id);
    localStorage.setItem("maize_scan_history", JSON.stringify(history));
    renderHistoryTable();
    updateDashboardStats();
    writeConsole(`[history] Removed scan record ID #${id}.`);
}

function updateDashboardStats() {
    const history = JSON.parse(localStorage.getItem("maize_scan_history")) || [];
    const countEl = document.getElementById("stat-scans-count");
    const ratioEl = document.getElementById("stat-healthy-ratio");
    
    countEl.textContent = history.length;
    
    if (history.length === 0) {
        ratioEl.textContent = "0%";
        return;
    }
    
    const healthyCount = history.filter(item => item.prediction_id === "healthy").length;
    const ratio = Math.round((healthyCount / history.length) * 100);
    ratioEl.textContent = `${ratio}%`;
}

function exportHistoryToCSV() {
    const history = JSON.parse(localStorage.getItem("maize_scan_history")) || [];
    if (history.length === 0) {
        alert("No logs available to export.");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Scan ID,Date,Filename,Prediction,Class ID,Confidence\n";
    
    history.forEach(item => {
        csvContent += `"${item.id}","${item.timestamp}","${item.filename}","${item.prediction}","${item.prediction_id}","${item.confidence}%"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `maize_scan_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    writeConsole("[history] Exported csv ledger file.");
}

// ==========================================================================
// DYNAMIC MODEL RETRAINING
// ==========================================================================
function setupRetraining() {
    const btnRetrain = document.getElementById("btn-retrain");
    
    btnRetrain.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to retrain the PyTorch model? This triggers model training over 1000 generated leaf profiles on the backend.")) {
            return;
        }
        
        btnRetrain.setAttribute("disabled", "true");
        btnRetrain.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Rebuilding Model...`;
        writeConsole("[model] Retraining initiated. Please wait...");
        
        try {
            if (apiOnline) {
                const response = await fetch(`${API_URL}/train`, { method: "POST" });
                if (!response.ok) throw new Error("Retraining API returned an error.");
                const data = await response.json();
                
                writeConsole(`[model] Training result: ${data.message}`);
                // Refresh images
                updateGuideImages();
            } else {
                // Mock retraining in offline demo
                for (let i = 1; i <= 5; i++) {
                    await new Promise(r => setTimeout(r, 800));
                    writeConsole(`[model] Epoch [${i}/5] - Training Loss: ${(0.8/i).toFixed(4)} - Validation Acc: ${(80 + i*3.5).toFixed(1)}%`);
                }
                writeConsole("[model] Re-evaluation completed. Accuracy meets threshold (97.5%). Model loaded.");
            }
            
            alert("Model retrained successfully!");
        } catch (error) {
            writeConsole(`[error] Retraining failed: ${error.message}`);
            alert(`Error during training: ${error.message}`);
        } finally {
            btnRetrain.removeAttribute("disabled");
            btnRetrain.innerHTML = `<i class="fa-solid fa-rotate"></i> Retrain Model (Synthetic Dataset)`;
        }
    });
}

// ==========================================================================
// LOCAL DIAGNOSIS DATABASE MOCK (Saves memory & ensures offline mode works)
// ==========================================================================
function getDiagnosisDatabaseMock() {
    return {
        0: {
            "id": "nitrogen",
            "name": "Nitrogen (N) Deficiency",
            "shortDescription": "Insufficient Nitrogen levels, which are critical for leaf growth, protein synthesis, and chlorophyll production.",
            "symptoms": [
                "V-shaped yellowing (chlorosis) starting from the leaf tip and moving down the midrib.",
                "Lower/older leaves show symptoms first, as nitrogen is highly mobile and moves to younger leaves.",
                "Overall stunted plant growth with thin, spindly stalks and light-green foliage."
            ],
            "causes": [
                "Low soil organic matter or lack of fertilizer application.",
                "Excessive leaching from sandy soils during heavy rainfall.",
                "Waterlogged soils that inhibit root respiration and nitrogen uptake."
            ],
            "treatmentImmediate": "Apply a quick-release nitrogen fertilizer such as Urea or Ammonium Nitrate side-dressing near the plant roots. Water the soil immediately to help the root zone dissolve and absorb it.",
            "preventionLongTerm": [
                "Incorporate rich compost, animal manure, or organic matter into the soil before planting.",
                "Grow cover crops like legumes (clover, alfalfa, cowpeas) during the off-season to naturally fix atmospheric nitrogen.",
                "Implement split-nitrogen application (applying in 2-3 stages during growth) to reduce leaching loss.",
                "Conduct soil testing before planting to calculate precise nitrogen fertilizer requirements."
            ]
        },
        1: {
            "id": "phosphorus",
            "name": "Phosphorus (P) Deficiency",
            "shortDescription": "Lack of Phosphorus, vital for root development, energy transfer (ATP), and early crop maturity.",
            "symptoms": [
                "Dark green leaf surfaces that develop distinct red, purple, or bronze coloring along leaf margins and tips.",
                "Symptoms appear first on older, lower leaves before spreading.",
                "Poorly developed root system, slender stalks, and delayed flowering or tasseling."
            ],
            "causes": [
                "Cold, wet soils in early spring, which restrict root activity and phosphorus absorption.",
                "Acidic soil (pH < 5.5) or alkaline soil (pH > 7.3) where phosphorus binds tightly to iron, aluminum, or calcium.",
                "Low native soil phosphorus levels."
            ],
            "treatmentImmediate": "Apply a water-soluble phosphorus fertilizer, such as Monoammonium Phosphate (MAP) or Triple Superphosphate (TSP), directly to the root zone.",
            "preventionLongTerm": [
                "Apply rock phosphate or bone meal to the soil to build long-term, slow-release phosphorus reserves.",
                "Maintain soil pH between 6.0 and 6.8 to optimize phosphorus solubility.",
                "Avoid planting too early in cold, wet soils; utilize strip-tillage to warm the seedbed.",
                "Use mycorrhizal fungi inoculants to assist roots in accessing chemically bound soil phosphorus."
            ]
        },
        2: {
            "id": "potassium",
            "name": "Potassium (K) Deficiency",
            "shortDescription": "Insufficient Potassium, essential for water regulation (stomata control), enzyme activation, and stalk strength.",
            "symptoms": [
                "Yellowing and drying (scorching/firing) of the outer leaf edges, starting at the tip and moving along the borders.",
                "Symptoms begin on lower, older leaves and move upwards as potassium is translocated to young leaves.",
                "Weak stalks that lead to lodging (falling over), and smaller, poorly-filled ears."
            ],
            "causes": [
                "Highly leached sandy soils or soils with low cation-exchange capacity (CEC).",
                "Severe drought conditions, since potassium uptake requires adequate soil moisture.",
                "Compacted soils that restrict root extension and contact with soil potassium."
            ],
            "treatmentImmediate": "Apply a side-dressing of Potassium Chloride (Muriate of Potash) or Potassium Sulfate. Foliar spraying with potassium nitrate can provide rapid, direct leaf absorption.",
            "preventionLongTerm": [
                "Apply potassium fertilizers in the autumn or at pre-planting based on soil test results.",
                "Practice proper crop rotation; avoid following heavy potassium drawers like alfalfa without replenishment.",
                "Reduce soil compaction through cover crops, deep tillage, or controlled vehicle traffic.",
                "Return crop residues (maize stalks) to the field, as they contain a high percentage of the plant's potassium."
            ]
        },
        3: {
            "id": "healthy",
            "name": "Healthy Leaf",
            "shortDescription": "The plant displays optimal nutrient levels and robust green growth characteristics.",
            "symptoms": [
                "Uniform, deep green leaf color across the entire leaf blade without any discoloration.",
                "Strong, thick stalk and well-structured, flexible leaf veins.",
                "Excellent plant vigor and timely development of reproductive structures."
            ],
            "causes": [
                "Balanced soil nutrient profile with adequate N, P, and K availability.",
                "Ideal soil pH (6.0 - 6.8) and good soil structure with adequate drainage.",
                "Sufficient soil moisture and healthy root development."
            ],
            "treatmentImmediate": "No immediate corrective treatments needed. Maintain current watering schedule, pest control, and agronomic practices.",
            "preventionLongTerm": [
                "Continue regular soil testing and balanced fertilization programs.",
                "Practice crop rotation and cover cropping to maintain soil health.",
                "Maintain optimal soil moisture through crop residue management or mulching."
            ]
        }
    };
}
