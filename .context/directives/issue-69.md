# issue-69: sort_order sütununu düşür — Adım 1
durum: done
pr: https://github.com/Captain-jack0/QuestLog/pull/124
tarih: 2026-10-14

Adım 1: istemciden sort_order yazımı kaldırıldı (sütun not null default 0). Teftiş GEÇTİ (LOW: tasks/queries.ts `as Task` cast'i Adım 2'de kaldırılmalı).
Adım 2 açık: PR #124 merge + Vercel dağıtımından sonra drop migration + tip üretimi; issue'ya yeniden crew-onay gerekir. Canlıya migration CEO'da.
