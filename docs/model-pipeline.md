# Blender → GLB 藏品导入合同

本项目使用单文件 GLB 作为模型发布格式。创作源文件始终在 `workfiles/<slug>/`，待验收的三件套始终在 `incoming/<slug>/`：`<slug>.glb`、`preview.jpg`（1600×1200 JPEG）和 `exhibit.json`。入口校验是只读的：

```bash
npm run models:validate -- incoming/<slug>
```

它会检查目录/命名/元数据、GLB v2 头与 JSON chunk、外部资源 URI、可统计的三角形、动画 clip 名、嵌入贴图维度、JPEG 预览和预算。它不导入、复制、压缩或改写资产。通过入口校验后，网站维护者仍需按既有内容流程将最终文件加入站点，并运行内容、资源和站点验证。

## 坐标、尺寸和展台

- **Blender 创作空间**使用原生 **Z-up**：地面为 `Z=0`，通常让角色自然正面朝 **-Y**，原点置于合理中心/脚底基准；所有对象应用 Rotation & Scale（`Ctrl+A`）。这是给 Blender 作者的规则，不能把 glTF 轴直接拿来建模。
- **导出空间**：导出 GLB 时勾选 Blender glTF exporter 的 **Y Up**，由 exporter 转为 glTF/Three 的 **+Y-up、+Z-forward、米制**。检查导出结果的最低点为 `Y=0`，而非 Blender 的 `Z=0`；不要依赖查看器临时旋转。
- 避免把相机、灯光和导出用的地面/背景一起打包。网站拥有自己的相机、灯光和胡桃木展台；提交前确认脚、底座或模型自身最低点在导出 GLB 中已落地。
- 网站会在 glTF/Three 的 Y 轴进行安全归一化：`ModelScene` 按相机可视空间缩放、居中，必要时转向，然后把最终包围盒 `min.y` 放在木质展台顶面。这不能纠正倒置轴向或错误朝向。

## 材质、贴图与 GLB

- 使用 **Principled BSDF**，并尽量仅使用可映射到 glTF PBR 的 Base Color、Metallic、Roughness、Normal、Occlusion 与 Emissive。程序节点、复杂混合器、体积、真实折射和 Blender 专属效果应烘焙或简化。
- Base Color 与 Emissive 贴图为 **sRGB**；Metallic、Roughness、Normal、Occlusion 及打包的 ORM 贴图为 **Non-Color/线性**。法线使用正确的 Normal Map 节点，不要把它当普通颜色图。
- 优先嵌入 PNG/JPEG（透明或锐利图形可用 PNG，照片/颜色烘焙可用高质量 JPEG）；KTX2 也可用。所有贴图必须经 GLB 的 BIN `bufferView` 打包；`buffers[*].uri` 与 `images[*].uri`（包括 data URI）均不允许，不能留下 `.gltf`、`.bin`、相对路径、HTTP URL 或旁挂贴图。
- 使用 glTF 2.0 导出为 **GLB**，启用材质、UV、法线、所需顶点色及需要的动画；导出后在独立 glTF 查看器检查。移除未使用材质、贴图、相机、灯光和中间对象。

## 性能预算与动画

| tier | 三角形上限 | GLB 文件上限 | 嵌入贴图最大边长 |
| --- | ---: | ---: | ---: |
| `standard` | 150,000 | 15 MiB | 2048 px（2K） |
| `hero` | 250,000 | 24 MiB 硬上限 | 4096 px（4K） |

`hero` 超过 15 MiB 会得到性能警告；超过 24 MiB 会失败。三角形统计以 GLB primitive 的索引或 POSITION accessor 为依据，无法安全统计即失败。TRIANGLE_STRIP/FAN 使用 `count - 2` 的 primitive-count **上界**（不会解析退化索引），因此对预算是保守值。优先减少三角形、合并材质/贴图图集、烘焙复杂节点、删掉不必要的高分辨率贴图，而不是事后依赖运行时修复。

静态模型完全合法，不需要动画。若有动画，所有 glTF animation clip 都必须有非空名称；推荐把静止/展示循环命名为 `Idle`，缺少它只会警告。网站不会因为模型带动画而强制自动播放：`exhibit.json.animation.mode` 可以是 `static`、`manual` 或在明确策展决定后使用 `autoplay`。

## 元数据、色板与预览

从 [`incoming/example/exhibit.json`](../incoming/example/exhibit.json) 开始。该 JSON 是 staging superset：`tier` 只供导入预算校验、不是当前 runtime `Exhibit` 字段；与此同时运行时所需的 `presentation.layout`、`scene`、`palette`、`lightingPresets` 都在入口强制齐全。必填文字包括 `slug`、编号、标题、摘要、描述、标签、`tier`、目标 `model`/`cover` 路径及完整 `presentation`。其中：

- `slug`、目录名、`<slug>.glb` 必须一致；`model` 必须是 `/models/<slug>.glb`，`cover` 必须是 `/covers/<slug>.jpg`。
- 色板固定为 `[shadow, primary, accent]` 三个六位 CSS hex 色值。可先从主材质/主要贴图提取建议色，再由策展者手工调整以保证展馆背景的可读性和艺术方向；网站不会在每次访问时从 GLB 像素自动取色。
- `preview.jpg` 是入口人工 QA 图，必须准确为 1600×1200。首页/馆藏卡的最终封面不使用这张图作为权威来源，而是模型落站后由 `npm run covers:capture` 从实际网站展台捕获。

## 工作区边界与交付

Blender 操作只写入 `workfiles/<slug>/` 和 `incoming/<slug>/`。不可改动网站源码、`public/`、`src/`、`package.json`、部署目录或其他藏品。提交前的最小交付清单：

1. `workfiles/<slug>/` 中保留可编辑 `.blend` 与必要源素材。
2. `incoming/<slug>/<slug>.glb` 为可独立加载的单文件 GLB。
3. `incoming/<slug>/preview.jpg` 为 1600×1200 JPEG。
4. `incoming/<slug>/exhibit.json` 与示例结构及文件命名一致。
5. 粘贴 `npm run models:validate -- incoming/<slug>` 的完整输出，记录任何 warning、三角形数、纹理信息和动画 clip。
