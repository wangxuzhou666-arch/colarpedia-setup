import { Providers } from "../providers";

export default function SetupLayout({ children }) {
  return <Providers>{children}</Providers>;
}
