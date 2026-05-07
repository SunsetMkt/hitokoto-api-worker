/**
 * Hitokoto API - Cloudflare Workers implementation
 *
 * API reference: https://developer.hitokoto.cn/sentence/
 * Sentences data: https://github.com/hitokoto-osc/sentences-bundle
 */

import { unpack } from "msgpackr";
import categoriesPack from "./data/categories.pack";
import versionPack from "./data/version.pack";
import sentencesPackA from "./data/sentences/a.pack";
import sentencesPackB from "./data/sentences/b.pack";
import sentencesPackC from "./data/sentences/c.pack";
import sentencesPackD from "./data/sentences/d.pack";
import sentencesPackE from "./data/sentences/e.pack";
import sentencesPackF from "./data/sentences/f.pack";
import sentencesPackG from "./data/sentences/g.pack";
import sentencesPackH from "./data/sentences/h.pack";
import sentencesPackI from "./data/sentences/i.pack";
import sentencesPackJ from "./data/sentences/j.pack";
import sentencesPackK from "./data/sentences/k.pack";
import sentencesPackL from "./data/sentences/l.pack";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Sentence {
  id: number;
  uuid: string;
  hitokoto: string;
  type: string;
  from: string;
  from_who: string | null;
  creator: string;
  creator_uid: number;
  reviewer: number;
  commit_from: string;
  created_at: string;
  length: number;
}

interface Category {
  id: number;
  name: string;
  desc: string;
  key: string;
  created_at: string;
  updated_at: string;
  path: string;
}

// ─── Sentence store ───────────────────────────────────────────────────────────

const categoriesData: Category[] = unpack(
  new Uint8Array(categoriesPack),
) as Category[];
const versionData = unpack(new Uint8Array(versionPack)) as {
  bundle_version?: string;
};

const SENTENCES: Record<string, Sentence[]> = {
  a: unpack(new Uint8Array(sentencesPackA)) as Sentence[],
  b: unpack(new Uint8Array(sentencesPackB)) as Sentence[],
  c: unpack(new Uint8Array(sentencesPackC)) as Sentence[],
  d: unpack(new Uint8Array(sentencesPackD)) as Sentence[],
  e: unpack(new Uint8Array(sentencesPackE)) as Sentence[],
  f: unpack(new Uint8Array(sentencesPackF)) as Sentence[],
  g: unpack(new Uint8Array(sentencesPackG)) as Sentence[],
  h: unpack(new Uint8Array(sentencesPackH)) as Sentence[],
  i: unpack(new Uint8Array(sentencesPackI)) as Sentence[],
  j: unpack(new Uint8Array(sentencesPackJ)) as Sentence[],
  k: unpack(new Uint8Array(sentencesPackK)) as Sentence[],
  l: unpack(new Uint8Array(sentencesPackL)) as Sentence[],
};

const VALID_CATEGORIES = Object.keys(SENTENCES);

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ENCODE = new Set(["json", "js", "text"]);

const CONTENT_TYPE: Record<string, string> = {
  json: "application/json; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  text: "text/plain; charset=utf-8",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Selects a random sentence matching the given categories and length constraints.
 */
function pickSentence(
  categories: string[],
  minLength: number,
  maxLength: number,
): Sentence | null {
  // Collect all sentences across requested categories that match the length range
  const pool: Sentence[] = [];

  for (const cat of categories) {
    const sentences = SENTENCES[cat];
    if (!sentences) continue;
    for (const s of sentences) {
      if (s.length >= minLength && s.length <= maxLength) {
        pool.push(s);
      }
    }
  }

  return pool.length > 0 ? randomItem(pool) : null;
}

/**
 * Parses and validates the `c` query parameter.
 * Accepts repeated params (?c=a&c=b) and filters out unknown categories.
 */
function parseCategories(searchParams: URLSearchParams): string[] {
  const values = searchParams.getAll("c").flatMap((v) =>
    // Also support comma-separated values for convenience
    v.split(",").map((s) => s.trim()),
  );
  return values.filter((v) => VALID_CATEGORIES.includes(v));
}

// ─── Response builders ────────────────────────────────────────────────────────

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ status, message, data: [], ts: Date.now() }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...CORS_HEADERS,
      },
    },
  );
}

function sentenceResponse(
  sentence: Sentence,
  encode: string,
  select: string,
  callback?: string,
): Response {
  let body: string;

  if (encode === "js") {
    // Returns a self-executing script that injects the hitokoto text into the DOM
    const hitokoto = JSON.stringify(sentence.hitokoto);
    // Escape backslashes first, then single quotes to prevent selector injection
    const selector = select.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    body = `(function hitokoto(){var hitokoto=${hitokoto};var dom=document.querySelector('${selector}');Array.isArray(dom)?dom[0].innerText=hitokoto:dom.innerText=hitokoto;})()`;
  } else if (encode === "text") {
    body = sentence.hitokoto;
  } else {
    // json (default)
    body = JSON.stringify(sentence);
  }

  // Apply callback wrapper if provided
  if (callback) {
    body = `;${callback}(${JSON.stringify(body)});`;
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPE[encode] ?? CONTENT_TYPE["json"],
      ...CORS_HEADERS,
    },
  });
}

// ─── Route handlers ───────────────────────────────────────────────────────────

function handleHitokoto(url: URL): Response {
  const params = url.searchParams;

  // Parse category from query params
  const queryCategories = parseCategories(params);

  // Use all categories if none specified
  const categories =
    queryCategories.length > 0 ? queryCategories : VALID_CATEGORIES;

  // Parse length constraints
  const rawMin = parseInt(params.get("min_length") ?? "", 10);
  const rawMax = parseInt(params.get("max_length") ?? "", 10);

  const minLength = !isNaN(rawMin) && rawMin >= 0 ? rawMin : 0;

  // Default max_length to 30 when not provided (matches reference implementation)
  let maxLength: number;
  if (isNaN(rawMax) || rawMax < 0) {
    maxLength = 30;
  } else if (rawMax > 10000) {
    maxLength = 10000;
  } else {
    maxLength = rawMax;
  }

  if (maxLength < minLength) {
    return errorResponse(400, "`max_length` 不能小于 `min_length`！");
  }

  // Parse response encoding
  const encodeParam = params.get("encode") ?? "json";
  const encode = ALLOWED_ENCODE.has(encodeParam) ? encodeParam : "json";

  // Parse CSS selector (used only in js mode)
  const select = params.get("select") ?? ".hitokoto";

  // Parse callback parameter
  const callback = params.get("callback");

  // Pick a random sentence
  const sentence = pickSentence(categories, minLength, maxLength);

  if (!sentence) {
    return errorResponse(404, "很抱歉，没有句子符合长度区间。");
  }

  return sentenceResponse(sentence, encode, select, callback);
}

function handleStatus(): Response {
  const categoryStats = VALID_CATEGORIES.map((key) => ({
    key,
    count: SENTENCES[key]?.length ?? 0,
  }));

  const total = categoryStats.reduce((sum, s) => sum + s.count, 0);

  return new Response(
    JSON.stringify({
      status: 200,
      message: "OK",
      data: {
        bundle_version: versionData.bundle_version ?? "unknown",
        categories: categoryStats,
        total,
      },
      ts: Date.now(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...CORS_HEADERS,
      },
    },
  );
}

function handleCategories(): Response {
  return new Response(JSON.stringify(categoriesData), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

// ─── Main fetch handler ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse(405, "Method Not Allowed");
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // Route requests
    if (path === "/" || path === "") {
      return handleHitokoto(url);
    }

    if (path === "/status.json" || path === "/status") {
      return handleStatus();
    }

    if (path === "/categories.json" || path === "/categories") {
      return handleCategories();
    }

    // 404 for unknown paths
    return errorResponse(404, "Not Found");
  },
};
