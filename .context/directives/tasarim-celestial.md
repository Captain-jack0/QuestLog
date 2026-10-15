---
slug: tasarim-celestial
durum: done
ağırlık: ağır
dal: direktif/tasarim-celestial (worktree: ../questlog-redesign)
tarih: 2026-10-13
---

# Direktif: Stitch "Celestial Cartographer" yeniden tasarımı

## Direktif Metni

CEO, Stitch'te ürettiği tasarımı (7 masaüstü ekranı + DESIGN.md; kaynak `Downloads/stitch_gamified_quest_tracker_dashboard`, repoda `docs/design/stitch/`) uygulamaya geçirmek istiyor; tasarımda yeni şeyler eklenmiş olabilir, eksikler tamamlanacak. Ek istekler:
- Giriş (sign in), kayıt (sign up) ve hakkında / landing (URL'nin ilk açtığı ekran) da bu tasarıma uygun hale getirilecek (Stitch'te yok).
- Tasarım dosyalarında arka plan yıldızları yok; bugünkü yıldız alanı korunup "galaksi izlenimi" verecek şekilde zenginleştirilecek.
- Tasarım dosyaları repoya konacak.
- Mobil ekran tasarımları yolda (CEO, 2026-10-13); gelince `docs/design/stitch/` altına eklenecek. Mobil kararlar (tab bar, TimerBar, Focus Deck) o zamana dek bekler.

Koruma (CEO ile 2026-10-13'te mutabık): untouched-first sıralama, Today Active / Paused & blocked mantığı, rol yetkileri, XP kuralları, WCAG AA (StatusChip testi), 44px hedefler, mevcut e2e. Tasarımda olup sistemde olmayan özellikler uydurma veriyle eklenmez, CEO'ya karar listesi olarak gelir. İş ekran ekran ayrı PR'lara bölünür.

## Uygulanacak dersler
- davranis-degisikligi-e2e: her PR'da `npm run test:e2e` lokalde; e2e seçicileri (metin/rol) tasarımla değişirse aynı PR'da güncellenir.
- yigin-pr-base-tuzagi: çok PR'lı iş → her PR base = main, gövdede "önce #X" uyarısı.
- (bellek) worktree iş bitince kaldırılır.

## Audit

### CPO (Elizabeth) — 2026-10-13
- 61 yeni öğe sınıflandı: **şimdi** (mevcut veriden): ayrı Threads ekranı (filtre/arama, çalışan timer kartı, settled sayısı, Context Preserved %), rozet ilerleme/kilitli önizleme (mevcut 10 rozet), alan seviyesi + XP çubuğu, alan kartında bekleyen/en eski/süre/sol-next step, haftalık alan dağılımı (süre), kalkan göstergesi (freeze_tokens), 12 hafta yoğunluk ızgarası, günlük XP/odak grafikleri, seviye kartı, uygulama içi XP kuralları listesi, due date (target_date) + P1–P3 (high/med/low eşlemesi), proje XP/süre/ilerleme, "Complete the project too?" istemi, micro-note, Quick Add ⌘K, rail'de In progress + timer'lar, gerçek breadcrumb, Login/Sign up/Landing, galaksi yıldız alanı.
- **sonra (ayrı issue):** rozet XP'si, unvanlar, yeni rozetler, Celebrate, shield kullanım günü, durum geçişi geçmişi (#81), paylaşım arayüzü (#76/#77), ses (timer sesleri taslağı), sprint süre ayarı, snooze varsayılanları ayarı, import JSON, export Markdown, avatar, "Resurrection velocity".
- **hiç:** Avg Resume Delay, Equilibrium/radar, sahte metrik bantları ("Shame metric", "Orbit stability", "SYNCED V4.12"), Thread #id, Assign/Ping/Waiting on, public link, Quick Add otomatik kayıt, density/glow ayarı, sahte profil alanları, Force Sync, IndexedDB/"no telemetry"/"encrypted locally" metni (YANLIŞ), Stardate, sabit breadcrumb, UTC saat, "Est. focus sprint", faz lejantı, mikrofon.
- Yanlış iddialar: oluşturmaya +10 XP, rozet açıklamaları DB'den farklı, tutarsız seviyeler. Kural: hiçbir sayı/isim sabit gönderilmez.
- Dil: kozmik dil görsel/süs ve micro üst etiketlerde; başlık/buton metni sade "captain's log". Quest terimi yalnız oyun sekmesinde; nesneler task/project/thread.
- MVP K1–K10: tema+galaksi, auth/landing, kabuk (rail 5 öğe, mobil 5 slot), Today, Threads, Areas, Project detail, Quests (Progress birleşik), Settings, Quick Add.
- Açık sorular: (1) Progress+Quests birleşsin mi (öneri evet), (2) rozet XP/unvan bu teslimatta mı (öneri hayır, ayrı gamification direktifi), (3) paylaşım arayüzü bu işte mi (öneri hayır, ayrı issue; public link hiç).


### CTO (Barbossa) — 2026-10-13
- DESIGN.md düzyazısı mevcut token'larla birebir aynı; front-matter ve code.html'deki M3 paleti (surface=zemin, primary #aec6ff) Stitch'in kendiliğinden ürettiği — **içe alınmaz**. Eksik token: `--surface-2` (#1A2C63 / #FFF), glow/gölge değişkenleri. Radius varsayılanı ezilmez, semantik adlar.
- Kırılma: e2e yalnız mobil projelerde (masaüstü rail kapsamsız → masaüstü Playwright projesi eklenmeli). Korunacak erişilebilir adlar tablosu (Login 'Create account' tekliği, '+ New', link 'Areas/Today/Settings', region 'Paused & blocked', 'Pick up to 3', toast '+N ✨', 'Running timers', '1/1 done', /projects/ href sayımı…). Breadcrumb/üst bar/rail linkleri strict-mode ihlali riski.
- AA: tasarımın beyaz metinli primary butonu (~3.2:1) ve parlak alert/success çip metni geçmez → buton `text-paper`, çiplerde `*-ink`. `focus-ring.test.ts` outline-none yasak (Stitch'te 13 tane).
- CSP: Google Fonts/Material Symbols/Tailwind CDN alınmaz. Inter self-host (800 ağırlığı eklenir). İkonlar: ~30 Material Symbols SVG path'i tek `Icon.tsx`. Mikrofon Permissions-Policy'ye takılır; avatar img-src'ye takılır.
- Galaksi: `body::after` ikinci statik katman (nebula gradyanları), fixed, reduced-motion korumalı, canvas/JS yok. backdrop-filter yalnız sabit bar/modal.
- #56 base'te (PR #95). #57 PR-1'e (token) katılsın. #76/#77 yeni tasarımdan sonra. #67 çakışmaz.
- Öneri sırası: PR-1 token+tipografi+Icon (#57'yi kapatır) → PR-2 masaüstü kabuk → PR-3 galaksi → ekran ekran (Today, ProjectDetail, Areas, Progress+Quests, Threads, Settings, Login/Landing) → sonra #76/#77.
- Açık sorular: (1) "+N ✨" ve ekran metinleri korunsun mu (öneri evet), (2) AA tasarıma karşı kazansın mı (öneri evet), (3) Login/Landing token'lardan türetilsin, CEO önizlemede onaylasın (öneri evet).


### Designer (Tia Dalma) — 2026-10-13
- Token: mevcutlar korunur; yeni `--surface-raised` (Q 26 44 99 / C #FFF+float gölge), `--surface-sunken` (Q 3 12 42 / C = paper; gri seçilirse muted AA altına düşer), `shadow-float`, `shadow-glow-accent`, `shadow-glow-flame`. Card: shadow-sm → border-line hairline. Calm eşleri: glow yok, çalışan timer için accent ring.
- Tipografi = #57 rolleri; app içi başlık en fazla display-sm (30), display yalnız landing. Inter 800 kararı.
- Tasarım haklı: bugün Today ve AreaDetail'de next step küçük (resume-first ihlali) → next step = lead.
- Tasarım ihlalleri: thread kartında görev başlığı ve Drop yok (korunur), bayatlık turuncu/uyarı tonunda, utandırıcı metinler, yanlış iddialar, ikon-only butonlarda aria-label, dev blur div'leri.
- IA: Threads ayrı route (useHangingThreads, yeni veri yok); Quests Progress'e katılsın. Mobil kararları mobil tasarımı bekler (tab bar slotları, Focus Deck vs TimerBar, in-progress çipi, alt boşluk).
- Login: tek kart, üstte Sign in | Create account segmenti, LogoMark. Landing: bölüm yapısı korunur, "second clock" metni yanlış (3 paralel timer var). Galaksi: `body::after` statik katman (asal tile'lı yıldızlar, saman yolu bandı, flame nebula), opsiyonel twinkle reduced-motion'da kapalı, Calm'da kapalı.
- İkon: primeicons (mevcut) ya da lucide-react; Material Symbols font değil. (CTO: ~30 Material SVG path'i tek Icon.tsx.)
- PR dilimleri: token → ikon → shell → galaksi+login+landing → Today → Project → Areas → Progress(+Quests) → Settings → Threads. (c) işleri ayrı backlog.

### Mobil tasarımlar (2026-10-13, `docs/design/stitch/questlog_mobile_*`)
- Tab bar 5 sekme: Today · Threads · Areas · Progress · Settings — CEO'nun IA kararıyla birebir. Tasarımda **"+" Quick Add sekmesi yok**; yakalama Today'deki capture bar ve Threads'teki "Quick stash" satırıyla (karar: Clarify'a bakın).
- Üst bar: logo (pusula) · streak · XP · avatar. Alt: "Focus sprint" barı tab bar'ın üstünde (bizde 3'lü TimerBar yığını kalır, yeni dilde; pause/skip yok).
- Today: hero (selamlama, streak, kalkan, bugünkü XP), capture bar (mikrofon yok), focus kartları (Start 25m / Resume), Hanging threads kartları (durum · "Nd untouched", alan, Snooze/Update/Done). "Sector orbit path / momentum %83" sahte → alınmaz. Next step lead kuralı korunur.
- Threads: filtre çipleri, çalışan timer kartı, kartta where you left off + Pick it up (+15 yalnız stale), "Zero Guilt Ledger" (settled sayısı + Context Preserved %; "Avg resurrection speed" alınmaz).
- Project detail: geri + paylaş, çipler (alan, durum, P1), ilerleme/XP/süre/target date, resume deck (Launch focus, Micro-note), görevler, "All open tasks finished" kartı (T2'de), expedition log. "Streak Orbit 6d / Pace Mode Hyper" alınmaz.
- Areas: alan kartı + seviye halkası (L8) + bekleyen sayısı + where you left off + süre + Resume; 2'li küçük kartlar; "Shared with me" (paylaşım UI işi, sonra); haftalık dağılım. Üst metrik bandı (100% synchrony…) alınmaz.
- Progress (mobil): seviye kartı, streak + kalkan, 90 gün ızgarası, haftalık XP, odak eğrisi, alan seviyeleri, rozet rafı; Quests (mobil) rozet listesi Progress içinde/altında. "Shame index", rozet +XP, unvan/tier alınmaz.
- Settings: profil (avatar yok), görünüm (Quest/Calm), digest, push, stale eşiği, export JSON, çıkış. Ambient ses, glow kaydırıcısı, sprint süreleri, auto-saving, "Cloud orbit sync", export Markdown → sonra/hiç (Clarify).

## Clarify

CEO kararları (2026-10-13):
- Navigasyon: Today · Threads · Areas · Progress · Settings (+ Quick Add). Threads ayrı ekran; Quests içeriği (seviye, rozet, XP kuralları) Progress'e katılır.
- İkonlar: tasarımdaki ~30 Material Symbols ikonunun SVG path'i tek `Icon.tsx` (Apache-2.0), yeni bağımlılık yok, font değil.
- Ana buton: dolu accent, metin `text-paper` (AA).
- Alan paleti: tasarımdaki 8 canlı renk yeni seçenek olur; mevcut alanların rengi değişmez.
- "Hiç" listesinden yalnız iki istisna: (1) "Stardate" küçük süs üst etiketi olarak, yanında gerçek yerel tarih; (2) veri kartında doğru metin: "Your data lives in your account — export anytime." Diğer "hiç" maddeleri alınmaz.
- Varsayılanlar (itiraz yok): AA tasarıma karşı kazanır; "+N ✨" ve test-bağlı ekran metinleri korunur; rozet XP'si, unvanlar, paylaşım UI (#76/#77), sesler, import bu işe girmez; "Complete the project too?" T2 task'ında; Login/Landing token'lardan türetilir, CEO önizlemede onaylar; landing başlıkları Inter (serif kalkar).
- Tarih/saat biçimi şimdilik İngilizceye (en-US) sabit (CEO, 2026-10-13); dil desteği sonra ayrı iş.
- Mobil tasarımlar geldi (2026-10-13). Quick Add (mobil): tasarımdaki gibi — Today üstünde yazma kutusu + Threads'te "Quick stash" satırı mevcut Quick Add sheet'ini açar; alt menüde "+" sekmesi kalkar (5 sekme); diğer ekranlardan üst bardaki "+" ile. Masaüstünde ⌘K/Ctrl+K.

## Görevler

Her dilim ayrı dal + ayrı PR, base = main (yigin-pr-base-tuzagi). Her PR: lint/typecheck/test/e2e lokalde yeşil (davranis-degisikligi-e2e), korunacak erişilebilir adlar tablosu (CTO raporu) bozulmaz, bağımsız reviewer teftişi, öncesi/sonrası ekran görüntüsü.

- [x] **PR-1 Temel token'lar + tasarım dosyaları** (designer): `docs/design/stitch/`; `--surface-raised`, `--surface-sunken`, `shadow-float`, `shadow-glow-accent/flame` (iki tema, R G B üçlüsü); tipografi rol token'ları (micro…display, tanım olarak — kullanım göçü PR-2'de); Inter 800; Card hairline; Button primary = dolu accent + text-paper; alan paletine 8 canlı renk. StatusChip/focus-ring/color-semantics testleri değişmeden yeşil. Ekran düzeni değişmez.
- [x] **PR-2 #57 tipografi göçü** (engineer, sonnet): 229 ham `text-*` → rol sınıfları, ham boyut yasağı lint kuralı; görsel fark yok. Fixes #57.
- [x] **PR-3 İkonlar** (engineer, sonnet): `Icon.tsx` (~30 Material SVG, aria-hidden, 1em, icon-* ölçeği), nav ve uygulama içi emoji ikonları → Icon; ikon-only butonlarda aria-label.
- [x] **PR-4 Masaüstü kabuk** (designer): SideNav (logo, streak + kalkan + günlük XP mini kartı, aktif öğe, In progress bölümü, Focus Deck = TimerBar'ın md+ yerleşimi), TopBar (breadcrumb yalnız detayda, Quick Add + ⌘K, avatar), Threads ve Progress rail sırası; mobil kabuk da bu PR'da: 5 sekmeli TabBar ("+" kalkar), üst bar (logo · streak · XP · "+" · avatar), TimerBar yeni dilde; masaüstü Playwright projesi.
- [x] **PR-5 Galaksi + Login/Sign up + Landing** (designer): `body::after` galaksi katmanı (reduced-motion, Calm'da kapalı); Login segmentli tek kart; Landing yeni dil, Inter başlıklar, "second clock" metni düzeltmesi; CEO önizleme onayı.
- [x] **PR-6 Today** (engineer): resume-first thread kartı (next step lead, görev başlığı ikincil, Drop korunur), focus kartında next step + birikmiş süre, Stardate süs etiketi + gerçek tarih.
- [x] **PR-7 Project detail** (designer): header (P1–P3, due date, ilerleme, proje XP, toplam süre), resume kutusu, görev grupları (in progress sabit / untouched-first / tamamlananlar daraltılmış), micro-note, timeline yeni dil (yerel saat).
- [x] **PR-8 Areas + AreaDetail** (engineer): alan kartı (seviye + XP çubuğu, bekleyen sayısı, en eski dokunuş, toplam süre, en eski ipliğin next step'i), haftalık alan dağılımı, proje kartında next step baskın.
- [x] **PR-9 Progress (+Quests)** (engineer): seviye kartı, XP kuralları kartı (`XP` sabitinden), yoğunluk ızgarası, günlük XP/odak grafikleri (çubuk yüksekliği hatası burada düzelir), alan seviyeleri, rozet rafı + streak rozet ilerlemesi, kalkan göstergesi.
- [x] **PR-10 Settings** (designer): mevcut ayarlar yeni dilde, Quest/Calm önizleme kartları, doğru veri metni.
- [x] **PR-11 Threads ekranı** (engineer): route + rail, alan filtresi, arama, çalışan timer kartı, settled sayısı, Context Preserved %.
- Teftişlerden çıkan backlog (2026-10-13, CEO kararı gerekenler işaretli):
  - **[issue #98 açıldı]** `progress_update` XP'sine öğe başına günlük tavan: aynı durumla Edit/micro-note her seferinde +8 veriyor (önceden de vardı; PR-7 ikinci bir kapı ekledi). Migration ister.
  - Toplam XP sunucu tarafı sum (RPC/view): `useTotalXp` PostgREST max_rows=1000'de kesilebilir.
  - `rpc_groom_stale` web'de hiç çağrılmıyor; +15 groom XP'si kazanılamıyor (UI vaatleri kaldırıldı). Bağlansın mı?
  - Timeline: yazar adı ve log'un görev adı (sorgu/RLS işi); durum geçişleri #81.
  - **[CEO kararı: ayrı iş, 2026-10-13]** Proje next step tutarlılığı: ProjectDetail resume kutusu en yeni log'u (boş next step'i "—") gösterir; AreaDetail ve Today focus kartı en yeni DOLU next step'i gösterir. Projede durum "In progress" yapılınca üç ekran farklı görünebilir. ProjectDetail de "en yeni dolu" kuralına mı çekilsin?
  - Snooze iyimser güncellemesinin (iki liste anahtarı) birim testi yok (PR-11 teftişi MEDIUM).
  - Renk seçici: eski pastelleri yalnız kullanılıyorsa göster, renk adları aria-label.
- Entegrasyon notları (dalları birleştirirken kontrol):
  - PR-10 mobil Save konumu (`bottom-[calc(76px…)]`, timer varken 164px) PR-5 ucundaki TabBar/TimerBar ölçülerine göre; PR-4 TimerBar'ı `bottom-[calc(64px+safe-area)]` yaptı — birleşince yeniden hizala.
  - Seri göstergesi: PR-9 `effectiveStreak` (Progress + Today); PR-4 TopBar/SideNav hâlâ ham `streak.current` → PR-6'da hepsi `effectiveStreak`.
  - `lib/xp.ts`, `gamification/queries.ts`, `Icon.tsx` PATHS birden çok dalda ekleme aldı → birleştirmede birleşim.
- Ayrı backlog (bu direktif dışı): **dil (locale) desteği** (tarih/saat ve metinler); paylaşım UI, T2 proje durumu + "Complete the project too?", timer pause/uzun mola/sesler, timeline durum geçişleri (#81), Quick Add S/M/L·P·#tag, unvanlar, rozet XP'si, kalkan geçmişi, import.

## Build Raporları

### PR-1 (designer)
- index.css: surface-raised/sunken + --shadow-float/glow-accent/glow-flame (iki tema); tailwind: renkler, boxShadow, 11 fontSize rolü; main.tsx Inter 800; Card hairline; Button primary dolu; AREA_COLORS 8 spektrum + 8 eski pastel; .prettierignore docs/design/stitch.
- Orkestratör doğrulaması: format/lint/typecheck temiz, npm test 216/216, build OK; e2e koşuldu (mobile-safari project-detail-overflow 1 hata, inceleniyor).

## Review

### PR-1 — 1. tur (Davy Jones): RET
- HIGH: dolu primary kontrastını koruyan test yok → `Button.test.ts` (iki tema ≥4.5, bg-accent + text-paper).
- MEDIUM: Today bekleyen iş kartlarında "Done ✓" dolu → ghost (resume-first, ekranda tek dolu buton).
- LOW: Button hover yorumu yanlış (Calm 6.91→6.31); `.btn-primary` kaldırma sahipsiz → CEO varsayılanıyla bu PR'da `.btn-primary` da dolu stile geçiyor; iki pembe (#FF7EB6/#F778BA) yakın, renk adları aria-label olarak — renk seçici iyileştirmesine not.
- Düzeltme: engineer (sonnet) — yeni ajan. contrast-test-utils.ts (StatusChip ayrıştırıcısı taşındı), Button.test.ts (3 test, kırılma kanıtlı), Today Done ghost, .btn-primary dolu, text-accent artıkları silindi. npm test 219/219.

### PR-1 — 2. tur (Davy Jones): ONAY
- Yalnız 3 LOW yorum düzeltmesi: index.css .btn-primary yorumunda "timer Start" → Stop; vite.config.ts css.include yorumu contrast-test-utils/Button.test'i de ansın; Button.tsx hover kontrast sayıları ≈6.47 (quest) / ≈6.31 (calm).
- Bilgi: ProjectDetail'de timer çalışırken "Add" + "Stop" iki dolu kontrol — CEO tutarlılık varsayılanının sonucu, kabul.
- e2e 1. koşu kirli (düzeltme ajanı koşu sırasında dosya yazdı → HMR). Temiz koşu: mobile (Chromium) 7/7 yeşil; mobile-safari 3/7 ("visible, enabled and stable" click zaman aşımı, PR-1'in dokunmadığı butonlarda da). Karşılaştırma: değişmemiş origin/main'de mobile-safari 5/7, aynı hata türü (parallel-timers, overflow kart kontrolleri) → yerel Windows WebKit kararsızlığı, PR-1 kaynaklı değil. Hakem CI (Linux WebKit, retries=1).
- 3 LOW yorum düzeltmesi orkestratör tarafından uygulandı (yorum-only).

## Sonuç

### PR-1 (2026-10-13)
Commit'ler (direktif/tasarim-celestial): 79cf008 docs tasarım dosyaları · 12899b9 token/tipografi/Inter 800 · 69590a7 dolu ana buton + kontrast testi · db697d9 kart hairline · dbe4536 alan paleti. Doğrulama: format/lint/typecheck temiz, npm test 219/219, build OK, e2e Chromium 7/7; mobile-safari yerel kararsız (main de aynı). Teftiş: 2. tur ONAY. Push edildi, PR: https://github.com/Captain-jack0/QuestLog/pull/97 (CI bekleniyor).

### Ship (2026-10-13)
PR'lar (base main, merge sırası): #97 (1/11 token) → #100 (2 tipografi, Fixes #57) → #101 (3 ikon) → #102 (4 galaksi+giriş+landing) → #103 (5 kabuk) → #104 (6 proje) → #105 (7 Progress) → #106 (8 Areas) → #107 (9 Settings) → #108 (10 Today, en-US) → #109 (11 Threads). Her gövdede "önce #… merge edilmeli". Zincir ucu: 301 birim test, e2e mobile 9/9 + desktop 1/1 (lokal, CI=1). Migration yok.

### Ek iş (CEO, 2026-10-13)
- PR-12 (`direktif/tasarim-celestial-12-gunluk`, #109 üstünde): Progress günlük XP/odak grafikleri + proje zaman çizelgesinde XP ve odak oturumu olayları.
- Issue'lar açıldı (crew-onay YOK, karar bekliyor): #110 rozet XP'si + unvanlar, #111 timer sesleri, #112 JSON içe aktarma. Paylaşım arayüzü mevcut #76/#77.
- Küçük tasarım farkları (Areas 2'li küçük kartlar, settled linki): CEO merge sonrası kendisi bakacak.
- PR-12 açıldı: #113 (önce #109). CI düzeltmesi: #106'ya env'siz test commit'i, #107–#109 rebase + force-with-lease. Tüm worktree'ler kaldırıldı (2026-10-13).
- #110, #112 kararları issue'lara işlendi; #111 crew-onay (zincir merge'ü sonrası).
- Ayrı iş listesi issue'lara dönüştü (2026-10-13, crew-onay yok): #114 next step tutarlılığı, #115 groom RPC, #116 toplam XP sunucu toplamı, #117 dil desteği (en+tr), #118 renk seçici, #119 snooze testi.
- Küçük tasarım farkları (Areas 2'li kartlar, settled linki): CEO tüm merge'ler bitince bakacak.
- Settled linki için issue açıldı: #126 (CEO: Threads içinde filtre, crew-onay eklendi). Areas 2'li kartlar için issue istenmedi.
- Kalan iki backlog maddesi issue oldu (2026-10-14, crew-onay, zincir önkoşullu): #121 görev→proje durumu + "Complete the project too?" kartı, #122 Quick Add S/M/L + P1–P3. #118 kararı: 16 renk ve iki pembe kalır, yalnız renk adları. #71 (#70 kopyası) kapatıldı.
