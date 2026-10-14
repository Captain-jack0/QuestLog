---
konu: davranış değiştiren PR'da e2e koşulmadan teftiş onayı yok
---

PR #86 (#44) Today'deki hanging threads'i yalnız göreve çevirdi; birim ve DB testleri koşuldu, e2e koşulmadı. `e2e/smoke.spec.ts` paused projeyi Today'de beklemeye devam ettiği için CI e2e deterministik kırıldı, teftiş de ONAY vermişti (2026-10-12).

Uygula: kullanıcıya görünen davranışı değiştiren görevlerde engineer `npm run test:e2e`'yi lokalde koşar ve sonucu raporlar; reviewer, değişen davranışı doğrulayan e2e varsa güncellenip güncellenmediğini kontrol eder. e2e sonucu olmayan rapor teftişten geçmez.
