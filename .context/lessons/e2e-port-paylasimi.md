---
konu: paralel worktree'lerde e2e yanlış sunucuyu test edebilir
---

Sorun: Celestial direktifinde (2026-10-13) birden çok worktree aynı anda çalışırken PR-3'ün e2e koşusu, PR-5 worktree'sinden kalmış vite sürecinin 5173 portunu dinlediği anda başlatılmak üzereydi. Ayrıca bir başka oturumun `supabase db reset`'i koşu ortasında yerel veritabanını sıfırladı ("Database error finding user").

Kök neden: `playwright.config.ts` portu 5173'e sabitliyor ve `reuseExistingServer: !process.env.CI` — yerelde portta HERHANGİ bir sunucu varsa yenisini açmadan onu kullanır, yani başka dalın kodunu test eder. Yerel Supabase de tüm oturumlarca paylaşılıyor.

Kural: Yerelde e2e'yi `CI=1` ile koş (port doluysa sessizce yeniden kullanmak yerine hata verir; retries=1 gelir). Koşudan önce `netstat -ano | grep ":5173 "` boş olmalı; koşu sırasında aynı worktree'ye yazan ajan çalıştırma (HMR). e2e'ler sırayla, tek seferde bir worktree. "Database error" / boş auth.users görürsen önce `docker ps` ile Supabase'in yeniden başlayıp başlamadığına bak.
