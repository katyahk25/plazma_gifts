import json
import re
from pathlib import Path

from cms_admin import build_admin

root = Path(__file__).resolve().parent
src = root / "src"
public = root / "public"
data_dir = src / "data"
page_data_dir = data_dir / "pages"

layout = (src / "layout.html").read_text(encoding="utf-8")
footer = (src / "partials/footer.html").read_text(encoding="utf-8")
header_templates = {
    "default": (src / "partials/header.html").read_text(encoding="utf-8"),
    "pens": (src / "partials/header-pens.html").read_text(encoding="utf-8"),
}
site_data = json.loads((data_dir / "site.json").read_text(encoding="utf-8"))
pages = json.loads((data_dir / "pages.json").read_text(encoding="utf-8"))

MISSING = object()

OPEN_BLOCK_RE = re.compile(r"{{#(each|if)\s+([A-Za-z0-9_.@-]+)}}")
BLOCK_TOKEN_RE = re.compile(
    r"{{#(?P<open_kind>each|if)\s+(?P<path>[A-Za-z0-9_.@-]+)}}"
    r"|{{/(?P<close_kind>each|if)}}"
)
VAR_RE = re.compile(r"{{\s*([A-Za-z0-9_.@-]+)\s*}}")


def resolve(context, path):
    value = context
    for part in path.split("."):
        if isinstance(value, dict) and part in value:
            value = value[part]
        else:
            return MISSING
    return value


def render_blocks(template, context):
    opening = OPEN_BLOCK_RE.search(template)
    if not opening:
        return template

    stack = [opening.group(1)]
    closing = None

    for token in BLOCK_TOKEN_RE.finditer(template, opening.end()):
        open_kind = token.group("open_kind")
        close_kind = token.group("close_kind")

        if open_kind:
            stack.append(open_kind)
            continue

        if not stack or stack[-1] != close_kind:
            raise ValueError(f"Некорректно закрыт шаблонный блок: {close_kind}")

        stack.pop()
        if not stack:
            closing = token
            break

    if closing is None:
        raise ValueError(f"Не закрыт шаблонный блок: {opening.group(1)} {opening.group(2)}")

    before = template[: opening.start()]
    inner = template[opening.end() : closing.start()]
    after = template[closing.end() :]
    block_type = opening.group(1)
    path = opening.group(2)
    value = resolve(context, path)

    if block_type == "each":
        if value is MISSING or not isinstance(value, list):
            rendered_block = ""
        else:
            rendered_items = []
            for index, item in enumerate(value):
                child = dict(context)
                if "@index" in context:
                    child["@parent_index"] = context["@index"]
                child["@index"] = index
                child["item"] = item
                if isinstance(item, dict):
                    child.update(item)
                else:
                    child["value"] = item
                rendered_items.append(render(inner, child))
            rendered_block = "".join(rendered_items)
    else:
        rendered_block = render(inner, context) if value is not MISSING and value else ""

    return render_blocks(before + rendered_block + after, context)


def render(template, context):
    template = render_blocks(template, context)

    def render_var(match):
        value = resolve(context, match.group(1))
        if value is MISSING:
            return match.group(0)
        if value is None:
            return ""
        if isinstance(value, (dict, list)):
            raise ValueError(f"Нельзя вывести составное значение напрямую: {match.group(1)}")
        return str(value)

    return VAR_RE.sub(render_var, template)


public.mkdir(parents=True, exist_ok=True)

for page in pages:
    output_stem = Path(page["output"]).stem
    page_data_path = page_data_dir / f"{output_stem}.json"

    if not page_data_path.exists():
        raise FileNotFoundError(f"Нет CMS-данных страницы: {page_data_path}")

    page_data = json.loads(page_data_path.read_text(encoding="utf-8"))
    seo = page_data.get("seo", {})
    title = seo.get("title")
    description = seo.get("description")

    if not title or not description:
        raise ValueError(f"Не заполнены SEO title/description для {page['output']}")

    context = {
        "site": site_data,
        "page": page_data,
    }

    content_template = (src / "pages" / page["source"]).read_text(encoding="utf-8")
    content = render(content_template, context)

    if "{{" in content or "}}" in content:
        raise ValueError(f"После сборки остались шаблонные переменные в {page['output']}")

    header_name = page.get("header", "default")
    if header_name not in header_templates:
        raise ValueError(f"Неизвестный вариант шапки: {header_name}")
    header = render(header_templates[header_name], context)

    html = (
        layout.replace("{{TITLE}}", title)
        .replace("{{DESCRIPTION}}", description)
        .replace("{{BODY_CLASS}}", page["body_class"])
        .replace("{{HEADER}}", header)
        .replace("{{CONTENT}}", content)
        .replace("{{FOOTER}}", footer)
    )

    (public / page["output"]).write_text(html, encoding="utf-8")
    print(f"Готово: public/{page['output']}")


build_admin(src=src, public=public, data_dir=data_dir, pages=pages)
