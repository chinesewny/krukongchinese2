import { syncData, saveAndRefresh, backupToGoogleSheet, restoreFromGoogleSheet } from './firebase-service.js';
import { dataState, globalState, loadFromLocalStorage, updateLocalState, saveToLocalStorage } from "./state.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { GOOGLE_SCRIPT_URL } from "./config.js"; // <--- วางตรงนี้ถ้ายังไม่มี
import { 
    refreshUI, 
    renderScoreRoster, 
    renderAttRoster, 
    renderGradeReport, 
    updateScanTaskDropdown, 
    renderStudentDashboard, 
    renderConfigSlots, 
    renderTaskClassCheckboxesAccum, 
    renderTaskChapterCheckboxesAccum, 
    renderTaskClassCheckboxesExam,
    renderIncomingSubmissions, 
    renderAdminMaterials, 
    renderExamPanel, 
    renderScoreManagerPanel,
    renderExamTable,
    addExamColumn,openExamEditor, 
    closeExamModal,
    addQuestionItem,
    openEditColumnModal, renderScoreManagerTable, editChapterConfig,renderExamManagerPage,renderMainExamHub
} from "./ui-render.js";
import { previewTasksBySubject } from "./ui-render.js"; // Import เข้ามา

window.previewTasksBySubject = previewTasksBySubject; // ผูกกับ Window
// --- ส่วน Lucky Draw ---
import { setLuckyMode, startLuckyDraw, clearLuckyHistory } from "./ui-render.js";
import { openEditChapterModal } from "./ui-render.js"; // อย่าลืม import
import { getThaiDateISO, formatThaiDate, calGrade, showToast, showLoading, hideLoading, calculateScores, compressImage } from "./utils.js";
import { PERIODS } from "./config.js";
window.deleteTask = function(taskId) {
    if(!confirm("⚠️ คำเตือน: คุณต้องการลบงานชิ้นนี้ใช่หรือไม่?\n\n- คะแนนทั้งหมดในงานนี้จะหายไป\n- การกระทำนี้ไม่สามารถย้อนกลับได้")) {
        return;
    }
    window.loadMaterialsFromSheet();
// ในไฟล์ js/main.js

// 3. ฟังก์ชันแก้ไขชื่องาน (Edit Task Name)
window.updateTaskName = function(taskId, newName) {
    const task = dataState.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const oldName = task.name;
    const name = newName.trim();

    // ถ้าชื่อว่าง หรือ เป็นชื่อเดิม ไม่ต้องทำอะไร
    if (!name) {
        showToast("ชื่อห้ามว่าง!", "bg-red-600");
        renderScoreManagerPanel(); // รีโหลดเพื่อคืนค่าเดิม
        return;
    }
    if (name === oldName) return;

    // 1. อัปเดตในเครื่องทันที
    task.name = name;
    saveToLocalStorage();

    // 2. ส่งไปบันทึกที่ Server (Google Sheet/Firebase)
    // ส่ง action: 'editTask' (ต้องไปดักจับใน Apps Script เพิ่มเติมถ้าต้องการให้แก้ใน Sheet ด้วย)
    // หรือถ้าใช้ระบบ overwrite dataState อยู่แล้ว มันจะอัปเดตให้อัตโนมัติเมื่อ Sync
    saveAndRefresh({ action: 'editTask', id: taskId, name: name });

    console.log(`Renamed task ${taskId} to ${name}`);
    showToast("เปลี่ยนชื่อเรียบร้อย");
};
    showLoading("กำลังลบข้อมูล...");
    // ลบ Task ออกจากรายการ
    dataState.tasks = dataState.tasks.filter(t => String(t.id) !== String(taskId));
    
    // ลบ คะแนน (Scores) ที่ผูกกับ Task นี้ทิ้งไป
    dataState.scores = dataState.scores.filter(s => String(s.taskId) !== String(taskId));

    // ลบ ประวัติการส่งงาน
    dataState.submissions = dataState.submissions.filter(s => String(s.taskId) !== String(taskId));
    if(dataState.returns) {
        dataState.returns = dataState.returns.filter(r => String(r.taskId) !== String(taskId));
    }

    // บันทึกลงเครื่องทันที
    saveToLocalStorage(); 
    
    // ส่งคำสั่งไป Sync (บอก Server ว่าลบงานนี้)
    saveAndRefresh({ action: 'deleteTask', taskId: taskId }); 
    
    // รีเฟรชเฉพาะตารางจัดการคะแนนเพื่อความลื่นไหล
    renderScoreManagerPanel();
    
    hideLoading();
    showToast("ลบงานเรียบร้อยแล้ว", "bg-red-600");
};

// 2. ฟังก์ชันอัปเดตคะแนนทันทีเมื่อพิมพ์เสร็จ (Direct Update)
window.updateScoreDirect = function(studentId, taskId, val, maxScore) {
    // ตรวจสอบค่าคะแนน
    if (val !== '' && Number(val) > Number(maxScore)) {
        alert(`คะแนนเกินค่าเต็ม (${maxScore})`);
        renderScoreManagerPanel(); // คืนค่าเดิม
        return;
    }

    // 🟢 ส่งข้อมูลให้บันทึกลง Firestore ทันที (ไม่ต้องใช้ setTimeout ครอบแล้ว)
    saveAndRefresh({ action: 'addScore', studentId: studentId, taskId: taskId, score: val });
    
    console.log("Instant saved score: " + val);
};
// --- Global Functions (Exposed to Window) ---
window.renderStudentDashboard = renderStudentDashboard;
window.saveAndRefresh = saveAndRefresh;
window.openEditColumnModal = openEditColumnModal;
// 🛠 1. ฟังก์ชันสลับแท็บ (Tab Switching)
// ในไฟล์ js/main.js

window.switchMainTab = function(t) { 
    const secAdmin = document.getElementById('section-admin');
    const secStudent = document.getElementById('section-student');
    
    // ป้องกัน Error กรณีหา Element ไม่เจอ
    if(secAdmin) secAdmin.classList.add('hidden'); 
    if(secStudent) secStudent.classList.add('hidden'); 
    
    const target = document.getElementById(`section-${t}`);
    if(target) target.classList.remove('hidden'); 
    
    const btnA = document.getElementById('tab-btn-admin');
    const btnS = document.getElementById('tab-btn-student');

    if(btnA && btnS) {
        if(t === 'admin'){ 
            btnA.className="px-6 py-2 rounded-full text-sm font-bold bg-white text-blue-900 shadow-lg transition-all"; 
            btnS.className="px-6 py-2 rounded-full text-sm font-bold text-white/50 hover:text-white transition-all"; 
        } else { 
            btnS.className="px-6 py-2 rounded-full text-sm font-bold bg-white text-blue-900 shadow-lg transition-all"; 
            btnA.className="px-6 py-2 rounded-full text-sm font-bold text-white/50 hover:text-white transition-all"; 
        }
    }
};

// ไฟล์ js/main.js

// แก้ไขฟังก์ชันสลับเมนู Admin
// js/main.js

window.switchAdminSubTab = function(t) {
    // 1. ซ่อนทุกหน้าก่อน
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden')); 
    
    // 2. หา Panel ที่จะแสดง
    let panelId = `admin-panel-${t}`;
    
    // กรณีพิเศษ: map ชื่อ tab เข้ากับ id ของ div
    if(t === 'scores') {
        panelId = document.getElementById('admin-panel-scores') ? 'admin-panel-scores' : 'admin-panel-management';
    }

    const target = document.getElementById(panelId);
    if(target) target.classList.remove('hidden');

    // 3. ปรับสีปุ่มเมนู (Active State)
    document.querySelectorAll('.menu-btn').forEach(b => { 
        b.className = "menu-btn glass-ios hover:bg-white/10 text-white/70 rounded-2xl py-3 font-bold"; 
    }); 
    const activeBtn = document.getElementById(`menu-${t}`); 
    if(activeBtn) activeBtn.className = "menu-btn btn-blue rounded-2xl py-3 font-bold shadow-lg text-white"; 
    
    // 4. เรียกฟังก์ชันแสดงผลตามแท็บที่เลือก
    if(t === 'exam') {
        // ✨ แก้ไขตรงนี้: เรียกหน้า Hub รวม (แทนที่จะเรียกหน้าใดหน้าหนึ่ง) ✨
        if(typeof renderMainExamHub === 'function') {
            renderMainExamHub(); 
        } else {
            console.error("หาฟังก์ชัน renderMainExamHub ไม่เจอ กรุณาเช็คการ import ในไฟล์ main.js");
        }
    } else if (t === 'scores' || t === 'management') {
        window.renderScoreManagerPanel(); 
    } else {
        refreshUI(); 
    }
};

window.handleLogout = function(force=false) {
    if(force || confirm("ออกจากระบบ?")) { 
        showLoading("กำลังออกจากระบบ...");
        localStorage.removeItem('wany_admin_session'); 
        localStorage.removeItem('wany_data_backup'); 
        localStorage.removeItem('current_student_code'); 
        setTimeout(() => location.reload(), 500);
    } 
};
// ตัวอย่างการทำ Auto-Login เมื่อเปิดหน้าเว็บ
window.checkAutoLogin = function() {
    const savedCode = localStorage.getItem('current_student_code');
    if (savedCode && dataState.students && dataState.students.length > 0) {
        const student = dataState.students.find(s => String(s.code) === String(savedCode));
        if (student) {
            // ซ่อนหน้าล็อคอิน แสดง Dashboard
            const loginWrapper = document.getElementById('student-login-wrapper');
            const dashboard = document.getElementById('student-dashboard');
            if(loginWrapper) loginWrapper.classList.add('hidden');
            if(dashboard) dashboard.classList.remove('hidden');
            
            if (typeof renderStudentDashboard === 'function') {
                renderStudentDashboard(student.code); // ดึงข้อมูลมาแสดง
            }
        }
    }
};

// อย่าลืมเรียกใช้ checkAutoLogin() หลังจากที่โหลดข้อมูลนักเรียนเสร็จแล้วนะครับ
window.handleStudentLogin = async function() {
    // 1. รับค่าและล้างช่องว่างที่มองไม่เห็นทั้งหมด
    let rawInput = document.getElementById('student-login-id').value;
    if (!rawInput || !rawInput.trim()) return alert("กรุณากรอกรหัสนักเรียน");

    // ตัดช่องว่างทุกชนิดและแปลงเป็นพิมพ์เล็ก
    const inputId = String(rawInput).replace(/\s+/g, '').toLowerCase();

    // 2. ระบบรอโหลดฐานข้อมูลสูงสุด 4 วินาที (แก้ปัญหาเน็ตช้า)
    if (!dataState.students || dataState.students.length === 0) {
        if(typeof showLoading === 'function') showLoading("กำลังดึงข้อมูลรายชื่อ...");
        let attempts = 0;
        while (dataState.students.length === 0 && attempts < 40) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
    }
    
    if(typeof hideLoading === 'function') hideLoading();

    // 3. ค้นหารายชื่อแบบยืดหยุ่น (ล้างช่องว่างในฐานข้อมูลก่อนเทียบ)
    const student = dataState.students.find(s => {
        if (!s.code) return false;
        const dbCode = String(s.code).replace(/\s+/g, '').toLowerCase();
        const dbId = String(s.id).replace(/\s+/g, '').toLowerCase();
        return dbCode === inputId || dbId === inputId;
    });

    // 4. แสดงผล
    if (student) {
        localStorage.setItem('current_student_code', student.code);
        document.getElementById('student-login-wrapper').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
        
        if (typeof renderStudentDashboard === 'function') {
            renderStudentDashboard(student.code);
        }
        if (typeof showToast === 'function') showToast(`ยินดีต้อนรับ ${student.name}`);
    } else {
        alert(`ไม่พบรายชื่อในระบบ!\n\nรหัสที่คุณพิมพ์คือ: "${inputId}"\n(โปรดตรวจสอบความถูกต้องอีกครั้ง หรือแจ้งคุณครูผู้สอน)`);
        if (typeof showToast === 'function') showToast("ไม่พบรายชื่อนี้ในระบบ", "bg-red-600 border-red-400");
    }
};

// --- 2. Email & Config Functions ---
window.openEmailModal = function(role) {
    document.getElementById('email-modal').classList.remove('hidden');
    document.getElementById('email-modal-role').value = role;
    const closeBtn = document.getElementById('btn-close-email');
    let currentEmail = "";
    if (role === 'admin') { currentEmail = localStorage.getItem('admin_email') || ""; } 
    else { const code = localStorage.getItem('current_student_code'); const s = dataState.students.find(x => x.code == code); if(s && s.email) currentEmail = s.email; }
    document.getElementById('user-email-input').value = currentEmail;
    if (!currentEmail) { closeBtn.classList.add('hidden'); } else { closeBtn.classList.remove('hidden'); }
};

window.saveUserEmail = async function() {
    const emailInput = document.getElementById('user-email-input');
    const email = emailInput.value.trim();
    const role = document.getElementById('email-modal-role').value;
    
    if(!email.includes('@')) return alert("รูปแบบอีเมลไม่ถูกต้อง");
    showLoading("กำลังบันทึกอีเมล...");

    try {
        let payload = { action: 'updateEmail', email: email };
        if (role === 'admin') {
            localStorage.setItem('admin_email', email);
            await new Promise(r => setTimeout(r, 500)); 
        } else {
            const code = localStorage.getItem('current_student_code');
            const s = dataState.students.find(x => x.code == code);
            if (s) { payload.studentId = s.id; await saveAndRefresh(payload); } 
            else { throw new Error("Student not found"); }
        }
        document.getElementById('email-modal').classList.add('hidden');
        showToast("บันทึกข้อมูลเรียบร้อย");
    } catch (error) { alert("บันทึกไม่สำเร็จ: " + error.message); } 
    finally { hideLoading(); }
};

window.openSubjectConfig = function(subjectId) {
    document.getElementById('subject-config-modal').classList.remove('hidden');
    document.getElementById('config-subject-id').value = subjectId;
    const sub = dataState.subjects.find(s => s.id == subjectId);
    document.getElementById('config-subject-name').textContent = sub ? sub.name : '-';
    globalState.tempConfig = (sub && sub.scoreConfig && sub.scoreConfig.length > 0) ? [...sub.scoreConfig] : [10,10,10,10,10];
    renderConfigSlots();
};

window.addConfigSlot = function() { globalState.tempConfig.push(10); renderConfigSlots(); };
window.removeConfigSlot = function(idx) { globalState.tempConfig.splice(idx, 1); renderConfigSlots(); };
window.updateTempConfig = function(idx, val) { globalState.tempConfig[idx] = Number(val); renderConfigSlots(); };
window.saveSubjectConfig = function() {
    const subId = document.getElementById('config-subject-id').value;
    saveAndRefresh({ action: 'updateSubjectConfig', id: subId, config: globalState.tempConfig });
    document.getElementById('subject-config-modal').classList.add('hidden');
    showToast("บันทึกโครงสร้างคะแนนแล้ว");
};

// --- 3. Score & Attendance Functions ---
window.setScoreMode = function(m) { 
    globalState.scoreMode = m; 
    document.querySelectorAll('.btn-score').forEach(b => { 
        b.classList.remove('btn-score-active'); 
        if(b.textContent == m) b.classList.add('btn-score-active'); 
    }); 
    if(m=='manual') document.getElementById('btn-score-manual').classList.add('btn-score-active'); 
    else document.getElementById('btn-score-manual').classList.remove('btn-score-active'); 
    document.getElementById('scan-score-input').focus(); 
};

window.setAttMode = function(mode) {
    globalState.attMode = mode; 
    ['present','leave','absent','activity'].forEach(t => { 
        const el = document.getElementById(`btn-att-${t}`);
        if(el) el.classList.remove(`btn-att-active-${t}`); 
    });
    let btnMap = { 'มา': 'present', 'ลา': 'leave', 'ขาด': 'absent', 'กิจกรรม': 'activity' };
    let btnId = btnMap[mode];
    if(btnId) document.getElementById(`btn-att-${btnId}`).classList.add(`btn-att-active-${btnId}`);
    document.getElementById('att-scan-input').focus();
    showToast(`โหมดเช็คชื่อ: ${mode}`, "bg-blue-600");
};

window.closeScoreModal = function() {
    document.getElementById('score-modal').classList.add('hidden');
    document.getElementById('scan-score-input').value = '';
    setTimeout(()=>document.getElementById('scan-score-input').focus(), 100);
};

window.useSmartClass = function() { 
    if(globalState.smartClassId) { 
        document.getElementById('att-class-select').value = globalState.smartClassId; 
        renderAttRoster(); 
    } 
};

window.searchIndividual = function(keyword) {
    const container = document.getElementById('individual-search-results');
    container.innerHTML = '';
    if(!keyword) { container.classList.add('hidden'); return; }
    const results = dataState.students.filter(s => s.name.includes(keyword) || String(s.code).includes(keyword) || String(s.no) == keyword);
    if(results.length > 0) {
        container.classList.remove('hidden');
        results.forEach(s => {
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-white/10 cursor-pointer text-white border-b border-white/5 last:border-0";
            div.innerHTML = `<div class="font-bold text-sm">${s.name}</div><div class="text-xs text-white/50">${s.code}</div>`;
            div.onclick = () => { 
                document.getElementById('individual-result-container').classList.remove('hidden');
                document.getElementById('ind-name').textContent = s.name;
                document.getElementById('ind-id').textContent = s.code;
                document.getElementById('ind-class').textContent = dataState.classes.find(c=>c.id==s.classId)?.name || '-';

                const tasks = dataState.tasks.filter(t => t.classId == s.classId);
                const { total, midterm, final } = calculateScores(s.id, s.classId, tasks);
                document.getElementById('ind-gpa').textContent = calGrade(total);
                document.getElementById('ind-score-mid').textContent = midterm || '-';
                document.getElementById('ind-score-final').textContent = final || '-';

                const atts = dataState.attendance.filter(a => a.studentId == s.id);
                let p=0, l=0, a=0, act=0, aDates=[];
                atts.forEach(att => {
                    if(att.status === 'มา') p++;
                    else if(att.status === 'ลา') l++;
                    else if(att.status === 'ขาด') { a++; aDates.push(formatThaiDate(att.date)); }
                    else if(att.status === 'กิจกรรม') act++;
                });

                document.getElementById('ind-att-present').textContent = p;
                document.getElementById('ind-att-leave').textContent = l;
                document.getElementById('ind-att-absent').textContent = a;
                document.getElementById('ind-att-activity').textContent = act;
                document.getElementById('ind-absent-dates').innerHTML = aDates.length > 0 ? aDates.map(d => `<span class="inline-block bg-red-500/20 text-red-200 px-1.5 py-0.5 rounded text-[10px] mr-1 mb-1">${d}</span>`).join('') : '<span class="text-green-400/60 text-xs">ไม่มีประวัติการขาดเรียน</span>';

                const allTasks = tasks;
                const submittedIds = [];
                dataState.scores.forEach(sc => { if(sc.studentId == s.id) submittedIds.push(sc.taskId); });
                dataState.submissions.forEach(sub => { if(sub.studentId == s.id) submittedIds.push(sub.taskId); });
                
                const uniqueSubmitted = [...new Set(submittedIds)];
                const totalCount = allTasks.length;
                const doneCount = uniqueSubmitted.filter(id => allTasks.find(t => t.id == id)).length;
                const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

                document.getElementById('ind-work-progress-text').textContent = `${percent}%`;
                document.getElementById('ind-work-bar').style.width = `${percent}%`;

                const missingListDiv = document.getElementById('ind-missing-list');
                missingListDiv.innerHTML = '';
                const missingTasks = allTasks.filter(t => !uniqueSubmitted.includes(t.id));
                
                if (missingTasks.length > 0) {
                    missingTasks.forEach(t => {
                        const el = document.createElement('div');
                        el.className = "bg-white/5 p-2 rounded border-l-2 border-red-400 flex items-center justify-between";
                        el.innerHTML = `<span class="text-xs text-white/80 truncate">${t.name}</span><span class="text-xs text-red-400">ยังไม่ส่ง</span>`;
                        missingListDiv.appendChild(el);
                    });
                } else {
                    missingListDiv.innerHTML = `<div class="text-center py-2 text-green-400 text-xs"><i class="fa-solid fa-check-circle mr-1"></i>ส่งงานครบแล้ว</div>`;
                }
                container.classList.add('hidden'); 
                document.getElementById('individual-search').value = '';
            };
            container.appendChild(div);
        });
    } else { container.classList.add('hidden'); }
};

window.openSubmitModal = function(taskId, studentId, taskName, isEdit = false) {
    document.getElementById('submit-modal').classList.remove('hidden');
    document.getElementById('submit-task-id').value = taskId;
    document.getElementById('submit-student-id').value = studentId;
    
    // เปลี่ยนหัวข้อถ้าเป็นการแก้ไข
    const titleText = isEdit ? `📝 แก้ไขงาน: ${taskName}` : `🚀 ส่งงาน: ${taskName}`;
    document.getElementById('submit-modal-title').textContent = titleText;
    
    // ดึงข้อมูลเดิมมาใส่ถ้าเป็นการแก้ไข
    const existingSub = dataState.submissions.find(s => s.taskId == taskId && s.studentId == studentId);
    
    if (isEdit && existingSub) {
        document.getElementById('submit-link-input').value = existingSub.link;
        document.getElementById('submit-comment-input').value = existingSub.comment || '';
        document.getElementById('btn-submit-final').textContent = "บันทึกการแก้ไข";
    } else {
        document.getElementById('submit-link-input').value = '';
        document.getElementById('submit-comment-input').value = '';
        document.getElementById('btn-submit-final').textContent = "ส่งงาน";
    }

    // (ส่วนเพื่อนร่วมกลุ่มคงเดิม...)
    document.getElementById('friend-selector-container').innerHTML = '';
    const student = dataState.students.find(s => s.id == studentId);
    if(student) {
        const friends = dataState.students.filter(s => s.classId == student.classId && s.id != studentId);
        const container = document.getElementById('friend-selector-container');
        friends.forEach(f => {
            const div = document.createElement('div');
            div.className = "friend-item flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer";
            div.innerHTML = `<input type="checkbox" value="${f.id}" class="friend-checkbox accent-blue-500"><span class="text-xs text-white/80">${f.name}</span>`;
            container.appendChild(div);
        });
    }
};

window.submitGroupGrade = async function(studentIdsStr, taskId, max, inputId) { 
    const val = document.getElementById(inputId).value; 
    if(val === '') return alert("กรุณาใส่คะแนน"); 
    if(Number(val) > Number(max)) return alert("คะแนนเกินค่าเต็ม"); 
    const sids = studentIdsStr.split(','); 
    for (const sid of sids) updateLocalState({ action:'addScore', studentId: sid, taskId: taskId, score: val }); 
    refreshUI();
    sids.forEach(sid => saveAndRefresh({ action:'addScore', studentId: sid, taskId: taskId, score: val })); 
    showToast(`บันทึกคะแนนกลุ่มเรียบร้อย`, "bg-green-600");
};

window.returnGroupWork = async function(studentIdsStr, taskId) { 
    const reason = prompt("ระบุเหตุผลที่ส่งคืน:"); 
    if(reason) { 
        const sids = studentIdsStr.split(','); 
        for (const sid of sids) updateLocalState({ action:'returnForRevision', studentId: sid, taskId: taskId, comment: reason }); 
        refreshUI();
        sids.forEach(sid => saveAndRefresh({ action:'returnForRevision', studentId: sid, taskId: taskId, comment: reason })); 
        showToast("ส่งคืนงานเรียบร้อย", "bg-yellow-600");
    } 
};

// --- 4. Exam & CSV Functions ---
// ในไฟล์ js/main.js

window.setExamTab = function(type) {
    // 1. อัปเดตสถานะ Global
    if (!window.globalState) window.globalState = {};
    window.globalState.currentExamType = type;

    // 2. เปลี่ยนสีปุ่ม (Manual Toggle)
    const btnMid = document.getElementById('tab-exam-mid');
    const btnFinal = document.getElementById('tab-exam-final');

    // Safety Check: เผื่อหาปุ่มไม่เจอ
    if (btnMid && btnFinal) {
        if(type === 'midterm') {
            btnMid.className = "px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white shadow-lg transition-all";
            btnFinal.className = "px-6 py-2 rounded-lg text-sm font-bold text-white/50 hover:text-white transition-all";
        } else {
            // โหมด Final
            btnFinal.className = "px-6 py-2 rounded-lg text-sm font-bold bg-purple-600 text-white shadow-lg transition-all";
            btnMid.className = "px-6 py-2 rounded-lg text-sm font-bold text-white/50 hover:text-white transition-all";
        }
    }

    // 3. ⚠️ จุดสำคัญ: เรียกแค่ renderExamTable พอครับ (อย่าเรียก renderExamPanel)
    // เพื่อป้องกันการวนลูป และเพื่อให้ตารางเปลี่ยนข้อมูลตามประเภทสอบ
    if(typeof renderExamTable === 'function') {
        renderExamTable();
    }
};

window.renderExamPanel = renderExamPanel;
window.renderExamTable = renderExamTable;
window.addExamColumn = addExamColumn;
window.updateExamConfig = async function() {
    const classId = document.getElementById('exam-class-select').value;
    const max = document.getElementById('exam-max-score').value;
    const type = globalState.currentExamType || 'midterm';
    if(!classId) return alert("กรุณาเลือกห้องเรียน");
    
    let task = dataState.tasks.find(t => t.classId == classId && t.category === type);
    const subId = dataState.classes.find(c => c.id == classId).subjectId;
    const name = type === 'midterm' ? 'สอบกลางภาค' : 'สอบปลายภาค';
    
    if(task) {
        alert(`บันทึกค่าคะแนนเต็ม (${max}) สำหรับ ${name} เรียบร้อย`);
        task.maxScore = max; 
        saveToLocalStorage(); 
    } else {
        await saveAndRefresh({
            action: 'addTask', id: Date.now(), classIds: [classId], subjectId: subId,
            category: type, chapter: [], name: name, maxScore: max, dueDateISO: getThaiDateISO()
        });
        showToast("สร้างรายการสอบเรียบร้อย");
    }
    renderExamPanel();
};

window.saveExamScore = function(studentId, val) {
    const classId = document.getElementById('exam-class-select').value;
    const type = globalState.currentExamType || 'midterm';
    const task = dataState.tasks.find(t => t.classId == classId && t.category === type);
    if(!task) return alert("กรุณากดบันทึกตั้งค่าคะแนนเต็มก่อน");
    if(val !== '' && Number(val) > Number(task.maxScore)) return alert("คะแนนเกินค่าเต็ม");
    updateLocalState({ action: 'addScore', studentId: studentId, taskId: task.id, score: val });
    saveAndRefresh({ action: 'addScore', studentId: studentId, taskId: task.id, score: val });
};

window.processExamCSV = function() {
    const fileInput = document.getElementById('exam-csv-input');
    const file = fileInput.files[0];
    if (!file) return;
    const classId = document.getElementById('exam-class-select').value;
    const type = globalState.currentExamType || 'midterm';
    const task = dataState.tasks.find(t => t.classId == classId && t.category === type);
    if(!task) return alert("ไม่พบรายการสอบ กรุณาตั้งค่าคะแนนเต็มก่อน");

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        let successCount = 0;
        let errorCount = 0;
        showLoading("กำลังนำเข้าคะแนน...");
        for (let row of rows) {
            const cols = row.split(',').map(c => c.trim().replace(/"/g, ''));
            if(cols.length < 2) continue;
            const code = cols[0];
            const score = cols[1];
            const student = dataState.students.find(s => String(s.code) === String(code) && s.classId == classId);
            if (student && !isNaN(score) && score !== "") {
                if(Number(score) <= Number(task.maxScore)) {
                    updateLocalState({ action: 'addScore', studentId: student.id, taskId: task.id, score: score });
                    successCount++;
                } else errorCount++; 
            } else errorCount++; 
        }
        saveToLocalStorage();
        refreshUI();
        renderExamPanel(); 
        hideLoading();
        fileInput.value = '';
        document.getElementById('csv-file-name').textContent = "- ยังไม่เลือกไฟล์ -";
        alert(`นำเข้าสำเร็จ ${successCount} รายการ\n(ไม่พบข้อมูล/ผิดพลาด ${errorCount} รายการ)`);
        if(successCount > 0) {
            showToast("ข้อมูลถูกบันทึกเรียบร้อย", "bg-green-600");
             saveAndRefresh({ action: 'keepAlive' }); 
        }
    };
    reader.readAsText(file);
};

// แก้ไขฟังก์ชันพิมพ์รายงาน (ในไฟล์ js/main.js)

window.printOfficialReport = function() {
    // 1. ตรวจสอบว่าเลือกห้องเรียนหรือยัง
    const classSelect = document.getElementById('report-class');
    const classId = classSelect ? classSelect.value : null;
    if (!classId) return alert("กรุณาเลือกห้องเรียนก่อนพิมพ์");

    // 2. ดึงข้อมูลจากตารางหน้าจอ
    const sourceHead = document.getElementById('report-table-header');
    const sourceBody = document.getElementById('report-table-body');

    // 3. เตรียมพื้นที่พิมพ์
    const printHead = document.getElementById('print-column-header');
    const printBody = document.getElementById('print-table-body');
    const printSubtitle = document.getElementById('print-subtitle');

    // 4. ฟังก์ชันสำหรับล้างสี (ทำให้เป็นขาว-ดำ)
    const cleanColors = (html) => {
        return html
            // ลบสีตัวอักษรทั้งหมด (text-white, text-red-400, ฯลฯ)
            .replace(/text-[a-z]+-[0-9]+(\/[0-9]+)?/g, '') 
            .replace(/text-white(\/[0-9]+)?/g, '')
            .replace(/text-[a-z]+-[0-9]+/g, '')
            // ลบพื้นหลังสี (bg-white/10 ฯลฯ)
            .replace(/bg-[a-z]+(\/[0-9]+)?/g, '')
            .replace(/bg-[a-z]+-[0-9]+(\/[0-9]+)?/g, ''); 
    };

    // 5. คัดลอกและล้างสี
    if (sourceHead && printHead) {
        printHead.innerHTML = cleanColors(sourceHead.innerHTML);
    }
    
    if (sourceBody && printBody) {
        // ล้างสีจากตัวตารางข้อมูล
        printBody.innerHTML = cleanColors(sourceBody.innerHTML);
    }

    // 6. อัปเดตหัวกระดาษ
    const className = classSelect.options[classSelect.selectedIndex].text;
    const dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    
    if (printSubtitle) {
        printSubtitle.innerHTML = `ระดับชั้น ${className} &nbsp;&nbsp; ข้อมูล ณ วันที่ ${dateStr}`;
    }

    // 7. สั่งพิมพ์
    window.print();
};

window.exportGradeCSV = function() {
    // 🟢 แก้ไขบรรทัดนี้: เปลี่ยนจาก 'report-class' เป็น 'report-class-select'
    const classId = document.getElementById('report-class-select').value;
    
    if (!classId) return alert("กรุณาเลือกห้องเรียนก่อนดาวน์โหลด CSV");
    
    const modeInput = document.querySelector('input[name="reportType"]:checked');
    const mode = modeInput ? modeInput.value : 'summary';
    
    const currentClass = dataState.classes.find(c => c.id == classId);
    const subj = dataState.subjects.find(s => s.id == currentClass.subjectId);
    const students = dataState.students.filter(s => s.classId == classId).sort((a, b) => Number(a.no) - Number(b.no));
    const tasks = dataState.tasks.filter(t => t.classId == classId);
    
    let csvContent = "\uFEFF"; // รองรับภาษาไทย
    
    if (mode === 'summary') {
        const config = (subj && subj.scoreConfig && subj.scoreConfig.length > 0) ? subj.scoreConfig : Array(5).fill(10);
        const chapterNames = subj && subj.chapterNames ? subj.chapterNames : [];
        
        let headerRow = ["เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล"];
        
        // 1. ใส่ชื่อบท
        config.forEach((m, i) => {
            const chName = chapterNames[i] ? chapterNames[i] : `บทที่ ${i+1}`;
            headerRow.push(`"${chName} (${m})"`);
        });
        
        // 2. ใส่คอลัมน์สรุป
        headerRow.push("รวมคะแนนเก็บ", "สอบกลางภาค", "สอบปลายภาค", "รวมคะแนน", "เกรด");
        csvContent += headerRow.join(",") + "\n";
        
        // 3. ข้อมูลนักเรียน
        students.forEach(s => {
            const scores = calculateScores(s.id, classId, tasks);
            let row = [s.no, `"${s.code}"`, `"${s.name}"`];
            
            // บังคับจำนวนช่องให้เท่ากับหัวตารางเสมอ
            config.forEach((_, i) => {
                const sc = (scores.chapScores && scores.chapScores[i]) ? scores.chapScores[i] : 0;
                row.push(Math.round(sc));
            });
            
            row.push(
                Math.round(scores.accumTotal || 0), 
                scores.midterm || 0, 
                scores.final || 0, 
                Math.round(scores.total || 0), 
                calGrade(scores.total || 0)
            );
            csvContent += row.join(",") + "\n";
        });
    } else {
        // โหมดละเอียด
        let headerRow = ["เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล"];
        const accumTasks = tasks.filter(t => t.category === 'accum').sort((a,b) => a.id - b.id);
        
        accumTasks.forEach(t => headerRow.push(`"${t.name} (${t.maxScore})"`));
        headerRow.push("รวมคะแนนเก็บ", "สอบกลางภาค", "สอบปลายภาค", "รวมคะแนน", "เกรด");
        csvContent += headerRow.join(",") + "\n";
        
        students.forEach(s => {
            let row = [s.no, `"${s.code}"`, `"${s.name}"`];
            accumTasks.forEach(t => {
                const sc = dataState.scores.find(x => x.studentId == s.id && x.taskId == t.id);
                row.push(sc ? sc.score : 0);
            });
            const scores = calculateScores(s.id, classId, tasks);
            row.push(
                Math.round(scores.accumTotal || 0), 
                scores.midterm || 0, 
                scores.final || 0, 
                Math.round(scores.total || 0), 
                calGrade(scores.total || 0)
            );
            csvContent += row.join(",") + "\n";
        });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `GradeReport_${currentClass.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportAttendanceCSV = function() {
    const cid = document.getElementById('att-class-select').value;
    if (!cid) return alert("กรุณาเลือกห้องเรียนก่อน");
    const currentClass = dataState.classes.find(c => c.id == cid);
    const students = dataState.students.filter(s => s.classId == cid).sort((a, b) => Number(a.no) - Number(b.no));
    const uniqueDates = [...new Set(dataState.attendance.filter(a => a.classId == cid).map(a => a.date))].sort();
    let csvContent = "\uFEFF"; 
    let headerRow = ["เลขที่", "รหัสนักเรียน", "ชื่อ-นามสกุล"];
    uniqueDates.forEach(d => headerRow.push(`"${formatThaiDate(d)}"`));
    headerRow.push("มา", "ลา", "ขาด", "กิจกรรม", "เปอร์เซ็นต์การมา");
    csvContent += headerRow.join(",") + "\n";
    students.forEach(s => {
        let row = [s.no, `"${s.code}"`, `"${s.name}"`];
        let p=0, l=0, a=0, act=0;
        uniqueDates.forEach(d => {
            const log = dataState.attendance.find(att => att.studentId == s.id && att.date == d);
            const status = log ? log.status : "-";
            row.push(status);
            if(status=='มา') p++; else if(status=='ลา') l++; else if(status=='ขาด') a++; else if(status=='กิจกรรม') act++;
        });
        const totalDays = uniqueDates.length || 1;
        const percent = Math.round(((p+act)/totalDays)*100);
        row.push(p, l, a, act, `${percent}%`);
        csvContent += row.join(",") + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_${currentClass.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.downloadExamTemplate = function() {
    const classId = document.getElementById('exam-class-select').value;
    if (!classId) return alert("กรุณาเลือกห้องเรียนก่อนดาวน์โหลดแม่แบบ");
    const students = dataState.students.filter(s => s.classId == classId).sort((a, b) => Number(a.no) - Number(b.no));
    if (students.length === 0) return alert("ไม่พบรายชื่อนักเรียนในห้องนี้");
    const currentClass = dataState.classes.find(c => c.id == classId);
    const type = globalState.currentExamType === 'final' ? 'Final' : 'Midterm';
    let csvContent = "\uFEFF"; 
    csvContent += "รหัสนักเรียน,คะแนน,ชื่อ-นามสกุล (สำหรับตรวจสอบ)\n"; 
    students.forEach(s => { csvContent += `"${s.code}","",${s.name}\n`; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Template_${type}_${currentClass.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- 5. Backup & Restore Functions ---
window.handleManualBackup = async function() {
    if (confirm("ต้องการตรวจสอบและซิงค์ข้อมูลกับ Google Sheet เดี๋ยวนี้หรือไม่?")) {
        showLoading("กำลังซิงค์ข้อมูล...");
        try {
            await syncData(); 
            if (typeof backupToGoogleSheet === 'function') {
                await backupToGoogleSheet(); 
                showToast("ซิงค์ข้อมูลกับ Google Sheet เรียบร้อย", "bg-green-600");
            } else {
                console.warn("backupToGoogleSheet function not found");
                showToast("ดึงข้อมูลล่าสุดเรียบร้อย", "bg-blue-600");
            }
        } catch (e) {
            console.error("Sync Error:", e);
            showToast("เกิดข้อผิดพลาดในการซิงค์", "bg-red-600");
        } finally {
            hideLoading();
            refreshUI();
        }
    }
};

window.handleRestoreFromSheet = restoreFromGoogleSheet;

// เชื่อมต่อ UI-Render
window.renderTaskClassCheckboxes = renderTaskClassCheckboxesAccum;
window.renderTaskChapterCheckboxes = renderTaskChapterCheckboxesAccum;
window.updateTempConfig = updateTempConfig;
window.removeConfigSlot = removeConfigSlot;
window.updateScanTaskDropdown = updateScanTaskDropdown; 
window.renderScoreRoster = renderScoreRoster;

// --- 6. Event Listeners ---
function initEventListeners() {
    // 1. ค้นหารายชื่อเพื่อน
    const friendSearch = document.getElementById('friend-search');
    if (friendSearch) {
        friendSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.friend-item').forEach(item => { 
                item.style.display = item.textContent.toLowerCase().includes(term) ? 'flex' : 'none'; 
            });
        });
    }

    // 2. กด Enter บันทึกอีเมล
    const emailInput = document.getElementById('user-email-input');
    if (emailInput) {
        emailInput.onkeydown = (e) => { 
            if(e.key === 'Enter') { e.preventDefault(); window.saveUserEmail(); }
        };
    }

    // 3. จัดการเลือกไฟล์ CSV
    const csvInput = document.getElementById('exam-csv-input');
    if (csvInput) {
        csvInput.addEventListener('change', (e) => {
           const file = e.target.files[0];
           if(file) {
               document.getElementById('csv-file-name').textContent = file.name;
               document.getElementById('csv-file-name').className = "text-xs text-center text-green-400 font-bold mb-2";
               const btn = document.getElementById('btn-process-csv');
               if(btn) {
                   btn.classList.remove('pointer-events-none', 'bg-white/10', 'text-white/50');
                   btn.classList.add('bg-green-600', 'text-white', 'hover:bg-green-500');
               }
           }
       });
    }

    // 4. ฟอร์มส่งงาน
    const formSubmitWork = document.getElementById('form-submit-work');
    if (formSubmitWork) {
        formSubmitWork.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-final');
            const originalText = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...';
            const tid = document.getElementById('submit-task-id').value;
            const sid = document.getElementById('submit-student-id').value;
            const link = document.getElementById('submit-link-input').value;
            const comment = document.getElementById('submit-comment-input').value;
            const checkboxes = document.querySelectorAll('.friend-checkbox:checked');
            let allStudentIds = [sid]; 
            checkboxes.forEach(cb => allStudentIds.push(cb.value));
            try {
                await saveAndRefresh({ action: 'submitTask', taskId: tid, studentIds: allStudentIds, link: link, comment: comment });
                document.getElementById('submit-modal').classList.add('hidden');
                const s = dataState.students.find(x => x.id == sid);
                if(s) renderStudentDashboard(s.code);
            } catch(err) { alert("เกิดข้อผิดพลาด"); } 
            finally { btn.disabled = false; btn.innerHTML = originalText; }
        };
    }
// 5. ล็อกอินแอดมิน
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.onsubmit = async (e) => { 
            e.preventDefault(); 
            const u = document.getElementById('admin-username').value;
            const p = document.getElementById('admin-password').value; 
            
            try {
                // 🟢 เรียกใช้ Firestore
                const db = getFirestore();
                
                // 🟢 ชี้เป้าไปที่ไฟล์ config ที่เราแยกเอาไว้
                const configRef = doc(db, "school_data", "wany_data_config");
                const docSnap = await getDoc(configRef);
                
                // ตั้งค่ารหัสผ่านสำรองเผื่อหาไฟล์ไม่เจอ
                let dbUser = 'admin';
                let dbPass = '1234';

                // ถ้ามีไฟล์ config อยู่ ให้ดึงข้อมูลมาใช้
                if (docSnap.exists()) {
                    const configData = docSnap.data();
                    dbUser = configData.adminUsername || 'admin';
                    dbPass = configData.adminPassword || '1234';
                }

                // 🟢 ตรวจสอบรหัสผ่าน
                if (u === dbUser && p === dbPass) { 
                    localStorage.setItem('wany_admin_session', 'admin_firebase_token'); 
                    window.switchMainTab('admin');
                    document.getElementById('admin-login-wrapper').classList.add('hidden'); 
                    document.getElementById('admin-content-wrapper').classList.remove('hidden'); 
                    
                    if(typeof refreshUI === 'function') refreshUI();
                } else {
                    alert("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"); 
                }
            } catch (error) {
                console.error("เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์:", error);
                alert("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่");
            }
        };
    }
    // 6. ฟอร์มงานเก็บคะแนน (3.1)
    const formTaskAccum = document.getElementById('form-task-accum');
    if (formTaskAccum) {
        formTaskAccum.onsubmit = (e) => { 
            e.preventDefault(); 
            const subId = document.getElementById('task-subject-accum').value;
            const classCbs = document.querySelectorAll('#task-class-accum input:checked'); 
            const chapCbs = document.querySelectorAll('#task-chapter-accum .chapter-checkbox:checked'); 
            if(!subId) return alert("กรุณาเลือกวิชา");
            if(classCbs.length === 0) return alert("กรุณาเลือกห้องเรียน"); 
            if(chapCbs.length === 0) return alert("กรุณาเลือกช่องคะแนน (Chapter)"); 
            
            // 🟢 ดึงค่ารายละเอียดและรูปภาพ
            const desc = document.getElementById('task-desc-accum') ? document.getElementById('task-desc-accum').value : '';
            const imgEl = document.getElementById('task-image-preview-accum');
            const imgBase64 = (imgEl && imgEl.src && imgEl.src.startsWith('data:')) ? imgEl.src : '';

            const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
            d.setDate(d.getDate() + 7);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dueDate = `${year}-${month}-${day}`;

            saveAndRefresh({ 
                action: 'addTask', id: Date.now(), 
                classIds: Array.from(classCbs).map(c => c.value), 
                subjectId: subId, category: 'accum', 
                chapter: Array.from(chapCbs).map(cb => cb.value), 
                name: document.getElementById('task-name-accum').value, 
                maxScore: document.getElementById('task-max-accum').value, 
                description: desc, // 🟢 บันทึกรายละเอียด
                image: imgBase64,  // 🟢 บันทึกรูปภาพ
                dueDateISO: dueDate 
            }); 
            
            e.target.reset(); 
            document.querySelectorAll('#task-chapter-accum .chapter-checkbox').forEach(c => c.checked = false);
            if(typeof window.removeTaskImageAccum === 'function') window.removeTaskImageAccum(); // ล้างรูปพรีวิว
            
            if(typeof showToast === 'function') showToast("สร้างงานเก็บคะแนนเรียบร้อย", "success");
            else alert("สร้างงานเก็บคะแนนเรียบร้อย");
        };
    }

    // 7. ฟอร์มงานสอบ (3.2)
    const formTaskExam = document.getElementById('form-task-exam');
    if (formTaskExam) {
        formTaskExam.onsubmit = (e) => { 
            e.preventDefault(); 
            const subId = document.getElementById('task-subject-exam').value;
            const classCbs = document.querySelectorAll('#task-class-exam input:checked'); 
            const category = document.getElementById('task-category-exam').value;
            if(!subId) return alert("กรุณาเลือกวิชา");
            if(classCbs.length === 0) return alert("กรุณาเลือกห้องเรียน"); 
            const names = { 'midterm': 'สอบกลางภาค', 'special_mid': 'คะแนนช่วยกลางภาค', 'final': 'สอบปลายภาค', 'special_final': 'คะแนนช่วยปลายภาค' };
            saveAndRefresh({ 
                action: 'addTask', id: Date.now(), 
                classIds: Array.from(classCbs).map(c => c.value), 
                subjectId: subId, category: category, chapter: [], 
                name: names[category], 
                maxScore: document.getElementById('task-max-exam').value, 
                dueDateISO: getThaiDateISO() 
            }); 
            e.target.reset(); 
            showToast(`สร้างรายการ ${names[category]} เรียบร้อย`);
        };
    }

    // 8. Event เปลี่ยนวิชา
    const subAccum = document.getElementById('task-subject-accum');
    if (subAccum) { subAccum.onchange = () => { window.renderTaskClassCheckboxesAccum(); window.renderTaskChapterCheckboxesAccum(); }; }
    const subExam = document.getElementById('task-subject-exam');
    if (subExam) { subExam.onchange = () => { window.renderTaskClassCheckboxesExam(); }; }

    // 9. ตารางสอน
    const formSchedule = document.getElementById('form-schedule');
    if (formSchedule) {
        formSchedule.onsubmit = (e) => { 
            e.preventDefault(); 
            saveAndRefresh({ action:'addSchedule', id:Date.now(), day: document.getElementById('sch-day').value, period: document.getElementById('sch-period').value, classId: document.getElementById('sch-class').value }); 
        };
    }

   // 10. รายงาน
    const reportSub = document.getElementById('report-subject');
    if (reportSub) {
        reportSub.onchange = () => { 
             const subId = reportSub.value; 
             const classSelect = document.getElementById('report-class'); 
             if(!classSelect) return;
             
             // เคลียร์ค่าเดิมเมื่อเปลี่ยนวิชา
             classSelect.innerHTML = '<option value="">-- เลือกห้อง --</option>'; 
             document.getElementById('report-table-body').innerHTML = ''; 
             
             if(!subId) return; 
             dataState.classes.filter(c => c.subjectId == subId).forEach(c => { 
                const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; classSelect.appendChild(o); 
             }); 
        };
    }

    // 🟢 [เพิ่มส่วนนี้เข้าไป] สั่งให้แสดงผลทันทีเมื่อเลือกห้องเรียนเสร็จ
    const reportClass = document.getElementById('report-class');
    if (reportClass) {
        reportClass.onchange = () => {
            renderGradeReport(); // เรียกฟังก์ชันแสดงตารางคะแนนทันที
        };
    }

    // 🟢 [เพิ่มส่วนนี้ด้วย] สั่งให้แสดงผลทันทีเมื่อเปลี่ยนรูปแบบรายงาน (แบบสรุป / แบบละเอียด)
    const reportRadios = document.querySelectorAll('input[name="reportType"]');
    if (reportRadios) {
        reportRadios.forEach(radio => {
            radio.onchange = () => {
                renderGradeReport(); // เรียกฟังก์ชันคำนวณใหม่ทันทีที่สลับโหมด
            };
        });
    }

    // 11. ให้คะแนน (Scan & Select Task)
    const scanClass = document.getElementById('scan-class-select');
    if (scanClass) {
        scanClass.onchange = () => { 
            window.updateScanTaskDropdown(); 
            window.renderScoreRoster(); 
        };
    }
    const scanTask = document.getElementById('scan-task-select');
    if (scanTask) {
        scanTask.onchange = () => {
            window.renderScoreRoster();
        };
    }

    // 12. เช็คชื่อ
    const attClass = document.getElementById('att-class-select');
    if (attClass) attClass.onchange = renderAttRoster;
    const attDate = document.getElementById('att-date-input');
    if (attDate) attDate.onchange = renderAttRoster;

    // 13. จัดการข้อมูล
    const fSub = document.getElementById('form-subject'); if(fSub) fSub.onsubmit = (e) => { e.preventDefault(); saveAndRefresh({ action:'addSubject', id:Date.now(), name:document.getElementById('subject-name').value }); e.target.reset(); };
    const fCls = document.getElementById('form-class'); if(fCls) fCls.onsubmit = (e) => { e.preventDefault(); saveAndRefresh({ action:'addClass', id:Date.now(), name:document.getElementById('class-name').value, subjectId:document.getElementById('class-subject-ref').value }); e.target.reset(); };
    const fStd = document.getElementById('form-student'); if(fStd) fStd.onsubmit = (e) => { e.preventDefault(); saveAndRefresh({ action: 'addStudent', id: Date.now(), classId: document.getElementById('student-class').value, no: document.getElementById('student-no').value, code: document.getElementById('student-id').value, name: document.getElementById('student-name').value }); e.target.reset(); };
    
    // 14. บันทึก Modal (กดปุ่ม)
    const btnSaveScore = document.getElementById('btn-modal-save');
    if (btnSaveScore) {
        btnSaveScore.onclick = () => { 
            const val = document.getElementById('modal-score-input').value; 
            const {s,t} = globalState.pendingScore; 
            if(Number(val) > Number(t.maxScore)) return alert("เกินคะแนนเต็ม"); 
            saveAndRefresh({action:'addScore', studentId:s.id, taskId:t.id, score:val}); 
            window.closeScoreModal(); 
            showToast("บันทึกแล้ว"); 
        };
    }

    // 15. สแกนเช็คชื่อ (Barcode)
    const attScan = document.getElementById('att-scan-input');
    if (attScan) {
        attScan.onkeydown = (e) => { 
            if(e.key === 'Enter') { 
                const val = e.target.value.trim(); 
                const cid = document.getElementById('att-class-select').value; 
                const date = document.getElementById('att-date-input').value; 
                const mode = globalState.attMode || 'มา'; 
                if(!cid) { alert("กรุณาเลือกห้องก่อน"); e.target.value=''; return; } 
                const s = dataState.students.find(st => (String(st.code) == val || String(st.no) == val) && st.classId == cid); 
                if(s) { 
                    saveAndRefresh({ action:'addAttendance', studentId:s.id, classId:cid, date:date, status:mode }); 
                    showToast(`${s.name} : ${mode}`, "bg-green-600"); 
                } else { 
                    showToast(`ไม่พบรหัส: ${val}`, "bg-red-600"); 
                } 
                e.target.value = ''; 
            } 
        };
    }

    // 🟢 16. กด Enter บันทึกคะแนนในหน้าต่าง Modal ทันที
    const modalScoreInput = document.getElementById('modal-score-input');
    if (modalScoreInput) {
        modalScoreInput.onkeydown = (e) => { 
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                const btnSave = document.getElementById('btn-modal-save');
                if (btnSave) btnSave.click(); 
            } 
        };
    }

    // 17. สแกนคะแนนหน้าหลัก
    const scanScoreInput = document.getElementById('scan-score-input');
    if (scanScoreInput) {
        scanScoreInput.onkeydown = (e) => { 
            if(e.key === 'Enter') { 
                const val = e.target.value.trim(); 
                const cid = document.getElementById('scan-class-select').value; 
                if(!cid) return; 
                const s = dataState.students.find(st => (String(st.code) == val || String(st.no) == val) && st.classId == cid); 
                if(s) { 
                    const tid = document.getElementById('scan-task-select').value; 
                    const t = dataState.tasks.find(x=>x.id==tid); 
                    if(t) { 
                        if(globalState.scoreMode !== 'manual') { 
                            if(Number(globalState.scoreMode) > Number(t.maxScore)) { alert("คะแนนที่เลือกเกินคะแนนเต็ม!"); } 
                            else { saveAndRefresh({action:'addScore', studentId:s.id, taskId:t.id, score:globalState.scoreMode}); showToast(`${s.name} : ${globalState.scoreMode} คะแนน`); } 
                        } else { 
                            globalState.pendingScore = { s, t }; 
                            document.getElementById('score-modal').classList.remove('hidden'); 
                            document.getElementById('modal-task-name').textContent = t.name; 
                            document.getElementById('modal-student-name').textContent = s.name; 
                            document.getElementById('modal-max-score').textContent = t.maxScore; 
                            const sc = dataState.scores.find(x => x.studentId == s.id && x.taskId == t.id); 
                            document.getElementById('modal-score-input').value = sc ? sc.score : ''; 
                            setTimeout(() => document.getElementById('modal-score-input').focus(), 100); 
                        } 
                        e.target.value = ''; 
                    } 
                } else { showToast("ไม่พบนักเรียน", "bg-red-600"); e.target.value = ''; } 
            } 
        };
    }
} // ปิดฟังก์ชัน initEventListeners อย่างถูกต้อง

// --- 7. Initialization ---
function startAutoSyncScheduler() {
    setInterval(() => {
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        if (now.getHours() === 0 && now.getMinutes() <= 1) {
            const lastBackup = localStorage.getItem('last_backup_date');
            if (lastBackup !== now.toDateString()) {
                if (typeof backupToGoogleSheet === 'function') backupToGoogleSheet();
            }
        }
    }, 60000); 
}

window.addEventListener('DOMContentLoaded', () => {
    syncData(); 
    loadFromLocalStorage(); 
    refreshUI();
    
    if(document.getElementById('att-date-input')) document.getElementById('att-date-input').value = getThaiDateISO();
    
    initEventListeners();
    startAutoSyncScheduler();
    
    const c = document.getElementById('score-buttons-container'); 
    if(c) { 
        c.innerHTML=''; 
        [5,6,7,8,9,10].forEach(i => { 
            const b = document.createElement('button'); 
            b.textContent=i; 
            b.className="btn-score py-2 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10"; 
            b.onclick=()=>window.setScoreMode(i); 
            c.appendChild(b); 
        }); 
    }

    const adminSession = localStorage.getItem('wany_admin_session');
    const studentCode = localStorage.getItem('current_student_code');

    if (adminSession) {
        window.switchMainTab('admin');
        document.getElementById('admin-login-wrapper').classList.add('hidden'); 
        document.getElementById('admin-content-wrapper').classList.remove('hidden'); 
    } else if (studentCode) {
        window.switchMainTab('student');
        document.getElementById('student-login-wrapper').classList.add('hidden');
        document.getElementById('student-dashboard').classList.remove('hidden');
    } else {
        window.switchMainTab('student');
    }
    
    setInterval(() => {
        if(!dataState.schedules) return; 
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
        const day = now.getDay(); const timeStr = now.toTimeString().slice(0,5); 
        let currentPeriod = PERIODS.find(p => timeStr >= p.start && timeStr <= p.end); 
        const banner = document.getElementById('smart-att-banner'); 
        if(currentPeriod && dataState.schedules) { 
            const match = dataState.schedules.find(s => s.day == day && s.period == currentPeriod.p); 
            if(match) { 
                const cls = dataState.classes.find(c => c.id == match.classId); 
                if(cls && banner) { 
                    banner.classList.remove('hidden'); 
                    document.getElementById('smart-period').textContent = currentPeriod.p; 
                    document.getElementById('smart-class-name').textContent = cls.name; 
                    globalState.smartClassId = cls.id; 
                    return; 
                } 
            } 
        } 
        if(banner) banner.classList.add('hidden'); 
        globalState.smartClassId = null; 
    }, 60000);
});
// ฟังก์ชันบันทึกการแก้ไขจาก Modal
// ในไฟล์ js/main.js


window.openEditChapterModal = openEditChapterModal; // ผูก window

// ในไฟล์ js/main.js

// ในไฟล์ js/main.js

window.saveColumnEdit = function() {
    const mode = document.getElementById('edit-mode').value;
    const name = document.getElementById('edit-col-name').value;
    const max = document.getElementById('edit-col-max').value;
    const category = document.getElementById('edit-col-category').value; // (ใช้เฉพาะโหมด Exam)

    // Validation
    if (!name && mode !== 'chapter') return alert("กรุณากรอกชื่อ"); 
    if (!max) return alert("กรุณากรอกคะแนนเต็ม");

    // ---------------------------------------------------------
    // 1. โหมดแก้ไขหัวข้อบท (Chapter Header) - แก้ชื่อบท/คะแนนเต็ม
    // ---------------------------------------------------------
    if (mode === 'chapter') {
        const subjectId = document.getElementById('edit-col-id').value;
        const index = parseInt(document.getElementById('edit-col-index').value);
        
        const subject = dataState.subjects.find(s => String(s.id) === String(subjectId));
        if(!subject) return alert("ไม่พบรายวิชา");

        let newConfig = [...(subject.scoreConfig || [])];
        let newNames = [...(subject.chapterNames || [])];
        let newTypes = [...(subject.chapterTypes || [])];

        // เติม Array ให้เต็มถ้า Index เกิน
        for(let k=0; k<=index; k++) {
            if(newConfig[k] === undefined) newConfig[k] = 10;
            if(newNames[k] === undefined) newNames[k] = "";
            if(newTypes[k] === undefined) newTypes[k] = "normal";
        }

        newConfig[index] = parseFloat(max);
        newNames[index] = name;
        newTypes[index] = category; // ในโหมดนี้ category คือ type (normal/special)

        window.saveAndRefresh({
            action: 'updateSubjectDetails',
            id: subjectId,
            scoreConfig: newConfig,
            chapterNames: newNames,
            chapterTypes: newTypes
        });

        // Update Local State
        subject.scoreConfig = newConfig;
        subject.chapterNames = newNames;
        subject.chapterTypes = newTypes;
        
        document.getElementById('edit-column-modal').classList.add('hidden');
        window.renderScoreManagerTable();
    } 
    
  // ---------------------------------------------------------
    // 2. 🟢 โหมดแก้ไขงานคะแนนเก็บ (Task Accum) - ย้ายบท/เลือกหลายบท
    // ---------------------------------------------------------
    else if (mode === 'task_accum') {
        const taskId = document.getElementById('edit-col-id').value;
        
        // 1. ดึงค่าจาก Checkbox
        const checkboxes = document.querySelectorAll('.chapter-selector:checked');
        const newChapters = Array.from(checkboxes).map(cb => cb.value); 

        // 🔍 ค้นหางานที่จะแก้
        const task = dataState.tasks.find(t => String(t.id) === String(taskId));
        
       if (task) {
            // 2. ⭐ แก้ไขข้อมูลใน State ให้เสร็จ "ก่อน" บันทึก
            task.name = name;
            task.maxScore = Number(max); 
            task.chapter = newChapters;  

            console.log("กำลังบันทึกงาน:", task); 

            // 3. 💾 สั่งบันทึกลง Firebase
            window.saveAndRefresh(); 

            // -----------------------------------------------------
            // 🔴 จุดแก้ไข: คอมเมนต์บรรทัดนี้ทิ้งครับ (เพื่อไม่ให้หน้าต่างปิด)
            // document.getElementById('edit-column-modal').classList.add('hidden');
            // -----------------------------------------------------

            // 🟢 เพิ่ม: แสดงข้อความแจ้งเตือนเพื่อให้รู้ว่าบันทึกแล้ว
            // (ถ้าคุณมีฟังก์ชัน showToast ใช้ showToast จะสวยกว่าครับ)
            alert("บันทึกข้อมูลเรียบร้อย! (แก้ไขต่อได้เลย)"); 
            
            // 4. รีเฟรชตารางพื้นหลัง (เพื่อให้คะแนนรวมข้างหลังอัปเดต)
            // หน้าต่าง Modal จะยังลอยอยู่เหนือตาราง
            setTimeout(() => {
                window.renderScoreManagerTable();
            }, 100);
            
        } else {
            console.error("ไม่พบ Task ID: " + taskId);
        }
    }

    // ---------------------------------------------------------
    // 3. โหมดแก้ไขการสอบ (Exam)
    // ---------------------------------------------------------
    else {
        const taskId = document.getElementById('edit-col-id').value;
        const task = dataState.tasks.find(t => String(t.id) === String(taskId));
        
        if (task) {
            // 1. แก้ไข State ก่อน
            task.name = name;
            task.maxScore = Number(max);
            task.category = category;

            // 2. บันทึก
            window.saveAndRefresh(); 

            // 3. รีเฟรชหน้าจอ
            document.getElementById('edit-column-modal').classList.add('hidden');
            window.renderExamTable();
        }
    }
};
import { addTaskToChapter } from "./ui-render.js";
window.addTaskToChapter = addTaskToChapter;
window.renderScoreManagerPanel = renderScoreManagerPanel;
window.renderScoreManagerTable = renderScoreManagerTable;
window.editChapterConfig = editChapterConfig;
window.openExamEditor = openExamEditor;
window.closeExamModal = closeExamModal;
window.addQuestionItem = addQuestionItem;
// --- ผูกฟังก์ชันแก้ไขงาน (Task Modal) ให้ HTML เรียกใช้ได้ ---
import { openEditTaskModal } from "./ui-render.js";

window.openEditTaskModal = openEditTaskModal;
// ในไฟล์ js/main.js (ท้ายไฟล์)

import { openStudentTaskModal } from "./ui-render.js"; // Import เพิ่ม
window.openStudentTaskModal = openStudentTaskModal;   // ผูก window

// ฟังก์ชันส่งงานนักเรียน


window.submitWork = async function() {
    // 1. ดึงค่าจากหน้าจอ
    const taskIdElement = document.getElementById('st-modal-task-id');
    const studentIdElement = document.getElementById('st-modal-student-id');
    const workElement = document.getElementById('st-modal-submission');
    const btn = document.getElementById('st-modal-submit-btn');

    if (!taskIdElement || !studentIdElement || !workElement) return;

    const taskId = taskIdElement.value;
    const studentId = studentIdElement.value;
    const work = workElement.value;

    const showMsg = (title, text, icon) => {
        if (typeof Swal !== 'undefined') Swal.fire({ title, text, icon, timer: 2000, showConfirmButton: false });
        else alert(`${title}\n${text}`);
    };

    if (!work || work.trim() === "") {
        showMsg('กรุณาแนบลิงก์งาน', 'พิมพ์ข้อความหรือแปะลิงก์ก่อนส่งนะครับ', 'warning');
        return;
    }

    // UI Loading
    const oldText = btn ? btn.innerHTML : 'ส่งงาน';
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังส่ง...';
    }

    let allStudentIds = [studentId];
    const friendCheckboxes = document.querySelectorAll('.st-friend-checkbox:checked');
    friendCheckboxes.forEach(cb => allStudentIds.push(cb.value));

    try {
        const timestamp = new Date().toISOString();
        
        // 2. อัปเดตข้อมูล Local State (เพื่อให้หน้าจอเปลี่ยนทันที)
        allStudentIds.forEach(sid => {
            // Update Submissions
            if (dataState.submissions) {
                const existing = dataState.submissions.findIndex(s => s.studentId == sid && s.taskId == taskId);
                if (existing > -1) {
                    dataState.submissions[existing] = { ...dataState.submissions[existing], link: work, timestamp };
                } else {
                    dataState.submissions.push({
                        id: `sub_${Date.now()}_${sid}`, studentId: sid, taskId: taskId, link: work, timestamp, score: null
                    });
                }
            }
            // Update Scores (Optimistic UI)
            let scoreEntry = dataState.scores.find(s => s.studentId == sid && s.taskId == taskId);
            if (scoreEntry) {
                scoreEntry.submission = work;
                scoreEntry.score = null; 
            } else {
                dataState.scores.push({ studentId: sid, taskId: taskId, score: null, submission: work });
            }
        });
        saveToLocalStorage();

        // ⭐ 3. ส่วนสำคัญที่เพิ่มเข้ามา: ส่งข้อมูลไป Server (Firebase/Script) ⭐
        // ต้องมีคำสั่งนี้ ครูถึงจะเห็นงานครับ
        if (typeof saveAndRefresh === 'function') {
            await saveAndRefresh({ 
                action: 'submitTask', 
                taskId: taskId, 
                studentIds: allStudentIds, 
                link: work, 
                comment: '',
                timestamp: timestamp
            });
        } else {
            console.warn("ไม่พบฟังก์ชัน saveAndRefresh อาจทำให้ข้อมูลไม่ซิงค์ไปหาครู");
        }

        showMsg('ส่งงานเรียบร้อย!', `ส่งงานกลุ่มรวม ${allStudentIds.length} คนแล้วครับ`, 'success');

        const modal = document.getElementById('student-task-modal');
        if(modal) modal.classList.add('hidden');
        
        const student = dataState.students.find(s => s.id == studentId);
        if(student && typeof window.renderStudentDashboard === 'function') {
            window.renderStudentDashboard(student.code);
        } else {
            location.reload();
        }

    } catch (err) {
        console.error("Submit Error:", err);
        showMsg('เกิดข้อผิดพลาด', err.message, 'error');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = oldText;
        }
    }
};
// ในไฟล์ js/main.js

// ฟังก์ชันดาวน์โหลดรายงานเป็น CSV (Excel เปิดได้)
window.downloadGradeReport = function() {
    const classId = document.getElementById('report-class-select')?.value;
    if (!classId) return alert("กรุณาเลือกห้องเรียนก่อนดาวน์โหลดครับ");

    const cls = dataState.classes.find(c => c.id == classId);
    const students = dataState.students.filter(s => s.classId == classId).sort((a,b) => Number(a.no) - Number(b.no));
    const tasks = dataState.tasks.filter(t => t.classId == classId);

    // 1. สร้างหัวตาราง (BOM เพื่อให้ Excel อ่านภาษาไทยออก)
    let csvContent = "\uFEFFเลขที่,รหัสนักเรียน,ชื่อ-นามสกุล,คะแนนเก็บ,กลางภาค,ปลายภาค,รวมคะแนน,เกรด\n";

    // 2. วนลูปข้อมูลนักเรียน
    students.forEach(s => {
        const scores = calculateScores(s.id, classId, tasks);
        const grade = calGrade(scores.total);
        
        // จัดรูปแบบข้อมูล CSV
        const row = [
            s.no,
            s.code,
            `"${s.name}"`, // ใส่ฟันหนูกันชื่อมี comma
            scores.accumTotal.toFixed(2),
            scores.midterm.toFixed(2),
            scores.final.toFixed(2),
            scores.total.toFixed(2),
            grade
        ];
        
        csvContent += row.join(",") + "\n";
    });

    // 3. สร้างลิงก์ดาวน์โหลด
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `GradeReport_${cls.name}_${getThaiDateISO()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
// ในไฟล์ js/main.js (ท้ายไฟล์)

// ผูกฟังก์ชันเข้ากับ Window เพื่อให้ HTML เรียก onclick="..." ได้
window.setLuckyMode = setLuckyMode;
window.startLuckyDraw = startLuckyDraw;
window.clearLuckyHistory = clearLuckyHistory;
// ==========================================
// 📂 ส่วนจัดการ Import CSV
// ==========================================

// 1. โหลดรายชื่องาน (Tasks) เมื่อเลือกห้อง/วิชา
window.renderImportTasks = function() {
    const classId = document.getElementById('import-class-select').value;
    const subjectId = document.getElementById('import-subject-select').value;
    const taskSelect = document.getElementById('import-task-select');
    
    taskSelect.innerHTML = '<option value="">-- เลือกงานที่จะลงคะแนน --</option>';
    
    if(!classId || !subjectId) return;

    // กรองงานที่ตรงกับห้องและวิชานี้
    // (งานต้องถูกสร้างไว้ก่อนแล้ว ถึงจะ import คะแนนเข้าได้)
    const tasks = dataState.tasks.filter(t => {
        // เช็คห้อง
        if(t.classId != classId) return false;
        
        // เช็ควิชา (ต้องดูว่าห้องนี้เรียนวิชานี้จริงไหม หรือเช็คจาก subjectId ของ Class ก็ได้)
        // แต่ในระบบนี้ Task ผูกกับ Class โดยตรง เราจึงดึงมาแสดงได้เลย
        // เพื่อความชัวร์ เราจะเช็คว่า Class นี้ผูกกับ Subject นี้ไหม
        const cls = dataState.classes.find(c => c.id == classId);
        return cls && cls.subjectId == subjectId;
    });

    if(tasks.length === 0) {
        taskSelect.innerHTML = '<option value="">(ไม่พบงาน กรุณาสร้างงานก่อน)</option>';
        return;
    }

    tasks.forEach(t => {
        let label = t.name;
        if(t.category === 'accum') label += ` [เก็บ ${t.maxScore}]`;
        else if(t.category === 'midterm') label += ` [กลางภาค ${t.maxScore}]`;
        else if(t.category === 'final') label += ` [ปลายภาค ${t.maxScore}]`;
        
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = label;
        taskSelect.appendChild(opt);
    });
};

// 2. ดาวน์โหลดแม่แบบ CSV (พร้อมรายชื่อเด็ก)
window.downloadCSVTemplate = function() {
    const classId = document.getElementById('import-class-select').value;
    if(!classId) return alert("กรุณาเลือกห้องเรียนก่อนดาวน์โหลดแม่แบบครับ");

    const students = dataState.students.filter(s => s.classId == classId).sort((a,b) => Number(a.no) - Number(b.no));
    const cls = dataState.classes.find(c => c.id == classId);

    // Header ของ CSV (BOM เพื่อให้ Excel อ่านไทยออก)
    let csvContent = "\uFEFFNo,StudentCode,Name,Score\n";

    // สร้างแถวรายชื่อเด็ก
    students.forEach(s => {
        // ใส่ " " ครอบชื่อเพื่อป้องกันกรณีมี comma ในชื่อ
        csvContent += `${s.no},${s.code},"${s.name}",\n`; 
    });

    // ดาวน์โหลดไฟล์
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Template_Score_${cls.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// 3. ประมวลผลไฟล์ CSV และบันทึกคะแนน
window.processCSVImport = function() {
    const fileInput = document.getElementById('import-file-input');
    const taskId = document.getElementById('import-task-select').value;
    const classId = document.getElementById('import-class-select').value;

    if(!classId) return alert("กรุณาเลือกห้องเรียน");
    if(!taskId) return alert("กรุณาเลือกงานที่จะลงคะแนน");
    if(fileInput.files.length === 0) return alert("กรุณาเลือกไฟล์ CSV");

    const task = dataState.tasks.find(t => t.id == taskId);
    const maxScore = parseFloat(task.maxScore);
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        
        let successCount = 0;
        let errorCount = 0;

        // เริ่มวนลูปบรรทัดที่ 2 (ข้าม Header)
        for(let i=1; i<rows.length; i++) {
            const row = rows[i].trim();
            if(!row) continue;

            // แยกคอลัมน์ด้วย comma (รองรับกรณีชื่อมี quote)
            // วิธีง่ายๆ: split(',') แต่อาจมีปัญหากับชื่อที่มี ,
            // เพื่อความง่าย เราจะใช้ regex หรือ split ธรรมดาโดยสมมติว่าไม่มี , ในข้อมูลอื่น
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Regex แยก comma นอก quote
            
            if(cols.length < 4) continue;

            // คอลัมน์: [0]=No, [1]=StudentCode, [2]=Name, [3]=Score
            const studentCode = cols[1].trim();
            let scoreVal = cols[3].trim().replace(/"/g, ''); // ลบ quote ออกถ้ามี

            if(scoreVal === "" || isNaN(scoreVal)) continue; // ข้ามถ้าไม่มีคะแนน

            const score = parseFloat(scoreVal);
            
            // ตรวจสอบคะแนนเกิน
            if(score > maxScore) {
                console.warn(`คะแนนเกิน: รหัส ${studentCode} ได้ ${score}/${maxScore}`);
                // จะข้าม หรือจะปัดให้เท่ากับ Max ก็ได้ (ที่นี่ขอปัดเท่า Max)
                // score = maxScore; 
            }

            // หา ID นักเรียนจากรหัส
            const student = dataState.students.find(s => String(s.code) === String(studentCode));
            
            if(student) {
                // บันทึกคะแนน (เรียกใช้ฟังก์ชันที่มีอยู่แล้ว)
                // เราต้องจำลองการบันทึกโดยตรง
                let scoreObj = dataState.scores.find(s => s.studentId == student.id && s.taskId == taskId);
                
                if(scoreObj) {
                    scoreObj.score = score;
                } else {
                    dataState.scores.push({
                        studentId: student.id,
                        taskId: taskId,
                        score: score
                    });
                }
                successCount++;
            } else {
                errorCount++;
                console.warn(`ไม่พบนักเรียนรหัส: ${studentCode}`);
            }
        }

        // บันทึกลง LocalStorage/Server
        saveData(); 
        
        alert(`นำเข้าเรียบร้อย!\n✅ สำเร็จ: ${successCount} คน\n❌ ไม่พบรหัส/ผิดพลาด: ${errorCount} คน`);
        
        // รีเฟรชหน้าจอ (ถ้าเปิดตารางคะแนนอยู่)
        if(window.renderScoreManagerTable) window.renderScoreManagerTable();
        
        // ล้างไฟล์
        fileInput.value = '';
    };

    reader.readAsText(file);
};
// --- ส่วนจัดการข้อสอบ (Exam Logic) ---

window.saveExamData = function() {
    const id = document.getElementById('exam-id').value || `exam_${Date.now()}`;
    const title = document.getElementById('exam-title').value;
    const subjectId = document.getElementById('exam-subject').value;
    const timeLimit = parseInt(document.getElementById('exam-duration').value) || 60;
    const allowSwitch = parseInt(document.getElementById('exam-max-switch').value) || 2;
    const password = document.getElementById('exam-password').value;
    const shuffleQ = document.getElementById('exam-shuffle-q').checked;
    const shuffleC = document.getElementById('exam-shuffle-c').checked;

    const category = document.getElementById('exam-category') ? document.getElementById('exam-category').value : 'none';
    const chapterCbs = document.querySelectorAll('.exam-chapter-cb:checked');
    const chapter = Array.from(chapterCbs).map(cb => String(cb.value));

    if(!title || !subjectId) {
        alert("กรุณากรอกชื่อข้อสอบและเลือกวิชา");
        return;
    }

    const questions = [];
    const container = document.getElementById('questions-container');
    const items = container.children; 
    
    let currentSection = ""; 
    let currentPassage = null; 

    // ไล่อ่านข้อมูลจากบนลงล่าง
    for (let i = 0; i < items.length; i++) {
        const el = items[i];

        // 1. ถ้าเจอกล่องแบ่งตอน
        if (el.classList.contains('section-item')) {
            currentSection = el.querySelector('.section-title').value.trim();
            currentPassage = null; // ล้างค่าบทอ่านเมื่อขึ้นตอนใหม่
        } 
        // 2. ถ้าเจอกล่องบทอ่าน
        else if (el.classList.contains('passage-item')) {
            const pText = el.querySelector('.p-text').value;
            const imgEl = el.querySelector('.q-image-data');
            const pImage = (imgEl && imgEl.src && imgEl.src.startsWith('data:image')) ? imgEl.src : null;
            
            currentPassage = {
                id: `p_${Date.now()}_${i}`,
                text: pText,
                image: pImage
            };
        }
        // 3. ถ้าเจอกล่องคำถาม
        else if (el.classList.contains('question-item')) {
            const text = el.querySelector('.q-text').value;
            const imgEl = el.querySelector('.q-image-data');
            const image = (imgEl && imgEl.src && imgEl.src.startsWith('data:image')) ? imgEl.src : null;

            const choicesRaw = el.querySelectorAll('.c-text');
            const correctRadio = el.querySelectorAll('input[type="radio"]');
            const choices = [];
            choicesRaw.forEach((cInput, cIndex) => {
                choices.push({
                    id: `c${cIndex+1}`,
                    text: cInput.value,
                    isCorrect: correctRadio[cIndex].checked
                });
            });

            // นำข้อมูลทั้งหมดแพ็ครวมกัน
            questions.push({
                id: `q${questions.length+1}`, 
                section: currentSection, 
                passage: currentPassage, 
                text: text,
                image: image,
                choices: choices
            });

            // 🔴 สำคัญมาก: ล้างค่าบทอ่านทิ้งทันที! เพื่อไม่ให้มันไปเกาะติดกับข้อสอบข้อถัดไป
            currentPassage = null; 
        }
    }

    if(questions.length === 0) {
        alert("กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ");
        return;
    }

    const newExam = {
        id, title, subjectId, timeLimit, allowSwitch, password,
        shuffleQuestions: shuffleQ,
        shuffleChoices: shuffleC,
        questions,
        category: category,  
        chapter: chapter,    
        updatedAt: new Date().toISOString()
    };

    if (!dataState.exams) dataState.exams = [];

    const existingIdx = dataState.exams.findIndex(e => e.id === id);
    if(existingIdx > -1) {
        dataState.exams[existingIdx] = newExam; 
    } else {
        dataState.exams.push(newExam); 
    }

    if(typeof saveAndRefresh === 'function') saveAndRefresh({ action: 'update_exam_data' }); 
    if(typeof closeExamModal === 'function') closeExamModal();
    if(typeof showToast === 'function') showToast("บันทึกชุดข้อสอบเรียบร้อย!", "success");
    if(typeof renderExamPanel === 'function') renderExamPanel();
    if(typeof renderMainExamHub === 'function') renderMainExamHub();
}
// ในไฟล์ js/main.js

window.deleteExam = async function(examId) {
    if(!confirm("⚠️ คุณต้องการลบชุดข้อสอบนี้ใช่หรือไม่?\n\nข้อมูลการสอบและคะแนนที่เกี่ยวข้องทั้งหมดจะถูกลบด้วย และไม่สามารถกู้คืนได้")) return;

    // 1. ลบข้อมูลออกจาก Local State
    const index = dataState.exams.findIndex(e => e.id == examId);
    if(index > -1) {
        dataState.exams.splice(index, 1);
    }

    // (Optional) ลบ Session และ คะแนนที่เกี่ยวข้องกับข้อสอบนี้ทิ้งด้วย เพื่อไม่ให้เป็นขยะ
    if(dataState.examSessions) {
        dataState.examSessions = dataState.examSessions.filter(s => s.examId != examId);
    }
    // หมายเหตุ: dataState.scores อาจจะเก็บไว้ดูประวัติ หรือจะลบก็ได้แล้วแต่ Logic (ในที่นี้แนะนำให้ลบถ้าเป็น Online Exam ล้วนๆ)
    // if(dataState.scores) {
    //    dataState.scores = dataState.scores.filter(s => s.taskId != examId);
    // }

    saveToLocalStorage();

    // 2. ⭐ จุดที่แก้ไข: ต้องส่ง Object เข้าไปใน saveAndRefresh ⭐
    if (typeof saveAndRefresh === 'function') {
        try {
            await saveAndRefresh({
                action: 'deleteExam', // ต้องมี action เสมอ
                examId: examId
            });
        } catch (err) {
            console.error("Firebase Sync Error:", err);
            // ไม่ต้อง throw error ใส่หน้า user ถ้าลบในเครื่องสำเร็จแล้ว
        }
    }

    // 3. รีเฟรชหน้าจอ
    if(typeof renderExamPanel === 'function') renderExamPanel();
    
    // แจ้งเตือน
    if(typeof showToast === 'function') {
        showToast("ลบข้อสอบเรียบร้อย", "success");
    } else {
        alert("ลบข้อสอบเรียบร้อย");
    }
};


window.editExam = function(id) {
    openExamEditor(id);
}
// js/main.js

// --- ตัวแปร Global สำหรับการสอบ ---
let currentExam = null;
let examTimerInterval = null;
let examAnswers = {}; // เก็บคำตอบ { qId: choiceId }
let examViolations = 0; // จำนวนครั้งที่สลับหน้าจอ
let examStartTime = null;



// =================== 2. ระบบจับเวลา & Render (Exam UI) ===================

function startTimer(durationSeconds) {
    let timer = durationSeconds;
    const display = document.getElementById('exam-timer');
    
    clearInterval(examTimerInterval);
    examTimerInterval = setInterval(() => {
        const minutes = parseInt(timer / 60, 10);
        const seconds = parseInt(timer % 60, 10);

        display.textContent = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);

        if (--timer < 0) {
            clearInterval(examTimerInterval);
            alert("⏰ หมดเวลาทำข้อสอบ! ระบบจะส่งคำตอบทันที");
            submitExam(true); // Auto submit
        }
    }, 1000);
}

// ในไฟล์ js/main.js

window.renderExamUI = function(examData) {
    const exam = examData || window.currentExam;
    if (!exam) return;
    window.currentExam = exam;

    const displayArea = document.getElementById('question-display-area');
    const navGrid = document.getElementById('exam-nav-grid');
    
    if (displayArea && exam.questions) {
        // 🟢 1. จัดกลุ่มและสุ่มลำดับ (โดยรักษาหมวดหมู่และบทอ่านไว้ด้วยกัน)
        let orderedQuestions = [];
        const sectionGroups = {};
        
        exam.questions.forEach(q => {
            const sec = q.section || 'ทั่วไป';
            if(!sectionGroups[sec]) sectionGroups[sec] = [];
            sectionGroups[sec].push(q);
        });

        for (let sec in sectionGroups) {
            let sectionQuestions = sectionGroups[sec];
            const passageGroups = {};
            
            sectionQuestions.forEach(q => {
                const pid = q.passage ? q.passage.id : `standalone_${q.id}`;
                if(!passageGroups[pid]) passageGroups[pid] = { passage: q.passage, questions: [] };
                passageGroups[pid].questions.push(q);
            });

            let groupKeys = Object.keys(passageGroups);
            if (exam.shuffleQuestions) groupKeys.sort(() => Math.random() - 0.5); // สุ่มกลุ่มบทอ่าน

            let sectionFirstRender = true;
            groupKeys.forEach(key => {
                const group = passageGroups[key];
                let qs = group.questions;
                
                if (exam.shuffleQuestions) qs.sort(() => Math.random() - 0.5); // สุ่มคำถามภายในบทอ่าน
                
                if (qs.length > 0) {
                    if (sectionFirstRender) { qs[0]._renderSection = sec; sectionFirstRender = false; }
                    qs[0]._renderPassage = group.passage; // แปะบทอ่านไว้ที่ข้อแรกของกลุ่มเพื่อใช้วาด UI
                }
                orderedQuestions = orderedQuestions.concat(qs);
            });
        }

        // 🟢 2. Render Navigator (ปุ่มตัวเลข) ตามลำดับที่จัดเรียงแล้ว
        if (navGrid) {
            navGrid.innerHTML = orderedQuestions.map((q, idx) => `
                <button onclick="scrollToQuestion('q-${idx}')" id="nav-btn-${q.id}" class="w-10 h-10 rounded bg-white/10 text-white/70 text-sm hover:bg-yellow-500 hover:text-black transition-colors border border-white/5">
                    ${idx + 1}
                </button>
            `).join('');
        }

        // 🟢 3. Render คำถามและบทอ่าน
        displayArea.innerHTML = `
            <div class="max-w-3xl w-full space-y-6 pb-20">
                ${orderedQuestions.map((q, idx) => {
                    let prependHtml = '';
                    
                    // ถ้านี่คือข้อแรกของตอน ให้วาดป้าย Section
                    if (q._renderSection && q._renderSection !== 'ทั่วไป' && q._renderSection !== '') {
                        prependHtml += `
                            <div class="w-full bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold p-4 rounded-xl mt-10 mb-2 text-center text-lg shadow-lg">
                                <i class="fa-solid fa-folder-open mr-2"></i> ${q._renderSection}
                            </div>
                        `;
                    }

                    // ถ้านี่คือข้อแรกของกลุ่มบทอ่าน ให้วาดกล่องบทอ่าน
                    const p = q._renderPassage;
                    if (p && (p.text || p.image)) {
                        prependHtml += `
                            <div class="bg-purple-900/30 border border-purple-500/30 p-6 rounded-2xl mb-2 shadow-lg mt-6">
                                <div class="flex items-center gap-2 mb-4 border-b border-purple-500/30 pb-3">
                                    <span class="bg-purple-500 text-white font-bold px-3 py-1.5 rounded-full text-xs"><i class="fa-solid fa-book-open"></i> ข้อมูลสำหรับตอบคำถาม</span>
                                </div>
                                ${(p.image && p.image.startsWith('data:image')) ? `<img src="${p.image}" class="max-w-full md:max-w-lg rounded-lg mb-4 border border-white/20 mx-auto">` : ''}
                                ${p.text ? `<p class="text-purple-100 text-md leading-relaxed whitespace-pre-line">${p.text}</p>` : ''}
                            </div>
                        `;
                    }

                    let choices = [...q.choices];
                    if (exam.shuffleChoices) choices.sort(() => Math.random() - 0.5);

                    return `
                    ${prependHtml}
                    <div id="q-${idx}" class="bg-white/5 border border-white/10 p-6 rounded-2xl relative mb-4">
                        <div class="flex gap-3 mb-4">
                            <span class="bg-yellow-500 text-black font-bold px-2 py-0.5 rounded h-fit text-sm shrink-0">ข้อ ${idx+1}</span>
                            <div class="w-full">
                                ${(q.image && q.image.startsWith('data:image')) ? `<img src="${q.image}" class="max-w-full md:max-w-md rounded-lg mb-4 border border-white/20">` : ''}
                                <p class="text-white text-lg leading-relaxed whitespace-pre-line">${q.text}</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 gap-3 pl-2 md:pl-10">
                            ${choices.map(c => `
                                <label class="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:bg-white/10 cursor-pointer transition-all group">
                                    <div class="relative flex items-center shrink-0">
                                        <input type="radio" name="ans-${q.id}" value="${c.id}" onchange="selectAnswer('${q.id}', '${c.id}')" class="peer w-5 h-5 appearance-none border-2 border-white/30 rounded-full checked:border-green-500 checked:bg-green-500 transition-all">
                                        <i class="fa-solid fa-check text-white text-[10px] absolute top-1 left-1 opacity-0 peer-checked:opacity-100"></i>
                                    </div>
                                    <span class="text-white/80 group-hover:text-white">${c.text}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }
};

window.selectAnswer = function(qId, choiceId) {
    examAnswers[qId] = choiceId;
    // เปลี่ยนสีปุ่ม Navigator ให้รู้ว่าทำแล้ว
    const btn = document.getElementById(`nav-btn-${qId}`);
    if(btn) {
        btn.classList.add('bg-blue-600', 'text-white', 'border-transparent');
        btn.classList.remove('bg-white/10', 'text-white/70');
    }
}

window.scrollToQuestion = function(elementId) {
    document.getElementById(elementId).scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// =================== 3. ระบบ Anti-Cheat (ป้องกันการโกง) ===================

function initAntiCheat() {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur); // จับการคลิกโปรแกรมอื่น
}

function removeAntiCheat() {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleBlur);
}

function handleVisibilityChange() {
    if (document.hidden) {
        triggerViolation("สลับหน้าจอ / พับหน้าจอ");
    }
}

function handleBlur() {
    // เช็คเพิ่มเติมเพื่อป้องกัน False Positive (บางทีแค่คลิกพื้นที่ว่างใน Browser ก็โดน)
    if(document.activeElement === document.querySelector('iframe')) return; 
    triggerViolation("คลิกออกนอกหน้าต่างสอบ");
}

function triggerViolation(reason) {
    if(!currentExam) return;

    examViolations++;
    const max = currentExam.allowSwitch || 2;
    
    // อัพเดท UI เตือน
    const box = document.getElementById('cheat-warning-box');
    box.classList.remove('hidden');
    document.getElementById('warn-count').textContent = examViolations;

    // แจ้งเตือนนักเรียน
    if(examViolations <= max) {
        alert(`⚠️ คำเตือนครั้งที่ ${examViolations}/${max}\n\nระบบตรวจพบ: ${reason}\n\nหากทำเกินกำหนด ระบบจะปรับตกทันที!`);
        // ส่ง Log ไปให้ครูเห็น
        updateExamSessionStatus(currentExam.id, getCurrentStudentId(), 'WARNING', examViolations);
    } else {
        removeAntiCheat(); // หยุดจับ
        alert(`⛔ ผิดกฎการสอบ!\n\nคุณทำผิดกฎเกินจำนวนครั้งที่กำหนด\nระบบจะยุติการสอบและส่งคะแนนทันที`);
        submitExam(true, true); // true=auto, true=cheated
    }
}

// Helper หา ID นักเรียนปัจจุบัน (แบบง่าย)
function getCurrentStudentId() {
    // ในที่นี้เราไม่ได้เก็บ Global User ไว้ชัดเจน ขอใช้ Logic หาจาก dataState เอา
    // *ในการใช้งานจริง ควรเก็บ currentUser ไว้ตอน login* // เพื่อความง่ายใน Demo นี้ ผมขออนุญาต **Mock** หรือให้ Teacher กรอกรหัสตอนเริ่ม
    // ซึ่งใน function startExamProcess เราหา student ไว้แล้ว แต่ scope หลุด
    // **แก้ปัญหา:** เราจะเก็บ `currentStudentId` ไว้ใน Global scope ด้วย
    return window.currentStudentId; 
}


// =================== 4. ส่งข้อสอบ & คำนวณคะแนน ===================

window.submitExam = function(isAuto = false, isCheated = false) {
    // -----------------------------------------------------------
    // 🛡️ 1. ส่วนกู้คืนข้อมูล (Recovery Block) - แก้ Error: null
    // -----------------------------------------------------------
    if (!window.currentExam) {
        console.warn("⚠️ currentExam is null. Attempting to recover...");
        
        // กู้คืน Student ID
        if (!window.currentStudentId) {
            const code = localStorage.getItem('current_student_code');
            const student = dataState.students.find(s => String(s.code) === String(code));
            if (student) window.currentStudentId = student.id;
        }

        // กู้คืน Exam Data จาก Session ที่ค้างอยู่
        const session = dataState.examSessions?.find(s => 
            s.studentId == window.currentStudentId && 
            s.status === 'TESTING'
        );

        if (session) {
            window.currentExam = dataState.exams.find(e => e.id == session.examId);
            console.log("✅ Recovered exam data for:", window.currentExam?.title);
        }
    }

    // Safety Check: ถ้ากู้ไม่สำเร็จจริงๆ ให้รีโหลด
    if (!window.currentExam) {
        alert("❌ ไม่พบข้อมูลข้อสอบ (Session หลุด)\nระบบจะทำการรีโหลดหน้าจอ..");
        window.location.reload();
        return;
    }
    // -----------------------------------------------------------

    if (!isAuto && !confirm("ยืนยันการส่งคำตอบ?\n\nเมื่อส่งแล้วจะไม่สามารถแก้ไขได้อีก")) return;

    // หยุดเวลาและ Anti-Cheat
    if (typeof examTimerInterval !== 'undefined') clearInterval(examTimerInterval);
    if (typeof removeAntiCheat === 'function') removeAntiCheat();

    // 2. ตรวจคะแนน
    let rawScore = 0;
    const totalQuestions = window.currentExam.questions.length;

    window.currentExam.questions.forEach(q => {
        const userAnsId = examAnswers[q.id];
        const correctChoice = q.choices.find(c => c.isCorrect);
        if (userAnsId && correctChoice && userAnsId === correctChoice.id) {
            rawScore++;
        }
    });

    const finalScore = isCheated ? 0 : rawScore;

    // 3. บันทึกคะแนนลง Memory
    if (!isCheated) {
        recordExamScore(window.currentExam.id, window.currentStudentId, finalScore);
    } else {
        recordExamScore(window.currentExam.id, window.currentStudentId, 0);
    }

    // 4. อัปเดตสถานะ Session (FINISHED / CHEATED)
    updateExamSessionStatus(
        window.currentExam.id, 
        window.currentStudentId, 
        isCheated ? 'CHEATED' : 'FINISHED', 
        typeof examViolations !== 'undefined' ? examViolations : 0, 
        finalScore
    );

    // ⭐⭐ จุดสำคัญที่เพิ่มเข้ามา: บันทึกลงเครื่องทันที (แก้ปัญหาสอบซ้ำ) ⭐⭐
    saveToLocalStorage(); 
    // ------------------------------------------------------------------

    // 5. ปิดหน้าจอสอบ
    const overlay = document.getElementById('exam-room-overlay');
    if (overlay) overlay.classList.add('hidden');
    
    // 6. แจ้งผลและรีเฟรช (ใช้ Swal ถ้ามี เพื่อบังคับ User กด OK)
    if (isCheated) {
        alert("การสอบเป็นโมฆะ เนื่องจากทำผิดกฎการสอบ");
        window.location.reload();
    } else {
        // ใช้ setTimeout เล็กน้อยเพื่อให้ saveToLocalStorage ทำงานทัน
        setTimeout(() => {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'ส่งข้อสอบเรียบร้อย!',
                    text: `คะแนนที่ได้: ${finalScore} / ${totalQuestions}`,
                    allowOutsideClick: false,
                    confirmButtonText: 'กลับหน้าหลัก'
                }).then(() => {
                    window.location.reload();
                });
            } else {
                alert(`ส่งข้อสอบเรียบร้อย!\n\nคะแนนที่ได้: ${finalScore} / ${totalQuestions}`);
                window.location.reload();
            }
        }, 500);
    }
    
    // Clear ค่า
    window.currentExam = null;
}
// ในไฟล์ js/main.js

function recordExamScore(examId, studentId, score) {
    // 1. อัปเดตข้อมูลในเครื่องทันที (Optimistic UI)
    // เพื่อให้หน้าจอแสดงผลว่ามีคะแนนแล้วทันที ไม่ต้องรอ Server ตอบกลับ
    let scoreObj = dataState.scores.find(s => s.taskId == examId && s.studentId == studentId);
    
    if (scoreObj) {
        scoreObj.score = score;
        scoreObj.submission = { type: 'exam', date: new Date().toISOString() };
    } else {
        dataState.scores.push({
            studentId: studentId,
            taskId: examId,
            score: score,
            submission: { type: 'exam', date: new Date().toISOString() }
        });
    }

    // 2. ⭐ แก้ไขจุดที่ Error: ส่งข้อมูลไปบันทึกที่ Server ⭐
    // ต้องส่ง Object ที่มี action: 'addScore' เข้าไปเสมอ
    saveAndRefresh({
        action: 'addScore',
        studentId: studentId,
        taskId: examId,
        score: score
    });
}

// ฟังก์ชันช่วยอัพเดทสถานะ Realtime (จำลองโดยการบันทึกเข้า dataState.examSessions)
function updateExamSessionStatus(examId, studentId, status, violations = 0, score = 0) {
    // หา Session เดิม
    let sessions = dataState.examSessions || [];
    let session = sessions.find(s => s.examId === examId && s.studentId === studentId);

    if(session) {
        session.status = status;
        session.violations = violations;
        session.score = score;
        session.lastUpdate = new Date().getTime();
    } else {
        sessions.push({
            examId, studentId, status, violations, score,
            startTime: new Date().getTime(),
            lastUpdate: new Date().getTime()
        });
    }
    
    dataState.examSessions = sessions;
    
    // บันทึกเงียบๆ (ไม่ต้อง Refresh หน้าจอ) -> แต่ถ้าจะให้ครูเห็น Realtime 
    // ควรใช้ Firebase set() โดยตรงแยกต่างหาก แต่เพื่อความง่ายใช้ saveAndRefresh แบบไม่ reload
    saveToLocalStorage();
    syncData(); // ส่งไป Firebase
}

window.resetStudentExam = async function(examId, studentId) {
    if(!confirm("⚠️ ต้องการรีเซ็ตการสอบของนักเรียนคนนี้ใช่หรือไม่?\n\n- สถานะการสอบจะถูกล้าง\n- คะแนนจะถูกลบ\n- นักเรียนจะเริ่มทำข้อสอบใหม่ได้")) return;

    // 1. ลบคะแนน (ถ้ามี) ใน Local State
    const scoreIdx = dataState.scores.findIndex(s => String(s.taskId) === String(examId) && String(s.studentId) === String(studentId));
    if(scoreIdx > -1) {
        dataState.scores.splice(scoreIdx, 1);
    }

    // 2. ลบ Session (สถานะการสอบ) ใน Local State
    const sessionIdx = dataState.examSessions.findIndex(s => String(s.examId) === String(examId) && String(s.studentId) === String(studentId));
    if(sessionIdx > -1) {
        dataState.examSessions.splice(sessionIdx, 1);
    }

    // บันทึกลงเครื่องทันที
    saveToLocalStorage();

    // 3. ⭐ แก้ไขจุดที่ Error: ส่งคำสั่งไปที่ Server ⭐
    try {
        await saveAndRefresh({
            action: 'resetStudentExam', // ระบุชื่อ action
            examId: examId,
            studentId: studentId
        });
    } catch (err) {
        console.warn("Server sync error (ignored):", err);
    }
    
    // 4. รีเฟรชหน้าจอ Monitor
    // เช็คก่อนว่าฟังก์ชัน refreshMonitor มีอยู่จริงไหม เพื่อกัน Error
    if(typeof window.refreshMonitor === 'function') {
        const monitorModal = document.getElementById('exam-monitor-modal');
        if(monitorModal && !monitorModal.classList.contains('hidden')) {
            window.refreshMonitor(); 
        }
    }
    
    showToast("รีเซ็ตสถานะเรียบร้อย", "success");
};
// ==========================================
// 🖼️ จัดการรูปภาพ (Image Handling)
// ==========================================

window.previewQuestionImage = function(input, qId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        // เช็คขนาดไฟล์ (ไม่ควรเกิน 1MB เพราะจะทำให้ DB หนัก)
        if(input.files[0].size > 1024 * 1024) {
            alert("⚠️ ไฟล์รูปภาพมีขนาดใหญ่เกินไป (ควรน้อยกว่า 1MB)");
            return;
        }

        reader.onload = function(e) {
            const previewBox = document.getElementById(`preview-${qId}`);
            const img = previewBox.querySelector('img');
            
            img.src = e.target.result; // Base64 string
            previewBox.classList.remove('hidden');
        }
        
        reader.readAsDataURL(input.files[0]);
    }
}

window.removeQuestionImage = function(qId) {
    const previewBox = document.getElementById(`preview-${qId}`);
    const img = previewBox.querySelector('img');
    
    img.src = ''; // ล้างค่า
    previewBox.classList.add('hidden');
}


// ==========================================
// 📝 จัดการไฟล์ Word (Docx Import)
// ==========================================

// 1. ฟังก์ชันดาวน์โหลดไฟล์แม่แบบ
// ฟังก์ชันดาวน์โหลดไฟล์แม่แบบ Word
window.downloadWordTemplate = function() {
    const content = `
    <html>
    <head><meta charset='utf-8'></head>
    <body>
        <h1>แบบฟอร์มข้อสอบ (Template)</h1>
        <p><b>คำแนะนำ:</b> สามารถพิมพ์คำว่า <b>ตอนที่...</b> หรือ <b>Part...</b> เพื่อแบ่งหมวดหมู่ข้อสอบได้ (พิมพ์ตามรูปแบบด้านล่างเป๊ะๆ)</p>
        <hr>
        <br>

        <h3>ตอนที่ 1: การอ่านและทำความเข้าใจ</h3>
        
        <p>1. ข้อใดคือเมืองหลวงของไทย?</p>
        <p>ก. เชียงใหม่</p>
        <p>ข. กรุงเทพมหานคร</p>
        <p>ค. ภูเก็ต</p>
        <p>ง. ขอนแก่น</p>
        <p>เฉลย: ข</p>
        <br>
        
        <h3>Part 2: Grammar and Vocabulary</h3>

        <p>2. 1 + 1 เท่ากับเท่าไหร่?</p>
        <p>a. 1</p>
        <p>b. 2</p>
        <p>c. 3</p>
        <p>d. 4</p>
        <p>ans: b</p>

    </body>
    </html>
    `;
    
    const blob = new Blob(['\ufeff', content], {
        type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Exam_Template.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 2. ฟังก์ชันนำเข้า Word (ใช้ Mammoth.js)
window.importExamFromWord = function(input) {
    const file = input.files[0];
    if(!file) return;

    if (typeof mammoth === "undefined") {
        alert("❌ ไม่พบ Library Mammoth.js กรุณาเช็คอินเทอร์เน็ตหรือ index.html");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const arrayBuffer = event.target.result;

        mammoth.extractRawText({arrayBuffer: arrayBuffer})
            .then(function(result) {
                const text = result.value; // ข้อความดิบจาก Word
                parseExamText(text); // ส่งไปแปลงเป็นข้อสอบ
            })
            .catch(function(err) {
                console.error(err);
                alert("❌ เกิดข้อผิดพลาดในการอ่านไฟล์ Word");
            });
    };
    reader.readAsArrayBuffer(file);
    
    // Reset input เพื่อให้เลือกไฟล์เดิมซ้ำได้
    input.value = '';
}
// 3. Logic แปลงข้อความ เป็น ข้อสอบ
function parseExamText(text) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l);
    
    let currentQuestion = null;
    let questions = [];
    let choicesBuffer = [];
    let currentSection = ""; 
    let currentPassageText = ""; // 🟢 ตัวแปรใหม่สำหรับคอยจับข้อความบทอ่าน

    lines.forEach(line => {
        // 1) ดักจับชื่อตอน 
        if (/^(ตอนที่|part|section)\s*.+/i.test(line)) {
            currentSection = line; 
            currentPassageText = ""; 
        }
        // 🟢 2) ดักจับ "บทอ่าน" หรือ "ข้อมูล"
        else if (/^(บทอ่าน|ข้อมูล|เนื้อเรื่อง|passage)[:\s]/i.test(line)) {
            currentPassageText = line.replace(/^(บทอ่าน|ข้อมูล|เนื้อเรื่อง|passage)[:\s]*/i, '');
        }
        // 3) ตรวจสอบโจทย์
        else if (/^\d+[\.)]\s+/.test(line)) {
            if (currentQuestion) finalizeQuestion(currentQuestion, choicesBuffer, questions);
            
            currentQuestion = {
                text: line.replace(/^\d+[\.)]\s+/, ''),
                section: currentSection, 
                passage: currentPassageText, // 🟢 นำบทอ่านมาผูกติดกับโจทย์ข้อแรกที่เจอ
                choices: []
            };
            choicesBuffer = [];
            currentPassageText = ""; // ล้างค่าทิ้งเพื่อไม่ให้กล่องบทอ่านไปซ้ำกับข้อถัดไป
        } 
        // 4) ตรวจสอบเฉลย
        else if (/^(เฉลย|ans|answer|答|答案)[:\s]/i.test(line)) {
            if(currentQuestion) {
                currentQuestion.correctAnswerRaw = line.split(/[:\s]+/).pop().trim().toLowerCase();
            }
        }
        // 5) ตรวจสอบตัวเลือก
        else if (/^[ก-ฮa-zA-Z][\.)]\s+/.test(line)) {
            if (currentQuestion) {
                const cleanChoice = line.replace(/^[ก-ฮa-zA-Z][\.)]\s*/, '');
                choicesBuffer.push(cleanChoice);
            }
        }
        // 6) จัดการข้อความหลายบรรทัด
        else {
            if (currentPassageText !== "") {
                // 🟢 ถ้ากำลังพิมพ์บทอ่านค้างอยู่ ให้เอาบรรทัดนี้ไปต่อท้ายกล่องบทอ่าน
                currentPassageText += '\n' + line;
            } else if (currentQuestion) {
                if (choicesBuffer.length === 0) {
                    currentQuestion.text += '\n' + line;
                } else {
                    // ⚠️ ของเดิมบทอ่านจะหลุดมาเข้าตรงนี้ ทำให้ไปต่อท้ายตัวเลือก ง.
                    choicesBuffer[choicesBuffer.length - 1] += ' ' + line;
                }
            }
        }
    });

    if (currentQuestion) {
        finalizeQuestion(currentQuestion, choicesBuffer, questions);
    }

    // นำเข้าสู่หน้าจอ 
    if(questions.length > 0) {
        if(confirm(`พบคำถามจำนวน ${questions.length} ข้อ ต้องการนำเข้าหรือไม่? (ข้อมูลเดิมในหน้านี้จะหายไป)`)) {
            document.getElementById('questions-container').innerHTML = ''; 
            
            let lastRenderedSection = ""; 
            
            questions.forEach(q => {
                // 1. วาดกล่องตอนสีน้ำเงิน
                if (q.section && q.section !== lastRenderedSection) {
                    window.addSectionDivider(q.section); 
                    lastRenderedSection = q.section;     
                }
                
                // 🟢 2. วาดกล่องบทอ่านสีม่วง (ถ้าระบุไว้ใน Word)
                if (q.passage && q.passage.trim() !== "") {
                    window.addPassageDivider({ text: q.passage });
                }
                
                // 3. วาดกล่องคำถาม
                window.addQuestionItem(q); 
            });
            
            alert("✅ นำเข้าเรียบร้อย!");
        }
    } else {
        alert("⚠️ ไม่พบรูปแบบคำถามที่ถูกต้องในไฟล์\nกรุณาใช้ไฟล์แม่แบบเพื่อตรวจสอบการเว้นวรรคและรูปแบบ");
    }
}

// Helper: ประกอบร่างคำถามและหาข้อถูก
function finalizeQuestion(qObj, choicesRaw, qArray) {
    // ต้องมีอย่างน้อย 2 ช้อยส์
    if (choicesRaw.length < 2) return;

    // หา Index ของข้อถูก
    let correctIdx = 0; // Default ข้อ A
    
    if (qObj.correctAnswerRaw) {
        // แปลง ก,ข,ค,ง หรือ a,b,c,d เป็น index 0,1,2,3
        const map = { 'ก':0, 'a':0, '1':0, 'ข':1, 'b':1, '2':1, 'ค':2, 'c':2, '3':2, 'ง':3, 'd':3, '4':3 };
        const key = qObj.correctAnswerRaw.charAt(0); // เอาตัวอักษรแรก
        if (map[key] !== undefined) correctIdx = map[key];
    }

    const choices = choicesRaw.map((txt, idx) => ({
        id: `c${idx+1}`,
        text: txt,
        isCorrect: (idx === correctIdx)
    }));
    
    // เติมให้ครบ 4 ช้อยส์ถ้าขาด (Optional)
    while(choices.length < 4) {
        choices.push({ id: `c${choices.length+1}`, text: "-", isCorrect: false });
    }

    qArray.push({
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
        text: qObj.text,
        choices: choices.slice(0, 4) // เอาแค่ 4 ข้อแรก
    });
}
// ในไฟล์ js/main.js
window.startExamProcess = function(examId) {
    const exam = dataState.exams.find(e => e.id === examId);
    if (!exam) return;

    // รับค่า ID นักเรียน
    let studentId = window.currentStudentId;
    if (!studentId) {
        if (globalState.currentUser && globalState.currentUser.id) {
            studentId = globalState.currentUser.id;
        } else {
            const code = localStorage.getItem('current_student_code');
            const student = dataState.students.find(s => String(s.code) === String(code));
            if (student) studentId = student.id;
        }
    }

    if (!studentId) {
        alert("Error: ไม่พบข้อมูลรหัสนักเรียน (Student ID Missing)");
        return;
    }

    // เช็คสถานะการสอบ
    const session = dataState.examSessions?.find(s => s.examId === examId && s.studentId === studentId);
    if (session && session.status === 'FINISHED') return alert("คุณส่งข้อสอบชุดนี้ไปแล้ว");
    if (session && session.status === 'CHEATED') return alert("คุณถูกระงับสิทธิ์การสอบในวิชานี้");

    // ถามรหัสผ่าน
    if (exam.password && (!session || session.status !== 'TESTING')) {
        const input = prompt(`🔒 กรุณาใส่รหัสผ่านเข้าห้องสอบ: ${exam.title}`);
        if (input !== exam.password) return alert("❌ รหัสผ่านไม่ถูกต้อง!");
    }

    // เริ่มต้น Session
    if (!session) {
        const newSession = {
            examId: exam.id,
            studentId: studentId,
            status: 'TESTING',
            score: 0,
            answers: {},
            startTime: new Date().getTime(),
            violations: 0
        };
        
        if (!dataState.examSessions) dataState.examSessions = [];
        dataState.examSessions.push(newSession);

        // ⭐ แก้ไขจุดที่ Error: ต้องใส่ Object เข้าไปใน saveAndRefresh
        saveAndRefresh({ 
            action: 'updateExamSession', 
            session: newSession 
        }); 
    }

    // พาไปหน้าสอบ
    const dashboard = document.getElementById('main-app-container');
    const overlay = document.getElementById('exam-room-overlay');
    
    if(dashboard) dashboard.classList.add('hidden');
    if(overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }

    // ⭐ กำหนดตัวแปร Global และส่งค่าไปให้ renderExamUI โดยตรง
    window.currentExam = exam; 

    // ==========================================
    // 🟢 เพิ่มโค้ด Auto-Resume บันทึกสถานะนักเรียนตรงนี้
    // ==========================================
    const studentInfo = dataState.students.find(s => s.id === studentId);
    const classId = studentInfo ? studentInfo.classId : null;
    
    if (typeof saveStudentSession === 'function') {
        // บันทึกความจำลงเครื่องว่าเด็กคนนี้กำลังสอบวิชานี้อยู่
        saveStudentSession(studentId, classId, exam.id);
    }
    // ==========================================
    
    // เรียก renderExamUI โดยส่ง exam เข้าไปเพื่อป้องกันค่า null
    if (typeof window.renderExamUI === 'function') {
        window.renderExamUI(exam);
    }

    // เริ่มจับเวลา
    if (typeof startTimer === 'function' && exam.timeLimit) {
        startTimer(exam.timeLimit * 60); 
    }
    
    // เริ่มกันโกง
    if (typeof initAntiCheat === 'function') {
        initAntiCheat();
    }
};

window.approveScore = function(studentId, taskId) {
    const input = document.getElementById(`score-input-${studentId}-${taskId}`);
    const scoreVal = parseFloat(input.value);

    // ตรวจสอบความถูกต้อง
    const task = dataState.tasks.find(t => t.id == taskId);
    if (isNaN(scoreVal)) {
        alert("กรุณากรอกคะแนน");
        return;
    }
    if (task && scoreVal > task.maxScore) {
        if(!confirm(`คะแนนที่กรอก (${scoreVal}) มากกว่าคะแนนเต็ม (${task.maxScore})\nยืนยันหรือไม่?`)) return;
    }

    // อัปเดต State (ใช้ Logic เดียวกับตอนกรอกคะแนนปกติ)
    const scoreObj = dataState.scores.find(s => s.studentId == studentId && s.taskId == taskId);
    if (scoreObj) {
        scoreObj.score = scoreVal; // พอใส่คะแนนแล้ว มันจะไม่เป็น null อีกต่อไป -> หลุดจากหน้ารอตรวจ
    } else {
        // กรณีกันพลาด (ไม่น่าเกิดเพราะต้องมี submission ก่อน)
        dataState.scores.push({
            studentId: studentId,
            taskId: taskId,
            score: scoreVal,
            submission: 'Manual Graded'
        });
    }

    // บันทึกและรีเฟรชหน้าจอ
    saveToLocalStorage();
    
    // เรียก render หน้าตรวจงานใหม่ เพื่อให้การ์ดที่ตรวจแล้วหายไปทันที
    renderIncomingSubmissions('incoming-work-wrapper'); 
    
    // แจ้งเตือนเล็กน้อย
    showToast("บันทึกคะแนนเรียบร้อย", "green");
};
// ในไฟล์ js/main.js

window.returnWork = async function(studentId, taskId) {
    // 1. ถามเหตุผลที่ให้แก้
    const { value: reason } = await Swal.fire({
        title: 'ส่งคืนงานให้แก้ไข',
        input: 'text',
        inputLabel: 'ระบุเหตุผลที่ต้องแก้ไข (นักเรียนจะเห็นข้อความนี้)',
        inputPlaceholder: 'เช่น แนบไฟล์ผิด, ทำไม่ครบถ้วน...',
        showCancelButton: true,
        confirmButtonText: 'ส่งคืน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#d33',
        inputValidator: (value) => {
            if (!value) {
                return 'กรุณาระบุเหตุผลด้วยครับ นักเรียนจะได้แก้ถูกจุด';
            }
        }
    });

    if (reason) {
        try {
            // 2. อัปเดตสถานะใน dataState.submissions
            // หา record ล่าสุดของนักเรียนคนนี้ในงานนี้
            if (dataState.submissions) {
                const subIndex = dataState.submissions.findIndex(s => s.studentId == studentId && s.taskId == taskId);
                if (subIndex > -1) {
                    dataState.submissions[subIndex].status = 'returned'; // เปลี่ยนสถานะเป็นถูกตีกลับ
                    dataState.submissions[subIndex].teacherComment = reason; // บันทึกคอมเมนต์ครู
                }
            }

            // 3. (Optional) เคลียร์สถานะใน scores ด้วยเพื่อให้แน่ใจ
            const scoreEntry = dataState.scores.find(s => s.studentId == studentId && s.taskId == taskId);
            if (scoreEntry) {
                scoreEntry.submission = null; // ลบ submission ออกจากหน้าคะแนนเพื่อให้รู้ว่าต้องส่งใหม่
                scoreEntry.score = null;
            }

            // 4. บันทึกและรีเฟรช
            saveToLocalStorage();
            
            if (typeof saveAndRefresh === 'function') {
                await saveAndRefresh({ 
                    action: 'returnTask', 
                    taskId: taskId, 
                    studentIds: [studentId], 
                    comment: reason 
                });
            }

            // 5. อัปเดตหน้าจอทันที (งานจะหายไปจาก list)
            renderIncomingSubmissions('incoming-list'); // อย่าลืมใส่ id ให้ตรงกับ html ('incoming-list')
            
            Swal.fire('เรียบร้อย', 'ส่งคืนงานให้นักเรียนแก้ไขแล้ว', 'success');

        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึก', 'error');
        }
    }
};
// ในไฟล์ js/main.js (เพิ่มต่อท้าย)

window.approveGroupScore = async function(memberIdsStr, taskId, leaderId) {
    // ดึงค่าคะแนนจาก Input (ใช้ ID ของหัวหน้าในการอ้างอิง Input)
    const input = document.getElementById(`score-input-${taskId}-${leaderId}`);
    if (!input) return;

    const scoreVal = parseFloat(input.value);
    const task = dataState.tasks.find(t => t.id == taskId);

    // Validation
    if (isNaN(scoreVal)) {
        Swal.fire('แจ้งเตือน', 'กรุณากรอกคะแนนก่อนกดยืนยัน', 'warning');
        return;
    }
    if (task && scoreVal > task.maxScore) {
        const confirmResult = await Swal.fire({
            title: 'คะแนนเกิน?',
            text: `คะแนนที่กรอก (${scoreVal}) มากกว่าคะแนนเต็ม (${task.maxScore}) ยืนยันหรือไม่?`,
            icon: 'question',
            showCancelButton: true
        });
        if (!confirmResult.isConfirmed) return;
    }

    // แปลง string 'id1,id2' กลับเป็น array
    const memberIds = memberIdsStr.split(',');

    try {
        // วนลูปให้คะแนนทุกคนในกลุ่ม
        memberIds.forEach(sid => {
            // 1. อัปเดต Score
            let scoreEntry = dataState.scores.find(s => s.studentId == sid && s.taskId == taskId);
            if (scoreEntry) {
                scoreEntry.score = scoreVal;
                scoreEntry.submission = 'Group Graded'; // หรือใส่ Link งานก็ได้
            } else {
                dataState.scores.push({
                    studentId: sid,
                    taskId: taskId,
                    score: scoreVal,
                    submission: 'Group Graded'
                });
            }
        });

        // 2. บันทึก
        saveToLocalStorage();

        // 3. (Optional) ส่งขึ้น Server ถ้ามีฟังก์ชันรองรับ
        if (typeof saveAndRefresh === 'function') {
            await saveAndRefresh({ 
                action: 'gradeTask', 
                taskId: taskId, 
                studentIds: memberIds, // ส่งไปเป็น Array ระบบหลังบ้านจะได้บันทึกทีเดียว
                score: scoreVal 
            });
        }

        // 4. รีเฟรชหน้าจอ (รายการกลุ่มจะหายไปเพราะทุกคนมีคะแนนแล้ว)
        renderIncomingSubmissions('incoming-list');
        
        // Show Toast
        const Toast = Swal.mixin({
            toast: true,
            position: 'bottom-end',
            showConfirmButton: false,
            timer: 3000
        });
        Toast.fire({
            icon: 'success',
            title: `ให้คะแนนเรียบร้อย (${memberIds.length} คน)`
        });

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึกคะแนน', 'error');
    }
};

// แก้ไขฟังก์ชัน returnWork ให้รองรับแบบกลุ่มด้วย
window.returnWork = async function(memberIdsStr, taskId) {
    const { value: reason } = await Swal.fire({
        title: 'ส่งคืนงานให้แก้ไข',
        input: 'text',
        inputLabel: 'ระบุเหตุผล (แจ้งเตือนทั้งกลุ่ม)',
        inputPlaceholder: 'ระบุเหตุผล...',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ส่งคืน'
    });

    if (reason) {
        const memberIds = memberIdsStr.split(','); // รับเป็น ID แบบกลุ่มมา
        
        memberIds.forEach(sid => {
            // Update Submissions status
            if (dataState.submissions) {
                // หา submission ล่าสุดของแต่ละคนในงานนี้
                const subIndex = dataState.submissions.findIndex(s => s.studentId == sid && s.taskId == taskId);
                if (subIndex > -1) {
                    dataState.submissions[subIndex].status = 'returned';
                    dataState.submissions[subIndex].teacherComment = reason;
                }
            }
            // Clear Score entry to ensure it's removed from grading view but allows re-submission logic
            const scoreEntry = dataState.scores.find(s => s.studentId == sid && s.taskId == taskId);
            if (scoreEntry) {
                scoreEntry.score = null;
                scoreEntry.submission = null;
            }
        });

        saveToLocalStorage();
        renderIncomingSubmissions('incoming-list');
        Swal.fire('ส่งคืนแล้ว', 'แจ้งเตือนนักเรียนทั้งกลุ่มเรียบร้อย', 'success');
    }
};

// ในไฟล์ js/main.js (ค้นหา toggleExamStatus แล้ววางทับ)

window.toggleExamStatus = async function(examId) {
    const classSelect = document.getElementById('exam-class-select-main');
    // ⭐ บังคับแปลงเป็น String
    const classId = classSelect ? String(classSelect.value) : null;

    if (!classId || classId === "undefined" || classId === "") {
        Swal.fire('กรุณาเลือกห้องเรียน', 'ต้องเลือกห้องเรียนด้านล่างก่อนกดเปิดสอบ', 'warning');
        return;
    }

    const exam = dataState.exams.find(e => e.id == examId);
    if (!exam) return;

    if (!exam.activeClasses) exam.activeClasses = [];

    // ⭐ แปลง activeClasses เดิมให้เป็น String ทั้งหมดก่อนเปรียบเทียบ
    exam.activeClasses = exam.activeClasses.map(String);

    const classIndex = exam.activeClasses.indexOf(classId);
    let newStatus = '';

    if (classIndex > -1) {
        // ปิดสอบ
        exam.activeClasses.splice(classIndex, 1);
        newStatus = 'closed';
    } else {
        // เปิดสอบ
        exam.activeClasses.push(classId);
        newStatus = 'active';
    }

    saveToLocalStorage();
    
    if (typeof saveAndRefresh === 'function') {
        await saveAndRefresh({
            action: 'updateExamActiveClasses',
            examId: examId,
            activeClasses: exam.activeClasses
        });
    }

    if(typeof renderExamPanel === 'function') renderExamPanel();

    const className = dataState.classes.find(c => String(c.id) === classId)?.name || 'ห้องเรียน';
    showToast(`${newStatus === 'active' ? 'เปิด' : 'ปิด'}สอบ ${className} แล้ว`, newStatus === 'active' ? 'success' : 'warning');
};


window.enterStudentExamRoom = function(examId) {
    const exam = dataState.exams.find(e => e.id == examId);
    if (!exam) return Swal.fire('Error', 'ไม่พบข้อมูลข้อสอบ', 'error');

    const currentStudentCode = localStorage.getItem('current_student_code');
    if (!currentStudentCode) return Swal.fire('Error', 'กรุณาล็อกอินใหม่', 'error');

    // 1. หานักเรียนให้ตรงกับห้องที่เปิดสอบ (Logic เดิมที่เคยแก้ให้)
    const potentialStudents = dataState.students.filter(s => String(s.code) === String(currentStudentCode));
    if (potentialStudents.length === 0) return Swal.fire('Error', 'ไม่พบข้อมูลนักเรียน', 'error');

    let activeClassesStr = (exam.activeClasses || []).map(String);
    const validStudent = potentialStudents.find(s => activeClassesStr.includes(String(s.classId)));

    if (!validStudent) {
        Swal.fire({
            icon: 'warning',
            title: 'เข้าสอบไม่ได้',
            text: 'การสอบนี้ไม่ได้เปิดสำหรับห้องเรียนของคุณ',
            confirmButtonColor: '#d33'
        });
        return;
    }

    // ⭐⭐ จุดที่เพิ่มความเข้มงวด (Strict Check) ⭐⭐
    
    // เช็ค 1: มีคะแนนบันทึกไว้แล้วหรือยัง? (ถ้ามี = ส่งแล้วชัวร์)
    const hasScore = dataState.scores.some(s => 
        String(s.taskId) === String(examId) && 
        String(s.studentId) === String(validStudent.id)
    );

    // เช็ค 2: สถานะ Session เป็น FINISHED หรือ CHEATED ไหม?
    const session = dataState.examSessions?.find(s => 
        String(s.examId) === String(examId) && 
        String(s.studentId) === String(validStudent.id)
    );

    const isFinished = session && (session.status === 'FINISHED' || session.status === 'CHEATED');

    // 🚫 ถ้าเข้าเงื่อนไขใดเงื่อนไขหนึ่ง ห้ามเข้าเด็ดขาด
    if (hasScore || isFinished) {
        Swal.fire({
            icon: 'info',
            title: 'คุณสอบเสร็จแล้ว',
            text: 'ระบบได้บันทึกคะแนนของคุณเรียบร้อยแล้ว ไม่สามารถเข้าสอบซ้ำได้',
            confirmButtonText: 'ตกลง'
        });
        return; 
    }

    // ✅ ผ่านทุกด่าน -> อนุญาตให้เข้า
    window.currentStudentId = validStudent.id; 
    
    if (typeof window.startExamProcess === 'function') {
        window.startExamProcess(examId);
    } else {
        alert("System Error: startExamProcess missing");
    }
};
// ในไฟล์ js/main.js

window.confirmLaunchConfig = async function() {
    const examId = document.getElementById('launch-exam-id').value;
    const exam = dataState.exams.find(e => e.id === examId);
    if (!exam) return;

    // 1. รวบรวมข้อมูลห้องที่เลือก
    const checkboxes = document.querySelectorAll('.launch-class-cb:checked');
    const selectedClasses = Array.from(checkboxes).map(cb => String(cb.value));

    // 2. รวบรวม Config
    const newConfig = {
        timeLimit: parseInt(document.getElementById('launch-duration').value) || 60,
        password: document.getElementById('launch-password').value.trim(),
        allowSwitch: parseInt(document.getElementById('launch-allow-switch').value) || 2,
        shuffleQuestions: document.getElementById('launch-shuffle-q').checked,
        shuffleChoices: document.getElementById('launch-shuffle-c').checked,
        activeClasses: selectedClasses // อัปเดตห้องที่เปิดสอบตรงนี้
    };

    // 3. อัปเดต Local State
    Object.assign(exam, newConfig);
    saveToLocalStorage();

    // 4. ส่งไป Server
    // เราส่งไปอัปเดตทั้งก้อน เพื่อให้มั่นใจว่า Config ใหม่ถูกนำไปใช้พร้อมกับการเปิดสอบ
    if (typeof saveAndRefresh === 'function') {
        showLoading("กำลังบันทึกและเปิดสอบ...");
        try {
            await saveAndRefresh({
                action: 'updateExamFullConfig', // ชื่อ action ใหม่เพื่อให้รู้ว่าอัปเดตหมด
                examId: examId,
                ...newConfig
            });
            
            document.getElementById('exam-launch-modal').classList.add('hidden');
            if(typeof renderExamPanel === 'function') renderExamPanel();
            
            const count = selectedClasses.length;
            const msg = count > 0 ? `เปิดสอบสำหรับ ${count} ห้องเรียบร้อย` : `ปิดการสอบทั้งหมดแล้ว`;
            showToast(msg, count > 0 ? "success" : "warning");

        } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
        } finally {
            hideLoading();
        }
    }
};
// ในไฟล์ js/main.js

window.forceSubmitExam = async function(examId, studentId) {
    if(!confirm("⚠️ ยืนยันการบังคับส่งข้อสอบของนักเรียนคนนี้?\n(ระบบจะตัดคะแนนเท่าที่ทำได้ทันที)")) return;

    // หา Session
    const session = dataState.examSessions?.find(s => s.examId == examId && s.studentId == studentId);
    
    if(!session) {
        alert("ไม่พบข้อมูลการสอบ (นักเรียนอาจจะยังไม่ได้เริ่ม)");
        return;
    }

    // อัปเดตสถานะเป็น FINISHED
    session.status = 'FINISHED';
    session.endTime = new Date().getTime();
    
    // บันทึก (คะแนนอาจจะได้ 0 หรือเท่าที่ Sync มาล่าสุด)
    // หมายเหตุ: หากระบบ Client ไม่ได้ส่งคำตอบมาเป็นระยะ คะแนนอาจจะไม่ครบถ้วน
    // แต่ Function นี้เน้นตัดจบการสอบ
    
    if (typeof saveAndRefresh === 'function') {
        await saveAndRefresh({
            action: 'updateExamSession',
            session: session
        });
    }
    
    // รีเฟรชหน้าจอ Monitor
    if(typeof window.refreshMonitor === 'function') {
        window.refreshMonitor();
    }
    
    alert("บังคับส่งเรียบร้อย");
};
// ในไฟล์ js/main.js เพิ่มต่อท้าย

// 1. เปิด Modal เพิ่มข้อมูล
window.openAddMaterialModal = function() {
    // เคลียร์ค่าเก่า
    document.getElementById('mat-input-title').value = '';
    document.getElementById('mat-input-link').value = '';
    document.getElementById('mat-input-img').value = '';
    
    // แสดง Modal
    document.getElementById('material-modal').classList.remove('hidden');
    document.getElementById('mat-input-title').focus();
};

// 2. บันทึกข้อมูล
window.saveMaterial = function() {
    console.log("🚀 Starting saveMaterial...");

    // 1. ดึงค่าจากฟอร์ม
    const titleEl = document.getElementById('mat-input-title');
    const linkEl = document.getElementById('mat-input-link');
    const subEl = document.getElementById('mat-input-subject');
    const imgEl = document.getElementById('mat-input-img');
    const typeEl = document.getElementById('mat-input-type');

    // ใช้ || "" เพื่อกันค่าเป็น undefined ตั้งแต่ต้นทาง
    const title = titleEl ? titleEl.value.trim() : "";
    const link = linkEl ? linkEl.value.trim() : "";
    const subId = (subEl && subEl.value) ? subEl.value : "general"; 
    const img = (imgEl && imgEl.value) ? imgEl.value.trim() : ""; 
    const type = (typeEl && typeEl.value) ? typeEl.value : "newtab"; 

    // 2. ตรวจสอบข้อมูลจำเป็น
    if(!title || !link) {
        alert("กรุณากรอกชื่อและลิงก์ให้ครบถ้วน");
        return;
    }

    // -----------------------------------------------------------------------
    // 🧹 DEEP CLEAN PROCESS (กระบวนการล้างข้อมูลแบบละเอียด)
    // -----------------------------------------------------------------------
    
    // สร้าง Array ใหม่รอไว้เลย (ตัดขาดจาก Reference เดิมที่อาจพัง)
    let cleanList = [];

    // ถ้ามีข้อมูลเดิม ให้วนลูปดึงเฉพาะตัวดีๆ มาเก็บ
    if (dataState.materials) {
        // แปลงเป็น Array ก่อนเสมอ (เผื่อเป็น Object)
        let rawList = Array.isArray(dataState.materials) ? dataState.materials : Object.values(dataState.materials);
        
        rawList.forEach((item, index) => {
            // เงื่อนไข: ต้องเป็น Object + มี ID + มี Title (ถ้าไม่มี ID ให้ข้าม หรือสร้างใหม่ถ้าจำเป็น)
            if (item && typeof item === 'object') {
                if (item.id && item.title) {
                    // Clone ข้อมูลมาใส่ Array ใหม่ (ป้องกัน Reference เดิม)
                    cleanList.push({
                        id: String(item.id), // บังคับเป็น String
                        subjectId: item.subjectId || "general",
                        title: item.title || "Untitled",
                        link: item.link || "#",
                        image: item.image || "",
                        type: item.type || "newtab"
                    });
                }
            }
        });
    }

    // 3. เตรียมข้อมูลใหม่ (รับประกันว่ามีครบทุก field)
    const newId = Date.now().toString(); 
    const newMat = {
        id: newId,
        subjectId: subId, 
        title: title,
        link: link,
        image: img, 
        type: type 
    };

    // เพิ่มข้อมูลใหม่เข้าไปในรายการที่คลีนแล้ว
    cleanList.push(newMat);

    // 4. เอาข้อมูลที่คลีนแล้ว กลับไปใส่ใน dataState
    dataState.materials = cleanList;

    console.log("✅ Data Cleaned. Total Items:", cleanList.length);
    console.log("New Item:", newMat);

    // -----------------------------------------------------------------------

    // 5. บันทึก
    try {
        // บันทึกลง LocalStorage
        saveToLocalStorage();
        
        // ส่ง Action ไปยัง Firebase (ตอนนี้ dataState.materials สะอาดแล้ว 100%)
        // เราส่ง dataState ทั้งก้อนผ่านการอ้างอิงภายใน function saveAndRefresh
        saveAndRefresh({ action: 'addMaterial', data: newMat }); 
        
        // ปิด Modal
        const modal = document.getElementById('material-modal');
        if(modal) modal.classList.add('hidden');
        
        // เคลียร์ค่าในฟอร์ม
        if(titleEl) titleEl.value = "";
        if(linkEl) linkEl.value = "";
        if(imgEl) imgEl.value = "";
        
        refreshUI();
        showToast("เพิ่มเนื้อหาเรียบร้อย", "success");
        
    } catch (e) {
        console.error("❌ Save failed:", e);
        alert("เกิดข้อผิดพลาด: " + e.message);
    }
};

// 3. ลบข้อมูล
window.deleteMaterial = function(id) {
    if(!confirm("ต้องการลบเนื้อหานี้ใช่หรือไม่?")) return;

    dataState.materials = dataState.materials.filter(m => m.id != id);
    
    saveToLocalStorage();
    saveAndRefresh({ action: 'deleteMaterial', id: id });
    
    refreshUI();
    showToast("ลบเรียบร้อย", "bg-red-600");
};// 1. ฟังก์ชันโหลดข้อมูล Materials จาก Sheet (เรียกตอนเปิดเว็บ)
window.loadMaterialsFromSheet = async function() {
    try {
        console.log("🔄 Loading materials from Sheet...");
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getMaterials' })
        });
        const json = await response.json();
        
        if (json.result === 'success') {
            dataState.materials = json.data; // อัปเดตเข้า State กลาง
            console.log("✅ Materials loaded:", dataState.materials.length);
            
            // สั่ง render หน้าจอใหม่ (ถ้าเปิดหน้า Admin Material อยู่)
            if(document.getElementById('admin-panel-material')) {
                 import('./ui-render.js').then(module => {
                     module.renderAdminMaterials();
                 });
            }
        }
    } catch (e) {
        console.error("Failed to load materials:", e);
    }
};

// 2. แก้ไขฟังก์ชันบันทึก (Save)
window.saveMaterial = async function() {
    const titleEl = document.getElementById('mat-input-title');
    const linkEl = document.getElementById('mat-input-link');
    const subEl = document.getElementById('mat-input-subject');
    const imgEl = document.getElementById('mat-input-img');
    const typeEl = document.getElementById('mat-input-type');

    const title = titleEl.value.trim();
    const link = linkEl.value.trim();
    
    if(!title || !link) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }

    showLoading("กำลังบันทึกลง Google Sheet..."); // แสดง Loading

    const newMat = {
        id: Date.now().toString(),
        subjectId: subEl.value || "general",
        title: title,
        link: link,
        image: imgEl.value.trim(),
        type: typeEl.value || "newtab"
    };

    try {
        // ยิงไป Google Script
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'addMaterial', data: newMat })
        });

        // อัปเดตหน้าจอทันที (ไม่ต้องรอโหลดใหม่เพื่อให้ลื่นไหล)
        if(!dataState.materials) dataState.materials = [];
        dataState.materials.push(newMat);
        
        // ปิด Modal และเคลียร์ค่า
        document.getElementById('material-modal').classList.add('hidden');
        titleEl.value = ""; linkEl.value = ""; imgEl.value = "";
        
        // รีเฟรชหน้าจอ
        import('./ui-render.js').then(module => module.renderAdminMaterials());
        
        showToast("บันทึกเรียบร้อย", "success");

    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        hideLoading();
    }
};

// 3. แก้ไขฟังก์ชันลบ (Delete)
window.deleteMaterial = async function(id) {
    if(!confirm("ต้องการลบใช่หรือไม่?")) return;

    showLoading("กำลังลบ...");

    try {
        // ยิงไป Google Script
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteMaterial', id: id })
        });

        // ลบออกจาก State ทันที
        dataState.materials = dataState.materials.filter(m => m.id != id);
        
        // รีเฟรชหน้าจอ
        import('./ui-render.js').then(module => module.renderAdminMaterials());
        
        showToast("ลบเรียบร้อย", "success");

    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        hideLoading();
    }
};
// ==========================================
// 🔐 ฟังก์ชันเปลี่ยนรหัสผ่านแอดมิน (พร้อม Modal)
// ==========================================
window.openChangePasswordModal = function() {
    document.getElementById('admin-password-modal').classList.remove('hidden');
};

window.closeChangePasswordModal = function() {
    document.getElementById('admin-password-modal').classList.add('hidden');
    // ล้างข้อมูลในช่องกรอกเมื่อกดปิด
    document.getElementById('setting-admin-user').value = '';
    document.getElementById('setting-admin-pass').value = '';
};

window.saveAdminCredentials = async function() {
    const newUser = document.getElementById('setting-admin-user').value.trim();
    const newPass = document.getElementById('setting-admin-pass').value.trim();
    
    if (!newUser || !newPass) {
        if(typeof showToast === 'function') showToast("กรุณากรอก Username และ Password ให้ครบถ้วน", "warning");
        else alert("กรุณากรอก Username และ Password ให้ครบถ้วน");
        return;
    }
    
    if (confirm(`ยืนยันการเปลี่ยนข้อมูลเข้าสู่ระบบเป็น\n\nชื่อผู้ใช้: ${newUser}\nรหัสผ่าน: ${newPass}\n\nใช่หรือไม่?`)) {
        
        // 1. อัปเดตข้อมูลในตัวแปรหลัก (dataState)
        dataState.adminUsername = newUser;
        dataState.adminPassword = newPass;
        
        // 2. บันทึกลง LocalStorage
        if(typeof saveToLocalStorage === 'function') saveToLocalStorage();
        
        // 3. ส่งข้อมูลขึ้น Firebase
        if(typeof saveAndRefresh === 'function') {
            await saveAndRefresh({ 
                action: 'updateAdminCreds', 
                username: newUser, 
                password: newPass 
            });
        }
        
        // 4. สั่งปิด Modal 
        window.closeChangePasswordModal();
        
        // 5. แจ้งเตือนสำเร็จ
        if(typeof Swal !== 'undefined') {
            Swal.fire('สำเร็จ!', 'เปลี่ยนข้อมูลเข้าสู่ระบบเรียบร้อยแล้ว', 'success');
        } else if(typeof showToast === 'function') {
            showToast("เปลี่ยนข้อมูลเข้าสู่ระบบเรียบร้อยแล้ว", "success");
        } else {
            alert("บันทึกข้อมูลเข้าสู่ระบบเรียบร้อยแล้ว");
        }
    }
};
// ==========================================
// 🖼️ จัดการรูปภาพสำหรับงานเก็บคะแนน
// ==========================================
window.previewTaskImageAccum = function(input) {
    if (input.files && input.files[0]) {
        // จำกัดขนาดไฟล์ไม่เกิน 1MB เพื่อไม่ให้ฐานข้อมูลหนักเกินไป
        if(input.files[0].size > 1024 * 1024) {
            alert("⚠️ ไฟล์รูปภาพมีขนาดใหญ่เกินไป (กรุณาใช้รูปขนาดไม่เกิน 1MB)");
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const container = document.getElementById('task-image-preview-accum-container');
            const img = document.getElementById('task-image-preview-accum');
            img.src = e.target.result; // แปลงเป็น Base64
            container.classList.remove('hidden');
        }
        reader.readAsDataURL(input.files[0]);
    }
};

window.removeTaskImageAccum = function() {
    document.getElementById('task-image-accum').value = '';
    document.getElementById('task-image-preview-accum').src = '';
    document.getElementById('task-image-preview-accum-container').classList.add('hidden');
};
// ==========================================
// ⚙️ การตั้งค่าระบบการศึกษาพื้นฐาน
// ==========================================
window.saveSystemSettings = async function() {
    const year = document.getElementById('setting-academic-year').value;
    const term = document.getElementById('setting-semester').value;
    
    if(!dataState.settings) dataState.settings = {};
    dataState.settings.academicYear = year;
    dataState.settings.semester = term;

    if(typeof saveToLocalStorage === 'function') saveToLocalStorage();
    
    if(typeof saveAndRefresh === 'function') {
        await saveAndRefresh({ action: 'updateSettings', settings: dataState.settings });
    }
    
    if(typeof Swal !== 'undefined') Swal.fire('สำเร็จ', 'บันทึกการตั้งค่าระบบเรียบร้อย', 'success');
    else alert("บันทึกการตั้งค่าระบบเรียบร้อย");
};

// ==========================================
// 👥 ระบบนำเข้าและอัปเดตนักเรียนด้วย CSV
// ==========================================
window.downloadStudentCSVTemplate = function() {
    const classId = document.getElementById('import-student-class').value;
    if(!classId) return alert("กรุณาเลือกห้องเรียนก่อนดาวน์โหลดแม่แบบครับ");

    const cls = dataState.classes.find(c => c.id == classId);
    // ดึงเด็กเดิมที่มีอยู่ในห้องนั้นมาให้ด้วย เพื่อให้แก้ข้อมูลได้เลย
    const students = dataState.students.filter(s => s.classId == classId).sort((a,b) => Number(a.no) - Number(b.no));

    let csvContent = "\uFEFFเลขที่,รหัสนักเรียน,ชื่อ-นามสกุล\n";

    if (students.length > 0) {
        students.forEach(s => {
            csvContent += `${s.no},${s.code},"${s.name}"\n`;
        });
    } else {
        // ถ้าห้องว่างเปล่า ให้ใส่ตัวอย่างไปให้ดู 1 บรรทัด
        csvContent += `1,65001,"เด็กชาย ตัวอย่าง ระบบ"\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Students_Template_${cls.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.processStudentCSVImport = async function() {
    const classId = document.getElementById('import-student-class').value;
    const fileInput = document.getElementById('import-student-file');

    if(!classId) return alert("กรุณาเลือกห้องเรียนเป้าหมาย");
    if(fileInput.files.length === 0) return alert("กรุณาเลือกไฟล์ CSV ที่ต้องการนำเข้า");

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        let successCount = 0;
        let updateCount = 0;

        // วนลูปอ่านข้อมูล (ข้ามบรรทัดแรกที่เป็น Header)
        for(let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if(!row) continue;

            // แยกด้วย Comma และจัดการกรณีมีเครื่องหมายคำพูดในชื่อ
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if(cols.length < 3) continue;

            const no = cols[0].trim();
            const code = cols[1].trim();
            const name = cols[2].trim().replace(/"/g, ''); // เอาฟันหนูออก

            if(!no || !code || !name) continue;

            // 🔍 ค้นหาว่ารหัสนักเรียนนี้มีอยู่ในห้องนี้แล้วหรือยัง?
            const existingIndex = dataState.students.findIndex(s => s.code == code && s.classId == classId);

            if (existingIndex > -1) {
                // 🔄 เจอข้อมูลเดิม -> ทำการอัปเดต (Update)
                dataState.students[existingIndex].no = no;
                dataState.students[existingIndex].name = name;
                updateCount++;
            } else {
                // 🆕 ไม่เจอข้อมูล -> ทำการเพิ่มเด็กใหม่ (Insert)
                dataState.students.push({
                    id: `std_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                    classId: classId,
                    no: no,
                    code: code,
                    name: name
                });
                successCount++;
            }
        }

        // บันทึกและซิงค์ขึ้น Server
        if(typeof saveToLocalStorage === 'function') saveToLocalStorage();
        if(typeof saveAndRefresh === 'function') {
            await saveAndRefresh({ action: 'batchUpdateStudents', classId: classId });
        }

        fileInput.value = ''; // ล้างไฟล์ที่เลือก
        
        if(typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'นำเข้าสำเร็จ!',
                html: `✅ เพิ่มเด็กใหม่: <b>${successCount}</b> คน<br>🔄 อัปเดตข้อมูลเดิม: <b>${updateCount}</b> คน`,
                icon: 'success'
            });
        } else {
            alert(`นำเข้าสำเร็จ!\n✅ เพิ่มใหม่: ${successCount} คน\n🔄 อัปเดตข้อมูลเดิม: ${updateCount} คน`);
        }
        
        if(typeof refreshUI === 'function') refreshUI();
    };
    reader.readAsText(file);
};
// ฟังก์ชันคัดลอกชื่อตอนไปใส่ข้อด้านล่างทั้งหมดอัตโนมัติ
window.applySectionToBelow = function(btn) {
    // 1. หา container ของข้อคำถามนี้
    const currentItem = btn.closest('.question-item');
    if (!currentItem) return;

    // 2. ดึงค่าชื่อตอนที่พิมพ์ไว้
    const sectionValue = currentItem.querySelector('.q-section').value;
    
    // 3. วนลูปหาข้อสอบทุกข้อที่อยู่ "ถัดจาก" ข้อนี้ เพื่อนำชื่อตอนไปวางให้
    let nextItem = currentItem.nextElementSibling;
    let count = 0;

    while (nextItem) {
        if (nextItem.classList.contains('question-item')) {
            const sectionInput = nextItem.querySelector('.q-section');
            if (sectionInput) {
                sectionInput.value = sectionValue;
                count++;
            }
        }
        nextItem = nextItem.nextElementSibling;
    }
    
    // 4. แจ้งเตือนผลลัพธ์
    if (typeof showToast === 'function') {
        showToast(`นำชื่อตอนไปใช้กับ ${count} ข้อด้านล่างเรียบร้อยแล้ว`, 'success');
    } else {
        alert(`นำชื่อตอนไปใช้กับ ${count} ข้อด้านล่างเรียบร้อยแล้ว`);
    }
};