import { describe, it, expect, vi, beforeEach } from "vitest";

/* ──────────────────────────────────────────────
   Stable mock state
   ────────────────────────────────────────────── */
const mockSendEmail = vi.fn<(opts: { to: string; html: string; text: string; subject: string; template: string; marketing?: boolean }) => Promise<void>>();
const dbLimitResults = vi.fn();

const makeSelectChain = () => ({
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockImplementation(() => dbLimitResults()),
});

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => makeSelectChain()),
  },
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

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: null,
}));

const topPost = {
  post: {
    id: 1,
    title: "Best Disposable Vapes 2026",
    content: "Here is a full breakdown of the best disposable vapes available this year, covering flavour, battery life and value.",
    likes: 42,
    commentCount: 8,
    categoryId: 2,
    createdAt: new Date(),
  },
  categoryName: "Reviews",
};

const subscriber = { email: "john.smith@cloudvape.store", token: "sub-token-abc", status: "confirmed" };

beforeEach(() => {
  vi.clearAllMocks();
});

/* ──────────────────────────────────────────────
   sendWeeklyDigest — no posts → skip
   ────────────────────────────────────────────── */
describe("sendWeeklyDigest", () => {
  it("returns { sent: 0 } and does not call sendEmail when there are no posts this week", async () => {
    dbLimitResults
      .mockResolvedValueOnce([])  // getTopPosts
      .mockResolvedValueOnce([])  // getNewReviews
      .mockResolvedValueOnce([]); // getTrendingCategories

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns { sent: 0 } when there are posts but no confirmed subscribers", async () => {
    dbLimitResults
      .mockResolvedValueOnce([topPost])  // getTopPosts
      .mockResolvedValueOnce([])         // getNewReviews
      .mockResolvedValueOnce([])         // getTrendingCategories
      .mockResolvedValueOnce([]);        // newsletterSubscribers (none)

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends a personalised email to each confirmed subscriber using their derived name", async () => {
    mockSendEmail.mockResolvedValue(undefined);

    dbLimitResults
      .mockResolvedValueOnce([topPost])    // getTopPosts
      .mockResolvedValueOnce([])           // getNewReviews
      .mockResolvedValueOnce([])           // getTrendingCategories
      .mockResolvedValueOnce([subscriber]); // subscribers

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 1 });
    expect(mockSendEmail).toHaveBeenCalledOnce();

    const call = mockSendEmail.mock.calls[0]?.[0];
    expect(call?.to).toBe(subscriber.email);
    expect(call?.template).toBe("weekly-digest");
    expect(call?.marketing).toBe(true);
    expect(call?.html).toContain("John Smith");
    expect(call?.text).toContain("John Smith");
    expect(call?.html).toContain("cloudvape.store");
    expect(call?.html).toContain("newsletter/unsubscribe");
  });

  it("uses the subscriber token (not a numeric ID) in the unsubscribe link", async () => {
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

  it("sends to all confirmed subscribers — one email per subscriber", async () => {
    mockSendEmail.mockResolvedValue(undefined);

    const sub2 = { email: "alice@cloudvape.store", token: "tok-alice", status: "confirmed" };

    dbLimitResults
      .mockResolvedValueOnce([topPost])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subscriber, sub2]);

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 2 });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    const addresses = mockSendEmail.mock.calls.map((c) => c[0].to);
    expect(addresses).toContain(subscriber.email);
    expect(addresses).toContain(sub2.email);
  });

  it("includes review posts in the digest HTML when reviews category exists", async () => {
    mockSendEmail.mockResolvedValue(undefined);

    const reviewPost = {
      post: {
        id: 5,
        title: "Elf Bar Review: Best Flavour 2026",
        content: "I tried every Elf Bar flavour so you don't have to.",
        likes: 20,
        commentCount: 4,
        categoryId: 3,
        createdAt: new Date(),
      },
    };

    dbLimitResults
      .mockResolvedValueOnce([topPost])
      .mockResolvedValueOnce([reviewPost])  // getNewReviews returns data
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subscriber]);

    const { sendWeeklyDigest } = await import("./weekly-digest");
    await sendWeeklyDigest();

    const call = mockSendEmail.mock.calls[0]?.[0];
    expect(call?.html).toContain("Elf Bar Review");
    expect(call?.text).toContain("Elf Bar Review");
  });

  it("continues sending and counts sent correctly even if one subscriber send fails", async () => {
    const sub2 = { email: "alice@cloudvape.store", token: "tok-alice", status: "confirmed" };

    dbLimitResults
      .mockResolvedValueOnce([topPost])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subscriber, sub2]);

    mockSendEmail
      .mockRejectedValueOnce(new Error("SMTP error"))
      .mockResolvedValueOnce(undefined);

    const { sendWeeklyDigest } = await import("./weekly-digest");
    const result = await sendWeeklyDigest();

    expect(result).toEqual({ sent: 1 });
  });
});
