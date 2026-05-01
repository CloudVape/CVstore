import { describe, it, expect, vi, beforeEach } from "vitest";

/* ──────────────────────────────────────────────
   Mocks — db.select chain returns a thenable so
   both await chain.limit(N) and await chain.where(...)
   resolve through dbLimitResults in call order.
   ────────────────────────────────────────────── */
const mockSendEmail = vi.fn<(opts: {
  to: string; html: string; text: string; subject: string; template: string; marketing?: boolean;
}) => Promise<void>>();

const dbLimitResults = vi.fn();

function makeSelectChain() {
  const chain: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => dbLimitResults()),
  };
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    dbLimitResults().then(resolve, reject);
  return chain;
}

vi.mock("@workspace/db", () => ({
  db: { select: vi.fn(() => makeSelectChain()) },
  postsTable: { id: "id", createdAt: "created_at", categoryId: "category_id", likes: "likes", commentCount: "comment_count", content: "content", title: "title" },
  categoriesTable: { id: "id", name: "name" },
  newsletterSubscribersTable: { email: "email", token: "token", status: "status" },
  eq: vi.fn(),
  gte: vi.fn(),
  desc: vi.fn(),
  count: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../lib/email", () => ({
  sendEmail: mockSendEmail,
  fireAndForget: vi.fn(),
}));

vi.mock("../lib/config", () => ({
  getSiteUrl: vi.fn().mockResolvedValue("https://cloudvape.store"),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: null }));

/*
 * Data fixtures — shapes matching the actual SELECT results.
 * Promise.all order in sendWeeklyDigest:
 *   call 1 → getTopPosts   (limit 5)
 *   call 2 → getTrendingCategories (limit 3)
 *   call 3 → getNewReviews  (limit 3)
 *   call 4 → subscribers    (where, then-able)
 */
const topPost = {
  post: {
    id: 1,
    title: "Best Disposable Vapes 2026",
    content: "Here is a full breakdown of the best disposable vapes available this year.",
    likes: 42,
    commentCount: 8,
    categoryId: 2,
    createdAt: new Date(),
  },
  categoryName: "General",
};

const reviewPost = {
  post: {
    id: 5,
    title: "Elf Bar Review: Best Flavour 2026",
    content: "I tried every Elf Bar flavour so you don't have to. Here is my verdict.",
    likes: 20,
    commentCount: 4,
    categoryId: 3,
    createdAt: new Date(),
  },
};

const subscriber = { email: "john.smith@cloudvape.store", token: "sub-token-abc", status: "confirmed" };
const subscriber2 = { email: "alice@cloudvape.store", token: "tok-alice", status: "confirmed" };

beforeEach(() => {
  vi.clearAllMocks();
  dbLimitResults.mockReset();
});

describe("sendWeeklyDigest", () => {
  it("returns { sent: 0 } and does not call sendEmail when there are no posts this week", async () => {
    dbLimitResults
      .mockResolvedValueOnce([])   // getTopPosts
      .mockResolvedValueOnce([])   // getTrendingCategories
      .mockResolvedValueOnce([]);  // getNewReviews

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns { sent: 0 } when there are posts but no confirmed subscribers", async () => {
    dbLimitResults
      .mockResolvedValueOnce([topPost]) // getTopPosts
      .mockResolvedValueOnce([])        // getTrendingCategories
      .mockResolvedValueOnce([])        // getNewReviews
      .mockResolvedValueOnce([]);       // subscribers (none)

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends a personalised email to each subscriber using their name derived from the email address", async () => {
    mockSendEmail.mockResolvedValue(undefined);

    dbLimitResults
      .mockResolvedValueOnce([topPost])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subscriber]);

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 1 });
    expect(mockSendEmail).toHaveBeenCalledOnce();

    const call = mockSendEmail.mock.calls[0]?.[0];
    expect(call?.to).toBe(subscriber.email);
    expect(call?.template).toBe("weekly-digest");
    expect(call?.marketing).toBe(true);
    // Personalised greeting derived from "john.smith" → "John Smith"
    expect(call?.html).toContain("John Smith");
    expect(call?.text).toContain("John Smith");
    expect(call?.html).toContain("cloudvape.store");
  });

  it("includes the subscriber token (not a numeric ID) in the unsubscribe link", async () => {
    mockSendEmail.mockResolvedValue(undefined);

    dbLimitResults
      .mockResolvedValueOnce([topPost])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subscriber]);

    const { sendWeeklyDigest } = await import("./weekly-digest");
    await sendWeeklyDigest();

    const call = mockSendEmail.mock.calls[0]?.[0];
    expect(call?.html).toContain(`token=${subscriber.token}`);
    expect(call?.html).not.toMatch(/token=\d+/);
  });

  it("sends one email per subscriber and returns correct sent count", async () => {
    mockSendEmail.mockResolvedValue(undefined);

    dbLimitResults
      .mockResolvedValueOnce([topPost])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subscriber, subscriber2]);

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 2 });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);

    const addresses = mockSendEmail.mock.calls.map((c) => c[0].to);
    expect(addresses).toContain(subscriber.email);
    expect(addresses).toContain(subscriber2.email);
  });

  it("includes new review posts in the digest HTML and text when review category posts exist", async () => {
    mockSendEmail.mockResolvedValue(undefined);

    dbLimitResults
      .mockResolvedValueOnce([topPost])
      .mockResolvedValueOnce([])         // getTrendingCategories
      .mockResolvedValueOnce([reviewPost]) // getNewReviews ← third call
      .mockResolvedValueOnce([subscriber]);

    const { sendWeeklyDigest } = await import("./weekly-digest");
    await sendWeeklyDigest();

    const call = mockSendEmail.mock.calls[0]?.[0];
    expect(call?.html).toContain("Elf Bar Review");
    expect(call?.text).toContain("Elf Bar Review");
  });

  it("counts only successful sends when one subscriber send fails", async () => {
    dbLimitResults
      .mockResolvedValueOnce([topPost])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subscriber, subscriber2]);

    mockSendEmail
      .mockRejectedValueOnce(new Error("SMTP timeout"))
      .mockResolvedValueOnce(undefined);

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 1 });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
  });
});
