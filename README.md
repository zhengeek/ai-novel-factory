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
- `偏好/避雷`：结构化记录喜欢、避雷和风格偏好；失败样稿全文不会进入长期记忆。
- `人物卡`：包含姓名、性别、身份与背景、性格与行为模式、目标与当前欲望、秘密。

生成正文会先进入临时预览区。点击“采用”才会覆盖当前章节正文；点击“丢弃”不会保存失败全文；点击“丢弃并记录原因”只会把不满意原因保存为一条避雷偏好。

## 构建

```bash
npm run build
```

## Phase 3 验收

长期记忆链路上线前建议按这个顺序验收：

1. 先在 Supabase SQL Editor 执行 `supabase/migrations/202605200001_phase2_schema.sql`。
2. 确认 Supabase 项目支持 `vector` 扩展。迁移会创建 `memory_items.embedding vector(1536)` 和向量检索 RPC；如果项目不支持 `vector`，正式长期记忆入库和向量召回不可用，但基础正文生成、候选抽取和关键词兜底仍应保持可用。
3. 在 Vercel 服务端环境变量配置 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
4. 走一遍“生成正文 -> 采用 -> 抽取章节摘要和候选 -> 确认入库 -> 再次生成并召回记忆”的闭环。
5. 检查 `generation_runs.input_summary` 里的召回模式：`vector`、`keyword`、`fallback` 或 `disabled`，用于排查 token 消耗和跑偏问题。

`src/vendor/splitpanes.ts` 是网络受限环境下的本地兼容层，用于保证当前仓库可以稳定构建。等真实 `splitpanes` 依赖可安装后，可以继续保留兼容层作为兜底，或切换到 npm 包的真实实现。

## Vercel

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Production Branch: `main`

正文生成通过 `/api/generate-chapter` 服务端函数代理 DeepSeek 请求。不要把 DeepSeek 或 Supabase service role 密钥放进前端变量。

Vercel 服务端环境变量：

```txt
DEEPSEEK_API_KEY=你的 DeepSeek API Key
OPENAI_API_KEY=你的 OpenAI API Key
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
```

`OPENAI_API_KEY` 用于长期记忆 embedding 和可选的 OpenAI 记忆候选生成；如果缺失，基础正文生成仍可使用，但确认正式长期记忆和 OpenAI 候选生成会报出明确提示。

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
