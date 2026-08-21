const { randomUUID } = require("crypto");

const META_PIXEL_ID = "1580816737123369";
const DEFAULT_META_GRAPH_VERSION = "v26.0";

const firstHeaderValue = (value) => {
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
};

const getClientIpAddress = (request) => {
  const forwardedFor = firstHeaderValue(request.headers["x-forwarded-for"]);
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return firstHeaderValue(request.headers["x-real-ip"]).trim();
};

const sendMetaLeadEvent = async ({
  eventId,
  eventSourceUrl,
  clientIpAddress,
  clientUserAgent,
  fbp,
  fbc,
}) => {
  const accessToken = process.env.FB_CAPI_ACCESS_TOKEN;
  if (!accessToken) return { sent: false, reason: "not_configured" };

  const graphVersion = /^v\d+\.\d+$/.test(process.env.FB_GRAPH_API_VERSION || "")
    ? process.env.FB_GRAPH_API_VERSION
    : DEFAULT_META_GRAPH_VERSION;
  const userData = {
    client_ip_address: clientIpAddress,
    client_user_agent: clientUserAgent,
  };

  if (typeof fbp === "string" && fbp.trim()) userData.fbp = fbp.trim();
  if (typeof fbc === "string" && fbc.trim()) userData.fbc = fbc.trim();

  const payload = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: userData,
        custom_data: {
          content_name: "sait_target_campaign",
          value: 0,
          currency: "KZT",
        },
      },
    ],
  };

  const testEventCode = process.env.FB_CAPI_TEST_EVENT_CODE;
  if (testEventCode) payload.test_event_code = testEventCode;

  try {
    const metaResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const metaResult = await metaResponse.json().catch(() => ({}));

    if (!metaResponse.ok) {
      console.error("Meta CAPI Lead failed", {
        status: metaResponse.status,
        message: metaResult?.error?.message || "Unknown Meta API error",
      });
      return { sent: false, reason: "meta_api_error" };
    }

    return { sent: true };
  } catch (error) {
    console.error("Meta CAPI Lead request failed", {
      message: error instanceof Error ? error.message : "Unknown request error",
    });
    return { sent: false, reason: "network_error" };
  }
};

module.exports = async function handler(request, response) {
  const allowedOrigins = new Set([
    "https://mononyxx.com",
    "https://www.mononyxx.com",
    "https://mononyxx.vercel.app",
    "https://stitchmononyxxpremiumwebinterface.vercel.app",
  ]);
  const requestOrigin = request.headers.origin;

  if (allowedOrigins.has(requestOrigin)) {
    response.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }

  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Max-Age", "86400");

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

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
    privacyConsent,
    event_id: eventId,
    event_source_url: eventSourceUrl,
    fbp,
    fbc,
  } = body;
  const requiredFields = [language, name, contactMethod, contactValue, projectType, budget, description];

  if (requiredFields.some((field) => typeof field !== "string" || field.trim() === "")) {
    return response.status(400).json({ error: "Missing required fields" });
  }

  if (privacyConsent !== true) {
    return response.status(400).json({ error: "Privacy consent is required" });
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

  const normalizedEventId =
    typeof eventId === "string" && /^[a-zA-Z0-9._:-]{8,128}$/.test(eventId.trim())
      ? eventId.trim()
      : randomUUID();
  let normalizedEventSourceUrl = requestOrigin || "https://mononyxx.com/";

  if (typeof eventSourceUrl === "string") {
    try {
      const parsedSourceUrl = new URL(eventSourceUrl);
      if (allowedOrigins.has(parsedSourceUrl.origin)) normalizedEventSourceUrl = parsedSourceUrl.href;
    } catch {
      // Fall back to the validated request origin.
    }
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

  const message = [
    "<b>Новая заявка на проект MONONYXX</b>",
    "",
    "<b>Клиент</b>",
    `<b>Имя:</b> ${escapeHtml(name.trim())}`,
    `<b>Способ связи:</b> ${escapeHtml(readableContactMethod)}`,
    `<b>Контакт:</b> <code>${escapeHtml(readableContactValue)}</code>`,
    "",
    "<b>Проект</b>",
    `<b>Тип проекта:</b> ${escapeHtml(projectType.trim())}`,
    `<b>Бюджет:</b> ${escapeHtml(budget.trim())}`,
    `<b>Язык формы:</b> ${escapeHtml(language.toUpperCase())}`,
    "",
    "<b>Описание:</b>",
    escapeHtml(description.trim()),
  ].join("\n");

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

  const capiResult = await sendMetaLeadEvent({
    eventId: normalizedEventId,
    eventSourceUrl: normalizedEventSourceUrl,
    clientIpAddress: getClientIpAddress(request),
    clientUserAgent: firstHeaderValue(request.headers["user-agent"]),
    fbp,
    fbc,
  });

  return response.status(200).json({ ok: true, capi: capiResult.sent });
};
