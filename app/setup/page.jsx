import SetupForm from "./components/SetupForm";

export const metadata = {
  title: "Yourpedia — 5 分钟生成你的个人 wiki 站",
  description:
    "上传简历，自动生成像维基百科一样的个人主页。免费、开源、不用编程。",
};

export default function SetupPage() {
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
      <div className="wiki-tabs">
        <div className="wiki-tabs-inner">
          <a href="#" className="active">
            生成
          </a>
          <a
            href="/wiki/Jane_Doe/"
            target="_blank"
            rel="noreferrer"
            title="看看做出来长什么样"
          >
            示例预览
          </a>
          <a
            href="https://github.com/wangxuzhou666-arch/colarpedia-template"
            className="external"
            target="_blank"
            rel="noreferrer"
            title="开源代码仓库"
          >
            开源代码
          </a>
        </div>
      </div>

      <main className="setup-shell">
        <h1 className="wiki-title">生成我的个人 wiki 站</h1>
        <p className="wiki-title-sub">
          上传简历 · 自动填表单 · 一键上线 · 免费 · 不用编程
        </p>

        <p className="setup-intro">
          下面填一份表单，我们会帮你生成一个像维基百科一样的个人主页，
          可以放进 LinkedIn、小红书简介、求职简历里。
          简历内容会发送给 Anthropic Claude 做解析，不在我们这边长期保存。
        </p>

        <p className="setup-meta">
          想看做出来长什么样？{" "}
          <a href="/wiki/Jane_Doe/" target="_blank" rel="noreferrer">
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
      </footer>
    </>
  );
}
