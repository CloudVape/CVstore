import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, helpCategoriesTable, helpArticlesTable } from "@workspace/db";

const router: IRouter = Router();

const SEED_CATEGORIES = [
  { slug: "orders-shipping", name: "Orders & Shipping", description: "Order status, shipping times, and tracking.", sortOrder: 1 },
  { slug: "returns-refunds", name: "Returns & Refunds", description: "How to return items and get refunds.", sortOrder: 2 },
  { slug: "product-questions", name: "Product Questions", description: "Questions about our vaping products.", sortOrder: 3 },
  { slug: "account", name: "Account", description: "Managing your CloudVape account.", sortOrder: 4 },
  { slug: "legal-age-verification", name: "Legal & Age Verification", description: "Age requirements and legal information.", sortOrder: 5 },
];

const SEED_ARTICLES = [
  {
    categorySlug: "orders-shipping",
    slug: "how-long-does-shipping-take",
    title: "How long does shipping take?",
    body: `Standard shipping takes 3–7 business days. Expedited shipping (2 business days) is available at checkout for an additional fee.\n\nOrders placed before 3pm EST on business days are dispatched the same day. Orders placed after 3pm or on weekends ship the next business day.\n\nFree standard shipping is included on all orders over $50.`,
    published: true,
  },
  {
    categorySlug: "orders-shipping",
    slug: "how-do-i-track-my-order",
    title: "How do I track my order?",
    body: `Once your order has shipped, you'll receive a shipping confirmation email containing your tracking number.\n\nYou can track your package directly on the carrier's website using the tracking number provided. If you haven't received a tracking email within 2 business days of placing your order, please contact our support team.`,
    published: true,
  },
  {
    categorySlug: "orders-shipping",
    slug: "which-states-do-you-ship-to",
    title: "Which states do you ship to?",
    body: `CloudVape ships to all US states where the sale of vaping products is legally permitted. Due to local regulations, we are currently unable to ship to certain jurisdictions.\n\nAll shipments require an adult signature upon delivery (21+). Our carrier will make up to three delivery attempts before returning the package.\n\nWe do not currently ship internationally.`,
    published: true,
  },
  {
    categorySlug: "returns-refunds",
    slug: "what-is-your-return-policy",
    title: "What is your return policy?",
    body: `We accept returns on unopened, unused products within 30 days of delivery. Items must be in their original packaging.\n\n**We cannot accept returns on:**\n- Opened e-liquid or nicotine products\n- Used coils, pods, or cartridges\n- Items damaged through misuse\n\nTo initiate a return, contact our support team with your order number. We'll send you a pre-paid return label. Refunds are processed within 5–7 business days of receiving the returned item.`,
    published: true,
  },
  {
    categorySlug: "returns-refunds",
    slug: "my-item-arrived-damaged",
    title: "My item arrived damaged — what do I do?",
    body: `We're sorry to hear your order arrived damaged! Please contact our support team within 7 days of delivery with:\n\n1. Your order number\n2. A photo of the damaged item and packaging\n3. A brief description of the damage\n\nWe'll arrange a replacement or full refund promptly, at no cost to you. You won't need to return the damaged item.`,
    published: true,
  },
  {
    categorySlug: "product-questions",
    slug: "nicotine-free-options",
    title: "Do you sell nicotine-free products?",
    body: `Yes! CloudVape carries a range of nicotine-free options including:\n\n- **0mg e-liquids** — all the flavour, no nicotine\n- **Herbal vaporizers** — designed for dry herbs\n- **Hardware** — all our devices and mods are nicotine-free hardware\n\nFilter by "0mg nicotine" in the shop to see all nicotine-free liquid options.`,
    published: true,
  },
  {
    categorySlug: "product-questions",
    slug: "which-coil-fits-my-device",
    title: "Which coil is compatible with my device?",
    body: `Coil compatibility depends on your specific device. The coil family for your device is listed on the product page under "Compatibility."\n\nIf you're unsure, our community forum is a great resource — experienced vapers can help match you with the right coil. You can also contact our support team with your device name and model number.`,
    published: true,
  },
  {
    categorySlug: "account",
    slug: "how-do-i-reset-my-password",
    title: "How do I reset my password?",
    body: `To reset your password:\n\n1. Click **Log in** in the navigation\n2. Click **Forgot password**\n3. Enter the email address associated with your account\n4. Check your email for a password reset link (valid for 1 hour)\n5. Click the link and choose a new password\n\nIf you don't receive the email within a few minutes, check your spam folder. If you still can't access your account, contact our support team.`,
    published: true,
  },
  {
    categorySlug: "account",
    slug: "how-do-i-change-my-email",
    title: "How do I update my account details?",
    body: `You can update your username and bio from your profile page. To update your email address, please contact our support team with your current email and the new address you'd like to use.\n\nFor security reasons, email changes require verification of the new address before taking effect.`,
    published: true,
  },
  {
    categorySlug: "legal-age-verification",
    slug: "age-verification-requirements",
    title: "What are your age verification requirements?",
    body: `CloudVape sells vaping and nicotine products exclusively to adults aged 21 and over, in compliance with the US Tobacco 21 law.\n\nAll orders require:\n- Confirmation that you are 21 or older at checkout\n- Adult signature upon delivery (our carriers require ID check)\n\nWe reserve the right to cancel any order where age verification cannot be completed. Providing false age information is illegal and will result in a permanent account ban.`,
    published: true,
  },
];

router.post("/admin/help/seed", async (req, res): Promise<void> => {
  const existingCount = (await db.select({ id: helpCategoriesTable.id }).from(helpCategoriesTable)).length;
  if (existingCount > 0) {
    res.json({ ok: true, message: "Help center already seeded, skipping." });
    return;
  }

  const categoryMap: Record<string, number> = {};
  for (const cat of SEED_CATEGORIES) {
    const [inserted] = await db.insert(helpCategoriesTable).values(cat).onConflictDoNothing().returning();
    if (inserted) categoryMap[cat.slug] = inserted.id;
  }

  let articlesCreated = 0;
  for (const art of SEED_ARTICLES) {
    const categoryId = categoryMap[art.categorySlug];
    if (!categoryId) continue;
    const { categorySlug: _, ...rest } = art;
    await db.insert(helpArticlesTable).values({ ...rest, categoryId }).onConflictDoNothing();
    articlesCreated++;
  }

  res.json({ ok: true, categoriesCreated: Object.keys(categoryMap).length, articlesCreated });
});

export default router;
