#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全站媒体断链扫描工具

比对主站（Astro 博客）代码中的媒体引用与阿里云 OSS 实际对象，
找出：
  1. 断链：主站引用了但 OSS 上不存在的文件（图片会 404/损坏）
  2. 孤儿：OSS 上存在但主站已无引用的对象（可考虑清理）

用法（从项目根目录执行）：
  python3 admin/scripts/scan-media-refs.py            # 完整扫描
  python3 admin/scripts/scan-media-refs.py --orphans  # 只列孤儿

依赖：仅 Python 标准库（无需 pip 安装）。
"""
import argparse
import base64
import datetime
import glob
import hashlib
import hmac
import html
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

# 脚本位于 <root>/admin/scripts/scan-media-refs.py → 主站根为上两级
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
ENV_PATH = os.path.join(ROOT, ".env.admin")


def load_oss_env():
    env = {}
    try:
        for line in open(ENV_PATH, encoding="utf-8").read().split("\n"):
            m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
            if m and not m[2].startswith("#"):
                env[m[1]] = m[2].strip().strip('"')
    except FileNotFoundError:
        print(f"错误：找不到 {ENV_PATH}，请先在主站根目录配置。")
        sys.exit(1)
    missing = [
        k
        for k in ("OSS_BUCKET", "OSS_REGION", "OSS_ACCESS_KEY_ID", "OSS_ACCESS_KEY_SECRET")
        if not env.get(k)
    ]
    if missing:
        print(f"错误：.env.admin 缺少 OSS 配置：{', '.join(missing)}")
        sys.exit(1)
    return env


def oss_client(env):
    """返回 (host, sign) — 手写 OSS 签名，避免依赖 ali-oss SDK"""

    def sign(verb, date, resource):
        s = f"{verb}\n\n\n{date}\n{resource}"
        sig = base64.b64encode(
            hmac.new(
                env["OSS_ACCESS_KEY_SECRET"].encode(),
                s.encode(),
                hashlib.sha1,
            ).digest()
        ).decode()
        return f"OSS {env['OSS_ACCESS_KEY_ID']}:{sig}"

    host = f"{env['OSS_BUCKET']}.{env['OSS_REGION']}.aliyuncs.com"
    return host, sign


def list_objects(host, sign, bucket, prefix):
    """分页列出前缀下所有对象（XML 反转义处理 &amp; → &）"""
    keys = []
    marker = ""
    while True:
        query = f"?prefix={urllib.parse.quote(prefix)}&max-keys=1000"
        if marker:
            query += f"&marker={urllib.parse.quote(marker)}"
        date = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%a, %d %b %Y %H:%M:%S GMT"
        )
        req = urllib.request.Request(f"https://{host}/{query}")
        req.add_header("Date", date)
        req.add_header("Authorization", sign("GET", date, f"/{bucket}/"))
        try:
            xml = urllib.request.urlopen(req, timeout=20).read().decode()
        except urllib.error.HTTPError as e:
            print(f"  列出 {prefix} 失败: {e.code} {e.read().decode()[:200]}")
            break
        keys += [html.unescape(k) for k in re.findall(r"<Key>([^<]+)</Key>", xml)]
        if not re.search(r"<IsTruncated>true</IsTruncated>", xml):
            break
        nm = re.search(r"<NextMarker>([^<]*)</NextMarker>", xml)
        marker = nm.group(1) if nm else ""
    return keys


# ---------- 引用提取 ----------
OSS_BASE_PATTERN = r"https://[\w.-]+\.aliyuncs\.com"


def norm_reference(raw):
    """规范化：去 OSS 域名、去开头 /、URL 解码（%E3%80%90 → 【）"""
    s = raw.strip()
    s = re.sub(rf"^{OSS_BASE_PATTERN}", "", s)
    s = s.lstrip("/")
    return urllib.parse.unquote(s)


def collect_references():
    """收集主站所有媒体引用 → {oss_key: [来源...]}"""
    refs = {}

    def add(raw, source):
        key = norm_reference(raw)
        if key.startswith(("assets/", "post-assets/")):
            refs.setdefault(key, []).append(source)

    # 数据文件 src/data/*.ts
    for f in glob.glob(os.path.join(ROOT, "src/data/*.ts")):
        name = os.path.basename(f)
        for m in re.finditer(
            r'["\']((?:/assets|/post-assets|\.{1,2}/[\w\u4e00-\u9fff-]+\.assets)/[^"\']+)["\']',
            open(f, encoding="utf-8").read(),
        ):
            add(m.group(1), f"data/{name}")

    # 文章 src/content/posts/*.md
    for f in glob.glob(os.path.join(ROOT, "src/content/posts/*.md")):
        slug = os.path.basename(f)[:-3]
        src = open(f, encoding="utf-8").read()
        m = re.search(r'^image:\s*["\']?([^"\'\n]+)', src, re.M)
        if m:
            add(m.group(1).strip(), f"post {slug} [frontmatter]")
        for m in re.finditer(r'((?:src|href)="|!\[[^\]]*\]\()([^"\')]+)', src):
            u = m.group(2).strip()
            # 相对引用 ./X.assets/ 或 ./X_assets/ → post-assets/X(.|_)assets/（保留原有下划线/点）
            rel = re.match(r"^\.{1,2}/([\w\u4e00-\u9fff-]+[._]assets)/(.+)$", u)
            if rel:
                add(f"post-assets/{rel.group(1)}/{rel.group(2)}", f"post {slug} [正文]")
            elif u.startswith(("/assets/", "/post-assets/", "http")):
                add(u, f"post {slug} [正文]")

    # 站点配置 src/config.ts
    cfg = open(os.path.join(ROOT, "src/config.ts"), encoding="utf-8").read()
    for m in re.finditer(r'["\']((?:/assets|/post-assets)/[^"\']+)["\']', cfg):
        add(m.group(1), "src/config.ts")

    # 组件（含 .svelte：音乐播放器等）——注意 svelte 里常用无前导斜杠的相对路径 assets/xxx
    for f in glob.glob(os.path.join(ROOT, "src/components/**/*.*"), recursive=True):
        if not f.endswith((".svelte", ".astro", ".ts", ".js")):
            continue
        rel = os.path.relpath(f, ROOT).replace("\\", "/")
        src = open(f, encoding="utf-8").read()
        for m in re.finditer(
            r'["\']((?:/assets|/post-assets|\.\.?/[\w\u4e00-\u9fff-]+\.assets)/[^"\']+)["\']',
            src,
        ):
            add(m.group(1), rel)
        # 无前导斜杠的相对路径（如 assets/music/cover/xxx.jpg）
        for m in re.finditer(
            r'["\']((?<![\w/])assets/(?:music|anime|diary|images)/[^"\']+)["\']',
            src,
        ):
            add(m.group(1), rel)

    return refs


def main():
    parser = argparse.ArgumentParser(description="全站媒体断链扫描")
    parser.add_argument("--orphans", action="store_true", help="只列出孤儿对象")
    parser.add_argument("--missing", action="store_true", help="只列出断链")
    args = parser.parse_args()

    print(f"主站根目录: {ROOT}")
    env = load_oss_env()
    host, sign = oss_client(env)

    refs = collect_references()
    print(f"提取到 {len(refs)} 个唯一媒体引用")

    print("列出 OSS 对象（assets/ + post-assets/）...")
    oss_keys = set(
        list_objects(host, sign, env["OSS_BUCKET"], "assets/")
        + list_objects(host, sign, env["OSS_BUCKET"], "post-assets/")
    )
    print(f"OSS 对象: {len(oss_keys)} 个")

    missing = [(k, v) for k, v in sorted(refs.items()) if k not in oss_keys]
    orphans = sorted(oss_keys - set(refs))

    if not args.orphans or args.missing:
        print("\n" + "=" * 60)
        print(f"断链（主站引用但 OSS 不存在）: {len(missing)} 个")
        print("=" * 60)
        for key, sources in missing:
            print(f"  ✗ {key}")
            for s in sources[:3]:
                print(f"      ← {s}")

    if not args.missing or args.orphans:
        print("\n" + "=" * 60)
        print(f"孤儿（OSS 存在但主站未引用）: {len(orphans)} 个")
        print("=" * 60)
        for key in orphans:
            print(f"  ○ {key}")

    # 退出码：有断链时非零，便于 CI 使用
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
