---
slug: issue-68
durum: done
kaynak: https://github.com/Captain-jack0/QuestLog/issues/68
pr: https://github.com/Captain-jack0/QuestLog/pull/99
tarih: 2026-10-13
---

# Necromancer rozeti status_changed_at'ten okusun

- tasks/projects.status_changed_at + `stamp_status_changed_at()` trigger'ı (oturumlu kullanıcıda geri tarihleme engelli, service_role restore değeri korur); rpc_update_status Necromancer koşulu eski status_changed_at'i okuyor.
- Migration 2026-10-14 CEO onayıyla canlıya uygulandı (supabase db push).
- Teftiş: 1. tur RET (HIGH: #96 ile migration sürüm çakışması; HIGH: düzenleme formu damgayı atlıyordu; MEDIUM: geri tarihleme) → 2. tur ONAY. LOW açık: eski yedekten boş DB'ye restore'da status_changed_at ?? updated_at.
