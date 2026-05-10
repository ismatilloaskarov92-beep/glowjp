const BOT = '8754061556:AAHnJ5Shj7DEMIQzuFJKeG4ShG6jC0mytdo';
const SB  = 'https://zbvpqbyppbonjyegiuke.supabase.co';
const SK  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidnBxYnlwcGJvbmp5ZWdpdWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTMxOTcsImV4cCI6MjA5MzgyOTE5N30.wLJyd1oMFAqD78ugLgDniTWVuhL0VLznwt632hW5IIc';
const ADMIN_ID = '867409233';
const SITE = 'https://glowjp.vercel.app';
const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };

async function tg(chat_id, text, markup = null) {
  const body = { chat_id, text, parse_mode: 'HTML' };
  if (markup) body.reply_markup = JSON.stringify(markup);
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

async function dbQ(table, filter = '') {
  const r = await fetch(`${SB}/rest/v1/${table}?${filter}&order=created_at.desc`, { headers: H });
  return r.json();
}

async function dbU_by_field(table, field, value, data) {
  await fetch(`${SB}/rest/v1/${table}?${field}=eq.${encodeURIComponent(value)}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(data)
  });
}

async function dbU(table, id, data) {
  await fetch(`${SB}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH', headers: H, body: JSON.stringify(data)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const body = req.body;
  const msg = body.message;
  const cb  = body.callback_query;

  if (msg) {
    const chat_id = msg.chat.id;
    const name = msg.from.first_name || 'Mijoz';
    const text = msg.text || '';

    if (text === '/start') {
      await tg(chat_id,
        `Assalomu alaykum, <b>${name}</b>! 🌸\n\nGLOWJP — Yaponiyadan sifatli mahsulotlar 🇯🇵\n\n🛍️ Do'konimizga o'ting:\n${SITE}`,
        { inline_keyboard: [
          [{ text: "🛍️ Do'konga kirish", url: SITE }],
          [{ text: "📦 Buyurtmalarim", callback_data: 'my_orders' },
           { text: "📩 Murojaat", callback_data: 'appeal' }]
        ]}
      );
    }
    if (text === '/help') {
      await tg(chat_id, `❓ <b>Yordam</b>\n\nSavollar uchun: @LYF29\nDo'kon: ${SITE}`);
    }
  }

  if (cb) {
    const chat_id = cb.from.id;
    const data = cb.data;

    // Buyurtma holati o'zgartirish
    if (data.startsWith('status_')) {
      const parts = data.split('_');
      const orderNum = parts[1];
      const action = parts[2];
      const statusMap = { accepted: 'Qabul qilindi', sent: "Jo'natildi", cancel: 'Bekor qilindi' };
      const status = statusMap[action];
      if (status) {
        await dbU_by_field('orders', 'order_number', orderNum, { status });
        await tg(ADMIN_ID, `✅ ${orderNum} — <b>${status}</b>`);
      }
    }

    // To'lov tasdiqlash - BOT inline tugmasi
    if (data.startsWith('pay_confirm_')) {
      const orderNum = data.replace('pay_confirm_', '');
      const payments = await dbQ('payments', `order_number=eq.${orderNum}`);
      if (Array.isArray(payments) && payments[0]) {
        // Payment statusini yangilaymiz
        await dbU('payments', payments[0].id, { status: 'Tasdiqlandi' });
        // Order statusini ham yangilaymiz - order_number bo'yicha
        await dbU_by_field('orders', 'order_number', orderNum, { status: 'Qabul qilindi' });
        await tg(ADMIN_ID, `✅ To'lov tasdiqlandi: <b>${orderNum}</b>\nBuyurtma "Qabul qilindi" ga o'zgartirildi`);
        // Mijozga xabar
        await tg(payments[0].phone, `✅ <b>TO'LOV TASDIQLANDI!</b>\n\n🔖 ${orderNum}\n💰 ${parseInt(payments[0].amount).toLocaleString()} so'm\n\nBuyurtmangiz tez orada jo'natiladi 🌸`).catch(()=>{});
      }
    }

    // To'lov rad etish
    if (data.startsWith('pay_reject_')) {
      const orderNum = data.replace('pay_reject_', '');
      const payments = await dbQ('payments', `order_number=eq.${orderNum}`);
      if (Array.isArray(payments) && payments[0]) {
        await dbU('payments', payments[0].id, { status: 'Rad etildi' });
        await tg(ADMIN_ID, `❌ To'lov rad etildi: ${orderNum}`);
      }
    }

    // Callback javob
    await fetch(`https://api.telegram.org/bot${BOT}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cb.id })
    }).catch(() => {});
  }

  res.status(200).send('OK');
}
