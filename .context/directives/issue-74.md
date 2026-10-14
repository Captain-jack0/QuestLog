# issue-74 — Paylaşım 2/6: RPC ve tetikleyiciler rol-farkında

durum: done
üst issue: #26
dal: direktif/issue-74 (issue-73 üstünde; PR base main)
PR: https://github.com/Captain-jack0/QuestLog/pull/85 — #83 önce merge edilmeli

## Teftiş
- 1. tur RET: HIGH digest threads h.user_id ile süzülüyordu → çıkarılmış üyeye proje/alan adı sızıyordu
- 2. tur ONAY; LOW: digest testi limit 5 tavanında
- test:db 312 (baseline rls 3/4/24 hariç yeşil), sharing_rpc 78/78; mutant 45/48 (3 denk)

## Karar bekleyen
- Editörün doğrudan görev ekle/düzenle → sahibin proje updated_at güncellenmiyor (#76 yorumu)

## CEO kararı
- 2026-10-10: editör doğrudan ekle/düzenle → proje updated_at güncellenmez; seçenek (a) kabul (#76 yorumu).
