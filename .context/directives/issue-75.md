# issue-75 — Paylaşım 3/6: davet ve üyelik yönetimi (RPC + send-invite)

durum: done
üst issue: #26
dal: direktif/issue-75 (issue-74 üstünde; PR base main) — 10 Ekim'de yarıda kalan devriye işi 2026-10-11'de devralındı (ana dizindeki commit'siz kopya dokunulmadan bırakıldı)
PR: https://github.com/Captain-jack0/QuestLog/pull/88 — #83, #85, #86, #87 önce merge edilmeli
migration: 20261011140000_sharing_invites.sql (tarih #44/#48'den sonraya alındı) — canlıya UYGULANMADI (CEO); send-invite deploy + APP_URL/INVITE_FROM secret + "Confirm email" açık

## Teftiş
- 1. tur RET: HIGH link daveti iptal edilemiyordu (listeleyen RPC yok); MEDIUM doğrulanmamış e-posta ile kabul; 2 LOW
- 2. tur ONAY; sharing_invites 140/140, test:db 452 (baseline rls 3/4/24 hariç), mutant 16/16, npm test 169/169

## Açık LOW
- link davetlerine günlük tavan yok; display_name e-posta yerel kısmı
- send-digest auth.getUser() token'sız çağrılıyor olabilir (Settings test gönderimi 401?) — doğrulanmadı
