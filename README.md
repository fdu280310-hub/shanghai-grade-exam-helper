# 上海等级考出题助手

将外地物理/化学题目一键转换为上海等级考风格的 Word 文档。

## 安装

```bash
npx skills add https://github.com/<user>/shanghai-grade-exam-helper
```

## 使用示例

拍照或截图一道外地题目，告诉 Claude：

> "这是北京卷的一道化学题，帮我改成上海等级考格式的大题。"

Claude 会识别题目 → 添加情景引入 → 调整题型编号 → 生成规范 .docx。

## 功能

- 自动识别题目内容（图片/PDF）
- 添加上海等级考标志性的"情景引入"
- 生成完全符合等级考排版规范的 .docx
- 支持 Word 原生形状绘制流程图
- 支持单选、不定项选择、填空、计算、简答混合编排
- 物理 + 化学双科目

## 系统要求

- Claude Code
- Python 3.8+（无需额外依赖，纯标准库）

## 字体

生成的 docx 使用宋体、黑体、Times New Roman —— Windows 中文系统自带，WPS/Word 均可正常打开。

## License

MIT
