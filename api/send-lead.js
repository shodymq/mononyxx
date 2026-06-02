module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return response.status(500).json({
      error: "Telegram environment variables are not configured",
    });
  }

  let body = {};

  try {
    body = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
  } catch {
    return response.status(400).json({ error: "Invalid JSON body" });
  }

  const {
    language,
    name,
    contactMethod,
    contactMethodLabel,
    contactValue,
    projectType,
    budget,
    description,
    calcWhat,
    calcGoal,
    calcFeatures,
    calcTimeline,
    calcBudget,
    page,
  } = body;
  const requiredFields = [language, name, contactMethod, contactValue, projectType, budget, description];

  if (requiredFields.some((field) => typeof field !== "string" || field.trim() === "")) {
    return response.status(400).json({ error: "Missing required fields" });
  }

  const normalizedContactMethod = contactMethod.trim().toLowerCase();
  const normalizedContactValue = contactValue.trim();
  const contactLabels = {
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    email: "Email",
  };

  const isValidContact =
    (normalizedContactMethod === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContactValue)) ||
    (normalizedContactMethod === "telegram" && /^@?[a-zA-Z0-9_]{5,32}$/.test(normalizedContactValue)) ||
    (normalizedContactMethod === "whatsapp" && /^\+?[0-9\s()-]{7,20}$/.test(normalizedContactValue));

  if (!contactLabels[normalizedContactMethod] || !isValidContact) {
    return response.status(400).json({ error: "Invalid contact details" });
  }

  const escapeHtml = (value) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const readableContactMethod =
    typeof contactMethodLabel === "string" && contactMethodLabel.trim() !== ""
      ? contactMethodLabel.trim()
      : contactLabels[normalizedContactMethod];
  const readableContactValue =
    normalizedContactMethod === "telegram" && !normalizedContactValue.startsWith("@")
      ? `@${normalizedContactValue}`
      : normalizedContactValue;

  const messageParts = [
    "<b>Новая заявка с сайта MONONYXX</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(name.trim())}`,
    `<b>Телефон / WhatsApp:</b> <code>${escapeHtml(readableContactValue)}</code>`,
    `<b>Способ связи:</b> ${escapeHtml(readableContactMethod)}`,
    `<b>Услуга:</b> ${escapeHtml(projectType.trim())}`,
    `<b>Бюджет:</b> ${escapeHtml(budget.trim())}`,
    "",
    "<b>Сообщение:</b>",
    escapeHtml(description.trim()),
  ];

  const hasCalc = calcWhat || calcGoal || calcTimeline || calcBudget;
  if (hasCalc) {
    messageParts.push("", "<b>Калькулятор:</b>");
    if (calcWhat) messageParts.push(`Что хочет создать: ${escapeHtml(String(calcWhat))}`);
    if (calcGoal) messageParts.push(`Цель: ${escapeHtml(String(calcGoal))}`);
    if (calcFeatures) messageParts.push(`Что нужно внутри: ${escapeHtml(Array.isArray(calcFeatures) ? calcFeatures.join(", ") : String(calcFeatures))}`);
    if (calcTimeline) messageParts.push(`Сроки: ${escapeHtml(String(calcTimeline))}`);
    if (calcBudget) messageParts.push(`Бюджет (калькулятор): ${escapeHtml(String(calcBudget))}`);
  }

  if (page) messageParts.push("", `<b>Страница:</b> ${escapeHtml(String(page))}`);
  messageParts.push(`<b>Время:</b> ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}`);

  const message = messageParts.join("\n");

  const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!telegramResponse.ok) {
    return response.status(502).json({ error: "Failed to send Telegram message" });
  }

  return response.status(200).json({ ok: true });
};
