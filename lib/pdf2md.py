#!/usr/bin/env python3
"""PDF 课件 → Markdown 转换器
从课件类 PDF 提取文本，识别标题层级、代码块、列表与表格，输出 Markdown。
用法: python pdf2md.py input.pdf output.md
"""
import pdfplumber
import re
import sys
import os

# ---------- 字号 → 标题级别映射（各课件字号分布统一） ----------
# >=20   → #     文档标题
# 16-20  → ##    章标题
# 13.5-16→ ###   小节标题
# 11.5-13.5 → #### 三级标题
TITLE_MIN_SIZE = 11.5

# ---------- 文本清理 ----------
def clean_text(s):
    """修复 PDF 文本提取中的字符问题"""
    # fi 连字被提取为空字符
    s = s.replace("\x00nal", "final")
    s = s.replace("\x00", "fi")
    # 不换行空格 → 普通空格
    s = s.replace("\xa0", " ")
    # 压缩空白（代码缩进无法从 PDF 恢复，统一单空格）
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def heading_level(size):
    if size >= 20:
        return 1
    elif size >= 16:
        return 2
    elif size >= 13.5:
        return 3
    elif size >= 11.5:
        return 4
    return None

# ---------- 行聚类 ----------
def cluster_lines(chars, tolerance=4.0):
    """把字符按 top 坐标聚类成行，行内按 x0 排序拼接。"""
    lines = []
    for c in sorted(chars, key=lambda c: (c["top"], c["x0"])):
        if not lines or c["top"] - lines[-1]["top"] > tolerance:
            lines.append({"top": c["top"], "chars": [c]})
        else:
            lines[-1]["chars"].append(c)
    result = []
    for l in lines:
        cs = sorted(l["chars"], key=lambda c: c["x0"])
        text = "".join(c["text"] for c in cs)
        sizes = [round(c["size"], 1) for c in cs]
        mode_size = max(set(sizes), key=sizes.count)
        fonts = set(c["fontname"] for c in cs)
        n_os = sum(1 for c in cs if "Open Sans" in c["fontname"])
        result.append({
            "top": l["top"],
            "text": text,
            "size": mode_size,
            "fonts": fonts,
            "os_frac": n_os / len(cs) if cs else 0.0,
            "x0": min(c["x0"] for c in cs),
            "x1": max(c["x1"] for c in cs),
        })
    return result

# ---------- 代码行判定 ----------
CODE_FONTS = {"Open Sans"}  # 课件用 Open Sans 渲染代码

def is_code_line(line):
    """整行纯代码字体 → 代码行。
    代码行可能内嵌中文（//注释 或 字符串内的中文），此时 Open Sans 仍占多数。
    """
    t = line["text"].strip()
    if not t:
        return False
    if "Open Sans" not in line["fonts"]:
        return False
    if not re.search(r"[\u4e00-\u9fff]", t):
        return True
    # 含中文的代码行：需 Open Sans 参与渲染，且中文位于注释/字符串内
    if line["os_frac"] <= 0:
        return False
    if "//" in t or t.startswith("#") or t.startswith("*") or t.startswith("<!--"):
        return True
    if re.search(r'"[^"]*[\u4e00-\u9fff][^"]*"', t) or re.search(r"'[^']*[\u4e00-\u9fff][^']*'", t):
        return True
    return False

# ---------- 段落结束标点 ----------
SENT_END = set("。！？…")

def ends_sentence(t):
    t = t.strip()
    if not t:
        return True
    if t[-1] in SENT_END:
        return True
    # 句号/感叹号/问号后跟闭合引号或括号
    m = re.search(r"[。！？…][」》”’)\]]?$", t)
    return bool(m)

# ---------- 表格渲染 ----------
def render_markdown_table(table):
    """pdfplumber Table → Markdown 表格字符串；无效/伪表格返回 None"""
    data = table.extract()
    if not data:
        return None
    # 清理单元格
    rows = []
    max_cell_len = 0
    for row in data:
        cells = []
        for c in row:
            if c is None:
                cells.append("")
            else:
                c = clean_text(c)
                cells.append(c)
        rows.append(cells)
        max_cell_len = max(max_cell_len, *(len(c) for c in cells))
    # 过滤无效表格：单列 / 空行太多 / 表头全空
    ncols = max(len(r) for r in rows)
    if ncols < 2:
        return None
    header = rows[0]
    if all(not h for h in header):
        return None
    # 伪表格：单元格内含超长内容（多栏代码/段落被误检为表格）→ 放弃
    if max_cell_len > 80:
        return None
    # 填充不足列的单元格
    for r in rows:
        while len(r) < ncols:
            r.append("")
    lines = ["| " + " | ".join(header) + " |",
             "| " + " | ".join(["---"] * ncols) + " |"]
    for r in rows[1:]:
        lines.append("| " + " | ".join(r) + " |")
    return "\n".join(lines)

# ---------- 代码块语言自动识别 ----------
def detect_code_language(block):
    """根据代码块内容特征识别语言，返回 Markdown 围栏语言标签。

    课件中常见的代码类型：Java / C / Python / JavaScript / XML / YAML / SQL / JSON。
    无法识别的内容（提示文本、目录、ASCII 示意图等）统一归为 txt。
    """
    text = "\n".join(block)
    first = block[0].strip() if block else ""

    # ASCII 示意图（框线字符）
    box_chars = sum(1 for ch in text if ch in "┌┐└┘─│├┤┬┴┼◀▶")
    if box_chars >= 3:
        return "txt"

    # SQL
    if re.search(
        r"(CREATE\s+TABLE|DROP\s+TABLE|ALTER\s+TABLE|INSERT\s+INTO|"
        r"SELECT\s+\*?\s*FROM|UPDATE\s+\w+\s+SET|DELETE\s+FROM|"
        r"PRIMARY\s+KEY|FOREIGN\s+KEY|REFERENCES\s|AUTO_INCREMENT|"
        r"ENGINE\s*=\s*InnoDB|`\w+`\s+\w+\s*(NOT\s+NULL)?\s*(DEFAULT|COMMENT))",
        text,
        re.I,
    ):
        return "sql"

    # JSON：首行 { / [ 且含 "key": 结构
    stripped = text.lstrip()
    if (stripped.startswith("{") or stripped.startswith("[")) and re.search(
        r'"[^"\n]+"\s*:', text
    ):
        return "json"

    # Java：import / 注解 / 访问修饰符 / System.out / 泛型声明（先于 XML，避免 <String> 干扰）
    if re.search(
        r"\bimport\s+[\w.]+;|@\w+|public\s+(class|static|void|String|Long|int|boolean)\b|"
        r"private\s+(final\s+)?(String|Long|int|boolean|Map|List)\b|System\.out\.|"
        r"extends\s+\w+|implements\s+\w+|this\.\w+\s*=",
        text,
    ):
        return "java"

    # C / C++（#include / #define / printf / scanf / struct / int main / 指针/内存操作）
    if re.search(
        r"#\s*(?:include|define)\b|printf\s*\(|scanf\s*\(|^\s*struct\s+\w+\s*\{|"
        r"^\s*int\s+main\s*\(|malloc\s*\(|sizeof\s*\(|\bNULL\b",
        text,
        re.M,
    ):
        return "c"

    # JavaScript（含中文注释；识别 const/let/var/function/箭头函数/ES6 import）
    if re.search(
        r"\b(const|let|var|function)\b|=>|import\s+[\w{}*, ]+\s+from\s+['\"]",
        text,
    ):
        return "javascript"

    # Python（def / class: / import / from import / print / range / if __name__）
    if re.search(
        r"^\s*def\s+\w+\s*\(|^\s*class\s+\w+\s*:|^\s*(?:import|from)\s+[\w.]+|"
        r"^\s*if\s+__name__|print\s*\(|range\s*\(",
        text,
        re.M,
    ):
        return "python"

    # YAML：行内 "key:"（冒号后空格或行尾，树状结构），排除 "key:" 无空格值（如 username:"admin"）
    has_yaml = re.search(r"(?m)^\s*[\w.-]+\s*:\s", text) or re.search(
        r"(?m)^\s*[\w.-]+:\s*$", text
    )
    # properties：行内 "key = value"
    has_props = re.search(r"(?m)^\s*[\w.-]+\s*=\s*\S", text)
    if (has_yaml or has_props) and not re.search(
        r"(?<![-\w])(import|package|public|private|static|void|class)\b|@\w+|;\s*$|System\.out",
        text,
    ):
        return "properties" if has_props and not has_yaml else "yaml"

    # XML / HTML（尖括号标签，此时已排除 Java 泛型干扰）
    if "<" in text and ">" in text and re.search(r"<[a-zA-Z][\w:.-]*(?:\s[^>]*)?>", text):
        if re.search(r"<html\b|<body\b|<!DOCTYPE|<head\b", text, re.I):
            return "html"
        return "xml"

    # Shell / 命令行
    if re.search(r"^(curl|npm|cd|java\s+-jar|git|mvn|.\/)\b", first, re.M) and not re.search(
        r"[\u4e00-\u9fff]", text
    ):
        return "bash"

    # 默认：文本块
    return "txt"


# ---------- 主转换 ----------
def convert(pdf_path):
    out_lines = []  # 最终 markdown 行
    seen_h1 = False  # 只保留第一个 H1（文档标题），后续大字号标题降为 H2
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            # 表格区域（排除其中的字符，避免重复）
            tables = page.find_tables()
            table_md = []
            table_bboxes = []
            for tb in tables:
                md = render_markdown_table(tb)
                if md:
                    table_md.append(md)
                    table_bboxes.append(tb.bbox)
            in_table = lambda c: any(
                tb[0] - 2 <= c["x0"] <= tb[2] + 2 and tb[1] - 2 <= c["top"] <= tb[3] + 2
                for tb in table_bboxes
            )
            text_chars = [c for c in page.chars if not in_table(c)]
            lines = cluster_lines(text_chars, tolerance=4.0)
            lines.sort(key=lambda l: l["top"])

            # 在表格位置插入 markdown 表格
            md_by_top = {}
            for tb, md in zip(tables, table_md):
                md_by_top[round(tb.bbox[1])] = md

            i = 0
            while i < len(lines):
                line = lines[i]
                t = clean_text(line["text"])
                if not t:
                    i += 1
                    continue

                # 表格插入（按 top 顺序）
                for top in sorted(md_by_top):
                    if line["top"] >= top:
                        out_lines.append(md_by_top.pop(top))
                        out_lines.append("")

                # 标题
                lvl = heading_level(line["size"])
                if lvl:
                    j = i + 1
                    while j < len(lines):
                        nxt = lines[j]
                        if heading_level(nxt["size"]) == lvl and abs(nxt["top"] - line["top"]) < 8:
                            t += clean_text(nxt["text"])
                            j += 1
                        else:
                            break
                    if lvl == 1:
                        if seen_h1:
                            lvl = 2
                        else:
                            seen_h1 = True
                    out_lines.append("#" * lvl + " " + t)
                    i = j
                    continue

                # 代码行：收集连续代码行成块（空行保留在块内）
                if is_code_line(line):
                    code_block = []
                    while i < len(lines):
                        cur = lines[i]
                        ct = clean_text(cur["text"])
                        if is_code_line(cur):
                            code_block.append(ct)
                            i += 1
                        elif not ct:
                            # 空行：若后面仍为代码则作为块内空行，否则结束
                            if i + 1 < len(lines) and is_code_line(lines[i + 1]):
                                code_block.append("")
                                i += 1
                            else:
                                break
                        else:
                            break
                    while code_block and code_block[-1] == "":
                        code_block.pop()
                    if code_block:
                        out_lines.append("```" + detect_code_language(code_block))
                        out_lines.extend(code_block)
                        out_lines.append("```")
                        out_lines.append("")
                    continue

                # 正文/列表：收集段落
                para = [t]
                prev_end_top = line["top"]
                prev_x0 = line["x0"]
                i += 1
                while i < len(lines):
                    nxt = lines[i]
                    nt = clean_text(nxt["text"])
                    if not nt:
                        i += 1
                        continue
                    if heading_level(nxt["size"]):
                        break
                    if is_code_line(nxt):
                        break
                    # 视觉行内片段（top 接近且 x 有重叠/相接）→ 拼接
                    if abs(nxt["top"] - prev_end_top) < 2.5:
                        para[-1] += nt
                        prev_end_top = nxt["top"]
                        prev_x0 = min(prev_x0, nxt["x0"])
                        i += 1
                        continue
                    # 新一行：同一段落内换行 → 合并（去换行）
                    if not ends_sentence(para[-1]):
                        para[-1] += nt
                        prev_end_top = nxt["top"]
                        prev_x0 = min(prev_x0, nxt["x0"])
                        i += 1
                        continue
                    else:
                        break

                # 输出段落，识别列表
                for p in para:
                    m = re.match(r"^(\d+)[\.、]\s*(.*)$", p)
                    if m and len(p) < 200:
                        out_lines.append(f"{m.group(1)}. {m.group(2)}")
                    elif re.match(r"^[-•*]\s+", p):
                        out_lines.append(p)
                    else:
                        out_lines.append(p)
                out_lines.append("")

            # 页面末尾残留表格
            for top in sorted(md_by_top):
                out_lines.append(md_by_top[top])
                out_lines.append("")

    # 压缩连续空行
    md = "\n".join(out_lines)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip() + "\n"

def main():
    if len(sys.argv) < 3:
        print("用法: python pdf2md.py input.pdf output.md")
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    md = convert(src)
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"OK: {dst} ({len(md)} chars)")

if __name__ == "__main__":
    main()
