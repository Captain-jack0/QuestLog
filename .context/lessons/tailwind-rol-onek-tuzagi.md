---
konu: Tailwind rol fontSize'ı + responsive önek → override ezilir
---

Sorun: PR-2 (#57, Celestial) tipografi rolleri `fontSize` içinde ağırlık / satır yüksekliği / harf aralığı da taşıyor. Landing'de `font-normal md:text-display-lg` yazılınca md+ ekranda rolün 800 ağırlığı geri geldi; `leading-*` de aynı şekilde ezildi (teftiş RET, 2026-10-13).

Kök neden: `md:text-<rol>` bir medya sorgusu içinde üretilir ve önek almamış `font-*` / `leading-*` / `tracking-*` kurallarından sonra gelir; özgüllük aynı olduğu için sonra gelen kazanır.

Kural: Bir rol responsive önekle verildiyse, korunmak istenen her override aynı önekle tekrar yazılır (`md:font-normal md:leading-tight`). Mümkünse rolü öneksiz kullan; responsive gerekiyorsa `*-mobile` + `md:` çiftinin ikisinde de override'ı ver. Teftişte derlenmiş CSS'e bakılır, kaynak sınıf dizesine değil.
