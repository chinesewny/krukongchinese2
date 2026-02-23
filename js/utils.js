import { dataState } from "./state.js";

export function getThaiDateISO() {
    // ดึงเวลาปัจจุบันตามโซนไทย (Asia/Bangkok)
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatThaiDate(dateString) { 
    if (!dateString) return "-"; 
    const date = new Date(dateString); 
    if (isNaN(date.getTime())) return "-"; 
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(date); 
}

export function calGrade(s) { 
    if(s>=80)return 4; if(s>=75)return 3.5; if(s>=70)return 3; if(s>=65)return 2.5; 
    if(s>=60)return 2; if(s>=55)return 1.5; if(s>=50)return 1; return 0; 
}

export function showToast(m,c,icon){ 
    const t=document.getElementById('toast-notification'); 
    if(!t) return;
    document.getElementById('toast-message').textContent=m; 
    
    const i = t.querySelector('i');
    if(i) i.className = icon || "fa-solid fa-circle-check text-2xl";

    const theme = c || "bg-gradient-to-r from-green-600 to-teal-600 border-green-400/50";
    t.className=`fixed bottom-10 left-1/2 -translate-x-1/2 text-white px-8 py-4 rounded-full shadow-2xl z-50 flex items-center gap-3 translate-y-20 opacity-0 font-bold border ${theme} toast-show`; 
    setTimeout(()=>t.classList.remove('toast-show'),3000); 
}

export function showLoading(text="กำลังประมวลผล...") {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) {
        document.getElementById('loading-text').textContent = text;
        overlay.classList.remove('hidden');
    }
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) overlay.classList.add('hidden');
}

export function updateSyncUI(text, color) {
    const statusIcon = document.querySelector('.fa-wifi');
    if(statusIcon) {
        statusIcon.className = color === 'green' ? "fa-solid fa-wifi" : "fa-solid fa-wifi text-red-400 animate-pulse";
        if(statusIcon.nextSibling) statusIcon.nextSibling.textContent = " " + text;
        statusIcon.parentElement.className = `text-xs text-${color}-400 font-bold transition-all`;
    }
}

// ==========================================
// ⭐ ฟังก์ชันคำนวณคะแนน (แก้ไข Error แล้ว) ⭐
// ==========================================
export function calculateScores(studentId, classId, tasks) {
    // 1. ดึงข้อมูล Class และ Subject
    const cls = dataState.classes.find(c => c.id == classId);
    const subject = cls ? dataState.subjects.find(s => s.id == cls.subjectId) : null;
    
    // Config คะแนนเต็มรายบท (ถ้าไม่มีให้เป็น 10)
    const scoreConfig = (subject && subject.scoreConfig) ? subject.scoreConfig : Array(20).fill(10);

    // กรองเฉพาะงานของห้องนี้
    const classTasks = tasks.filter(t => t.classId == classId);
    
    // ตัวแปรเก็บคะแนนส่วนต่างๆ
    let midtermRaw = 0;   
    let specialMid = 0;   
    let finalRaw = 0;     
    let specialFinal = 0; 

    // ตัวแปรสำหรับคำนวณคะแนนเก็บรายบท
    let chapScores = Array(20).fill(0);     // คะแนนที่นักเรียนได้ (สะสม)
    let chapMaxScores = Array(20).fill(0);  // คะแนนเต็มรวมของงานในบทนั้น (สะสม)

    // --- 2. วนลูปงานทั้งหมด ---
    classTasks.forEach(task => {
        const scoreEntry = dataState.scores.find(s => s.studentId == studentId && s.taskId == task.id);
        let score = scoreEntry ? parseFloat(scoreEntry.score) : 0;
        if (isNaN(score)) score = 0;
        
        let taskMax = parseFloat(task.maxScore);
        if (isNaN(taskMax)) taskMax = 10;

        // แยกประเภทงาน
        if (task.category === 'accum') {
            // ⭐ ต้องมี Chapter เท่านั้นถึงจะนำมาคิดคะแนนเก็บ ⭐
            if (task.chapter && task.chapter.length > 0) {
                let chaps = [];
                if(Array.isArray(task.chapter)) chaps = task.chapter;
                else if(task.chapter) chaps = [String(task.chapter)];
                
                // กรองเฉพาะบท 1-20
                const validChaps = chaps.filter(ch => { 
                    const idx = Number(ch) - 1; 
                    return idx >= 0 && idx < 20; 
                });
                
                if (validChaps.length > 0) {
                    // หารคะแนนเฉลี่ยให้แต่ละบทที่งานนี้สังกัด
                    const scoreShare = score / validChaps.length;
                    const maxShare = taskMax / validChaps.length;
                    
                    validChaps.forEach(ch => { 
                        const idx = Number(ch) - 1; 
                        chapScores[idx] += scoreShare;   // บวกคะแนนที่ได้
                        chapMaxScores[idx] += maxShare;  // บวกคะแนนเต็ม
                    });
                }
            } 
            // ⚠️ ตัด else ทิ้ง เพื่อไม่ให้งานที่ไม่มีบทมารบกวนคะแนนเก็บ
        } 
        else if (task.category === 'midterm') { midtermRaw += score; } 
        else if (task.category === 'special_mid') { specialMid += score; } 
        else if (task.category === 'final') { finalRaw += score; } 
        else if (task.category === 'special_final') { specialFinal += score; }
    });
    // --- 2.5 คำนวณคะแนนจาก "ข้อสอบออนไลน์" มารวมด้วย ---
    const subjectExams = (dataState.exams || []).filter(ex => 
        ex.subjectId == (subject ? subject.id : null) && ex.category && ex.category !== 'none'
    );

    subjectExams.forEach(exam => {
        const scoreEntry = dataState.scores.find(s => s.studentId == studentId && s.taskId == exam.id);
        if (!scoreEntry || scoreEntry.score === null) return; // ข้ามถ้ายังไม่ได้สอบ

        let score = parseFloat(scoreEntry.score);
        if (isNaN(score)) score = 0;
        
        let examMax = exam.questions ? exam.questions.length : 10; // คะแนนเต็มใช้จำนวนข้อ
        
        if (exam.category === 'accum') {
            if (exam.chapter && exam.chapter.length > 0) {
                let chaps = Array.isArray(exam.chapter) ? exam.chapter : [String(exam.chapter)];
                const validChaps = chaps.filter(ch => { const idx = Number(ch) - 1; return idx >= 0 && idx < 20; });
                
                if (validChaps.length > 0) {
                    const scoreShare = score / validChaps.length;
                    const maxShare = examMax / validChaps.length;
                    validChaps.forEach(ch => { 
                        const idx = Number(ch) - 1; 
                        chapScores[idx] += scoreShare;   
                        chapMaxScores[idx] += maxShare;  
                    });
                }
            }
        } 
        else if (exam.category === 'midterm') { midtermRaw += score; } 
        else if (exam.category === 'final') { finalRaw += score; } 
    });

    // --- 3. คำนวณ Scaling (เทียบบัญญัติไตรยางศ์) ---
    for(let i=0; i<20; i++) {
        const configMax = scoreConfig[i] || 10; 
        const totalTaskMax = chapMaxScores[i];

        if (totalTaskMax > 0) {
            let scaledScore = (chapScores[i] / totalTaskMax) * configMax;
            
            if (scaledScore > configMax) scaledScore = configMax;
            
            chapScores[i] = scaledScore;
        } else {
            chapScores[i] = 0;
        }
    }

    // --- 4. รวมคะแนนเก็บ (ประกาศตัวแปรตรงนี้เพื่อรวมยอด) ---
    // รวมเฉพาะผลลัพธ์จากบทเรียนเท่านั้น
    const accumTotal = chapScores.reduce((a, b) => a + b, 0);

    // --- 5. คำนวณกลางภาค ---
    let midtermTotal = midtermRaw;
    if (midtermRaw >= 10 && midtermRaw <= 12.5) {
        let effectiveHelp = Math.min(specialMid, 3); 
        let tempTotal = midtermRaw + effectiveHelp;
        if (tempTotal > 13) midtermTotal = 13;
        else midtermTotal = tempTotal;
    } else {
        midtermTotal = midtermRaw;
    }

    // --- 6. คำนวณปลายภาค ---
    let finalTotal = finalRaw + specialFinal;
    if(finalTotal > 30) finalTotal = 30; 

    // รวมสุทธิ
    const grandTotal = accumTotal + midtermTotal + finalTotal;

    return {
        accumTotal: accumTotal,    
        chapScores: chapScores,    
        midtermRaw: midtermRaw,    
        midterm: midtermTotal,     
        final: finalTotal,
        total: grandTotal
    };
}
// js/utils.js

export function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // ลดขนาดถ้าความกว้างเกิน maxWidth
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // คืนค่าเป็น Base64 แบบ JPEG
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}