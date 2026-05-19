from decimal import Decimal
import json

from django.db import IntegrityError
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .media_urls import absolute_media_url
from .models import (
    CalculationFormula,
    CalculationFormulaCategory,
    CalculatorFillingType,
    CalculatorFillingTypeMaterial,
    CalculatorHandleHoleDiameter,
    CalculatorHingeType,
    CalculatorHingeTypeMaterial,
    CalculatorProfile,
    CalculatorProfileColor,
    CalculatorProfileType,
    CalculatorProfileTypeColor,
    FacadeOrder,
    Material,
    MaterialCategory,
    MaterialClass,
    MaterialClassCategory,
    MaterialRelatedItem,
    RelatedQuantityScale,
    RoundingMode,
    TextureCategory,
    TextureItem,
    UnitOfMeasure,
)


class MaterialClassCategorySerializer(serializers.ModelSerializer):
    path = serializers.ReadOnlyField()

    class Meta:
        model = MaterialClassCategory
        fields = ("id", "parent", "name", "code", "sort_order", "path")


class MaterialClassSerializer(serializers.ModelSerializer):
    code = serializers.SlugField(
        max_length=64,
        validators=[
            UniqueValidator(
                queryset=MaterialClass.objects.all(),
                message="Класс с таким кодом уже существует.",
            )
        ],
    )

    class Meta:
        model = MaterialClass
        fields = ("id", "category", "name", "code", "external_id", "last_synced_at")

    def validate(self, attrs):
        partial = getattr(self, "partial", False)
        if partial and "code" not in attrs:
            return attrs
        raw = attrs.get("code", "")
        if not isinstance(raw, str) or not raw.strip():
            raise serializers.ValidationError({"code": "Укажите код класса."})
        code = raw.strip()
        attrs["code"] = code
        qs = MaterialClass.objects.filter(code__iexact=code)
        inst = getattr(self, "instance", None)
        if inst is not None and getattr(inst, "pk", None):
            qs = qs.exclude(pk=inst.pk)
        if qs.exists():
            raise serializers.ValidationError({"code": "Класс с таким кодом уже существует."})
        return attrs


class CalculationFormulaCategorySerializer(serializers.ModelSerializer):
    path = serializers.ReadOnlyField()

    class Meta:
        model = CalculationFormulaCategory
        fields = ("id", "parent", "name", "code", "sort_order", "path")


class CalculationFormulaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalculationFormula
        fields = (
            "id",
            "category",
            "name",
            "expression",
            "tokens",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_tokens(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Ожидается массив токенов.")
        valid_ops = {"+", "-", "*", "/", "(", ")", "="}
        class_ids: list[int] = []
        for token in value:
            if not isinstance(token, dict):
                raise serializers.ValidationError("Каждый токен должен быть объектом.")
            typ = token.get("type")
            if typ == "class":
                class_id = token.get("class_id")
                try:
                    cid = int(class_id)
                except (TypeError, ValueError) as e:
                    raise serializers.ValidationError("У токена класса нужен class_id.") from e
                if cid <= 0:
                    raise serializers.ValidationError("class_id должен быть положительным.")
                class_ids.append(cid)
            elif typ == "op":
                if token.get("value") not in valid_ops:
                    raise serializers.ValidationError("Недопустимый математический знак.")
            elif typ == "number":
                raw = str(token.get("value", "")).strip().replace(",", ".")
                try:
                    Decimal(raw)
                except Exception as e:  # noqa: BLE001
                    raise serializers.ValidationError("Недопустимое число в формуле.") from e
            else:
                raise serializers.ValidationError("Недопустимый тип токена.")
        if class_ids:
            existing = set(MaterialClass.objects.filter(pk__in=class_ids).values_list("pk", flat=True))
            missing = [cid for cid in class_ids if cid not in existing]
            if missing:
                raise serializers.ValidationError(f"Классы не найдены: {', '.join(map(str, missing))}.")
        return value


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = ("id", "name", "short_name", "code", "external_id", "last_synced_at")


class MaterialSummarySerializer(serializers.ModelSerializer):
    """Краткие поля сопутствующего материала (для строк и pickers)."""

    uom = UnitOfMeasureSerializer(read_only=True)
    material_class_ids = serializers.SerializerMethodField()
    texture_library_item = serializers.IntegerField(source="texture_item_id", read_only=True)
    texture_library_item_name = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = (
            "id",
            "name",
            "article",
            "uom",
            "base_price",
            "base_currency",
            "material_class_ids",
            "pricing_calc_mode",
            "texture_mode",
            "texture_color",
            "texture_image",
            "texture_library_item",
            "texture_library_item_name",
        )

    def get_texture_library_item_name(self, obj: Material) -> str | None:
        if obj.texture_item_id and obj.texture_item:
            return obj.texture_item.name
        return None

    def get_material_class_ids(self, obj: Material) -> list[int]:
        return [c.pk for c in obj.material_classes.all()]

    def to_representation(self, instance) -> dict:
        data = super().to_representation(instance)
        req = self.context.get("request")
        data["texture_image"] = MaterialSerializer.effective_texture_image_url(instance, req)
        return data


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


class TextureCategorySerializer(serializers.ModelSerializer):
    path = serializers.ReadOnlyField()

    class Meta:
        model = TextureCategory
        fields = ("id", "parent", "name", "code", "sort_order", "path")


class TextureItemSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = TextureItem
        fields = ("id", "category", "name", "image", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        """При создании запись без файла в БД не создаём — иначе «пустые» текстуры на проде."""
        if self.instance is None and not attrs.get("image"):
            raise serializers.ValidationError(
                {"image": "Загрузите файл изображения."}
            )
        return attrs

    def to_representation(self, instance) -> dict:
        data = super().to_representation(instance)
        req = self.context.get("request")
        if instance.image:
            data["image"] = absolute_media_url(req, instance.image.url)
        else:
            data["image"] = None
        return data


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
    texture_library_item = serializers.PrimaryKeyRelatedField(
        queryset=TextureItem.objects.all(),
        source="texture_item",
        allow_null=True,
        required=False,
    )
    texture_library_item_name = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = (
            "id",
            "category",
            "name",
            "article",
            "material_class_ids",
            "uom",
            "uom_id",
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
            "pricing_calc_mode",
            "texture_mode",
            "texture_color",
            "texture_image",
            "texture_library_item",
            "texture_library_item_name",
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
        read_only_fields = (
            "id",
            "uom",
            "texture_library_item_name",
            "created_at",
            "updated_at",
            "last_synced_at",
        )

    def get_texture_library_item_name(self, obj: Material) -> str | None:
        if obj.texture_item_id and obj.texture_item:
            return obj.texture_item.name
        return None

    @staticmethod
    def effective_texture_image_url(instance: Material, request) -> str | None:
        if instance.texture_item_id:
            ti = getattr(instance, "texture_item", None)
            if ti and ti.image:
                return absolute_media_url(request, ti.image.url)
        if instance.texture_image:
            return absolute_media_url(request, instance.texture_image.url)
        return None

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
        data["related_items"] = self._serialize_related_items(instance)
        req = self.context.get("request")
        data["texture_image"] = self.effective_texture_image_url(instance, req)
        data["texture_library_item"] = instance.texture_item_id
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
                    "quantity_scale": x.quantity_scale,
                    "line_total": str(line_total),
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
            scale_raw = row.get("quantity_scale") or RelatedQuantityScale.FOLLOW_PARENT
            if isinstance(scale_raw, str):
                scale_raw = scale_raw.strip()
            else:
                scale_raw = str(scale_raw).strip() if scale_raw is not None else RelatedQuantityScale.FOLLOW_PARENT
            valid_scales = {c for c, _ in RelatedQuantityScale.choices}
            if scale_raw not in valid_scales:
                raise serializers.ValidationError(
                    {"related_items": f"Недопустимый quantity_scale: {scale_raw!r}."}
                )
            MaterialRelatedItem.objects.create(
                parent_id=parent_id,
                related_material_id=rid,
                quantity=qty,
                quantity_scale=scale_raw,
                sort_order=i,
            )

    def create(self, validated_data):
        self._apply_texture_exclusivity(validated_data, instance=None)
        m2m_ids = validated_data.pop("material_class_ids", None) or []
        comp = self._list_from_request_key(self.initial_data, "related_items")
        if comp is None:
            comp = []
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
        self._replace_companion_items(material, comp, material.id)
        return material

    def update(self, instance, validated_data):
        self._apply_texture_exclusivity(validated_data, instance=instance)
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
        comp = self._list_from_request_key(self.initial_data, "related_items")
        if comp is not None:
            self._replace_companion_items(material, comp, material.id)
        return material

    def _apply_texture_exclusivity(self, validated_data: dict, instance: Material | None) -> None:
        """Свой файл и ссылка на базу взаимоисключающи: файл побеждает при одновременной передаче."""
        has_new_file = bool(validated_data.get("texture_image"))
        ti = validated_data.get("texture_item", serializers.empty)
        assigning_lib = ti is not serializers.empty and ti is not None
        if has_new_file:
            validated_data["texture_item"] = None
        elif assigning_lib:
            validated_data["texture_image"] = None
            if instance and instance.texture_image:
                instance.texture_image.delete(save=False)

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
    card_image_2 = serializers.ImageField(required=False, allow_null=True)
    card_image_3 = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = CalculatorProfileType
        fields = (
            "id",
            "name",
            "image_url",
            "card_image",
            "card_image_2",
            "card_image_3",
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


class CalculatorFillingTypeSerializer(serializers.ModelSerializer):
    materials = serializers.SerializerMethodField(read_only=True)
    card_image = serializers.ImageField(required=False, allow_null=True)
    card_image_2 = serializers.ImageField(required=False, allow_null=True)
    card_image_3 = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = CalculatorFillingType
        fields = (
            "id",
            "name",
            "image_url",
            "card_image",
            "card_image_2",
            "card_image_3",
            "is_active",
            "sort_order",
            "materials",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_materials(self, obj: CalculatorFillingType) -> list:
        if not obj.pk:
            return []
        out = []
        for x in obj.materials.all().select_related("material", "material__uom"):
            out.append(
                {
                    "id": x.id,
                    "material_id": x.material_id,
                    "material": MaterialSummarySerializer(x.material).data,
                }
            )
        return out

    def _replace_materials(self, filling_type: CalculatorFillingType, rows: list) -> None:
        for row in rows:
            if not isinstance(row, dict):
                raise serializers.ValidationError({"materials": "Каждая строка — объект."})
        filling_type.materials.all().delete()
        for i, row in enumerate(rows):
            mid = row.get("material_id")
            if mid is None or mid == "":
                raise serializers.ValidationError({"materials": "Нужен material_id."})
            CalculatorFillingTypeMaterial.objects.create(
                filling_type=filling_type,
                material_id=int(mid),
                sort_order=i,
            )

    def create(self, validated_data):
        materials = MaterialSerializer._list_from_request_key(self.initial_data, "materials")
        if materials is None:
            materials = []
        filling_type = super().create(validated_data)
        self._replace_materials(filling_type, materials)
        return filling_type

    def update(self, instance, validated_data):
        materials = MaterialSerializer._list_from_request_key(self.initial_data, "materials")
        filling_type = super().update(instance, validated_data)
        if materials is not None:
            self._replace_materials(filling_type, materials)
        return filling_type


class CalculatorHingeTypeSerializer(serializers.ModelSerializer):
    materials = serializers.SerializerMethodField(read_only=True)
    card_image = serializers.ImageField(required=False, allow_null=True)
    card_image_2 = serializers.ImageField(required=False, allow_null=True)
    card_image_3 = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = CalculatorHingeType
        fields = (
            "id",
            "name",
            "image_url",
            "card_image",
            "card_image_2",
            "card_image_3",
            "is_active",
            "sort_order",
            "materials",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_materials(self, obj: CalculatorHingeType) -> list:
        if not obj.pk:
            return []
        out = []
        for x in obj.materials.all().select_related("material", "material__uom"):
            out.append(
                {
                    "id": x.id,
                    "material_id": x.material_id,
                    "material": MaterialSummarySerializer(x.material).data,
                }
            )
        return out

    def _replace_materials(self, hinge_type: CalculatorHingeType, rows: list) -> None:
        for row in rows:
            if not isinstance(row, dict):
                raise serializers.ValidationError({"materials": "Каждая строка — объект."})
        hinge_type.materials.all().delete()
        for i, row in enumerate(rows):
            mid = row.get("material_id")
            if mid is None or mid == "":
                raise serializers.ValidationError({"materials": "Нужен material_id."})
            CalculatorHingeTypeMaterial.objects.create(
                hinge_type=hinge_type,
                material_id=int(mid),
                sort_order=i,
            )

    def create(self, validated_data):
        materials = MaterialSerializer._list_from_request_key(self.initial_data, "materials")
        if materials is None:
            materials = []
        hinge_type = super().create(validated_data)
        self._replace_materials(hinge_type, materials)
        return hinge_type

    def update(self, instance, validated_data):
        materials = MaterialSerializer._list_from_request_key(self.initial_data, "materials")
        hinge_type = super().update(instance, validated_data)
        if materials is not None:
            self._replace_materials(hinge_type, materials)
        return hinge_type


class CalculatorHandleHoleDiameterSerializer(serializers.ModelSerializer):
    """При создании можно задать diameter_mm; после сохранения менять диаметр нельзя."""

    class Meta:
        model = CalculatorHandleHoleDiameter
        fields = (
            "id",
            "diameter_mm",
            "client_visible",
            "sort_order",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if getattr(self, "instance", None) is not None:
            self.fields["diameter_mm"].read_only = True

    def update(self, instance, validated_data):
        validated_data.pop("diameter_mm", None)
        return super().update(instance, validated_data)


class FacadeOrderSerializer(serializers.ModelSerializer):
    order_number = serializers.SerializerMethodField()
    client_username = serializers.CharField(source="user.username", read_only=True)
    client_email = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = FacadeOrder
        fields = (
            "id",
            "order_number",
            "status",
            "status_display",
            "client_username",
            "client_email",
            "contact_name",
            "contact_phone",
            "contact_email",
            "contact_comment",
            "snapshot",
            "pdf_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_order_number(self, obj: FacadeOrder) -> str:
        return f"З-{obj.pk:06d}"

    def get_client_email(self, obj: FacadeOrder) -> str:
        return (obj.user.email or "").strip()

    def get_pdf_url(self, obj: FacadeOrder) -> str | None:
        request = self.context.get("request")
        if obj.pdf_file and request:
            return request.build_absolute_uri(obj.pdf_file.url)
        return None


class FacadeOrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacadeOrder
        fields = (
            "contact_name",
            "contact_phone",
            "contact_email",
            "contact_comment",
            "snapshot",
            "pdf_file",
        )

    def validate(self, attrs):
        req = self.context["request"]
        if not req.user.is_authenticated:
            raise serializers.ValidationError("Требуется вход.")
        if req.user.is_staff or req.user.is_superuser:
            raise serializers.ValidationError(
                {
                    "detail": "Оформление заказа доступно клиентским учётным записям. "
                    "Отправьте заявку с сайта под логином клиента или воспользуйтесь почтой из админского калькулятора."
                }
            )
        return attrs

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        validated_data["status"] = FacadeOrder.Status.NOT_CONFIRMED
        return super().create(validated_data)


class FacadeOrderStaffUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FacadeOrder
        fields = ("status",)

    def validate_status(self, value: str) -> str:
        valid = {c.value for c in FacadeOrder.Status}
        if value not in valid:
            raise serializers.ValidationError("Недопустимый статус.")
        return value
