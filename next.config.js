/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // 将 cheerio 和 undici 标记为外部包，避免 webpack 处理
  // 注意：Next.js 14.0.4 不支持 serverComponentsExternalPackages，使用 webpack 配置替代
  webpack: (config, { isServer }) => {
    // 在服务端构建时，将 cheerio 和 undici 标记为外部依赖
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('cheerio', 'undici');
      } else if (typeof config.externals === 'object') {
        config.externals.cheerio = 'commonjs cheerio';
        config.externals.undici = 'commonjs undici';
      } else {
        config.externals = [config.externals, 'cheerio', 'undici'];
      }
    }
    
    return config;
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

