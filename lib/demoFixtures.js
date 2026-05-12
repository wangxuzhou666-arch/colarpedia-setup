// 示例 wiki 的固定 fixture 数据。两个人物，"示例预览"入口随机选一个。
//
// 设计目标：内容深度对齐 colar-wiki 实际产出（开场段 + 2-3 个 ## 子小节
// + 真实链接、数字、外部资料引用），让 /demo/ 路径看起来跟一个用了半年
// Workplay 的真实用户的 wiki 一样丰满。
//
// Logo 来源：
//   - 真实机构：从 Wikipedia Commons 下载 (CC 授权)，存在 /public/demo-assets/
//   - 虚构机构（Codeleaf / 985 高校 / Independent Consulting / 项目本身）：
//     用内联 SVG 占位（首字母 + slate 渐变），强调 "示例" 语义
//   - 头像走 placeholderPortrait（slate 底 + 中文名字 + "示例照片"），
//     绝不使用真人随机脸，避免严谨性/版权双重问题。

// ---- placeholder SVG generators ----

function placeholderPortrait(givenNameZh) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#475569"/>
        <stop offset="1" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <text x="300" y="345" font-family="'Songti SC','SimSun','Noto Serif CJK SC',serif" font-size="280" fill="#f1f5f9" text-anchor="middle" font-weight="500">${givenNameZh}</text>
    <text x="300" y="510" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="32" fill="#cbd5e1" text-anchor="middle" letter-spacing="6">示 例 照 片</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function placeholderLogo(text) {
  const fontSize = text.length === 1 ? 260 : text.length === 2 ? 180 : 110;
  const yOffset = text.length === 1 ? 345 : text.length === 2 ? 365 : 340;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#64748b"/>
        <stop offset="1" stop-color="#334155"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#lg)"/>
    <text x="300" y="${yOffset}" font-family="'PingFang SC','Songti SC','Noto Serif CJK SC',serif" font-size="${fontSize}" fill="#f8fafc" text-anchor="middle" font-weight="600" letter-spacing="2">${text}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ---- Wang Xue fixture ----

const wangXue = {
  fixtureName: "wang-xue",
  photo_url: placeholderPortrait("雪"),
  data: {
    name: "Wang Xue",
    name_zh: "王雪",
    homepageSlug: "Wang_Xue",
    tagline: "Master's candidate in Systems Engineering · interested in AI tooling and developer experience",
    tagline_zh: "宾大系统工程硕士在读 · 关注 AI 工具和开发者体验",
    bio: "Wang Xue (born 2002) is a Master of Science in Engineering candidate at the [[University_of_Pennsylvania|University of Pennsylvania]], focusing on systems engineering and applied machine learning. She holds a Bachelor of Science from [[Peking_University|Peking University]], where she majored in Information Management with a minor in Statistics.\n\nBefore her graduate studies, Xue interned at [[China_Galaxy_Securities|China Galaxy Securities]] as a Quantitative Research Intern, where she built a Python backtesting framework now used by the firm's three commodity-futures strategy teams. She subsequently spent a summer at [[Microsoft_Research_Asia|Microsoft Research Asia]] as a visiting research intern under the Systems and Networking group, co-authoring one workshop paper on distributed training fault tolerance.\n\nHer side projects include [[Quanta_CLI|Quanta CLI]], an open-source backtesting harness for retail quants (~200 GitHub stars), and [[Wiki_Drift|Wiki Drift]], a Chrome extension that surfaces edit history on Wikipedia article hover. She writes occasionally on Xiaohongshu about her job-hunt journey as an international student.",
    bio_zh: "王雪（2002 年生）是 [[University_of_Pennsylvania|宾夕法尼亚大学]] 系统工程方向的硕士在读生，研究方向涉及系统工程与应用机器学习。本科毕业于 [[Peking_University|北京大学]] 信息管理专业，副修统计学。\n\n本科期间，王雪曾在 [[China_Galaxy_Securities|中国银河证券]] 担任量化研究实习生，开发了一套基于 Python 的策略回测框架，目前被公司三个商品期货策略团队日常使用。研究生第一个暑假，她作为访问研究实习生加入 [[Microsoft_Research_Asia|微软亚洲研究院]] 的系统与网络组，参与合著了一篇关于分布式训练容错的 workshop 论文。\n\n她的业余项目包括 [[Quanta_CLI|Quanta CLI]] —— 一个面向散户量化爱好者的开源回测命令行工具（GitHub 约 200 星），以及 [[Wiki_Drift|Wiki Drift]] —— 一个在维基百科文章悬停时显示编辑历史的 Chrome 扩展。她偶尔在小红书分享留学生求职心得。",
    siteName: "Wangpedia",
    metaBaseUrl: "https://wangxue.example.com",
    githubOwner: "wangxue-demo",
    githubRepo: "wang-xue-wiki",
    email: "wang.xue@upenn.example.com",
    linkedin: "https://linkedin.com/in/wangxue-demo",
    githubProfile: "https://github.com/wangxue-demo",
    shipped: [
      {
        name: "Quanta CLI",
        name_zh: "Quanta CLI",
        slug: "Quanta_CLI",
        description: "Open-source backtesting harness for retail quants",
        description_zh: "面向散户量化爱好者的开源回测命令行工具",
        role: "Author & maintainer",
        role_zh: "作者 / 维护者",
        date_range: "2024 – present",
        url: "https://github.com/wangxue-demo/quanta-cli",
        tech_stack: ["Python", "Polars", "Typer", "Plotly"],
        logo: placeholderLogo("Q"),
        logo_caption: "Quanta CLI (open-source backtesting framework)",
        logo_caption_zh: "Quanta CLI（开源回测框架）",
        body: "**Quanta CLI** is an open-source backtesting framework for retail quantitative researchers, authored by [[Wang_Xue|Wang Xue]]. The project takes a single OHLCV CSV and a strategy file written in Python, and produces a self-contained HTML report with the equity curve, drawdown, and per-trade statistics. As of early 2026 the project has approximately 200 stars on GitHub, three external contributors, and is referenced in two Chinese-language quant tutorials.\n\n## Origin\n\nThe initial version was written during Wang's summer-2023 internship at [[China_Galaxy_Securities|China Galaxy Securities]], where each of the three commodity-futures strategy teams had its own bespoke backtester. The proliferation made cross-team comparison nearly impossible — two desks claiming \"30 percent annualised\" might be reporting numbers that disagreed on slippage assumptions, transaction-cost models, or even calendar conventions. Wang was asked to write a unified harness that the three teams could share. The internal project standardised the proposal-review workflow and is credited with reducing strategy-review turnaround from roughly two weeks to three days.\n\n## Open-source rewrite\n\nAfter the internship, Wang obtained permission from the firm to open-source the framework portion (excluding any proprietary signals or position-management logic) and rewrote it from scratch in her spare time during her senior year at [[Peking_University|Peking University]]. Version 0.1 was published in late 2024. The rewrite emphasised three things the internal version had lacked: a single-binary install via `pipx`, a strict typed strategy interface (so users could not silently look ahead in time), and HTML report output that worked offline.\n\n## Design choices\n\nA notable design decision was the use of **Polars** rather than **pandas** as the dataframe engine. Wang has written publicly that the choice was made primarily for memory predictability — a backtest that exceeds available RAM should fail loudly during the data-loading phase rather than thrash through swap halfway through a 10-year run. The Typer-based CLI was chosen for the same predictability reason: subcommands and arguments are statically validated before any compute work begins.\n\n## Reception\n\nThe project has been featured in two Chinese-language quant blogs and is in active use by an estimated 40–60 hobbyist researchers. The most-requested feature, walk-forward cross-validation, was added in v0.4 (December 2025) and has been Wang's contribution most explicitly credited by external users.",
        body_zh: "**Quanta CLI** 是一个面向散户量化研究员的开源回测框架，作者为 [[Wang_Xue|王雪]]。项目接受一份 OHLCV CSV 和一个 Python 策略文件作为输入，输出包含资金曲线、回撤、逐笔交易统计的可交互 HTML 报告。截至 2026 年初，项目在 GitHub 约 200 星，3 位外部贡献者，并被两个中文量化教程引用。\n\n## 起源\n\n最初版本写于王雪 2023 年暑期 [[China_Galaxy_Securities|中国银河证券]] 实习期间。彼时商品期货组的三个策略小组各有一套自研回测器，导致跨组对比几乎不可能——两个小组都说\"年化 30%\"，可能用的是不同的滑点假设、不同的费率模型、甚至不同的交易日历。王雪被指派写一套三个组共用的统一框架。这个内部项目让策略评审流程从大约两周缩短到三天，是她当年实习的主要交付物。\n\n## 开源重写\n\n实习结束后，王雪从公司拿到了将框架部分（不含任何专有信号或仓位管理逻辑）开源的许可，于本科最后一年（[[Peking_University|北京大学]]）利用业余时间从零重写。2024 年末发布 v0.1。重写版本相比内部版有三点改进：通过 `pipx` 单二进制安装、严格类型化的策略接口（让用户不可能静默地引入未来信息）、以及完全离线可用的 HTML 报告输出。\n\n## 设计取舍\n\n一个值得注意的决策是 dataframe 引擎选用 **Polars** 而非 **pandas**。王雪在公开写作中解释这个选择主要是为了内存可预测性——一个超出内存上限的回测应该在数据加载阶段就明确报错，而不是在 10 年回测跑到一半时陷入 swap 抖动。基于 Typer 的命令行界面出于同样的可预测性考虑：所有子命令和参数在任何 compute 工作开始之前就静态校验。\n\n## 反响\n\n项目被两个中文量化博客介绍过，估计有 40-60 位业余研究员在持续使用。最常被请求的功能 walk-forward 交叉验证已在 v0.4（2025 年 12 月）发布，是被外部用户最显著感谢过的一次贡献。",
      },
      {
        name: "Wiki Drift",
        name_zh: "Wiki Drift",
        slug: "Wiki_Drift",
        description: "Chrome extension surfacing Wikipedia edit history on hover",
        description_zh: "维基百科文章悬停查看编辑历史的 Chrome 扩展",
        role: "Solo developer",
        role_zh: "独立开发者",
        date_range: "2025 春",
        url: "https://github.com/wangxue-demo/wiki-drift",
        tech_stack: ["TypeScript", "Manifest V3", "MediaWiki API"],
        logo: placeholderLogo("WD"),
        logo_caption: "Wiki Drift (Chrome extension)",
        logo_caption_zh: "Wiki Drift（Chrome 扩展）",
        body: "**Wiki Drift** is a Chrome extension authored by [[Wang_Xue|Wang Xue]] in early 2025 as a 48-hour weekend project. The extension overlays a small panel on every Wikipedia article that shows the article's edit frequency over the past 30 days, the percentage of those edits that were subsequently reverted, and direct links to the three most-debated recent diffs. As of early 2026 it has approximately 1,200 weekly active users.\n\n## Motivation\n\nThe project was prompted by a graduate-seminar discussion at [[University_of_Pennsylvania|UPenn]] on the question *\"how do you know whether a Wikipedia article is currently reliable?\"* — the standard answer (\"check the talk page, check the edit history\") is procedurally heavy and almost no reader actually does it. Wang's hypothesis was that a high revert-rate over the past month is a more actionable proxy for *currently disputed* than the binary \"protected / unprotected\" status the article header shows. The extension was built to test that hypothesis on her own browsing in real time.\n\n## Implementation\n\nThe extension runs entirely in Manifest V3 content-script mode and calls the public **MediaWiki API** directly from the browser — there is no backend server. Edit frequencies and revert ratios are computed client-side from the last 500 revisions of each article. To avoid hammering the Wikipedia API, Wang implemented a 24-hour `chrome.storage.local` cache keyed on `(article, language)` and a debounced fetch that only triggers when the user dwells on a page for more than 800 ms.\n\n## Reception\n\nThe extension was posted to a Chinese-language Wikipedia editors' mailing list in April 2025 and accumulated ~600 installs in the first week. The most common piece of user feedback was a request for an inline disagreement-density heatmap directly inside the article body; this was attempted in v0.3 but rolled back when Wang concluded the visual noise outweighed the information gain.",
        body_zh: "**Wiki Drift** 是 [[Wang_Xue|王雪]] 2025 年初用 48 小时周末时间写的 Chrome 扩展。扩展在每篇维基百科文章上叠加一个小面板，显示过去 30 天的编辑频次、其中被回滚的比例，以及最近三个争议最大的 diff 的直链。截至 2026 年初周活约 1,200 人。\n\n## 动机\n\n项目起源于王雪在 [[University_of_Pennsylvania|宾大]] 一门研究生研讨课的讨论：*\"你怎么知道一篇维基百科条目当前是否可信？\"* 标准答案（\"看 talk page、看 edit history\"）流程繁琐，几乎没有读者真的会去做。王雪的猜想是：**过去一个月的高回滚率是\"当前正在被争议\"这个状态的更可操作信号**，比文章头部的二元化\"保护 / 未保护\"标记有用。扩展就是为了在她自己的日常浏览中实时验证这个猜想而做的。\n\n## 实现\n\n扩展完全运行在 Manifest V3 content script 模式下，直接从浏览器调用公开的 **MediaWiki API**——没有任何后端服务器。编辑频次和回滚比例是从每篇文章最近 500 次修订客户端计算出来的。为了避免对维基百科 API 造成压力，王雪做了一个基于 `chrome.storage.local`、按 `(条目, 语言)` 索引的 24 小时缓存，加上 800 ms 的悬停防抖触发。\n\n## 反响\n\n2025 年 4 月发到一个中文维基百科编辑者邮件组后，第一周收到约 600 个安装。用户最多的反馈是希望在文章正文里内嵌一个分歧密度的热力图。这个尝试在 v0.3 做过，但王雪最终判断视觉噪音盖过了信息量，回滚了实现。",
      },
      {
        name: "Resume Wiki (this site)",
        name_zh: "简历 wiki（本站）",
        slug: "Resume_Wiki",
        description: "Personal Wikipedia-styled portfolio, generated via Workplay",
        description_zh: "用 Workplay 生成的维基百科风格个人主页",
        role: "Subject",
        role_zh: "本人",
        date_range: "2026",
        tech_stack: ["Next.js", "Markdown"],
        body: "**Resume Wiki** is the site you are currently reading — [[Wang_Xue|Wang Xue]]'s public-facing résumé, generated via Workplay and hosted on Vercel.\n\n## Why a wiki, not a one-page résumé\n\nWang has written that she chose the static-wiki format over the more common single-page React résumé for one specific reason: a wiki lets recruiters and collaborators **share deep links to entity sub-pages** rather than only the top-level URL. A hiring manager who only cares about her time at [[China_Galaxy_Securities|China Galaxy Securities]] can paste that one page into a Slack thread; a research professor evaluating her for a Ph.D. program can link directly to [[Quanta_CLI|Quanta CLI]] without dragging the reader past her undergraduate coursework. On a single-page résumé, the only shareable unit is the entire document.\n\n## Update cadence\n\nThe site is regenerated end-to-end each time Wang updates her source résumé in Workplay — typically every 2-3 months, or after any concrete addition (a finished course, a shipped project, a new internship offer). All historical versions are retained on the underlying GitHub commit log, which the page footer links to.",
        body_zh: "**简历 wiki** 就是你正在阅读的这个站点——[[Wang_Xue|王雪]] 的公开版简历，由 Workplay 生成，托管在 Vercel。\n\n## 为什么是 wiki 不是单页简历\n\n王雪在公开写作中解释她选择静态 wiki 格式（而非更常见的单页 React 简历）的核心理由：wiki 允许 HR 和合作者**对子页面深度共享链接**，而不只是顶层 URL。一个只关心她在 [[China_Galaxy_Securities|中国银河证券]] 那段经历的 HR 可以直接把那一页粘到 Slack；一个评估她博士申请的教授可以直接链到 [[Quanta_CLI|Quanta CLI]] 项目页，而不必让对方先翻过本科课程列表。单页简历的最小可分享单元就是整篇文档。\n\n## 更新节奏\n\n每次王雪在 Workplay 更新源简历时，整个站点会端到端重新生成——通常每 2-3 个月一次，或者在有具体新增（一门课结课、一个项目上线、一个实习 offer）之后即时更新。所有历史版本保留在底层 GitHub commit log 里，页脚有指向链接。",
      },
    ],
    educations: [
      {
        name: "University of Pennsylvania",
        name_zh: "宾夕法尼亚大学",
        slug: "University_of_Pennsylvania",
        degree: "MSE in Systems Engineering",
        degree_zh: "系统工程硕士",
        date_range: "2025 年 8 月 – 2027 年 5 月（预计）",
        location: "美国宾夕法尼亚州费城",
        logo: "/demo-assets/upenn-shield.png",
        logo_caption: "Coat of arms of the University of Pennsylvania",
        logo_caption_zh: "宾夕法尼亚大学校徽",
        body: "**University of Pennsylvania** is one of the institutions attended by [[Wang_Xue|Wang Xue]]. She entered UPenn in August 2025 as a candidate for the **Master of Science in Engineering in Systems Engineering**, a two-year program offered by the Department of Electrical and Systems Engineering within the School of Engineering and Applied Science.[^1]\n\n## Program\n\nThe MSE in Systems Engineering at UPenn sits at the intersection of applied mathematics, machine-learning systems, and large-scale optimisation. Wang's concentration emphasises **machine-learning systems and distributed computing**; her electives across the four semesters include Applied Machine Learning, Statistics for Data Science, Simulation Modeling, and a Computer Systems Architecture course cross-listed from the CIS department.\n\n## Capstone project\n\nWang's two-semester capstone, advised by a professor in CIS, is a **benchmark suite for fault recovery in distributed training jobs** — specifically, measuring how various checkpointing strategies (synchronous, asynchronous, and gradient-replicated) trade off recovery latency against training-throughput overhead under realistic GPU-failure rates derived from MSRA's published cluster traces. The first-semester deliverable was a reproducible measurement harness; the second-semester deliverable is a set of recommendations for the training framework her advisor's group maintains.\n\n## Context\n\nWang has cited her UPenn coursework on simulation modeling as directly relevant to [[Quanta_CLI|Quanta CLI]]'s walk-forward validation feature, and her applied-ML coursework as the basis for the workshop paper co-authored during her [[Microsoft_Research_Asia|Microsoft Research Asia]] internship.",
        body_zh: "**宾夕法尼亚大学**是 [[Wang_Xue|王雪]] 求学的院校之一。2025 年 8 月入读，攻读工程与应用科学学院电气与系统工程系开设的两年制**系统工程工学硕士（MSE in Systems Engineering）**项目。[^1]\n\n## 项目\n\n宾大系统工程硕士项目位于应用数学、机器学习系统、大规模优化三者的交叉点。王雪的方向侧重**机器学习系统与分布式计算**；四学期选修包括应用机器学习、数据科学统计、仿真建模、以及一门跨开自 CIS 系的计算机系统架构课程。\n\n## 毕业课题\n\n王雪的两学期毕业课题由 CIS 系教授指导，主题是**分布式训练任务的故障恢复 benchmark 套件**——具体是测量在 MSRA 公开 cluster trace 给出的真实 GPU 故障率下，不同 checkpoint 策略（同步、异步、梯度复制）在恢复延迟和训练吞吐开销之间的权衡。第一学期交付的是可复现的测量框架，第二学期交付的是给她导师组维护的训练框架的优化建议。\n\n## 上下文\n\n王雪在公开写作中表示，宾大的仿真建模课程对 [[Quanta_CLI|Quanta CLI]] 的 walk-forward 交叉验证功能有直接启发；应用机器学习课程则是她在 [[Microsoft_Research_Asia|微软亚洲研究院]] 实习期间合著的 workshop 论文的方法论基础。\n\n[^1]: \"Master of Science in Engineering — Systems Engineering\". [ese.seas.upenn.edu](https://ese.seas.upenn.edu/).",
      },
      {
        name: "Peking University",
        name_zh: "北京大学",
        slug: "Peking_University",
        degree: "B.S. in Information Management, minor in Statistics",
        degree_zh: "信息管理学士，副修统计学",
        date_range: "2020 – 2024",
        location: "北京",
        logo: "/demo-assets/peking-university-seal.png",
        logo_caption: "Seal of Peking University",
        logo_caption_zh: "北京大学校徽",
        body: "**Peking University** is the undergraduate institution of [[Wang_Xue|Wang Xue]]. She enrolled in 2020 in the School of Information Management, majoring in **Information Management and Information Systems** with a minor in **Statistics** from the Department of Probability and Statistics. She graduated with the *cum laude*–equivalent \"outstanding graduate\" designation in 2024.\n\n## Curriculum\n\nThe Information Management program at PKU combines library and information science, data management, and applied statistics — a hybrid that Wang has described as *\"how the university teaches data infrastructure without calling it that.\"* Her electives drifted toward the quantitative side over four years: stochastic processes, time-series analysis, and a graduate-level seminar on financial econometrics co-taught with the Guanghua School of Management.\n\n## Senior thesis\n\nWang's senior thesis, supervised by a professor in the Department of Probability and Statistics, examined the **time-series properties of intraday order-book imbalance in Chinese commodity-futures markets**. The thesis used 18 months of tick-level data from three liquid contracts (rebar, soybean meal, and copper) and tested whether a specific imbalance signal had any predictive power for short-horizon returns after accounting for realistic transaction costs. The conclusion — that the signal was statistically robust but economically marginal at retail spread levels — directly motivated the open-source release of [[Quanta_CLI|Quanta CLI]] in late 2024.\n\n## Context\n\nWang has cited her PKU statistics minor, particularly the time-series and stochastic-processes sequence, as the most consistently relevant academic background to both her [[China_Galaxy_Securities|China Galaxy Securities]] internship and her current research at [[University_of_Pennsylvania|UPenn]].",
        body_zh: "**北京大学**是 [[Wang_Xue|王雪]] 的本科母校。2020 年入读信息管理学院，主修**信息管理与信息系统**，副修概率统计系的**统计学**。2024 年以\"优秀毕业生\"身份毕业。\n\n## 课程\n\n北大信息管理专业把图书情报学、数据管理、应用统计学三块结合，王雪在公开写作中形容这是*\"学校在不叫它数据基础设施的前提下教数据基础设施\"*。她四年选修整体偏向定量方向：随机过程、时间序列分析、以及一门跟光华管理学院合开的金融计量经济学高年级研讨课。\n\n## 毕业论文\n\n王雪的毕业论文由概率统计系教授指导，研究**中国商品期货市场盘中订单簿失衡的时间序列性质**。论文使用了螺纹钢、豆粕、铜三个高流动性合约 18 个月的 tick 级数据，检验一个特定的失衡信号在考虑现实交易成本之后是否对短期收益有预测能力。结论是\"该信号统计上稳健但在散户点差水平下经济意义边际\"，这个结论直接促成了 2024 年末 [[Quanta_CLI|Quanta CLI]] 的开源发布。\n\n## 上下文\n\n王雪多次提到北大统计副修——特别是时间序列和随机过程序列——是对她 [[China_Galaxy_Securities|银河证券]] 实习和 [[University_of_Pennsylvania|宾大]] 现阶段研究最一致相关的学术背景。",
      },
    ],
    experiences: [
      {
        name: "Microsoft Research Asia",
        name_zh: "微软亚洲研究院",
        slug: "Microsoft_Research_Asia",
        role: "Visiting Research Intern, Systems & Networking Group",
        role_zh: "访问研究实习生，系统与网络组",
        date_range: "2026 年 6 月 – 8 月",
        location: "北京",
        logo: "/demo-assets/microsoft-logo.png",
        logo_caption: "Microsoft, parent organisation of Microsoft Research Asia",
        logo_caption_zh: "微软（微软亚洲研究院的母机构）",
        body: "**Microsoft Research Asia (MSRA)** is the Beijing-based research arm of Microsoft Corporation and one of the largest industrial computer-science research labs in Asia. [[Wang_Xue|Wang Xue]] spent the summer of 2026 at MSRA as a **Visiting Research Intern** under the Systems and Networking group, between her first and second years at [[University_of_Pennsylvania|UPenn]].\n\n## Role\n\nWang's project focused on **fault tolerance in distributed training jobs** — specifically, the question of how to recover from individual worker failures without restarting an entire job from the latest synchronous checkpoint. The internship had two concrete deliverables: a measurement study of recovery cost under realistic cluster-failure traces, and a prototype of a finer-grained recovery scheme that preserves the in-flight gradient computation of unaffected workers. The measurement study was eventually published as a workshop paper (Wang second-author) at a major systems conference.\n\n## Context\n\nThe Systems and Networking group at MSRA has historically been one of the most prolific producers of papers on training-cluster reliability, and Wang's host was the principal investigator on the cluster trace dataset that her later [[University_of_Pennsylvania|UPenn]] capstone project would build on. Wang has cited the internship as the bridge between her undergraduate statistical-modeling background and the systems-research framing of her capstone, and the workshop paper as the artifact that justified her transition from \"someone who has taken ML courses\" to \"someone who can be trusted to make experimental claims about ML systems.\"",
        body_zh: "**微软亚洲研究院（MSRA）**是微软公司位于北京的研究分支，是亚洲规模最大的工业界计算机科学研究机构之一。[[Wang_Xue|王雪]] 在 [[University_of_Pennsylvania|宾大]] 第一年到第二年之间的暑期（2026 年夏）在 MSRA 系统与网络组担任**访问研究实习生**。\n\n## 角色\n\n王雪的项目聚焦**分布式训练任务的容错**——具体来说，如何在单个 worker 故障时，避免整个任务从最近一次同步 checkpoint 重启。实习有两个具体交付物：一个在真实集群故障 trace 上做的恢复成本测量研究，以及一个保留未受影响 worker 在途梯度计算的细粒度恢复方案原型。测量研究最终作为 workshop 论文（王雪二作）被一个主要系统会议接收。\n\n## 上下文\n\nMSRA 系统与网络组历来是训练集群可靠性方向产出最多的研究组之一，王雪的导师正是她后来 [[University_of_Pennsylvania|宾大]] 毕业课题所依赖的集群 trace 数据集的负责人。王雪多次表示，这次实习是连接她本科统计建模背景与毕业课题的系统研究框架的关键桥梁，也是让她从\"上过 ML 课的人\"转变为\"可以被信任做 ML 系统实验性论断的人\"的关键凭证。",
      },
      {
        name: "China Galaxy Securities",
        name_zh: "中国银河证券",
        slug: "China_Galaxy_Securities",
        role: "Quantitative Research Intern",
        role_zh: "量化研究实习生",
        date_range: "2023 年 6 月 – 9 月",
        location: "上海",
        logo: "/demo-assets/china-galaxy-logo.png",
        logo_caption: "China Galaxy Securities (state-owned brokerage)",
        logo_caption_zh: "中国银河证券（国有券商）",
        body: "**China Galaxy Securities** is a state-owned Chinese brokerage and one of the country's largest publicly listed securities firms. [[Wang_Xue|Wang Xue]] interned at the firm's Shanghai office as a **Quantitative Research Intern** in the summer between her junior and senior years at [[Peking_University|Peking University]] (2023).\n\n## Role\n\nWang was placed in the commodity-futures strategy team, which at the time consisted of three sub-desks (rebar/iron ore, oilseeds, and copper) operating independently. Her assigned project was a **shared Python backtesting framework** that all three desks could use to evaluate new strategy proposals. The motivation was procedural: each desk had its own bespoke backtester, and the team head had spent the previous quarter trying to reconcile three apparent 30 percent annualised returns that turned out to be reported under three different slippage models. Wang's framework standardised the calendar, the cost model, and the report format. The internal-review turnaround for new strategy proposals dropped from roughly two weeks to three days after adoption.\n\n## Context\n\nThe internship was Wang's first exposure to professional quantitative-research workflow, and the original prompt for what later became the open-source [[Quanta_CLI|Quanta CLI]] project. Wang has cited the experience as the reason she pursued the time-series and stochastic-processes electives at [[Peking_University|PKU]] in her senior year, and the empirical anchor for her senior thesis on order-book-imbalance signals in Chinese commodity-futures markets.",
        body_zh: "**中国银河证券**是国有控股的中国券商，是国内规模最大的上市证券公司之一。[[Wang_Xue|王雪]] 2023 年暑期在该公司上海分部担任**量化研究实习生**，时间介于她在 [[Peking_University|北京大学]] 的大三大四之间。\n\n## 角色\n\n王雪被分配到商品期货策略组，该组当时由三个子小组（黑色金属、油脂、有色铜）独立运作。她接到的任务是开发**三个小组共用的 Python 回测框架**。这个任务的源头是流程上的：每个组都有自己的私家回测器，组长上一个季度花了大量时间在三个号称\"年化 30%\"但其实用了三套不同滑点模型的策略之间做对账。王雪的框架统一了交易日历、费率模型、报告格式。框架投入使用之后，新策略提案的内部评审周期从大约两周缩短到三天。\n\n## 上下文\n\n这次实习是王雪第一次接触专业量化研究的工作流，也是后来开源 [[Quanta_CLI|Quanta CLI]] 的最初原型。王雪多次提到，这段经历是她大四在 [[Peking_University|北大]] 重点选修时间序列与随机过程的直接动因，也是她毕业论文研究商品期货订单簿失衡信号的经验基础。",
      },
    ],
  },
};

// ---- Wang Wei fixture ----

const wangWei = {
  fixtureName: "wang-wei",
  photo_url: placeholderPortrait("伟"),
  data: {
    name: "Wang Wei",
    name_zh: "王伟",
    homepageSlug: "Wang_Wei",
    tagline: "Educator turned product builder · 8 years of university teaching · transitioning into EdTech product management",
    tagline_zh: "高校讲师 8 年 · 教育科技创业经历 · 转型互联网产品经理",
    bio: "Wang Wei (born 1984) is a lecturer at a 985 university in China, where he has taught computer science fundamentals for eight years and published twelve peer-reviewed papers. He earned his doctorate from [[Tsinghua_University|Tsinghua University]] and his bachelor's from [[Peking_University|Peking University]].\n\nIn 2021, he co-founded [[Codeleaf|Codeleaf]], an EdTech startup providing structured Python curricula for Chinese middle schools. The company reached 8,000 paying students at its peak before winding down in 2023 due to regulatory changes in China's after-school tutoring sector. The experience left him with a lasting interest in how educational products are designed and shipped, and a conviction that he wants to move from teaching the discipline to building the tools.\n\nHis writing on Zhihu, where he answers questions about both teaching pedagogy and career transitions for academics, has accumulated 2.5 million reads and 47,000 followers. He is the author of [[Python_For_K12|Python for K12]], a self-published textbook (2022) that has been adopted as supplementary reading in 80+ Chinese middle schools.",
    bio_zh: "王伟（1984 年生）是中国某 985 高校讲师，已任教 8 年，主讲计算机基础课程，发表同行评审论文 12 篇。博士毕业于 [[Tsinghua_University|清华大学]]，本科毕业于 [[Peking_University|北京大学]]。\n\n2021 年，他与人共同创办了 [[Codeleaf|Codeleaf]] —— 一个为中国中学提供结构化 Python 课程的教育科技创业项目。公司峰值时有 8,000 名付费学生，2023 年由于国内课外培训政策调整而停止运营。这段经历让他对教育产品的设计和落地产生了持续兴趣，也确立了他要从「教这个学科」转向「做这个领域的工具」的决心。\n\n他在知乎上回答关于教学法和学术界职业转型的问题，累计阅读 250 万次、粉丝 4.7 万。他还是 [[Python_For_K12|Python for K12]] 这本自出版教材的作者（2022），目前被 80+ 中国中学采纳为补充阅读材料。",
    siteName: "Weipedia",
    metaBaseUrl: "https://wangwei.example.com",
    githubOwner: "wangwei-demo",
    githubRepo: "wang-wei-wiki",
    email: "wei.wang@example.edu",
    linkedin: "https://linkedin.com/in/wangwei-edu",
    githubProfile: "",
    shipped: [
      {
        name: "Codeleaf",
        name_zh: "Codeleaf",
        slug: "Codeleaf",
        description: "EdTech startup — Python curricula for Chinese middle schools",
        description_zh: "教育科技创业 —— 面向中国中学的 Python 课程产品",
        role: "Co-founder & curriculum lead",
        role_zh: "联合创始人 / 课程负责人",
        date_range: "2021 – 2023",
        url: "",
        tech_stack: ["Curriculum design", "B2B sales", "教学法"],
        logo: placeholderLogo("CL"),
        logo_caption: "Codeleaf (EdTech startup, 2021–2023)",
        logo_caption_zh: "Codeleaf（教育科技创业，2021–2023）",
        body: "**Codeleaf** was a Chinese EdTech company co-founded by [[Wang_Wei|Wang Wei]] in 2021 with the goal of bringing a structured Python curriculum into middle schools that had previously taught coding only as an extracurricular elective. The company operated for approximately two and a half years before winding down operations in late 2023.\n\n## Product\n\nAs curriculum lead, Wang designed the company's **64-lesson Python sequence**, organised into four arcs of sixteen lessons each. The defining pedagogical choice was to anchor every coding concept to an analogy from middle-school mathematics or physics — for instance, introducing functions through the algebra-class notion of $f(x)$ rather than the more common \"recipe\" metaphor, and introducing iteration through the physics-class notion of cumulative motion rather than the abstract idea of \"doing something many times.\" This bridging style was the core differentiator from competing curricula, most of which were derived from English-language coding-bootcamp material that did not assume any specific middle-school baseline.\n\n## Operations\n\nCodeleaf shipped two product tiers. The **school-licensed tier** sold to middle schools as a full-semester curriculum with teacher-training materials and a per-student annual license. The **direct-to-family tier** sold a self-paced version to parents through a WeChat mini-program. At peak in mid-2023, the company had approximately 8,000 paying students across 22 Chinese cities, with the school-licensed tier accounting for about two thirds of revenue.\n\n## Wind-down\n\nIn the second half of 2023, the company wound down operations following the regulatory tightening of China's after-school education sector. The closure was orderly: every direct-to-family customer was either refunded the remaining months of their subscription or migrated to a partner platform with continued curriculum access, and all school-tier contracts were honoured through the academic year. The team published a public closure note explaining the decision and is occasionally cited in Chinese-language analyses of the post-2021 EdTech contraction.\n\n## Aftermath\n\nWang has described the Codeleaf experience as the turning point of his career: it gave him direct exposure to product design, B2B sales, and operational decision-making under regulatory uncertainty, all of which he has cited as the reason he is now seeking a full transition into [[Independent_Consulting|industry product-management roles]] rather than returning to a tenure-track academic path.",
        body_zh: "**Codeleaf** 是 [[Wang_Wei|王伟]] 2021 年共同创办的中国教育科技公司，目标是把结构化的 Python 课程引入此前只把编程当兴趣选修的中学。公司运营了大约两年半，2023 年末停止运营。\n\n## 产品\n\n作为课程负责人，王伟设计了公司的**64 节 Python 课程序列**，组织为四个 16 节课的弧线。最核心的教学法选择是：把每个编程概念锚定到一个中学数学或物理的类比上——比如通过代数课的 $f(x)$ 概念引入\"函数\"，而不是更常见的\"菜谱\"比喻；通过物理课的\"累积运动\"引入循环，而不是抽象的\"重复做某事\"。这种\"搭桥式\"风格是与竞品最核心的差异——竞品大多是从英文 coding bootcamp 改写过来的，并不假设学生有具体的中学基础。\n\n## 运营\n\nCodeleaf 有两条产品线。**学校授权线**作为完整学期课程卖给中学，含教师培训资料、按学生数年度授权计费。**家庭直购线**是自学版，通过微信小程序卖给家长。2023 年中期峰值时，公司在国内 22 个城市约有 8,000 名付费学生，学校授权线占营收约三分之二。\n\n## 退出\n\n2023 下半年，公司因国内课外教育行业政策调整而有序停止运营。退出过程秩序良好：每位家庭直购客户要么退还订阅剩余月数，要么迁移到合作平台继续访问课程；所有学校授权合同履约到当学年结束。团队发布了公开的退出说明，目前偶尔被中文 2021 后教培行业回顾文章引用。\n\n## 后续\n\n王伟将 Codeleaf 经历视为职业转折点：让他直接接触产品设计、B2B 销售、政策不确定性下的运营决策——他多次以此为理由说明，为什么他现在追求全职转入工业界产品岗，而不是回到教职评聘路径。",
      },
      {
        name: "Python for K12",
        name_zh: "Python for K12",
        slug: "Python_For_K12",
        description: "Self-published textbook adopted by 80+ Chinese middle schools",
        description_zh: "自出版教材，被 80+ 中国中学采用为补充阅读",
        role: "Author",
        role_zh: "作者",
        date_range: "2022",
        url: "https://example.com/python-for-k12",
        tech_stack: ["Pedagogy", "Python", "Textbook design"],
        logo: "/demo-assets/python-logo.png",
        logo_caption: "Python programming language (subject of the textbook)",
        logo_caption_zh: "Python 编程语言（教材主题）",
        body: "**Python for K12** is a 240-page introductory Python textbook written by [[Wang_Wei|Wang Wei]] in 2022. The book draws on Wang's five years of classroom teaching at the time and was self-published in both print and PDF editions. As of 2026 it has sold approximately 18,000 copies and appears on the supplementary-reading list of more than 80 middle schools in China.\n\n## Pedagogical approach\n\nThe distinctive feature of the book is the same one that later defined [[Codeleaf|Codeleaf]]'s curriculum: every chapter pairs a coding concept with an analogy drawn from middle-school mathematics or physics. The introduction to variables uses the algebra-class concept of a labelled box; the introduction to conditionals uses the physics-class concept of a thermostat. The intent is not to teach the analogy as a literal mental model, but to give a student with no prior programming exposure a familiar starting point from which to triangulate the actual semantics.\n\n## Structure\n\nThe book is organised into twelve chapters: the first nine cover language fundamentals (variables, conditionals, loops, functions, lists, dictionaries, files, classes, and error handling); the last three are applied chapters on data manipulation, simple plotting, and a final \"capstone project\" chapter that walks through building a personal expense tracker end-to-end. Each chapter ends with three difficulty tiers of exercises and a one-page \"why this matters in a real codebase\" sidebar — a style choice that Wang has said was inspired by physics textbook *Concepts of Physics* (H. C. Verma).\n\n## Adoption\n\nThe textbook is widely used as supplementary reading rather than as the primary text in adopting schools. Wang has noted that this is consistent with his original design intent: the book is structured to be read on weekends or evenings as a companion to whatever official curriculum the school uses. The 80+ school adoption figure is self-reported via the publisher's order channel and has not been independently audited.",
        body_zh: "**Python for K12** 是 [[Wang_Wei|王伟]] 2022 年撰写的 240 页 Python 入门教材，凝练了他当时五年课堂教学的经验，以印刷版和 PDF 版自出版。截至 2026 年，累计销量约 1.8 万册，被国内 80 余所中学列入补充阅读书目。\n\n## 教学法\n\n本书最显著的特点正是后来定义 [[Codeleaf|Codeleaf]] 课程的那个特点：每一章都把一个编程概念配上一个来自中学数学或物理的类比。变量章节用代数课的\"贴标签的盒子\"概念；条件语句章节用物理课的\"温控器\"概念。意图不是把类比作为字面意义上的心理模型，而是给一个没有编程基础的学生一个熟悉的起点，从这个起点去三角定位真实语义。\n\n## 结构\n\n全书分十二章：前九章覆盖语言基础（变量、条件、循环、函数、列表、字典、文件、类、异常处理）；后三章是应用章节，包括数据处理、简单绘图、以及一个端到端搭建个人支出记账器的「毕业项目」章节。每章末尾都有三档难度的练习题和一页\"在真实代码里这件事为什么重要\"的边栏——王伟说这个边栏的灵感来自 H. C. Verma 的物理教材 *Concepts of Physics*。\n\n## 采用\n\n本书在采用学校里大多作为补充阅读而非主教材使用。王伟提到这与他最初的设计意图一致：本书结构上就是为周末晚上阅读、作为学校官方课程的伴侣材料而设计的。80+ 所学校采用这一数字是通过出版社渠道自报，未经独立审计。",
      },
      {
        name: "Zhihu Column \"教书匠转码\"",
        name_zh: "知乎专栏《教书匠转码》",
        slug: "Zhihu_Column",
        description: "Long-running column on teaching pedagogy and academic-to-industry transitions",
        description_zh: "关于教学法和学术界转工业界经验的长期专栏",
        role: "Author",
        role_zh: "作者",
        date_range: "2020 – present",
        url: "https://zhihu.com/people/wangwei-demo",
        tech_stack: ["Writing", "Community building"],
        logo: "/demo-assets/zhihu-logo.png",
        logo_caption: "Zhihu, the platform hosting the column",
        logo_caption_zh: "知乎（专栏所在平台）",
        body: "**\"教书匠转码\"** (literally *\"From Teacher to Coder\"*) is a long-running Zhihu column authored by [[Wang_Wei|Wang Wei]] since 2020. The column began as a venue for answering pedagogical questions from other teachers and gradually expanded to cover Wang's own career-transition journey from academia toward industry product-management roles.\n\n## Audience and reach\n\nAs of early 2026, the column has approximately **47,000 followers and 2.5 million cumulative reads** across roughly 180 long-form answers and 30 standalone essays. The audience skews bimodal: roughly half are current or aspiring middle-school and high-school coding teachers; the other half are academics in non-technical fields (humanities, social sciences) considering a transition out of tenure-track careers.\n\n## Notable pieces\n\nWang's most-read individual piece is *\"34 岁还来得及转产品吗\"* (\"Is 34 too late to transition into product management?\", 2024), which has accumulated approximately 380,000 reads and is regularly cited in similar Zhihu threads. A related piece, *\"博士做了五年讲师，我学到了哪些 PM 用得上的东西\"* (\"Five years as a lecturer with a Ph.D. — what transferred to PM work\"), has roughly 220,000 reads and is the piece Wang most often references in recruiter conversations.\n\n## Style\n\nThe column is written in a deliberately personal register that Wang has described as *\"the opposite of LinkedIn voice\"* — first-person, willing to name specific stuck moments, and skeptical of the usual self-improvement narrative arc. Wang has cited this style as one of the reasons the column has retained engagement through the platform's general decline in long-form reading: the audience is reading for a sense of being understood, not for actionable advice, which is a more durable need.",
        body_zh: "**《教书匠转码》**是 [[Wang_Wei|王伟]] 自 2020 年起在知乎维护的长期专栏。专栏最早是回答其他老师的教学法问题，后来逐渐扩展到记录王伟自己从学术界向工业界产品岗位转型的全过程。\n\n## 读者与覆盖\n\n截至 2026 年初，专栏约有**4.7 万粉丝、累计 250 万阅读**，分布在约 180 篇长答案和 30 篇独立文章里。受众呈双峰分布：约一半是中小学编程教师及有志成为教师的人；另一半是非技术领域（人文、社科）正在考虑转出教职评聘体系的学者。\n\n## 代表作\n\n王伟最热门的单篇是《34 岁还来得及转产品吗》（2024），累计阅读约 38 万，被多个类似话题反复引用。一篇相关的《博士做了五年讲师，我学到了哪些 PM 用得上的东西》阅读约 22 万，是王伟在猎头对话中最常引用的一篇。\n\n## 风格\n\n专栏用一种王伟自己形容为*\"跟 LinkedIn 腔反过来\"*的非常个人化的写作风格——第一人称、愿意点名具体卡住的瞬间、对常规自我提升叙事弧持怀疑。王伟说这种风格是专栏在平台长文阅读整体衰退的背景下仍能保持参与度的关键原因之一：读者读的是\"被理解的感觉\"而不是\"可操作建议\"，前者是更持久的需求。",
      },
    ],
    educations: [
      {
        name: "Tsinghua University",
        name_zh: "清华大学",
        slug: "Tsinghua_University",
        degree: "Ph.D. in Computer Science",
        degree_zh: "计算机科学博士",
        date_range: "2010 – 2015",
        location: "北京",
        logo: "/demo-assets/tsinghua-logo.png",
        logo_caption: "Tsinghua University logo",
        logo_caption_zh: "清华大学校徽",
        body: "**Tsinghua University** is the institution where [[Wang_Wei|Wang Wei]] earned his Ph.D. in Computer Science. He entered the doctoral program in 2010 and defended his thesis in 2015, under the supervision of a professor in the Department of Computer Science and Technology.\n\n## Dissertation\n\nWang's dissertation, *Graph-based modeling of student knowledge-state evolution in MOOCs*, examined how the historical interaction sequence of a student across MOOC platform exercises could be modeled as a graph of knowledge-concept transitions, and how that graph could be used to predict near-future performance on unseen exercises. The work was grounded in a dataset of approximately three million interaction records from an early Chinese MOOC platform that Tsinghua co-operated at the time. Wang's contribution was the graph formulation and the corresponding training procedure; downstream evaluations were conducted by collaborators at the partner platform.\n\n## Publications\n\nDuring his doctoral studies, Wang published five peer-reviewed papers across the educational-data-mining and learning-analytics venues. The thesis itself was awarded the department's annual *outstanding dissertation* designation in 2015, and elements of the graph-formulation contribution have since been cited in approximately 90 follow-on papers (Google Scholar, accessed 2026).\n\n## Aftermath\n\nWang has cited the Tsinghua period as both the technical foundation for his subsequent classroom-teaching career and the intellectual root of [[Codeleaf|Codeleaf]]: the basic question of *\"what is a student actually learning, and how do we know\"* was carried forward from the dissertation into the curriculum-design work at the startup, only with a much smaller and more controllable dataset of his own students.",
        body_zh: "**清华大学**是 [[Wang_Wei|王伟]] 取得计算机科学博士学位的院校。2010 年入学，2015 年在计算机科学与技术系教授指导下完成博士论文答辩。\n\n## 博士论文\n\n王伟的博士论文《MOOC 中学生知识状态演化的图建模》研究的是：一个学生在 MOOC 平台上跨练习的历史交互序列如何被建模为知识点跃迁的图，以及这个图如何被用来预测该学生在未见过的练习上的近期表现。研究基于清华当时合作运营的一个早期中文 MOOC 平台的约 300 万条交互记录。王伟的贡献是图建模和对应的训练流程；下游评估由合作平台的同行完成。\n\n## 发表\n\n博士期间，王伟在教育数据挖掘和学习分析领域共发表 5 篇同行评审论文。博士论文本身获得 2015 年系级\"优秀博士学位论文\"称号，图建模相关贡献至今被约 90 篇后续工作引用（Google Scholar，2026 年访问）。\n\n## 后续\n\n王伟多次表示，清华时期既是他后来课堂教学生涯的技术底盘，也是 [[Codeleaf|Codeleaf]] 的思想根源：博士论文里那个根本问题——\"学生到底学到了什么，我们怎么知道？\"——被一直带到了创业期间的课程设计工作中，只不过那里的数据集是他自己几千个学生，规模小得多、可控得多。",
      },
      {
        name: "Peking University",
        name_zh: "北京大学",
        slug: "Peking_University",
        degree: "B.S. in Mathematics",
        degree_zh: "数学学士",
        date_range: "2003 – 2007",
        location: "北京",
        logo: "/demo-assets/peking-university-seal.png",
        logo_caption: "Seal of Peking University",
        logo_caption_zh: "北京大学校徽",
        body: "**Peking University** is the undergraduate institution of [[Wang_Wei|Wang Wei]]. He enrolled in 2003 in the Department of Mathematics and graduated in 2007 with a B.S. in Mathematics.\n\n## Choice of major\n\nWang's matriculation result placed him within reach of either the mathematics or computer-science programs; he chose mathematics for what he has publicly described as a deliberately backwards reason: *\"I wanted to spend the four years with the option of going either further into theory or sideways into any applied field, and the math department was the only place that left both doors open.\"* The decision was vindicated, in his telling, by the speed with which he was able to pick up algorithms-heavy computer-science subfields during his doctoral studies at [[Tsinghua_University|Tsinghua]].\n\n## Curriculum and senior thesis\n\nThe PKU mathematics curriculum of the time was structured around a two-year analysis sequence, a one-year algebra sequence, and a final-year set of electives drawn from probability, statistics, and applied mathematics. Wang's electives leaned toward probability and combinatorics, and his senior thesis (advised by a professor in the probability group) was on a combinatorial-counting problem related to spanning trees of bipartite graphs — a topic that he has noted, somewhat wryly, has nothing to do with anything else on his current résumé. He has occasionally cited this fact as an argument against the genre of advice that says undergraduate majors should be \"strategically aligned with career.\"\n\n## Context\n\nWang has described the PKU period as the source of his durable habit of *\"writing things down precisely before reasoning about them\"* — a habit he has cited as the most consistently transferable skill from his mathematics training into both his classroom teaching and, later, his curriculum design at [[Codeleaf|Codeleaf]].",
        body_zh: "**北京大学**是 [[Wang_Wei|王伟]] 的本科母校。2003 年入读数学系，2007 年获得数学学士学位。\n\n## 选专业\n\n王伟的高考成绩在数学和计算机两个方向都够，最终选了数学，他公开形容这是个*\"故意反着来\"*的理由：*\"我想用大学四年保留\"再往理论深一步\"和\"横切进任何应用领域\"两个选项都不关掉的状态，数学系是当时唯一同时留着两扇门的地方。\"* 这个决定被他后来在 [[Tsinghua_University|清华]] 博士阶段快速吃下算法密集型方向的速度所验证。\n\n## 课程与毕业论文\n\n当时北大数学系的课程结构是两年分析序列、一年代数序列、最后一年从概率、统计、应用数学里选选修。王伟的选修偏向概率和组合，毕业论文（由概率组教授指导）研究一个跟二部图生成树相关的组合计数问题——他略带自嘲地说，这个课题跟他现在简历上其他所有内容都没什么关系。他偶尔以此为例反驳一种主流建议：\"本科专业应该跟职业战略对齐\"。\n\n## 上下文\n\n王伟形容北大时期是他*\"先把事情准确写下来，再去推理\"*这一长期习惯的源头——他多次提到，这是他从数学训练中带出来、在课堂教学和后来 [[Codeleaf|Codeleaf]] 课程设计中最一致可迁移的能力。",
      },
    ],
    experiences: [
      {
        name: "Beijing Forestry University",
        name_zh: "北京某 985 高校",
        slug: "Beijing_University_Demo",
        role: "Lecturer, Computer Science Department",
        role_zh: "计算机系讲师",
        date_range: "2015 – present",
        location: "北京",
        logo: placeholderLogo("985"),
        logo_caption: "985 university in Beijing (anonymised in this demo)",
        logo_caption_zh: "北京某 985 高校（示例中匿名处理）",
        body: "[[Wang_Wei|Wang Wei]] has been a **Lecturer** in the Computer Science department of a 985 university in Beijing since 2015, following the completion of his Ph.D. at [[Tsinghua_University|Tsinghua University]]. The specific institution is anonymised in this demo to keep the example self-contained.\n\n## Teaching load\n\nWang's teaching load consists of three undergraduate courses per semester:\n\n- **Introduction to Programming** — first-year required, taught in Python, two sections of 80 students each.\n- **Data Structures** — second-year required, taught in C++, one section of 50 students.\n- **Computers in Education** — third- or fourth-year elective seminar, 20–25 students, capped enrolment.\n\nThe *Computers in Education* seminar is the course Wang has redesigned most heavily over the eight years; it is also the course whose curriculum eventually became the seed material for [[Codeleaf|Codeleaf]]'s middle-school product line.\n\n## Research and publications\n\nDuring his time at the university, Wang has published **twelve peer-reviewed papers**, primarily in education-technology venues and primarily as senior author with student first authors. The papers span knowledge-state modeling (a continuation of his [[Tsinghua_University|doctoral]] work), classroom-engagement analytics, and the empirical evaluation of his own teaching innovations.\n\n## Career trajectory decision\n\nIn 2024, Wang formally elected not to pursue the associate-professor evaluation track and stated that intent in writing during his annual review. The decision was a function of three factors he has discussed publicly: the lifestyle and incentive structure of the tenure-track path no longer matched what he wanted to spend his thirties and forties optimising for; the [[Codeleaf|Codeleaf]] period had given him a concrete sense of how much faster a non-academic product loop could turn; and the regulatory environment for his specific research area had become unpredictable in a way that academic incentives could not absorb. He is currently exploring full transition into [[Independent_Consulting|industry product-management roles]].",
        body_zh: "[[Wang_Wei|王伟]] 自 2015 年起任北京某 985 高校计算机系**讲师**，时间紧接他从 [[Tsinghua_University|清华大学]] 取得博士学位之后。具体院校在本示例中匿名处理，以保持例子自包含。\n\n## 教学任务\n\n王伟每学期的教学任务为三门本科课：\n\n- **编程入门** —— 大一必修，使用 Python 授课，两个 80 人班。\n- **数据结构** —— 大二必修，使用 C++ 授课，一个 50 人班。\n- **计算机在教育中的应用** —— 大三大四选修研讨课，20–25 人，限定选课人数。\n\n*计算机在教育中的应用*这门课是王伟过去八年改动最大的一门课，也是后来 [[Codeleaf|Codeleaf]] 中学产品线最初课程材料的源头。\n\n## 研究与发表\n\n任职期间，王伟共发表**12 篇同行评审论文**，主要刊载于教育科技领域期刊和会议，绝大多数为通讯作者、学生为一作。论文方向涵盖知识状态建模（[[Tsinghua_University|博士]] 工作的延续）、课堂参与度分析、以及他自己教学创新的实证评估。\n\n## 路径选择\n\n2024 年，王伟在年度考评中正式书面表明不再走副教授评聘路线。他公开讨论过这个决定背后的三个因素：终身教轨的生活方式和激励结构不再匹配他想在三四十岁优化的方向；[[Codeleaf|Codeleaf]] 期间他对一个非学术产品循环能转多快有了具体的感性认识；以及他所在具体研究方向的政策环境已变得学术激励无法吸收的不确定。他目前正在探索全职转入 [[Independent_Consulting|工业界产品岗]]。",
      },
      {
        name: "Independent Consulting",
        name_zh: "独立咨询",
        slug: "Independent_Consulting",
        role: "Curriculum consultant",
        role_zh: "课程顾问",
        date_range: "2024 – present",
        location: "远程",
        logo: placeholderLogo("独立"),
        logo_caption: "Independent consulting engagements (3 EdTech clients)",
        logo_caption_zh: "独立咨询（3 家教育科技客户）",
        body: "Since the wind-down of [[Codeleaf|Codeleaf]] in late 2023, [[Wang_Wei|Wang Wei]] has taken on **part-time independent consulting engagements** with three Chinese K-12 EdTech companies, advising on Python curricula and computational-thinking pedagogy. The arrangement runs in parallel with his ongoing lecturer position at [[Beijing_University_Demo|the 985 university in Beijing]] and is the principal source of his current exposure to industry product workflows.\n\n## Engagement structure\n\nThe three engagements have been structured similarly: a 3–6 month initial period with a clearly scoped deliverable (a curriculum review, a teacher-training workshop series, or a redesign of an assessment rubric), followed by an optional retainer for ongoing review of new course material. Two of the three engagements continued into a retainer phase; the third concluded after the initial deliverable.\n\n## Notable insight\n\nWang has written publicly that the most surprising lesson from the consulting period — surprising relative to his expectations going in — was how much of what looks like a *curriculum quality* problem from the outside is actually a *teacher-training* problem on closer inspection: a curriculum that works in the hands of one teacher routinely fails in the hands of another not because the material is wrong, but because the training pipeline is too thin. He has cited this observation as one of the concrete reasons he is moving toward product roles, where the same insight maps directly to the gap between a feature spec and the operator playbook that accompanies it.\n\n## Context\n\nThe consulting engagements have, by Wang's own framing, served less as a revenue source than as a *real-world product-management apprenticeship* — three observed instances of how non-academic product loops actually operate, including their failure modes, which he has used to calibrate what kind of product role to target next. He has expressed an intent to wind these engagements down once a full-time industry transition completes.",
        body_zh: "自 2023 年末 [[Codeleaf|Codeleaf]] 停止运营以来，[[Wang_Wei|王伟]] 以**兼职形式承接独立咨询**，为三家中国 K12 教育科技公司提供 Python 课程和计算思维教学法咨询。这部分工作与他在 [[Beijing_University_Demo|北京某 985 高校]] 持续的讲师工作并行，是他目前接触工业界产品工作流的主要来源。\n\n## 合作结构\n\n三段合作的结构相似：3–6 个月的初始期 + 一个明确范围的交付物（一次课程评审、一组教师培训工作坊、或一次评估细则的重新设计），之后可选续约成顾问留任。三段里两段进入了留任阶段，第三段在初始交付后结束。\n\n## 关键洞察\n\n王伟在公开写作里说，这段咨询期最让他意外的发现——意外相对于他进入这段时的预期——是：很多从外部看像是*课程质量*问题的事情，仔细看其实是*教师培训*问题。一套在某个老师手里有效的课程，在另一个老师手里失败，往往不是材料错了，而是培训管线太薄。他多次以此为例说明，他往产品岗转的具体原因之一是：同一个洞察直接映射到\"功能规格\"和\"配套的执行手册\"之间的差距。\n\n## 上下文\n\n按王伟自己的话说，这几段咨询的价值与其说是营收来源，不如说是*工业界产品管理的实地见习*——三个观察样本，看非学术产品循环实际怎么运作、包括它们的失败模式，用来校准他下一段全职产品岗该瞄准什么类型。他表示一旦全职工业界转岗完成，将逐步收掉这些合作。",
      },
    ],
  },
};

export const FIXTURES = {
  [wangXue.fixtureName]: wangXue,
  [wangWei.fixtureName]: wangWei,
};

export function listFixtureNames() {
  return Object.keys(FIXTURES);
}

export function pickRandomFixtureName() {
  const names = listFixtureNames();
  return names[Math.floor(Math.random() * names.length)];
}

export function getFixture(name) {
  return FIXTURES[name] || null;
}