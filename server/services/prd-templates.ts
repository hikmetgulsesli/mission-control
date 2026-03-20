/**
 * Gercek PRD sablonlari — her template pipeline-ready icerik barindiriyor.
 */

export const TEMPLATE_CONTENTS: Record<string, string> = {
  'tpl-ecommerce': `# PRD — E-Ticaret Platformu

## 1. Proje Genel Bakis
Modern, responsive e-ticaret web uygulamasi. Urun listeleme, filtreleme, sepet yonetimi ve odeme akisi.

**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui
**Hedef:** Masaustu ve mobil uyumlu, hizli yuklenen, SEO-friendly

## 2. Tasarim Sistemi

### Renkler
- Primary: #2563EB (blue-600)
- Secondary: #7C3AED (violet-600)
- Background: #FFFFFF (light), #0F172A (dark)
- Text: #1E293B (light), #F8FAFC (dark)
- Accent: #F59E0B (amber-500)
- Destructive: #EF4444 (red-500)
- Border: #E2E8F0 (slate-200)
- Muted: #F1F5F9 (slate-100)

### Tipografi
- Heading: Inter, -apple-system, sans-serif (700, 600)
- Body: Inter, -apple-system, sans-serif (400, 500)
- Mono: JetBrains Mono (kod bloklari icin)
- Base size: 16px, line-height: 1.5

### Spacing
- xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px
- Container max-width: 1280px, padding: 16px (mobil), 32px (desktop)

### Animasyonlar
- Hover: transform scale(1.02) + box-shadow, 200ms ease-out
- Page transition: opacity 0→1, 300ms ease-out
- Modal: opacity + translateY(10px→0), 200ms cubic-bezier(0.16, 1, 0.3, 1)
- Skeleton loading: pulse animation 2s ease-in-out infinite

## 3. Sayfalar

### 3.1 Ana Sayfa (/)
- Hero banner: full-width gorsel, baslik, CTA butonu
- Kategoriler grid: 4 kolon (desktop), 2 kolon (mobil), Card komponenti
- One Cikan Urunler: yatay scroll carousel, ProductCard
- Kampanyalar: banner slider, otomatik gecis 5s
- Footer: 4 kolon link grubu, sosyal medya ikonlari, copyright

### 3.2 Urun Listesi (/products, /category/:slug)
- Filtreleme sidebar: fiyat araliqi (Slider), kategori (Checkbox), marka (Checkbox), renk, boyut
- Siralama: Select (fiyat artan/azalan, yeni, populer)
- Grid gorunumu: 3 kolon (desktop), 2 kolon (tablet), 1 kolon (mobil)
- ProductCard: gorsel, baslik, fiyat, indirim badge, sepete ekle butonu, favori ikonu
- Sayfalama: Button group (1, 2, 3, ... Son)
- Urun sayisi gostergesi: Badge

### 3.3 Urun Detay (/products/:id)
- Gorsel galeri: ana gorsel + thumbnail listesi, zoom on hover
- Urun bilgileri: baslik, fiyat (indirimli fiyat var ise ustune cizili eski fiyat), aciklama, stok durumu Badge
- Varyant secimi: renk (gorsel butonlar), boyut (ToggleGroup)
- Adet: NumberInput (- / + butonlari)
- Sepete Ekle: Button (primary, large), animasyonlu ekleme efekti
- Tabs: Aciklama, Ozellikler (Table), Yorumlar
- Benzer urunler: yatay scroll, ProductCard

### 3.4 Sepet (/cart)
- Urun listesi: gorsel, baslik, birim fiyat, adet (NumberInput), satir toplami, sil butonu (destructive)
- Sepet ozeti: Ara toplam, Kargo, Toplam (kalin, buyuk), Odemeye Git (Button primary full-width)
- Bos sepet: illüstrasyon + "Sepetiniz bos" + Alisverise Basla butonu

### 3.5 Odeme (/checkout)
- Step indicator: 3 adim (Adres → Odeme → Onay)
- Adres formu: Form (ad, soyad, telefon, adres, il Select, ilce Select, posta kodu)
- Odeme: kart numarasi Input (maskeleme), son kullanim tarihi, CVV
- Siparis ozeti: sabit sidebar (desktop), Accordion (mobil)
- Siparis Ver: Button primary, loading state

### 3.6 Hesabim (/account)
- Sidebar navigasyon: siparislerim, adreslerim, favorilerim, ayarlar
- Siparislerim: Table (siparis no, tarih, durum Badge, tutar)
- Siparis Detay: Dialog/Sheet ile detay gorunumu

## 4. Responsive Breakpoint'ler
- Mobile: < 640px (sm) — tek kolon, hamburger menu, bottom navigation
- Tablet: 640px–1024px (md) — 2 kolon grid, sidebar gizli
- Desktop: > 1024px (lg) — tam layout, sidebar gorunur
- Large: > 1280px (xl) — max-width container

## 5. Veri Modeli
- Product: id, title, slug, description, price, salePrice, images[], category, brand, variants[], stock, rating
- Cart: items[{productId, variantId, quantity}], total, itemCount
- Order: id, items[], address, payment, status, total, createdAt
- User: id, name, email, phone, addresses[], orders[]
- Category: id, name, slug, parentId, image

## 6. API Endpoints
- GET /api/products?category=&brand=&minPrice=&maxPrice=&sort=&page=
- GET /api/products/:id
- GET /api/categories
- POST /api/cart/add
- PATCH /api/cart/update
- DELETE /api/cart/remove/:itemId
- POST /api/orders
- GET /api/orders/:id
`,

  'tpl-portfolio': `# PRD — Portfolio Sitesi

## 1. Proje Genel Bakis
Kisisel portfolio web sitesi. Projeler, beceriler, hakkinda ve iletisim bolumlerini iceren tek sayfa uygulama.

**Tech Stack:** React + TypeScript + Tailwind CSS
**Hedef:** Minimal, sik, hizli, mobil uyumlu

## 2. Tasarim Sistemi

### Renkler
- Background: #FAFAFA (light), #09090B (dark)
- Foreground: #09090B (light), #FAFAFA (dark)
- Primary: #18181B (light), #FAFAFA (dark)
- Accent: #6366F1 (indigo-500)
- Muted: #F4F4F5 (zinc-100, light), #27272A (zinc-800, dark)
- Border: #E4E4E7 (zinc-200), #3F3F46 (zinc-700, dark)

### Tipografi
- Heading: "Space Grotesk", system-ui, sans-serif (700)
- Body: "Inter", system-ui, sans-serif (400, 500)
- Base: 16px, heading scale: 3xl(30px), 2xl(24px), xl(20px), lg(18px)

### Animasyonlar
- Scroll reveal: translateY(20px→0) + opacity 0→1, 600ms ease-out, IntersectionObserver
- Hover card: translateY(-4px) + shadow-lg, 200ms ease-out
- Page load: staggered fade-in, her eleman 100ms delay
- Cursor: ozel cursor efekti (opsiyonel)

## 3. Sayfalar / Bolumleri

### 3.1 Hero Section
- Tam ekran (100vh), ortalanmis icerik
- Baslik: "Merhaba, Ben [Ad]" — type-writer animasyonu, 50ms/karakter
- Alt baslik: Rol/uzmanlik alani, opacity 0→1 500ms delay
- CTA butonlari: "Projelerim" (scroll-to), "Iletisim" (scroll-to)
- Arka plan: subtle gradient veya particle efekti
- Scroll indicator: animasyonlu ok, bounce 1.5s infinite

### 3.2 Hakkimda Section
- Sol: profil fotoqrafi (rounded, border accent), 300x300px
- Sag: paragraf aciklama, beceri etiketleri (Badge), deneyim yili
- Beceriler: iki kolon grid, her beceri Progress bar ile seviye gostergesi
- Tech stack ikonlari: grid, hover ile buyume efekti

### 3.3 Projeler Section
- Grid: 2 kolon (desktop), 1 kolon (mobil)
- Proje karti: gorsel (aspect-ratio 16/9), baslik, aciklama (2 satir clamp), tech badge'ler
- Hover: overlay + "Detay Gor" + "GitHub" + "Live Demo" linkleri
- Filtre: kategori butonlari (Tumu, Web, Mobile, Backend, vb.)
- Detay: Dialog modal — tam aciklama, screenshot galeri, tech detayi, linkler

### 3.4 Deneyim Timeline
- Dikey timeline: sol cizgi, sag icerik
- Her item: tarih Badge, sirket, rol, aciklama
- Alternatif (sol-sag) layout desktop'ta

### 3.5 Iletisim Section
- Form: ad Input, email Input, konu Input, mesaj Textarea, Gonder Button
- Sosyal linkler: GitHub, LinkedIn, Twitter, Email ikonlari
- Email: mailto link veya form submit → API

### 3.6 Footer
- Copyright, sosyal linkler tekrar, "Made with React" notu

## 4. Responsive
- Mobile (<640px): tek kolon, hamburger nav, hero font kuculme
- Tablet (640-1024): 2 kolon projeler, yan yana hakkimda
- Desktop (>1024): tam layout

## 5. Veri Modeli
- Project: id, title, description, image, tags[], githubUrl, liveUrl, category
- Skill: name, level(0-100), category
- Experience: company, role, startDate, endDate, description
- ContactForm: name, email, subject, message
`,

  'tpl-saas': `# PRD — SaaS Landing Page

## 1. Proje Genel Bakis
SaaS urun tanitim sayfasi. Hero, ozellikler, fiyatlandirma, musteriler, SSS ve CTA bolumleri.

**Tech Stack:** React + TypeScript + Tailwind CSS
**Hedef:** Yuksek donusum oranli, hizli, A/B test uyumlu

## 2. Tasarim Sistemi

### Renkler
- Primary: #6366F1 (indigo-500), hover: #4F46E5 (indigo-600)
- Background: #FFFFFF, section alternate: #F8FAFC
- Dark sections: #0F172A (hero bg)
- Text: #0F172A (heading), #475569 (body), #94A3B8 (muted)
- Success: #10B981, Warning: #F59E0B, Error: #EF4444
- CTA gradient: linear-gradient(135deg, #6366F1, #8B5CF6)

### Tipografi
- Heading: "Cal Sans", "Inter", sans-serif (800, 700)
- Body: "Inter", sans-serif (400, 500)
- Hero title: 56px (desktop), 36px (mobil), line-height 1.1
- Section title: 36px (desktop), 28px (mobil)

### Animasyonlar
- Scroll reveal: IntersectionObserver, translateY(30px→0) + opacity, 500ms ease-out
- CTA button: pulse glow efekti, box-shadow 0 0 20px rgba(99,102,241,0.5)
- Counter: sayi animasyonu (0→hedef), 2s ease-out
- Feature cards: staggered reveal, 100ms aralik

## 3. Bolumleri

### 3.1 Navbar (sticky)
- Logo (sol), nav linkler (orta), Login + "Ucretsiz Basla" CTA (sag)
- Scroll'da: backdrop-blur + border-bottom, 200ms transition
- Mobil: hamburger menu, Sheet sidebar

### 3.2 Hero
- Koyu arka plan, gradient overlay
- Ana baslik: buyuk, bold, gradient text efekti
- Alt baslik: 1-2 cumle, aciklayici
- CTA grubu: "Ucretsiz Basla" (primary, buyuk) + "Demo Izle" (outline, video ikonu)
- Social proof: "500+ sirket guvenli" + logo slider
- Hero gorseli: urun screenshot, floating shadow, perspective transform

### 3.3 Logolar
- Siyah-beyaz musteri logolari, yatay kaydirma (marquee animasyonu)

### 3.4 Ozellikler Grid
- 3 kolon grid (desktop), Card yapisi
- Her kart: ikon (40px, renkli bg circle), baslik, aciklama (2-3 satir)
- Hover: translateY(-2px) + shadow, 200ms

### 3.5 Ozellik Detay (Alternating)
- Sol gorsel / sag metin, sonraki satirda ters
- Gorsel: screenshot veya illustration, rounded-xl, shadow-2xl
- Metin: baslik, aciklama, bullet points (check ikonu + yesil), CTA link

### 3.6 Fiyatlandirma
- Toggle: Aylik / Yillik (Switch, yillik seciliyken "%20 indirim" Badge)
- 3 plan karti: Free, Pro, Enterprise
- Her kart: plan adi, fiyat (buyuk), periyod, ozellik listesi (check/x ikonlari), CTA button
- En populer: vurgulu border + "Populer" badge + scale(1.05)

### 3.7 Musteriler / Testimonials
- Carousel: musteri yorumlari, 3 gorunen (desktop)
- Her kart: yorum metni (italik), ad, rol, sirket, avatar

### 3.8 SSS (FAQ)
- Accordion yapisi, 6-8 soru
- Acik iken: border-left accent rengi

### 3.9 CTA Banner
- Tam genislik, gradient bg, buyuk baslik, alt metin, CTA buton
- Pattern/particle bg efekti

### 3.10 Footer
- 4 kolon: Urun, Sirket, Kaynaklar, Yasal
- Alt: copyright, sosyal ikonlar, dil secimi

## 4. Responsive
- Mobile (<640px): tek kolon, hero text kucuk, fiyat kartlari dikey, nav hamburger
- Tablet (640-1024): 2 kolon grid, yan yana ozellik kaldir
- Desktop (>1024): tam layout, 3 kolon

## 5. Veri Modeli
- Plan: id, name, price, yearlyPrice, features[], cta, popular
- Feature: id, title, description, icon
- Testimonial: id, text, author, role, company, avatar
- FAQ: id, question, answer
`,

  'tpl-blog': `# PRD — Blog Platformu

## 1. Proje Genel Bakis
Modern blog sitesi. Yazi listesi, kategoriler, arama, yazi detay ve yazar profili.

**Tech Stack:** React + TypeScript + Tailwind CSS

## 2. Tasarim Sistemi

### Renkler
- Background: #FFFFFF, Card: #F9FAFB
- Text: #111827 (heading), #4B5563 (body), #9CA3AF (muted)
- Primary: #3B82F6, Accent: #8B5CF6
- Border: #E5E7EB, Code bg: #1F2937

### Tipografi
- Heading: "Merriweather", Georgia, serif (700, 900)
- Body: "Source Sans 3", system-ui, sans-serif (400, 600)
- Code: "Fira Code", monospace
- Yazi ici: 18px, line-height 1.8, max-width 720px

### Animasyonlar
- Card hover: shadow-md→shadow-xl + translateY(-2px), 200ms ease
- Page load: fade-in 300ms
- Image lazy load: blur(10px)→blur(0), 500ms

## 3. Sayfalar

### 3.1 Ana Sayfa (/)
- Featured post: buyuk kart, tam gorsel, gradient overlay, baslik, ozet, yazar, tarih
- Son yazilar grid: 3 kolon, PostCard (gorsel aspect-ratio 16/10, kategori Badge, baslik, ozet 2 satir, yazar+tarih)
- Kategoriler sidebar: etiket butonlari veya liste
- Newsletter: email Input + Abone Ol Button

### 3.2 Yazi Listesi (/blog, /category/:slug)
- Filtre: kategori butonlari, arama Input
- Liste: PostCard grid, 2 kolon (desktop), sayfalama
- Sidebar: populer yazilar, etiket bulutu, hakkinda kisa

### 3.3 Yazi Detay (/blog/:slug)
- Baslik (h1, buyuk), yazar avatari+ad+tarih, okuma suresi Badge
- Cover gorsel: tam genislik, rounded, aspect-ratio 21/9
- Icerik: Markdown render, kod bloklari (syntax highlight), gorsel, alinti (blockquote sol border), tablo
- Icerik icindekiler (TOC): sticky sidebar, baslik linkleri, aktif baslik highlight
- Yazar kutusu: avatar, ad, bio, sosyal linkler
- Ilgili yazilar: 3 kart grid
- Yorumlar: basit yorum formu + yorum listesi

### 3.4 Hakkinda (/about)
- Yazar profili, uzun bio, sosyal linkler, istatistikler

### 3.5 Iletisim (/contact)
- Form: ad, email, konu, mesaj, Gonder

## 4. Responsive
- Mobile: tek kolon, TOC gizli, hamburger nav
- Tablet: 2 kolon grid, sidebar cekmeye
- Desktop: tam layout, sticky TOC

## 5. Veri Modeli
- Post: id, title, slug, content(md), excerpt, coverImage, category, tags[], author, publishedAt, readingTime
- Category: id, name, slug, postCount
- Author: id, name, bio, avatar, socialLinks
- Comment: id, postId, name, email, content, createdAt
`,

  'tpl-dashboard': `# PRD — Veri Dashboard

## 1. Proje Genel Bakis
Analitik dashboard uygulamasi. Grafikler, metrik kartlari, tablolar, filtreler ve raporlama.

**Tech Stack:** React + TypeScript + Tailwind CSS + Recharts
**Tema:** Dark tema varsayilan

## 2. Tasarim Sistemi

### Renkler
- Background: #09090B, Card: #18181B, Elevated: #27272A
- Text: #FAFAFA (primary), #A1A1AA (secondary), #71717A (muted)
- Primary: #3B82F6, Success: #22C55E, Warning: #EAB308, Error: #EF4444
- Chart palette: [#3B82F6, #22C55E, #EAB308, #A855F7, #EC4899, #06B6D4]
- Border: #27272A, Focus ring: #3B82F6

### Tipografi
- Font: "Inter", system-ui, sans-serif
- Metrik buyuk: 32px bold, Kart baslik: 14px semibold, Body: 14px regular
- Monospace (tablolar): "JetBrains Mono"

### Animasyonlar
- Grafik cizim: 800ms ease-out, soldan saga
- Counter: 0→hedef deger, 1.5s ease-out
- Kart hover: border-color transition 200ms
- Refresh: rotate ikonu 360deg spin

## 3. Sayfalar

### 3.1 Dashboard (/)
- Ust bar: tarih araliqi DatePicker (bugun, son 7 gun, son 30 gun, ozel), yenile butonu
- Metrik kartlari (4 kolon): Toplam Gelir, Aktif Kullanici, Donusum Orani, Ortalama Siparis — her biri: buyuk sayi, degisim % (yesil yukan / kirmizi asagi ok), sparkline mini grafik
- Ana grafik: AreaChart (gelir trendi), zaman ekseni, hover tooltip
- Ikincil grafikler: 2 kolon — BarChart (kategori bazli), PieChart (kaynak dagilimi)
- Son islemler: Table (tarih, kullanici, islem, tutar, durum Badge)
- Canli aktivite: son 5 islem, otomatik guncelleme

### 3.2 Analitik (/analytics)
- Detayli grafikler: LineChart (coklu seri), stacked BarChart
- Filtreler: tarih, kategori Select, ulke Select
- Kiyaslama: onceki donem ile overlay

### 3.3 Kullanicilar (/users)
- Tablo: avatar, ad, email, kayit tarihi, durum Badge, son aktivite
- Arama + filtre (durum, tarih araliqi)
- Kullanici detay: Sheet/Dialog, aktivite gecmisi

### 3.4 Raporlar (/reports)
- Rapor listesi: Card grid, her rapor Card icinde baslik, aciklama, tarih, indir butonu
- Rapor olustur: form (tip Select, tarih araliqi, format Select)

### 3.5 Ayarlar (/settings)
- Tabs: Profil, Bildirimler, Entegrasyonlar, Tema
- Form alanlari: Input, Switch, Select

## 4. Sidebar Navigation
- Logo + app adi
- Nav gruplari: Ana (Dashboard, Analitik), Yonetim (Kullanicilar, Raporlar), Sistem (Ayarlar)
- Her item: ikon + label, aktif state: bg-primary/10 + text-primary
- Alt: kullanici avatar + ad + cikis butonu
- Daraltilabilir: ikon-only mod (toggle)

## 5. Responsive
- Mobile: sidebar gizli (hamburger), kartlar tek kolon, tablo yatay scroll
- Tablet: daraltilmis sidebar, 2 kolon kartlar
- Desktop: tam sidebar, 4 kolon kartlar

## 6. Veri Modeli
- Metric: key, value, change, changePercent, period
- ChartData: timestamp, values[]
- User: id, name, email, avatar, status, createdAt, lastActive
- Transaction: id, userId, type, amount, status, createdAt
- Report: id, title, type, dateRange, format, url, createdAt
`,

  'tpl-admin': `# PRD — Admin Panel

## 1. Proje Genel Bakis
Tam kapsamli CRUD admin paneli. Kullanici yonetimi, icerik yonetimi, ayarlar.

**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui + TanStack Table

## 2. Tasarim Sistemi
- Background: #FFFFFF, Sidebar: #F8FAFC, Card: #FFFFFF border
- Primary: #0F172A, Accent: #2563EB
- Font: "Inter", 14px base
- Spacing: 4px grid
- Dark mode destegi: CSS custom properties toggle

## 3. Sayfalar

### 3.1 Login (/login)
- Ortalanmis form: logo, email Input, sifre Input, "Giris Yap" Button, "Sifremi Unuttum" link
- Hata mesaji: Alert destructive

### 3.2 Dashboard (/)
- 4 metrik karti, son aktiviteler listesi, hizli erisim butonlari

### 3.3 Kullanicilar (/users)
- DataTable: secim checkbox, avatar+ad, email, rol Badge, durum Switch, islemler DropdownMenu
- Ust bar: arama Input, filtre (rol Select, durum Select), "Yeni Kullanici" Button
- Yeni/Duzenle: Dialog form (ad, email, rol Select, durum Switch)
- Silme: AlertDialog onay

### 3.4 Icerikler (/content)
- DataTable: baslik, kategori Badge, yazar, tarih, durum Badge, islemler
- Yeni/Duzenle: tam sayfa form (baslik Input, icerik Textarea/Editor, kategori Select, kapak gorseli upload, SEO alanlari)

### 3.5 Kategoriler (/categories)
- Liste: Table, siralama (drag-drop), duzenle/sil
- Yeni: Dialog form (ad, slug, ust kategori Select)

### 3.6 Ayarlar (/settings)
- Tabs: Genel, Email, Guvenlik, Yedekleme
- Form alanlari gruplu

### 3.7 Sidebar
- Logo, nav gruplar (Ana, Icerik, Sistem), aktif state, collapse toggle, kullanici menu

## 4. Responsive
- Mobile: overlay sidebar, tablo yatay scroll, form tam genislik
- Desktop: sabit sidebar 256px

## 5. Veri Modeli
- User: id, name, email, role(admin|editor|viewer), status(active|inactive), avatar, createdAt
- Content: id, title, slug, body, categoryId, authorId, status(draft|published|archived), coverImage, seoTitle, seoDescription, createdAt, updatedAt
- Category: id, name, slug, parentId, sortOrder
- Setting: key, value, group
`,

  'tpl-mobile': `# PRD — Mobil Uygulama

## 1. Proje Genel Bakis
React Native + Expo mobil uygulamasi. Tab navigasyon, liste gorunumu, detay sayfasi, profil.

**Tech Stack:** React Native + Expo + TypeScript + NativeWind (Tailwind)
**Platform:** iOS + Android

## 2. Tasarim Sistemi

### Renkler
- Background: #FFFFFF (light), #000000 (dark)
- Card: #F2F2F7 (light), #1C1C1E (dark)
- Primary: #007AFF (iOS blue)
- Destructive: #FF3B30
- Success: #34C759
- Text: #000000 (light), #FFFFFF (dark)
- Secondary text: #8E8E93

### Tipografi
- iOS: SF Pro, Android: Roboto
- Title: 28px bold, Heading: 22px semibold, Body: 17px regular, Caption: 13px regular

### Animasyonlar
- Screen transition: slide-from-right, 350ms
- Tab switch: cross-fade, 200ms
- Pull-to-refresh: native spinner
- List item press: opacity 0.7, 100ms
- Card press: scale(0.98), 100ms

## 3. Ekranlar

### 3.1 Tab Bar (Bottom)
- 4 tab: Ana Sayfa (home ikonu), Kesfet (search), Bildirimler (bell + badge), Profil (person)
- Aktif: primary renk, inactive: gray

### 3.2 Ana Sayfa
- Ust: Baslik + bildirim ikonu (badge)
- Yatay carousel: one cikan itemlar, sayfa gostergesi (dots)
- Dikey FlatList: ItemCard (gorsel 80x80, baslik, alt baslik, sag ok ikonu)
- Pull-to-refresh

### 3.3 Kesfet
- Arama bar: SearchBar (ikon + placeholder), sticky
- Kategori yatay scroll: FilterChip butonlar
- Sonuc listesi: FlatList, ItemCard

### 3.4 Detay (Stack Navigator)
- Ust gorsel: tam genislik, 250px yukseklik, geri butonu overlay
- Icerik: baslik, tarih, icerik paragraflar
- Alt bar: CTA butonu (sabit, safe area)

### 3.5 Bildirimler
- SectionList: bugun, dun, bu hafta gruplari
- Her bildirim: ikon (circle bg), baslik, mesaj, zaman
- Okunmamis: sol mavi dot, kalin baslik

### 3.6 Profil
- Avatar (buyuk, circle), ad, bio
- Istatistikler satiri: 3 item (takipci, takip, paylasim)
- Menu listesi: GroupedList (Hesap, Bildirim Ayarlari, Gizlilik, Yardim, Cikis)
- Her item: ikon + label + sag ok

### 3.7 Ayarlar
- GroupedList: Switch itemlar (bildirimler, koyu tema, konum), Select itemlar (dil), Button itemlar (hesabi sil - destructive)

## 4. Navigasyon
- BottomTabNavigator (4 tab)
- Her tab icinde StackNavigator (liste → detay)
- Modal stack: ayarlar, duzenleme formlari

## 5. Veri Modeli
- Item: id, title, subtitle, image, category, content, createdAt
- Notification: id, type, title, message, read, createdAt
- User: id, name, avatar, bio, stats{followers, following, posts}
`,

  'tpl-game': `# PRD — Web Oyunu

## 1. Proje Genel Bakis
Canvas/HTML5 tabanli web oyunu. Menu, oyun ekrani, skor tablosu, ayarlar.

**Tech Stack:** React + TypeScript + HTML5 Canvas
**Tur:** 2D arcade/casual

## 2. Tasarim Sistemi

### Renkler
- Background: #0A0A0A (koyu), Game area: #1A1A2E
- Primary: #E94560 (kirmizi-pembe)
- Secondary: #0F3460 (koyu mavi)
- Accent: #16C79A (yesil-turkuaz)
- Text: #EAEAEA, Score: #FFD700 (altin)
- UI elements: rgba(255,255,255,0.1) glassmorphism

### Tipografi
- UI Font: "Press Start 2P", cursive (pixel font) — veya "Rajdhani", sans-serif
- Score: 48px bold, HUD: 16px, Menu: 24px

### Animasyonlar
- Menu title: float up-down, 3s ease-in-out infinite
- Button hover: scale(1.1) + glow, 200ms
- Game over: shake 500ms + fade overlay 300ms
- Score update: scale bounce 1→1.3→1, 200ms
- Particle effects: Canvas particle system (patlama, trail)
- Screen transition: fade-to-black 300ms

## 3. Ekranlar

### 3.1 Ana Menu
- Oyun logosu/basligi: buyuk, animasyonlu (glow veya float)
- Butonlar (dikey stack): Oyna, Skor Tablosu, Ayarlar
- Arka plan: animasyonlu (yildizlar, partikuller veya basit animasyon)
- Versiyon numarasi: sol alt kose

### 3.2 Oyun Ekrani
- Canvas: tam ekran (veya sabit aspect ratio, ortalanmis)
- HUD overlay: sol ust skor, sag ust can/enerji bari, orta ust level/wave
- Pause butonu: sag ust kose
- Kontroller: klavye (ok tuslari / WASD) + touch (mobilde joystick veya tap)
- Game loop: requestAnimationFrame, 60fps hedef

### 3.3 Pause Menu (overlay)
- Yari saydam koyu overlay
- Glassmorphism panel: "DURAKLADI" baslik, Devam Et, Yeniden Basla, Ana Menu butonlari

### 3.4 Game Over
- Overlay: "OYUN BITTI" baslik (shake animasyon)
- Final skor: buyuk, altin renk, sayma animasyonu
- En yuksek skor: eger yeni rekor ise "YENI REKOR!" animasyonu (confetti/particles)
- Butonlar: Tekrar Oyna, Ana Menu

### 3.5 Skor Tablosu
- Tablo: siralama, isim, skor, tarih
- Oyuncunun kendi skoru vurgulu (highlight)
- LocalStorage ile saklama

### 3.6 Ayarlar
- Ses: Slider (0-100)
- Muzik: Switch (acik/kapali) + Slider
- Zorluk: 3 buton (Kolay, Normal, Zor)
- Kontroller: tuslari goster

## 4. Oyun Mekanikleri (Canvas)
- Game state: menu | playing | paused | gameover
- Entity system: player, enemies[], projectiles[], particles[], pickups[]
- Collision detection: AABB veya circle-circle
- Fizik: basit hareket (velocity, gravity opsiyonel)
- Spawn system: dalga bazli veya zamana bagli
- Score system: puan, combo carpani, bonus

## 5. Veri Modeli
- GameState: score, lives, level, entities, timestamp
- HighScore: name, score, date (localStorage)
- Settings: volume, musicOn, difficulty
`,

  'tpl-docs': `# PRD — Dokumantasyon Sitesi

## 1. Proje Genel Bakis
Teknik dokumantasyon sitesi. Sidebar navigasyon, Markdown render, arama, kod bloklari.

**Tech Stack:** React + TypeScript + Tailwind CSS

## 2. Tasarim Sistemi

### Renkler
- Background: #FFFFFF (light), #0F1117 (dark)
- Sidebar: #F6F6F7 (light), #1A1A24 (dark)
- Code bg: #F6F8FA (light), #161B22 (dark)
- Primary: #2563EB, Link: #2563EB hover underline
- Border: #E5E7EB (light), #30363D (dark)
- Text: #1F2328 (light), #E6EDF3 (dark)

### Tipografi
- Heading: "Inter", system-ui, sans-serif (600, 700)
- Body: "Inter", 16px, line-height 1.7
- Code: "Fira Code", "JetBrains Mono", monospace, 14px

### Animasyonlar
- Sidebar expand: height transition 200ms ease
- Code copy: "Kopyalandi!" toast 2s fade-out
- Search: Dialog acilis 200ms scale(0.95→1) + opacity

## 3. Sayfalar

### 3.1 Sidebar (sabit sol panel, 260px)
- Logo + site adi
- Arama butonu: Ctrl+K shortcut gosterimi
- Nav gruplari: baslik (bold, uppercase, small) + alt linkler
- Aktif sayfa: sol border primary + bg tint
- Collapse/expand gruplari: ok ikonu + transition
- Alt: tema toggle (Switch), versiyon Badge

### 3.2 Icerik Alani
- Breadcrumb: ust kisim, sayfa yolu
- Baslik (h1): buyuk, alt cizgi
- Icerik: Markdown render — h2-h4, paragraf, liste, tablo, gorsel
- Kod bloklari: syntax highlight (Prism/Shiki), dil etiketi, kopya butonu, satir numaralari
- Callout bloklari: Note (mavi), Warning (turuncu), Tip (yesil), Danger (kirmizi) — sol border + bg tint + ikon
- Tablolar: zebra striping, responsive (yatay scroll)
- Goruntüler: max-width 100%, rounded, opsiyonel caption

### 3.3 Sag Sidebar (Table of Contents)
- Sticky, sayfa icindeki basliklar (h2, h3)
- Aktif baslik: primary renk, scroll-spy ile otomatik
- Tiklaninca smooth scroll

### 3.4 Arama (Dialog/Command)
- Ctrl+K veya ust bar arama butonu ile acilir
- Command palette stili: arama Input, sonuc listesi
- Her sonuc: sayfa basligi, icinden eslesen metin (highlight)
- Klavye navigasyon: ok tuslari + Enter

### 3.5 Sayfa Alt
- Onceki / Sonraki sayfa navigasyonu (sol/sag oklar + baslik)
- "Bu sayfayi duzenle" GitHub linki
- Son guncelleme tarihi

## 4. Responsive
- Mobile (<768px): sidebar gizli (hamburger), TOC gizli, kod bloklari yatay scroll
- Tablet: daraltilmis sidebar overlay
- Desktop: 3 kolon (sidebar + content + TOC)

## 5. Veri Modeli
- Page: id, slug, title, content(md), section, order, updatedAt
- Section: id, name, order, pages[]
- SearchIndex: pageId, title, content (tam metin arama icin)
`,
};
