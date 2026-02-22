// js/config.js

// 🟢 1. การตั้งค่า Firebase (จากที่คุณให้มา)
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAZPONKvSWeURM3kvJKVlnZfmHQnOJHz9I",
  authDomain: "chineseclass-by-krukong.firebaseapp.com",
  // databaseURL จำเป็นสำหรับ Realtime DB แต่ Firestore จะดูที่ projectId เป็นหลัก (ใส่ไว้ไม่เสียหายครับ)
  databaseURL: "https://chineseclass-by-krukong-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chineseclass-by-krukong",
  storageBucket: "chineseclass-by-krukong.firebasestorage.app",
  messagingSenderId: "806456159848",
  appId: "1:806456159848:web:402ab1ea71aebd73ecd5dd",
  measurementId: "G-9NT2B088RH"
};

// 🔴 2. URL ของ Google Apps Script (สำคัญมาก!)
// คุณต้องนำ URL ที่ได้จากการ Deploy Web App ใน Google Script มาใส่ตรงนี้
// ตัวอย่าง: "https://script.google.com/macros/s/AKfycb.../exec"
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwQNjMSE06u5xO4dtyipa5P-YzoaicppubdwlUgMpaX4L4TUjk3-xY2PRnzhS42AxZe/exec"; 

// 🔵 3. ตารางเวลาเรียน (Config เดิม)
export const PERIODS = [
    { p: 1, start: "08:30", end: "09:20" }, 
    { p: 2, start: "09:20", end: "10:10" }, 
    { p: 3, start: "10:10", end: "11:00" },
    { p: 4, start: "11:00", end: "11:50" }, 
    { p: 5, start: "11:50", end: "12:40" }, 
    { p: 6, start: "12:40", end: "13:30" },
    { p: 7, start: "13:30", end: "14:20" }, 
    { p: 8, start: "14:20", end: "15:10" }
];