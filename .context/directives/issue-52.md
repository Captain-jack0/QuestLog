# Direktif: issue-52 — CI: runner imajını Ubuntu 26'ya taşı

- tarih: 2026-10-19
- durum: build

## Plan

- [x] Ubuntu 26.04 imajının GA olduğunu doğrula (runner-images deposundan teyit: `ubuntu-26.04`)
- [x] ci.yml'deki 4 işin runs-on değerini `ubuntu-26.04` yap
- [x] backup.yml'deki 1 işin runs-on değerini `ubuntu-26.04` yap
- [x] Değişiklikleri reviewer ile teftişe gönder (PASSED)
- [ ] Commit, push ve PR aç
- [ ] Etiketleri güncelle (crew-onay → crew-pr)
