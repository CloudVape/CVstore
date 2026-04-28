import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  };
  return {
    db: {
      select: vi.fn(() => dbSelectChain),
    },
    usersTable: {},
  };
});

async function buildApp() {
  const { default: sampleFeedsRouter } = await import("./sample-feeds.js");
  const app = express();
  app.use(express.json());
  app.use(sampleFeedsRouter);
  return app;
}

async function buildFullApp() {
  const { default: sampleFeedsRouter } = await import("./sample-feeds.js");
  const app = express();
  app.use(express.json());
  app.use("/api", sampleFeedsRouter);
  return app;
}

describe("GET /api/sample-feeds/:filename", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(express.response as Response, "download").mockImplementation(
      function (
        this: Response,
        _filePath: string,
        filename: string,
        callback: (err?: Error) => void,
      ) {
        this.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        this.status(200).end("sample file content");
        if (typeof callback === "function") callback();
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 for unauthenticated requests", async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const app = await buildApp();
    const res = await request(app).get("/sample-feeds/example-supplier.csv");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 for authenticated non-admin users", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_regular" });
    mockDbSelect.mockResolvedValue([{ clerkId: "user_regular", isAdmin: false }]);

    const app = await buildApp();
    const res = await request(app).get("/sample-feeds/example-supplier.csv");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 403 when user record does not exist in the database", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_unknown" });
    mockDbSelect.mockResolvedValue([]);

    const app = await buildApp();
    const res = await request(app).get("/sample-feeds/example-supplier.csv");

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 200 and the file for valid admin requests", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_admin" });
    mockDbSelect.mockResolvedValue([{ clerkId: "user_admin", isAdmin: true }]);

    const app = await buildApp();
    const res = await request(app).get("/sample-feeds/example-supplier.csv");

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/example-supplier\.csv/);
  });

  it("returns 404 for an admin requesting a file not in the allowed list", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_admin" });
    mockDbSelect.mockResolvedValue([{ clerkId: "user_admin", isAdmin: true }]);

    const app = await buildApp();
    const res = await request(app).get("/sample-feeds/../../etc/passwd");

    expect(res.status).toBe(404);
  });

  it("rejects non-admin requests on the full /api mount path", async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const app = await buildFullApp();
    const res = await request(app).get("/api/sample-feeds/example-supplier.csv");

    expect(res.status).toBe(401);
  });
});
