module.exports = {
  apps: [
    {
      name: "storm",

      /*
       * نشغّل TypeScript بدون watch.
       * watch كان مفيدًا للتطوير فقط ويضيف عملًا غير ضروري.
       */
      script: "./node_modules/.bin/tsx",
      args: "src/index.ts",

      cwd: "/data/data/com.termux/files/home/storm",

      interpreter: "none",

      /*
       * تطبيق واحد فقط.
       * لا نشغل نسختين من Storm لأن Telegram bot
       * لا يحتاج process مزدوج لنفس الـtoken.
       */
      instances: 1,

      autorestart: true,

      /*
       * إذا انهارت العملية، انتظر 5 ثوانٍ ثم أعد تشغيلها.
       */
      restart_delay: 5000,

      /*
       * إذا استمر استهلاك الذاكرة فوق هذا الحد،
       * PM2 يعيد تشغيل العملية.
       */
      max_memory_restart: "512M",

      /*
       * لا تعيد تشغيل التطبيق إذا خرج آلاف المرات
       * بشكل سريع نتيجة مشكلة دائمة.
       */
      min_uptime: "10s",
      max_restarts: 20,

      /*
       * مهم جدًا:
       * لا file watching على جهاز الهاتف.
       */
      watch: false,

      /*
       * لا نحتاج cron restart.
       */
      cron_restart: false,

      /*
       * سجلات منفصلة.
       */
      out_file: "/data/data/com.termux/files/home/.pm2/logs/storm-out.log",
      error_file: "/data/data/com.termux/files/home/.pm2/logs/storm-error.log",

      log_date_format: "YYYY-MM-DD HH:mm:ss",

      /*
       * لا نرسل معلومات Git/VCS إضافية.
       */
      vizion: false,

      /*
       * وقت إعطاء التطبيق فرصة للإغلاق النظيف.
       */
      kill_timeout: 10000
    }
  ]
};
