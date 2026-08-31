# 电子手办收藏站

一个以静态站点形式发布的私人数字藏品展馆。首页使用封面图保持轻量，藏品实体页按需加载 GLB 三维模型，并提供可选声音、灯光、动画与分享能力。

> 本仓库只包含站点源码、示例内容与构建工具，**仓库本身没有被部署到任何线上地址**。发布者需要自行选择静态托管服务、配置真实域名并验证线上结果。

## 环境与安装

- Node.js `^20.19.0` 或 `>=22.12.0`
- npm
- Chromium（运行分享卡片生成和端到端测试时需要）

在仓库根目录安装锁定版本的依赖与 Playwright 浏览器：

```bash
npm ci
npx playwright install chromium
```

日常开发：

```bash
npm run dev
```

Vite 会在终端打印本地地址。开发模式额外开放仅供分享卡片捕获的内部路由；生产构建不会公开该路由。

## 验证与生产构建

提交内容前运行完整验证：

```bash
npm run verify
```

该命令依次运行单元测试、TypeScript 类型检查、使用 `https://gallery.example` 作为验证 origin 的生产构建，以及桌面 1440×900、移动 390×844 两个 Playwright 项目。构建阶段还会校验目录和资源、检查资源预算、生成实体直链页面并清理 AppleDouble 文件。

`npm run verify` 会用 `https://gallery.example` **重新生成并覆盖 `dist/`**。因此绝不能在 verify 后直接发布当前 `dist/`；所有检查通过后，必须再以真实生产 origin 执行下面的最终构建，并把该构建作为唯一待部署产物。

真正发布前必须用站点最终的 HTTPS origin 重新构建；不要把示例域名发布出去：

```bash
PUBLIC_ORIGIN=https://gallery.your-domain.example npm run build
```

`PUBLIC_ORIGIN` 应只包含协议、域名和可选端口，不要附带路径。构建结果在 `dist/`，其中每件藏品都有实体文件，例如：

```text
dist/exhibits/green-core/index.html
dist/exhibits/silent-observer/index.html
dist/exhibits/wilderness-messenger/index.html
```

这些 HTML 文件包含对应藏品的绝对 canonical、`og:url` 与 `og:image`。静态托管必须保留目录式 URL 和末尾斜杠，使 `/exhibits/<slug>/` 的直接访问、刷新及社交抓取都命中相应的 `index.html`。

## 分享卡片

生成全部藏品的 1200×630 PNG 分享卡片：

```bash
npm run share:cards
```

结果写入 `public/share/<slug>.png`。脚本使用任务自有的 4174 端口和临时 Chromium 配置，完成后会关闭浏览器、开发服务器并删除临时配置；它同时验证原生分享与剪贴板回退。生成后仍需运行 `npm run verify`。

分享卡片必须在生产构建之前生成，因为 `npm run build` 会把 `public/share/` 复制到 `dist/share/`，并把基于 `PUBLIC_ORIGIN` 的绝对图片 URL 写入实体页面的 OG 元数据。

## 新增一件藏品

按以下顺序操作，避免目录配置与实际文件脱节：

1. 选择 URL 安全且唯一的 `<slug>`，以及唯一的藏品编号。
2. 将模型复制到 `public/models/<slug>.glb`。本站内容契约只接受单文件 **GLB**；不要加入 `.gltf`、外部 `.bin` 或外链纹理依赖。
3. 将封面复制到 `public/covers/<slug>.jpg`（也可使用项目已支持的浏览器图片格式）。如需环境音，将最终音频复制到 `public/audio/<slug>-ambient.wav`；声音始终由访客主动开启。
4. 在 `src/content/exhibits.ts` 的 `exhibits` 数组中新增一个完整 `Exhibit`：填写 `slug`、`collectionNumber`、标题、摘要、描述、标签、封面、模型及 `presentation`；按需填写年份、工具、动画、音频、分享和署名字段。最多只能有一项 `featured: true`，灯光预设不能为空。
5. 在 `attribution` 中记录创作者、来源与许可证，并把面向发布者/访客的完整通知追加到 `public/THIRD_PARTY_NOTICES.txt`。`attribution` 字段会保存在目录数据中，但示例资产的正式 notices 以该文本文件为准。
6. 先运行内容与资源检查：

   ```bash
   npm run validate:content
   npm run check:assets
   ```

   内容校验会拒绝空白必填文字或标签、非 URL 安全的 slug、未知的场景/布局/灯光标识，以及外链、目录、查询字符串或包含路径穿越的资源路径。资源必须使用以 `/` 开头的站内路径并指向 `public/` 内的普通文件；模型路径还必须以 `.glb` 结尾。

7. 运行 `npm run share:cards`，确认生成 `public/share/<slug>.png`，并在该 Exhibit 的 `share.image` 中引用它。
8. 运行 `npm run verify`，先完成单元测试、类型检查、内容/资源检查、验证用生产构建和两个 E2E 项目。注意：该命令会用 `https://gallery.example` 覆盖 `dist/`，此时的 `dist/` **不得发布**。
9. 把真实 origin 的构建作为最后一个会写入发布产物的命令；不要在它之后再次运行 `npm run verify`：

   ```bash
   PUBLIC_ORIGIN=https://gallery.your-domain.example npm run build
   ```

10. 最后确认 `dist/exhibits/<slug>/index.html`、`dist/share/<slug>.png` 和实体 URL 的 canonical/OG 元数据都存在且指向真实生产域名，再上传此时的 `dist/`。

## 资源格式与预算

模型采用 GLB-only 规则。策展与优化时的**首选目标是每个 GLB 不超过 15 MB**；自动资源检查使用较宽松且单位不同的门槛，只有文件**超过 25 MiB** 时才警告。达到“没有警告”并不表示模型已经达到首选目标。

现有自动检查的警告阈值是：

| 资源 | 阈值 |
| --- | ---: |
| 每个 GLB 模型 | 25 MiB |
| 首页每张封面 | 300 KiB |
| 每张分享图片 | 1 MiB |
| 每个主题音轨或藏品环境音 | 3 MiB |

超出预算目前会输出警告而不是自动压缩或阻止构建；发布者仍应在上线前处理警告，并在真实移动网络上检查首屏与模型加载体验。

当前馆藏主题音频是用户提供的 `public/audio/merry-christmas-mr-lawrence.mp3`；`public/audio/fox-ambient.wav` 仍是用于验证环境音混合流程的演示音频。正式公开发布前，应确认两者的实际授权范围、署名、音量、循环接缝和体积；如替换文件，请保留引用路径或同步更新 `src/app/siteConfig.ts` / 对应展品配置。

示例 GLB 与封面的来源和许可证见 `public/THIRD_PARTY_NOTICES.txt`。新增或替换任何资产时，发布者负责核对实际授权范围；不要把目录中的简短署名当作完整法律通知。

## 静态托管要求

- 必须使用 HTTPS。原生分享、剪贴板等浏览器能力依赖安全上下文；上线后仍要在目标浏览器验证降级路径。
- 必须按原路径上传整个 `dist/`，包括每件藏品的实体 `index.html` 和三张（或当前目录数量对应的）分享 PNG。
- 必须支持目录索引，不要把所有未知路径一律改写为根 `index.html`，否则实体页面的 OG 元数据会丢失。
- 至少配置正确的响应类型：`.glb` 为 `model/gltf-binary`、`.wav` 为 `audio/wav`、`.png` 为 `image/png`、`.jpg`/`.jpeg` 为 `image/jpeg`，并保留 Vite 生成的 JS/CSS MIME 类型。
- 为 GLB、封面、音频和带内容指纹的静态资源配置合理缓存；更新未带指纹的公共资源时要考虑缓存失效。
- 发布后直接打开每个 `/exhibits/<slug>/`，检查 HTTPS、模型或可读回退、声音 opt-in、分享、canonical 与 OG 图片的绝对 URL。

## 站点名称与全局配置

站点名、描述和馆藏主题音轨集中在 `src/app/siteConfig.ts`。修改品牌名称或描述后需重新生成分享卡片并使用真实 `PUBLIC_ORIGIN` 重新构建，确保页面标题、页脚和 OG 元数据保持一致。

## English summary

This repository builds a static digital-figure gallery with physical exhibit routes and production-origin Open Graph metadata. It is not deployed by itself. Use HTTPS static hosting with directory indexes and correct GLB/audio MIME types, replace the generated demo audio before a real release, and run `npm run verify` plus a final build with the actual `PUBLIC_ORIGIN`.
