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

## 管理功能

界面可管理站点标题、副标题、主题色相、横幅、评论、音乐播放器和分享图生成。同时支持完整文章元数据和 Markdown 内容编辑。高级 TypeScript 配置保留在 `src/config.ts` 中。
