/** 列表行 `result` 字段（JSON 字符串）→ Airwallex 支付明细 */

export type PaymentDetailRow = {
  label: string;
  value: string;
};

export type PaymentDetailSection = {
  title: string;
  rows: PaymentDetailRow[];
};

const PAYMENT_STATUS_ZH: Record<string, string> = {
  AUTHORIZED: "已授权",
  CREATED: "已创建",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
  PENDING: "待处理",
};

const AUTH_RESULT_ZH: Record<string, string> = {
  not_attempted: "未验证",
  matched: "匹配",
  not_matched: "不匹配",
};

const FRAUD_ACTION_ZH: Record<string, string> = {
  VERIFY: "需验证",
  ACCEPT: "通过",
  REJECT: "拒绝",
};

const PAYMENT_METHOD_TYPE_ZH: Record<string, string> = {
  applepay: "Apple Pay",
  googlepay: "Google Pay",
  card: "银行卡",
};

const WALLET_METHOD_KEYS = ["applepay", "googlepay", "card"] as const;

const CARD_BRAND_ZH: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  unionpay: "银联",
  "union pay": "银联",
  amex: "Amex",
  discover: "Discover",
  jcb: "JCB",
};

function normalizeBrandSlug(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, "");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function pickRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = obj[key];
  return isRecord(v) ? v : null;
}

/** 从 payment_method 解析钱包 + tokenized_card（兼容 applepay / googlepay / card） */
function pickWalletTokenizedCard(paymentMethod: Record<string, unknown> | null): {
  walletType: string;
  card: Record<string, unknown> | null;
} | null {
  if (!paymentMethod) {
    return null;
  }
  const typeRaw = paymentMethod.type;
  const typeStr = typeof typeRaw === "string" ? typeRaw.trim().toLowerCase() : "";
  const keysToTry = typeStr
    ? [typeStr, ...WALLET_METHOD_KEYS.filter((k) => k !== typeStr)]
    : [...WALLET_METHOD_KEYS];
  for (const key of keysToTry) {
    const wallet = pickRecord(paymentMethod, key);
    if (wallet) {
      return { walletType: key, card: pickRecord(wallet, "tokenized_card") };
    }
  }
  return null;
}

/**
 * 支付组合：`googlepay-visa`、`applepay-unionpay`；无卡品牌时仅 `googlepay`。
 * 用于区分 Google Pay + Visa 与纯 Google Pay 等。
 */
export function formatPaymentMethodCombo(raw: Record<string, unknown>): string | null {
  const paymentMethod = pickRecord(raw, "payment_method");
  if (!paymentMethod) {
    return null;
  }
  const picked = pickWalletTokenizedCard(paymentMethod);
  const typeStr =
    (typeof paymentMethod.type === "string" ? paymentMethod.type.trim().toLowerCase() : "") ||
    picked?.walletType ||
    "";
  if (!typeStr) {
    return null;
  }
  const brandRaw = picked?.card?.brand;
  const brand =
    typeof brandRaw === "string" && brandRaw.trim() !== "" ? normalizeBrandSlug(brandRaw) : "";
  if (brand) {
    return `${typeStr}-${brand}`;
  }
  return typeStr;
}

export type PaymentMethodDisplay = {
  icons: string[];
  label: string;
};

const PAYMENT_ICON_BY_SLUG: Record<string, string> = {
  applepay: "/payment/applepay.svg",
  googlepay: "/payment/googlepay.svg",
  visa: "/payment/visa.svg",
  mastercard: "/payment/mastercard.svg",
  unionpay: "/payment/unionpay.svg",
  amex: "/payment/amex.svg",
  discover: "/payment/discover.svg",
  jcb: "/payment/jcb.svg",
};

function iconForPaymentSlug(slug: string): string | null {
  return PAYMENT_ICON_BY_SLUG[slug] ?? null;
}

/** 列表行展示：图标 + 文案（对齐 Airwallex 支付方式列） */
export function resolvePaymentMethodDisplay(raw: unknown): PaymentMethodDisplay | null {
  const parsed = parseOrderPaymentResult(raw);
  if (!parsed) {
    return null;
  }
  const combo = formatPaymentMethodCombo(parsed);
  if (!combo) {
    return null;
  }

  const dash = combo.indexOf("-");
  const wallet = (dash === -1 ? combo : combo.slice(0, dash)).toLowerCase();
  const brandSlug = dash === -1 ? "" : combo.slice(dash + 1);

  const icons: string[] = [];
  const walletIcon = wallet !== "card" ? iconForPaymentSlug(wallet) : null;
  const brandIcon = brandSlug ? iconForPaymentSlug(brandSlug) : null;

  if (walletIcon && wallet !== "card") {
    icons.push(walletIcon);
    if (brandIcon) {
      icons.push(brandIcon);
    }
  } else if (brandIcon) {
    icons.push(brandIcon);
  } else if (walletIcon) {
    icons.push(walletIcon);
  }

  const label =
    wallet !== "card" && PAYMENT_METHOD_TYPE_ZH[wallet]
      ? PAYMENT_METHOD_TYPE_ZH[wallet]
      : brandSlug
        ? (CARD_BRAND_ZH[brandSlug] ?? brandSlug)
        : (PAYMENT_METHOD_TYPE_ZH[wallet] ?? wallet);

  if (!label) {
    return null;
  }
  return { icons, label };
}

/** 支付组合中文说明，如「Google Pay · Visa」 */
export function formatPaymentMethodComboLabel(raw: Record<string, unknown>): string | null {
  const combo = formatPaymentMethodCombo(raw);
  if (!combo) {
    return null;
  }
  const dash = combo.indexOf("-");
  if (dash === -1) {
    return PAYMENT_METHOD_TYPE_ZH[combo.toLowerCase()] ?? combo;
  }
  const wallet = combo.slice(0, dash).toLowerCase();
  const brandSlug = combo.slice(dash + 1);
  const walletLabel = PAYMENT_METHOD_TYPE_ZH[wallet] ?? wallet;
  const brandLabel = CARD_BRAND_ZH[brandSlug] ?? brandSlug;
  return `${walletLabel} · ${brandLabel}`;
}

const CARD_TYPE_ZH: Record<string, string> = {
  CREDIT: "信用卡",
  DEBIT: "借记卡",
};

function formatScalar(key: string, value: unknown): string {
  if (value == null || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.map((x) => formatScalar(key, x)).join("、");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  const s = String(value);
  const low = s.toLowerCase();

  if (key === "status" && PAYMENT_STATUS_ZH[s]) {
    return PAYMENT_STATUS_ZH[s];
  }
  if ((key === "avs_result" || key === "cvc_result") && AUTH_RESULT_ZH[low]) {
    return AUTH_RESULT_ZH[low];
  }
  if (key === "action" && FRAUD_ACTION_ZH[s]) {
    return FRAUD_ACTION_ZH[s];
  }
  if (key === "type") {
    if (PAYMENT_METHOD_TYPE_ZH[low]) {
      return PAYMENT_METHOD_TYPE_ZH[low];
    }
    if (CARD_TYPE_ZH[s]) {
      return CARD_TYPE_ZH[s];
    }
  }
  if (key === "amount" || key === "captured_amount" || key === "refunded_amount") {
    const n = Number(s);
    if (Number.isFinite(n)) {
      return String(n);
    }
  }
  return s;
}

function row(label: string, value: unknown, key = label): PaymentDetailRow {
  return { label, value: formatScalar(key, value) };
}

function pushRows(
  rows: PaymentDetailRow[],
  source: Record<string, unknown> | null,
  fields: readonly { label: string; key: string }[],
): void {
  if (!source) {
    return;
  }
  for (const f of fields) {
    rows.push(row(f.label, source[f.key], f.key));
  }
}

/** 兼容 `d` 直接为支付 JSON，或包在 `payment` / `data` 内 */
export function normalizeOrderPaymentPayload(d: unknown): Record<string, unknown> | null {
  if (!isRecord(d)) {
    return null;
  }
  if (isRecord(d.payment)) {
    return d.payment;
  }
  if (isRecord(d.data) && (d.data.id != null || d.data.payment_intent_id != null)) {
    return d.data;
  }
  if (d.id != null || d.payment_intent_id != null || d.merchant_order_id != null) {
    return d;
  }
  return null;
}

/** 解析列表接口返回的 `result`（JSON 字符串或已解析对象） */
export function parseOrderPaymentResult(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === "") {
    return null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return null;
    }
    try {
      return normalizeOrderPaymentPayload(JSON.parse(trimmed) as unknown);
    } catch {
      return null;
    }
  }
  return normalizeOrderPaymentPayload(raw);
}

export function hasOrderPaymentResult(raw: unknown): boolean {
  return parseOrderPaymentResult(raw) != null;
}

export function buildOrderPaymentDetailSections(raw: Record<string, unknown>): PaymentDetailSection[] {
  const auth = pickRecord(raw, "authentication_data");
  const fraud = auth ? pickRecord(auth, "fraud_data") : null;
  const device = pickRecord(raw, "device_data");
  const browser = device ? pickRecord(device, "browser") : null;
  const paymentMethod = pickRecord(raw, "payment_method");
  const walletPick = pickWalletTokenizedCard(paymentMethod);
  const walletNode =
    paymentMethod && walletPick ? pickRecord(paymentMethod, walletPick.walletType) : null;
  const tokenizedCard = walletPick?.card ?? null;

  const combo = formatPaymentMethodCombo(raw);
  const comboLabel = formatPaymentMethodComboLabel(raw);

  const overview: PaymentDetailRow[] = [];
  if (combo) {
    overview.push({
      label: "支付组合",
      value: comboLabel ? `${comboLabel}（${combo}）` : combo,
    });
  }
  pushRows(overview, raw, [
    { label: "支付尝试 ID", key: "id" },
    { label: "状态", key: "status" },
    { label: "金额", key: "amount" },
    { label: "货币", key: "currency" },
    { label: "商户订单号", key: "merchant_order_id" },
    { label: "支付意向 ID", key: "payment_intent_id" },
    { label: "支付授权 ID", key: "payment_consent_id" },
    { label: "授权码", key: "authorization_code" },
    { label: "已捕获金额", key: "captured_amount" },
    { label: "已退款金额", key: "refunded_amount" },
    { label: "渠道交易号", key: "provider_transaction_id" },
    { label: "渠道响应码", key: "provider_original_response_code" },
    { label: "结算渠道", key: "settle_via" },
    { label: "创建时间", key: "created_at" },
    { label: "更新时间", key: "updated_at" },
  ]);

  const authentication: PaymentDetailRow[] = [];
  if (auth) {
    pushRows(authentication, auth, [
      { label: "AVS 结果", key: "avs_result" },
      { label: "CVC 结果", key: "cvc_result" },
    ]);
  }
  if (fraud) {
    pushRows(authentication, fraud, [
      { label: "风控动作", key: "action" },
      { label: "风控分数", key: "score" },
    ]);
    const riskFactors = fraud.risk_factors;
    if (Array.isArray(riskFactors) && riskFactors.length > 0) {
      authentication.push(row("风险因素", riskFactors.join("、")));
    }
  }

  const deviceRows: PaymentDetailRow[] = [];
  if (device) {
    pushRows(deviceRows, device, [
      { label: "IP 地址", key: "ip_address" },
      { label: "设备 ID", key: "device_id" },
      { label: "语言", key: "language" },
      { label: "时区", key: "timezone" },
      { label: "屏幕色深", key: "screen_color_depth" },
      { label: "屏幕高度", key: "screen_height" },
      { label: "屏幕宽度", key: "screen_width" },
    ]);
  }
  if (browser) {
    pushRows(deviceRows, browser, [{ label: "浏览器 UA", key: "user_agent" }]);
    if (browser.java_enabled != null) {
      deviceRows.push(row("Java 启用", browser.java_enabled, "java_enabled"));
    }
    if (browser.javascript_enabled != null) {
      deviceRows.push(row("JavaScript 启用", browser.javascript_enabled, "javascript_enabled"));
    }
  }

  const methodRows: PaymentDetailRow[] = [];
  if (paymentMethod) {
    pushRows(methodRows, paymentMethod, [
      { label: "支付方式 ID", key: "id" },
      { label: "支付方式", key: "type" },
      { label: "状态", key: "status" },
      { label: "客户 ID", key: "customer_id" },
      { label: "创建时间", key: "created_at" },
      { label: "更新时间", key: "updated_at" },
    ]);
    if (walletNode?.payment_data_type != null) {
      methodRows.push(row("钱包数据类型", walletNode.payment_data_type, "payment_data_type"));
    }
  }

  const cardRows: PaymentDetailRow[] = [];
  if (tokenizedCard) {
    pushRows(cardRows, tokenizedCard, [
      { label: "卡 BIN", key: "bin" },
      { label: "卡品牌", key: "brand" },
      { label: "卡类型", key: "type" },
      { label: "卡号后四位", key: "last4" },
      { label: "有效期（月）", key: "expiry_month" },
      { label: "有效期（年）", key: "expiry_year" },
      { label: "发卡行", key: "issuer_name" },
      { label: "发卡国家", key: "issuer_country_code" },
      { label: "指纹", key: "fingerprint" },
      { label: "商业卡", key: "is_commercial" },
    ]);
  }

  const sections: PaymentDetailSection[] = [{ title: "交易概览", rows: overview }];
  if (authentication.length > 0) {
    sections.push({ title: "认证与风控", rows: authentication });
  }
  if (deviceRows.length > 0) {
    sections.push({ title: "设备信息", rows: deviceRows });
  }
  if (methodRows.length > 0) {
    sections.push({ title: "支付方式", rows: methodRows });
  }
  if (cardRows.length > 0) {
    sections.push({ title: "卡片信息", rows: cardRows });
  }
  return sections;
}
