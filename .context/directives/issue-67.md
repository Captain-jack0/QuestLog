---
slug: issue-67
durum: done
kaynak: https://github.com/Captain-jack0/QuestLog/issues/67
pr: https://github.com/Captain-jack0/QuestLog/pull/96
tarih: 2026-10-13
---

# Restore updated_at'i korusun

- rpc_restore_updated_at (skip_touch altında, yalnız service_role) + restore.mjs son geçiş ve doğrulama. Migration içerir; 2026-10-13 CEO onayıyla canlıya uygulandı (20261012120000_sharing_realtime ile birlikte).
- Yerel kanıt: main 407/407 satır sapıyor, dal 0. pgTAP 10/10.
- Teftiş: 1. tur RET (HIGH eski yedekte NOT NULL, MEDIUM test sırası), 2. tur ONAY.
- Yerel DB'de rls.test 3 kırık: yerel sapma, ilgisiz.
