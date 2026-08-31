# `incoming/`：待导入的发布包

每件新藏品只在其自身目录中交付三个发布候选文件：

```text
incoming/<slug>/
├── <slug>.glb
├── preview.jpg
└── exhibit.json
```

`<slug>` 必须是小写字母、数字与连字符组成的 URL 安全名称，且目录名、GLB 文件名、`exhibit.json.slug` 必须完全一致。`preview.jpg` 必须为 **1600×1200 JPEG**，用于人工验收；它不是首页最终封面。最终首页封面必须在模型进入网站后由真实展台运行 `npm run covers:capture` 生成，保持模型、木质展台和展馆光照一致。

开始导入前运行：

```bash
npm run models:validate -- incoming/<slug>
```

校验器只读取文件，不会移动、压缩、重命名或修改任何资产。目录必须**恰好**只有这三个文件；`.blend`、`.bin`、贴图、旁挂 JSON 或任何 sidecar 都会失败。`VALID` 表示包符合入口合同；它不会自动把文件复制到 `public/`、更改 `src/content/exhibits.ts` 或发布网站。请把可编辑的 `.blend`、纹理原件、烘焙缓存和渲染工程保留在同名的 `workfiles/<slug>/`，不要放进此目录。

可从 [example/exhibit.json](example/exhibit.json) 复制元数据结构。这是明确的 **intake staging superset**：`tier` 是导入管线预算字段，当前运行时 `Exhibit` 类型不读取它；而 `presentation.layout`、`scene`、`palette`、`lightingPresets` 已按运行时字段要求在入口校验，后续策展导入不得丢失。`model` 和 `cover` 是网站落位后的目标路径，必须分别写作 `/models/<slug>.glb`、`/covers/<slug>.jpg`；`tier` 只能是 `standard` 或 `hero`，`presentation.palette` 必须恰为三个 `#RRGGBB` 色值。
