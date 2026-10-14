# issue-73 — Paylaşım 1/6: üyelik şeması, rol yardımcıları, RLS

durum: done
üst issue: #26
dal: direktif/issue-73
PR: https://github.com/Captain-jack0/QuestLog/pull/83 (ready — CI yeşil)

## Canlı ön koşul
- 2026-10-09: CEO canlıda (QuestLog / main PRODUCTION) `select count(*) from tasks t join projects p on p.id=t.project_id where t.user_id <> p.user_id` koştu → **0**.
- Migration canlıya merge ÖNCESİ CEO tarafından uygulanacak; `db push --dry-run` "upToDate" kaydı buraya yazılacak.

## Teftiş
- reviewer (statik): ONAY, yalnız 2 LOW (alan silmede FK set-null bekçiye takılabilir; üyelik select'teki `user_id = auth.uid()` dalı mutant üretemez).
- pgTAP yerelde koşulmadı (Docker Desktop çöküyor) → CI'da koşacak.
- Mutant kanıtı: 14/14 KIRMIZI; sharing_rls 71/71 PASS (yerel CLI 2.120.0).

## Sonraki dilimlere devredilen
- #74: v_hanging_threads / v_area_stats / v_running_timer user_id filtresi (issue yorumu).
- #75: sahiplik devri için bekçi tetikleyicisinin gevşetilmesi (issue yorumu).
