import json
from pathlib import Path

root = Path(__file__).resolve().parent
src = root / "src"
public = root / "public"
data_dir = src / "data"

layout = (src / "layout.html").read_text(encoding="utf-8")
footer = (src / "partials/footer.html").read_text(encoding="utf-8")
headers = {
    "default": (src / "partials/header.html").read_text(encoding="utf-8"),
    "pens": (src / "partials/header-pens.html").read_text(encoding="utf-8"),
}
pages = json.loads((data_dir / "pages.json").read_text(encoding="utf-8"))

public.mkdir(parents=True, exist_ok=True)

for page in pages:
    content = (src / "pages" / page["source"]).read_text(encoding="utf-8")
    header_name = page.get("header", "default")

    if header_name not in headers:
        raise ValueError(f"Неизвестный вариант шапки: {header_name}")

    html = (
        layout.replace("{{TITLE}}", page["title"])
        .replace("{{DESCRIPTION}}", page["description"])
        .replace("{{BODY_CLASS}}", page["body_class"])
        .replace("{{HEADER}}", headers[header_name])
        .replace("{{CONTENT}}", content)
        .replace("{{FOOTER}}", footer)
    )

    for key, value in page.get("vars", {}).items():
        html = html.replace("{{" + key + "}}", value)

    (public / page["output"]).write_text(html, encoding="utf-8")
    print(f"Готово: public/{page['output']}")
