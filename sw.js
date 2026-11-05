// =========================================================================
// ملف خادم الخدمة (Service Worker) الرسمي - نظام مطعم الآغا الملكي
// النسخة: 1.0.0
// الوظيفة: تمكين التثبيت الفوري (PWA)، تسريع التحميل، والعمل في وضع عدم الاتصال
// =========================================================================

const CACHE_NAME = 'al-agha-cache-v1';

// قائمة الملفات والموارد الأساسية المطلوب تخزينها مؤقتاً للتشغيل السريع
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. مرحلة التثبيت (Install Event) - تنزيل وتخزين الملفات الأساسية في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('⚡ [مطعم الآغا] جاري تخزين الملفات الأساسية في الكاش...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('تنبيه: تعذر تخزين بعض الموارد الخارجية مسبقاً، سيتم جلبها عند الطلب:', err);
      });
    }).then(() => {
      // تفعيل خادم الخدمة فوراً دون انتظار إغلاق التبويبات القديمة
      return self.skipWaiting();
    })
  );
});

// 2. مرحلة التنشيط (Activate Event) - تنظيف وحذف النسخ القديمة من الكاش
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('🧹 [مطعم الآغا] حذف ملفات الكاش القديمة:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // إحكام سيطرة خادم الخدمة على جميع النوافذ المفتوحة فوراً
      return self.clients.claim();
    })
  );
});

// 3. معالجة طلبات الشبكة (Fetch Event) - استراتيجية الشبكة أولاً مع الاحتياط للكاش
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // استثناء استعلامات قاعدة بيانات Supabase من الكاش لضمان وصول الطلبات اللحظية دائماً
  if (request.url.includes('supabase.co')) {
    return;
  }

  // بالنسبة لملفات الواجهة والصفحات: نحاول جلب أحدث نسخة من السيرفر أولاً
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // إذا كان الرد ناجحاً، نقوم بتحديث الكاش تلقائياً في الخلفية
        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // في حال انقطاع الإنترنت أو عدم وجود تغطية، يتم استرجاع الصفحة من الكاش المحلي
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // إذا كان الطلب لصفحة HTML ولم تتوفر، نفتح الصفحة الرئيسية المحفوظة
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});