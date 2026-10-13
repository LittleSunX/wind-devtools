# 开发指南

### 技术栈

| 部分       | 实现                                              |
| ---------- | ------------------------------------------------- |
| 页面与类型 | React 19、TypeScript                              |
| 开发与构建 | Vite、静态 HTML 预渲染                            |
| 工具处理   | Web Worker、sql-formatter、cron-parser            |
| 代码画布   | Prism 语法高亮、DOM 编辑与 PNG / SVG 导出         |
| 国际化     | i18next、react-i18next、中英文 JSON 资源          |
| 验证       | Vitest、Playwright、ESLint、React Hooks、Prettier |

### 常用命令

| 命令                            | 用途                                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                   | 启动开发服务器                                                |
| `npm run build`                 | 类型检查、生产构建和静态预渲染                                |
| `npm run build:production`      | 正式站点构建，使用站点域名生成 canonical、hreflang 与 sitemap |
| `npm run build:preview`         | 强制禁收录的预览构建，忽略生产域名配置                        |
| `npm run test:diff`             | Diff 后台处理、取消、超时、结果失效与统一补丁验收             |
| `npm run preview`               | 启动生产预览，默认端口 4173                                   |
| `npm test`                      | 工具逻辑、代码高亮及统计白名单测试                            |
| `npm run test:build`            | 检查构建产物、canonical、sitemap 与预览收录策略               |
| `npm run test:browser`          | 现有文本工具、隐私、移动端、取消和超时验收                    |
| `npm run test:code-image`       | PNG 内容与尺寸、透明度、剪贴板和代码图片交互验收              |
| `npm run test:canvas-workbench` | 倍率超限恢复、SVG、设置键盘操作、移动布局与空结果验收         |
| `npm run format`                | 格式化源码与配置                                              |
| `npm run format:check`          | 检查代码格式                                                  |
| `npm run lint`                  | 检查 TypeScript 与 React Hooks 规则                           |

单元测试可直接运行。JSON 转类型的有效性测试会调用 `javac` 编译生成的 Java 源码；CI 安装 JDK 21，本机可将 `javac` 加入 PATH、设置 `JAVA_HOME`，或通过 `WIND_TEST_JAVAC` 指定编译器路径。未找到编译器时本机跳过两项 Java 编译测试，CI 则要求它们通过。构建检查需先执行 `npm run build`；浏览器验收还需要安装 Chrome，并保持 `npm run preview` 在另一个终端运行：

```sh
npm test
npm run lint
npm run test:build
npm run test:browser
npm run test:code-image
```

浏览器测试默认连接 `http://localhost:4173`，也可以传入地址：

```sh
npm run test:browser -- http://localhost:4173
npm run test:code-image -- http://localhost:4173
```

测试截图与导出样例写入 `artifacts/`，不纳入版本控制。README 展示图片位于 `docs/images/`。

### 项目结构

```text
src/
├── App.tsx                 路由选择与页面元信息
├── catalog.ts              工具名称、分类、描述和示例
├── components/AppLayout.tsx      顶栏、侧栏和页面外壳
├── components/ToolDirectory.tsx  工具目录与搜索
├── components/TextToolPage.tsx   文本工具页面与选项
├── components/useToolExecution.ts 处理线程、取消和超时
├── components/CodeImage.tsx      代码画布交互
├── components/useCanvasHighlight.ts 语法高亮线程
├── utils/                  独立工具逻辑、语法高亮与图片渲染
├── utils/shared.ts         各工具选项与 Worker 请求/响应类型
├── utils/canvas-readiness.ts 导出就绪判断
├── worker.ts               文本工具后台处理入口
├── code-image.worker.ts    代码高亮后台处理入口
└── analytics.ts            可选统计与载荷白名单
scripts/
├── prerender.ts            静态页面与 SEO 文件生成
├── preview.mjs             生产文件预览服务
├── build-check.mjs         构建产物检查
├── browser-check.mjs       文本工具浏览器验收
└── code-image-check.mjs    代码图片浏览器验收
tests/                      单元与回归测试
docs/images/                项目展示图片
```

新增工具时，将处理逻辑放入 `src/utils/`，在 `shared.ts` 定义工具选项和请求类型，再接入 `catalog.ts`、`TextToolPage.tsx`、`worker.ts` 与同步入口 `logic.ts`。补充针对边界输入的测试。处理模块保持本地运行，统计仅记录允许的事件字段。

JSON 转类型的回归测试会把生成的 TypeScript 交给 TypeScript 编译器、把 Java 类交给 `javac` 编译；对象数组必须合并所有样例字段，并把缺失字段标为可选。修改推断逻辑时运行 `npm test`，不能只比较输出文本。

### 自动化与浏览器覆盖

GitHub Actions 在 push 和 pull request 时执行格式、ESLint、单元测试、构建检查和浏览器回归。浏览器覆盖 Chromium、Firefox 与 WebKit，失败时上传测试截图、PNG 等产物。

本机运行跨浏览器验收：

```sh
npx playwright install chromium firefox webkit
npm run test:compat
```

先完成构建并启动预览服务。验收覆盖 Chromium、Firefox、WebKit 与 WebKit 触屏模拟，包括旧图保留但禁止导出、偏好隐私、语言菜单和 PNG 下载。WebKit 模拟不等同于真机 Safari，软键盘和系统剪贴板仍需真机验收。

原有浏览器脚本默认使用本机 Chrome；设置 `PW_CHANNEL=bundled` 可改用 Playwright 自带 Chromium，CI 使用此模式。

---

[返回项目首页](../README.md)

### 国际化

界面使用 `i18next` 与 `react-i18next`。配置位于 `src/i18n/index.ts`，翻译资源位于 `src/i18n/locales/zh.json` 和 `en.json`，React 组件通过 `useLocale()` 订阅语言变化，通过 `tr()` 读取文案。

目前采用中文原文作为资源键（关闭 keySeparator 和 nsSeparator），两份语言资源保持相同的键。新增或修改文案时同步更新资源；动态值使用 `{{name}}` 插值，数量使用 `{{count}}` 及语言对应的复数形式，不拼接句子。`tests/i18n.test.ts` 检查两种语言的键和插值变量是否一致。

新增语言：

1. 在 `src/i18n/locales/` 增加对应 JSON 文件，翻译现有资源键。
2. 在 `src/i18n/index.ts` 的 `resources` 中注册资源，并将语言代码和原生名称加入 `supportedLanguages`。
3. 为该语言补充资源检查与浏览器布局验收。默认回退语言为中文。

语言偏好保存在 `wind.language`。中文继续使用稳定地址 `/tools/...`，英文使用 `/en/tools/...`；URL 是页面语言的最终依据，语言切换会同步替换地址但不刷新页面，因此当前输入、处理结果和画布设置保持不变。访问站点根路径 `/` 时，如果没有显式语言路由，会按保存偏好和浏览器语言进入对应工具箱。

工具分类和风格预设保留稳定的内部值，在显示时翻译。不要翻译用户输入、代码、窗口标题或已有结果。Worker 接收当前界面语言，为新生成的说明性结果使用相应语言；错误通过原始资源键或 `MessageError` 的结构化插值数据返回，使已显示的错误也能随界面语言切换。

`npm run build` 和 `build:production` 同时预渲染中文与英文页面，使用 `site.config.json` 的正式域名（可由 `SITE_URL` 覆盖）生成 `canonical`、双向 `hreflang`、`x-default` 和双语 sitemap。`build:preview` 以及 Vercel 预览环境都禁收录：`robots.txt` 写入 `Disallow: /`、页面带 `noindex`，不生成 sitemap。CI 使用显式预览构建。客户端先按路由加载页面再 hydration；预渲染通过 Vite SSR 处理同样的路由模块，利用构建 manifest 为静态 HTML 注入对应的 CSS 与预加载链接。首次挂载完成前，静态 UI 保持可见并暂时禁用交互，防止输入或点击丢失；路由加载失败时提供重新加载入口。

运行 `npm run test:i18n` 验证语言 URL、偏好保存、切换时保留内容、错误与提示翻译、工具间传递、英文 404、移动端布局和存储不可用情形。该测试使用 Playwright 自带的 Chromium、Firefox、WebKit，需要先构建并启动预览。
