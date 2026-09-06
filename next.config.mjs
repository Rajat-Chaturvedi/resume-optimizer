/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfjs-dist", "mammoth", "docx", "pdf-lib"],
};

export default nextConfig;
