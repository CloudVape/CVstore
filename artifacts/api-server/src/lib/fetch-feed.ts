import { assertPublicHttpUrl, UrlSafetyError } from "./url-safety";

const MAX_CSV_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export class FeedFetchError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "FeedFetchError";
  }
}

/**
 * Fetches a feed URL with SSRF protection. Each redirect hop is re-validated
 * against the private-IP block list. Returns the response body as raw bytes.
 */
export async function fetchFeedFromUrl(rawUrl: string): Promise<Buffer> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let safe: URL;
    try {
      safe = await assertPublicHttpUrl(current);
    } catch (err) {
      if (err instanceof UrlSafetyError) {
        throw new FeedFetchError(err.status, err.message);
      }
      throw err;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    let resp: Response;
    try {
      resp = await fetch(safe.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "CloudVape-Importer/1.0" },
      });
    } catch (err) {
      clearTimeout(timer);
      throw new FeedFetchError(
        502,
        `Failed to reach feed URL: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
    clearTimeout(timer);

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      if (!loc) {
        throw new FeedFetchError(502, `Redirect with no Location header (HTTP ${resp.status})`);
      }
      current = new URL(loc, safe).toString();
      continue;
    }

    if (!resp.ok) {
      throw new FeedFetchError(resp.status, `Failed to fetch feed: HTTP ${resp.status}`);
    }

    const len = resp.headers.get("content-length");
    if (len && Number(len) > MAX_CSV_BYTES) {
      throw new FeedFetchError(413, "Feed exceeds 10MB limit");
    }
    const ab = await resp.arrayBuffer();
    if (ab.byteLength > MAX_CSV_BYTES) {
      throw new FeedFetchError(413, "Feed exceeds 10MB limit");
    }
    return Buffer.from(ab);
  }
  throw new FeedFetchError(502, `Too many redirects (>${MAX_REDIRECTS})`);
}
