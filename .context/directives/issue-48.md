# issue-48 — Timer ayrılınca sunucuda saymaya devam ediyor

durum: done
dal: direktif/issue-48 (issue-74 üstünde; PR base main)
PR: https://github.com/Captain-jack0/QuestLog/pull/87 — #83, #85 önce merge edilmeli
migration: 20261011130000_timer_heartbeat.sql — canlıya UYGULANMADI (CEO); rpc_start_timer imzası 3→4 (p_beats default false)

## Teftiş
- 1. tur RET: HIGH pagehide reload'da ve diğer sekme/cihazda timer öldürüyor (x2); HIGH istemci testi yok
- 2. tur ONAY; test:db 336 (baseline rls 3/4/24 hariç yeşil), npm test 171/171

## Karar bekleyen
- (yok)

## CEO kararı
- 2026-10-11: pagehide yerine heartbeat çözümü onaylandı (pagehide eklenmeyecek).
- 2026-10-11: mobil pomodoro için D (dönünce sor) → uygulandı; teftiş 3. tur RET (sızıntı testi) → 4. tur ONAY; test:db 372, npm test 175/175; PR #87 güncellendi.
