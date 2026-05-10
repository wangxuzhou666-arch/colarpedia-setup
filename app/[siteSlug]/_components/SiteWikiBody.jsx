"use client";

// 客户端组件：用 react-markdown 渲染 hosted wiki body。
// markdown 里已经被 server 改写好了 wikilinks（href 指向 /<siteSlug>/<targetSlug>）
// 所以这里不再做链接处理，纯 markdown → HTML。

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

export default function SiteWikiBody({ body }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
      {body}
    </ReactMarkdown>
  );
}
