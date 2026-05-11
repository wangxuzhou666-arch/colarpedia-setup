// 集中 rate-limit helper — 给 /api/parse + /api/polish-entity 共用。
//
// 设计：
//   - Anonymous 用户: hash(ip + user-agent + UTC date) 作 key，3 次/day。
//     不存原始 IP/UA（守 SOUL 「数据/凭证默认私有」），只存短 hash 当 Redis key。
//   - 已登录 (Supabase) 用户: user.id 作 key，10 次/day。
//   - 超额返回 { ok: false, requireAuth: boolean, remaining: 0, reset: epochMs }，
//     调用方据此返 429。requireAuth=true 时前端弹登录墙，false 时已登录用户超额提示明天再来。
//
// Upstash 选型理由（vs Supabase RPC / Vercel KV）：免费 tier 10K cmd/day 够撑 N=0，
// p50 latency ~50ms，@upstash/ratelimit 5 行接入。详见 backend agent grill report。
//
// Fail-open：如果 Upstash 不可达（env 缺失 / network 挂），不阻断用户流量——
// 经济攻击优先看 Anthropic monthly cap 兜底（已设 $20）。但日志记一下。

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

const HAS_UPSTASH =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let redis = null;
let anonLimiter = null;
let authLimiter = null;

if (HAS_UPSTASH) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  // sliding window 让 quota 平滑过零点，不是日历日 step function。
  anonLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "24 h"),
    analytics: true,
    prefix: "rl:anon",
  });
  authLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "24 h"),
    analytics: true,
    prefix: "rl:auth",
  });
}

function clientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// 16 字节 hex prefix 作 Redis key 主体。不存 raw IP/UA。
// day-bucket 让同设备每天独立 quota（哪怕 sliding window 也加这个增强可读性）。
function anonKey(req) {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash("sha256")
    .update(`${ip}|${ua}|${day}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * 检查 rate limit。
 * @param {Request} req
 * @param {string|null} userId  Supabase user.id，null = 匿名
 * @returns {Promise<{ok: boolean, requireAuth?: boolean, remaining?: number, reset?: number, limit?: number}>}
 */
export async function checkRateLimit(req, userId = null) {
  if (!HAS_UPSTASH) {
    // Dev 环境没配 Upstash 时 fail-open + 警告（生产环境会被 Anthropic cap 兜底）
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[ratelimit] UPSTASH_REDIS_REST_URL / _TOKEN 未配置 — rate limit 失效。Production 必须配。"
      );
    }
    return { ok: true, remaining: 999, limit: 999 };
  }

  try {
    if (userId) {
      const r = await authLimiter.limit(userId);
      return {
        ok: r.success,
        requireAuth: false, // 已登录还超额 = 不能再升级，明天再来
        remaining: r.remaining,
        reset: r.reset,
        limit: r.limit,
      };
    } else {
      const r = await anonLimiter.limit(anonKey(req));
      return {
        ok: r.success,
        requireAuth: !r.success, // 匿名超额 → 弹登录墙
        remaining: r.remaining,
        reset: r.reset,
        limit: r.limit,
      };
    }
  } catch (e) {
    // Upstash 故障时 fail-open，不阻断用户。Anthropic $20 cap 是经济兜底。
    console.error("[ratelimit] Upstash error, failing open:", e.message);
    return { ok: true, remaining: 999, limit: 999, _failOpen: true };
  }
}
