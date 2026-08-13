# Mizuki 管理后台

`Mizuki 管理后台` 是一个独立、密码保护的 Node 服务，用于编辑本静态 Astro 博客的 Markdown 源文件。博客前端保持静态，管理后台不会包含在 `dist` 构建产物中。

## 启动

1. 复制 `.env.admin.example` 为 `.env.admin`，设置一个强密码 `ADMIN_PASSWORD`。
2. 在 shell 中加载环境变量，然后启动服务：

```powershell
$env:ADMIN_PASSWORD = "使用一个长且唯一的密码短语"
pnpm admin
```

打开 `http://127.0.0.1:8787`。

## 部署

当设置了 `DEPLOY_HOOK_URL` 时，每次保存文章或设置会向该地址发送 POST 请求。可使用部署平台的构建钩子。未设置时，编辑内容仅写入本地仓库，需通过常规工作流提交并部署。

请勿将管理后台直接暴露到公网。保持 `ADMIN_HOST=127.0.0.1`，或将其置于 HTTPS 反向代理之后并添加额外的访问控制层。


## 图片自动转 WebP

所有图片上传（文章图片/封面、数据中心的项目图片、番剧封面、日记图片、音乐封面）都支持直接上传 **PNG、JPEG、GIF、WebP、TIFF、AVIF** 格式，后台会自动用 sharp 转成 WebP（质量 80）再保存，无需手动预先转换。

- 上传非 WebP 图片时，保存后的路径会自动变成 `.webp`。
- 「处理工具 → 转 WebP」仍保留，用于批量转换场景。
- 单个图片上限 30 MB。
## 管理功能

界面可管理站点标题、副标题、主题色相、横幅、评论、音乐播放器和分享图生成。同时支持完整文章元数据和 Markdown 内容编辑。高级 TypeScript 配置保留在 `src/config.ts` 中。

## 数据中心：从 GitHub / Gitee 自动拉取项目

「数据中心 → 项目」支持一键从你的 GitHub / Gitee 仓库自动拉取项目信息（名称、描述、语言/技术栈、仓库链接、创建日期等），不再需要逐条手工录入。

### 配置

在 `.env.admin`（或根目录 `.env.admin`）中设置：

```dotenv
# 至少配置一个用户名即可启用「从仓库拉取」
GITHUB_USERNAME=你的GitHub用户名
GITEE_USERNAME=你的Gitee用户名

# 可选：访问私有仓库或提高 API 限额时需要 Token
# GitHub: https://github.com/settings/tokens （需要 repo / public_repo 权限）
# GITEE_TOKEN: https://gitee.com/profile/personal_access_tokens （需要 projects 权限）
GITHUB_TOKEN=
GITEE_TOKEN=
```

### 使用方式

1. 进入「数据中心 → 项目」，点击「从仓库拉取」。
2. 在弹窗中勾选要导入的仓库，选择导入方式：
   - **仅新增**：只添加本地尚不存在的仓库，不修改已有项目。
   - **新增并更新**：为已有项目补全新字段，同时保留本地已填写的字段（如封面、分类、精选标记等）。
3. 点击「导入选中项目」：项目会写入 `src/data/projects.ts`，并像普通保存一样触发部署钩子（若已配置 `DEPLOY_HOOK_URL`）。

### 自动生成标签 / 技术栈 / 分类

导入时会根据仓库信息自动生成以下字段（可在导入弹窗中预览，导入后仍可在列表中修改）：

- **技术栈**：由仓库语言（Language）+ GitHub 主题标签（Topics）+ 名称/描述中识别出的技术关键词（如 Vue、React、Spring Boot、Flask、Docker、MySQL 等）组合而成。
- **标签**：由 GitHub Topics / Gitee 仓库标签 + 名称/描述中识别出的领域关键词（如 AI、无人机、数据、可视化、平台、开源等）组合而成，最多 8 个。
- **分类**：优先按仓库语言判断（web / mobile / desktop），无法判断时再按名称/描述关键词（如 移动端、桌面、平台、管理系统 等）推断，默认 `other`。

生成的标签与分类在保存后会同步写入 `admin/tag-library.json` 与 `admin/category-library.json`，编辑器中的自动补全选项会自动更新。

导入后仍可在列表中继续编辑每个项目的字段，再点击「保存集合」。