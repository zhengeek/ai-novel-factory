# AI 网文兵工厂

个人网文创作辅助工作台。Phase 1 使用浏览器 `localStorage` 验证三栏写作工作流；Phase 2 接入 Supabase，把小说、章节、世界观、资料库、人物卡、时间线、灵感记录和生成日志迁移到云端。

## 本地开发

```bash
npm install
npm run dev
```

前端需要配置：

```txt
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon key
```

未配置时，应用会显示明确的 Supabase 配置提示，而不是直接白屏。

## Supabase

先在 Supabase 项目中执行：

```txt
supabase/migrations/202605200001_phase2_schema.sql
```

当前登录方式为邮箱 Magic Link。用户登录后，前端通过 Supabase RLS 只读写自己的数据。

如果浏览器里已有 Phase 1 的 `localStorage` 小说数据，首次登录后会自动追加导入云端；整批导入成功后会写入 `ai-novel-factory:local-imported=true`，避免重复导入。旧人物卡里的 `role` 会兼容迁移为“身份与背景”。

## 写作上下文

- `全局设定`：放在左侧上下文控制台，适合记录小说核心方向和本章生成约束。
- `世界观`：记录世界规则、势力结构、能力体系、历史地理和禁忌。
- `资料库`：整理名词解释、地点、物件、素材摘录、伏笔清单和风格参考。
- `人物卡`：包含姓名、性别、身份与背景、性格与行为模式、目标与当前欲望、秘密。

## 构建

```bash
npm run build
```

## Vercel

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Production Branch: `main`

正文生成通过 `/api/generate-chapter` 服务端函数代理 DeepSeek 请求。不要把 DeepSeek 或 Supabase service role 密钥放进前端变量。

Vercel 服务端环境变量：

```txt
DEEPSEEK_API_KEY=你的 DeepSeek API Key
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
```

Vercel 前端环境变量：

```txt
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon key
```

`SUPABASE_SERVICE_ROLE_KEY` 只能放在服务端环境变量中，不能暴露到前端。

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
