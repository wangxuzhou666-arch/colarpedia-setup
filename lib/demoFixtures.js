// 示例 wiki 的固定 fixture 数据。两个人物，"示例预览"入口随机选一个。
//
// 详细度：跟一个真实在用 Yourpedia 的用户填完后差不多——
//   - 中英双语 bio 各 3-4 段
//   - 2-3 段教育 + 2 段工作 + 3 个项目
//   - 每个 entity 有 body / dates / location 详情
//   - bio 内部用 [[Slug]] 跨链到各个子条目
//
// 头像走 i.pravatar.cc 的 deterministic mode（按 ?u= 锁定，避免每次刷新换头像）。

const PRAVATAR = (id) => `https://i.pravatar.cc/600?u=${id}`;

const wangXue = {
  fixtureName: "wang-xue",
  photo_url: PRAVATAR("yourpedia-demo-wang-xue"),
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
        body: "Quanta CLI is a single-binary backtesting tool that takes an OHLCV CSV and a strategy file, and outputs an interactive HTML report with equity curve, drawdown, and trade statistics. It was originally built during Xue's internship at [[China_Galaxy_Securities|China Galaxy Securities]] to standardise how the futures desk evaluated new strategy proposals. After getting permission to open-source the framework portion, she rewrote it from scratch in her spare time and released v0.1 on GitHub in late 2024. The project has since attracted contributions from three external committers and is featured in two Chinese quant tutorials.",
        body_zh: "Quanta CLI 是一个单二进制的回测工具：输入一份 OHLCV CSV 和一个策略文件，输出包含资金曲线、回撤、交易统计的可交互 HTML 报告。最早是王雪在 [[China_Galaxy_Securities|中国银河证券]] 实习期间为了让期货组评审新策略提案时有统一口径而开发的内部工具。在拿到开源许可后，她用业余时间从零重写并于 2024 年末发布 v0.1。项目目前已收到 3 位外部贡献者的 PR，并被两个中文量化教程引用。",
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
        body: "Wiki Drift was Xue's first Chrome extension, built as a 48-hour weekend project after a class discussion on \"how do you know if a Wikipedia article is currently reliable.\" The extension overlays a small panel showing the article's edit frequency over the past 30 days, the percentage of edits reverted, and links to the three most controversial recent diffs. About 1,200 weekly active users at last count.",
        body_zh: "Wiki Drift 是王雪写的第一个 Chrome 扩展，是一个周末 48 小时的项目，灵感来自上课时一个讨论：「怎么判断一篇维基百科条目当前是否可信？」。扩展在维基百科文章上叠加一个小面板，显示过去 30 天的编辑频次、被回滚的比例、以及最有争议的三个最近 diff 链接。当前周活约 1,200 人。",
      },
      {
        name: "Resume Wiki (this site)",
        name_zh: "简历 wiki（本站）",
        slug: "Resume_Wiki",
        description: "Personal Wikipedia-styled portfolio, generated via Yourpedia",
        description_zh: "用 Yourpedia 生成的维基百科风格个人主页",
        role: "Subject",
        role_zh: "本人",
        date_range: "2026",
        tech_stack: ["Next.js", "Markdown"],
        body: "This site itself is a project—it's the public-facing version of Xue's resume, generated via [Yourpedia](/setup/) and hosted on Vercel. The static-wiki format is a deliberate choice over a single-page React resume: it lets recruiters share specific entity pages (e.g., \"look at her time at [[China_Galaxy_Securities|China Galaxy Securities]]\") rather than only a top-level URL.",
        body_zh: "这个站点本身就是一个项目——王雪简历的公开版，由 [Yourpedia](/setup/) 生成，托管在 Vercel。选择静态 wiki 格式（而不是单页 React 简历）是有意为之：HR 可以分享具体的子页面（比如「看她在 [[China_Galaxy_Securities|中国银河证券]] 那段」），而不是只能丢个顶层 URL。",
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
        body: "Wang Xue began the two-year Master of Science in Engineering program at the University of Pennsylvania's School of Engineering and Applied Science in August 2025. Her concentration is Systems Engineering with electives in machine learning systems and distributed computing. Her capstone project, advised by a professor in CIS, is a benchmark suite for fault recovery in distributed training jobs.",
        body_zh: "王雪 2025 年 8 月入读宾夕法尼亚大学工程与应用科学学院的两年制系统工程硕士项目，研究方向涉及机器学习系统与分布式计算。她的毕业课题由 CIS 系教授指导，主题是分布式训练任务的故障恢复 benchmark 套件。",
      },
      {
        name: "Peking University",
        name_zh: "北京大学",
        slug: "Peking_University",
        degree: "B.S. in Information Management, minor in Statistics",
        degree_zh: "信息管理学士，副修统计学",
        date_range: "2020 – 2024",
        location: "北京",
        body: "Wang Xue earned her undergraduate degree from Peking University's School of Information Management. Her senior thesis, written under the supervision of a professor in the Department of Probability and Statistics, examined the time-series properties of intraday order-book imbalance in Chinese commodity futures markets. She graduated cum laude in 2024.",
        body_zh: "王雪本科毕业于北京大学信息管理学院。她的毕业论文由概率统计系教授指导，主题是中国商品期货市场盘中订单簿失衡的时间序列性质。2024 年以优秀毕业生身份毕业。",
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
        body: "Wang Xue spent the summer of 2026 as a visiting research intern at Microsoft Research Asia's Systems and Networking group in Beijing. Her project focused on fault tolerance in distributed training jobs—specifically, how to recover from worker failures without restarting the entire job from the latest checkpoint. She co-authored a workshop paper accepted at a major systems conference.",
        body_zh: "2026 年夏，王雪在微软亚洲研究院系统与网络组担任访问研究实习生。研究课题是分布式训练任务的容错——具体来说，如何在 worker 故障时不从最近 checkpoint 重启整个任务。合著的论文被一个主要系统会议的 workshop 接收。",
      },
      {
        name: "China Galaxy Securities",
        name_zh: "中国银河证券",
        slug: "China_Galaxy_Securities",
        role: "Quantitative Research Intern",
        role_zh: "量化研究实习生",
        date_range: "2023 年 6 月 – 9 月",
        location: "上海",
        body: "During the summer between her junior and senior years, Wang Xue interned at China Galaxy Securities as a quantitative research intern under the commodity futures team. Her main project was a Python backtesting framework that standardised how three internal strategy teams evaluated new ideas; the framework reduced their average proposal-review time from two weeks to three days. The open-source generalisation of this work later became [[Quanta_CLI|Quanta CLI]].",
        body_zh: "本科大三升大四的暑假，王雪在中国银河证券商品期货组担任量化研究实习生。主要项目是一套 Python 回测框架，让三个内部策略团队的新想法评审有了统一口径，提案评审平均周期从两周降到三天。这项工作的开源泛化版本后来发展成 [[Quanta_CLI|Quanta CLI]]。",
      },
    ],
  },
};

const wangWei = {
  fixtureName: "wang-wei",
  photo_url: PRAVATAR("yourpedia-demo-wang-wei"),
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
        body: "Codeleaf was a Chinese EdTech startup co-founded by Wang Wei in 2021 to bring a structured Python curriculum into middle schools that previously taught coding only as an extracurricular elective. As curriculum lead, Wang Wei designed the 64-lesson sequence used across two product tiers (school-licensed and direct-to-family), reaching approximately 8,000 paying students at peak across 22 cities. The company wound down operations in late 2023 after the regulatory tightening of China's after-school education sector. The shutdown was orderly and all customers were either refunded or migrated to a partner platform.",
        body_zh: "Codeleaf 是王伟 2021 年共同创办的中国教育科技公司，目标是把结构化的 Python 课程引入此前只把编程当兴趣选修的中学。作为课程负责人，王伟设计了 64 节课的完整课程序列，应用于两条产品线（学校授权版 + 家庭直购版），峰值时覆盖全国 22 个城市约 8,000 名付费学生。公司在 2023 年末因国内课外教育行业政策调整而有序停止运营，所有客户要么退款要么迁移到合作平台。",
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
        body: "Python for K12 is a 240-page introductory Python textbook written by Wang Wei in 2022, drawing on his five years of classroom teaching at the time. The book's distinctive feature is that every chapter pairs a coding concept with an analogy from middle-school mathematics or physics, making the material more bridgeable for students with no prior programming exposure. As of 2026 the book has sold approximately 18,000 copies and is on the supplementary reading list of 80+ middle schools in China.",
        body_zh: "Python for K12 是王伟 2022 年撰写的 240 页 Python 入门教材，凝练了他当时五年课堂教学的经验。这本书的特点是每章把一个编程概念跟一个中学数学或物理的类比配对，让没有编程基础的学生有现成的桥可走。截至 2026 年累计销量约 1.8 万册，被国内 80+ 所中学列入补充阅读书目。",
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
        body: "Wang Wei has maintained a Zhihu column since 2020, originally focused on answering pedagogical questions from other teachers, later expanding to cover his own career-transition journey from academia to product management. The column currently has 47,000 followers and 2.5 million cumulative reads. His most-read piece (\"34 岁还来得及转产品吗\", 2024) has 380,000 reads and is regularly cited in similar Zhihu threads.",
        body_zh: "王伟自 2020 年起在知乎维护这个专栏，最早是回答其他老师的教学法问题，后来扩展到他自己从学术界向产品经理岗位转型的全过程记录。专栏目前粉丝 4.7 万，累计阅读 250 万。最热门的一篇《34 岁还来得及转产品吗》（2024）阅读 38 万，被多个类似话题反复引用。",
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
        body: "Wang Wei earned his Ph.D. in Computer Science from Tsinghua University in 2015. His dissertation was on graph-based algorithms for educational data mining—specifically, modelling student knowledge state evolution in MOOCs. The work was supervised by a professor in the Department of Computer Science and Technology. He published five papers during his doctoral studies.",
        body_zh: "王伟 2015 年获得清华大学计算机科学博士学位。博士论文研究教育数据挖掘的图算法 —— 具体是 MOOC 课程中学生知识状态演化的建模。导师是计算机系教授，博士期间发表 5 篇论文。",
      },
      {
        name: "Peking University",
        name_zh: "北京大学",
        slug: "Peking_University",
        degree: "B.S. in Mathematics",
        degree_zh: "数学学士",
        date_range: "2003 – 2007",
        location: "北京",
        body: "Wang Wei graduated from Peking University with a bachelor's degree in Mathematics in 2007. He chose mathematics over computer science as an undergraduate because he wanted a rigorous foundation before specialising, and credits the experience for his later ability to pick up algorithms-heavy subfields quickly during his Ph.D.",
        body_zh: "王伟 2007 年从北京大学数学系本科毕业。本科选数学而不是计算机，是想先打好严格的基础再细分方向。他认为这段经历是他博士阶段能快速吃下算法密集型方向的关键。",
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
        body: "Wang Wei has been a lecturer in the Computer Science department of a 985 university in Beijing since 2015. His teaching load consists of three undergraduate courses each semester: Introduction to Programming, Data Structures, and a senior seminar on Computers in Education. He has published twelve peer-reviewed papers during his time at the university, primarily in education-technology venues. He has elected not to pursue the associate-professor track and is currently exploring full transition into industry product management roles.",
        body_zh: "王伟自 2015 年起任北京某 985 高校计算机系讲师。每学期教学任务为三门本科课：编程入门、数据结构、以及一门计算机教育方向的高年级研讨课。在校期间共发表同行评审论文 12 篇，主要刊载于教育科技领域期刊和会议。他选择不走副教授评聘路线，目前正在探索全职转入工业界产品岗的可能。",
      },
      {
        name: "Independent Consulting",
        name_zh: "独立咨询",
        slug: "Independent_Consulting",
        role: "Curriculum consultant",
        role_zh: "课程顾问",
        date_range: "2024 – present",
        location: "远程",
        body: "Since the wind-down of [[Codeleaf|Codeleaf]], Wang Wei has consulted on a part-time basis with three Chinese K-12 EdTech companies on Python and computational-thinking curricula. The engagements are typically 3-6 months long and have given him exposure to product-management workflows from the supplier side, reinforcing his decision to pursue a full PM transition.",
        body_zh: "[[Codeleaf|Codeleaf]] 停止运营后，王伟以兼职形式为三家中国 K12 教育科技公司做 Python 与计算思维课程顾问。每次合作通常持续 3-6 个月，让他从供应商视角接触到了产品管理的工作流，进一步坚定了全职转 PM 的决心。",
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