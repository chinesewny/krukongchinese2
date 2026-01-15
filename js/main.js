// Main initialization and utility functions (Updated)
window.addEventListener('DOMContentLoaded', async () => {
    // Set today's date in attendance date input
    if(document.getElementById('att-date-input')) {
        document.getElementById('att-date-input').value = getThaiDateISO();
    }
    
    // Initialize Firebase
    showLoading("กำลังเตรียมระบบ...");
    try {
        await initializeFirebase();
        console.log("Firebase initialized successfully");
    } catch (error) {
        console.warn("Firebase initialization failed, continuing without cache:", error);
    } finally {
        hideLoading();
    }
    
    // Initialize UI components - wait for other files to load
    setTimeout(() => {
        // Initialize core functions
        if (typeof renderScoreButtons === 'function') {
            renderScoreButtons();
        }
        
        if (typeof initEventListeners === 'function') {
            initEventListeners();
        }
        
        if (typeof loadFromLocalStorage === 'function') {
            loadFromLocalStorage();
        }
        
        if (typeof setupInactivityTimer === 'function') {
            setupInactivityTimer();
        }
        
        // Initial UI refresh
        if (typeof refreshUI === 'function') {
            refreshUI();
        }
        
        // Initial data sync - with safety check
        setTimeout(() => {
            if (typeof syncData === 'function') {
                syncData();
                console.log("Data sync started");
            } else {
                console.error("syncData function not available");
                showToast("ระบบกำลังโหลด กรุณารอสักครู่...", "bg-yellow-600", "fa-solid fa-spinner fa-spin");
            }
        }, 300);
    }, 500);

    // Check queue every 5 seconds (Auto Retry)
    setInterval(() => {
        if (typeof processQueue === 'function') {
            processQueue();
        }
    }, 5000);

    // Check existing sessions
    const adminSession = localStorage.getItem('wany_admin_session');
    const studentCode = localStorage.getItem('current_student_code');

    if (adminSession) {
        switchMainTab('admin');
        // Delay to ensure functions are loaded
        setTimeout(() => {
            if (typeof showAdminPanel === 'function') {
                showAdminPanel(true);
            }
        }, 300);
    } else if (studentCode) {
        switchMainTab('student');
        document.getElementById('student-login-wrapper').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        
        // Try to render student dashboard
        setTimeout(() => {
            if (typeof renderStudentDashboard === 'function' && studentCode) {
                renderStudentDashboard(studentCode);
            }
        }, 500);
    } else {
        switchMainTab('student'); 
    }

    // Set up periodic checks
    setInterval(() => {
        if (typeof checkSmartSchedule === 'function') {
            checkSmartSchedule();
        }
    }, 60000);
    
    setInterval(() => {
        if (typeof syncData === 'function') {
            syncData();
        }
    }, 5 * 60 * 1000); // Sync every 5 minutes
    
    // Check for real-time updates (optional)
    if (typeof firebaseInitialized !== 'undefined' && firebaseInitialized) {
        if (typeof setupRealtimeUpdates === 'function') {
            setupRealtimeUpdates();
        }
    }
});

// Optional: Setup real-time updates for active users
function setupRealtimeUpdates() {
    // Only setup real-time for admin users
    const adminSession = localStorage.getItem('wany_admin_session');
    if (!adminSession) return;
    
    // Check if firebaseManager exists
    if (typeof firebaseManager === 'undefined') {
        console.warn("firebaseManager not available for real-time updates");
        return;
    }
    
    // Listen for attendance updates
    firebaseManager.setupRealtimeListener('attendance', (attendanceData) => {
        if (typeof dataState !== 'undefined') {
            dataState.attendance = attendanceData;
            
            // Only refresh if attendance panel is active
            if (!document.getElementById('admin-panel-attendance').classList.contains('hidden')) {
                if (typeof renderAttRoster === 'function') {
                    renderAttRoster();
                }
            }
        }
    });
    
    // Listen for score updates
    firebaseManager.setupRealtimeListener('scores', (scoresData) => {
        if (typeof dataState !== 'undefined') {
            dataState.scores = scoresData;
            
            // Only refresh if relevant panels are active
            if (!document.getElementById('admin-panel-scan').classList.contains('hidden')) {
                if (typeof renderScoreRoster === 'function') {
                    renderScoreRoster();
                }
            }
            if (!document.getElementById('admin-panel-report').classList.contains('hidden')) {
                if (typeof renderGradeReport === 'function') {
                    renderGradeReport();
                }
            }
        }
    });
    
    // Listen for submission updates
    firebaseManager.setupRealtimeListener('submissions', (submissionsData) => {
        if (typeof dataState !== 'undefined') {
            dataState.submissions = submissionsData;
            
            // Update homework badge
            if (typeof updateInboxBadge === 'function') {
                updateInboxBadge();
            }
            
            // Refresh homework panel if active
            if (!document.getElementById('admin-panel-homework').classList.contains('hidden')) {
                if (typeof renderIncomingSubmissions === 'function') {
                    renderIncomingSubmissions();
                }
            }
        }
    });
}

// Utility Functions
function showToast(message, colorClass = "", icon = "") { 
    const toast = document.getElementById('toast-notification'); 
    if (!toast) {
        console.warn("Toast element not found");
        return;
    }
    
    const messageEl = document.getElementById('toast-message');
    if (messageEl) {
        messageEl.textContent = message; 
    }
    
    // Update Icon
    const iconEl = toast.querySelector('i');
    if(iconEl) iconEl.className = icon || "fa-solid fa-circle-check text-2xl";

    const theme = colorClass || "bg-gradient-to-r from-green-600 to-teal-600 border-green-400/50";
    toast.className = `fixed bottom-10 left-1/2 -translate-x-1/2 text-white px-8 py-4 rounded-full shadow-2xl z-50 flex items-center gap-3 translate-y-20 opacity-0 font-bold border ${theme} toast-show`; 
    
    setTimeout(() => {
        if (toast.classList.contains('toast-show')) {
            toast.classList.remove('toast-show');
        }
    }, 3000); 
}

function switchMainTab(tab) { 
    // Hide all sections
    const sectionAdmin = document.getElementById('section-admin');
    const sectionStudent = document.getElementById('section-student');
    
    if (sectionAdmin) sectionAdmin.classList.add('hidden'); 
    if (sectionStudent) sectionStudent.classList.add('hidden'); 
    
    // Show selected section
    const selectedSection = document.getElementById(`section-${tab}`);
    if (selectedSection) {
        selectedSection.classList.remove('hidden'); 
    }
    
    // Update tab button styles
    const btnAdmin = document.getElementById('tab-btn-admin');
    const btnStudent = document.getElementById('tab-btn-student');
    
    if(tab === 'admin' && btnAdmin && btnStudent) {
        btnAdmin.className = "px-6 py-2 rounded-full text-sm font-bold bg-white text-blue-900 shadow-lg transition-all";
        btnStudent.className = "px-6 py-2 rounded-full text-sm font-bold text-white/50 hover:text-white transition-all";
    } else if (tab === 'student' && btnAdmin && btnStudent) {
        btnStudent.className = "px-6 py-2 rounded-full text-sm font-bold bg-white text-blue-900 shadow-lg transition-all";
        btnAdmin.className = "px-6 py-2 rounded-full text-sm font-bold text-white/50 hover:text-white transition-all";
    } 
}

function switchAdminSubTab(tab) { 
    // Hide all admin panels
    document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.add('hidden')); 
    
    // Show selected panel
    const panel = document.getElementById(`admin-panel-${tab}`);
    if (panel) {
        panel.classList.remove('hidden'); 
    }
    
    // Update menu button styles
    document.querySelectorAll('.menu-btn').forEach(btn => { 
        btn.className = "menu-btn glass-ios hover:bg-white/10 text-white/70 rounded-2xl py-3 font-bold"; 
    }); 
    
    // Highlight active button
    const activeBtn = document.getElementById(`menu-${tab}`);
    if(activeBtn) {
        activeBtn.className = "menu-btn btn-blue rounded-2xl py-3 font-bold shadow-lg text-white";
    }
    
    // Refresh UI for the selected tab
    if (typeof refreshUI === 'function') {
        refreshUI();
    }
}

function setupInactivityTimer() {
    let time;
    
    // Reset timer on user activity
    const resetTimer = () => { 
        clearTimeout(time); 
        time = setTimeout(logout, 30 * 60 * 1000); // 30 minutes
    };
    
    const logout = () => { 
        alert("หมดเวลาการใช้งาน (30 นาที) ระบบจะออกจากระบบเพื่อความปลอดภัย"); 
        localStorage.removeItem('wany_admin_session'); 
        localStorage.removeItem('current_student_code'); 
        location.reload(); 
    };
    
    window.onload = resetTimer; 
    document.onmousemove = resetTimer; 
    document.onkeypress = resetTimer; 
    document.ontouchstart = resetTimer; 
    document.onclick = resetTimer;
}

window.handleLogout = function(force = false) { 
    if(force || confirm("ออกจากระบบ?")) { 
        showLoading("กำลังออกจากระบบ...");
        localStorage.removeItem('wany_admin_session'); 
        localStorage.removeItem('wany_data_backup'); 
        localStorage.removeItem('current_student_code'); 
        setTimeout(() => location.reload(), 500);
    } 
};

function showAdminPanel(auto = false) { 
    const loginWrapper = document.getElementById('admin-login-wrapper');
    const contentWrapper = document.getElementById('admin-content-wrapper');
    
    if (loginWrapper) loginWrapper.classList.add('hidden'); 
    if (contentWrapper) contentWrapper.classList.remove('hidden'); 
    
    if (typeof refreshUI === 'function') {
        refreshUI(); 
    }
    
    if(!auto) {
        if (typeof syncData === 'function') {
            syncData();
        }
    }
    
    const adminEmail = localStorage.getItem('admin_email');
    if(!adminEmail) {
        if (typeof openEmailModal === 'function') {
            openEmailModal('admin');
        }
    }
}

function logoutStudent() { 
    const dashboard = document.getElementById('student-dashboard');
    const loginWrapper = document.getElementById('student-login-wrapper');
    const loginInput = document.getElementById('student-login-id');
    
    if (dashboard) dashboard.classList.add('hidden'); 
    if (loginWrapper) loginWrapper.classList.remove('hidden'); 
    if (loginInput) loginInput.value = ''; 
}

// Firebase utility functions
async function forceRefreshCache() {
    if (typeof firebaseInitialized === 'undefined' || !firebaseInitialized) {
        alert("Firebase not initialized");
        return;
    }
    
    if (typeof firebaseManager === 'undefined') {
        alert("Firebase manager not available");
        return;
    }
    
    showLoading("กำลังรีเฟรชแคช...");
    try {
        // Clear existing cache
        await firebaseManager.clearCache();
        
        // Reload from Google Sheet
        if (typeof syncFromGoogleSheet === 'function') {
            await syncFromGoogleSheet();
            showToast("รีเฟรชแคชสำเร็จ", "bg-green-600");
        } else {
            showToast("syncFromGoogleSheet function not available", "bg-red-600");
        }
    } catch (error) {
        console.error("Force refresh error:", error);
        showToast("รีเฟรชแคชล้มเหลว", "bg-red-600");
    } finally {
        hideLoading();
    }
}

// Loading functions
function showLoading(text = "กำลังประมวลผล...") {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    
    if (overlay) overlay.classList.remove('hidden');
    if (textEl) textEl.textContent = text;
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// Thai date utility
function getThaiDateISO() {
    const now = new Date();
    const timezoneOffset = 7 * 60; // Thailand is UTC+7
    const thaiTime = new Date(now.getTime() + timezoneOffset * 60000);
    return thaiTime.toISOString().split('T')[0];
}

// Default functions (fallback if not defined elsewhere)
if (typeof refreshUI === 'undefined') {
    function refreshUI() {
        console.log("refreshUI called (default implementation)");
        // This should be overridden by ui.js
    }
}

if (typeof renderScoreButtons === 'undefined') {
    function renderScoreButtons() {
        console.log("renderScoreButtons called (default implementation)");
        const container = document.getElementById('score-buttons-container');
        if (!container) return;
        
        const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        container.innerHTML = '';
        
        scores.forEach(score => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'py-2 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 text-white text-sm font-bold hover:from-blue-500 hover:to-blue-700 transition-all shadow-md';
            button.textContent = score;
            button.onclick = () => {
                const input = document.getElementById('scan-score-input');
                if (input) input.value = score;
            };
            container.appendChild(button);
        });
    }
}

if (typeof initEventListeners === 'undefined') {
    function initEventListeners() {
        console.log("initEventListeners called (default implementation)");
        
        // Admin login form
        const adminForm = document.getElementById('admin-login-form');
        if (adminForm) {
            adminForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const username = document.getElementById('admin-username')?.value;
                const password = document.getElementById('admin-password')?.value;
                
                if (username === 'admin' && password === '1234') {
                    localStorage.setItem('wany_admin_session', 'true');
                    showAdminPanel();
                    showToast("เข้าสู่ระบบสำเร็จ", "bg-green-600");
                } else {
                    showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "bg-red-600");
                }
            });
        }
        
        // Student login button
        const studentLoginBtn = document.querySelector('button[onclick="handleStudentLogin()"]');
        if (studentLoginBtn) {
            studentLoginBtn.addEventListener('click', function() {
                if (typeof handleStudentLogin === 'function') {
                    handleStudentLogin();
                } else {
                    showToast("ระบบกำลังโหลด กรุณารอสักครู่", "bg-yellow-600");
                }
            });
        }
    }
}
