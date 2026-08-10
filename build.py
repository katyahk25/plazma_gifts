import json
import re
from pathlib import Path

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

EACH_RE = re.compile(r"{{#each\s+([A-Za-z0-9_.@-]+)}}(.*?){{/each}}", re.S)
IF_RE = re.compile(r"{{#if\s+([A-Za-z0-9_.@-]+)}}(.*?){{/if}}", re.S)
VAR_RE = re.compile(r"{{\s*([A-Za-z0-9_.@-]+)\s*}}")


def resolve(context, path):
    value = context
    for part in path.split("."):
        if isinstance(value, dict) and part in value:
            value = value[part]
        else:
            return MISSING
    return value


def render(template, context):
    def render_each(match):
        items = resolve(context, match.group(1))
        if items is MISSING or not isinstance(items, list):
            return ""
        rendered = []
        for index, item in enumerate(items):
            child = dict(context)
            child["@index"] = index
            child["item"] = item
            if isinstance(item, dict):
                child.update(item)
            else:
                child["value"] = item
            rendered.append(render(match.group(2), child))
        return "".join(rendered)

    def render_if(match):
        value = resolve(context, match.group(1))
        return render(match.group(2), context) if value is not MISSING and value else ""

    previous = None
    while previous != template:
        previous = template
        template = EACH_RE.sub(render_each, template)
        template = IF_RE.sub(render_if, template)

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
    page_data = {}
    if page_data_path.exists():
        page_data = json.loads(page_data_path.read_text(encoding="utf-8"))

    context = {
        "site": site_data,
        "page": page_data,
    }

    content_template = (src / "pages" / page["source"]).read_text(encoding="utf-8")
    content = render(content_template, context)

    if not page_data:
        for key, value in page.get("vars", {}).items():
            content = content.replace("{{" + key + "}}", value)

    header_name = page.get("header", "default")
    if header_name not in header_templates:
        raise ValueError(f"Неизвестный вариант шапки: {header_name}")
    header = render(header_templates[header_name], context)

    seo = page_data.get("seo", {})
    title = seo.get("title", page["title"])
    description = seo.get("description", page["description"])

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
