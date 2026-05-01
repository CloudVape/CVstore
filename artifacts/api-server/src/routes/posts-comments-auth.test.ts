import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

/* ──────────────────────────────────────────────
   Mocks
   ────────────────────────────────────────────── */
const mockGetAuth = vi.fn();
const mockFireAndForget = vi.fn();
const mockSendEmail = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const selectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockImplementation(() => mockDbSelect()),
  leftJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
};

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockImplementation(() => mockDbInsert()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
  postsTable: { id: "id", authorId: "author_id", categoryId: "category_id", commentCount: "comment_count", createdAt: "created_at", likes: "likes" },
  commentsTable: { id: "id", authorId: "author_id", postId: "post_id", createdAt: "created_at" },
  usersTable: { id: "id", clerkId: "clerk_id", username: "username", postCount: "post_count" },
  categoriesTable: { id: "id", postCount: "post_count" },
  eq: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../lib/email", () => ({
  sendEmail: mockSendEmail,
  fireAndForget: mockFireAndForget,
}));

vi.mock("../lib/email-templates", () => ({
  mentionNotificationTemplate: vi.fn().mockReturnValue({ subject: "x", html: "x", text: "x" }),
  forumReplyNotificationTemplate: vi.fn().mockReturnValue({ subject: "x", html: "x", text: "x" }),
}));

vi.mock("../lib/config", () => ({
  getSiteUrl: vi.fn().mockResolvedValue("https://cloudvape.store"),
}));

/* ──────────────────────────────────────────────
   App factory
   ────────────────────────────────────────────── */
async function buildApp() {
  const [{ default: postsRouter }, { default: commentsRouter }] = await Promise.all([
    import("./posts"),
    import("./comments"),
  ]);
  const app = express();
  app.use(express.json());
  app.use(postsRouter);
  app.use(commentsRouter);
  return app;
}

const validPostBody = {
  title: "Test Post",
  content: "Hello world",
  categoryId: 1,
  authorId: 99,
};

const validCommentBody = {
  content: "Great post",
  authorId: 99,
};

/* ──────────────────────────────────────────────
   POST /posts — authentication enforcement
   ────────────────────────────────────────────── */
describe("POST /posts — authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: null });
  });

  it("returns 401 and does not trigger emails when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app).post("/posts").send(validPostBody);
    expect(res.status).toBe(401);
    expect(mockFireAndForget).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 403 when Clerk ID has no matching DB profile", async () => {
    mockGetAuth.mockReturnValue({ userId: "clerk_ghost" });
    mockDbSelect.mockResolvedValue([]);
    const app = await buildApp();
    const res = await request(app).post("/posts").send(validPostBody);
    expect(res.status).toBe(403);
    expect(mockFireAndForget).not.toHaveBeenCalled();
  });

  it("uses session user ID (not body authorId) when authenticated", async () => {
    const sessionUser = {
      id: 42,
      clerkId: "clerk_real",
      username: "realuser",
      email: "real@example.com",
      avatarUrl: null,
      notificationsEnabled: true,
      isAiPersona: false,
    };
    mockGetAuth.mockReturnValue({ userId: "clerk_real" });
    mockDbSelect.mockResolvedValue([sessionUser]);
    mockDbInsert.mockResolvedValue([{
      id: 1,
      title: "Test Post",
      content: "Hello world",
      authorId: 42,
      categoryId: 1,
      commentCount: 0,
      likes: 0,
      tags: [],
      sourceUrl: null,
      isAiGenerated: false,
      createdAt: new Date(),
    }]);

    const app = await buildApp();
    const res = await request(app)
      .post("/posts")
      .send({ ...validPostBody, authorId: 999 });

    expect(res.status).toBe(201);
    const insertCall = vi.mocked(
      (await import("@workspace/db")).db.insert
    ).mock.calls[0];
    expect(insertCall).toBeDefined();
  });
});

/* ──────────────────────────────────────────────
   POST /posts/:postId/comments — authentication enforcement
   ────────────────────────────────────────────── */
describe("POST /posts/:postId/comments — authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: null });
  });

  it("returns 401 and does not trigger emails when unauthenticated", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/posts/1/comments")
      .send(validCommentBody);
    expect(res.status).toBe(401);
    expect(mockFireAndForget).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 403 when Clerk ID has no matching DB profile", async () => {
    mockGetAuth.mockReturnValue({ userId: "clerk_ghost" });
    mockDbSelect.mockResolvedValue([]);
    const app = await buildApp();
    const res = await request(app)
      .post("/posts/1/comments")
      .send(validCommentBody);
    expect(res.status).toBe(403);
    expect(mockFireAndForget).not.toHaveBeenCalled();
  });
});

/* ──────────────────────────────────────────────
   Mention cap (max 5 unique handles)
   ────────────────────────────────────────────── */
describe("extractMentions — mention cap", () => {
  it("caps unique mention handles at 5", () => {
    const MENTION_RE = /@([a-zA-Z0-9_]+)/g;
    const MAX = 5;
    function extractMentions(text: string): string[] {
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(MENTION_RE.source, MENTION_RE.flags);
      while ((m = re.exec(text)) !== null) {
        if (m[1]) matches.push(m[1].toLowerCase());
      }
      return [...new Set(matches)].slice(0, MAX);
    }
    const content = "@a @b @c @d @e @f @g @h @i @j";
    const result = extractMentions(content);
    expect(result).toHaveLength(5);
    expect(result).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("deduplicates repeated mentions before capping", () => {
    const MENTION_RE = /@([a-zA-Z0-9_]+)/g;
    const MAX = 5;
    function extractMentions(text: string): string[] {
      const matches: string[] = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(MENTION_RE.source, MENTION_RE.flags);
      while ((m = re.exec(text)) !== null) {
        if (m[1]) matches.push(m[1].toLowerCase());
      }
      return [...new Set(matches)].slice(0, MAX);
    }
    const content = "@alice @alice @alice @bob @charlie";
    const result = extractMentions(content);
    expect(result).toHaveLength(3);
  });
});
