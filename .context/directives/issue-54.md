---
slug: issue-54
durum: done
kaynak: https://github.com/Captain-jack0/QuestLog/issues/54
pr: https://github.com/Captain-jack0/QuestLog/pull/92
tarih: 2026-10-12
---

# 375px yatay taşma → kart başlığı min-w-0

- Add butonu taşması ölçümle yeniden üretilemedi; CEO yorum üzerine TaskItem kart başlığı düzeltmesini istedi.
- TaskItem kart başlığı min-w-0 flex-1 sarmalayıcı + EditableText break-words.
- e2e 4/4 (Chromium+WebKit); düzeltmesiz kırmızı (47-53px), break-words'süz kırmızı (632-638px). npm test 161/161.
- Teftiş: 1. tur RET (break-words testsizdi) → 2. tur ONAY.
- Açık: uzun proje başlığında Move/Edit kesilmesi (yorumdaki 2. soru) kapsam dışı.
