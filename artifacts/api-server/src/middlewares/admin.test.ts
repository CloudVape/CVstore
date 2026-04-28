import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mockGetAuth = vi.fn();
const mockDbWhere = vi.fn();

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => mockDbWhere()),
    })),
  },
  usersTable: {},
  eq: vi.fn(),
}));

function makeReqRes() {
  const req = {
    log: { error: vi.fn() },
  } as unknown as Request;

  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, status, json, next };
}

describe("requireAdmin middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no userId", async () => {
    mockGetAuth.mockReturnValue({ userId: null });
    const { req, res, status, json, next } = makeReqRes();

    const { requireAdmin } = await import("./admin.js");
    await requireAdmin(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when userId is an empty string", async () => {
    mockGetAuth.mockReturnValue({ userId: "" });
    const { req, res, status, json, next } = makeReqRes();

    const { requireAdmin } = await import("./admin.js");
    await requireAdmin(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not found in the database", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_unknown" });
    mockDbWhere.mockResolvedValue([]);
    const { req, res, status, json, next } = makeReqRes();

    const { requireAdmin } = await import("./admin.js");
    await requireAdmin(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the user exists but is not an admin", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_regular" });
    mockDbWhere.mockResolvedValue([
      { clerkId: "user_regular", isAdmin: false, id: 2 },
    ]);
    const { req, res, status, json, next } = makeReqRes();

    const { requireAdmin } = await import("./admin.js");
    await requireAdmin(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and attaches adminUser to req when the user is an admin", async () => {
    const adminUser = { clerkId: "user_admin", isAdmin: true, id: 1 };
    mockGetAuth.mockReturnValue({ userId: "user_admin" });
    mockDbWhere.mockResolvedValue([adminUser]);
    const { req, res, status, next } = makeReqRes();

    const { requireAdmin } = await import("./admin.js");
    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
    expect((req as { adminUser?: typeof adminUser }).adminUser).toEqual(
      adminUser,
    );
  });

  it("returns 500 when the database throws an error", async () => {
    mockGetAuth.mockReturnValue({ userId: "user_admin" });
    mockDbWhere.mockRejectedValue(new Error("DB connection lost"));
    const { req, res, status, json, next } = makeReqRes();

    const { requireAdmin } = await import("./admin.js");
    await requireAdmin(req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
  });

  it("logs the error when the database throws", async () => {
    const dbError = new Error("DB connection lost");
    mockGetAuth.mockReturnValue({ userId: "user_admin" });
    mockDbWhere.mockRejectedValue(dbError);
    const { req, res, next } = makeReqRes();

    const { requireAdmin } = await import("./admin.js");
    await requireAdmin(req, res, next);

    expect((req as Request & { log: { error: ReturnType<typeof vi.fn> } }).log.error).toHaveBeenCalledWith(
      { err: dbError },
      expect.any(String),
    );
  });
});
