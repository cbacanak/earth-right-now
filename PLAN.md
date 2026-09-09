# Earth Right Now — Plan

**Depo:** `earth-right-now` (çalışma adı)
Alternatif isim adayı: "What's happening" yönü. İsim son güne kadar
değişebilir, şimdi takılma. Alan adı müsaitliğini depo açmadan
önce kontrol et.

## 0. Ürün

Dünyada ve internette o anda olan olayları tek bir keşif deneyimine
çeviren interaktif dünya haritası.

**Asıl silah rabbit hole.** Bir olaya tıklayınca "bunun yakınında ne
var" sorusunun cevaplanması. Katman eklemek kolaydır, herkes yapar.
Olayları uzay ve zamanda birbirine bağlamak zordur — ürünün tek
gerçek savunması orası.

Bu yüzden inşa sırası tersten: önce mekanik, sonra kaynaklar.

## 1. Aşamalar

Her aşamanın kendi bitiş testi var. Test geçilmeden sonrakine geçilmez.

### Aşama 1 — Mekanik (1–2 hafta)
Anahtarsız, sunucusuz. Sadece EONET + USGS.

- Harita + olaylar
- Olaya tıklayınca detay
- **"Yakınında ne var"** — mesafe ve zaman yakınlığıyla ilişkili
  olayları listele
- "Şanslıyım / show me something" — aynı motorun rastgele tohumlu hali

**Test:** Kendin oynarken bir olaydan diğerine geçmek istiyor musun?
İstemiyorsan mekanik tutmamıştır ve on kaynak da kurtarmaz. Dur.

### Aşama 2 — Yayın ve dağıtım (1 hafta)
- Yayınla
- Bluesky + Mastodon botu (bkz. §5)

**Test:** 3–4 hafta. Bot hesabı organik takipçi alıyor mu, siteye
tıklama geliyor mu.

### Aşama 3 — Katmanlar (açık uçlu)
Anahtar gerektiren kaynaklar + proxy. Ancak Aşama 2 sinyal verirse.

### Aşama 4 — Zaman makinesi
En pahalı özellik: geçmişi göstermek geçmişi saklamak, o da
veritabanı demek. En sona.

## 2. Veri kaynakları

### Aşama 1'de kullanılacak (anahtarsız, tarayıcıdan doğrudan)

| Kaynak | Kapsam | Not |
|---|---|---|
| **NASA EONET** | yangın, volkan, fırtına, deniz/göl buzu | Anahtar gerektirmeyen NASA uçlarından. Tek kaynakta üç katman. |
| **USGS** | deprem | M2.5+, son 7 gün. GeoJSON, CORS açık. Yarıçap büyüklükle ölçekleniyor. |

EONET tek başına katmanların büyük kısmını veriyor. Aşama 1 için
başka kaynağa gerek yok.

**USGS pencere kararı (Aşama 1'de alındı):** Son 24 saat yerine son
7 gün. 24 saatlik akış çoğunlukla Kaliforniya mikro depremlerinden
oluşuyor ve ızgaranın geri kalanı boş kalıyor. 7 gün + M2.5 eşiği
haritayı dünya çapında dolduruyor. EONET açık olaylar için 60 gün.

### Aşama 1 durumu (9 Eyl 2026)

Kod yazıldı ve `main`'e girdi (PR #4). İki kaynak, anahtarsız,
sunucusuz, kapsam dışı olanlar PR'da listelenmiş. Rabbit hole motoru
kuruldu: mesafe kapı, zaman ağırlık, kesim ~1.500 km, komşular haritada
bağlantı çizgisi, yakında bir şey yoksa en yakın üç yine gösteriliyor.
"Show me something" en az iki komşusu olan olayları tercih ediyor.

**Kapsam notu:** Paylaşılabilir URL hash Aşama 1'de eklendi; teknik
olarak Aşama 3 konusuydu. Zararsız, geri alınmıyor, ama kayıt için.

**Test henüz yapılmadı.** Kod sahte veriyle doğrulandı, canlı API ile
değil. Aşama 1'in asıl testi kodla ilgili değil — "bir olaydan diğerine
geçmek istiyor musun?" sorusunu sadece kullanıcı canlı veriyle
cevaplayabilir. Sıradaki üç adım: Pages'i `main` için aç, iki durum
noktasının yeşile döndüğünü gör, on dakika oyna ve cevabı CHANGELOG'a
yaz.

### Aşama 3'e ertelenen (anahtar ve/veya proxy gerektirir)

- **NASA FIRMS** — uydu yangınları (MAP_KEY)
- **GDACS** — büyük afetler
- **GDELT** — küresel haber olayları (hacim yüksek, işleme gerekir)
- **N2YO** — uydu konumları (anahtar; doğrula)
- **OpenAQ** — hava kalitesi (v3 anahtar istiyor; doğrula)
- **Wikimedia EventStreams** — düzenlemeler (anahtarsız, ama
  Aşama 1'in coğrafi odağına uymuyor)

### Elenenler

- **GBIF** — canlı değil. Kurumların yayınladığı veri setlerini
  toplayan bir araştırma havuzu; "bugün gözlendi" senaryosu bu
  kaynağın çalışma şekline uymuyor. Canlıya yakın olan eBird
  anahtar istiyor ve kullanım şartları kısıtlayıcı.
- **Yıldırım** — küresel gerçek zamanlı ücretsiz kaynak yok.
  Topluluk projeleri kısıtlı şartlarla, ticari olanlar pahalı.
- **NOAA/NWS** — sadece ABD. Küresel üründe tek ülke uyarısı
  tutarsızlık yaratır.

## 3. Mimari

**Aşama 1–2:** tamamen istemci tarafı, statik barındırma, maliyet ~0.
**GitHub Pages yeterli** — akışlara doğrudan tarayıcıdan bağlanılıyor,
anahtar yok, sunucu yok. İçerik dağıtım ağı üzerinden çalıştığı için
site zaten her yerden açılır.

**Aşama 3'ten itibaren değişiyor:** API anahtarı tarayıcı koduna
konulamaz, kaynak koddan okunur. Anahtar isteyen her kaynak bir ara
sunucu gerektirir. O noktada **Cloudflare Pages'e taşı** — aynı statik
siteyi barındırırken yanında sunucusuz fonksiyon çalıştırabiliyor,
taşıma bir saatlik iş. Bu kararı Aşama 3'e kadar erteliyoruz; o zamana
kadar sunucu yok.

## 4. Tasarım dili

**Referans: enstrümanlar.** Sismograf şeridi, kalkış panosu, radar
ekranı. Konu gerçek zamanlı sinyal olduğu için bu dil süs değil.

**Apple HIG kullanılmayacak** — bu üründe gezinme/kontrol/form yok,
uygulanacak yüzey yok. SF Pro web'e taşınamıyor. iOS görünümlü bir
sayfa paylaşıldığında "uygulama ekran görüntüsü" gibi durur.

HIG'den alınan tek ilke: **deference** — arayüz geri çekilir.

**Curalis'in tasarım sistemi taşınmayacak.** O bir kayıt uygulamasıydı,
bu bir gösterge.

**Cesaret tek yerde: harita.** Gerisi sessiz.

Harita gerçek kıta çizimi değil, ızgara — enstrüman referansı buradan
geliyor ve olayları öne çıkarıyor.

## 5. Sosyal dağıtım

Kanal problemine pasif cevap. Bot her gün çalışır, kitle birikir.

**Altın kural: ham besleme botu görmezden gelinir.** Her olayı
paylaşan hesap gürültüdür. Bot nadiren konuşacak ve sadece kayda
değer olduğunda: "bu bölgede son 12 yılın en büyüğü" bir hikâyedir,
"4.2 büyüklüğünde deprem" değildir. Eleme mantığı ürünün parçası.

### Bluesky + Mastodon — önce burası
Bot dostu, ücretsiz, maliyetsiz. Aşama 2'de başla.

### X — sonra, dikkatli
- Anlamlı ücretsiz katman yok. Kullanım başına: linksiz gönderi
  **0,015 dolar**, link içeren gönderi **0,20 dolar**.
- Bu 13 kat fark stratejiyi belirliyor: **link gönderide değil,
  biyografide.**
- Otomatik hesap biyografide bot olduğunu belirtmek zorunda,
  ilk günden, geçiş süresi yok.
- Seri gönderi ve veri merkezi IP'si bot sinyali olarak
  işaretleniyor. Gönderi aralığını insani tut.

### YouTube Shorts — YAPILMAYACAK
Otomatik üretilmiş veri videoları "inauthentic content" kapsamına
giriyor (metin okuyan ses + şablon görsel). Cezası üç aşamalı:
uyarı, 90 gün askı, programdan kalıcı çıkarma. Ayrıca Shorts
havuzundan ödeme için 90 günde 10 milyon görüntülenme gerekiyor.
Emek yüksek, risk yüksek, getiri sıfır.

## 6. Kapsam dışı (hiçbir aşamada)

- Hesap, giriş, kullanıcı verisi
- Reklam (bu ürün reklamla para kazanmaz; eğlence bandı ~4 dolar RPM)
- Mobil uygulama

## 7. Riskler

- **Kapsam patlaması.** En büyük risk bu. On kaynak + katman sistemi
  + zaman makinesi = 3–6 ay. Aşama kapıları bunun için var.
- **Akış kesilirse ekran donuk kalır** → her kaynak için yeniden
  bağlanma ve durum göstergesi
- **Rabbit hole mekaniği tutmayabilir** → Aşama 1 testinin tüm amacı
  bunu ucuza öğrenmek
- **Gelir yok.** Bu bir dijital oyuncak. En iyi senaryo ilgi ve
  görünürlük, aylık gelir değil. Beklentiyi buna göre kur.

## 8. Sonraki tur (şimdi yapılmayacak)

- Ses
- Paylaşılabilir anlık görüntü / kart üretimi
- Olay tarihçesi sayfaları
- Kullanıcı filtreleri kaydetme
