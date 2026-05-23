# -*- coding: utf-8 -*-
"""
上海等级考 Docx 生成脚本
基于模板复制 + XML 直接构造的方式生成 .docx 文件

用法:
  python generate_docx.py <json_data_file> <output.docx>

JSON 数据结构:
{
  "subject": "化学",           # 物理 or 化学
  "title": "高三化学练习",      # 文档标题
  "subtitle": "高三教学资源包", # 副标题
  "instructions": [            # 考生注意（每条一个字符串）
    "本练习卷满分100分，练习时间60分钟。",
    "本资源包设练习卷和答题纸两部分。..."
  ],
  "molar_mass": "H－1  O－16  S－32  Cr－52  Fe－56  Ba－137",  # 化学专用
  "big_questions": [
    {
      "number": "一",          # 大题编号（一、二、三...）
      "scenario": "重铬酸钾是一种重要的化工原料...",  # 情景引入
      "sub_questions": [
        {
          "number": "1",
          "stem": "常温下，关于某含铬酸性废水的说法正确的是__________。",
          "type": "choice",    # choice / fill / calc / explain
          "indefinite": false, # 是否不定项
          "options": [
            "pH＞7",
            "溶液中不存在OH⁻",
            "一定能使甲基橙变红",
            "水的离子积Kw＝10⁻¹⁴"
          ],
          "answer": "C",
          "analysis": "酸性废水pH＜7..."  # 可选：解析
        },
        ...
      ]
    }
  ],
  "output_path": null  # 可选
}
"""

import zipfile
import os
import sys
import json
import shutil
import re

# ============ 路径配置 ============
SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_DIR = os.path.join(SKILL_ROOT, "assets", "template_unpacked")

# ============ XML 工具函数 ============
def esc(text):
    """XML 转义"""
    return (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace('"', "&quot;").replace("'", "&apos;"))

# Unicode ranges for chemical formulas
_SUPER_RANGE = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3',
    '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7',
    '⁸': '8', '⁹': '9',
    '⁺': '+', '⁻': '-', '⁼': '=',
    '⁽': '(', '⁾': ')',
}
_SUB_RANGE = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3',
    '₄': '4', '₅': '5', '₆': '6', '₇': '7',
    '₈': '8', '₉': '9',
    '₊': '+', '₋': '-', '₌': '=',
    '₍': '(', '₎': ')',
}
_SUPER_CHARS = set(_SUPER_RANGE.keys())
_SUB_CHARS = set(_SUB_RANGE.keys())
_ALL_CHEM_CHARS = _SUPER_CHARS | _SUB_CHARS

def _has_chem_unicode(text):
    for ch in text:
        if ch in _ALL_CHEM_CHARS:
            return True
    return False

def _chem_runs(text, font_east="宋体", sz=21, szCs=None, bold=False,
               font_ascii="Times New Roman", font_hAnsi="Times New Roman", font_cs="Times New Roman"):
    """将含 Unicode 上下标的文本拆分为多个 OOXML runs"""
    if szCs is None:
        szCs = sz
    bold_attr = "<w:b/><w:bCs/>" if bold else ""
    runs = []
    i = 0
    buf = []
    state = None  # None=normal, 'super'=superscript, 'sub'=subscript

    def _flush():
        nonlocal buf, state
        if not buf:
            return
        text = ''.join(buf)
        va = ""
        if state == 'super':
            va = '<w:vertAlign w:val="superscript"/>'
        elif state == 'sub':
            va = '<w:vertAlign w:val="subscript"/>'
        runs.append(
            f'<w:r><w:rPr>'
            f'<w:rFonts w:ascii="{font_ascii}" w:hAnsi="{font_hAnsi}" '
            f'w:eastAsia="{font_east}" w:cs="{font_cs}" w:hint="eastAsia"/>'
            f'{bold_attr}{va}'
            f'<w:sz w:val="{sz}"/><w:szCs w:val="{szCs}"/>'
            f'</w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r>')
        buf = []
        state = None

    while i < len(text):
        ch = text[i]
        if ch in _SUPER_CHARS:
            if state != 'super':
                _flush()
                state = 'super'
            buf.append(_SUPER_RANGE[ch])
        elif ch in _SUB_CHARS:
            if state != 'sub':
                _flush()
                state = 'sub'
            buf.append(_SUB_RANGE[ch])
        else:
            if state is not None:
                _flush()
                state = None
            buf.append(ch)
        i += 1
    _flush()
    return ''.join(runs)


def _rpr(font_east="宋体", sz=21, szCs=None, bold=False, font_ascii=None, font_hAnsi=None, font_cs=None):
    """生成 <w:rPr> 运行属性 — 英文默认 Times New Roman"""
    if szCs is None:
        szCs = sz
    if font_ascii is None:
        font_ascii = "Times New Roman"
    if font_hAnsi is None:
        font_hAnsi = font_ascii
    if font_cs is None:
        font_cs = font_ascii

    b = "<w:b/><w:bCs/>" if bold else ""
    return (f'<w:rFonts w:ascii="{font_ascii}" w:hAnsi="{font_hAnsi}" '
            f'w:eastAsia="{font_east}" w:cs="{font_cs}" w:hint="eastAsia"/>'
            f'{b}<w:sz w:val="{sz}"/><w:szCs w:val="{szCs}"/>')

def _run(text, font_east="宋体", sz=21, szCs=None, bold=False, font_ascii=None, font_hAnsi=None, font_cs=None, vertAlign=None, hint=True):
    """生成 <w:r> 运行 — 英文默认 Times New Roman，自动处理化学上下标"""
    if szCs is None:
        szCs = sz
    if font_ascii is None:
        font_ascii = "Times New Roman"
    if font_hAnsi is None:
        font_hAnsi = font_ascii
    if font_cs is None:
        font_cs = font_ascii

    # 自动拆分 Unicode 上下标为 OOXML vertAlign runs
    if vertAlign is None and _has_chem_unicode(text):
        return _chem_runs(text, font_east, sz, szCs, bold, font_ascii, font_hAnsi, font_cs)

    hint_attr = ' w:hint="eastAsia"' if hint else ""
    bold_attr = "<w:b/><w:bCs/>" if bold else ""
    va = f'<w:vertAlign w:val="{vertAlign}"/>' if vertAlign else ""
    return (f'<w:r><w:rPr>'
            f'<w:rFonts w:ascii="{font_ascii}" w:hAnsi="{font_hAnsi}" '
            f'w:eastAsia="{font_east}" w:cs="{font_cs}"{hint_attr}/>'
            f'{bold_attr}{va}'
            f'<w:sz w:val="{sz}"/><w:szCs w:val="{szCs}"/>'
            f'</w:rPr><w:t xml:space="preserve">{esc(text)}</w:t></w:r>')

# ============ 段落生成函数 ============

def para_p(title, text_runs, spacing_line=360, jc="left", ind_first=None, ind_hanging=None, outline_lvl=None):
    """通用段落生成
    text_runs: [(text, {run_attrs}), ...] 或直接字符串
    如果是字符串，使用默认宋体 10.5pt
    """
    if isinstance(text_runs, str):
        text_runs = [(text_runs, {})]

    runs_xml = []
    for item in text_runs:
        if isinstance(item, str):
            runs_xml.append(_run(item))
        elif isinstance(item, dict):
            text_val = item["text"]
            attrs = {k: v for k, v in item.items() if k != "text"}
            runs_xml.append(_run(text_val, **attrs))
        else:
            t, attrs = item
            runs_xml.append(_run(t, **attrs))

    ind_xml = ""
    if ind_first is not None:
        ind_xml += f'<w:ind w:firstLine="{ind_first}"/>'
    if ind_hanging is not None:
        ind_xml += f'<w:ind w:hanging="{ind_hanging}"/>'

    ol_xml = f'<w:outlineLvl w:val="{outline_lvl}"/>' if outline_lvl is not None else ""

    return (f'<w:p>'
            f'<w:pPr><w:spacing w:line="{spacing_line}" w:lineRule="auto"/>'
            f'{ol_xml}'
            f'<w:jc w:val="{jc}"/>'
            f'{ind_xml}'
            f'</w:pPr>'
            f'{"".join(runs_xml)}'
            f'</w:p>')


def para_title(text):
    """考试标题 - 黑体 16pt 居中"""
    return para_p(text, [{"text": text, "font_east": "黑体", "sz": 32, "bold": False}],
                  spacing_line=360, jc="center")

def para_subtitle(text):
    """副标题(系列名称) - 黑体 16pt 居中（主标题上方）"""
    return para_p(text, [{"text": text, "font_east": "黑体", "sz": 32, "bold": False}],
                  spacing_line=360, jc="center")

def para_instructions_header():
    """考生注意标题 - 黑体 bold"""
    return para_p("考生注意：", [{"text": "考生注意：", "font_east": "黑体", "sz": 21, "bold": True}],
                  spacing_line=293, jc="left")

def para_instructions_item(num, text):
    """考生注意条目 - 黑体 首行缩进"""
    runs = [
        {"text": str(num), "font_east": "黑体", "sz": 21, "bold": False, "font_ascii": "Times New Roman", "font_cs": "Times New Roman"},
        {"text": text, "font_east": "黑体", "sz": 21, "bold": False},
    ]
    return para_p("", runs, spacing_line=293, jc="left", ind_first=420)

def para_molar_mass(text):
    """相对原子质量 - 黑体 首行缩进"""
    return para_p("", [
        {"text": "相对原子质量：", "font_east": "黑体", "sz": 21, "font_cs": "Times New Roman"},
        {"text": text, "font_east": "黑体", "sz": 21, "font_ascii": "Times New Roman", "font_cs": "Times New Roman"},
    ], spacing_line=293, jc="left", ind_first=420)

def para_section_header(text):
    """大题标题(一、xxx) - 黑体 14pt bold 居中"""
    return para_p(text, [{"text": text, "font_east": "黑体", "sz": 28, "bold": True}],
                  spacing_line=360, jc="center")

def para_scenario(text):
    """情景引入 - 楷体 10.5pt 首行缩进2字符(480)"""
    return para_p(text, [{"text": text, "font_east": "楷体", "sz": 21}],
                  spacing_line=293, jc="left", ind_first=480)

def para_sub_question_stem(num, text, indefinite=False):
    """小题题干 - 黑体 bold 悬挂缩进"""
    indef = "（不定项）" if indefinite else ""
    prefix = f"{num}．{indef}"
    runs = [
        {"text": prefix, "font_east": "黑体", "sz": 21, "bold": True, "font_ascii": "Times New Roman", "font_cs": "Times New Roman"},
        {"text": text, "font_east": "宋体", "sz": 21, "bold": False},
    ]
    return para_p("", runs, spacing_line=360, jc="left", ind_hanging=420)

def para_option(label, text):
    """单个选项 - A. xxx 格式"""
    runs = [
        {"text": f"{label}．", "font_east": "宋体", "sz": 21, "font_ascii": "Times New Roman", "font_cs": "Times New Roman"},
        {"text": text, "font_east": "宋体", "sz": 21},
    ]
    return para_p("", runs, spacing_line=360, jc="left")

def para_options_grid(options_dict):
    """选项网格 - 两行布局 A/B 一行, C/D 一行，用 tab 分隔对齐
    options_dict: {"A": "选项A文本", "B": "...", "C": "...", "D": "..."}
    模仿上海等级考格式：依赖默认制表位，w:tab 元素分隔
    """
    paras = []
    for labels in [["A", "B"], ["C", "D"]]:
        # 构建行内 runs：A．xxx <tab/> B．xxx
        runs_xml = []
        for label in labels:
            if label not in options_dict:
                continue
            opt_text = "%s．%s" % (label, options_dict[label])
            if label == labels[0]:
                runs_xml.append(_run(opt_text, font_east="宋体", sz=21))
                runs_xml.append('<w:tab/>')
            else:
                runs_xml.append(_run(opt_text, font_east="宋体", sz=21))

        if not runs_xml:
            continue

        paras.append(
            '<w:p>'
            '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>'
            '%s'
            '</w:p>' % ''.join(runs_xml))

    return "\n".join(paras)

def para_fill_blank(hint="______"):
    """填空题的空行"""
    return para_p(hint, [{"text": hint, "font_east": "宋体", "sz": 21}],
                  spacing_line=360, jc="left")

def para_body(text):
    """正文 - 宋体 10.5pt 首行缩进"""
    return para_p(text, [{"text": text, "font_east": "宋体", "sz": 21}],
                  spacing_line=293, jc="left", ind_first=480)

def para_centered(text, bold=False):
    """居中文本"""
    return para_p(text, [{"text": text, "font_east": "宋体", "sz": 21, "bold": bold}],
                  spacing_line=360, jc="center")

def para_empty():
    """空行"""
    return (f'<w:p>'
            f'<w:pPr><w:spacing w:line="360" w:lineRule="auto"/>'
            f'</w:pPr>'
            f'</w:p>')


# ============ 流程图绘制（Word 原生形状） ============

# Word DrawingML namespace constants
DML_NS = {
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'wp14': 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing',
}

# Standard colors for flowchart
FC_BOX_FILL = "4472C4"     # 蓝色填充
FC_BOX_BORDER = "2F5496"   # 深蓝边框
FC_TEXT = "FFFFFF"          # 白色文字
FC_ARROW = "595959"         # 灰色箭头
FC_GREEN = "70AD47"         # 绿色（可选变体）

def _emu(cm_val):
    """cm 转 EMU (English Metric Units)"""
    return int(cm_val * 360000)

def _drawing_rect_shape(cx_cm, cy_cm, x_cm, y_cm, fill_color, border_color, shape_id):
    """生成单个矩形形状的 XML"""
    cx = _emu(cx_cm)
    cy = _emu(cy_cm)
    x = _emu(x_cm)
    y = _emu(y_cm)
    return f'''<w:r>
<w:rPr><w:noProof/></w:rPr>
<w:drawing>
<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0"
  relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
  <wp:simplePos x="0" y="0"/>
  <wp:positionH relativeFrom="column"><wp:posOffset>{x}</wp:posOffset></wp:positionH>
  <wp:positionV relativeFrom="paragraph"><wp:posOffset>{y}</wp:posOffset></wp:positionV>
  <wp:extent cx="{cx}" cy="{cy}"/>
  <wp:effectExtent l="0" t="0" r="0" b="0"/>
  <wp:wrapNone/>
  <wp:docPr id="{shape_id}" name="flowchart_box_{shape_id}"/>
  <wp:cNvGraphicFramePr/>
  <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
    <a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
      <wps:wsp>
        <wps:cNvSpPr><a:spLocks noChangeArrowheads="1"/></wps:cNvSpPr>
        <wps:spPr>
          <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="{fill_color}"/></a:solidFill>
          <a:ln w="9525"><a:solidFill><a:srgbClr val="{border_color}"/></a:solidFill></a:ln>
        </wps:spPr>
        <wps:txbx>
          <w:txbxContent>
            <w:p>
              <w:pPr><w:jc w:val="center"/></w:pPr>
              <w:r><w:rPr><w:color w:val="{FC_TEXT}"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:rFonts w:eastAsia="宋体"/></w:rPr><w:t>[[TEXT_{shape_id}]]</w:t></w:r>
            </w:p>
          </w:txbxContent>
        </wps:txbx>
        <wps:bodyPr rot="0" vert="horz" wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720">
          <a:prstTxWarp prst="textNoShape"/></wps:bodyPr>
      </wps:wsp>
    </a:graphicData>
  </a:graphic>
</wp:anchor>
</w:drawing>
</w:r>'''

def para_flowchart(boxes, arrows, container_cx=16, container_cy=10):
    """生成流程图段落
    boxes: [{"id": 1, "text": "含铬废水", "x": 1, "y": 2, "w": 3, "h": 1.2}, ...]
    arrows: [{"from": 1, "to": 2, "label": "加Na2SO3"}, ...]

    坐标单位：cm，原点在左上角。
    在幕后用占位符替换和箭头绘制逻辑简化版：生成带背景的 DrawingML。
    """
    # 简化方案：流程图作为一组 DrawingML 形状嵌入在一个大段落后
    # 实际生成的段落中使用 wp:anchor 定位每个形状

    # 由于 Word 形状的文本替换较复杂，这里采用简化的 XML 字符串替换方式
    shape_xmls = []
    for box in boxes:
        bid = box["id"]
        shape_xmls.append(_drawing_rect_shape(
            box.get("w", 3.5),
            box.get("h", 1.2),
            box.get("x", 1),
            box.get("y", 2),
            box.get("fill", FC_BOX_FILL),
            box.get("border", FC_BOX_BORDER),
            bid
        ))

    # 箭头使用 VML 或简单的 DrawingML connector（简化处理：用文本箭头）
    arrow_desc = " → ".join([b["text"] for b in sorted(boxes, key=lambda x: x["id"])])

    # 把所有形状放入一个大的段落
    all_shapes = "\n".join(shape_xmls)

    # 替换占位文本
    for box in boxes:
        bid = box["id"]
        all_shapes = all_shapes.replace(f"[[TEXT_{bid}]]", esc(box["text"]))

    return (f'<w:p>'
            f'<w:pPr><w:spacing w:line="400" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>'
            f'{all_shapes}'
            f'</w:p>')

# ============ 图片占位符 ============

def para_image_placeholder(width_cm=14, height_cm=6, caption=""):
    """生成图片占位符（带边框的空白框 + 可选题注）
    教师拿到 docx 后手动插入实际图片替换此占位符。
    """
    cx = _emu(width_cm)
    cy = _emu(height_cm)
    placeholder_id = id(caption) % 100000 + 50000

    drawing_xml = f'''<w:r>
<w:rPr><w:noProof/></w:rPr>
<w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0">
  <wp:extent cx="{cx}" cy="{cy}"/>
  <wp:effectExtent l="0" t="0" r="0" b="0"/>
  <wp:docPr id="{placeholder_id}" name="placeholder_image" descr="{esc(caption)}"/>
  <wp:cNvGraphicFramePr>
    <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
  </wp:cNvGraphicFramePr>
  <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
    <a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
      <wps:wsp>
        <wps:cNvSpPr><a:spLocks noChangeArrowheads="1"/></wps:cNvSpPr>
        <wps:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
          <a:ln w="19050">
            <a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill>
            <a:prstDash w:val="dash"/>
          </a:ln>
        </wps:spPr>
        <wps:txbx>
          <w:txbxContent>
            <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:line="320" w:lineRule="auto"/></w:pPr>
              <w:r><w:rPr><w:color w:val="808080"/><w:sz w:val="20"/><w:rFonts w:eastAsia="宋体"/></w:rPr>
                <w:t>[ 此处插入图片：{esc(caption)} ]</w:t></w:r></w:p>
          </w:txbxContent>
        </wps:txbx>
        <wps:bodyPr rot="0" vert="horz" wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720"/>
      </wps:wsp>
    </a:graphicData>
  </a:graphic>
</wp:inline>
</w:drawing>
</w:r>'''

    caption_xml = ""
    if caption:
        caption_xml = (f'<w:r><w:rPr><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/>'
                       f'<w:rFonts w:eastAsia="宋体"/></w:rPr>'
                       f'<w:t>图 {esc(caption)}</w:t></w:r>')

    return (f'<w:p>'
            f'<w:pPr><w:spacing w:line="320" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>'
            f'{drawing_xml}'
            f'</w:p>'
            f'<w:p>'
            f'<w:pPr><w:spacing w:line="280" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>'
            f'{caption_xml}'
            f'</w:p>')


# ============ 文档组装 ============

def build_document_xml(data):
    """根据 JSON 数据构建完整的 document.xml"""
    paras = []

    # ---- 标题区域 ----
    if data.get("subtitle"):
        paras.append(para_subtitle(data["subtitle"]))
    if data.get("title"):
        paras.append(para_title(data["title"]))
    paras.append(para_empty())

    # ---- 考生注意 ----
    paras.append(para_instructions_header())
    if data.get("instructions"):
        for i, instr in enumerate(data["instructions"], 1):
            # 处理加粗部分：用 **text** 标记
            paras.append(para_instructions_item(i, instr))
    paras.append(para_empty())

    # ---- 相对原子质量（化学专用） ----
    if data.get("molar_mass") and data.get("subject") == "化学":
        paras.append(para_molar_mass(data["molar_mass"]))
        paras.append(para_empty())

    # ---- 大题目 ----
    for bq in data.get("big_questions", []):
        # 大题标题
        header_text = bq.get("header", "")
        if not header_text and bq.get("number"):
            header_text = f'{bq["number"]}、{bq.get("topic", "综合题")}'
        if header_text:
            paras.append(para_section_header(header_text))

        # 情景引入
        scenario = bq.get("scenario", "")
        if scenario:
            if isinstance(scenario, str):
                scenario = [scenario]
            for s in scenario:
                paras.append(para_scenario(s))

        # 流程图（情景中可嵌入）
        flowchart = bq.get("flowchart")
        if flowchart:
            boxes = flowchart.get("boxes", [])
            arrows = flowchart.get("arrows", [])
            if boxes:
                paras.append(para_flowchart(boxes, arrows))

        # 图片占位符
        images = bq.get("images", [])
        for img in images:
            paras.append(para_image_placeholder(
                width_cm=img.get("width", 14),
                height_cm=img.get("height", 6),
                caption=img.get("caption", "")
            ))

        # 子题
        for sq in bq.get("sub_questions", []):
            q_type = sq.get("type", "choice")
            indefinite = sq.get("indefinite", False)

            paras.append(para_sub_question_stem(sq["number"], sq["stem"], indefinite))

            if q_type == "choice" and sq.get("options"):
                opts = sq["options"]
                if isinstance(opts, list):
                    labels = ["A", "B", "C", "D", "E", "F"]
                    opts_dict = {labels[i]: opts[i] for i in range(len(opts)) if i < len(labels)}
                else:
                    opts_dict = opts
                # 对4个选项使用网格布局
                if len(opts_dict) == 4:
                    paras.append(para_options_grid(opts_dict))
                else:
                    for label, text in opts_dict.items():
                        paras.append(para_option(label, text))

            elif q_type == "fill":
                pass  # 填空题空格已在 stem 中以 __________ 表示，不额外添加

            elif q_type in ("calc", "explain"):
                # 计算题或简答题，留空行
                for _ in range(sq.get("blank_lines", 3)):
                    paras.append(para_fill_blank(""))

        paras.append(para_empty())

    # ---- 组装 document.xml ----
    doc_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
 xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
 xmlns:v="urn:schemas-microsoft-com:vml"
 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
 xmlns:w10="urn:schemas-microsoft-com:office:word"
 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
 xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
 xmlns:wpsCustomData="http://www.wps.cn/officeDocument/2013/wpsCustomData"
 mc:Ignorable="w14 w15">
  <w:body>
''' + "\n".join(paras) + '''
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800" w:header="851" w:footer="992" w:gutter="0"/>
      <w:cols w:space="425"/>
      <w:docGrid w:type="lines" w:linePitch="312"/>
    </w:sectPr>
  </w:body>
</w:document>'''

    return doc_xml


def pack_docx(unpacked_dir, output_path):
    """将解包目录打包为 .docx"""
    if os.path.exists(output_path):
        os.remove(output_path)

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # mimetype 必须是第一个且不压缩
        mimetype_path = os.path.join(unpacked_dir, '[Content_Types].xml')
        if os.path.exists(mimetype_path):
            # Write mimetype first uncompressed
            zf.writestr('mimetype', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
                       compress_type=zipfile.ZIP_STORED)

        for root, dirs, files in os.walk(unpacked_dir):
            for fname in files:
                # skip mimetype if we handled it
                full_path = os.path.join(root, fname)
                arcname = os.path.relpath(full_path, unpacked_dir).replace('\\', '/')
                if arcname == 'mimetype':
                    continue
                # [Content_Types].xml must be at root
                if fname == '[Content_Types].xml':
                    arcname = '[Content_Types].xml'
                zf.write(full_path, arcname)


def generate(data, output_path):
    """主入口：从数据生成 docx
    data: dict 或 JSON 文件路径
    output_path: 输出 .docx 路径
    """
    if isinstance(data, str):
        with open(data, 'r', encoding='utf-8') as f:
            data = json.load(f)

    # 复制模板到临时目录
    import tempfile
    tmp_dir = tempfile.mkdtemp(prefix='grade_exam_')
    shutil.copytree(TEMPLATE_DIR, tmp_dir, dirs_exist_ok=True)

    # 生成 document.xml
    doc_xml = build_document_xml(data)
    doc_path = os.path.join(tmp_dir, 'word', 'document.xml')
    with open(doc_path, 'w', encoding='utf-8') as f:
        f.write(doc_xml)

    # 打包
    pack_docx(tmp_dir, output_path)

    # 清理
    shutil.rmtree(tmp_dir, ignore_errors=True)

    return output_path


# ============ SAMPLE_DATA ============
# 10 question cognitive progression: know -> understand -> apply -> integrate
SAMPLE_DATA = {
    'subject': '化学',
    'title': '高三化学练习',
    'subtitle': '高三教学资源包',
    'instructions': [
        '本练习卷满分100分，练习时间60分钟。',
        '本资源包设练习卷和答题纸两部分。答题前，务必在答题纸上填写学校、姓名、准考证号，并将核对后的条形码贴在指定位置上。作答必须涂或写在答题纸上，在练习卷上作答一律不得分。',
        '本练习卷标注“不定项”的选择题，每小题有1~2个正确选项，只有1个正确选项的，多选不给分，有2个正确选项的，漏选1个得一半分，错选不得分；未特别标注的选择题，每小题只有1个正确选项。'
    ],
    'molar_mass': 'H‐1  C‐12  N‐14  O‐16  Na‐23  S‐32  Cr‐52  Fe‐56  Ba‐137',
    'big_questions': [
        {
            'number': '一',
            'topic': '铬及其化合物的工业应用',
            'scenario': [
                '重铬酸钾（K₂Cr₂O₇）是一种重要的化工原料，广泛用于电镀、鞣革和有机合成。某电镀厂采用“化学还原沉淀法”处理含铬废水：向废水中加入Na₂SO₃将高毒性的六价铬还原为低毒的Cr(III)，再加碱使其形成Cr(OH)₃沉淀，经过滤、酸化、浓缩、重结晶，制得重铬酸钾产品。',
                '已知，六价铬在水溶液中存在以下平衡：2CrO₄²⁻＋2H⁺ ⇌ Cr₂O₇²⁻＋H₂O，其中Cr₂O₇²⁻（橙色）的氧化性强于CrO₄²⁻（黄色）。'
            ],
            'sub_questions': [
                {
                    'number': '1',
                    'stem': '重铬酸钾的化学式为__________，其中铬元素的化合价为__________。',
                    'type': 'fill',
                    'cog_level': '知道'
                },
                {
                    'number': '2',
                    'stem': '下列关于六价铬及其化合物的说法正确的是__________。',
                    'type': 'choice',
                    'cog_level': '理解',
                    'options': [
                        'CrO₄²⁻和Cr₂O₇²⁻中铬的化合价相同',
                        '酸性条件下CrO₄²⁻转化为Cr₂O₇²⁻属于氧化还原反应',
                        'Cr₂O₇²⁻的氧化性强于CrO₄²⁻是因为Cr的化合价更高',
                        '向含Cr₂O₇²⁻的溶液中加碱，溶液颜色由黄色变为橙色'
                    ]
                },
                {
                    'number': '3',
                    'stem': '在酸性条件下，Cr₂O₇²⁻中铬的价层电子排布式为__________；CrO₄²⁻的空间构型为__________，中心原子的杂化方式为__________。',
                    'type': 'fill',
                    'cog_level': '理解'
                },
                {
                    'number': '4',
                    'stem': '下列关于处理含铬废水的方案分析正确的有__________。',
                    'type': 'choice',
                    'indefinite': True,
                    'cog_level': '理解',
                    'options': [
                        '用Na₂SO₃还原Cr(VI)是利用其还原性',
                        '处理过程中应控制废水为强酸性以提高还原效率',
                        '将Cr(OH)₃沉淀过滤后的滤液可直接排放',
                        '重结晶操作利用了K₂Cr₂O₇在不同温度下溶解度的差异'
                    ]
                },
                {
                    'number': '5',
                    'stem': '根据六价铬在水溶液中的平衡，解释为何在不同pH条件下六价铬的主要存在形式不同，并结合平衡移动原理说明调节pH在含铬废水处理中的作用。',
                    'type': 'explain',
                    'cog_level': '理解'
                },
                {
                    'number': '6',
                    'stem': '某研究小组发现，用FeSO₄替代Na₂SO₃作为还原剂处理含铬废水，不仅降低了药剂成本，还原产物Fe(OH)₃还能与Cr(OH)₃共沉淀增强去除效果。请设计简单的实验方案，验证FeSO₄还原Cr(VI)的最佳pH范围。',
                    'type': 'explain',
                    'cog_level': '运用'
                },
                {
                    'number': '7',
                    'stem': '取某含铬废水25.00 mL，酸化后加入过量KI，析出的I₂用0.1000 mol/L的Na₂S₂O₃标准液滴定，消耗18.50 mL。若废水中铬全部以Cr(VI)计，计算该废水中铬的质量浓度（mg/L）。已知：Cr₂O₇²⁻＋6I⁻＋14H⁺ → 2Cr³⁺＋3I₂＋7H₂O，I₂＋2S₂O₃²⁻ → 2I⁻＋S₄O₆²⁻。',
                    'type': 'calc',
                    'cog_level': '综合'
                }
            ]
        }
    ]
}


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        data_file = sys.argv[1]
        output = sys.argv[2]
        generate(data_file, output)
        print(f"Docx generated: {output}")
    elif len(sys.argv) == 2 and sys.argv[1] == "--sample":
        # 生成示例文件用于测试
        out = os.path.join(os.path.dirname(__file__), "..", "sample_output.docx")
        generate(SAMPLE_DATA, out)
        print(f"Sample generated: {out}")
    else:
        print(f"Usage: python {sys.argv[0]} <data.json> <output.docx>")
        print(f"       python {sys.argv[0]} --sample  # Generate sample docx")
