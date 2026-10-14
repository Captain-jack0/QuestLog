---
slug: issue-60
durum: done
kaynak: https://github.com/Captain-jack0/QuestLog/issues/60
pr: https://github.com/Captain-jack0/QuestLog/pull/120
tarih: 2026-10-14
---

# Proje silme (geri alınabilir) + projeden ayrılma

- Soft delete (`projects.deleted_at`), sahip RPC'leri, project_role/visible_since ile kök gizleme, silinmiş projede paylaşım kilidi, timer durdurma+ödeme; UI: kart butonu, Edit sheet altında sil/ayrıl, ad yazdırmalı onay, Undo toast.
- Migration 2026-10-14 CEO onayıyla canlıya uygulandı (supabase db push).
- Teftiş: 3 tur ONAY; tüm MEDIUM'lar (davet yolu, ayrılma yönlendirmesi, Undo a11y, otomatik odak) aynı PR'da kapatıldı; LOW'lar PR gövdesinde.
