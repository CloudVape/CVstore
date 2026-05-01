import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

const mockGetAuth = vi.fn();
const mockClerkGetUser = vi.fn();
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();
const mockFireAndForget = vi.fn();
const mockSendEmail = vi.fn();
const mockWelcomeTemplate = vi.fn();
const mockGetSiteUrl = vi.fn();

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  clerkClient: {
    users: {
      getUser: mockClerkGetUser,
    },
  },
}));

vi.mock("@workspace/db", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => mockDbSelect()),
    orderBy: vi.fn().mockImplementation(() => mockDbSelect()),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };
  return {
    db: {
      select: vi.fn(() => chain),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockImplementation(() => mockDbUpdate()),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockImplementation(() => mockDbInsert()),
        })),
      })),
    },
    usersTable: {},
    eq: vi.fn(),
  };
});

vi.mock("../lib/email", () => ({
  sendEmail: mockSendEmail,
  fireAndForget: mockFireAndForget,
}));

vi.mock("../lib/email-templates", () => ({
  welcomeTemplate: mockWelcomeTemplate,
  verifyEmailTemplate: vi.fn(),
}));

vi.mock("../lib/config", () => ({
  getSiteUrl: mockGetSiteUrl,
  SITE_URL_FALLBACK: "https://example.com",
}));

async function buildApp() {
  const { default: usersRouter } = await import("./users");
  const app = express();
  app.use(express.json());
  app.use(usersRouter);
  return app;
}

const baseUser = {
  id: 1,
  clerkId: "clerk_existing",
  username: "returning_user",
  email: "returning@example.com",
  avatarUrl: null,
  bio: null,
  isAiPersona: false,
  postCount: 5,
  joinedAt: new Date().toISOString(),
  emailVerified: true,
  isAdmin: false,
  themePreference: "light",
  alertEmailOverride: null,
};

describe("GET /users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSiteUrl.mockResolvedValue("https://example.com");
    mockWelcomeTemplate.mockReturnValue({
      subject: "Welcome!",
      html: "<p>Welcome</p>",
      text: "Welcome",
    });
  });

  describe("merge path — existing user found by email", () => {
    it("does NOT send a welcome email when the account is merged via email match", async () => {
      mockGetAuth.mockReturnValue({ userId: "clerk_new_id" });

      mockClerkGetUser.mockResolvedValue({
        primaryEmailAddressId: "email_1",
        emailAddresses: [{ id: "email_1", emailAddress: "returning@example.com" }],
        username: null,
        firstName: null,
      });

      // 1st where call: lookup by clerkId — not found
      mockDbSelect.mockResolvedValueOnce([]);
      // 2nd where call: lookup by email — found (existing account)
      mockDbSelect.mockResolvedValueOnce([baseUser]);
      // db.update().set().where().returning() — returns merged user
      mockDbUpdate.mockResolvedValue([{ ...baseUser, clerkId: "clerk_new_id" }]);

      const app = await buildApp();
      const res = await request(app).get("/users/me");

      expect(res.status).toBe(200);
      // fireAndForget is called once for the background lastVisitedAt update
      expect(mockFireAndForget).toHaveBeenCalledTimes(1);
      // but no welcome/transactional sendEmail should have been triggered
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("new user path — no existing account", () => {
    it("DOES send a welcome email when a brand-new user is inserted", async () => {
      const newClerkId = "clerk_brand_new";
      mockGetAuth.mockReturnValue({ userId: newClerkId });

      mockClerkGetUser.mockResolvedValue({
        primaryEmailAddressId: "email_2",
        emailAddresses: [{ id: "email_2", emailAddress: "newuser@example.com" }],
        username: "newuser",
        firstName: null,
      });

      // 1st where call: lookup by clerkId — not found
      mockDbSelect.mockResolvedValueOnce([]);
      // 2nd where call: lookup by email — not found (genuinely new)
      mockDbSelect.mockResolvedValueOnce([]);
      // 3rd where call: username uniqueness check — no conflict
      mockDbSelect.mockResolvedValueOnce([]);

      const newUser = {
        ...baseUser,
        id: 2,
        clerkId: newClerkId,
        username: "newuser",
        email: "newuser@example.com",
        postCount: 0,
      };
      // db.insert().values().returning() — returns the newly inserted user
      mockDbInsert.mockResolvedValue([newUser]);

      const app = await buildApp();
      const res = await request(app).get("/users/me");

      expect(res.status).toBe(200);
      // Two fireAndForget calls: welcome email + background lastVisitedAt update
      expect(mockFireAndForget).toHaveBeenCalledTimes(2);

      // The first call is always the welcome email promise
      const emailPromise = mockFireAndForget.mock.calls[0][0] as Promise<unknown>;
      await emailPromise;

      expect(mockSendEmail).toHaveBeenCalledOnce();
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ template: "welcome", to: "newuser@example.com" }),
      );
    });
  });
});
