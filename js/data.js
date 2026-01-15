// Data synchronization and storage functions (Updated with better error handling)
async function syncData() {
    // If queue is pending, don't fetch new data
    if (requestQueue.length > 0) {
        processQueue();
        return;
    }

    const statusIcon = document.querySelector('.fa-wifi');
    if(statusIcon) {
        statusIcon.className = "fa-solid fa-spinner fa-spin text-yellow-400"; 
        if(statusIcon.nextSibling) {
            statusIcon.nextSibling.textContent = " Syncing...";
        }
    }

    try {
        // Step 1: Try to load from Firebase cache first (fast)
        if (firebaseFallback.shouldUseFirebase()) {
            try {
                const cachedData = await firebaseManager.loadAllData();
                
                if (cachedData && Object.keys(cachedData).length > 0) {
                    // Update local state with cached data
                    Object.assign(dataState, cachedData);
                    refreshUI();
                    updateSyncUI('Online (Cache)', 'green');
                    
                    // Continue with background sync from Google Sheet
                    setTimeout(() => {
                        syncFromGoogleSheet().catch(err => {
                            console.warn("Background sync failed:", err);
                        });
                    }, 1000);
                    return;
                }
            } catch (firebaseError) {
                console.warn("Firebase cache load failed:", firebaseError.message);
                // Continue to Google Sheet sync
            }
        }
        
        // Step 2: Load from Google Sheet
        await syncFromGoogleSheet();
        
    } catch (error) {
        console.warn("Sync Failed (Offline/Error):", error);
        loadFromLocalStorage();
        refreshUI();
        updateSyncUI('Offline', 'red');
    }
}

async function syncFromGoogleSheet() {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL + "?action=getData&t=" + Date.now());
        const result = await response.json();
        
        if (result.status === 'success' || result.subjects) {
            // Update local state
            dataState = result.data || result;
            
            // Save to Firebase cache (background) - with error handling
            if (firebaseFallback.shouldUseFirebase()) {
                setTimeout(() => {
                    firebaseManager.saveAllData(dataState).catch(err => {
                        console.warn("Failed to save to Firebase cache (non-critical):", err.message);
                    });
                }, 2000); // Delay to prevent quota
            }
            
            // Save to localStorage
            saveToLocalStorage();
            refreshUI();
            updateSyncUI('Online', 'green');
            
            // Reset quota errors on successful sync
            firebaseFallback.handleSuccess();
        }
    } catch (error) {
        console.error("Google Sheet sync failed:", error);
        throw error;
    }
}

function updateSyncUI(text, color) {
    const statusElements = document.querySelectorAll('#sync-status, #sync-status-scan');
    
    // Add fallback indicator
    let statusText = text;
    if (firebaseFallback.fallbackMode && text.includes('Online')) {
        statusText = text.replace('Online', 'Online (No Cache)');
    }
    
    statusElements.forEach(element => {
        if (element) {
            element.textContent = " " + statusText;
        }
    });
    
    const statusIcon = document.querySelector('.fa-wifi');
    if(statusIcon) {
        if (firebaseFallback.fallbackMode) {
            statusIcon.className = "fa-solid fa-wifi text-yellow-400";
            if (statusIcon.parentElement) {
                statusIcon.parentElement.className = "text-xs text-yellow-400 font-bold transition-all";
            }
        } else {
            statusIcon.className = color === 'green' ? "fa-solid fa-wifi" : "fa-solid fa-wifi text-red-400 animate-pulse";
            if (statusIcon.parentElement) {
                statusIcon.parentElement.className = `text-xs text-${color}-400 font-bold transition-all`;
            }
        }
    }
}

async function handleStudentLogin() {
    const inputId = document.getElementById('student-login-id').value.trim();
    if (!inputId) return alert("กรุณากรอกรหัสนักเรียน");
    
    // Check if student data is loaded
    if (dataState.students.length === 0) {
        showLoading("กำลังโหลดฐานข้อมูล...");
        await syncData(); // Try to fetch new data
    }

    showLoading("กำลังตรวจสอบข้อมูล...");
    await new Promise(r => setTimeout(r, 500)); // Delay for smooth UI

    // Check again
    if (dataState.students.length === 0) {
        hideLoading();
        showToast("กำลังโหลดข้อมูล... กรุณาลองใหม่", "bg-yellow-600", "fa-solid fa-circle-exclamation text-2xl");
        return;
    }

    const student = dataState.students.find(s => String(s.code) === String(inputId) || String(s.id) === String(inputId));
    
    hideLoading();

    if (student) {
        localStorage.setItem('current_student_code', student.code);
        document.getElementById('student-login-wrapper').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        if(student.code) renderStudentDashboard(student.code);
        showToast(`ยินดีต้อนรับ ${student.name}`);
    } else {
        // Student not found
        showToast("ไม่พบรายชื่อนี้ในระบบ", "bg-red-600 border-red-400", "fa-solid fa-circle-xmark text-2xl");
    }
}

function saveToLocalStorage() { 
    localStorage.setItem('wany_data_backup', JSON.stringify({ 
        timestamp: new Date().getTime(), 
        data: dataState 
    })); 
}

function loadFromLocalStorage() { 
    const backup = localStorage.getItem('wany_data_backup'); 
    if(backup) { 
        const parsed = JSON.parse(backup); 
        if(new Date().getTime() - parsed.timestamp < 1800000) {
            dataState = parsed.data; 
        }
    } 
}

async function saveAndRefresh(payload) { 
    // 1. If it's a Login request, send immediately (no queue)
    if(payload.action === 'login') {
        showLoading("กำลังตรวจ
