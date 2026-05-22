# 字体兼容性说明

## 模板使用的字体

| 字体名称 | Windows | macOS | Linux | 用途 |
|---------|---------|-------|-------|------|
| 黑体 (SimHei) | 系统自带 | 需安装 | 需安装 | 标题、大题标题 |
| 宋体 (SimSun) | 系统自带 | 需安装 | 需安装 | 正文 |
| Times New Roman | 系统自带 | 系统自带 | 系统自带 | 西文/数字 |

## 降级策略

### macOS

macOS 中文环境默认使用"苹方"(PingFang SC) 作为中文字体。
Word for Mac 在缺少宋体/黑体时会自动降级为苹方，排版效果略有差异但可接受。

如需最佳兼容，可安装：
- Office for Mac 自带的"宋体-简"/"黑体-简"
- 或通过字体册手动安装 SimSun.ttf / SimHei.ttf

### Linux

Linux 通常缺少 Windows 中文字体。建议安装：

```bash
# Ubuntu/Debian
sudo apt install fonts-wqy-zenhei fonts-wqy-microhei

# 或安装 Windows 字体（需有合法授权）
# 将 SimSun.ttf, SimHei.ttf 复制到 ~/.fonts/ 或 /usr/share/fonts/
```

降级效果：
- 宋体 → WenQuanYi Zen Hei 或 Noto Sans CJK SC
- 黑体 → WenQuanYi Micro Hei 或 Noto Sans CJK SC

## WPS 专用字体

原模板 .docx 是在 WPS 中创建的，包含了少量 WPS 专用样式名（如"华文楷体""华文中宋"）。
这些样式在 MS Word 中会自动降级为宋体，不影响基本排版。

## 推荐做法

1. **出卷用 Windows + WPS/Word**：字体最完整，效果最佳
2. **跨平台预览**：转为 PDF 查看，字体渲染完全独立于系统
3. **仅编辑文字**：在任何平台上修改文字内容，字体缺失通常只影响显示，不影响打印
