const BOT = '8754061556:AAHnJ5Shj7DEMIQzuFJKeG4ShG6jC0mytdo';
const SB  = 'https://zbvpqbyppbonjyegiuke.supabase.co';
const SK  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidnBxYnlwcGJvbmp5ZWdpdWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTMxOTcsImV4cCI6MjA5MzgyOTE5N30.wLJyd1oMFAqD78ugLgDniTWVuhL0VLznwt632hW5IIc';
const ADMIN_ID = '867409233';
const SITE = 'https://glowjp.vercel.app';

const H = { apikey: SK, Authorization: `Bearer ${SK}` };

async function tg(chat_id, text, markup = null) {
  const body = { chat_id, text, parse_mode: 'HTML' };
  if (markup) body.reply_markup = JSON.stringify(markup);
  await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function tgEdit(chat_id, message_id, text) {
  await fetch(`https://api.telegram.org/bot${BOT}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, message_id, text, parse_mode: 'HTML' })
  });
}

async function tgAnswer(callback_query_id, text) {
  await fetch(`https://api.telegram.org/bot${BOT}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id, text, show_alert: false })
  });
}

async function dbUpdate(order_number, status) {
  const res = await fetch(`${SB}/rest/v1/orders?order_number=eq.${order_number}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return res.ok;
}

async function getOrder(order_number) {
  const res = await fetch(`${SB}/rest/v1/orders?order_number=eq.${order_number}&select=*`, {
    headers: H
  });
  const data = await res.json();
  return Array.isArray(data) && data.length ? data[0] : null;
}

// Mijoz Telegram ID sini saqlash
async function saveUserTgId(phone, tg_id) {
  // orders jadvalida tg_chat_id maydoniga saqlaymiz
  await fetch(`${SB}/rest/v1/orders?phone=eq.${encodeURIComponent(phone)}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tg_chat_id: String(tg_id) })
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'OK' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 200, body: 'OK' }; }

  // ============ /start va /orders xabarlari ============
  if (body.message) {
    const msg = body.message;
    const chat_id = msg.chat.id;
    const text = msg.text || '';
    const first = msg.chat.first_name || 'Mehmon';

    // /start
    if (text.startsWith('/start')) {
      await tg(chat_id,
        `Assalomu alaykum, <b>${first}</b>! 🌸\n\n` +
        `<b>GLOWJP</b> — Yaponiyadan sifatli mahsulotlar 🇯🇵\n\n` +
        `🛍️ <b>Do'konimizga o'ting:</b>\n${SITE}\n\n` +
        `📦 Buyurtmalaringizni kuzatish uchun:\n/orders <i>telefon</i>\nMisol: /orders +998901234567\n\n` +
        `📩 Murojaat uchun:\n/help`,
        {
          inline_keyboard: [[
            { text: '🛍️ Do\'konga kirish', url: SITE }
          ], [
            { text: '📦 Buyurtmalarim', callback_data: 'my_orders' },
            { text: '📩 Murojaat', callback_data: 'appeal' }
          ]]
        }
      );
    }

    // /orders +998901234567
    else if (text.startsWith('/orders')) {
      const phone = text.split(' ')[1];
      if (!phone) {
        await tg(chat_id, '📱 Telefon raqamingizni kiriting:\n/orders +998901234567');
      } else {
        const res = await fetch(`${SB}/rest/v1/orders?phone=eq.${encodeURIComponent(phone)}&order=created_at.desc&limit=5`, { headers: H });
        const orders = await res.json();
        if (!Array.isArray(orders) || !orders.length) {
          await tg(chat_id, '❌ Bu raqam bilan buyurtma topilmadi.');
        } else {
          const statusEmoji = { 'Qabul qilindi': '⏳', "Jo'natildi": '🚚', 'Yetkazildi': '✅', 'Bekor qilindi': '❌' };
          const list = orders.map(o =>
            `${statusEmoji[o.status] || '📦'} <b>${o.order_number}</b> — ${o.status}\n` +
            `💰 ${parseInt(o.total).toLocaleString()} so'm\n` +
            `📅 ${new Date(o.created_at).toLocaleDateString('uz')}`
          ).join('\n\n');
          await tg(chat_id, `📦 <b>So'nggi buyurtmalaringiz:</b>\n\n${list}`);
          // Telefon bilan TG ID ni bog'laymiz
          await saveUserTgId(phone, chat_id);
        }
      }
    }

    // /help
    else if (text.startsWith('/help')) {
      await tg(chat_id,
        `❓ <b>Yordam</b>\n\n` +
        `📦 /orders +998XXXXXXXXX — Buyurtmalaringiz\n` +
        `🛍️ Do'kon: ${SITE}\n\n` +
        `📩 Murojaat uchun do'konimizga kiring va "Murojaat" bo'limini tanlang.\n\n` +
        `👩‍💼 Admin: @LYF29`
      );
    }
  }

  // ============ Inline tugmalar (admin bosadi) ============
  if (body.callback_query) {
    const cq = body.callback_query;
    const cqId = cq.id;
    const chat_id = cq.message.chat.id;
    const message_id = cq.message.message_id;
    const data = cq.data;

    // Buyurtma holati o'zgartirish
    // callback_data format: status_ORD-123456_accepted
    if (data.startsWith('status_')) {
      const parts = data.split('_');
      const action = parts[parts.length - 1];
      const orderNum = parts.slice(1, parts.length - 1).join('_');

      const statusMap = {
        accepted: 'Qabul qilindi',
        sent: "Jo'natildi",
        cancel: 'Bekor qilindi',
        done: 'Yetkazildi'
      };
      const newStatus = statusMap[action];
      if (!newStatus) { await tgAnswer(cqId, 'Xato!'); return { statusCode: 200, body: 'OK' }; }

      await dbUpdate(orderNum, newStatus);
      await tgAnswer(cqId, `✅ ${newStatus}`);

      // Admin xabarini yangilash
      const order = await getOrder(orderNum);
      if (order) {
        const statusEmoji = { 'Qabul qilindi': '⏳', "Jo'natildi": '🚚', 'Yetkazildi': '✅', 'Bekor qilindi': '❌' };
        await tgEdit(chat_id, message_id,
          `${statusEmoji[newStatus]} <b>BUYURTMA: ${newStatus.toUpperCase()}</b>\n\n` +
          `🔖 ${order.order_number}\n👤 ${order.customer_name}\n📞 ${order.phone}\n` +
          `📍 ${order.address}\n💳 ${order.payment_method}\n💰 ${parseInt(order.total).toLocaleString()} so'm`
        );

        // Mijozga xabar yuborish (agar TG ID saqlangan bo'lsa)
        if (order.tg_chat_id) {
          const userMsg = {
            'Qabul qilindi': `⏳ Buyurtmangiz qabul qilindi!\n🔖 ${order.order_number}\nTez orada bog'lanamiz 🌸`,
            "Jo'natildi": `🚚 Buyurtmangiz jo'natildi!\n🔖 ${order.order_number}\n📍 Cargo orqali 3-5 kun ichida yetib boradi`,
            'Yetkazildi': `✅ Buyurtmangiz yetkazildi!\n🔖 ${order.order_number}\nXarid uchun rahmat! 🌸 GLOWJP`,
            'Bekor qilindi': `❌ Buyurtmangiz bekor qilindi.\n🔖 ${order.order_number}\nSavol bo'lsa: @LYF29`
          };
          if (userMsg[newStatus]) {
            await tg(order.tg_chat_id, userMsg[newStatus]);
          }
        }
      }
    }

    // Mijoz "Buyurtmalarim" tugmasini bosadi
    if (data === 'my_orders') {
      await tgAnswer(cqId, '');
      await tg(chat_id,
        '📱 Buyurtmalaringizni ko\'rish uchun telefon raqamingizni yuboring:\n\n' +
        '/orders +998901234567'
      );
    }

    // Mijoz "Murojaat" tugmasini bosadi
    if (data === 'appeal') {
      await tgAnswer(cqId, '');
      await tg(chat_id,
        `📩 Murojaat uchun do'konimizga kiring:\n${SITE}\n\n` +
        `Yoki to'g'ridan-to'g'ri adminga yozing: @LYF29`
      );
    }
  }

  return { statusCode: 200, body: 'OK' };
};
