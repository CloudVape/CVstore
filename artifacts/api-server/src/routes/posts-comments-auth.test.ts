import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

/* ──────────────────────────────────────────────
   Mocks
   ────────────────────────────────────────────── */
const mockGetAuth = vi.fn();
const mockFireAndForget = vi.fn();
const mockSendEmail = vi.fn();

let capturedInsertValues: Record<string, unknown> = {};

const selectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  then: vi.fn().mockReturnThis(),
};

const mockDbSelectResolve = vi.fn();

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      ...selectChain,
      where: vi.fn().mockImplementation(() => mockDbSelectResolve()),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((data: Record<string, unknown>) => {
        capturedInsertValues = data;
        return {
          returning: vi.fn().mockResolvedValue([{
            id: 1,
            ...data,
            commentCount: 0,
            likes: 0,
            createdAt: new Date(),
          }]),
        };
      }),
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
  ne: vi.fn(),
  and: vi.fn(),
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
  threadParticipantNotificationTemplate: vi.fn().mockReturnValue({ subject: "x", html: "x", text: "x" }),
}));

vi.mock("../lib/config", () => ({
  getSiteUrl: vi.fn().mockResolvedValue("https://cloudvape.store"),
}));

const sessionUser = {
  id: 42,
  clerkId: "clerk_real",
  username: "realuser",
  email: "real@example.com",
  avatarUrl: null,
  notificationsEnabled: true,
  isAiPersona: false,
};

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

const validPostBody = { title: "Test Post", content: "Hello world", categoryId: 1, authorId: 999 };
const validCommentBody = { content: "Great post @alice", authorId: 999 };

/* ──────────────────────────────────────────────
   POST /posts — authentication enforcement
   ────────────────────────────────────────────── */
describe("POST /posts — authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedInsertValues = {};
  });

  it("returns 401 when no Clerk session exists and does not queue email notifications", async () => {
    mockGetAuth.mockReturnValue({ userId: null });
    const app = await buildApp();

    const res = await request(app).post("/posts").send(validPostBody);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: expect.stringContaining("Authentication") });
    expect(mockFireAndForget).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated Clerk user has no DB profile and does not queue email notifications", async () => {
    mockGetAuth.mockReturnValue({ userId: "clerk_ghost" });
    mockDbSelectResolve.mockResolvedValue([]);
    const app = await buildApp();

    const res = await request(app).post("/posts").send(validPostBody);

    expect(res.status).toBe(403);
    expect(mockFireAndForget).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("uses the authenticated session user's ID as authorId — ignores body authorId", async () => {
    mockGetAuth.mockReturnValue({ userId: "clerk_real" });
    mockDbSelectResolve.mockResolvedValue([sessionUser]);
    const app = await buildApp();

    const res = await request(app)
      .post("/posts")
      .send({ ...validPostBody, authorId: 999 });

    expect(res.status).toBe(201);
    expect(capturedInsertValues.authorId).toBe(sessionUser.id);
    expect(capturedInsertValues.authorId).not.toBe(999);
  });

  it("queues forum notification after successful authenticated post creation", async () => {
    mockGetAuth.mockReturnValue({ userId: "clerk_real" });
    mockDbSelectResolve.mockResolvedValue([sessionUser]);
    mockFireAndForget.mockImplementation(() => undefined);
    const app = await buildApp();

    await request(app).post("/posts").send(validPostBody);

    expect(mockFireAndForget).toHaveBeenCalledOnce();
  });
});

/* ──────────────────────────────────────────────
   POST /posts/:postId/comments — authentication enforcement
   ────────────────────────────────────────────── */
describe("POST /posts/:postId/comments — authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedInsertValues = {};
  });

  it("returns 401 when no Clerk session exists and does not queue email notifications", async () => {
    mockGetAuth.mockReturnValue({ userId: null });
    const app = await buildApp();

    const res = await request(app).post("/posts/1/comments").send(validCommentBody);

    expect(res.status).toBe(401);
    expect(mockFireAndForget).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 403 when authenticated Clerk user has no DB profile and does not queue email notifications", async () => {
    mockGetAuth.mockReturnValue({ userId: "clerk_ghost" });
    mockDbSelectResolve.mockResolvedValue([]);
    const app = await buildApp();

    const res = await request(app).post("/posts/1/comments").send(validCommentBody);

    expect(res.status).toBe(403);
    expect(mockFireAndForget).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("uses the session user's ID as authorId — ignores body authorId", async () => {
    mockGetAuth.mockReturnValue({ userId: "clerk_real" });
    mockDbSelectResolve
      .mockResolvedValueOnce([sessionUser])
      .mockResolvedValue([]);
    const app = await buildApp();

    const res = await request(app)
      .post("/posts/1/comments")
      .send({ ...validCommentBody, authorId: 999 });

    expect(res.status).toBe(201);
    expect(capturedInsertValues.authorId).toBe(sessionUser.id);
    expect(capturedInsertValues.authorId).not.toBe(999);
  });

  it("response body uses session username, not a numeric authorId from client", async () => {
    mockGetAuth.mockReturnValue({ userId: "clerk_real" });
    mockDbSelectResolve
      .mockResolvedValueOnce([sessionUser])
      .mockResolvedValue([]);
    const app = await buildApp();

    const res = await request(app)
      .post("/posts/1/comments")
      .send(validCommentBody);

    expect(res.status).toBe(201);
    expect(res.body.authorName).toBe(sessionUser.username);
  });
});
