from pathlib import Path

root = Path(__file__).resolve().parent
src = root / "src"
public = root / "public"

layout = (src / "layout.html").read_text(encoding="utf-8")
header = (src / "partials/header.html").read_text(encoding="utf-8")
header_pens = (src / "partials/header-pens.html").read_text(encoding="utf-8")
footer = (src / "partials/footer.html").read_text(encoding="utf-8")

pages = [
    {
        "source": "index.html",
        "output": "index.html",
        "title": "ПЛАЗМА — индивидуальные подарки и печать с доставкой по России",
        "description": "Индивидуальные подарки, персонализация и печатная продукция с доставкой по России.",
        "body_class": "page-home",
    },
    {
        "source": "gifts.html",
        "output": "gifts.html",
        "title": "Индивидуальные подарки — ПЛАЗМА",
        "description": "Персональные ручки, ежедневники, кружки, холсты и текстиль с доставкой по России.",
        "body_class": "page-gifts",
    },
    {
        "source": "pens.html",
        "output": "pens.html",
        "title": "Ручки Parker Jotter с гравировкой — ПЛАЗМА",
        "description": "Parker Jotter с персональной гравировкой от 3 000 ₽. Макет, упаковка, изготовление за 1–2 рабочих дня и доставка по России.",
        "body_class": "page-pens",
    },
    {
        "source": "business.html",
        "output": "business.html",
        "title": "Продукция для бизнеса — ПЛАЗМА",
        "description": "Полиграфия, печати, штампы, баннеры и брендированная продукция с доставкой по России.",
        "body_class": "page-business",
    },
    {
        "source": "portfolio.html",
        "output": "portfolio.html",
        "title": "Работы ПЛАЗМЫ — примеры персонализации и печати",
        "description": "Примеры выполненных заказов: ручки, ежедневники, холсты и кружки.",
        "body_class": "page-portfolio",
    },
    {
        "source": "prices.html",
        "output": "prices.html",
        "title": "Цены — ПЛАЗМА",
        "description": "Ориентировочные цены на популярные изделия и индивидуальный расчёт заказа.",
        "body_class": "page-prices",
    },
    {
        "source": "delivery.html",
        "output": "delivery.html",
        "title": "Доставка и оплата — ПЛАЗМА",
        "description": "Изготовление на заказ и доставка продукции ПЛАЗМЫ по России.",
        "body_class": "page-delivery",
    },
    {
        "source": "about.html",
        "output": "about.html",
        "title": "О студии ПЛАЗМА",
        "description": "ПЛАЗМА — студия персонализации подарков и печатной продукции.",
        "body_class": "page-about",
    },
    {
        "source": "contacts.html",
        "output": "contacts.html",
        "title": "Контакты — ПЛАЗМА",
        "description": "Связаться с ПЛАЗМОЙ и отправить задачу на расчёт.",
        "body_class": "page-contacts",
    },
]

public.mkdir(parents=True, exist_ok=True)

for page in pages:
    content = (src / "pages" / page["source"]).read_text(encoding="utf-8")
    html = (
        layout.replace("{{TITLE}}", page["title"])
        .replace("{{DESCRIPTION}}", page["description"])
        .replace("{{BODY_CLASS}}", page["body_class"])
        .replace("{{HEADER}}", header_pens if page["body_class"] == "page-pens" else header)
        .replace("{{CONTENT}}", content)
        .replace("{{FOOTER}}", footer)
    )
    (public / page["output"]).write_text(html, encoding="utf-8")
    print(f"Готово: public/{page['output']}")
