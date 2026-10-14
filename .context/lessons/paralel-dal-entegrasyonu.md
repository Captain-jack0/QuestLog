---
konu: paralel dalları zincire dizerken ortak kayıt dosyaları
---

Sorun: Celestial direktifinde (2026-10-13) PR-4/7/8/9/10 aynı tabandan paralel yürüdü. Zincire rebase ederken `Icon.tsx` PATHS nesnesi `mail`/`notifications` anahtarlarını iki daldan aldı; git çakışma göstermedi (farklı satırlar) ama TypeScript "multiple properties with the same name" verdi. `gamification/queries.ts` ve `lib/xp.ts` de birden çok daldan ekleme aldı.

Kök neden: Ortak "kayıt" dosyalarına (ikon haritası, query key'leri, XP sabitleri) her dal kendi eklemesini yapıyor; satır bazlı birleştirme anlamsal tekrarı yakalamaz.

Kural: Paralel ajanlara "eklemeden önce mevcut anahtara bak, çift anahtar ekleme" yaz. Her rebase'den sonra format + lint + **typecheck** + test + build koş, yalnız çakışma çıktısına güvenme. Çakışmayı birleşim (union) olarak çöz, sonra tekrarları ayıkla.
