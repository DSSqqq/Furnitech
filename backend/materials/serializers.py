from decimal import Decimal
import json

from django.db import IntegrityError
from rest_framework import serializers

from .models import (
    CalculatorProfile,
    CalculatorProfileColor,
    CalculatorProfileType,
    CalculatorProfileTypeColor,
    Material,
    MaterialAlternativePrice,
    MaterialCategory,
    MaterialClass,
    MaterialOperationLine,
    MaterialRelatedItem,
    RoundingMode,
    UnitOfMeasure,
)


class MaterialClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialClass
        fields = ("id", "name", "code", "external_id", "last_synced_at")


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = ("id", "name", "short_name", "code", "external_id", "last_synced_at")


class MaterialSummarySerializer(serializers.ModelSerializer):
    """Краткие поля сопутствующего материала (для строк и pickers)."""

    uom = UnitOfMeasureSerializer(read_only=True)

    class Meta:
        model = Material
        fields = (
            "id",
            "name",
            "article",
            "uom",
            "base_price",
            "base_currency",
            "texture_mode",
            "texture_color",
            "texture_image",
        )


class MaterialCategorySerializer(serializers.ModelSerializer):
    path = serializers.ReadOnlyField()

    class Meta:
        model = MaterialCategory
        fields = (
            "id",
            "parent",
            "name",
            "code",
            "sort_order",
            "path",
            "external_id",
            "last_synced_at",
        )


def _as_decimal(x) -> Decimal:
    if x is None:
        return Decimal("0")
    if isinstance(x, Decimal):
        return x
    return Decimal(str(x).strip() or "0")


def _get_rounding_state(attrs, instance) -> tuple[str, object]:
    if instance is not None and "rounding_mode" not in attrs and instance:
        mode = instance.rounding_mode
    else:
        mode = attrs.get("rounding_mode", RoundingMode.NONE)
    if "rounding_multiple" in attrs:
        mult = attrs["rounding_multiple"]
    elif instance is not None:
        mult = instance.rounding_multiple
    else:
        mult = None
    return mode, mult


class JsonListField(serializers.ListField):
    """
    DRF в multipart/form-data отдаёт значения как строки.
    Для полей-списков (например material_class_ids) разрешаем JSON-строку: "[1,2,3]".
    """

    def to_internal_value(self, data):
        # multipart/form-data может дать либо строку, либо список из одной строки
        # (например ["[1,2]"] или ["[]"]).
        if isinstance(data, list) and len(data) == 1 and isinstance(data[0], str):
            data = data[0]
        if isinstance(data, str):
            t = data.strip()
            if t == "":
                data = []
            else:
                try:
                    data = json.loads(t)
                except Exception as e:  # noqa: BLE001
                    raise serializers.ValidationError("Ожидается JSON-массив.") from e
        return super().to_internal_value(data)


class MaterialSerializer(serializers.ModelSerializer):
    uom = UnitOfMeasureSerializer(read_only=True)
    uom_id = serializers.PrimaryKeyRelatedField(
        queryset=UnitOfMeasure.objects.all(), source="uom", write_only=True, required=True
    )
    material_class_ids = JsonListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Material
        fields = (
            "id",
            "category",
            "name",
            "article",
            "material_class_ids",
            "fnp_name",
            "uom",
            "uom_id",
            "unit_mass",
            "base_currency",
            "base_price",
            "note",
            "rounding_mode",
            "rounding_multiple",
            "is_active",
            "thickness",
            "max_length",
            "min_length",
            "max_width",
            "min_width",
            "designation",
            "cut_coeff",
            "calc_type",
            "texture_mode",
            "texture_color",
            "texture_image",
            "tex_offset_x",
            "tex_offset_y",
            "tex_step_x",
            "tex_step_y",
            "tex_opacity",
            "tex_mirror",
            "tex_specular_sharpness",
            "tex_specular_brightness",
            "tex_rotation_deg",
            "external_id",
            "last_synced_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uom", "created_at", "updated_at", "last_synced_at")

    def validate_article(self, value: str) -> str:
        v = (value or "").strip()
        if not v:
            return ""
        qs = Material.objects.filter(article=v)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "Материал с таким артикулом уже существует."
            )
        return v

    def to_representation(self, instance) -> dict:
        data = super().to_representation(instance)
        data["material_class_ids"] = [c.pk for c in instance.material_classes.all()]
        alts = instance.alternative_prices.all() if instance.pk else []
        data["alt_prices"] = [
            {"currency": x.currency, "price": str(x.price)} for x in alts
        ]
        data["related_items"] = self._serialize_related_items(instance)
        data["operation_lines"] = self._serialize_operation_lines(instance)
        return data

    @staticmethod
    def _serialize_related_items(instance: Material) -> list:
        if not instance.pk:
            return []
        out = []
        for x in instance.companion_items.all().select_related("related_material", "related_material__uom"):
            rel = x.related_material
            line_total = x.quantity * rel.base_price
            out.append(
                {
                    "id": x.id,
                    "related_material_id": rel.id,
                    "related_material": MaterialSummarySerializer(rel).data,
                    "quantity": str(x.quantity),
                    "line_total": str(line_total),
                }
            )
        return out

    @staticmethod
    def _serialize_operation_lines(instance: Material) -> list:
        if not instance.pk:
            return []
        out = []
        for x in instance.operation_lines.all().select_related("uom"):
            out.append(
                {
                    "id": x.id,
                    "name": x.name,
                    "model_parameter": x.model_parameter,
                    "quantity": str(x.quantity),
                    "uom_id": x.uom_id,
                    "uom": UnitOfMeasureSerializer(x.uom).data if x.uom_id else None,
                    "price": str(x.price),
                }
            )
        return out

    @staticmethod
    def _list_from_request_key(data: object, key: str) -> list | None:
        # JSON-тело и multipart/form-data (QueryDict / MultiValueDict): не только dict.
        if data is None or not hasattr(data, "__contains__") or key not in data:
            return None
        val = data.get(key) if hasattr(data, "get") else data[key]
        if val is None:
            return []
        if isinstance(val, list) and len(val) == 1 and isinstance(val[0], str):
            val = val[0]
        if isinstance(val, str):
            t = val.strip()
            if not t:
                return []
            try:
                val = json.loads(t)
            except Exception as e:  # noqa: BLE001
                raise serializers.ValidationError({key: "Ожидается JSON-массив."}) from e
        if not isinstance(val, list):
            raise serializers.ValidationError({key: "Ожидается массив."})
        return val

    def _replace_companion_items(self, material: Material, rows: list, parent_id: int) -> None:
        for row in rows:
            if not isinstance(row, dict):
                raise serializers.ValidationError({"related_items": "Каждая строка — объект."})
        material.companion_items.all().delete()
        for i, row in enumerate(rows):
            rid = row.get("related_material_id")
            if rid is None:
                raise serializers.ValidationError({"related_items": "Нужен related_material_id."})
            rid = int(rid)
            if rid == parent_id:
                raise serializers.ValidationError(
                    {"related_items": "Нельзя сослаться на тот же материал, что и карточка."}
                )
            qty = _as_decimal(row.get("quantity", "0"))
            if qty <= 0:
                raise serializers.ValidationError({"related_items": "Количество должно быть больше 0."})
            MaterialRelatedItem.objects.create(
                parent_id=parent_id,
                related_material_id=rid,
                quantity=qty,
                sort_order=i,
            )

    def _replace_operation_lines(self, material: Material, rows: list) -> None:
        for row in rows:
            if not isinstance(row, dict):
                raise serializers.ValidationError({"operation_lines": "Каждая строка — объект."})
        material.operation_lines.all().delete()
        for i, row in enumerate(rows):
            name = (row.get("name") or "").strip()
            if not name:
                raise serializers.ValidationError({"operation_lines": "Укажите название операции."})
            qty = _as_decimal(row.get("quantity", "1"))
            if qty < 0:
                raise serializers.ValidationError({"operation_lines": "Количество не может быть отрицательным."})
            price = _as_decimal(row.get("price", "0"))
            if price < 0:
                raise serializers.ValidationError({"operation_lines": "Цена не может быть отрицательной."})
            model_parameter = (row.get("model_parameter") or "").strip()
            uom_id = row.get("uom_id", None)
            kwargs: dict = {
                "material": material,
                "name": name,
                "model_parameter": model_parameter,
                "quantity": qty,
                "price": price,
                "sort_order": i,
            }
            if uom_id is not None and uom_id != "":
                kwargs["uom_id"] = int(uom_id)
            else:
                kwargs["uom_id"] = None
            MaterialOperationLine.objects.create(**kwargs)

    @staticmethod
    def _replace_alternative_prices(material, items) -> None:
        by_cur: dict[str, Decimal] = {}
        for it in items:
            c = str(it.get("currency", "")).upper().strip()[:3]
            if not c:
                raise serializers.ValidationError({"alt_prices": "У каждой строки должен быть код валюты."})
            if c == "KZT":
                raise serializers.ValidationError(
                    {"alt_prices": "Базовая валюта KZT задаётся отдельно, не в альтернативных."}
                )
            p = it.get("price", 0)
            d = p if isinstance(p, Decimal) else Decimal(str(p))
            if d < 0:
                raise serializers.ValidationError({"alt_prices": "Цена не может быть отрицательной."})
            by_cur[c] = d
        material.alternative_prices.all().delete()
        for c, d in by_cur.items():
            if d == 0:
                continue
            MaterialAlternativePrice.objects.create(material=material, currency=c, price=d)

    def _get_alt_prices_from_request(self) -> list | object | None:
        """None = в запросе нет ключа, не трогать. [] = сбросить. список = заменить."""
        data = self.initial_data
        if not isinstance(data, dict) or "alt_prices" not in data:
            return None
        ap = data["alt_prices"]
        if ap is None:
            return []
        if isinstance(ap, list) and len(ap) == 1 and isinstance(ap[0], str):
            ap = ap[0]
        if isinstance(ap, str):
            t = ap.strip()
            if not t:
                return []
            try:
                ap = json.loads(t)
            except Exception as e:  # noqa: BLE001
                raise serializers.ValidationError({"alt_prices": "Ожидается JSON-массив {currency, price}."}) from e
        if not isinstance(ap, list):
            raise serializers.ValidationError({"alt_prices": "Ожидается массив {currency, price}."})
        return ap

    def create(self, validated_data):
        m2m_ids = validated_data.pop("material_class_ids", None) or []
        ap = self._get_alt_prices_from_request()
        if ap is None:
            ap = []
        comp = self._list_from_request_key(self.initial_data, "related_items")
        ops = self._list_from_request_key(self.initial_data, "operation_lines")
        if comp is None:
            comp = []
        if ops is None:
            ops = []
        try:
            material = super().create(validated_data)
        except IntegrityError as e:
            if "article" in str(e).lower():
                raise serializers.ValidationError(
                    {"article": "Материал с таким артикулом уже существует."}
                ) from e
            raise
        if m2m_ids:
            ids = [int(x) for x in m2m_ids]
            qs = MaterialClass.objects.filter(pk__in=ids)
            if qs.count() != len(set(ids)):
                raise serializers.ValidationError({"material_class_ids": "Некоторые id классов не найдены."})
            material.material_classes.set(qs)
        self._replace_alternative_prices(material, ap)
        self._replace_companion_items(material, comp, material.id)
        self._replace_operation_lines(material, ops)
        return material

    def update(self, instance, validated_data):
        m2m_ids = validated_data.pop("material_class_ids", None)
        # Явный [] в PATCH должен снять M2M; в редких версиях DRF пустой список не попадал в validated_data
        if (
            m2m_ids is None
            and getattr(self, "partial", False)
            and isinstance(self.initial_data, dict)
            and "material_class_ids" in self.initial_data
            and self.initial_data["material_class_ids"] == []
        ):
            m2m_ids = []
        ap = self._get_alt_prices_from_request()
        try:
            material = super().update(instance, validated_data)
        except IntegrityError as e:
            if "article" in str(e).lower():
                raise serializers.ValidationError(
                    {"article": "Материал с таким артикулом уже существует."}
                ) from e
            raise
        if m2m_ids is not None:
            ids = [int(x) for x in m2m_ids]
            if not ids:
                material.material_classes.clear()
            else:
                qs = MaterialClass.objects.filter(pk__in=ids)
                if qs.count() != len(set(ids)):
                    raise serializers.ValidationError({"material_class_ids": "Некоторые id классов не найдены."})
                material.material_classes.set(qs)
        if ap is not None:
            self._replace_alternative_prices(material, ap)
        comp = self._list_from_request_key(self.initial_data, "related_items")
        if comp is not None:
            self._replace_companion_items(material, comp, material.id)
        ops = self._list_from_request_key(self.initial_data, "operation_lines")
        if ops is not None:
            self._replace_operation_lines(material, ops)
        return material

    def validate(self, attrs: dict) -> dict:
        instance = self.instance
        mode, mult = _get_rounding_state(attrs, instance)
        if mode == RoundingMode.CEIL_MULTIPLE:
            if mult is None:
                raise serializers.ValidationError(
                    {"rounding_multiple": "Укажите положительную кратность (число)."}
                )
            m = mult if isinstance(mult, Decimal) else Decimal(str(mult))
            if m <= 0:
                raise serializers.ValidationError(
                    {"rounding_multiple": "Кратность должна быть положительной."}
                )
        if mode in (RoundingMode.NONE, RoundingMode.CEIL_UNIT):
            attrs = {**attrs, "rounding_multiple": None}
        if "unit_mass" in attrs and attrs["unit_mass"] is None:
            attrs = {**attrs, "unit_mass": Decimal("0")}
        attrs = {**attrs, "base_currency": "KZT"}
        return attrs


class CalculatorProfileSerializer(serializers.ModelSerializer):
    material_summary = serializers.SerializerMethodField(read_only=True)
    colors = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CalculatorProfile
        fields = (
            "id",
            "material",
            "material_summary",
            "is_active",
            "sort_order",
            "colors",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "material_summary")

    def get_material_summary(self, obj: CalculatorProfile) -> dict | None:
        m = getattr(obj, "material", None)
        if not m:
            return None
        return MaterialSummarySerializer(m).data

    def get_colors(self, obj: CalculatorProfile) -> list:
        return self._serialize_colors(obj)

    @staticmethod
    def _serialize_colors(instance: CalculatorProfile) -> list:
        if not instance.pk:
            return []
        out = []
        for x in instance.colors.all().select_related("color_material", "color_material__uom"):
            out.append(
                {
                    "id": x.id,
                    "color_material_id": x.color_material_id,
                    "color_material": MaterialSummarySerializer(x.color_material).data,
                }
            )
        return out

    def _replace_colors(self, profile: CalculatorProfile, rows: list) -> None:
        for row in rows:
            if not isinstance(row, dict):
                raise serializers.ValidationError({"colors": "Каждая строка — объект."})
        profile.colors.all().delete()
        for i, row in enumerate(rows):
            mid = row.get("color_material_id")
            if mid is None or mid == "":
                raise serializers.ValidationError({"colors": "Нужен color_material_id."})
            CalculatorProfileColor.objects.create(
                profile=profile,
                color_material_id=int(mid),
                sort_order=i,
            )

    def create(self, validated_data):
        colors = MaterialSerializer._list_from_request_key(self.initial_data, "colors")
        if colors is None:
            colors = []
        try:
            profile = super().create(validated_data)
        except IntegrityError as e:
            if "material" in str(e).lower():
                raise serializers.ValidationError({"material": "Этот материал уже добавлен как профиль."}) from e
            raise
        self._replace_colors(profile, colors)
        return profile

    def update(self, instance, validated_data):
        colors = MaterialSerializer._list_from_request_key(self.initial_data, "colors")
        try:
            profile = super().update(instance, validated_data)
        except IntegrityError as e:
            if "material" in str(e).lower():
                raise serializers.ValidationError({"material": "Этот материал уже добавлен как профиль."}) from e
            raise
        if colors is not None:
            self._replace_colors(profile, colors)
        return profile


class CalculatorProfileTypeSerializer(serializers.ModelSerializer):
    colors = serializers.SerializerMethodField(read_only=True)
    card_image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = CalculatorProfileType
        fields = (
            "id",
            "name",
            "image_url",
            "card_image",
            "is_active",
            "sort_order",
            "colors",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_colors(self, obj: CalculatorProfileType) -> list:
        if not obj.pk:
            return []
        out = []
        for x in obj.colors.all().select_related("color_material", "color_material__uom"):
            out.append(
                {
                    "id": x.id,
                    "color_material_id": x.color_material_id,
                    "color_material": MaterialSummarySerializer(x.color_material).data,
                    "is_new": bool(x.is_new),
                    "is_hit": bool(x.is_hit),
                    "is_sale": bool(x.is_sale),
                }
            )
        return out

    def _replace_colors(self, profile_type: CalculatorProfileType, rows: list) -> None:
        for row in rows:
            if not isinstance(row, dict):
                raise serializers.ValidationError({"colors": "Каждая строка — объект."})
        profile_type.colors.all().delete()
        for i, row in enumerate(rows):
            mid = row.get("color_material_id")
            if mid is None or mid == "":
                raise serializers.ValidationError({"colors": "Нужен color_material_id."})
            CalculatorProfileTypeColor.objects.create(
                profile_type=profile_type,
                color_material_id=int(mid),
                sort_order=i,
                is_new=bool(row.get("is_new", False)),
                is_hit=bool(row.get("is_hit", False)),
                is_sale=bool(row.get("is_sale", False)),
            )

    def create(self, validated_data):
        colors = MaterialSerializer._list_from_request_key(self.initial_data, "colors")
        if colors is None:
            colors = []
        profile_type = super().create(validated_data)
        self._replace_colors(profile_type, colors)
        return profile_type

    def update(self, instance, validated_data):
        colors = MaterialSerializer._list_from_request_key(self.initial_data, "colors")
        profile_type = super().update(instance, validated_data)
        if colors is not None:
            self._replace_colors(profile_type, colors)
        return profile_type
