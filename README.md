# 🛠️ Mizuki 管理后台

`Mizuki 管理后台` 是一个独立的、密码保护的 Node 服务，用于图形化编辑本静态 Astro 博客的 Markdown 源文件与站点数据。博客前端保持静态，管理后台**不会**被打进 `dist` 构建产物，整个 `admin/` 目录也被 `.gitignore` 排除，改动不会提交到主站仓库。

## 功能概览

| 模块 | 功能 |
|------|------|
| **文章** | 文章增删改查、Markdown 源码编辑与实时预览、标签/分类/系列管理、封面与媒体上传（自动转 WebP）、**PDF 课件一键转 Markdown**、草稿与精选开关 |
| **数据中心** | 管理项目、技能、时间线、此刻、音乐等结构化数据；从 GitHub / Gitee 一键拉取项目 |
| **站点设置** | 站点标题、副标题、主题色相、横幅、评论、音乐播放器、分享图生成等开关 |
| **处理工具 → 转 WebP** | 批量图片压缩转换（PNG/JPEG/GIF/TIFF/AVIF → WebP，可调质量） |
| **处理工具 → 转 MP3** | 音频批量转 MP3，支持 FLAC/WAV/AAC/OGG/M4A/WMA/NCM（网易云）等格式 |

## 快速开始

### 1. 环境要求

- Node.js ≥ 20，pnpm
- 图片 / 音频转换：依赖 `sharp` 与 `@ffmpeg-installer/ffmpeg`（随依赖自动安装）
- **PDF 转 Markdown**：需本机安装 Python 3 与 `pdfplumber`（`pip install pdfplumber`），见下文

### 2. 配置

复制项目根目录的 `.env.admin.example` 为 `.env.admin`，至少设置一个强密码：

```dotenv
# 必填：管理后台登录密码
ADMIN_PASSWORD=使用一个长且唯一的密码短语

# 监听地址：保持 127.0.0.1，除非位于反向代理之后
ADMIN_HOST=127.0.0.1
ADMIN_PORT=8787

# 可选：保存时触发部署（部署平台的构建钩子）
DEPLOY_HOOK_URL=https://example.com/build-hook
```

> `.env.admin` 会被 `admin/config.mjs` 在启动时自动读取，无需手动导出环境变量。

### 3. 启动

```bash
pnpm admin
```

打开 <http://127.0.0.1:8787>，输入密码登录。

### 4. 安全说明

请勿将管理后台直接暴露到公网。保持 `ADMIN_HOST=127.0.0.1`，或将其置于 HTTPS 反向代理之后并添加额外的访问控制层。

## ✍️ 文章编辑与 PDF 导入

### Markdown 编辑

编辑文章页提供 **编辑 / 预览 / 分屏** 三种模式，支持：

- 拖入 `.md` 文件直接导入（自动解析 Frontmatter）
- 上传图片 / 封面（自动转 WebP）与 MP4/WebM 视频
- 拖入或点击 **导入 PDF**：PDF 课件自动转换为 Markdown 并**写入编辑框**，可继续编辑后手动保存，不会直接落盘

### PDF 课件转 Markdown

在编辑文章页点击「导入 PDF」或把 PDF 拖入编辑区，后台会：

1. 调用 `admin/lib/pdf2md.py`（Python + pdfplumber）提取文本
2. 自动识别标题层级、代码块、列表与表格
3. 为每个代码块**自动识别语言标签**（Java / C / Python / JavaScript / XML / YAML / SQL / JSON，纯文本归为 `txt`）
4. 将结果填入正文编辑框，标题为空时自动用文件名填充

转换后的代码块可正确显示语言徽章与语法高亮。依赖说明：

```bash
pip install pdfplumber   # 本机需安装 Python 3 与 pdfplumber
```

未安装时会给出明确的提示。单文件上限 50 MB。

## ☁️ 阿里云 OSS 媒体存储

文章图片/视频、项目/番剧/日记图、音乐等媒体默认上传到阿里云 OSS（`vercel.json` 已配置对应路径重定向）：

```dotenv
OSS_REGION=oss-cn-beijing
OSS_BUCKET=your-bucket-name
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
```

未配置 OSS 时，媒体上传接口会提示配置缺失。可在阿里云 RAM 控制台创建子用户并授权后获取 AccessKey。

## 🌐 从 GitHub / Gitee 自动拉取项目

「数据中心 → 项目」支持一键从 GitHub / Gitee 仓库拉取项目信息（名称、描述、语言/技术栈、仓库链接、创建日期）。

### 配置

```dotenv
# 至少配置一个用户名即可启用「从仓库拉取」
GITHUB_USERNAME=你的GitHub用户名
GITEE_USERNAME=你的Gitee用户名

# 可选：访问私有仓库或提高 API 限额时需要 Token
# GitHub: https://github.com/settings/tokens （repo / public_repo 权限）
# Gitee:  https://gitee.com/profile/personal_access_tokens （projects 权限）
GITHUB_TOKEN=
GITEE_TOKEN=
```

### 使用方式

1. 进入「数据中心 → 项目」，点击「从仓库拉取」。
2. 勾选要导入的仓库，选择导入方式：
   - **仅新增**：只添加本地尚不存在的仓库，不修改已有项目。
   - **新增并更新**：为已有项目补全新字段，同时保留本地已填写的字段（如封面、分类、精选标记等）。
3. 点击「导入选中项目」：项目写入 `src/data/projects.ts`，并像普通保存一样触发部署钩子（若配置了 `DEPLOY_HOOK_URL`）。

导入时自动生成技术栈、标签与分类：技术栈由仓库语言 + GitHub Topics + 名称/描述关键词组合；标签由 Topics + 领域关键词组合（最多 8 个）；分类优先按仓库语言判断（web / mobile / desktop），否则按关键词推断。生成结果会同步写入 `admin/tag-library.json` 与 `admin/category-library.json`，编辑器的自动补全选项自动更新。

## 🚀 部署钩子

设置 `DEPLOY_HOOK_URL` 后，每次保存文章、设置或集合数据时会向该地址发送 POST 请求，可用于触发部署平台的构建。未设置时，编辑内容仅写入本地仓库，需通过常规 Git 工作流提交并部署。

## 🧪 测试

后台使用 Node 内置测试运行器（`node:test`），覆盖文章序列化、媒体转换、PDF 解码、存储安全、远程项目同步等：

```bash
cd admin
node --test test/*.test.mjs
```

## 📁 目录结构

```
admin/
├── public/index.html      # 单页前端（原生 JS）
├── lib/                   # 核心库：posts / storage / audio / oss / pdf2md.py
├── services/              # 业务服务：posts / media / library / deploy / pdf-convert ...
├── routes/                # HTTP 路由：index.mjs / static.mjs
├── test/                  # node:test 单元测试
├── config.mjs             # 配置加载（.env.admin）
├── server.mjs             # 服务入口
└── README.md
```

## 常见问题

- **端口被占用**：`ADMIN_PORT` 已在 `.env.admin` 配置，确认没有旧实例在运行。
- **PDF 导入报 Python 错误**：本机缺少 `python3` 或 `pdfplumber`，执行 `pip install pdfplumber` 后重试。
- **媒体上传失败**：检查 OSS 配置（`OSS_BUCKET` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`）。
