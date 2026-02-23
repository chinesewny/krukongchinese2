// js/firebase-service.js
let saveTimeout; 
let syncTimeout;

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { FIREBASE_CONFIG, GOOGLE_SCRIPT_URL } from "./config.js";
import { dataState, updateDataState, saveToLocalStorage, globalState, updateLocalState } from "./state.js";
import { updateSyncUI, showToast, showLoading, hideLoading } from "./utils.js";
import { refreshUI } from "./ui-render.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

// 🟢 หมวดหมู่ปกติ (ตัด exams ออก เพราะเราจะใช้ระบบหั่นไฟล์ให้มันพิเศษ)
const DB_KEYS = ["tasks", "scores", "students", "subjects", "classes", "attendance", "materials", "submissions", "returns", "schedules", "examSessions"];

// 🟢 ตั้งค่าจำนวนการหั่นไฟล์สำหรับ Exams
const EXAM_CHUNKS = 10; 
let examsDataArray = new Array(EXAM_CHUNKS).fill([]); // อาเรย์สำหรับพักข้อมูลที่หั่นแล้ว

export async function syncData() {
    //if (globalState.sheetQueue && globalState.sheetQueue.length > 0) {
     //   processSheetQueue();
       // return;
   // }

    updateSyncUI('Connecting (Firestore)...', 'yellow');

    // 1. โหลดข้อมูลหมวดหมู่ปกติ
    DB_KEYS.forEach(key => {
        const docRef = doc(db, "school_data", `wany_data_${key}`);
        onSnapshot(docRef, { includeMetadataChanges: true }, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites) return;
            if (docSnap.exists()) dataState[key] = docSnap.data().items || [];
            else dataState[key] = [];
            triggerUIRefresh();
        });
    });

    // 2. โหลดข้อมูล Exams (ดึงจาก 10 ไฟล์ย่อยมาประกอบร่างกัน)
    for (let i = 0; i < EXAM_CHUNKS; i++) {
        const docRef = doc(db, "school_data", `wany_data_exams_part_${i}`);
        onSnapshot(docRef, { includeMetadataChanges: true }, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites) return;
            
            if (docSnap.exists()) {
                examsDataArray[i] = docSnap.data().items || [];
            } else {
                examsDataArray[i] = [];
            }
            // นำทั้ง 10 ส่วนมารวมกลับเป็น Array เดียว
            dataState.exams = examsDataArray.flat();
            triggerUIRefresh();
        });
    }
}

// ฟังก์ชันหน่วงเวลาเพื่อป้องกัน UI กระตุกตอนโหลดทีละไฟล์
function triggerUIRefresh() {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        saveToLocalStorage();
        refreshUI();
        updateSyncUI('Online (Firestore)', 'green');
    }, 300);
}

export async function saveAndRefresh(payload = null) {
    if (payload) {
        try {
            updateLocalState(payload); 
            saveToLocalStorage();
            refreshUI();               
        } catch (e) {
            console.error("Local Update Error:", e);
        }
    }

    clearTimeout(saveTimeout);

    saveTimeout = setTimeout(async () => {
        try {
            updateSyncUI('Saving...', 'yellow');
            
            // 1. เซฟข้อมูลหมวดหมู่ปกติ
            const savePromises = DB_KEYS.map(key => {
                const docRef = doc(db, "school_data", `wany_data_${key}`);
                const rawData = dataState[key] || [];
                return setDoc(docRef, { items: rawData });
            });

            // 2. เซฟข้อมูล Exams (หั่นกลับเป็น 10 ไฟล์ย่อยเพื่อเซฟ)
            const exams = dataState.exams || [];
            const chunkSize = Math.max(1, Math.ceil(exams.length / EXAM_CHUNKS));
            
            for (let i = 0; i < EXAM_CHUNKS; i++) {
                const chunkDocRef = doc(db, "school_data", `wany_data_exams_part_${i}`);
                const chunkData = exams.slice(i * chunkSize, (i + 1) * chunkSize);
                savePromises.push(setDoc(chunkDocRef, { items: chunkData }));
            }

            await Promise.all(savePromises);
            updateSyncUI('Online (Saved)', 'green');

        } catch (error) {
            console.error("Save Error:", error);
            updateSyncUI('Save Failed', 'red');
            showToast("บันทึกไม่สำเร็จ: " + error.message, "error");
        }
    }, 100); 
}

// ==========================================
// 📦 ฟังก์ชัน Backup / Restore (Google Sheet)
// ==========================================
export async function backupToGoogleSheet() {
    if (!confirm("ต้องการสำรองข้อมูลปัจจุบันไปยัง Google Sheet หรือไม่?")) return;
    showLoading("กำลังส่งข้อมูลไป Google Sheet...");
    try {
        const payload = { action: "exportData", data: dataState };
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (json.status === "success") showToast("สำรองข้อมูลเรียบร้อย!", "success");
        else throw new Error(json.message || "Unknown error");
    } catch (error) {
        showToast("Backup Error: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

export async function restoreFromGoogleSheet() {
    if (!confirm("⚠️ คำเตือน: ข้อมูลจะถูกเขียนทับ\nยืนยันหรือไม่?")) return;
    showLoading("กำลังดึงข้อมูล...");
    try {
        const payload = { action: "importData" };
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (json.status !== "success") throw new Error(json.message);
        
        if(json.data.tasks) dataState.tasks = json.data.tasks;
        if(json.data.scores) dataState.scores = json.data.scores;
        if(json.data.students) dataState.students = json.data.students;
        if(json.data.subjects) dataState.subjects = json.data.subjects;
        if(json.data.classes) dataState.classes = json.data.classes;
        if(json.data.attendance) dataState.attendance = json.data.attendance;
        if(json.data.materials) dataState.materials = json.data.materials;

        // 🟢 เปลี่ยนวิธี Save ตอน Restore ให้แยกเซฟลง 7 ไฟล์เช่นเดียวกัน
        const savePromises = DB_KEYS.map(key => {
            const docRef = doc(db, "school_data", `wany_data_${key}`);
            const rawData = dataState[key] || [];
            return setDoc(docRef, { items: rawData });
        });
        
        await Promise.all(savePromises);
        saveToLocalStorage();

        alert("กู้คืนข้อมูลสำเร็จ!");
        location.reload(); 
    } catch (error) {
        showToast("Error: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

// ==========================================
// 🔄 คิวจัดการ Google Sheet (ปิดการใช้งาน Auto-sync)
// ==========================================
/* async function processSheetQueue() {
    if (globalState.isSendingSheet || globalState.sheetQueue.length === 0) return;
    globalState.isSendingSheet = true;
    updateSyncUI('Sync Sheet...', 'yellow');
    const item = globalState.sheetQueue[0]; 
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item)
        });
        globalState.sheetQueue.shift(); 
        saveToLocalStorage();
        if (globalState.sheetQueue.length > 0) {
            globalState.isSendingSheet = false;
            setTimeout(processSheetQueue, 1000);
        } else {
            globalState.isSendingSheet = false;
            updateSyncUI('Online (Firestore)', 'green');
        }
    } catch (error) {
        globalState.isSendingSheet = false;
        updateSyncUI('Sheet Error', 'red');
    }
}
*/