# Earth Right Now — Plan v2.1

**Depo:** `earth-right-now` · Yayın: `https://cbacanak.github.io/earth-right-now/`
**Durum:** Aşama 1 kapısı geçildi. Aktif aşama: 1.5

---

## 0. Ürün

Dünyada o anda gerçekleşen fiziksel olayları — deprem, yangın, volkan,
fırtına, deniz buzu — tek bir keşif akışına çeviren interaktif gözlem
ekranı.

**Asıl silah rabbit hole.** Haritaya nokta koymak göstergedir. Olayları
uzay (jeodezik mesafe) ve zaman (temporal decay) ekseninde bağlayıp
"bunun yakınında ne var" sorusunu sormak üründür. Katman eklemek
kolaydır, herkes yapar; bağlamak zordur — ürünün tek gerçek savunması
orası.

İnşa sırası tersten: önce mekanik, sonra kaynaklar.

---

## 1. Aşamalar ve kapılar

Her aşamanın bitiş testi var. Test geçilmeden sonrakine geçilmez.

```
AŞAMA 1  ──>  AŞAMA 1.5  ──>  AŞAMA 2  ──>  AŞAMA 3  ──>  AŞAMA 4
Mekanik       UX & HUD       Yayın+Bot     Katmanlar    Zaman makinesi
(geçti)       (aktif)                      (proxy)
```

### Aşama 1 — Çekirdek mekanik ✓ GEÇTİ

- [x] İki anahtarsız kaynak: USGS M2.5+ son 7 gün, EONET açık olaylar 60 gün
- [x] Plate Carrée ızgara haritası ve olay noktaları
- [x] Rabbit hole motoru: jeodezik mesafe (~1.500 km kesim), zaman
      ağırlığı, yakında bir şey yoksa en yakın üç yedeği
- [x] "Show me something" — rastgele tohum, en az iki komşusu olan
      olaylara öncelik
- [x] Paylaşılabilir URL hash (`#event_id`)

**Kapı testi:** *Bir olaydan diğerine geçmek istiyor musun?*

**Cevap: Evet.** Mekanik tuttu. Ama Pasifik ve Akdeniz havzasındaki
yoğun kümelenmelerde seçim zorluğu ve filtre yokluğu keşif akışını
tıkıyor. Çözüm Aşama 1.5'te.

**Kapsam notu:** URL hash Aşama 1'de eklendi, teknik olarak Aşama 3
konusuydu. Zararsız, geri alınmıyor, kayıt için.

### Aşama 1.5 — UX, navigasyon, dayanıklılık (AKTİF)

*Saha testinde çıkan ergonomi darboğazlarını çözer. Beş maddenin hepsi
test bulgusundan geliyor, hiçbiri spekülatif değil.*

**1. Pan & zoom.** SVG `viewBox` üzerinden, sıfır bağımlılık. Tekerlek,
çift tıklama, dokunmatik pinch. Odaklanan olayda yumuşak kadrajlama.

**2. Kategori filtresi.** Üst barda toggle'lar sayaçlarıyla:
`ALL · QUAKES · FIRES · VOLCANOES · STORMS · CRYO`. Seçili olmayanlar
haritada soluklaşır (silinmez — bağlam kaybolmasın).

**3. Zengin telemetri.** Deprem için derinlik göstergesi, seçili olayın
etki yarıçapı çemberi, komşulara uzanan yön vektörleri.

> **Sismogram uyarısı:** Simüle edilmiş dalga profili, olmayan veriyi
> varmış gibi gösterir. Bu bir gözlem aracı; uydurulmuş sinyal
> güvenilirliği bozar. Gerçek dalga formu USGS'in ayrı bir ucundan
> gelir ve Aşama 3 işidir. Şimdilik yalnızca gerçek alanlar: büyüklük,
> derinlik, zaman, konum.

**4. Dayanıklılık — stale-while-revalidate.** API yanıtları
`localStorage`'da zaman damgasıyla saklanır. Kaynak kesilirse son
başarılı veri sunulur ve HUD'da *"showing cached data (Xm ago)"* uyarısı
yanar. Bu, §5'teki "akış kesilirse ekran donuk kalır" riskinin cevabı.

**5. Mobil çekmece.** Küçük ekranda harita altına sıkışan uzun panel
yerine kaydırılabilir alt çekmece.

**6. Klavyeyle gezinme.** İşaretler ve "yakınında ne var" listesi
sekmeyle gezilebilir olmalı. Şu an sadece tıklamayla seçiliyor. Yayın
öncesi kapanması gereken erişilebilirlik boşluğu.

**Kapı testi:** Mobilde ve masaüstünde bir depreme tıklandığında harita
yumuşakça odaklanıyor mu, etki halkası ve komşu olaylar tek bakışta
anlaşılıyor mu, filtreler gecikmesiz çalışıyor mu, klavyeyle
gezilebiliyor mu?

### Aşama 2 — Yayın ve dağıtım

**1. Sosyal önizleme — önce bu.** Sayfada `og:` etiketi, önizleme
görseli ve favicon yok. Bluesky ve Mastodon bağlantıyı boş kartla
gösteriyor. Vaadi bir harita olan üründe boş önizleme tıklamayı
öldürür — ve bot tam da bu linkleri paylaşacak. En ucuz, en yüksek
etkili madde.

**2. Telemetri kartı paylaşımı.** `[Copy link]` ve `[Share card]`.
Panoya kopyalanabilir metin:

```
🌍 EARTH RIGHT NOW
Off the Coast of Northern Sumatra · M6.1 (24 km deep)
Nearby: Sumatra wildfire (142 km NE) · M4.4 aftershock (210 km S)
→ https://cbacanak.github.io/earth-right-now/#usgs_20260330_sumatra
```

**3. Bluesky + Mastodon botu.** Bot dostu, ücretsiz.

> **Altın kural: ham besleme botu görmezden gelinir.** Her olayı paylaşan
> hesap gürültüdür. Bot nadiren konuşur ve sadece kayda değer olduğunda.
> "Bu bölgede son on yılın en büyüğü" bir hikâyedir; "M4.2 deprem"
> değildir. Eleme mantığı ürünün parçası.

Eleme ölçütleri: bölgedeki son on yılın en büyüğü (M6.0+), aynı bölgede
üç farklı kategorinin 300 km içinde çakışması, nadir buz kırılmaları.

**4. X — sonra, dikkatli.** Anlamlı ücretsiz katman yok. Linksiz gönderi
0,015 $, linkli 0,20 $ — 13 kat fark. Strateji: **link gönderide değil,
biyografide.** Otomatik hesap biyografide bot olduğunu ilk günden
belirtmek zorunda. Seri gönderi ve veri merkezi IP'si bot sinyali olarak
işaretleniyor; gönderi aralığı insani tutulur.

**Kapı testi (3–4 hafta):** Bot hesabı organik takipçi alıyor mu, siteye
tıklama geliyor mu?

> Sayısal eşik bilerek konmadı. "30 günde 300 takipçi" gibi bir hedef bu
> ölçekte gerçekçi değil ve kaçırılınca projeyi haksız yere öldürür.
> Bakılacak şey yön: sıfır mı, yoksa yavaş ama sürekli mi?
>
> Ölçüm **Cloudflare Web Analytics** ile. Google Analytics kullanılmaz —
> "kullanıcı verisi yok" diyen bir üründe çerezli izleyici çelişkidir.

### Aşama 3 — Katmanlar ve proxy (açık uçlu)

Ancak Aşama 2 sinyal verirse. GitHub Pages'ten Cloudflare Pages +
Workers'a geçiş; taşıma bir saatlik iş, ortada statik dosyalar var.

Anahtar gerektiren kaynaklar: **NASA FIRMS** (MAP_KEY, uydu yangın
anomalileri), **GDACS** (afet ve tsunami), **OpenAQ v3** (hava kalitesi),
**N2YO** (uydu geçiş pencereleri). Worker anahtarları gizler, Edge cache
(TTL 5 dk) rate limit zırhı olur.

Gerçek sismogram dalga formu da buraya.

### Aşama 4 — Zaman makinesi

Son 24 saat / 7 gün / 30 günlük akışı timeline scrubber ile geri sarma.
En pahalı özellik: geçmişi göstermek geçmişi saklamak demek, o da
veritabanı (Cloudflare D1/KV) demek. En sona.

---

## 2. Veri kaynakları

| Kaynak | Katman | Protokol | Yenileme | Durum |
|---|---|---|---|---|
| **USGS** | Deprem M2.5+ | GeoJSON, CORS açık, anahtarsız | 5 dk | Aktif |
| **NASA EONET v3** | Yangın, volkan, fırtına, buz | REST JSON, CORS açık, anahtarsız | 10 dk | Aktif |
| **NASA FIRMS** | Yüksek çözünürlüklü yangın | CSV/JSON, MAP_KEY | 15 dk | Aşama 3 |
| **GDACS** | Afet, tsunami | RSS/GeoJSON | 15 dk | Aşama 3 |

**Uçlar (doğrulandı):**
```
https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson
https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=60
```

> **EONET alan adı:** `eonet.gsfc.nasa.gov` doğru. `eonet.sci.gsfc.nasa.gov`
> DNS kaydı döndürmüyor — eski adres, hâlâ dokümantasyon bağlantılarında
> dolaşıyor. Kodda yazan uç çalışan uç.

**USGS pencere kararı:** 24 saat yerine 7 gün. 24 saatlik akış çoğunlukla
Kaliforniya mikro depremlerinden oluşuyor ve haritanın geri kalanı boş
kalıyor. 7 gün + M2.5 eşiği haritayı dünya çapında dolduruyor.

### Elenen kaynaklar

- **GBIF / eBird** — gerçek zamanlı değil; gecikmeli akademik gözlem
  kayıtları. eBird ayrıca anahtar istiyor, şartları kısıtlayıcı.
- **Yıldırım ağları** — küresel, ücretsiz, CORS açık güvenilir akış yok.
- **NOAA/NWS** — sadece ABD; küresel üründe tek ülke uyarısı tutarsızlık
  yaratır.
- **Wikimedia EventStreams** — coğrafi odağa uymuyor, gürültü yüksek.

---

## 3. Mimari

```
[ Tarayıcı ]
   ├── Aşama 1–2 ──> doğrudan fetch ──> USGS + EONET
   │                      └──> localStorage cache (kesinti zırhı)
   └── Aşama 3+  ──> Cloudflare Worker ──> anahtar korumalı kaynaklar
                          └──> KV edge cache (rate-limit zırhı)
```

Aşama 1–2 tamamen istemci tarafı, statik barındırma, maliyet ~0.
GitHub Pages yeterli. Aşama 3'te Cloudflare'e taşınır — API anahtarı
tarayıcı koduna konulamaz.

---

## 4. Tasarım dili

**Referans: enstrümanlar.** Sismograf şeridi, kalkış panosu, radar
ekranı. Konu gerçek zamanlı sinyal olduğu için bu dil süs değil.

**Cesaret tek yerde: harita.** Gerisi sessiz. Arayüz geri çekilir
(deference). Apple HIG, kurumsal SaaS şablonu, mobil app kalıbı
kullanılmaz.

Harita gerçek kıta çizimi değil, ızgara — enstrüman referansı buradan
geliyor ve olayları öne çıkarıyor.

### 4.1 Renk

Zemin: `#06090c`. Nötr metin ve ızgara: gri kademeler.

Kategori renkleri, **dördü geçmez**:
- Deprem `#ffb000` (kehribar)
- Yangın `#ff4d2e` (mercan)
- Volkan `#d94fa8` (macenta, doygunluğu düşürülmüş)
- Buz / fırtına `#6ec6d9` (soğuk mavi)

> **Neon doygunluğu düşürülür.** Sismograf kağıdı parlamaz. "Askeri radar
> HUD" referansı enstrüman dilinden oyun estetiğine kayma riski taşıyor;
> altı doygun neon renk "cesaret tek yerde" kuralını deler. Vurgu
> haritada ve telemetri çizgilerinde, palette değil.

**Renk tek başına bilgi taşımaz.** Kategori ayrımı renk + işaret biçimi
ile verilir. Durum göstergeleri metin de taşır.

---

## 5. Riskler

**Kapsam patlaması.** En büyük risk. On kaynak + katman sistemi + zaman
makinesi = 3–6 ay. Aşama kapıları bunun için var. Her yeni fikir önce
§7'ye yazılır; kapı geçilmeden koda girmez.

**Performans — Pasifik yığılması.** Aynı piksel yarıçapındaki mikro
depremler DOM/SVG şişmesi yaratır. Savunma: kümeleme veya zoom
seviyesine göre kademeli görünürlük (LOD). Aşama 1.5'te pan/zoom
gelince gündeme gelecek.

**Akış kesintisi.** EONET veya USGS çökerse ekran donuk kalır. Savunma:
Aşama 1.5 maddesi 4 — stale-while-revalidate + HUD uyarısı.

**Rabbit hole tutmayabilir.** *Bu risk kapandı — Aşama 1 testi geçti.*

**Gelir yok.** Bu bir dijital oyuncak. En iyi senaryo ilgi ve
görünürlük, aylık gelir değil. Beklentiyi buna göre kur. Maliyet Aşama
3'e kadar 0 $/ay.

---

## 6. Kapsam dışı — hiçbir aşamada

1. **Hesap, giriş, kullanıcı verisi.** Bu kişisel kayıt uygulaması
   değil, kamusal gözlem konsolu.
2. **Reklam ve sponsorlu içerik.** Enstrüman estetiğini bozar.
3. **Ağır JS framework'ü** (React, Angular, Vue). Saf ES6 ve CSS; açılış
   500 ms altında kalmalı.
4. **Native mobil uygulama.** PWA manifestosu yeterli.
5. **Otomatik YouTube Shorts / video üretimi.** "Inauthentic content"
   kapsamına giriyor: uyarı, 90 gün askı, programdan kalıcı çıkarma.
   Ayrıca Shorts havuzu için 90 günde 10 milyon görüntülenme gerekiyor.
   Emek yüksek, risk yüksek, getiri sıfır.

---

## 7. Bilinen sınırlar ve sonraki tur

### Bilinen sınırlar (kabul edilmiş, şimdi düzeltilmiyor)

- **Tarih çizgisi.** 180. meridyenin iki yanındaki olaylar arasında
  mesafe doğru hesaplanıyor (küresel), ama haritada bağlantı çizgisi
  çizilmiyor — ekranı boydan boya kesmesin diye. Fırtına izleri de aynı
  yerde kopuyor.
- **EONET kategorileri.** Yangın, volkan, fırtına, buz, sel kendi
  rengini alıyor. Toz, kuraklık, heyelan tek bir gri "event" kovasına
  düşüyor.

### Sonraki tur (şimdi yapılmayacak)

- Ses
- Olay tarihçesi sayfaları
- Kullanıcı filtrelerini kaydetme
- Gerçek sismogram dalga formu (Aşama 3, USGS ayrı ucu)
- Toz / kuraklık / heyelan için ayrı kategori renkleri

---

## 8. Aşama 1.5 görev listesi

- [ ] `js/map.js` — SVG pan (drag) ve zoom (wheel, pinch, çift tıklama)
- [ ] `js/map.js` — seçili olaya yumuşak kadrajlama
- [ ] `js/app.js` — `state.activeFilters` ve filtrelenmiş render
- [ ] `index.html` — kategori HUD butonları ve sayaçlar
- [ ] `css/style.css` — etki çemberi, yön vektörleri, soluklaştırma
- [ ] `js/sources.js` — localStorage stale-while-revalidate + HUD uyarısı
- [ ] Mobil alt çekmece
- [ ] Klavyeyle gezinme (işaretler + komşu listesi)
- [ ] Palet sadeleştirmesi (§4.1)
- [ ] `CHANGELOG.md` — Aşama 1 kapı sonucu ve 1.5 test sonuçları

**Sıra önerisi:** pan/zoom → filtre → önbellek → mobil çekmece →
klavye → telemetri süsleri. İlk ikisi test bulgusunun doğrudan cevabı;
gerisi onların üstüne binmesin diye sonra.
