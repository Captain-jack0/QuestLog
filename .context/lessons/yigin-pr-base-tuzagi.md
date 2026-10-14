---
konu: yığın (stacked) PR base tuzağı
---

Alt dal PR'ı üst dalın branch'ını base alırsa ve üst PR önce merge edilirse, GitHub base'i otomatik main/dev'e çevirmeden alt PR eski dala merge edilebilir → commit ana dala hiç ulaşmaz, Fixes #N çalışmaz (football #40/#15, 2026-10-09).

Uygula: yığın dallarda PR base'ini her zaman varsayılan dal yap, gövdenin başına "önce #X merge edilmeli" uyarısı yaz. Diff üst PR merge olunca kendiliğinden daralır.
