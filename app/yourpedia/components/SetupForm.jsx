"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { setupSchema, deriveSlug } from "../lib/schema";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";
import UploadPanel from "./UploadPanel";
import PreviewModal from "./PreviewModal";
import WikiTextarea from "./WikiTextarea";

// 项目缩略图的 slug 兜底——项目还没填名字时用 project_<idx>，
// 这样用户先传图后填名也不会丢图。
function projectSlug(name, idx) {
  const fromName = deriveSlug(name);
  return fromName || `project_${idx + 1}`;
}

// 给 shipped[] 加上 thumbnailPath，模板里好用 <img> 引用。
function enrichShipped(data, thumbsByIdx, mode) {
  return {
    ...data,
    shipped: (data.shipped || []).map((s, idx) => {
      const t = thumbsByIdx[idx];
      if (!t) return s;
      const slug = projectSlug(s.name, idx);
      let path;
      if (mode === "preview") {
        path = t.kind === "image" ? t.previewUrl : `${slug}.pdf`;
      } else {
        path = `/projects/${slug}.${t.ext}`;
      }
      return { ...s, thumbnailPath: path };
    }),
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("照片读取失败"));
    reader.readAsDataURL(file);
  });
}

const PHOTO_EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PROJECT_ATTACHMENT_EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function projectAttachmentExt(file) {
  if (!file) return null;
  const byType = PROJECT_ATTACHMENT_EXT_BY_TYPE[file.type];
  if (byType) return byType;
  const dot = file.name.lastIndexOf(".");
  if (dot < 0) return null;
  const tail = file.name.slice(dot + 1).toLowerCase();
  return /^(jpg|jpeg|png|webp|pdf)$/.test(tail)
    ? tail.replace("jpeg", "jpg")
    : null;
}

// 把 deploy 接口的英文错误翻译成用户能 actionable 的中文
function humanizeDeployError(raw) {
  const msg = String(raw || "");
  if (/rate limit|abuse/i.test(msg)) {
    return "GitHub 这边短时间请求太多了，等几分钟再试。";
  }
  if (/fork/i.test(msg) && /fail/i.test(msg)) {
    return "复制模板仓库失败。可能是 GitHub 暂时性故障，再试一次；如果反复失败，去你的 GitHub 看看是不是有同名仓库占用了。";
  }
  if (/auth|token|unauthor/i.test(msg)) {
    return "GitHub 授权失效了。点上面「重新登录」再试。";
  }
  return msg || "上线失败，再试一次。";
}

// 项目 / 工作经历 共用的"产出"子表单：最多 3 条 label + url。
// 抽成独立组件是因为 react-hook-form 的 useFieldArray 不能在父组件的
// .map() 循环里调用（违反 hooks rule），必须每个父行单独挂载一个
// 子组件来管理它自己的 outputs 数组。namePrefix 传 `shipped.${idx}`
// 或 `experiences.${idx}`，组件不关心是哪种 entity。
function EntityOutputs({ control, register, namePrefix, placeholderLabel }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${namePrefix}.outputs`,
  });
  return (
    <div className="setup-field" style={{ marginTop: 10 }}>
      <label className="setup-label">
        产出（选填，最多 3 条：论文 / essay / demo / repo / blog 等链接）
      </label>
      {fields.map((field, oIdx) => (
        <div
          key={field.id}
          style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "flex-start" }}
        >
          <input
            {...register(`${namePrefix}.outputs.${oIdx}.label`)}
            className="setup-input"
            placeholder={placeholderLabel || "GPS Localization Essay"}
            style={{ flex: "0 0 38%" }}
          />
          <input
            {...register(`${namePrefix}.outputs.${oIdx}.url`)}
            className="setup-input"
            placeholder="https://..."
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => remove(oIdx)}
            className="setup-button"
            aria-label={`删除产出 ${oIdx + 1}`}
          >
            删除
          </button>
        </div>
      ))}
      {fields.length < 3 && (
        <button
          type="button"
          onClick={() => append({ label: "", url: "" })}
          className="setup-button-add"
          style={{ marginTop: 8 }}
        >
          + 添加产出
        </button>
      )}
    </div>
  );
}

export default function SetupForm() {
  const [pdfFile, setPdfFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [projectThumbs, setProjectThumbs] = useState({});
  const [projectThumbErrors, setProjectThumbErrors] = useState({});
  const { data: session, status: sessionStatus } = useSession();
  const [deployStep, setDeployStep] = useState("idle"); // idle | forking | committing | done | error
  const [deployResult, setDeployResult] = useState(null);
  const [deployError, setDeployError] = useState("");
  // Supabase hosted publish 路径
  const [supaUser, setSupaUser] = useState(null);
  const [supaUserLoading, setSupaUserLoading] = useState(true);
  const [publishStep, setPublishStep] = useState("idle"); // idle | publishing | done | error
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState("");
  // 英文版字段全局开关。默认开（保持当前行为），用户可关掉砍密度。
  const [showEnglish, setShowEnglish] = useState(true);

  // 监听 Supabase session
  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted) return;
      setSupaUser(user || null);
      setSupaUserLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setSupaUser(sess?.user || null);
    });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(setupSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      name_zh: "",
      homepageSlug: "",
      tagline: "",
      tagline_zh: "",
      bio: "",
      bio_zh: "",
      siteName: "Workplay",
      metaBaseUrl: "",
      githubOwner: "",
      githubRepo: "",
      email: "",
      linkedin: "",
      githubProfile: "",
      shipped: [],
      educations: [],
      experiences: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "shipped",
  });
  const {
    fields: eduFields,
    append: appendEdu,
    remove: removeEdu,
    replace: replaceEdu,
  } = useFieldArray({ control, name: "educations" });
  const {
    fields: expFields,
    append: appendExp,
    remove: removeExp,
    replace: replaceExp,
  } = useFieldArray({ control, name: "experiences" });

  const nameValue = watch("name");
  const [slugTouched, setSlugTouched] = useState(false);

  // 折叠 section 的摘要行 — 用于 details summary 显示"已填了什么"
  const emailValue = watch("email");
  const linkedinValue = watch("linkedin");
  const githubProfileValue = watch("githubProfile");
  const shippedValues = watch("shipped");
  const educationsValues = watch("educations");
  const experiencesValues = watch("experiences");

  const contactSummary = useMemo(() => {
    const parts = [];
    if (emailValue) parts.push("邮箱");
    if (linkedinValue) parts.push("LinkedIn");
    if (githubProfileValue) parts.push("GitHub");
    return parts.length ? parts.join(" · ") : "未填";
  }, [emailValue, linkedinValue, githubProfileValue]);

  const arraySummary = (items, nameKeys) => {
    if (!items || items.length === 0) return "未添加";
    const names = items
      .map((item) => {
        for (const key of nameKeys) {
          if (item?.[key]) return item[key];
        }
        return null;
      })
      .filter(Boolean);
    if (names.length === 0) return `${items.length} 项`;
    const shown = names.slice(0, 3).join(" / ");
    const more = names.length > 3 ? "…" : "";
    return `${items.length} 项：${shown}${more}`;
  };

  const projectsSummary = useMemo(
    () => arraySummary(shippedValues, ["name_zh", "name"]),
    [shippedValues]
  );
  const educationsSummary = useMemo(
    () => arraySummary(educationsValues, ["name_zh", "name"]),
    [educationsValues]
  );
  const experiencesSummary = useMemo(
    () => arraySummary(experiencesValues, ["name_zh", "name"]),
    [experiencesValues]
  );

  // 4 个 secondary section 折叠状态：默认全 closed（首次访问视觉密度最低）。
  // PDF 解析或 example 填充后任一字段有值 → 自动一次性展开全部，
  // 之后用户手动 toggle 不再被覆盖（autoExpandedRef 单向锁）。
  const [contactOpen, setContactOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [educationsOpen, setEducationsOpen] = useState(false);
  const [experiencesOpen, setExperiencesOpen] = useState(false);
  const autoExpandedRef = useRef(false);

  useEffect(() => {
    if (autoExpandedRef.current) return;
    const hasData =
      !!nameValue ||
      !!emailValue ||
      !!linkedinValue ||
      !!githubProfileValue ||
      (shippedValues?.length || 0) > 0 ||
      (educationsValues?.length || 0) > 0 ||
      (experiencesValues?.length || 0) > 0;
    if (hasData) {
      setContactOpen(true);
      setProjectsOpen(true);
      setEducationsOpen(true);
      setExperiencesOpen(true);
      autoExpandedRef.current = true;
    }
  }, [
    nameValue,
    emailValue,
    linkedinValue,
    githubProfileValue,
    shippedValues,
    educationsValues,
    experiencesValues,
  ]);
  useEffect(() => {
    if (!slugTouched && nameValue) {
      setValue("homepageSlug", deriveSlug(nameValue), {
        shouldValidate: false,
      });
    }
  }, [nameValue, slugTouched, setValue]);

  // 中国应届本科毕业生示例（求互联网产品 / 运营第一份工作）
  // 注:姓名 / Email / LinkedIn 都做了明显占位处理(.example 域名 + 留空 LinkedIn),
  // 避免真人撞库。第三段实习公司"听潮数据"是虚构,武汉本地小厂调性,降整体精英感。
  // 头像从 public/example-photos/lin-zhixia.jpg 自动加载,加载失败不阻塞表单填充。
  const fillFreshGradExample = async () => {
    setValue("name", "Lin Zhixia");
    setValue("name_zh", "林知夏");
    setValue("homepageSlug", "Lin_Zhixia");
    setSlugTouched(true);
    setValue(
      "tagline",
      "Class of 2026 graduate, Wuhan University Information Management — seeking product / operations roles"
    );
    setValue(
      "tagline_zh",
      "武汉大学信息管理 2026 届毕业生 · 求产品 / 运营岗位"
    );
    setValue(
      "bio",
      "Lin Zhixia (born 2003) is a 2026 graduate of [[Wuhan_University|Wuhan University]]'s School of Information Management, majoring in Information Management and Information Systems. During her undergraduate studies she completed three internships — community operations at [[Meituan|Meituan]], product analytics at [[JD|JD.com]], and data operations at [[Tingchao_Data|Tingchao Data]] — and served as project lead of [[Wuhan_Reading_Club|Wuda Reading Club]], a student-initiated reading group that grew to roughly 800 active members. She is currently seeking product or operations roles at internet companies."
    );
    setValue(
      "bio_zh",
      "林知夏，2003 年生，[[Wuhan_University|武汉大学]] 信息管理学院 2026 届本科毕业生，专业为信息管理与信息系统。本科期间她完成了三段实习——分别在 [[Meituan|美团]] 做社区运营、在 [[JD|京东]] 做产品分析、在 [[Tingchao_Data|听潮数据]] 做数据运营，并担任 [[Wuhan_Reading_Club|武大读书社]] 项目负责人，把社团运营到约 800 活跃成员。目前在找互联网公司的产品或运营岗位。"
    );
    setValue("email", "linzhixia@example.com");
    setValue("linkedin", "");
    setValue("githubProfile", "");

    replaceShippedAndClearThumbs([
      {
        name: "Wuda Reading Club",
        name_zh: "武大读书社",
        slug: "Wuhan_Reading_Club",
        description:
          "Student-initiated reading group at Wuhan University, grown to ~800 active members",
        description_zh:
          "武汉大学学生发起的读书社，运营到约 800 活跃成员",
        role: "Project Lead",
        role_zh: "项目负责人",
        date_range: "2023.03 – 2025.12",
        url: "",
        tech_stack: ["WeChat", "Feishu", "Xiaohongshu"],
        logo: "/example-photos/wuda-reading-club.jpg",
        logo_caption: "Wuda Reading Club gathering",
        logo_caption_zh: "读书社双周线下讨论现场",
        body: "Wuda Reading Club is a student-initiated reading group at [[Wuhan_University|Wuhan University]] founded in early 2023. Lin Zhixia took over as project lead in her sophomore year and ran it through graduation. Cadence: one offline discussion every two weeks rotating across five colleges (to avoid any single department becoming the home venue), plus one online co-read per month. Membership grew from roughly 60 to about 800 over two and a half years, primarily through word of mouth and reading notes posted on Xiaohongshu. Lin owned scheduling, the WeChat groups, and the monthly book-pick rotation. To raise discussion quality, she also maintained a member tag sheet (major, year, preferred genre) and assembled mixed groups for each offline session by those tags.",
        body_zh:
          "武大读书社是 2023 年初在 [[Wuhan_University|武汉大学]] 学生中发起的读书小组。林知夏大二接手做项目负责人，一直带到毕业。节奏：每两周线下讨论一次，在五个学院之间轮流，避免被某个院「主场化」；每月一本线上共读。两年半时间成员从大约 60 人长到约 800 人，主要靠口碑和在小红书上发读书笔记带新。林知夏负责排期、成员微信群、以及每月选书的读者轮值。为提高讨论质量，她维护了一张成员标签表（专业、年级、偏好书类），每次线下活动按标签做小组混搭。",
      },
      {
        name: "Library Borrowing Trends Dashboard",
        name_zh: "图书借阅趋势看板",
        slug: "Library_Data_Viz",
        description:
          "Coursework: three-year visualization of Wuhan University library borrowing patterns",
        description_zh:
          "课程作业：武汉大学近三年图书借阅趋势可视化",
        role: "Author",
        role_zh: "作者",
        date_range: "2024.10 – 2024.12",
        url: "",
        tech_stack: ["Python", "Pandas", "Tableau"],
        body: "Final project for the Fall 2024 Information Visualization course. Lin Zhixia took three years of [[Wuhan_University|Wuhan University]] library circulation data and built a dashboard breaking borrowing volume down by college, by month, and by book category. Her report flagged a non-obvious finding: humanities borrowing dropped about 30% after the library reopened in 2022, while CS-category borrowing stayed flat. To rule out the supply-side explanation (i.e. that fewer humanities books were acquired), she cross-checked new-acquisition lists for both categories and confirmed the gap was demand-side, not stock-side. The dashboard was graded A and used by the instructor as a sample work the following semester.",
        body_zh:
          "2024 年秋季《信息可视化》课程的期末作业。林知夏用 [[Wuhan_University|武汉大学]] 图书馆近三年公开的借阅数据，做了一个按学院、按月份、按图书类别分布的看板。她在报告里写出一个不显然的发现：人文类借阅在 2022 年图书馆恢复开放之后下降了约 30%，而计算机类借阅基本持平。为排除「是不是新书少了」的反向解释，她另查了两个类别的新书入库清单，确认差距来自借阅端而不是库存端。这份作业拿了 A，任课老师下学期把它当作样例作品给后面的学生看。",
      },
      {
        name: "Campus Secondhand Book Exchange",
        name_zh: "校园二手书循环平台",
        slug: "Secondhand_Book_Exchange",
        description:
          "Business plan for a campus book-resale platform; bronze medal at the Internet+ school round",
        description_zh:
          "校园二手教材交易平台商业计划书 · 互联网+ 大学生创新创业大赛 校级铜奖",
        role: "Team Lead",
        role_zh: "项目负责人",
        date_range: "2024.03 – 2024.05",
        url: "",
        tech_stack: ["Figma", "Survey", "Pitch"],
        body: "Lin Zhixia led a five-person team in the 2024 [[Wuhan_University|Wuhan University]] Internet+ undergraduate entrepreneurship competition with a proposal for a campus secondhand textbook exchange — addressing the recurring gap where last-year's cohort sells off textbooks by weight while next-year's cohort buys them new at full price, with no reliable matching layer between them. She owned the market-research track: 200 surveys across three colleges and 12 in-depth interviews with rising sophomores (the cohort with the highest course-to-textbook turnover). The pitch advanced to the campus top 20 and won a school-level bronze medal. The team did not continue past the competition; Lin's takeaway, written into the final report, was that the demand is real but the two-sided market too thin for a daily-use app — any working version would need to clear inventory during the two-week freshman-orientation window.",
        body_zh:
          "林知夏在 2024 年 [[Wuhan_University|武汉大学]] 「互联网+」大学生创新创业大赛中带 5 人小队，做校园二手教材循环交易平台 —— 解决每学期前一届教材被低价处理、下一届又原价买新书、中间缺撮合层的问题。她主要负责市场调研：200 份问卷（覆盖三个学院）+ 12 场针对大二学生的用户访谈（大二是教材更替最频繁的一届）。提案进入校赛前 20，最终拿到校级铜奖。比赛结束后团队没有继续做下去，她在结题报告里写的判断是：需求真实存在，但双边市场太薄，起量必须卡在每年开学前两周的迎新窗口里把库存清掉，平日 app 留存撑不起来。",
      },
    ]);

    replaceEdu([
      {
        name: "Wuhan University",
        name_zh: "武汉大学",
        slug: "Wuhan_University",
        degree: "B.S. in Information Management and Information Systems",
        degree_zh: "信息管理与信息系统 学士",
        date_range: "2022.09 – 2026.06",
        location: "武汉",
        body: "Lin Zhixia attended the School of Information Management at [[Wuhan_University|Wuhan University]] from 2022 to 2026, pursuing a B.S. in Information Management and Information Systems. Core coursework included database systems, information retrieval, data visualization, and user research methods. Her senior thesis examined how undergraduates discover books through Xiaohongshu, using 420 questionnaire responses drawn from six universities in Hubei province; the sampling frame was built off contacts she had accumulated running [[Wuhan_Reading_Club|the reading club]].",
        body_zh:
          "林知夏 2022 年到 2026 年在 [[Wuhan_University|武汉大学]] 信息管理学院读本科，专业是信息管理与信息系统。核心课程包括数据库系统、信息检索、数据可视化和用户研究方法。毕业论文研究的是大学生在小红书上发现图书的路径，样本来自湖北六所高校的 420 份问卷；问卷的发放渠道很大程度上是靠她做 [[Wuhan_Reading_Club|武大读书社]] 期间积累下来的跨校联系人。",
      },
    ]);

    replaceExp([
      {
        name: "Meituan",
        name_zh: "美团",
        slug: "Meituan",
        role: "Community Operations Intern",
        role_zh: "社区运营实习生",
        date_range: "2024.06 – 2024.09",
        location: "北京",
        body: "Lin Zhixia interned with the community operations team at [[Meituan|Meituan]] from June to September 2024, working on the restaurant review section. The diagnosed problem: under the existing author-tier system, most contributors plateaued at the middle tier because the perk gap between middle and top was too narrow to pull anyone upward. Her main project was redesigning the food-review author incentive tiers for two pilot cities (Wuhan and Chengdu). Workflow: she drafted the tier rules, ran a 6-week pilot, and tracked weekly active contributors as the headline metric. By the end of the pilot, weekly active contributor count was ~18% above the pre-launch baseline, and the team rolled the same tier structure out to two additional cities the following quarter. Mentor exit feedback: her biggest takeaway was learning to instrument metrics *before* shipping the rule change, not after.",
        body_zh:
          "林知夏 2024 年 6 月到 9 月在 [[Meituan|美团]] 社区运营组实习，主要做餐厅评价板块。她接手时的诊断是：现有作者等级体系中，绝大多数贡献者卡在中间等级 —— 中间到顶级的权益差太小，没人有动力往上走。她的主项目是为武汉和成都两个试点城市重新设计食评作者的激励等级：写规则、跑 6 周试点、每周盯活跃作者数作为核心指标。试点结束时周活跃贡献者比上线前的基线高了约 18%，组里下个季度把这套等级结构沿用到了另外两个城市。导师离职反馈里写的：她最大的收获是学会了在改规则**之前**先把指标埋好，而不是改完之后再补埋点。",
      },
      {
        name: "JD.com",
        name_zh: "京东",
        slug: "JD",
        role: "Product Analytics Intern",
        role_zh: "产品分析实习生",
        date_range: "2025.01 – 2025.04",
        location: "北京",
        body: "Lin Zhixia interned with the major-appliances product team at [[JD|JD.com]] from January to April 2025, supporting two product managers. The team owned air conditioners, refrigerators, and washing machines — three lines with sharply different seasonality, which made a shared dashboard hard to read week-to-week. Her recurring deliverable was a weekly category report covering all three lines, split by city tier and by promotion window so the seasonality could be normalized out before reading trends. Beyond the weekly cadence, she ran a one-off cohort analysis on returning buyers during the 618 pre-sale window — specifically users who bought a second appliance within 30 days of the first; the team used that finding to extend the early-bird coupon validity by 48 hours. Exit deliverable: a brief on how far ahead the team should kick off a 618 retrospective in the next planning cycle.",
        body_zh:
          "林知夏 2025 年 1 月到 4 月在 [[JD|京东]] 大家电产品组实习，支持两名产品经理。组里负责空调、冰箱、洗衣机三条产品线，三个品类季节性差很大，公用一张周报看板很难读。她每周固定输出一份品类周报，按城市层级和促销期做 cohort 拆分，把季节性的影响先剥掉再看趋势。除了周报节奏，她还做了一次 618 预售期间复购用户的 cohort 分析，专门看那些买完第一件家电后 30 天内又买第二件的用户；组里据此把早鸟券的有效期延长了 48 小时。实习结束时她写了一份小结，记录下次大促前应该提前多久启动复盘窗口。",
      },
      {
        name: "Tingchao Data",
        name_zh: "听潮数据",
        slug: "Tingchao_Data",
        role: "Data Operations Intern",
        role_zh: "数据运营实习生",
        date_range: "2025.06 – 2025.09",
        location: "武汉",
        body: "Lin Zhixia interned at [[Tingchao_Data|Tingchao Data]] from June to September 2025; the company is an early-stage data analytics startup based in Wuhan, with roughly 20 employees at the time and a customer base of mid-sized regional retail chains. She rebuilt the customer funnel dashboard used in the operations team's Monday standup, migrating it from a shared Excel file to Metabase pointed at the company's own Postgres warehouse. The dashboard covered four nodes: acquisition, activation, retention, and revenue. Before the migration, the Monday number was manually refreshed every Sunday night and was already two days stale by the time anyone discussed it; after the migration, the standup ran on live data. Per her exit memo, the harder half of the project was negotiating metric definitions across sales, ops, and engineering *before* any dashboard work could start — without aligned definitions, even a polished dashboard would just give each team its own version of the truth.",
        body_zh:
          "林知夏 2025 年 6 月到 9 月在 [[Tingchao_Data|听潮数据]] 实习，这是一家在武汉的早期数据分析创业公司，当时大约 20 人，客户主要是区域性的中型零售连锁。她重做了运营组周一例会用的客户漏斗看板，把它从一个共享 Excel 文件迁到了 Metabase 上，数据接公司自己的 Postgres 仓库。看板覆盖获客、激活、留存、营收四个节点。迁之前那张表是周日晚上有人手动刷出来的，到周一开会的时候数据已经滞后两天；迁完之后周一例会用的是实时数据。她在离职小结里写：这段实习真正难的一半不是搭看板，而是在开工之前把销售、运营、工程三边对同一个指标的口径吵齐 —— 口径不统一，看板做得再漂亮也是各看各的。",
        logo: "/example-photos/tingchao-data-logo.jpg",
        logo_caption: "Tingchao Data logo",
        logo_caption_zh: "听潮数据 logo",
      },
    ]);

    // 自动加载默认头像 — 等同于用户亲手上传一张图
    try {
      const res = await fetch("/example-photos/lin-zhixia.jpg");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], "lin-zhixia.jpg", {
        type: blob.type || "image/jpeg",
      });
      onPhotoChange(file);
    } catch (e) {
      // 头像加载失败不阻塞表单填充 — 用户仍可手动上传
      console.warn("[example] 默认头像加载失败:", e);
    }
  };

  const setThumbError = (idx, msg) => {
    setProjectThumbErrors((prev) => {
      const next = { ...prev };
      if (msg) next[idx] = msg;
      else delete next[idx];
      return next;
    });
  };

  const onProjectThumbChange = (idx, f) => {
    setThumbError(idx, "");
    if (!f) {
      setProjectThumbs((prev) => {
        const cur = prev[idx];
        if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
        const next = { ...prev };
        delete next[idx];
        return next;
      });
      return;
    }
    const ext = projectAttachmentExt(f);
    if (!ext) {
      setThumbError(idx, "只支持图片（JPG / PNG / WebP）或 PDF。");
      return;
    }
    const kind = ext === "pdf" ? "pdf" : "image";
    const sizeLimit = kind === "pdf" ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
    if (f.size > sizeLimit) {
      setThumbError(
        idx,
        kind === "pdf" ? "PDF 太大（最多 10 MB）。" : "图片太大（最多 3 MB）。"
      );
      return;
    }
    const previewUrl = kind === "image" ? URL.createObjectURL(f) : null;
    setProjectThumbs((prev) => {
      const cur = prev[idx];
      if (cur?.previewUrl) URL.revokeObjectURL(cur.previewUrl);
      return {
        ...prev,
        [idx]: { file: f, ext, kind, previewUrl, fileName: f.name },
      };
    });
  };

  const removeProjectRow = (idx) => {
    remove(idx);
    setProjectThumbs((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) next[i] = v;
        else if (i === idx) {
          if (v.previewUrl) URL.revokeObjectURL(v.previewUrl);
        } else next[i - 1] = v;
      });
      return next;
    });
    setProjectThumbErrors((prev) => {
      const next = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) next[i] = v;
        else if (i > idx) next[i - 1] = v;
      });
      return next;
    });
  };

  const replaceShippedAndClearThumbs = (newShipped) => {
    setProjectThumbs((prev) => {
      Object.values(prev).forEach((t) => {
        if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
      });
      return {};
    });
    setProjectThumbErrors({});
    replace(newShipped);
  };

  const deriveOrKeep = (entity) => ({
    ...entity,
    slug: entity.slug || deriveSlug(entity.name || ""),
  });

  useEffect(() => {
    return () => {
      Object.values(projectThumbs).forEach((t) => {
        if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPhotoChange = (f) => {
    setPhotoError("");
    if (!f) {
      setPhotoFile(null);
      setPhotoPreviewUrl("");
      return;
    }
    if (!f.type?.startsWith("image/")) {
      setPhotoError("头像必须是图片（JPG / PNG / WebP）。");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      setPhotoError("图片太大（最多 3 MB）。");
      return;
    }
    setPhotoFile(f);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(f));
  };

  // 用户粘贴 URL 没带协议时自动补 https://
  const normalizeUrl = (v) => {
    if (!v) return "";
    const trimmed = v.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "https://" + trimmed.replace(/^\/+/, "");
  };

  // 一键 hosted 上线：调 /api/publish，写入 Supabase，返回 workplay.pro/<slug>/
  const handlePublish = async () => {
    setPublishError("");
    setPublishResult(null);
    setPublishStep("publishing");
    try {
      const raw = watch();
      const formData = {
        ...raw,
        linkedin: normalizeUrl(raw.linkedin),
        githubProfile: normalizeUrl(raw.githubProfile),
      };
      if (!formData.name && !formData.name_zh) {
        throw new Error("先填一下姓名再上线。");
      }
      const photoBase64 = photoFile ? await fileToBase64(photoFile) : null;
      const photoExt = photoFile
        ? PHOTO_EXT_BY_TYPE[photoFile.type] || "jpg"
        : null;
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData, photoBase64, photoExt }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `上线失败（${res.status}）`);
      }
      setPublishResult(json);
      setPublishStep("done");
    } catch (e) {
      setPublishError(e.message || "上线失败，再试一次。");
      setPublishStep("error");
    }
  };

  const handleSupaSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSupaUser(null);
    setPublishStep("idle");
    setPublishResult(null);
  };

  const handleDeploy = async () => {
    setDeployError("");
    setDeployResult(null);
    setDeployStep("forking");
    try {
      const raw = watch();
      const formData = {
        ...raw,
        linkedin: normalizeUrl(raw.linkedin),
        githubProfile: normalizeUrl(raw.githubProfile),
        metaBaseUrl: normalizeUrl(raw.metaBaseUrl) || "",
      };
      if (!formData.name || !formData.homepageSlug) {
        throw new Error("先在上面填一下姓名（我们用它来生成 wiki 页面的链接）。");
      }
      const photoBase64 = photoFile ? await fileToBase64(photoFile) : null;
      const photoExt = photoFile
        ? PHOTO_EXT_BY_TYPE[photoFile.type] || "jpg"
        : null;

      const thumbPayload = [];
      for (const [k, t] of Object.entries(projectThumbs)) {
        const idx = Number(k);
        const project = (formData.shipped || [])[idx];
        if (!project?.name) continue;
        thumbPayload.push({
          idx,
          slug: projectSlug(project.name, idx),
          ext: t.ext,
          base64: await fileToBase64(t.file),
        });
      }

      setDeployStep("committing");
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData,
          photoBase64,
          photoExt,
          projectThumbs: thumbPayload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `上线失败（${res.status}）`);
      }
      setDeployResult(json);
      setDeployStep("done");
    } catch (e) {
      setDeployError(humanizeDeployError(e.message));
      setDeployStep("error");
    }
  };

  // 表单整体 submit 直接走 deploy 路径——只有在用户已经登录 GitHub 时才会触发。
  const onSubmit = async () => {
    if (sessionStatus !== "authenticated") {
      // 未登录的话 submit 按钮已经被替换为登录按钮了，这里兜底
      signIn("github");
      return;
    }
    await handleDeploy();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <UploadPanel
        setValue={setValue}
        setSlugTouched={setSlugTouched}
        replaceShipped={replaceShippedAndClearThumbs}
        replaceEducations={replaceEdu}
        replaceExperiences={replaceExp}
        onPdfFileChange={setPdfFile}
      />

      <div className="setup-example-bar">
        <span>不想上传简历？试试用示例填一份看看效果：</span>
        <button
          type="button"
          onClick={fillFreshGradExample}
          className="setup-button"
        >
          填入「中国应届毕业生」示例
        </button>
      </div>

      {/* 第二步：核对 + 编辑 */}
      <h2 className="setup-section-heading" style={{ marginTop: 32 }}>
        第二步 · 核对并编辑信息
      </h2>
      <div
        style={{
          marginTop: -8,
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <p className="setup-help" style={{ margin: 0 }}>
          英文字段均为选填，仅填中文即可上线。
        </p>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.9em",
            color: "var(--wiki-text-soft)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={showEnglish}
            onChange={(e) => setShowEnglish(e.target.checked)}
            style={{ margin: 0 }}
          />
          显示英文版字段
        </label>
      </div>

      {/* 个人信息 */}
      <div className="setup-section">
        <h3 className="setup-section-heading">个人信息</h3>

        <div className="setup-field">
          <label htmlFor="field-name-zh" className="setup-label setup-label-required">中文姓名</label>
          <input
            id="field-name-zh"
            aria-required="true"
            {...register("name_zh")}
            className="setup-input"
            placeholder="王雪"
          />
        </div>

        <div className="setup-field">
          <label htmlFor="field-name" className="setup-label setup-label-required">英文姓名（用作链接）</label>
          <input
            id="field-name"
            aria-required="true"
            aria-describedby="field-name-help"
            {...register("name")}
            className="setup-input"
            placeholder="Wang Xue"
          />
          <div id="field-name-help" className="setup-help">
            用于页面链接（/wiki/Wang_Xue/），可填拼音。
          </div>
          {errors.name && (
            <div className="setup-error" role="alert">{errors.name.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label htmlFor="field-tagline-zh" className="setup-label">一句话介绍</label>
          <input
            id="field-tagline-zh"
            {...register("tagline_zh")}
            className="setup-input"
            placeholder="软件工程师 · 宾大硕士在读 · 关注开发者工具方向"
          />
        </div>

        <div className="setup-field">
          <label htmlFor="field-bio-zh" className="setup-label">个人简介</label>
          <Controller
            control={control}
            name="bio_zh"
            render={({ field }) => (
              <WikiTextarea
                id="field-bio-zh"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                inputRef={field.ref}
                rows={5}
                placeholder="用第三人称写几段话介绍你自己，像维基百科一样。例如：王雪是宾夕法尼亚大学系统工程方向的硕士在读生..."
                aria-describedby="field-bio-zh-help"
              />
            )}
          />
          <div id="field-bio-zh-help" className="setup-help">
            用<strong>第三人称</strong>撰写（例："王雪是..."），更像维基百科风格。
          </div>
        </div>

        <div className="setup-field">
          <label className="setup-label">头像（选填）</label>
          <div className="photo-row">
            {photoPreviewUrl && (
              <img
                src={photoPreviewUrl}
                alt="头像预览"
                className="photo-preview"
              />
            )}
            <div className="photo-controls">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPhotoChange(e.target.files?.[0])}
                className="photo-input"
              />
              {photoFile && (
                <button
                  type="button"
                  onClick={() => onPhotoChange(null)}
                  className="setup-button"
                  style={{ marginLeft: 8 }}
                >
                  移除
                </button>
              )}
            </div>
          </div>
          <div className="setup-help">
            方形，≥600×600，JPG/PNG/WebP，≤3 MB。
          </div>
          {photoError && <div className="setup-error">{photoError}</div>}
        </div>

        {showEnglish && (
          <details className="setup-array-details" style={{ marginTop: 8 }}>
            <summary>英文版（选填）</summary>
            <div className="setup-field" style={{ marginTop: 12 }}>
              <label className="setup-label">英文一句话介绍</label>
              <input
                {...register("tagline")}
                className="setup-input"
                placeholder="Software engineer, UPenn MS, interested in AI tooling"
              />
            </div>
            <div className="setup-field">
              <label className="setup-label">英文简介（bio）</label>
              <Controller
                control={control}
                name="bio"
                render={({ field }) => (
                  <WikiTextarea
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    rows={4}
                    placeholder="Write your story in third person, Wikipedia-style..."
                  />
                )}
              />
            </div>
          </details>
        )}
      </div>

      {/* 联系方式 */}
      <details
        className="setup-section"
        open={contactOpen}
        onToggle={(e) => setContactOpen(e.currentTarget.open)}
      >
        <summary>
          <h3 className="setup-section-heading">
            联系方式（选填，建议至少留一个）
          </h3>
          <span
            style={{
              fontSize: "0.9em",
              color: "var(--wiki-text-soft)",
              fontWeight: "normal",
            }}
          >
            · {contactSummary}
          </span>
        </summary>

        <div className="setup-field">
          <label className="setup-label">邮箱</label>
          <input
            {...register("email")}
            className="setup-input"
            placeholder="wangxue@example.com"
          />
          {errors.email && (
            <div className="setup-error">{errors.email.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label htmlFor="field-linkedin" className="setup-label">领英 LinkedIn</label>
          <input
            id="field-linkedin"
            aria-describedby="field-linkedin-help"
            {...register("linkedin")}
            className="setup-input"
            placeholder="linkedin.com/in/wangxue"
          />
          <div id="field-linkedin-help" className="setup-help">
            粘贴链接或路径，无需 https://。
          </div>
          {errors.linkedin && (
            <div className="setup-error" role="alert">{errors.linkedin.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label className="setup-label">GitHub</label>
          <input
            {...register("githubProfile")}
            className="setup-input"
            placeholder="github.com/wangxue"
          />
          {errors.githubProfile && (
            <div className="setup-error">{errors.githubProfile.message}</div>
          )}
        </div>
      </details>

      {/* 项目作品 */}
      <details
        className="setup-section"
        open={projectsOpen}
        onToggle={(e) => setProjectsOpen(e.currentTarget.open)}
      >
        <summary>
          <h3 className="setup-section-heading">
            项目作品（选填，每个生成独立 wiki 页）
          </h3>
          <span
            style={{
              fontSize: "0.9em",
              color: "var(--wiki-text-soft)",
              fontWeight: "normal",
            }}
          >
            · {projectsSummary}
          </span>
        </summary>

        {fields.map((field, idx) => {
          const thumb = projectThumbs[idx];
          const thumbErr = projectThumbErrors[idx];
          return (
            <div
              key={field.id}
              className="setup-array-row"
              role="group"
              aria-label={`项目 ${idx + 1}`}
            >
              <div>
                <label className="setup-label">项目名</label>
                <input
                  {...register(`shipped.${idx}.name`)}
                  className="setup-input"
                  placeholder="ProjectOne"
                />
              </div>
              <div>
                <label className="setup-label">一句话简介</label>
                <input
                  {...register(`shipped.${idx}.description`)}
                  className="setup-input"
                  placeholder="开源命令行工具，2024 年发布"
                />
              </div>
              <button
                type="button"
                onClick={() => removeProjectRow(idx)}
                className="setup-button"
                aria-label={`删除项目 ${idx + 1}`}
              >
                删除
              </button>
              <div className="project-thumb-row">
                {thumb?.kind === "image" && thumb.previewUrl && (
                  <img
                    src={thumb.previewUrl}
                    alt=""
                    className="project-thumb-preview"
                  />
                )}
                {thumb?.kind === "pdf" && (
                  <div
                    className="project-thumb-preview project-thumb-pdf"
                    title={thumb.fileName}
                  >
                    <span className="project-thumb-pdf-name">
                      {thumb.fileName.length > 22
                        ? thumb.fileName.slice(0, 19) + "…"
                        : thumb.fileName}
                    </span>
                  </div>
                )}
                <div className="project-thumb-controls">
                  <label className="setup-label">
                    缩略图或 PDF（选填）
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) =>
                      onProjectThumbChange(idx, e.target.files?.[0])
                    }
                    className="photo-input"
                  />
                  {thumb && (
                    <button
                      type="button"
                      onClick={() => onProjectThumbChange(idx, null)}
                      className="setup-button"
                      style={{ marginLeft: 8 }}
                    >
                      移除
                    </button>
                  )}
                  <div className="setup-help">
                    图片 ≤3 MB 显示在右侧；PDF ≤10 MB 显示为下载链接。
                  </div>
                  {thumbErr && (
                    <div className="setup-error">{thumbErr}</div>
                  )}
                </div>
              </div>
              <details
                className="setup-array-details"
                style={{ gridColumn: "1 / -1", marginTop: 6 }}
              >
                <summary>更多字段（角色 / 时间 / 链接 / 详情）</summary>
                <div className="setup-field-row" style={{ marginTop: 10 }}>
                  <div>
                    <label className="setup-label">担任角色</label>
                    <input
                      {...register(`shipped.${idx}.role`)}
                      className="setup-input"
                      placeholder="主创 / 后端开发 / 设计"
                    />
                  </div>
                  <div>
                    <label className="setup-label">时间</label>
                    <input
                      {...register(`shipped.${idx}.date_range`)}
                      className="setup-input"
                      placeholder="2024 春"
                    />
                  </div>
                </div>
                <div className="setup-field" style={{ marginTop: 10 }}>
                  <label className="setup-label">项目链接</label>
                  <input
                    {...register(`shipped.${idx}.url`)}
                    className="setup-input"
                    placeholder="github.com/yourname/projectone"
                  />
                </div>
                <EntityOutputs
                  control={control}
                  register={register}
                  namePrefix={`shipped.${idx}`}
                  placeholderLabel="GPS Localization Essay"
                />
                <div className="setup-field" style={{ marginTop: 10 }}>
                  <label className="setup-label">详细介绍（中文）</label>
                  <textarea
                    {...register(`shipped.${idx}.body_zh`)}
                    rows={3}
                    className="setup-textarea"
                    placeholder="项目背景、解决了什么问题、技术方案、产出..."
                  />
                </div>
                {showEnglish && (
                  <>
                    <div className="setup-field" style={{ marginTop: 10 }}>
                      <label className="setup-label">英文版简介（选填）</label>
                      <input
                        {...register(`shipped.${idx}.description`)}
                        className="setup-input"
                        placeholder="open-source dev console (2024)"
                      />
                    </div>
                    <div className="setup-field" style={{ marginTop: 10 }}>
                      <label className="setup-label">英文详情（选填）</label>
                      <textarea
                        {...register(`shipped.${idx}.body`)}
                        rows={3}
                        className="setup-textarea"
                        placeholder="Project background, problem, approach, outcome..."
                      />
                    </div>
                  </>
                )}
              </details>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() =>
            append(
              deriveOrKeep({
                name: "",
                slug: "",
                description: "",
                description_zh: "",
              })
            )
          }
          className="setup-button-add"
        >
          + 添加一个项目
        </button>
      </details>

      {/* 教育经历 */}
      <details
        className="setup-section"
        open={educationsOpen}
        onToggle={(e) => setEducationsOpen(e.currentTarget.open)}
      >
        <summary>
          <h3 className="setup-section-heading">
            教育经历（选填，每段生成学校独立 wiki 页）
          </h3>
          <span
            style={{
              fontSize: "0.9em",
              color: "var(--wiki-text-soft)",
              fontWeight: "normal",
            }}
          >
            · {educationsSummary}
          </span>
        </summary>
        {eduFields.map((field, idx) => (
          <div
            key={field.id}
            className="setup-array-row"
            role="group"
            aria-label={`教育经历 ${idx + 1}`}
          >
            <div>
              <label className="setup-label">学校</label>
              <input
                {...register(`educations.${idx}.name_zh`)}
                className="setup-input"
                placeholder="宾夕法尼亚大学"
              />
              {showEnglish && (
                <input
                  {...register(`educations.${idx}.name`)}
                  className="setup-input"
                  placeholder="University of Pennsylvania"
                  onBlur={(e) => {
                    const cur = watch(`educations.${idx}.slug`);
                    if (!cur && e.target.value) {
                      setValue(
                        `educations.${idx}.slug`,
                        deriveSlug(e.target.value),
                        { shouldValidate: false }
                      );
                    }
                  }}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <div>
              <label className="setup-label">学位 / 专业</label>
              <input
                {...register(`educations.${idx}.degree_zh`)}
                className="setup-input"
                placeholder="系统工程硕士"
              />
              {showEnglish && (
                <input
                  {...register(`educations.${idx}.degree`)}
                  className="setup-input"
                  placeholder="MSE in Systems Engineering"
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => removeEdu(idx)}
              className="setup-button"
              aria-label={`删除教育经历 ${idx + 1}`}
            >
              删除
            </button>
            <details
              className="setup-array-details"
              style={{ gridColumn: "1 / -1", marginTop: 6 }}
            >
              <summary>更多字段（时间 / 地点 / 详情）</summary>
              <div className="setup-field-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="setup-label">时间</label>
                  <input
                    {...register(`educations.${idx}.date_range`)}
                    className="setup-input"
                    placeholder="2025 年 8 月 – 2027 年 8 月（在读）"
                  />
                </div>
                <div>
                  <label className="setup-label">地点</label>
                  <input
                    {...register(`educations.${idx}.location`)}
                    className="setup-input"
                    placeholder="美国宾夕法尼亚州费城"
                  />
                </div>
              </div>
              <div className="setup-field" style={{ marginTop: 10 }}>
                <label className="setup-label">详情（中文）</label>
                <textarea
                  {...register(`educations.${idx}.body_zh`)}
                  rows={3}
                  className="setup-textarea"
                  placeholder="学习方向、核心课程、学术活动、奖项..."
                />
              </div>
            </details>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            appendEdu(
              deriveOrKeep({
                name: "",
                slug: "",
                degree: "",
                date_range: "",
                location: "",
              })
            )
          }
          className="setup-button-add"
        >
          + 添加一段教育经历
        </button>
      </details>

      {/* 工作经历 */}
      <details
        className="setup-section"
        open={experiencesOpen}
        onToggle={(e) => setExperiencesOpen(e.currentTarget.open)}
      >
        <summary>
          <h3 className="setup-section-heading">
            工作经历（选填，每段生成公司独立 wiki 页）
          </h3>
          <span
            style={{
              fontSize: "0.9em",
              color: "var(--wiki-text-soft)",
              fontWeight: "normal",
            }}
          >
            · {experiencesSummary}
          </span>
        </summary>
        {expFields.map((field, idx) => (
          <div
            key={field.id}
            className="setup-array-row"
            role="group"
            aria-label={`工作经历 ${idx + 1}`}
          >
            <div>
              <label className="setup-label">公司</label>
              <input
                {...register(`experiences.${idx}.name_zh`)}
                className="setup-input"
                placeholder="中国银河证券"
              />
              {showEnglish && (
                <input
                  {...register(`experiences.${idx}.name`)}
                  className="setup-input"
                  placeholder="China Galaxy Securities"
                  onBlur={(e) => {
                    const cur = watch(`experiences.${idx}.slug`);
                    if (!cur && e.target.value) {
                      setValue(
                        `experiences.${idx}.slug`,
                        deriveSlug(e.target.value),
                        { shouldValidate: false }
                      );
                    }
                  }}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <div>
              <label className="setup-label">职位</label>
              <input
                {...register(`experiences.${idx}.role_zh`)}
                className="setup-input"
                placeholder="量化研究实习生"
              />
              {showEnglish && (
                <input
                  {...register(`experiences.${idx}.role`)}
                  className="setup-input"
                  placeholder="Quantitative Research Intern"
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => removeExp(idx)}
              className="setup-button"
              aria-label={`删除工作经历 ${idx + 1}`}
            >
              删除
            </button>
            <details
              className="setup-array-details"
              style={{ gridColumn: "1 / -1", marginTop: 6 }}
            >
              <summary>更多字段（时间 / 地点 / 产出 / 详情）</summary>
              <div className="setup-field-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="setup-label">时间</label>
                  <input
                    {...register(`experiences.${idx}.date_range`)}
                    className="setup-input"
                    placeholder="2024 年夏"
                  />
                </div>
                <div>
                  <label className="setup-label">地点</label>
                  <input
                    {...register(`experiences.${idx}.location`)}
                    className="setup-input"
                    placeholder="上海"
                  />
                </div>
              </div>
              <EntityOutputs
                control={control}
                register={register}
                namePrefix={`experiences.${idx}`}
                placeholderLabel="实习总结 deck"
              />
              <div className="setup-field" style={{ marginTop: 10 }}>
                <label className="setup-label">详情（中文）</label>
                <textarea
                  {...register(`experiences.${idx}.body_zh`)}
                  rows={3}
                  className="setup-textarea"
                  placeholder="负责的项目、产出、技术栈、合作团队..."
                />
              </div>
            </details>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            appendExp(
              deriveOrKeep({
                name: "",
                slug: "",
                role: "",
                date_range: "",
                location: "",
              })
            )
          }
          className="setup-button-add"
        >
          + 添加一段工作经历
        </button>
      </details>

      {/* 高级设置——已 deploy 后再回来填 */}
      <details className="setup-advanced">
        <summary>
          <span className="setup-advanced-title">高级设置（一般不用动）</span>
          <span className="setup-advanced-hint">
            站点名称 · 仓库名 · 域名（可后改）
          </span>
        </summary>

        <div className="setup-field" style={{ marginTop: 14 }}>
          <label htmlFor="field-site-name" className="setup-label">站点名称</label>
          <input
            id="field-site-name"
            aria-describedby="field-site-name-help"
            {...register("siteName")}
            className="setup-input"
            placeholder="Workplay"
          />
          <div id="field-site-name-help" className="setup-help">
            显示在网站顶部，如 "Wangpedia"。
          </div>
          {errors.siteName && (
            <div className="setup-error" role="alert">{errors.siteName.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label htmlFor="field-slug" className="setup-label">个人主页 slug</label>
          <input
            id="field-slug"
            aria-describedby="field-slug-help"
            {...register("homepageSlug")}
            onChange={(e) => {
              setSlugTouched(true);
              register("homepageSlug").onChange(e);
            }}
            className="setup-input"
            placeholder="Wang_Xue"
          />
          <div id="field-slug-help" className="setup-help">
            主页 URL 后缀（/wiki/Wang_Xue/），自动生成。
          </div>
          {errors.homepageSlug && (
            <div className="setup-error" role="alert">{errors.homepageSlug.message}</div>
          )}
        </div>

        <div className="setup-field">
          <label htmlFor="field-domain" className="setup-label">站点域名</label>
          <input
            id="field-domain"
            aria-describedby="field-domain-help"
            {...register("metaBaseUrl")}
            className="setup-input"
            placeholder="your-site.vercel.app"
          />
          <div id="field-domain-help" className="setup-help">
            上线后的网址（如 wangxue.vercel.app），未上线可留空。
          </div>
          {errors.metaBaseUrl && (
            <div className="setup-error" role="alert">{errors.metaBaseUrl.message}</div>
          )}
        </div>

        <div
          className="setup-field-row"
          role="group"
          aria-labelledby="github-repo-help"
        >
          <div className="setup-field">
            <label htmlFor="field-gh-owner" className="setup-label">GitHub 用户名</label>
            <input
              id="field-gh-owner"
              aria-describedby="github-repo-help"
              {...register("githubOwner")}
              className="setup-input"
              placeholder="your-github-username"
            />
          </div>
          <div className="setup-field">
            <label htmlFor="field-gh-repo" className="setup-label">GitHub 仓库名</label>
            <input
              id="field-gh-repo"
              aria-describedby="github-repo-help"
              {...register("githubRepo")}
              className="setup-input"
              placeholder="your-wiki-repo"
            />
          </div>
        </div>
        <div id="github-repo-help" className="setup-help">
          用于页面顶部 "查看源代码 / 历史" 链接，上线后再填。
        </div>
      </details>

      {/* 第三步：预览 + 上线 */}
      <div className="setup-section deploy-block" style={{ marginTop: 36 }}>
        <h2 className="setup-section-heading">第三步 · 预览并上线</h2>

        <div className="setup-submit-row">
          <button
            type="button"
            onClick={() => {
              const current = watch();
              const normalized = {
                ...current,
                linkedin: normalizeUrl(current.linkedin),
                githubProfile: normalizeUrl(current.githubProfile),
              };
              setPreviewData(
                enrichShipped(normalized, projectThumbs, "preview")
              );
              setPreviewOpen(true);
            }}
            className="setup-button setup-button-secondary"
          >
            预览 & 修改 wiki
          </button>
        </div>

        {/* —— 主推路径：Workplay hosted —— */}
        <p className="setup-help" style={{ marginTop: 16, marginBottom: 14 }}>
          点下面按钮，30 秒得到 <strong>workplay.pro/你的名字</strong> 的可分享链接。
        </p>

        {supaUserLoading && (
          <div className="setup-help">正在检查登录状态…</div>
        )}

        {!supaUserLoading && !supaUser && (
          <>
            <a
              href="/login?next=/yourpedia/"
              className="deploy-action-button"
              style={{ display: "inline-block", textDecoration: "none" }}
            >
              登录后一键上线我的网站
            </a>
            <div className="setup-help" style={{ marginTop: 8 }}>
              用邮箱登录就行（不需要密码）。我们给你发一封登录链接邮件，点链接回来就能上线。
            </div>
          </>
        )}

        {!supaUserLoading && supaUser && publishStep === "idle" && (
          <div>
            <div className="deploy-signed-in">
              <span>
                已登录：<strong>{supaUser.email}</strong>
              </span>
              <button
                type="button"
                onClick={handleSupaSignOut}
                className="deploy-signout-link"
              >
                换个邮箱
              </button>
            </div>
            <button
              type="button"
              onClick={handlePublish}
              className="deploy-action-button"
            >
              一键上线我的网站
            </button>
          </div>
        )}

        {publishStep === "publishing" && (
          <div className="deploy-progress">
            <div className="deploy-step is-active">
              <span className="deploy-step-dot">1</span>
              <span>正在为你创建网站…</span>
            </div>
          </div>
        )}

        {publishStep === "done" && publishResult && (
          <div className="deploy-result">
            <div className="deploy-result-title">
              你的网站已经上线了
            </div>
            <p className="setup-help" style={{ marginBottom: 10 }}>
              链接：{" "}
              <a
                href={publishResult.url}
                target="_blank"
                rel="noreferrer"
                className="deploy-card-link"
                style={{ fontSize: 16, fontWeight: 600 }}
              >
                {typeof window !== "undefined" ? window.location.host : ""}
                {publishResult.url}
              </a>
              {publishResult.isFirstPublish ? (
                <em>（第一次发布，直接打开看看）</em>
              ) : (
                <em>（已更新，最迟 60 秒生效）</em>
              )}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <a
                href={publishResult.url}
                target="_blank"
                rel="noreferrer"
                className="deploy-vercel-button"
              >
                打开我的网站 →
              </a>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const fullUrl = window.location.origin + publishResult.url;
                    navigator.clipboard?.writeText(fullUrl);
                  }
                }}
                className="setup-button"
              >
                复制链接
              </button>
            </div>
            <div className="setup-help" style={{ marginTop: 12 }}>
              想改内容？修改表单后再点「一键上线」即可。
            </div>

            <div className="setup-help" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--wiki-border)" }}>
              觉得 Workplay 好用？
              <a
                href="https://github.com/wangxuzhou666-arch/colarpedia-setup"
                target="_blank"
                rel="noreferrer"
                style={{ marginLeft: 4 }}
              >
                给项目点个 star →
              </a>
            </div>

            <details className="setup-array-details" style={{ marginTop: 14 }}>
              <summary>想用自己的域名（如 wangxue.com）？</summary>
              <div className="setup-help" style={{ marginTop: 10 }}>
                目前 hosted 版本暂不支持自定义域名（M5 会加）。
                如果你现在就需要自己域名，可以走下面的「导出到 GitHub」选项，
                把 wiki 部署到你自己的 Vercel 项目，再绑域名。
              </div>
            </details>
          </div>
        )}

        {publishStep === "error" && (
          <div className="deploy-error">
            <strong>上线失败：</strong>{publishError}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setPublishStep("idle");
                  setPublishError("");
                }}
                className="setup-button"
              >
                再试一次
              </button>
            </div>
          </div>
        )}
      </div>

      {/* —— 进阶路径：导出到自己的 GitHub（折叠默认） —— */}
      <details className="setup-advanced" style={{ marginTop: 24 }}>
        <summary>
          <span className="setup-advanced-title">想自己掌控？导出到你的 GitHub</span>
          <span className="setup-advanced-hint">
            适合开发者：fork 模板 + 提交内容到你的 GitHub + Vercel 部署，代码完全归你
          </span>
        </summary>
        <div className="setup-section deploy-block" style={{ marginTop: 14 }}>

        <p className="setup-help" style={{ marginTop: 0, marginBottom: 14 }}>
          点下面按钮，我们会自动帮你：
          <strong>① 在你 GitHub 复制一份模板</strong> →
          <strong>② 把你的 wiki 内容提交进去</strong> →
          <strong>③ 给你一个 Vercel 部署按钮</strong>。
        </p>

        {sessionStatus === "loading" && (
          <div className="setup-help">正在检查你的 GitHub 登录状态…</div>
        )}

        {sessionStatus === "unauthenticated" && (
          <>
            <button
              type="button"
              onClick={() => signIn("github")}
              className="deploy-github-button"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5C5.65.5.5 5.65.5 12.05c0 5.1 3.3 9.42 7.88 10.95.58.1.79-.25.79-.55v-2.07c-3.2.7-3.88-1.37-3.88-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.17.92-.25 1.9-.38 2.88-.38s1.96.13 2.88.38c2.19-1.48 3.15-1.17 3.15-1.17.62 1.59.23 2.76.11 3.05.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.2.66.79.55C20.2 21.46 23.5 17.15 23.5 12.05 23.5 5.65 18.35.5 12 .5z" />
              </svg>
              <span>用 GitHub 账号登录并上线</span>
            </button>
            <div className="setup-help" style={{ marginTop: 8 }}>
              还没有 GitHub 账号？<a
                href="https://github.com/signup"
                target="_blank"
                rel="noreferrer"
                className="deploy-card-link"
              >点这里 30 秒注册一个 →</a>
              （免费，邮箱验证就行）
            </div>
          </>
        )}

        {sessionStatus === "authenticated" && deployStep === "idle" && (
          <div>
            <div className="deploy-signed-in">
              <span>
                已登录 GitHub：
                <strong>@{session.user?.githubLogin || session.user?.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => signOut({ redirect: false })}
                className="deploy-signout-link"
              >
                切换账号
              </button>
            </div>
            <button
              type="button"
              onClick={handleDeploy}
              className="deploy-action-button"
            >
              部署到我的 GitHub + Vercel
            </button>
          </div>
        )}

        {(deployStep === "forking" || deployStep === "committing") && (
          <div className="deploy-progress">
            <div
              className={`deploy-step ${deployStep === "forking" ? "is-active" : "is-done"}`}
            >
              <span className="deploy-step-dot">1</span>
              <span>正在你的 GitHub 复制模板仓库…</span>
            </div>
            <div
              className={`deploy-step ${deployStep === "committing" ? "is-active" : "is-pending"}`}
            >
              <span className="deploy-step-dot">2</span>
              <span>正在把你的 wiki 内容提交进去…</span>
            </div>
            <div className="deploy-step is-pending">
              <span className="deploy-step-dot">3</span>
              <span>准备 Vercel 上线链接…</span>
            </div>
          </div>
        )}

        {deployStep === "done" && deployResult && (
          <div className="deploy-result">
            <div className="deploy-result-title">
              你的 wiki 已经在 GitHub 上了，再点一下就上线
            </div>
            <p className="setup-help" style={{ marginBottom: 10 }}>
              GitHub 仓库：{" "}
              <a
                href={deployResult.forkUrl}
                target="_blank"
                rel="noreferrer"
                className="deploy-card-link"
              >
                {deployResult.forkUrl.replace("https://github.com/", "")}
              </a>{" "}
              · 已提交 {deployResult.operations?.length || 0} 个文件
              {deployResult.forkExisted && (
                <em>（之前已经有这个仓库了，本次是覆盖更新）</em>
              )}
            </p>
            <a
              href={deployResult.vercelDeployUrl}
              target="_blank"
              rel="noreferrer"
              className="deploy-vercel-button"
            >
              在 Vercel 上线 →
            </a>
            <div className="setup-help" style={{ marginTop: 10 }}>
              点击上面按钮，会跳到 Vercel：登录（用 GitHub 账号一键登录就行，免费、不用信用卡），
              然后按 "Deploy" 按钮，等大概 30 秒就上线了。
            </div>

            <details className="setup-array-details" style={{ marginTop: 14 }}>
              <summary>上线后想换成自己的域名（如 wangxue.com）？</summary>
              <div className="setup-help" style={{ marginTop: 10 }}>
                <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
                  <li>在阿里云 / 腾讯云 / Namecheap 等买一个域名（一般 ¥50-100/年）。</li>
                  <li>进入 Vercel → 你的项目 → Settings → Domains，输入你的域名点 Add。</li>
                  <li>Vercel 会告诉你要改 DNS 的 A 记录或 CNAME，把它复制到你买域名的网站后台。</li>
                  <li>等 5-30 分钟生效，你的 wiki 就在 wangxue.com 上线了。</li>
                </ol>
                <p style={{ marginTop: 10 }}>
                  不绑域名也可以，Vercel 会给你一个 *.vercel.app 的免费子域名，照样能用。
                </p>
              </div>
            </details>
          </div>
        )}

        {deployStep === "error" && (
          <div className="deploy-error">
            <strong>上线失败：</strong>{deployError}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setDeployStep("idle");
                  setDeployError("");
                }}
                className="setup-button"
              >
                再试一次
              </button>
            </div>
          </div>
        )}
        </div>
      </details>

      {previewOpen && previewData && (
        <PreviewModal
          data={previewData}
          photoPreviewUrl={photoPreviewUrl}
          files={{ photoFile, pdfFile }}
          onApplyPolish={(section, idx, patch) => {
            for (const [field, value] of Object.entries(patch)) {
              setValue(`${section}.${idx}.${field}`, value, {
                shouldDirty: true,
                shouldValidate: false,
              });
            }
            const fresh = watch();
            setPreviewData(
              enrichShipped(
                {
                  ...fresh,
                  linkedin: normalizeUrl(fresh.linkedin),
                  githubProfile: normalizeUrl(fresh.githubProfile),
                },
                projectThumbs,
                "preview"
              )
            );
          }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </form>
  );
}
