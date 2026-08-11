import json
import os
import shutil
from pathlib import Path

PAGE_LABELS = {
    "index.html": "Главная",
    "gifts.html": "Подарки",
    "pens.html": "Ручки Parker",
    "notebooks.html": "Ежедневники",
    "mugs.html": "Кружки",
    "textile.html": "Текстиль",
    "canvases.html": "Холсты",
    "exlibris.html": "Экслибрисы",
    "gift-sets.html": "Подарочные наборы",
    "business.html": "Для бизнеса",
    "seals-stamps.html": "Печати и штампы",
    "logo-stamps.html": "Штампы с логотипом",
    "print-materials.html": "Баннеры, визитки, листовки",
    "portfolio.html": "Работы",
    "prices.html": "Цены",
    "delivery.html": "Доставка и оплата",
    "about.html": "О студии",
    "contacts.html": "Контакты",
}


def build_admin(src, public, data_dir, pages):
    source_admin = src / "admin"
    output_admin = public / "admin"
    page_data_dir = data_dir / "pages"

    if output_admin.exists():
        shutil.rmtree(output_admin)
    shutil.copytree(source_admin, output_admin)

    output_data = output_admin / "data"
    output_pages = output_data / "pages"
    output_pages.mkdir(parents=True, exist_ok=True)

    shutil.copy2(data_dir / "site.json", output_data / "site.json")

    manifest_pages = []
    for page in pages:
        output = page["output"]
        stem = Path(output).stem
        source_data = page_data_dir / f"{stem}.json"
        shutil.copy2(source_data, output_pages / f"{stem}.json")
        manifest_pages.append(
            {
                "label": PAGE_LABELS.get(output, output),
                "output": output,
                "stem": stem,
                "source_path": f"src/data/pages/{stem}.json",
                "data_url": f"data/pages/{stem}.json",
            }
        )

    manifest = {
        "branch": os.getenv("BRANCH", "feature/cms-admin-v1"),
        "site_source_path": "src/data/site.json",
        "site_data_url": "data/site.json",
        "pages": manifest_pages,
    }
    (output_data / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        "Готово: public/admin/ — визуальный редактор "
        f"(ветка: {manifest['branch']}, страниц: {len(manifest_pages)})"
    )
