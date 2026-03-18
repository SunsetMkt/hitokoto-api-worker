/**
 * Hitokoto API - Cloudflare Workers implementation
 *
 * API reference: https://developer.hitokoto.cn/sentence/
 * Sentences data: https://github.com/hitokoto-osc/sentences-bundle
 */

import categoriesData from './data/categories.json';
import versionData from './data/version.json';
import sentencesA from './data/sentences/a.json';
import sentencesB from './data/sentences/b.json';
import sentencesC from './data/sentences/c.json';
import sentencesD from './data/sentences/d.json';
import sentencesE from './data/sentences/e.json';
import sentencesF from './data/sentences/f.json';
import sentencesG from './data/sentences/g.json';
import sentencesH from './data/sentences/h.json';
import sentencesI from './data/sentences/i.json';
import sentencesJ from './data/sentences/j.json';
import sentencesK from './data/sentences/k.json';
import sentencesL from './data/sentences/l.json';

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

// ─── Sentence store ───────────────────────────────────────────────────────────

const SENTENCES: Record<string, Sentence[]> = {
  a: sentencesA as Sentence[],
  b: sentencesB as Sentence[],
  c: sentencesC as Sentence[],
  d: sentencesD as Sentence[],
  e: sentencesE as Sentence[],
  f: sentencesF as Sentence[],
  g: sentencesG as Sentence[],
  h: sentencesH as Sentence[],
  i: sentencesI as Sentence[],
  j: sentencesJ as Sentence[],
  k: sentencesK as Sentence[],
  l: sentencesL as Sentence[],
};

const VALID_CATEGORIES = Object.keys(SENTENCES);

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ENCODE = new Set(['json', 'js', 'text']);

const CONTENT_TYPE: Record<string, string> = {
  json: 'application/json; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  text: 'text/plain; charset=utf-8',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
  const values = searchParams.getAll('c').flatMap((v) =>
    // Also support comma-separated values for convenience
    v.split(',').map((s) => s.trim()),
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
        'Content-Type': 'application/json; charset=utf-8',
        ...CORS_HEADERS,
      },
    },
  );
}

function sentenceResponse(
  sentence: Sentence,
  encode: string,
  select: string,
): Response {
  let body: string;

  if (encode === 'js') {
    // Returns a self-executing script that injects the hitokoto text into the DOM
    const hitokoto = JSON.stringify(sentence.hitokoto);
    const selector = select.replace(/'/g, "\\'");
    body = `(function hitokoto(){var hitokoto=${hitokoto};var dom=document.querySelector('${selector}');Array.isArray(dom)?dom[0].innerText=hitokoto:dom.innerText=hitokoto;})()`;
  } else if (encode === 'text') {
    body = sentence.hitokoto;
  } else {
    // json (default)
    body = JSON.stringify(sentence);
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': CONTENT_TYPE[encode] ?? CONTENT_TYPE['json'],
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
  const rawMin = parseInt(params.get('min_length') ?? '', 10);
  const rawMax = parseInt(params.get('max_length') ?? '', 10);

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
    return errorResponse(400, '`max_length` 不能小于 `min_length`！');
  }

  // Parse response encoding
  const encodeParam = params.get('encode') ?? 'json';
  const encode = ALLOWED_ENCODE.has(encodeParam) ? encodeParam : 'json';

  // Parse CSS selector (used only in js mode)
  const select = params.get('select') ?? '.hitokoto';

  // Pick a random sentence
  const sentence = pickSentence(categories, minLength, maxLength);

  if (!sentence) {
    return errorResponse(404, '很抱歉，没有句子符合长度区间。');
  }

  return sentenceResponse(sentence, encode, select);
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
      message: 'OK',
      data: {
        bundle_version: (versionData as { bundle_version?: string }).bundle_version ?? 'unknown',
        categories: categoryStats,
        total,
      },
      ts: Date.now(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...CORS_HEADERS,
      },
    },
  );
}

function handleCategories(): Response {
  return new Response(JSON.stringify(categoriesData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

// ─── Main fetch handler ───────────────────────────────────────────────────────

export default {
  async fetch(request: Request): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return errorResponse(405, 'Method Not Allowed');
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // Route requests
    if (path === '/' || path === '') {
      return handleHitokoto(url);
    }

    if (path === '/status.json' || path === '/status') {
      return handleStatus();
    }

    if (path === '/categories.json' || path === '/categories') {
      return handleCategories();
    }

    // 404 for unknown paths
    return errorResponse(404, 'Not Found');
  },
};
