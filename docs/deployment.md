# 部署与配置

项目以静态文件运行，构建输出目录为 `dist/`。仓库已包含 [Vercel 配置](../vercel.json)。

### Vercel（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FLittleSunX%2FWind-DevTools-&project-name=wind-devtools&repository-name=wind-devtools)

1. 点击上方 **Deploy** 按钮。
2. 登录 Vercel，按提示将项目保存到自己的 GitHub 仓库。
3. 确认框架为 **Vite**，构建命令为 `npm run build:production`，输出目录为 `dist`。
4. 点击 **Deploy**，等待构建完成即可访问。

如果要直接部署已有的仓库，可在 Vercel 中选择 **Add New → Project**，导入 `LittleSunX/Wind-DevTools-`。

正式部署使用 `npm run build` 或 `npm run build:production`。已提交的 `site.config.json` 默认使用 `https://wind-tools.ccwu.cc`，因此项目正式部署无需额外设置变量就会输出 canonical、双语 hreflang、sitemap 与允许收录的 robots。

部署到其他域名时，可修改 `site.config.json`，或设置 `SITE_URL`（例如 `https://tools.your-domain.com`）覆盖正式域名，然后重新构建。

`npm run build:preview` 明确强制禁收录：`robots.txt` 使用 `Disallow: /`，所有页面带 `noindex`，不生成 sitemap，即使本地继承了生产 `SITE_URL`。Vercel 的 `VERCEL_ENV=preview` 或 `development` 也强制采用预览策略。CI 使用 `build:preview`。其他托管平台的预览任务也应明确使用这一命令，正式任务使用默认 `npm run build`。

本地配置可复制 [.env.example](../.env.example) 为 `.env.production` 后填写；部署平台则直接设置同名环境变量。

### 其他静态托管平台

运行 `npm ci` 和 `npm run build:production`，上传 `dist/` 中的内容。主机需要支持目录下的 `index.html`，并将 `404.html` 作为状态码为 404 的错误页，避免将所有未知地址重写到首页。

### 可选：Umami 访问统计

统计默认关闭。要连接已有的 Umami 服务，请配置以下三个变量：

| 变量                      | 内容                                               |
| ------------------------- | -------------------------------------------------- |
| `VITE_UMAMI_WEBSITE_ID`   | Umami 中的网站 ID                                  |
| `VITE_UMAMI_SCRIPT_URL`   | Umami 的 HTTPS 统计脚本地址                        |
| `VITE_UMAMI_ALLOWED_HOST` | 允许统计的正式主机名，例如 `tools.your-domain.com` |

只有生产构建且访问主机名完全匹配时才加载统计脚本。配置变更后需要重新构建。`VITE_*` 变量会进入客户端代码，填写公开配置即可。

适配器使用 Umami 的 `data-before-send` 能力，需 Umami 2.18.0 或更高版本。参见 [Tracker configuration](https://docs.umami.is/docs/tracker-configuration)。

---

[返回项目首页](../README.md)
