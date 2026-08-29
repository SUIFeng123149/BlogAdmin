# 🛠️ Mizuki 管理后台

`Mizuki 管理后台` 是一个独立的、密码保护的 Node 服务，用于图形化编辑本静态 Astro 博客的 Markdown 源文件与站点数据。博客前端保持静态，管理后台**不会**被打进 `dist` 构建产物，整个 `admin/` 目录也被主站 `.gitignore` 排除，改动不会提交到主站仓库。

## 功能概览

| 模块 | 功能 |
|------|------|
| **文章** | 文章增删改查、Markdown 源码编辑与实时预览（图片缩略显示、点击看原图）、标签/分类/系列管理、封面与媒体上传（自动转 WebP）、**PDF 课件一键转 Markdown**、草稿与精选开关、**首页分区自动归类**（联动分区管理二级菜单，见下文） |
| **精选管理** | 从编辑页进入的子页面：查看当前编辑文章是否精选、一键设置/取消、精选列表管理（上限 6 篇，前端+后端双重校验） |
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
>
> ⚠️ Windows 上若启动报 `EACCES`，通常是端口落在 Hyper-V/WSL2 的保留范围内，换一个端口（如 `8899`）并更新 `ADMIN_PORT` 即可。

### 3. 启动

```bash
pnpm admin
```

打开 <http://127.0.0.1:8787>，输入密码登录。

### 4. 安全说明

请勿将管理后台直接暴露到公网。保持 `ADMIN_HOST=127.0.0.1`，或将其置于 HTTPS 反向代理之后并添加额外的访问控制层。

## 前端架构

前端为**原生 JavaScript（零框架、零构建）**，单页管理界面已从「单个 219KB 的 index.html 内联全部代码」重构为模块化：

```
admin/public/
├── index.html          # 骨架：各视图 HTML 结构（约 120 行）
├── css/admin.css       # 全部样式
└── js/                 # 25 个按功能拆分的脚本模块（按需 <script src> 顺序加载）
    ├── 00-core.js          # 基础工具（api/组件渲染/文章列表/数据中心核心）
    ├── 01-post-placement   # 首页分区控件（联动分区管理二级菜单 + 自动归类提示）
    ├── 02-editor           # 文章编辑器（分类/导入/上传/预览）
    ├── 03-albums … 06-workspace   # 相册/公告/个人资料/工作台
    ├── 07-featured         # 精选管理（子页面 + 编辑页快捷入口）
    ├── 08-diary…20-icon    # 日记/分类/字段分组/图标选择器 等
    ├── 21-stale-posts      # 待验证文章动态过期管理
    ├── 22-selects          # 自定义下拉增强
    ├── 23-sections         # 分区管理
    └── 24-convert          # 图片转 WebP / 音频转 MP3
```

- 模块间通过共享全局变量协作（`currentSlug`、`activeCollection`、`posts` 等），加载顺序即依赖顺序
- 后端为 Node 原生 `node:http`（无 Express），ESM 模块按 `routes / services / lib` 分层

## ✍️ 文章编辑与 PDF 导入

### Markdown 编辑

编辑文章页提供 **编辑 / 预览 / 分屏** 三种模式，支持：

- 拖入 `.md` 文件直接导入（自动解析 Frontmatter）
- 上传图片 / 封面（自动转 WebP）与 MP4/WebM 视频；预览区图片以缩略图显示、点击查看原图
- 拖入或点击 **导入 PDF**：PDF 课件自动转换为 Markdown 并**写入编辑框**，可继续编辑后手动保存，不会直接落盘

### 精选管理

首页精选上限 **6 篇**（与主站 `getFeaturedPosts` 一致），前端 + 后端双重校验：

- 编辑页勾选「首页精选」→ 下方显示当前精选 `n/6`、其他精选文章标题与「管理精选文章」入口
- 精选管理子页面：展示当前编辑文章（一键「将本文设为精选」）、精选列表（可取消，样式与正文一致）、「← 返回编辑」
- 满 6 篇时前端直接提示拦截，后端 `createPost` / `updatePost` 亦权威拒绝（400）

### 首页分区与自动归类

编辑页「首页分区」下拉的可选项与**分区管理的二级菜单**一一对应：按一级分区（技术资料 / 个人随笔 / 游戏记录 / 其他内容）以 `optgroup` 分组展示其下所有二级分类，选中任意二级菜单即同时写入文章的 `contentSection`（一级分区）与 `category`（二级分类）。分区管理保存后，编辑器可选项自动刷新。

下拉默认值为「自动归类（关键词匹配）」，编辑时实时给出归类建议（标题/标签/正文输入后防抖调用 `/api/posts/classify`），保存时后端权威执行：

1. **匹配一级分区**：按关键词权重从标题 / 标签 / 正文打分（标题 +4、标签 +3、正文 +1；分类名完整出现在标题 +6、与标签完全同名 +5；一级分区别名标题 +3 / 标签 +2 / 正文 +0.5），取得分最高的一级分区（总分 < 2 视为主题不明确，归入「其他内容」）。
2. **匹配已有二级分类**：在该分区内重复打分，分类得分 ≥ 4 即归入；优先保留用户显式填写的分类字段（未配置时按新分类处理）。
3. **没有匹配 → 新建二级分类**：提取候选名称（书名号《》内容 > 标题/标签中的拉丁术语，如 `Docker`、`SpringBoot`），关键词证据 ≥ 3 且名称合理时，在匹配的一级分区下**新建二级分类**——复用分区管理的集合写入管线（`writeCollection("sections")` → `src/data/sections.ts`），保存文章后随站点重新部署生效。

> 归类失败（如分区配置读取异常）不会阻断文章保存，文章按原字段落盘。

### PDF 课件转 Markdown

在编辑文章页点击「导入 PDF」或把 PDF 拖入编辑区，后台会：

1. 调用 `admin/lib/pdf2md.py`（Python + pdfplumber）提取文本
2. 自动识别标题层级、代码块、列表与表格
3. 为每个代码块**自动识别语言标签**（Java / C / Python / JavaScript / XML / YAML / SQL / JSON，纯文本归为 `txt`）
4. 将结果填入正文编辑框，标题为空时自动用文件名填充

```bash
pip install pdfplumber   # 本机需安装 Python 3 与 pdfplumber
```

转换中的 `Could not get FontBBox ...` 等字体警告属 pdfminer 的非致命输出，不会影响转换成功。单文件上限 50 MB。

## ☁️ 阿里云 OSS 媒体存储

文章图片/视频、项目/番剧/日记图、音乐等媒体默认上传到阿里云 OSS（`vercel.json` 已配置对应路径重定向）：

```dotenv
OSS_REGION=oss-cn-beijing
OSS_BUCKET=your-bucket-name
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
```

- 未配置 OSS 时，媒体上传接口会提示配置缺失
- 编辑器预览经 `/api/posts/{slug}/assets/...` **服务端代理**读取 OSS，本地与线上均可正常显示（绕开 OSS Referer 防盗链），且不暴露直链

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

后台使用 Node 内置测试运行器（`node:test`），覆盖文章序列化、精选上限、媒体转换、PDF 解码、存储安全、远程项目同步、前端模块化等：

```bash
cd admin
node --test test/*.test.mjs   # 63+ 个用例
```

关键测试文件：

| 文件 | 覆盖 |
|------|------|
| `posts.test.mjs` | 文章序列化、精选上限校验 |
| `classification.test.mjs` | 自动归类（两级匹配、新建分类、阈值） |
| `post-editor-controls.test.mjs` | 编辑器/数据中心前端功能断言 |
| `frontend-modules.test.mjs` | 模块化拆分完整性（无内联残留、资源存在、语法） |
| `frontend-load-order.test.mjs` | 按加载顺序执行全部 JS 模块，无顶层错误/TDZ |
| `featured-page.test.mjs` | 精选管理子页面结构 |
| `pdf-convert.test.mjs` | PDF 解码校验 |

## 📁 目录结构

```
admin/
├── public/               # 前端（单页 + 模块化资源）
│   ├── index.html
│   ├── css/admin.css
│   ├── js/               # 25 个功能模块
│   └── favicon.svg / png # 网站图标
├── lib/                  # 核心库：posts / storage / audio / oss / pdf2md.py
├── services/             # 业务服务：posts / media / library / deploy / pdf-convert ...
├── routes/               # HTTP 路由：index.mjs / static.mjs
├── test/                 # node:test 单元测试（53 个）
├── config.mjs            # 配置加载（.env.admin）
├── server.mjs            # 服务入口
└── README.md
```

## 常见问题

- **端口被占用 / 启动报 EACCES**：`ADMIN_PORT` 已在 `.env.admin` 配置；EACCES 多为 Hyper-V 保留端口，换端口即可。
- **PDF 导入报 Python 错误**：本机缺少 `python3` 或 `pdfplumber`，执行 `pip install pdfplumber` 后重试。
- **媒体上传失败**：检查 OSS 配置（`OSS_BUCKET` / `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`）。
- **图片预览不显示**：确认走 `/api/posts/{slug}/assets/...` 代理（已修复 OSS 直链被 Referer 拦截的问题）。
