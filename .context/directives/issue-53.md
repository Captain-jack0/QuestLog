---
slug: issue-53
durum: done
kaynak: https://github.com/Captain-jack0/QuestLog/issues/53
pr: https://github.com/Captain-jack0/QuestLog/pull/89
tarih: 2026-10-12
---

# iOS Safari: bottom sheet açıkken arka plan kayıyor

- Temel iOS kilidi main'de zaten vardı (e983c14); eksik iç içe sheet durumuydu. BottomSheet.tsx'te lockBody/unlockBody + sayaç.
- Test: BottomSheet.test.ts 3 yeni test; npm test 164/164, typecheck + lint temiz.
- Teftiş: ONAY (2 LOW not, PR gövdesinde).
- Açık: gerçek iPhone doğrulaması CEO'da.
