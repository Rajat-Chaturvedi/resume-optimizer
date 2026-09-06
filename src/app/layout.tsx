import type { Metadata } from "next";
import { APP } from "@/constants/copy";
import { DEFAULT_THEME, THEME_STORAGE_KEY, themeCss } from "@/constants/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: APP.name,
  description: APP.description,
};

const restoreTheme = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t)document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        {/* Applied before paint so the stored theme does not flash the default one. */}
        <script dangerouslySetInnerHTML={{ __html: restoreTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
