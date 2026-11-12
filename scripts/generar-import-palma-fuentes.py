"""Genera un SQL repetible desde las fichas y las fotos verificadas del origen.

Uso: python scripts/generar-import-palma-fuentes.py [--verify-images]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "db/palma-fuentes-source.json"
IMAGES = ROOT / "db/import-palma-fuentes-images.json"
OUTPUT = ROOT / "db/import-palma-fuentes.sql"
STAGE = ROOT / ".wrangler/state"

EXAMPLE_SLUGS = (
    "departamento-providencia-pedro-de-valdivia",
    "departamento-nunoa-plaza-nunoa",
    "departamento-las-condes-el-golf",
    "casa-la-reina-principe-de-gales",
    "departamento-vitacura-arriendo",
    "departamento-providencia-manuel-montt-arriendo",
    "oficina-las-condes-isidora-goyenechea",
    "casa-lo-barnechea-la-dehesa",
)

COLUMNS = (
    "slug", "titulo", "tipo", "operacion", "comuna", "sector",
    "precio_valor", "precio_moneda", "precio_periodo", "dormitorios",
    "banos", "estacionamientos", "bodegas", "superficie_util",
    "superficie_total", "terreno", "piso", "orientacion", "anio",
    "gastos_comunes", "etiquetas", "resumen", "descripcion",
    "caracteristicas", "destacada", "publicada", "estado",
    "ilustracion_seed", "ilustracion_tono",
)


def sql(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def resumen(description: str, title: str) -> str:
    first_line = next((line.strip() for line in description.splitlines() if line.strip()), title)
    first_sentence = re.split(r"(?<=[.!?])\s+", first_line, maxsplit=1)[0]
    return (first_sentence or title)[:300]


def description_without_old_contact(description: str) -> str:
    # El aviso de la oficina termina con los datos de contacto de la marca anterior.
    lines = description.strip().splitlines()
    if "Corredora Palma Fuentes" in lines:
        lines = lines[: lines.index("Corredora Palma Fuentes")]
    return "\n".join(lines).strip()


def record(prop: dict, captured_at: str, featured: bool) -> tuple[object, ...]:
    source_id = prop["id"]
    kind = prop["type"].lower()
    operation = prop["operation"].lower()
    price = prop["price"]
    specs = prop["specs"]
    land = specs["landAreaM2"]
    built = specs["builtAreaM2"]
    if kind not in {"casa", "departamento", "oficina"}:
        raise ValueError(f"Tipo no soportado: {source_id}: {kind}")
    if operation not in {"venta", "arriendo"}:
        raise ValueError(f"Operación no soportada: {source_id}: {operation}")
    if price["currency"] not in {"UF", "CLP"} or not isinstance(price["amount"], int) or price["amount"] <= 0:
        raise ValueError(f"Precio no válido: {source_id}")
    description = description_without_old_contact(prop["description"] or "")
    features = list(dict.fromkeys(prop["amenities"] or []))
    if specs.get("privateRooms"):
        features.append(f"{specs['privateRooms']} privados")
    tags = []
    if source_id == "201760":
        tags.append("Varias tipologías")
    if source_id == "200819":
        tags.append("Estacionamiento adicional")

    return (
        f"{source_id}-{prop['slug']}",
        prop["title"][:160],
        kind,
        operation,
        prop["location"]["commune"],
        prop["location"].get("sector") or "",
        price["amount"],
        price["currency"],
        "mes" if operation == "arriendo" else None,
        specs["bedrooms"] or 0,
        specs["bathrooms"] or 0,
        specs["parking"] or 0,
        0,
        built or 0,
        (built if kind == "casa" else land) or 0,
        land if kind == "casa" else None,
        None,
        "",
        0,
        None,
        json.dumps(tags, ensure_ascii=False),
        resumen(description, prop["title"]),
        json.dumps([description] if description else [], ensure_ascii=False),
        json.dumps(features, ensure_ascii=False),
        featured,
        captured_at,
        "PUBLICADA",
        int(source_id) % 997,
        "dia",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-images", action="store_true")
    args = parser.parse_args()

    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    images = json.loads(IMAGES.read_text(encoding="utf-8"))
    properties = source["properties"]
    galleries = {item["sourceId"]: item for item in images["listings"]}
    ids = [prop["id"] for prop in properties]
    if len(properties) != 20 or len(set(ids)) != len(ids) or set(ids) != set(galleries):
        raise ValueError("Las 20 fichas y el manifiesto de fotos deben coincidir")
    if source["capturedAt"] != images["capturedAt"]:
        raise ValueError("Las capturas de fichas y fotos tienen fechas diferentes")

    statements = [
        "-- Inventario capturado de https://www.corredorapalmafuentes.cl/",
        f"-- Fecha de captura/publicación en Cota Clara: {source['capturedAt']}",
        "-- Requiere db/migrations/20261112_titulo.sql en bases existentes y fotos en R2.",
        "-- Es seguro repetirlo: conserva cambios posteriores hechos desde el panel.",
        "DELETE FROM propiedades WHERE slug IN (" + ", ".join(map(sql, EXAMPLE_SLUGS)) + ");",
    ]

    # La primera ficha del origen es la más reciente. Con la misma fecha de
    # importación, D1 ordena por ID descendente; por eso se inserta al revés.
    for index, prop in reversed(list(enumerate(properties))):
        values = record(prop, source["capturedAt"], index < 3)
        assert len(values) == len(COLUMNS)
        statements.append(
            "INSERT OR IGNORE INTO propiedades (" + ", ".join(COLUMNS) + ") VALUES ("
            + ", ".join(sql(value) for value in values) + ");"
        )

    photo_count = 0
    for prop in properties:
        gallery = galleries[prop["id"]]
        selected = gallery["images"]
        if gallery["sourceListingUrl"] != prop["sourceUrl"] or len(selected) != gallery["selectedCount"]:
            raise ValueError(f"Galería inconsistente: {prop['id']}")
        if len(selected) != gallery["galleryCount"] or len(selected) != len(prop["images"]):
            raise ValueError(f"Galería incompleta: {prop['id']}")
        for index, photo in enumerate(selected, start=1):
            if photo["index"] != index or photo["sourceUrl"] != prop["images"][index - 1]:
                raise ValueError(f"Orden de fotos inconsistente: {prop['id']}")
            key = photo["key"]
            if not re.fullmatch(rf"palma-fuentes/{prop['id']}/\d+-[0-9a-f]{{12}}\.(jpg|png|webp)", key):
                raise ValueError(f"Clave R2 no válida: {key}")
            if photo["status"] != "ok":
                raise ValueError(f"Foto no verificada: {key}")
            if args.verify_images:
                local = STAGE / key
                data = local.read_bytes()
                if len(data) != photo["bytes"] or hashlib.sha256(data).hexdigest() != photo["sha256"]:
                    raise ValueError(f"Foto local alterada: {key}")
            slug = f"{prop['id']}-{prop['slug']}"
            statements.append(
                "INSERT OR IGNORE INTO propiedad_fotos (propiedad_id, clave, alt, orden) "
                f"SELECT id, {sql(key)}, {sql('Foto ' + str(photo['index']) + ' de ' + prop['title'])}, "
                f"{sql(photo['index'])} FROM propiedades WHERE slug = {sql(slug)};"
            )
            photo_count += 1

    OUTPUT.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(f"Generado {OUTPUT.relative_to(ROOT)}: {len(properties)} propiedades, {photo_count} fotos")


if __name__ == "__main__":
    main()
