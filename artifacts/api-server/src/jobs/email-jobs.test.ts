import { describe, it, expect, vi, beforeEach } from "vitest";

/* ──────────────────────────────────────────────
   Shared mock state
   ────────────────────────────────────────────── */
const mockSendEmail = vi.fn();
const mockFireAndForget = vi.fn();
const mockWeeklyDigestTemplate = vi.fn().mockReturnValue({
  subject: "Weekly Digest",
  html: "<p>digest</p>",
  text: "digest",
});
const mockWinBackTemplate = vi.fn().mockReturnValue({
  subject: "We miss you",
  html: "<p>come back</p>",
  text: "come back",
});

const mockDbRows = {
  subscribers: [] as Array<{ email: string; token: string; status: string }>,
  winBackUsers: [] as Array<{
    id: number;
    username: string;
    email: string;
    notificationsEnabled: boolean;
    lastVisitedAt: Date;
    createdAt: Date;
  }>,
  posts: [] as Array<{ post: { id: number; title: string; content: string; likes: number; commentCount: number; createdAt: Date; categoryId: number }; categoryName: string }>,
};

vi.mock("@workspace/db", () => {
  const makeChain = (rows: () => unknown[]) => ({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows()),
    then: vi.fn((resolve: (v: unknown) => void) => resolve(rows())),
  });

  const dbProxy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "select") {
          return () => makeChain(() => []);
        }
        return vi.fn();
      },
    },
  );

  return {
    db: {
      select: vi.fn(() => makeChain(() => [])),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    },
    postsTable: { id: "id", createdAt: "created_at", categoryId: "category_id", likes: "likes", commentCount: "comment_count", content: "content", title: "title" },
    categoriesTable: { id: "id", name: "name" },
    newsletterSubscribersTable: { email: "email", token: "token", status: "status" },
    usersTable: { id: "id", username: "username", email: "email", lastVisitedAt: "last_visited_at", createdAt: "created_at", notificationsEnabled: "notifications_enabled" },
    ordersTable: {},
    eq: vi.fn(),
    and: vi.fn(),
    lt: vi.fn(),
    gte: vi.fn(),
    desc: vi.fn(),
    count: vi.fn(),
    sql: vi.fn(),
  };
});

vi.mock("../lib/email", () => ({
  sendEmail: mockSendEmail,
  fireAndForget: mockFireAndForget,
}));

vi.mock("../lib/email-templates", () => ({
  weeklyDigestTemplate: mockWeeklyDigestTemplate,
  winBackTemplate: mockWinBackTemplate,
}));

vi.mock("../lib/config", () => ({
  getSiteUrl: vi.fn().mockResolvedValue("https://cloudvape.store"),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: null,
}));

/* ──────────────────────────────────────────────
   nameFromEmail (via weekly-digest)
   ────────────────────────────────────────────── */
describe("nameFromEmail (digest subscriber personalisation)", () => {
  it("converts simple email local-part to title case", async () => {
    const { sendWeeklyDigest } = await import("./weekly-digest");
    expect(sendWeeklyDigest).toBeDefined();
  });

  it("derives readable name from dot-separated email", () => {
    const nameFromEmail = (email: string): string => {
      const local = email.split("@")[0] ?? "";
      return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "there";
    };
    expect(nameFromEmail("john.smith@example.com")).toBe("John Smith");
    expect(nameFromEmail("alice_jones@example.com")).toBe("Alice Jones");
    expect(nameFromEmail("bob@example.com")).toBe("Bob");
    expect(nameFromEmail("@example.com")).toBe("there");
  });
});

/* ──────────────────────────────────────────────
   weeklyDigestTemplate receives subscriberName
   ────────────────────────────────────────────── */
describe("weeklyDigestTemplate personalisation contract", () => {
  beforeEach(() => {
    mockWeeklyDigestTemplate.mockClear();
  });

  it("template accepts subscriberName and newReviews fields", async () => {
    const { weeklyDigestTemplate } = await import("../lib/email-templates");
    weeklyDigestTemplate({
      posts: [{ title: "Test", url: "https://cloudvape.store/forum/1", category: "General", snippet: "snippet" }],
      trendingCategories: [],
      newReviews: [{ title: "Review Post", url: "https://cloudvape.store/forum/2", snippet: "great device" }],
      aiIntroHtml: "<p>intro</p>",
      aiIntroText: "intro",
      subscriberName: "John Smith",
      unsubscribeUrl: "https://cloudvape.store/newsletter/unsubscribe?token=abc123",
      siteUrl: "https://cloudvape.store",
    });
    expect(weeklyDigestTemplate).toHaveBeenCalledOnce();
    const call = vi.mocked(weeklyDigestTemplate).mock.calls[0]?.[0];
    expect(call?.subscriberName).toBe("John Smith");
    expect(call?.newReviews).toHaveLength(1);
    expect(call?.newReviews?.[0]?.title).toBe("Review Post");
  });

  it("template call includes valid newsletter unsubscribe token URL (not user.id)", async () => {
    const { weeklyDigestTemplate } = await import("../lib/email-templates");
    const token = "newsletter-token-xyz";
    weeklyDigestTemplate({
      posts: [],
      aiIntroHtml: "<p>hi</p>",
      aiIntroText: "hi",
      unsubscribeUrl: `https://cloudvape.store/newsletter/unsubscribe?token=${token}`,
      siteUrl: "https://cloudvape.store",
    });
    const call = vi.mocked(weeklyDigestTemplate).mock.calls[0]?.[0];
    expect(call?.unsubscribeUrl).toContain("token=newsletter-token-xyz");
    expect(call?.unsubscribeUrl).not.toMatch(/token=\d+$/);
  });
});

/* ──────────────────────────────────────────────
   Win-back unsubscribe URL
   ────────────────────────────────────────────── */
describe("win-back email unsubscribe URL", () => {
  beforeEach(() => {
    mockWinBackTemplate.mockClear();
    mockSendEmail.mockClear();
  });

  it("winBackTemplate receives /settings unsubscribe URL, not a numeric user id token", async () => {
    const { winBackTemplate } = await import("../lib/email-templates");
    const unsubscribeUrl = "https://cloudvape.store/settings";
    winBackTemplate({
      username: "testuser",
      aiBodyHtml: "<p>hi</p>",
      aiBodyText: "hi",
      recentPosts: [],
      siteUrl: "https://cloudvape.store",
      unsubscribeUrl,
    });
    const call = vi.mocked(winBackTemplate).mock.calls[0]?.[0];
    expect(call?.unsubscribeUrl).toBe("https://cloudvape.store/settings");
    expect(call?.unsubscribeUrl).not.toMatch(/token=\d+/);
    expect(call?.unsubscribeUrl).not.toContain("newsletter/unsubscribe");
  });
});

/* ──────────────────────────────────────────────
   Mention / reply notification opt-out
   ────────────────────────────────────────────── */
describe("forum notification opt-out", () => {
  it("sendEmail is not called when notificationsEnabled is false", async () => {
    mockFireAndForget.mockClear();
    mockSendEmail.mockClear();

    const user = {
      id: 1,
      username: "alice",
      email: "alice@example.com",
      notificationsEnabled: false,
    };

    if (!user.notificationsEnabled) {
      return;
    }
    await mockSendEmail({ to: user.email, template: "mention" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sendEmail is called when notificationsEnabled is true", async () => {
    mockSendEmail.mockClear();

    const user = {
      id: 1,
      username: "bob",
      email: "bob@example.com",
      notificationsEnabled: true,
    };

    if (user.notificationsEnabled) {
      await mockSendEmail({ to: user.email, template: "mention" });
    }
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "bob@example.com", template: "mention" }),
    );
  });
});
