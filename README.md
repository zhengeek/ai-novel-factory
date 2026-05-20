# AI 网文兵工厂

个人网文创作辅助工作台。Phase 1 使用本地 `localStorage` 存储，先验证三 Pane 写作工作流；DeepSeek 接口跑通后，Phase 2 迁移到 Supabase。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## Vercel

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Production Branch: `main`

生成正文需要在 Vercel 项目环境变量中配置：

```txt
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

前端只调用 `/api/generate-chapter`，DeepSeek Key 只在 Vercel 服务端函数中读取。

Phase 2 接入 Supabase 后，服务端生成记录还需要：

```txt
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
```

`SUPABASE_SERVICE_ROLE_KEY` 只能放在 Vercel 服务端环境变量中，不能暴露到前端。

## 自定义域名

在 Vercel 项目 Settings -> Domains 添加：

```txt
writer.cattolab.cn
```

在 `cattolab.cn` 的 DNS 控制台添加 Vercel 提示的 CNAME：

```txt
Type: CNAME
Name/Host: writer
Value/Target: 以 Vercel Dashboard 展示值为准
TTL: Auto 或 600
```

## Phase 2 约束

DeepSeek API Key 不能放在前端。接入真实生成时，应通过 Supabase Edge Function 或 Vercel Serverless Function 代理请求，并用 Supabase 接管小说、设定、大纲与正文数据。
