# `workfiles/`：Blender 可编辑源文件

每件藏品的 `.blend`、原始贴图、参考图、烘焙文件和导出日志都应保留在：

```text
workfiles/<slug>/
```

此目录是创作源文件边界，不是网站部署边界。网站只接收 `incoming/<slug>/` 的 `<slug>.glb`、`preview.jpg` 和 `exhibit.json`；不要把 `.blend` 或工作纹理复制到 `public/`、`src/` 或构建产物中。这样既保留可编辑来源，也避免把大型中间文件误发布。
