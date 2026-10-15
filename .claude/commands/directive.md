---
description: CEO direktifini ajan takımı pipeline'ından geçir (triage → audit → clarify → plan → build → review → record)
---

CEO şu direktifi verdi: $ARGUMENTS

Pipeline'ı sırayla uygula. Her aşama sonunda direktif dosyasındaki `durum:` alanını güncelle.

## 0. Hazırlık
- Direktif için kebab-case bir slug üret.
- `.context/lessons/` içindeki tüm dersleri oku; bu direktifle ilgili olanları not et.
- `.context/directives/_template.md` şablonunu kopyalayarak `.context/directives/<slug>.md` oluştur, direktif metnini ve tarihi yaz.

## 1. Triage
Ağırlığı belirle:
- **hafif** (tek dosya, net iş, <30 dk): pipeline'ı atla, işi doğrudan yap, reviewer ajanıyla incelet, dosyayı `durum: done` yapıp bitir.
- **orta/ağır**: devam et.

## 2. Audit
`cto` ajanını başlat: direktifi ve ilgili ders notlarını ver, etki alanı + riskler + açık sorular raporunu al. Direktif ağırsa (yeni modül, stack kararı, sistemler arası arayüz) `architect` ajanını da paralel başlat: bileşen sınırları + stack kararları raporunu al. Ürün belirsizliği varsa `cpo` ajanından kapsam + kabul kriterleri al. Raporları direktif dosyasına işle.

## 3. Clarify
CTO'nun açık soruları varsa CEO'ya sor (AskUserQuestion, en fazla 3 soru). Cevapları direktif dosyasına yaz. Soru yoksa geç.

## 4. Plan
Direktifi bağımsız görevlere böl (her görev tek ajanda bitecek boyutta). Her görev için: hedef, dokunulacak dosyalar, kabul kriteri, uygulanacak dersler. Görev listesini direktif dosyasına yaz ve CEO'ya kısaca göster.

## 5. Build
Proje git deposuysa build başlamadan direktif için `direktif/<slug>` dalını aç (her direktif kendi dalında çalışır, kendi PR'ı olur). Her görevi ayrı bir `engineer` ajanında çalıştır. Bağımsız görevleri paralel başlat. Görev tanımına ilgili dersleri ve kabul kriterini koy. Sonuç raporlarını direktif dosyasına işle.

## 6. Review
`reviewer` ajanını başlat (build'i yapan ajan DEĞİL): tüm değişiklikleri incelet. CRITICAL/HIGH bulgular varsa düzeltmeyi yeni bir `engineer` ajanına yaptır ve tekrar incelet. Proje testliyse `qa` ajanını da çalıştır.

## 7. Record
- Bu direktiften çıkan kalıcı bir ders varsa `.context/lessons/<slug>.md` yaz (sorun → kök neden → kural formatında). Ders yoksa yazma.
- Önemli bir tasarım kararı alındıysa `.context/design/` altına gerekçesiyle yaz.
- Direktif dosyasını `durum: done` yap.
- CEO'ya tek paragraf özet ver: ne yapıldı, ne değişti, nasıl doğrulandı.

## 8. Ship
- CEO'ya sor: "Commit'leri atayım mı?" Onay gelmeden hiçbir commit atılmaz.
- Onay gelince: değişiklikleri GÖREV BAZINDA ayrı, anlamlı commit'lere böl (Türkçe conventional commit; tek dev commit yasak). Commit'ler `direktif/<slug>` dalına atılır.
- Commit'ler bitince CEO'ya son onayı sor: "Push edip PR açayım mı?" Onay gelince dalı push et ve direktif için PR aç (PR gövdesi: direktif özeti + görev listesi + doğrulama). Onay gelmezse dal lokal kalır.
