# Direktif: issue-69 — sort_order sütunu düşürülsün (okuyan kalmadı)
- tarih: 2026-10-20
- durum: build

## Plan
- [x] Adım 1 PR (#124): istemciden sort_order yazımı kaldırıldı — MERGED
- [x] Adım 2 migration hazırla: drop column + index recreate
- [x] pgTAP testi ekle
- [x] Teftiş (GEÇTİ, MEDIUM yorum hatası düzeltildi, HIGH test eklendi)
- [ ] Commit ve PR aç
- [ ] CEO migration'u canlıya uygular (devriye işi DEĞİL)
- [ ] database.types.ts yeniden üret
- [ ] tasks/queries.ts `as Task` cast'i kaldır

## Notlar
- Migration geriye uyumlu DEĞİL (issue'da belirtilmiş)
- Adım 1 PR #124 merge + Vercel deploy sonrası çalıştırılmalı
- `as Task` cast'i ancak tipler yeniden üretildikten sonra kaldırılabilir
