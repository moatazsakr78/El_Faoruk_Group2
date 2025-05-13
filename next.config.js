/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // إضافة تكوين لاستبعاد مجلد وظائف Supabase من عملية البناء
  webpack: (config, { isServer }) => {
    // استثناء مجلد Supabase Functions
    config.module.rules.push({
      test: /supabase\/functions\/.*/,
      use: 'ignore-loader',
    });
    
    return config;
  },
  // استبعاد مجلدات محددة من البناء
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
  experimental: {
    // تجاهل مجموعة من الملفات والمجلدات
    outputFileTracingExcludes: {
      '*': ['./supabase/**/*']
    },
  },
  typescript: {
    // ⚠️ Warning: Ignoring TypeScript errors during build
    ignoreBuildErrors: true,
  },
  eslint: {
    // ⚠️ Warning: Ignoring ESLint errors during build
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['images.unsplash.com', 'via.placeholder.com', 'jpwsohttsxsmyhasvudy.supabase.co', 'scbtgnknfahvxlcalfrk.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // تكوين الصور المحسن
    minimumCacheTTL: 31536000, // وقت التخزين المؤقت لمدة سنة (بالثواني)
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // إعدادات الهيدرز
  async headers() {
    return [
      {
        // تطبيق هيدرز على مسارات الصور
        source: '/api/optimized-image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // تطبيق هيدرز على الصور المستضافة على Supabase
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
