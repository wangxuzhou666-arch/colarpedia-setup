import SetupForm from "./components/SetupForm";

export const metadata = {
  title: "Yourpedia — 5 分钟生成你的个人 wiki 站",
  description:
    "上传简历，自动生成像维基百科一样的个人主页。免费、开源、不用编程。",
};

// 项目 GitHub 仓库 — 用于 tab bar 显示 star 数 + 点击跳转
const GITHUB_REPO = "wangxuzhou666-arch/colarpedia-setup";
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

// 服务端拉取 GitHub star 数，ISR 缓存 1 小时（避免每个请求都打 GitHub API
// 60 req/h/IP 的限额）。失败时返回 null，UI 兜底只显示 "GitHub"。
async function fetchStarCount() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

function formatStars(n) {
  if (n == null || n < 1) return null;
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n / 1000) + "k";
}

// social proof 门槛：star 数 < 5 时显示 ASK（明确求支持），
// ≥ 5 时切回 social proof（有数据可以炫耀了）。
// 不显示 0/1/2 是因为 0 user 阶段挂"0 stars"是反向 social proof。
const SOCIAL_PROOF_THRESHOLD = 5;

export default async function SetupPage() {
  const stars = await fetchStarCount();
  const starsLabel = formatStars(stars);
  const useProof = stars != null && stars >= SOCIAL_PROOF_THRESHOLD;
  const githubFooterText = useProof
    ? `${starsLabel} stars on GitHub →`
    : "Yourpedia 是一个人维护的开源项目，喜欢的话给个 star 支持一下 →";

  return (
    <>
      <div className="wiki-topbar">
        <div className="wiki-topbar-inner">
          <a href="/" className="wiki-logo">
            Yourpedia
            <span>把你的简历变成像维基百科的个人主页 · 5 分钟 · 免费</span>
          </a>
        </div>
      </div>

      <main className="setup-shell">
        <h1 className="wiki-title">生成我的个人 wiki 站</h1>
        <p className="wiki-title-sub">
          上传简历 · 自动填表单 · 一键上线 · 免费 · 不用编程
        </p>

        <p className="setup-intro">
          基于上传的简历自动生成维基风格个人主页。
          简历内容仅用于本次生成，不留存。
        </p>

        <p className="setup-meta">
          想看做出来长什么样？{" "}
          <a href="/demo/" target="_blank" rel="noreferrer">
            点这里看示例
          </a>
          。
        </p>

        <SetupForm />
      </main>

      <footer className="wiki-footer">
        <p>
          Yourpedia 是一个开源工具。生成的 wiki 站点托管在你自己的账号下，
          代码、内容、域名都是你的。
        </p>
        <p>
          内容版权归作者本人所有。Yourpedia 在视觉风格上致敬维基百科，
          与 Wikimedia 基金会无关联。
        </p>
        <p className="wiki-footer-meta">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            {githubFooterText}
          </a>
        </p>
      </footer>
    </>
  );
}
