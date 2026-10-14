---
konu: birim testleri lokalde .env.local olmadan da geçmeli
---

Sorun: Celestial PR-8'de (#106) `Areas.test.ts`, `screens/Areas.tsx`'i import etti; o da `AuthProvider → lib/supabase.ts` zincirini yükledi. CI'da `VITE_SUPABASE_*` yok, modül yüklenirken "Missing VITE_SUPABASE_URL" fırlattı ve build adımı (vitest) düştü — #106'dan sonraki dört yığın PR da kırmızı oldu. Lokalde `.env.local` olduğu için hiç görülmedi (2026-10-13).

Kök neden: Test edilen bileşen, Supabase istemcisini import eden bir ekran dosyasında duruyordu; lokal ortam CI'dan farklıydı.

Kural: Bileşen testi yazılacaksa bileşen `queries`/`AuthProvider`/`supabase` import etmeyen saf bir modülde olmalı. Teslimden önce birim testleri `.env.local` geçici olarak kaldırılmış halde koş (CI'ı taklit). Yığın PR'larda alttaki dal düzeltilince üsttekiler `git rebase --update-refs` ile taşınır, her dal tek tek doğrulanır, `--force-with-lease` ile itilir.
