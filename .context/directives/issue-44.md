# issue-44 — Hanging threads yalnız görev + özet e-postası iki başlık

durum: done
dal: direktif/issue-44 (issue-74 üstünde; PR base main)
PR: https://github.com/Captain-jack0/QuestLog/pull/86 — #83, #85 önce merge edilmeli
migration: 20261011120000_hanging_threads_tasks_digest_status.sql — canlıya UYGULANMADI (CEO), send-digest yeniden dağıtılmalı

## Teftiş
- 1. tur ONAY; test:db 318 (baseline rls 3/4/24 hariç yeşil), npm test 165/165

## Karar bekleyen
- MEDIUM: gruplama görev durumuna bakıyor; paused projedeki in_progress görev Active'te görünür — proje durumu da sayılsın mı?
- ItemTypeChip hep "Task" — kaldırılsın mı?

## CEO kararı
- 2026-10-11: projesi paused olan in_progress görevler hanging threads'te (Today + digest) alt bölümde "Paused" olarak gösterilsin. Görevlerin kendi durumu değişmez, yalnız gruplama/etiket. → uygulandı (blocked projeler de dahil), teftiş ONAY, PR #86 güncellendi
