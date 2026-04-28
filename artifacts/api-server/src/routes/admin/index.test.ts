import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

const mockGetAuth = vi.fn();
const mockDbSelect = vi.fn();

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("@workspace/db", () => {
  const dbSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => mockDbSelect()),
    orderBy: vi.fn().mockImplementation(() => mockDbSelect()),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    $dynamic: vi.fn().mockReturnThis(),
  };
  return {
    db: {
      select: vi.fn(() => dbSelectChain),
      selectDistinct: vi.fn(() => dbSelectChain),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })) })),
      delete: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
    },
    usersTable: {},
    suppliersTable: {},
    importRunsTable: {},
    emailLogTable: {},
    newsletterSubscribersTable: {},
    ordersTable: {},
    helpCategoriesTable: {},
    helpArticlesTable: {},
    supportTicketsTable: {},
    supportMessagesTable: {},
    settingsTable: {},
    eq: vi.fn(),
    desc: vi.fn(),
    asc: vi.fn(),
    and: vi.fn(),
    isNull: vi.fn(),
    isNotNull: vi.fn(),
    sql: vi.fn(),
  };
});

vi.mock("../../lib/config", () => ({
  ADMIN_EMAIL_FALLBACK: "admin@example.com",
  SITE_URL_FALLBACK: "https://example.com",
  getSiteUrl: vi.fn().mockResolvedValue("https://example.com"),
}));

vi.mock("../../lib/email", () => ({
  sendEmail: vi.fn(),
  fireAndForget: vi.fn(),
}));

vi.mock("../../lib/email-templates", () => ({
  marketingBroadcastTemplate: vi.fn(),
  shippingUpdateTemplate: vi.fn(),
  deliveryConfirmationTemplate: vi.fn(),
  refundConfirmationTemplate: vi.fn(),
  ticketReplyTemplate: vi.fn(),
}));

vi.mock("../../lib/feed-parsers", () => ({
  parseFeed: vi.fn(),
}));

vi.mock("../../lib/import-engine", () => ({
  executeImportRun: vi.fn(),
  IMPORTABLE_FIELDS: [],
}));

vi.mock("../../lib/fetch-feed", () => ({
  fetchFeedFromUrl: vi.fn(),
  FeedFetchError: class FeedFetchError extends Error {},
}));

vi.mock("../support", () => ({
  runAiAutoReply: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

async function buildApp() {
  const { default: adminRouter } = await import("./index.js");
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  return app;
}

const ADMIN_USER = { clerkId: "user_admin", isAdmin: true, id: 1 };

function setupAdmin() {
  mockGetAuth.mockReturnValue({ userId: "user_admin" });
  mockDbSelect.mockResolvedValueOnce([ADMIN_USER]);
}

const ROUTE_GROUPS = [
  { label: "suppliers list", path: "/admin/suppliers" },
  { label: "import-runs list", path: "/admin/import-runs" },
  { label: "email-log", path: "/admin/email-log" },
  { label: "email-log from-addresses", path: "/admin/email-log/from-addresses" },
  { label: "newsletter subscribers", path: "/admin/newsletter/subscribers" },
  { label: "orders", path: "/admin/orders" },
  { label: "help/categories", path: "/admin/help/categories" },
  { label: "help/articles", path: "/admin/help/articles" },
  { label: "support/tickets", path: "/admin/support/tickets" },
  { label: "settings", path: "/admin/settings" },
];

describe("Admin route authentication", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  describe("unauthenticated requests (no userId)", () => {
    beforeEach(() => {
      mockGetAuth.mockReturnValue({ userId: null });
    });

    for (const { label, path } of ROUTE_GROUPS) {
      it(`returns 401 for GET ${path} (${label})`, async () => {
        const res = await request(app).get(path);
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ error: expect.any(String) });
      });
    }
  });

  describe("authenticated non-admin requests", () => {
    beforeEach(() => {
      mockGetAuth.mockReturnValue({ userId: "user_regular" });
      mockDbSelect.mockResolvedValue([{ clerkId: "user_regular", isAdmin: false }]);
    });

    for (const { label, path } of ROUTE_GROUPS) {
      it(`returns 403 for GET ${path} (${label})`, async () => {
        const res = await request(app).get(path);
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ error: expect.any(String) });
      });
    }
  });

  describe("authenticated requests where user is missing from the database", () => {
    beforeEach(() => {
      mockGetAuth.mockReturnValue({ userId: "user_unknown" });
      mockDbSelect.mockResolvedValue([]);
    });

    for (const { label, path } of ROUTE_GROUPS) {
      it(`returns 403 for GET ${path} (${label})`, async () => {
        const res = await request(app).get(path);
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ error: expect.any(String) });
      });
    }
  });

  describe("admin requests pass through requireAdmin", () => {
    it("allows an admin to GET /admin/suppliers (returns non-auth status)", async () => {
      setupAdmin();
      mockDbSelect.mockResolvedValue([]);

      const res = await request(app).get("/admin/suppliers");
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("allows an admin to GET /admin/import-runs (returns non-auth status)", async () => {
      setupAdmin();
      mockDbSelect.mockResolvedValue([]);

      const res = await request(app).get("/admin/import-runs");
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("allows an admin to GET /admin/email-log (returns non-auth status)", async () => {
      setupAdmin();
      mockDbSelect.mockResolvedValue([]);

      const res = await request(app).get("/admin/email-log");
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("allows an admin to GET /admin/help/categories (returns non-auth status)", async () => {
      setupAdmin();
      mockDbSelect.mockResolvedValue([]);

      const res = await request(app).get("/admin/help/categories");
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("allows an admin to GET /admin/support/tickets (returns non-auth status)", async () => {
      setupAdmin();
      mockDbSelect.mockResolvedValue([]);

      const res = await request(app).get("/admin/support/tickets");
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it("allows an admin to GET /admin/settings (returns non-auth status)", async () => {
      setupAdmin();
      mockDbSelect.mockResolvedValue([]);

      const res = await request(app).get("/admin/settings");
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe("POST /admin/suppliers - write endpoint protection", () => {
    it("returns 401 for unauthenticated POST", async () => {
      mockGetAuth.mockReturnValue({ userId: null });

      const res = await request(app)
        .post("/admin/suppliers")
        .send({ name: "Test", sourceType: "csv-url" });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin POST", async () => {
      mockGetAuth.mockReturnValue({ userId: "user_regular" });
      mockDbSelect.mockResolvedValue([{ clerkId: "user_regular", isAdmin: false }]);

      const res = await request(app)
        .post("/admin/suppliers")
        .send({ name: "Test", sourceType: "csv-url" });

      expect(res.status).toBe(403);
    });
  });

  describe("PUT /admin/settings - write endpoint protection", () => {
    it("returns 401 for unauthenticated PUT", async () => {
      mockGetAuth.mockReturnValue({ userId: null });

      const res = await request(app)
        .put("/admin/settings")
        .send({ alertEmail: "test@example.com" });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin PUT", async () => {
      mockGetAuth.mockReturnValue({ userId: "user_regular" });
      mockDbSelect.mockResolvedValue([{ clerkId: "user_regular", isAdmin: false }]);

      const res = await request(app)
        .put("/admin/settings")
        .send({ alertEmail: "test@example.com" });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /admin/suppliers/:id - destructive endpoint protection", () => {
    it("returns 401 for unauthenticated DELETE", async () => {
      mockGetAuth.mockReturnValue({ userId: null });

      const res = await request(app).delete("/admin/suppliers/1");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin DELETE", async () => {
      mockGetAuth.mockReturnValue({ userId: "user_regular" });
      mockDbSelect.mockResolvedValue([{ clerkId: "user_regular", isAdmin: false }]);

      const res = await request(app).delete("/admin/suppliers/1");

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /admin/orders/:orderNumber/status - write endpoint protection", () => {
    it("returns 401 for unauthenticated PATCH", async () => {
      mockGetAuth.mockReturnValue({ userId: null });

      const res = await request(app)
        .patch("/admin/orders/ORD-001/status")
        .send({ status: "shipped" });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin PATCH", async () => {
      mockGetAuth.mockReturnValue({ userId: "user_regular" });
      mockDbSelect.mockResolvedValue([{ clerkId: "user_regular", isAdmin: false }]);

      const res = await request(app)
        .patch("/admin/orders/ORD-001/status")
        .send({ status: "shipped" });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /admin/newsletter/broadcast - write endpoint protection", () => {
    it("returns 401 for unauthenticated POST", async () => {
      mockGetAuth.mockReturnValue({ userId: null });

      const res = await request(app)
        .post("/admin/newsletter/broadcast")
        .send({ subject: "Hello", html: "<p>Hi</p>" });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin POST", async () => {
      mockGetAuth.mockReturnValue({ userId: "user_regular" });
      mockDbSelect.mockResolvedValue([{ clerkId: "user_regular", isAdmin: false }]);

      const res = await request(app)
        .post("/admin/newsletter/broadcast")
        .send({ subject: "Hello", html: "<p>Hi</p>" });

      expect(res.status).toBe(403);
    });
  });

  describe("database error during auth check", () => {
    beforeEach(() => {
      mockGetAuth.mockReturnValue({ userId: "user_admin" });
      mockDbSelect.mockRejectedValue(new Error("DB connection lost"));
    });

    for (const { label, path } of ROUTE_GROUPS.slice(0, 3)) {
      it(`returns 500 (not 200/401/403) for GET ${path} when DB throws (${label})`, async () => {
        const res = await request(app).get(path);
        expect(res.status).toBe(500);
        expect(res.body).toMatchObject({ error: expect.any(String) });
      });
    }

    it("returns 500 for POST /admin/suppliers when DB throws during auth", async () => {
      const res = await request(app)
        .post("/admin/suppliers")
        .send({ name: "Test", sourceType: "csv-url" });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ error: expect.any(String) });
    });

    it("returns 500 for DELETE /admin/suppliers/1 when DB throws during auth", async () => {
      const res = await request(app).delete("/admin/suppliers/1");
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ error: expect.any(String) });
    });
  });
});
