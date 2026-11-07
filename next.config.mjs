/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Site estatico em out/: o app nao tem servidor (os dados ficam no localStorage), e o
  // app iOS em ios/ empacota esses arquivos dentro de um WKWebView.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
