# Yourpedia · 把简历变成你的个人 wiki 站

[Live](https://colarpedia-setup.vercel.app) · [模板仓库](https://github.com/wangxuzhou666-arch/colarpedia-template)

一个开源 Web 工具：上传简历 PDF → AI 自动提取信息 → 表单核对修改 →
一键 fork 模板仓库 + 提交内容 → Vercel 30 秒上线。
做出来的 wiki 是双语（中文 + English），代码、内容、域名都在你自己的账号下。

灵感来自 Andrej Karpathy 的
[LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 风格。

## 用户视角的流程

1. 打开 [colarpedia-setup.vercel.app](https://colarpedia-setup.vercel.app)
2. 上传简历 PDF（或粘贴一段自我介绍）
3. AI 把表单填好，你检查并补充
4. 用 GitHub 账号登录，点「一键上线我的 wiki」
5. Vercel 一次部署，给你一个可分享的 URL

整个流程约 5 分钟，全程中文，不需要敲命令、不需要懂代码。

## 技术栈

- **Next.js 15** App Router (混合 SSR + 静态)
- **Anthropic Claude Haiku 4.5**——简历解析（tool-use 结构化输出）
- **NextAuth v5 + GitHub OAuth**——一键 fork + commit 到用户仓库
- **@octokit/rest**——GitHub API 调用
- **pdf-parse**——服务端 PDF 文本提取
- **react-hook-form + zod**——表单和校验

## 隐私

- 简历内容会发送到 Anthropic Claude API 做解析（这一步必须走第三方 LLM）
- Anthropic 的数据保留政策见 [anthropic.com/legal/privacy](https://www.anthropic.com/legal/privacy)
- 我们这边**不存储**简历内容、不写日志、不 fingerprint
- GitHub OAuth 申请的是 `public_repo` 权限——这个权限范围比工具实际需要的大
  （我们只往 `colarpedia-template` 的 fork 里写，但 GitHub 给的 token 理论上能写你任何 public repo）。
  如果不放心，可以授权后立刻去 [github.com/settings/applications](https://github.com/settings/applications) 撤销。

## 本地开发

```bash
# 1. 申请 Anthropic API key
#    https://console.anthropic.com/settings/keys
#    免费额度：$5，约 1000 次 Haiku 4.5 解析

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local：
#   ANTHROPIC_API_KEY=sk-ant-...
#   AUTH_SECRET=$(openssl rand -base64 32)
#   GITHUB_CLIENT_ID=...        # https://github.com/settings/developers
#   GITHUB_CLIENT_SECRET=...

# 3. 安装 + 运行
npm install
npm run dev
# → http://localhost:3000/setup/
```

## 架构

| 路由 | 渲染 | 用途 |
|---|---|---|
| `/` | 静态 | 跳转到 `/setup/` |
| `/setup` | 静态 + 客户端 | 表单、PDF 上传、预览 |
| `/api/parse` | 服务端 | Claude API 调用（API key 不出现在浏览器） |
| `/api/polish-entity` | 服务端 | 单条经历的 gap-fill 补充 |
| `/api/deploy` | 服务端 | GitHub fork + commit 用户仓库 |
| `/api/auth/*` | 服务端 | NextAuth GitHub OAuth |

## 成本与限流

- 每次解析：约 $0.005（Haiku 4.5，5K 输入 + 3K 输出 token）
- 默认限流：每个 IP 每天 10 次（`RATE_LIMIT_PER_DAY` 可配置）
- ⚠️ 当前限流是 in-memory per-process，Vercel serverless 冷启动会重置——
  正式上线建议换成 Upstash Redis
- 成本告警：`COST_ALERT_USD`（默认 20）

## 部署

Vercel 项目，Node.js runtime（不是 Edge——`pdf-parse` 需要 Node API）。
环境变量都设到 Project Settings → Environment Variables。

## License

MIT (见 `LICENSE`)。