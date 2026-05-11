// /demo —— 每次访问随机重定向到一个 fixture 的 bio 页面。
// 用 force-dynamic 关掉静态化，否则会缓存第一次的随机选择。

import { redirect } from "next/navigation";
import { pickRandomFixtureName } from "../../lib/demoFixtures";

export const dynamic = "force-dynamic";

export default function DemoIndex() {
  const name = pickRandomFixtureName();
  redirect(`/demo/${name}/`);
}
