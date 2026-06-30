# Supabase 同步与简历解析说明

本文档说明当前项目里哪些数据会远程同步，以及上传 PDF 简历时是如何解析的。

## 1. 远程同步范围

登录 Supabase 后，以下数据会同步到远端：

### 用户资料表 `user_profiles`

用于保存跨面试项目复用的资料：

- `resume_library`：简历库，JSONB 数组。
- `expert_library`：专家知识库，JSONB 数组。
- `expert_knowledge`：旧版单文本专家知识库，保留用于迁移兼容。
- `updated_at`：最后更新时间。

### 面试记录表 `interview_sessions`

用于保存每场面试项目：

- 项目名称、岗位方向、考察重点。
- 本场挂载的简历文本快照。
- 本场挂载的简历 ID：`resume_ids`。
- 本场挂载的专家知识库文本快照：`expert_knowledge`。
- 本场挂载的专家知识库 ID：`expert_knowledge_ids`。
- QA 问答记录：`qa_list`。
- 双方语音转写记录：`transcript_lines`。
- 面试复盘：`review`。
- 归档时间：`archived_at`。

这样换设备登录后，可以继续看到简历库、专家库、历史面试、对话记录和面试复盘。

## 2. 为什么保存快照而不只保存 ID

简历库和专家库是会变的。如果历史面试只保存 ID，那么以后修改某个专家库后，旧面试的复盘上下文就会被污染。

所以面试项目会同时保存：

```text
引用 ID：用于再次编辑项目时回显选择
文本快照：用于历史记录、复盘、AI 上下文稳定复现
```

## 3. 本次 Supabase 迁移

新增迁移：

```text
supabase/migrations/20260629001000_knowledge_library_and_session_refs.sql
```

新增字段：

```sql
alter table public.user_profiles
add column if not exists expert_library jsonb not null default '[]'::jsonb;

alter table public.interview_sessions
add column if not exists resume_ids text[] not null default '{}',
add column if not exists expert_knowledge text,
add column if not exists expert_knowledge_ids text[] not null default '{}';
```

旧的 `expert_knowledge` 单文本会迁移成一个默认专家库条目，避免老数据丢失。

## 4. 简历 PDF 是怎么解析的

当前上传 PDF 简历时使用：

```text
pdfjs-dist
```

核心文件：

```text
src/services/pdfParserService.ts
```

解析流程：

1. 浏览器读取 PDF 文件为 `ArrayBuffer`。
2. `pdfjs-dist` 在浏览器本地加载 PDF。
3. 逐页调用 `page.getTextContent()`。
4. 提取每个文本 item 的 `str` 字段。
5. 拼接成纯文本，填入简历文本框。

这整个过程在浏览器本地完成：

- 不上传 PDF 到服务器。
- 不调用 AI。
- 不调用 OCR。
- 不保存原始 PDF 文件，只保存提取后的文本。

## 5. 难不难、准不准

### 文本型 PDF

如果 PDF 本身包含可复制文本，比如 Word/飞书/Markdown 导出的 PDF，解析通常比较准。

优势：

- 速度快。
- 隐私好。
- 成本为零。
- 不依赖后端。

局限：

- 版式会丢失。
- 分栏、表格、项目符号可能顺序不完美。
- 需要用户简单检查一下文本。

### 扫描版 PDF / 图片简历

如果 PDF 本质是图片，`pdfjs-dist` 提取不到真实文字，效果会很差，甚至为空。

这种情况需要 OCR，例如：

- 浏览器端 OCR：Tesseract.js，隐私好但慢。
- 云 OCR：阿里 OCR、百度 OCR、腾讯 OCR、火山 OCR，效果更好但要上传图片。
- AI 视觉模型解析：可以读复杂版式，但成本更高。

当前项目先选择 `pdfjs-dist`，因为它最轻、最快、最安全，适合大部分文本型简历。

## 6. 当前推荐工作流

1. 到“简历与知识库”页面上传或粘贴多份简历。
2. 保存多个专家知识库，例如：
   - 大数据项目经验
   - Flink/StarRocks 技术栈
   - Web3 合约安全
   - 自我介绍话术
3. 新建面试项目时，多选引用简历和专家库。
4. 面试过程中生成 QA、语音转写和复盘。
5. 登录 Supabase 后，这些数据会远程同步，换设备继续使用。
