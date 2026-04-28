import type { OrderItem } from "@workspace/db";
import { SITE_URL_FALLBACK } from "./config";

const BRAND_COLOR = "#7c3aed";
const DARK_BG = "#0f0f11";
const CARD_BG = "#18181b";
const MUTED = "#71717a";
const TEXT = "#f4f4f5";
const LOGO_URL = "https://cloudvape.store/logo.png";

function baseTemplate(opts: {
  siteUrl?: string;
  preheader: string;
  content: string;
  unsubscribeUrl?: string;
}): string {
  const siteUrl = opts.siteUrl ?? SITE_URL_FALLBACK;
  const unsubscribeBlock = opts.unsubscribeUrl
    ? `<tr><td style="padding:16px 32px 32px;text-align:center;">
        <a href="${opts.unsubscribeUrl}" style="color:${MUTED};font-size:12px;font-family:monospace;text-decoration:underline;">Unsubscribe from marketing emails</a>
       </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>CloudVape</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${DARK_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${opts.preheader}&zwnj;&nbsp;&zwnj;&nbsp;</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${DARK_BG};padding:32px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="padding:0 0 24px;text-align:center;">
            <a href="${siteUrl}" style="text-decoration:none;">
              <span style="font-family:monospace;font-size:22px;font-weight:900;letter-spacing:0.05em;color:${TEXT};">Cloud<span style="color:${BRAND_COLOR};">Vape</span></span>
            </a>
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background:${CARD_BG};border-radius:12px;border:1px solid #27272a;padding:32px;">
            ${opts.content}
          </td>
        </tr>
        <!-- Unsubscribe -->
        ${unsubscribeBlock}
        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px 0;text-align:center;color:${MUTED};font-size:12px;font-family:monospace;line-height:1.6;">
            CloudVape &mdash; Keep it cloudy.<br/>
            Must be 21+ to purchase. Vaping products contain nicotine.<br/>
            <a href="${siteUrl}" style="color:${MUTED};text-decoration:underline;">${siteUrl}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:${TEXT};font-family:monospace;letter-spacing:0.03em;">${text}</h1>`;
}

function p(text: string, style = "") {
  return `<p style="margin:0 0 16px;color:${TEXT};font-size:15px;line-height:1.6;${style}">${text}</p>`;
}

function button(href: string, label: string) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="background:${BRAND_COLOR};border-radius:100px;padding:14px 32px;text-align:center;">
        <a href="${href}" style="color:#ffffff;font-family:monospace;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #27272a;margin:24px 0;"/>`;
}

function orderItemsTable(items: OrderItem[], subtotalCents: number, shippingCents: number, taxCents: number, totalCents: number): string {
  const rows = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 0;color:${TEXT};font-size:14px;border-bottom:1px solid #27272a;">${item.name}</td>
          <td style="padding:8px 0;color:${MUTED};font-size:14px;text-align:center;border-bottom:1px solid #27272a;">×${item.quantity}</td>
          <td style="padding:8px 0;color:${TEXT};font-size:14px;text-align:right;border-bottom:1px solid #27272a;">£${(item.priceCents * item.quantity / 100).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const shipping = shippingCents === 0 ? "FREE" : `£${(shippingCents / 100).toFixed(2)}`;

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <thead>
      <tr>
        <th style="padding:8px 0;color:${MUTED};font-size:12px;font-family:monospace;text-align:left;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #3f3f46;">Item</th>
        <th style="padding:8px 0;color:${MUTED};font-size:12px;font-family:monospace;text-align:center;border-bottom:1px solid #3f3f46;">Qty</th>
        <th style="padding:8px 0;color:${MUTED};font-size:12px;font-family:monospace;text-align:right;border-bottom:1px solid #3f3f46;">Price</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="2" style="padding:8px 0;color:${MUTED};font-size:13px;">Subtotal</td><td style="padding:8px 0;color:${TEXT};font-size:13px;text-align:right;">£${(subtotalCents/100).toFixed(2)}</td></tr>
      <tr><td colspan="2" style="padding:4px 0;color:${MUTED};font-size:13px;">Shipping</td><td style="padding:4px 0;color:${TEXT};font-size:13px;text-align:right;">${shipping}</td></tr>
      <tr><td colspan="2" style="padding:12px 0 4px;color:${TEXT};font-size:16px;font-weight:700;border-top:1px solid #3f3f46;">Total</td><td style="padding:12px 0 4px;color:${BRAND_COLOR};font-size:16px;font-weight:700;text-align:right;border-top:1px solid #3f3f46;">£${(totalCents/100).toFixed(2)}</td></tr>
      <tr><td colspan="3" style="padding:4px 0;color:${MUTED};font-size:11px;font-family:monospace;text-align:right;">VAT included</td></tr>
    </tfoot>
  </table>`;
}

export function verifyEmailTemplate(opts: {
  username: string;
  verifyUrl: string;
  siteUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = "Verify your CloudVape email address";
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: `Hi ${opts.username}, confirm your email to activate your CloudVape account.`,
    content: `
      ${h1("Verify Your Email")}
      ${p(`Hi ${opts.username}, thanks for signing up! Please confirm your email address to activate your account.`)}
      ${button(opts.verifyUrl, "Verify Email")}
      ${divider()}
      ${p(`This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `Verify your CloudVape email\n\nHi ${opts.username}, click the link below to verify your email and activate your account.\n\n${opts.verifyUrl}\n\nLink expires in 24 hours. If you didn't sign up, ignore this.\n\nCloudVape`;
  return { subject, html, text };
}

export function passwordResetTemplate(opts: {
  username: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "Reset your CloudVape password";
  const html = baseTemplate({
    preheader: `Hi ${opts.username}, click below to reset your CloudVape password. Link expires in 1 hour.`,
    content: `
      ${h1("Reset Your Password")}
      ${p(`Hi ${opts.username}, we received a request to reset your password.`)}
      ${button(opts.resetUrl, "Reset Password")}
      ${divider()}
      ${p(`This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your account is still secure.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `Reset your CloudVape password\n\nHi ${opts.username}, click the link below to reset your password.\n\n${opts.resetUrl}\n\nLink expires in 1 hour. If you didn't request this, ignore this email.\n\nCloudVape`;
  return { subject, html, text };
}

export function welcomeTemplate(opts: { username: string; siteUrl: string }): { subject: string; html: string; text: string } {
  const { username, siteUrl } = opts;
  const subject = `Welcome to CloudVape, ${username}!`;
  const html = baseTemplate({
    siteUrl,
    preheader: `Thanks for joining CloudVape, ${username}. Your account is ready.`,
    content: `
      ${h1(`Welcome, ${username}!`)}
      ${p("You've just joined the CloudVape community — the home for cloud chasers and flavour enthusiasts.")}
      ${p("Browse the shop, join the forum, and share your builds.")}
      ${button(`${siteUrl}/shop`, "Start Shopping")}
      ${divider()}
      ${p(`Keep it cloudy.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `Welcome to CloudVape, ${username}!\n\nYour account is ready. Browse the shop at ${siteUrl}/shop\n\nKeep it cloudy.\nCloudVape`;
  return { subject, html, text };
}

export function orderConfirmationTemplate(opts: {
  customerName: string;
  orderNumber: string;
  items: OrderItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Order confirmed — ${opts.orderNumber}`;
  const orderUrl = `${opts.siteUrl}/order/${opts.orderNumber}`;
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: `Your CloudVape order ${opts.orderNumber} is confirmed and being prepared.`,
    content: `
      ${h1("Order Confirmed")}
      ${p(`Hi ${opts.customerName}, thanks for your order! We'll have it packed and dispatched shortly.`)}
      <p style="margin:0 0 8px;color:${MUTED};font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Order Number</p>
      <p style="margin:0 0 24px;color:${BRAND_COLOR};font-size:20px;font-weight:800;font-family:monospace;">${opts.orderNumber}</p>
      ${orderItemsTable(opts.items, opts.subtotalCents, opts.shippingCents, opts.taxCents, opts.totalCents)}
      ${divider()}
      <p style="margin:0 0 4px;color:${MUTED};font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Shipping to</p>
      <p style="margin:0 0 24px;color:${TEXT};font-size:14px;line-height:1.6;">${opts.shippingAddress}<br/>${opts.shippingCity}${opts.shippingState ? `, ${opts.shippingState}` : ""}<br/>${opts.shippingZip}</p>
      ${button(orderUrl, "View Order")}
    `,
  });
  const text = `Order Confirmed — ${opts.orderNumber}\n\nHi ${opts.customerName}, your order is confirmed.\n\nItems:\n${opts.items.map((i) => `  ${i.name} x${i.quantity} — £${(i.priceCents * i.quantity / 100).toFixed(2)}`).join("\n")}\n\nTotal: £${(opts.totalCents / 100).toFixed(2)} (VAT included)\n\nTrack your order: ${orderUrl}\n\nCloudVape`;
  return { subject, html, text };
}

export function shippingUpdateTemplate(opts: {
  customerName: string;
  orderNumber: string;
  trackingNumber?: string;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your order ${opts.orderNumber} has shipped!`;
  const orderUrl = `${opts.siteUrl}/order/${opts.orderNumber}`;
  const trackingBlock = opts.trackingNumber
    ? `<p style="margin:0 0 8px;color:${MUTED};font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Tracking Number</p>
       <p style="margin:0 0 24px;color:${BRAND_COLOR};font-size:18px;font-weight:700;font-family:monospace;">${opts.trackingNumber}</p>`
    : "";
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: `Great news — your CloudVape order ${opts.orderNumber} is on its way!`,
    content: `
      ${h1("Your Order Has Shipped")}
      ${p(`Hi ${opts.customerName}, your CloudVape order is on its way!`)}
      ${trackingBlock}
      ${button(orderUrl, "Track My Order")}
      ${divider()}
      ${p("Typically delivers within 3–5 business days.", `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `Your order ${opts.orderNumber} has shipped!\n\nHi ${opts.customerName}, your order is on its way.${opts.trackingNumber ? `\n\nTracking: ${opts.trackingNumber}` : ""}\n\nView order: ${orderUrl}\n\nCloudVape`;
  return { subject, html, text };
}

export function deliveryConfirmationTemplate(opts: {
  customerName: string;
  orderNumber: string;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your order ${opts.orderNumber} has been delivered`;
  const orderUrl = `${opts.siteUrl}/order/${opts.orderNumber}`;
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: `Your CloudVape order ${opts.orderNumber} has been delivered. Enjoy!`,
    content: `
      ${h1("Delivered!")}
      ${p(`Hi ${opts.customerName}, your CloudVape order has arrived. Enjoy your new gear!`)}
      ${button(orderUrl, "View Order")}
      ${divider()}
      ${p(`Something not right? Reply to this email and we'll sort it out.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `Your order ${opts.orderNumber} has been delivered!\n\nHi ${opts.customerName}, your order has arrived. Enjoy!\n\nView order: ${orderUrl}\n\nCloudVape`;
  return { subject, html, text };
}

export function refundConfirmationTemplate(opts: {
  customerName: string;
  orderNumber: string;
  totalCents: number;
  siteUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Refund processed for order ${opts.orderNumber}`;
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: `Your refund of £${(opts.totalCents / 100).toFixed(2)} for order ${opts.orderNumber} has been processed.`,
    content: `
      ${h1("Refund Processed")}
      ${p(`Hi ${opts.customerName}, your refund has been processed.`)}
      <p style="margin:0 0 4px;color:${MUTED};font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Amount Refunded</p>
      <p style="margin:0 0 24px;color:${BRAND_COLOR};font-size:24px;font-weight:800;font-family:monospace;">£${(opts.totalCents / 100).toFixed(2)}</p>
      ${p("Please allow 5–10 business days for the funds to appear on your statement depending on your payment provider.")}
      ${divider()}
      ${p(`Questions? Reply to this email and we'll help.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `Refund processed for order ${opts.orderNumber}\n\nHi ${opts.customerName}, a refund of £${(opts.totalCents / 100).toFixed(2)} has been processed. Allow 5–10 business days.\n\nCloudVape`;
  return { subject, html, text };
}

export function reviewRequestTemplate(opts: {
  customerName: string;
  orderNumber: string;
  items: OrderItem[];
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `How was your CloudVape order? Share your feedback`;
  const reviewUrl = `${opts.siteUrl}/forum/new`;
  const productName = opts.items[0]?.name ?? "your recent purchase";
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: `Enjoying ${productName}? We'd love to hear your thoughts.`,
    content: `
      ${h1("How's the Gear?")}
      ${p(`Hi ${opts.customerName}, it's been a few days since your order arrived — how are you getting on?`)}
      ${p(`Share your thoughts on ${productName} in the community forum. Your review helps other vapers make great choices.`)}
      ${button(reviewUrl, "Write a Review")}
      ${divider()}
      ${p(`Order ${opts.orderNumber}`, `color:${MUTED};font-size:12px;font-family:monospace;`)}
    `,
  });
  const text = `How was your CloudVape order?\n\nHi ${opts.customerName}, how are you getting on with ${productName}?\n\nShare your thoughts: ${reviewUrl}\n\nCloudVape`;
  return { subject, html, text };
}

export function newsletterConfirmTemplate(opts: {
  confirmUrl: string;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "Confirm your CloudVape newsletter subscription";
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: "One click to confirm your subscription to CloudVape drops & deals.",
    content: `
      ${h1("Confirm Your Subscription")}
      ${p("You asked to subscribe to CloudVape's drops & deals newsletter. Click the button below to confirm.")}
      ${button(opts.confirmUrl, "Confirm Subscription")}
      ${divider()}
      ${p(`If you didn't request this, you can safely ignore this email.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `Confirm your CloudVape newsletter subscription\n\nClick to confirm: ${opts.confirmUrl}\n\nIf you didn't request this, ignore this email.\n\nCloudVape`;
  return { subject, html, text };
}

export function ticketConfirmationTemplate(opts: {
  customerName: string;
  ticketId: number;
  category: string;
  siteUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `[#${opts.ticketId}] We received your message — CloudVape Support`;
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: `Ticket #${opts.ticketId} confirmed — we'll reply to this email thread.`,
    content: `
      ${h1("We've Got Your Message")}
      ${p(`Hi ${opts.customerName}, thanks for reaching out. Your support request has been logged and our team will be in touch shortly.`)}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background:#0f0f11;border-radius:8px;border:1px solid #27272a;padding:16px;">
        <tr>
          <td style="color:#71717a;font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Ticket</td>
          <td style="color:#f4f4f5;font-size:14px;font-family:monospace;text-align:right;">#${opts.ticketId}</td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;padding-top:8px;">Topic</td>
          <td style="color:#f4f4f5;font-size:14px;font-family:monospace;text-align:right;padding-top:8px;">${opts.category}</td>
        </tr>
      </table>
      ${divider()}
      ${p(`You can reply directly to this email to add more information to your ticket. Please keep the ticket number in the subject line so your reply threads correctly.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `CloudVape Support — Ticket #${opts.ticketId} confirmed\n\nHi ${opts.customerName}, we've received your message and will reply shortly.\n\nTicket: #${opts.ticketId}\nTopic: ${opts.category}\n\nYou can reply to this email to add more details.\n\nCloudVape Support`;
  return { subject, html, text };
}

export function ticketReplyTemplate(opts: {
  customerName: string;
  ticketId: number;
  replyBody: string;
  siteUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `[#${opts.ticketId}] Reply from CloudVape Support`;
  const escaped = opts.replyBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const safeBody = escaped.replace(/\n/g, "<br/>");
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: `New reply on your CloudVape support ticket #${opts.ticketId}.`,
    content: `
      ${h1("Reply from CloudVape Support")}
      ${p(`Hi ${opts.customerName}, here's our response to your support ticket #${opts.ticketId}:`)}
      <div style="background:#0f0f11;border-radius:8px;border:1px solid #27272a;padding:20px;margin:16px 0;color:#f4f4f5;font-size:15px;line-height:1.7;">${safeBody}</div>
      ${divider()}
      ${p(`You can reply directly to this email if you have follow-up questions. Please keep the ticket number in the subject so your reply threads correctly.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `CloudVape Support — Reply to ticket #${opts.ticketId}\n\nHi ${opts.customerName},\n\n${opts.replyBody}\n\nReply to this email if you have further questions.\n\nCloudVape Support`;
  return { subject, html, text };
}

export function supplierSyncFailureTemplate(opts: {
  supplierName: string;
  errorMessage: string;
  importHistoryUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `[CloudVape] Scheduled supplier sync failed — ${opts.supplierName}`;
  const escaped = opts.errorMessage
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const html = baseTemplate({
    preheader: `The scheduled import for supplier "${opts.supplierName}" failed. Action may be required.`,
    content: `
      ${h1("Supplier Sync Failed")}
      ${p(`The scheduled import for <strong style="color:${TEXT};">${opts.supplierName}</strong> encountered an error and did not complete.`)}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background:#0f0f11;border-radius:8px;border:1px solid #3f1a1a;padding:16px;">
        <tr>
          <td style="color:#71717a;font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:8px;">Supplier</td>
          <td style="color:#f4f4f5;font-size:14px;font-family:monospace;text-align:right;padding-bottom:8px;">${opts.supplierName}</td>
        </tr>
        <tr>
          <td colspan="2" style="color:#71717a;font-size:12px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;padding-top:8px;padding-bottom:4px;">Error</td>
        </tr>
        <tr>
          <td colspan="2" style="color:#fca5a5;font-size:13px;font-family:monospace;line-height:1.6;word-break:break-word;">${escaped}</td>
        </tr>
      </table>
      ${p("Please check the supplier's feed URL or data format and fix the issue before the next scheduled run.")}
      ${button(opts.importHistoryUrl, "View Import History")}
      ${divider()}
      ${p(`This is an automated alert from the CloudVape admin system.`, `color:${MUTED};font-size:13px;`)}
    `,
  });
  const text = `[CloudVape] Scheduled supplier sync failed — ${opts.supplierName}\n\nThe scheduled import for "${opts.supplierName}" encountered an error and did not complete.\n\nError: ${opts.errorMessage}\n\nView Import History: ${opts.importHistoryUrl}\n\nPlease fix the supplier's feed URL or data format before the next scheduled run.\n\nCloudVape Admin`;
  return { subject, html, text };
}

export function marketingBroadcastTemplate(opts: {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  unsubscribeUrl: string;
  siteUrl: string;
}): { subject: string; html: string; text: string } {
  const html = baseTemplate({
    siteUrl: opts.siteUrl,
    preheader: opts.bodyText.slice(0, 100),
    unsubscribeUrl: opts.unsubscribeUrl,
    content: `
      ${h1(opts.subject)}
      <div style="color:${TEXT};font-size:15px;line-height:1.7;">${opts.bodyHtml}</div>
      ${divider()}
      ${button(opts.siteUrl, "Visit the Shop")}
    `,
  });
  const text = `${opts.subject}\n\n${opts.bodyText}\n\nVisit the shop: ${opts.siteUrl}\n\nUnsubscribe: ${opts.unsubscribeUrl}\n\nCloudVape`;
  return { subject: opts.subject, html, text };
}
