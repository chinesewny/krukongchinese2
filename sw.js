const CACHE_NAME = 'chinese-class-v3'; // เปลี่ยนเวอร์ชั่นเพื่อบังคับอัปเดต cache ใหม่
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/main.js',
  './js/utils.js',
  './js/api.js',
  './js/ui.js',
  // 'https://cdn.tailwindcss.com',  <-- ลบบรรทัดนี้ออก เพราะ CDN บล็อกการโหลดผ่าน SW
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.js',
  'https://cdn.jsdelivr.net/npm/@sweetalert2/theme-dark@4/dark.css'
];

self.addEventListener('install', (e) => {
  // บังคับให้ SW ตัวใหม่ทำงานทันที (Skip Waiting)
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // ใช้ try-catch หรือ addAll แบบปกติ แต่ถ้าไฟล์ไหน error จะไม่พังทั้งหมด
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  // ลบ Cache เก่าทิ้งเมื่อมีการอัปเดตเวอร์ชั่น
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim(); // เข้าควบคุมหน้าเว็บทันที
});

self.addEventListener('fetch', (e) => {
  // กรอง request ที่ไม่ใช่ http/https (เช่น chrome-extension://)
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then((res) => {
      // ถ้ามีใน cache ให้ใช้ใน cache, ถ้าไม่มีให้โหลดใหม่
      return res || fetch(e.request).catch(() => {
          // กรณี Offline และหาไฟล์ไม่เจอ (อาจจะ return หน้า fallback ถ้าต้องการ)
      });
    })
  );
});
