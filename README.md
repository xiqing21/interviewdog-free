# 面试猪

> 🎯 免费、开源、可自定义 AI 的面试辅助与笔试辅助工具

基于浏览器原生能力，支持接入你自己的 AI API Key；可本地使用，也可登录后同步简历库、知识库、面试记录和复盘。

## ✨ 核心功能

### 🎙️ 面试辅助
- **实时语音识别**：利用浏览器 Web Speech API，实时将面试官语音转为文字
- **实时 ASR Gateway**：支持服务端 WebSocket 接入豆包/讯飞/阿里，系统音频识别延迟更低，详见 [实时 ASR Gateway 优化说明](docs/realtime-asr-gateway.md)
- **远程同步资料库**：登录后可同步简历库、专家库、面试记录和复盘，详见 [Supabase 同步与简历解析说明](docs/supabase-sync-and-resume-parsing.md)
- **AI 自动解答**：识别到问题后自动发送给你的 AI，流式输出专业解答
- **上下文关联**：支持多轮对话上下文（最多5轮），追问也能准确回答
- **手动编辑**：支持手动输入/编辑问题，灵活应对各种场景

### 📸 笔试辅助
- **一键截图**：使用浏览器屏幕共享 API 快速截屏
- **拖拽上传**：支持拖拽、粘贴、文件选择等多种图片上传方式
- **AI 视觉识别**：将截图发送给视觉 AI 模型，自动识别题目并解答
- **多题型支持**：代码题、选择题、读图题、逻辑推理题、英语题
- **批量历史**：截图和解答自动保存，支持回溯查看

### ⚙️ AI 自定义（核心亮点）
- **多 Provider 支持**：OpenAI / Anthropic / 自定义兼容接口
- **API Key 自由**：使用你自己的 Key；AI 请求只发送到你配置的模型服务
- **模型自由选择**：文本模型 + 视觉模型独立配置
- **Prompt 自定义**：面试和笔试场景使用不同的 System Prompt
- **流式响应**：支持 SSE 流式输出，打字机效果
- **连接测试**：一键测试 AI 连接是否正常

### 🔒 隐私安全
- **本地优先**：未登录时数据存储在浏览器 localStorage
- **可选同步**：登录后简历库、知识库、面试项目和复盘同步到 Supabase
- **Key 混淆加密**：API Key 经过混淆处理后再存储
- **可控同步**：同步仅用于跨设备继续使用，核心模型 Key 仍由你自己配置

## 🚀 快速开始

### 前置要求
- Node.js >= 18
- pnpm（推荐）或 npm

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/xiqing21/interviewdog-free.git
cd interviewdog-free

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

### 配置 AI

1. 打开应用后，点击左侧「设置」
2. 选择你的 AI Provider（OpenAI / Anthropic / 自定义）
3. 填入你的 API Key
4. 填入 Base URL（使用默认或自定义代理地址）
5. 配置文本模型和视觉模型
6. 点击「测试连接」确认配置正确

| Provider | 默认 Base URL | 默认文本模型 | 默认视觉模型 |
|----------|-------------|------------|------------|
| OpenAI | `https://api.openai.com/v1` | gpt-4o | gpt-4o |
| Anthropic | `https://api.anthropic.com/v1` | claude-sonnet-4-20250514 | claude-sonnet-4-20250514 |
| 自定义 | 自行填写 | 自行填写 | 自行填写 |

> 💡 支持任何兼容 OpenAI Chat Completions API 格式的服务，包括国内的各种 API 中转站。

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 前端框架 |
| Vite 5 | 构建工具 |
| MUI 5 | UI 组件库 |
| Tailwind CSS 3 | 样式工具 |
| React Router 6 | 路由管理 |
| react-markdown + highlight.js | Markdown 渲染与代码高亮 |
| Web Speech API | 语音识别（浏览器原生） |
| getDisplayMedia | 屏幕截图（浏览器原生） |

## 📁 项目结构

```
interviewdog-free/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── main.tsx                 # 应用入口
│   ├── App.tsx                  # 根组件（路由 + Provider 嵌套）
│   ├── types/index.ts           # 全局 TypeScript 类型定义
│   ├── constants/index.ts       # 常量配置
│   ├── styles/
│   │   ├── globals.css          # 全局样式 + Tailwind 指令
│   │   └── theme.ts             # MUI 主题（暗色/亮色）
│   ├── services/
│   │   ├── aiService.ts         # AI API 调用（OpenAI 兼容格式）
│   │   ├── speechService.ts     # Web Speech API 语音识别封装
│   │   ├── captureService.ts    # 屏幕截图封装
│   │   ├── storageService.ts    # localStorage 读写抽象
│   │   └── cryptoService.ts     # API Key 混淆/还原
│   ├── context/
│   │   ├── SettingsContext.tsx   # AI 设置 + 应用设置状态
│   │   ├── InterviewContext.tsx  # 面试辅助状态
│   │   └── ExamContext.tsx      # 笔试辅助状态
│   ├── hooks/
│   │   ├── useSettings.ts
│   │   ├── useInterview.ts
│   │   ├── useExam.ts
│   │   ├── useTheme.ts
│   │   └── useHotkeys.ts        # 全局快捷键
│   └── components/
│       ├── layout/              # 布局组件（Sidebar/TopBar/BottomBar）
│       ├── interview/           # 面试辅助组件（语音/问答/历史）
│       ├── exam/                # 笔试辅助组件（截图/题型/解答）
│       ├── settings/            # 设置组件（Provider/模型/Prompt）
│       └── common/              # 通用组件（Markdown/复制/状态/隐私）
└── prd.md                       # 产品需求文档
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Shift + S` | 截图（笔试模式） |
| `Ctrl + Shift + ↑` | 滚动答案上滚 |
| `Ctrl + Shift + ↓` | 滚动答案下滚 |
| `Ctrl + Shift + M` | 切换面试/笔试模式 |

## 📄 许可证

MIT License

## ⚠️ 免责声明

本工具仅供学习和技术研究使用。使用者应遵守相关法律法规，不得将本工具用于任何违法违规用途。使用本工具产生的一切后果由使用者自行承担。
