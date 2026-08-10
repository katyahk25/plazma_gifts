import json
import os
import shutil
from pathlib import Path

REPOSITORY = "katyahk25/plazma_gifts"

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

FIELD_LABELS = {
    "seo": "SEO",
    "title": "Заголовок",
    "description": "Описание",
    "brand": "Бренд",
    "name": "Название",
    "category": "Типовые страницы категорий",
    "navigation": "Верхнее меню",
    "header": "Шапка сайта",
    "hero": "Первый экран",
    "visible": "Показывать блок",
    "kicker": "Надзаголовок",
    "heading": "Заголовок",
    "lead": "Описание",
    "text": "Текст",
    "label": "Надпись",
    "url": "Ссылка",
    "aria": "ARIA-подпись",
    "items": "Элементы",
    "image": "Изображение",
    "src": "Изображение",
    "image_alt": "ALT-текст изображения",
    "alt": "ALT-текст",
    "price": "Цена",
    "note": "Примечание",
    "note_title": "Заголовок примечания",
    "note_text": "Текст примечания",
    "primary": "Основная кнопка",
    "secondary": "Дополнительная кнопка",
    "primary_cta": "Основная кнопка",
    "secondary_cta": "Дополнительная кнопка",
    "cta": "Кнопка",
    "button": "Кнопка",
    "button_label": "Текст кнопки",
    "link_label": "Текст ссылки",
    "primary_action_label": "Основное действие",
    "secondary_action_label": "Дополнительное действие",
    "production_label": "Подпись срока",
    "production_text": "Текст о сроке",
    "delivery_label": "Подпись доставки",
    "delivery_text": "Текст о доставке",
    "about_overline": "Надзаголовок блока",
    "about_secondary_text": "Дополнительный текст",
    "offers_title": "Заголовок предложений",
    "offers_lead": "Описание предложений",
    "examples_title": "Заголовок примеров",
    "examples_lead": "Описание примеров",
    "request_overline": "Надзаголовок заявки",
    "request_title": "Заголовок заявки",
    "request_text": "Текст заявки",
    "request_button_label": "Текст кнопки заявки",
    "request_url": "Ссылка заявки",
    "home_label": "Название главной",
    "menu_label": "Подпись кнопки меню",
    "brand_url": "Ссылка логотипа",
    "brand_aria": "ARIA логотипа",
    "about": "О нас",
    "gifts": "Подарки",
    "business": "Для бизнеса",
    "standalone": "Одиночные пункты меню",
    "meta": "Короткие преимущества",
    "meta_aria": "ARIA блока преимуществ",
    "delivery": "Доставка",
    "mockup": "Макет",
    "orders": "Заказы",
    "directions": "Направления",
    "catalog": "Популярные заказы",
    "portfolio": "Примеры работ",
    "advantages": "Преимущества",
    "process": "Этапы заказа",
    "request": "Форма заявки",
    "faq": "Частые вопросы",
    "gallery": "Галерея",
    "summary": "Краткие карточки",
    "benefits": "Преимущества",
    "features": "Преимущества",
    "price_includes": "Что входит в стоимость",
    "constructor": "Конструктор гравировки",
    "delivery_info": "Доставка и сроки",
    "form": "Форма",
    "contacts": "Контакты",
    "cards": "Карточки",
    "steps": "Этапы",
    "tags": "Метки",
    "images": "Фотографии",
    "number": "Номер",
    "eyebrow": "Надзаголовок карточки",
    "title_line_1": "Заголовок — строка 1",
    "title_line_2": "Заголовок — строка 2",
    "line_1": "Строка 1",
    "line_2": "Строка 2",
    "line_4": "Строка 4",
    "accent": "Акцентное слово",
    "chip": "Метка технологии",
    "visual_label": "Текст визуальной карточки",
    "more_label": "Текст «Подробнее»",
    "hint": "Подсказка",
    "question": "Вопрос",
    "answer": "Ответ",
    "placeholder": "Подсказка в поле",
    "consent": "Согласие",
    "form_note": "Примечание к форме",
    "main": "Основной текст",
    "side": "Дополнительный текст",
}

TECHNICAL_FIELDS = {
    "class_name",
    "card_class",
    "active_class",
    "data_nav",
}

LONG_TEXT_FIELDS = {
    "description",
    "lead",
    "text",
    "note_text",
    "about_secondary_text",
    "offers_lead",
    "examples_lead",
    "request_text",
    "form_note",
    "answer",
    "placeholder",
}

IMAGE_FIELDS = {
    "image",
    "src",
    "hero_image",
    "background_image",
    "thumbnail",
}

SUMMARY_FIELDS = ("title", "label", "heading", "name", "question", "src", "text")


def human_label(name):
    if name in FIELD_LABELS:
        return FIELD_LABELS[name]
    return name.replace("_", " ").strip().capitalize()


def sample_for_key(items, key):
    for item in items:
        if isinstance(item, dict) and key in item:
            return item[key]
    return ""


def field_for_value(name, value, depth=0, required=None):
    label = human_label(name)
    config = {"label": label, "name": name}

    if required is None:
        required = value not in ("", None)

    if name in TECHNICAL_FIELDS:
        config.update({"widget": "hidden", "required": False})
        return config

    if isinstance(value, bool):
        config["widget"] = "boolean"
        return config

    if isinstance(value, dict):
        config.update(
            {
                "widget": "object",
                "collapsed": depth > 0,
                "fields": fields_for_dict(value, depth + 1),
            }
        )
        return config

    if isinstance(value, list):
        config.update(
            {
                "widget": "list",
                "collapsed": True,
                "allow_add": True,
                "allow_remove": True,
                "allow_reorder": True,
            }
        )
        if not value:
            config["field"] = {
                "label": "Элемент",
                "name": "value",
                "widget": "string",
                "required": False,
            }
            return config

        if all(isinstance(item, dict) for item in value):
            keys = []
            for item in value:
                for key in item:
                    if key not in keys:
                        keys.append(key)

            fields = []
            for key in keys:
                sample = sample_for_key(value, key)
                present_everywhere = all(
                    isinstance(item, dict)
                    and key in item
                    and item[key] not in ("", None)
                    for item in value
                )
                fields.append(
                    field_for_value(
                        key,
                        sample,
                        depth + 1,
                        required=present_everywhere,
                    )
                )
            config["fields"] = fields

            for summary_name in SUMMARY_FIELDS:
                if summary_name in keys:
                    config["summary"] = "{{fields." + summary_name + "}}"
                    break
            return config

        sample = value[0]
        item_widget = "number" if isinstance(sample, (int, float)) else "string"
        config["field"] = {
            "label": "Элемент",
            "name": "value",
            "widget": item_widget,
            "required": False,
        }
        return config

    if isinstance(value, (int, float)):
        config["widget"] = "number"
        return config

    if name in IMAGE_FIELDS or (
        isinstance(value, str)
        and value.startswith(("assets/images/", "/assets/images/"))
    ):
        config.update({"widget": "image", "required": required})
        return config

    if isinstance(value, str):
        if name in LONG_TEXT_FIELDS or len(value) > 100 or "\n" in value:
            config["widget"] = "text"
        else:
            config["widget"] = "string"
        config["required"] = required
        return config

    config.update({"widget": "string", "required": False})
    return config


def fields_for_dict(data, depth=0):
    return [
        field_for_value(name, value, depth)
        for name, value in data.items()
    ]


def page_entry(page, page_data_dir):
    output = page["output"]
    stem = Path(output).stem
    data = json.loads(
        (page_data_dir / f"{stem}.json").read_text(encoding="utf-8")
    )
    return {
        "label": PAGE_LABELS.get(output, output),
        "name": stem.replace("-", "_"),
        "file": f"src/data/pages/{stem}.json",
        "preview_path": output,
        "fields": fields_for_dict(data),
    }


def build_admin(src, public, data_dir, pages):
    source_admin = src / "admin"
    output_admin = public / "admin"

    if output_admin.exists():
        shutil.rmtree(output_admin)
    shutil.copytree(source_admin, output_admin)

    site_data = json.loads(
        (data_dir / "site.json").read_text(encoding="utf-8")
    )
    branch = os.getenv("BRANCH", "feature/cms-admin-v1")
    page_data_dir = data_dir / "pages"

    config = {
        "backend": {
            "name": "github",
            "repo": REPOSITORY,
            "branch": branch,
            "use_graphql": True,
        },
        "locale": "ru",
        "publish_mode": "simple",
        "media_folder": "public/assets/images/uploads",
        "public_folder": "assets/images/uploads",
        "show_preview_links": True,
        "collections": [
            {
                "label": "Общие настройки",
                "name": "site_settings",
                "format": "json",
                "files": [
                    {
                        "label": "Меню и общие тексты",
                        "name": "site",
                        "file": "src/data/site.json",
                        "preview_path": "index.html",
                        "fields": fields_for_dict(site_data),
                    }
                ],
            },
            {
                "label": "Страницы",
                "name": "pages",
                "format": "json",
                "files": [
                    page_entry(page, page_data_dir)
                    for page in pages
                ],
            },
        ],
    }

    config_path = output_admin / "config.yml"
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        "Готово: public/admin/ "
        f"(CMS branch: {branch}, страниц: {len(pages)})"
    )
