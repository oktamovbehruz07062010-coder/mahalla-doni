# Mahalla do'koni: onlayn buyurtma tizimi

Kichik do'kon uchun buyurtma sayti. Xaridor katalogdan mahsulot tanlaydi, savatga qo'shadi va buyurtma beradi. Buyurtma do'kondorning Telegramiga tushadi.

## Imkoniyatlar

- Mahsulotlar katalogi, kategoriya filtri va qidiruv
- Savat (sahifa yangilansa ham saqlanadi)
- Buyurtma formasi: ism, telefon, manzil, izoh
- Buyurtma Telegram botga yuboriladi
- Admin sahifa: mahsulot qo'shish, tahrirlash, o'chirish va buyurtmalarni ko'rish
- Narxlar serverda qayta hisoblanadi, mijoz narxni o'zgartira olmaydi

## Texnologiyalar

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js (tashqi kutubxonasiz)
- Xabar yuborish: Telegram Bot API

## Ishga tushirish

Node.js 18 yoki yangiroq versiya kerak.

```
node server.js
```

Sayt: http://localhost:3000
Admin: http://localhost:3000/admin

## Telegram botni ulash

1. Telegramda @BotFather ga yozing, `/newbot` buyrug'i bilan bot yarating va tokenni oling.
2. Yangi botga biror xabar yozing.
3. Brauzerda `https://api.telegram.org/bot<TOKEN>/getUpdates` ni oching va `chat.id` qiymatini toping.
4. Serverni shu qiymatlar bilan ishga tushiring:

```
BOT_TOKEN=123456:ABC CHAT_ID=987654321 ADMIN_PASSWORD=kuchli_parol node server.js
```

Token berilmasa, buyurtmalar faqat `orders.json` fayliga yoziladi.

## Fayllar

```
mahalla-doni/
  server.js        server va API
  products.json    mahsulotlar
  orders.json      buyurtmalar (avtomatik yaratiladi)
  public/
    index.html     katalog va savat
    app.js
    style.css
    admin.html     admin sahifa
    admin.js
```

## Joylashtirish

Sayt Node.js serverga muhtoj, shuning uchun GitHub Pages ishlamaydi. Render, Railway yoki Fly.io dan foydalaning. Start buyrug'i: `node server.js`. BOT_TOKEN, CHAT_ID va ADMIN_PASSWORD ni platformaning Environment bo'limiga kiriting.

Eslatma: Render bepul tarifida fayllar qayta ishga tushganda o'chib ketadi. Doimiy saqlash kerak bo'lsa, ma'lumotlarni bazaga o'tkazing.
