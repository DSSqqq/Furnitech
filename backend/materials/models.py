from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class RoundingMode(models.TextChoices):
    NONE = "none", "Не округлять"
    CEIL_UNIT = "ceil_unit", "Округлять вверх до целого"
    CEIL_MULTIPLE = "ceil_multiple", "Округлять вверх до кратного числа"


class PricingCalcMode(models.TextChoices):
    LINEAR = "linear", "Погонаж"
    SHEET = "sheet", "Лист"
    PIECE = "piece", "Штуки"


class RelatedQuantityScale(models.TextChoices):
    """Как масштабировать строку сопутствующего в калькуляторе."""

    FOLLOW_PARENT = (
        "follow_parent",
        "Как у родителя (× м²/м.п./шт по карточке основного материала)",
    )
    PER_FACADE = "per_facade", "На фасад (× количество фасадов)"
    USE_RELATED_UOM = (
        "use_related_uom",
        "По ед. изм. сопутствующего (× м²/м.п./шт по его карточке)",
    )


class MaterialClassCategory(models.Model):
    """Папки для справочника классов материалов (отдельно от категорий номенклатуры)."""

    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="Родительская папка",
    )
    name = models.CharField("Наименование", max_length=255)
    code = models.SlugField("Код", max_length=64, blank=True)
    sort_order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Папка классов материалов"
        verbose_name_plural = "Папки классов материалов"
        ordering = ["sort_order", "name"]
        unique_together = [("parent", "name")]

    def __str__(self) -> str:
        return self.name

    @property
    def path(self) -> str:
        parts = [self.name]
        p: MaterialClassCategory | None = self.parent
        while p is not None:
            parts.append(p.name)
            p = p.parent
        return " / ".join(reversed(parts))


class MaterialClass(models.Model):
    """Справочник классов материалов (премиум, стандарт, …)."""

    category = models.ForeignKey(
        MaterialClassCategory,
        on_delete=models.PROTECT,
        related_name="classes",
        verbose_name="Папка",
    )
    name = models.CharField("Наименование", max_length=255)
    code = models.SlugField("Код", max_length=64, unique=True)
    external_id = models.CharField("ID 1С", max_length=64, blank=True, null=True, db_index=True)
    last_synced_at = models.DateTimeField("Синхронизирован", null=True, blank=True)

    class Meta:
        verbose_name = "Класс материала"
        verbose_name_plural = "Классы материалов"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class CalculationFormulaCategory(models.Model):
    """Папки для списка формул расчёта (аналог папок классов материалов)."""

    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="Родительская папка",
    )
    name = models.CharField("Наименование", max_length=255)
    code = models.SlugField("Код", max_length=64, blank=True)
    sort_order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Папка формул расчёта"
        verbose_name_plural = "Папки формул расчёта"
        ordering = ["sort_order", "name"]
        unique_together = [("parent", "name")]

    def __str__(self) -> str:
        return self.name

    @property
    def path(self) -> str:
        parts = [self.name]
        p: CalculationFormulaCategory | None = self.parent
        while p is not None:
            parts.append(p.name)
            p = p.parent
        return " / ".join(reversed(parts))


class CalculationFormula(models.Model):
    """Именованная формула расчёта по классам выбранных материалов."""

    category = models.ForeignKey(
        CalculationFormulaCategory,
        on_delete=models.PROTECT,
        related_name="formulas",
        verbose_name="Папка",
    )
    name = models.CharField("Наименование", max_length=255)
    expression = models.CharField("Выражение", max_length=1000, blank=True)
    tokens = models.JSONField("Токены формулы", default=list, blank=True)
    is_active = models.BooleanField("Активна", default=False)
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Формула расчёта"
        verbose_name_plural = "Формулы расчёта"
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class UnitOfMeasure(models.Model):
    name = models.CharField("Наименование", max_length=100)
    short_name = models.CharField("Сокр.", max_length=32, blank=True)
    code = models.SlugField("Код", max_length=32, unique=True, blank=True, null=True)
    external_id = models.CharField("ID 1С", max_length=64, blank=True, null=True, db_index=True)
    last_synced_at = models.DateTimeField("Синхронизирован", null=True, blank=True)

    class Meta:
        verbose_name = "Ед. изм."
        verbose_name_plural = "Ед. изм."
        ordering = ["name"]

    def __str__(self) -> str:
        return self.short_name or self.name


class MaterialCategory(models.Model):
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="Родительская папка",
    )
    name = models.CharField("Наименование", max_length=255)
    code = models.SlugField("Код", max_length=64, blank=True)
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    external_id = models.CharField("ID 1С", max_length=64, blank=True, null=True, db_index=True)
    last_synced_at = models.DateTimeField("Синхронизирован", null=True, blank=True)

    class Meta:
        verbose_name = "Категория материалов"
        verbose_name_plural = "Категории материалов"
        ordering = ["sort_order", "name"]
        unique_together = [("parent", "name")]

    def __str__(self) -> str:
        return self.name

    @property
    def path(self) -> str:
        parts = [self.name]
        p: MaterialCategory | None = self.parent
        while p is not None:
            parts.append(p.name)
            p = p.parent
        return " / ".join(reversed(parts))


class TextureCategory(models.Model):
    """Папки базы именованных текстур (отдельно от категорий материалов)."""

    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="Родительская папка",
    )
    name = models.CharField("Наименование", max_length=255)
    code = models.SlugField("Код", max_length=64, blank=True)
    sort_order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Папка текстур"
        verbose_name_plural = "Папки текстур"
        ordering = ["sort_order", "name"]
        unique_together = [("parent", "name")]

    def __str__(self) -> str:
        return self.name

    @property
    def path(self) -> str:
        parts = [self.name]
        p: TextureCategory | None = self.parent
        while p is not None:
            parts.append(p.name)
            p = p.parent
        return " / ".join(reversed(parts))


class TextureItem(models.Model):
    """Именованная текстура (файл) в базе; материалы могут ссылаться на неё."""

    category = models.ForeignKey(
        TextureCategory,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Папка",
    )
    name = models.CharField("Наименование", max_length=500)
    image = models.ImageField(
        "Изображение",
        upload_to="texture_library/",
        max_length=300,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Текстура (база)"
        verbose_name_plural = "Текстуры (база)"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Material(models.Model):
    """Карточка материала. Вкладка «Общие параметры» + задел на расширения."""

    category = models.ForeignKey(
        MaterialCategory,
        on_delete=models.PROTECT,
        related_name="materials",
        verbose_name="Папка / категория",
    )
    name = models.CharField("Наименование", max_length=500)
    article = models.CharField(
        "Артикул",
        max_length=128,
        db_index=True,
        help_text="Артикул / внутренний код (для сопоставления с учётом, в т.ч. 1С). Уникален в каталоге.",
    )
    material_classes = models.ManyToManyField(
        MaterialClass,
        blank=True,
        related_name="materials",
        verbose_name="Классы материала",
    )
    uom = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.PROTECT,
        related_name="materials",
        verbose_name="Ед. изм.",
    )
    base_currency = models.CharField("Код валюты (базовая)", max_length=3, default="KZT")
    base_price = models.DecimalField(
        "Цена в базовой валюте за ед. изм.",
        max_digits=18,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
    )
    note = models.TextField("Примечание", blank=True)
    rounding_mode = models.CharField(
        "Способ округления кол-ва",
        max_length=32,
        choices=RoundingMode.choices,
        default=RoundingMode.NONE,
    )
    rounding_multiple = models.DecimalField(
        "Кратность округления (если выбрано кратно)",
        max_digits=18,
        decimal_places=8,
        null=True,
        blank=True,
    )
    excess_coefficient = models.DecimalField(
        "Коэффициент избытка",
        max_digits=18,
        decimal_places=6,
        default=Decimal("1"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Множитель к рассчитанному количеству (1 — без запаса, 1.1 — +10%).",
    )
    is_active = models.BooleanField("Активен", default=True)
    external_id = models.CharField("ID 1С", max_length=64, blank=True, null=True, unique=True, db_index=True)
    last_synced_at = models.DateTimeField("Синхронизирован", null=True, blank=True)
    import_export_snapshot = models.JSONField(
        "Снимок строки импорта/экспорта",
        default=dict,
        blank=True,
        help_text="Полная строка таблицы (XML/XLSX) для повторного экспорта без потери колонок.",
    )

    # Вкладка «Доп. параметры» (задел для калькулятора).
    thickness = models.DecimalField(
        "Толщина",
        max_digits=18,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    max_length = models.DecimalField(
        "Макс. длина",
        max_digits=18,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    min_length = models.DecimalField(
        "Мин. длина",
        max_digits=18,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    max_width = models.DecimalField(
        "Макс. ширина",
        max_digits=18,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    min_width = models.DecimalField(
        "Мин. ширина",
        max_digits=18,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    pricing_calc_mode = models.CharField(
        "Режим расчёта количества",
        max_length=16,
        choices=PricingCalcMode.choices,
        blank=True,
        default="",
        help_text="Погонаж — периметр; лист — площадь; штуки — количество.",
    )

    # Вкладка «Параметры текстуры» (задел для калькулятора/эскиза).
    texture_mode = models.CharField(
        "Режим текстуры",
        max_length=16,
        default="texture",
        help_text="color или texture",
    )
    texture_color = models.CharField(
        "Цвет (HEX)",
        max_length=16,
        blank=True,
        default="",
        help_text="Например #RRGGBB",
    )
    texture_image = models.ImageField(
        "Текстура (файл)",
        upload_to="textures/",
        max_length=300,
        null=True,
        blank=True,
    )
    texture_item = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="materials_using",
        verbose_name="Текстура из базы",
    )
    tex_offset_x = models.DecimalField(
        "Смещение X",
        max_digits=18,
        decimal_places=3,
        default=Decimal("0"),
    )
    tex_offset_y = models.DecimalField(
        "Смещение Y",
        max_digits=18,
        decimal_places=3,
        default=Decimal("0"),
    )
    tex_step_x = models.DecimalField(
        "Шаг X",
        max_digits=18,
        decimal_places=3,
        default=Decimal("100"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    tex_step_y = models.DecimalField(
        "Шаг Y",
        max_digits=18,
        decimal_places=3,
        default=Decimal("100"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    tex_opacity = models.DecimalField(
        "Прозрачность",
        max_digits=5,
        decimal_places=3,
        default=Decimal("1"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))],
    )
    tex_mirror = models.BooleanField("Зеркальность", default=False)
    tex_specular_sharpness = models.DecimalField(
        "Резкость блика",
        max_digits=5,
        decimal_places=3,
        default=Decimal("0.5"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))],
    )
    tex_specular_brightness = models.DecimalField(
        "Яркость блика",
        max_digits=5,
        decimal_places=3,
        default=Decimal("0.35"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("1"))],
    )
    tex_rotation_deg = models.DecimalField(
        "Угол поворота (градусы)",
        max_digits=7,
        decimal_places=2,
        default=Decimal("0"),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Материал"
        verbose_name_plural = "Материалы"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["category", "name"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["article"],
                name="materials_material_article_uniq",
            ),
            models.UniqueConstraint(
                fields=["category", "name"],
                name="materials_material_category_name_uniq",
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        from django.core.exceptions import ValidationError

        self.article = (self.article or "").strip()
        self.name = (self.name or "").strip()
        if not self.name:
            raise ValidationError({"name": "Укажите наименование."})
        if not self.article:
            raise ValidationError({"article": "Укажите артикул."})
        if self.rounding_mode == RoundingMode.CEIL_MULTIPLE and (
            self.rounding_multiple is None or self.rounding_multiple <= 0
        ):
            raise ValidationError(
                {"rounding_multiple": "Для кратного округления укажите положительное число (кратность)."}
            )
        if self.excess_coefficient is not None and self.excess_coefficient <= 0:
            raise ValidationError(
                {"excess_coefficient": "Коэффициент избытка должен быть положительным."}
            )
        qs_article = Material.objects.filter(article=self.article)
        if self.pk is not None:
            qs_article = qs_article.exclude(pk=self.pk)
        if qs_article.exists():
            raise ValidationError(
                {"article": "Материал с таким артикулом уже существует."}
            )
        qs_name = Material.objects.filter(category_id=self.category_id, name=self.name)
        if self.pk is not None:
            qs_name = qs_name.exclude(pk=self.pk)
        if qs_name.exists():
            raise ValidationError(
                {"name": "Материал с таким наименованием уже есть в этой папке."}
            )

    def save(self, *args, **kwargs) -> None:
        self.article = (self.article or "").strip()
        self.name = (self.name or "").strip()
        super().save(*args, **kwargs)


class MaterialRelatedItem(models.Model):
    """Сопутствующий материал: другая карточка из базы с количеством (к расчёту итоговой цены)."""

    parent = models.ForeignKey(
        "Material",
        on_delete=models.CASCADE,
        related_name="companion_items",
        verbose_name="Материал (основной)",
    )
    related_material = models.ForeignKey(
        "Material",
        on_delete=models.CASCADE,
        related_name="companion_in_materials",
        verbose_name="Сопутствующий материал",
    )
    quantity = models.DecimalField(
        "Количество",
        max_digits=18,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
    )
    quantity_scale = models.CharField(
        "Масштаб в калькуляторе",
        max_length=32,
        choices=RelatedQuantityScale.choices,
        default=RelatedQuantityScale.FOLLOW_PARENT,
    )
    sort_order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Сопутствующий материал"
        verbose_name_plural = "Сопутствующие материалы"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["parent", "related_material"],
                name="materials_companion_parent_related_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.parent_id} → {self.related_material_id} × {self.quantity}"


class CalculatorProfile(models.Model):
    """Профиль для калькулятора. Профиль идентифицируется материалом из базы."""

    material = models.OneToOneField(
        Material,
        on_delete=models.CASCADE,
        related_name="calculator_profile",
        verbose_name="Материал профиля",
    )
    is_active = models.BooleanField("Активен", default=True)
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Профиль калькулятора"
        verbose_name_plural = "Профили калькулятора"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return f"Профиль: {self.material_id}"


class CalculatorProfileColor(models.Model):
    """Цвет профиля — ссылка на материал (позже можно расширить атрибутами)."""

    profile = models.ForeignKey(
        CalculatorProfile,
        on_delete=models.CASCADE,
        related_name="colors",
        verbose_name="Профиль",
    )
    color_material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name="calculator_color_in_profiles",
        verbose_name="Материал (цвет)",
    )
    sort_order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Цвет профиля"
        verbose_name_plural = "Цвета профилей"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "color_material"],
                name="materials_calc_profile_color_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.profile_id} → {self.color_material_id}"


class CalculatorProfileType(models.Model):
    """Тип профиля (подгруппа для цветов) — не привязан к материалу профиля."""

    name = models.CharField("Название типа профиля", max_length=255)
    image_url = models.CharField(
        "Картинка (URL)",
        max_length=1000,
        blank=True,
        default="",
        help_text="URL картинки для отображения в карточке типа профиля.",
    )
    card_image = models.ImageField(
        "Картинка (файл)",
        upload_to="profile_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="profile_type_card_1",
        verbose_name="Картинка 1 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_2 = models.ImageField(
        "Картинка 2 (файл)",
        upload_to="profile_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_2 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="profile_type_card_2",
        verbose_name="Картинка 2 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_3 = models.ImageField(
        "Картинка 3 (файл)",
        upload_to="profile_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_3 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="profile_type_card_3",
        verbose_name="Картинка 3 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_4 = models.ImageField(
        "Картинка 4 (файл)",
        upload_to="profile_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_4 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="profile_type_card_4",
        verbose_name="Картинка 4 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_5 = models.ImageField(
        "Картинка 5 (файл)",
        upload_to="profile_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_5 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="profile_type_card_5",
        verbose_name="Картинка 5 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_6 = models.ImageField(
        "Картинка 6 (файл)",
        upload_to="profile_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_6 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="profile_type_card_6",
        verbose_name="Картинка 6 из базы текстур",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField("Активен", default=True)
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Тип профиля (калькулятор)"
        verbose_name_plural = "Типы профилей (калькулятор)"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.name


class CalculatorProfileTypeColor(models.Model):
    """Цвет для типа профиля: ссылка на материал + флаги (UI-маркеры)."""

    profile_type = models.ForeignKey(
        CalculatorProfileType,
        on_delete=models.CASCADE,
        related_name="colors",
        verbose_name="Тип профиля",
    )
    color_material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name="calculator_color_in_profile_types",
        verbose_name="Материал (цвет)",
    )
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    is_active = models.BooleanField("Активен в калькуляторе", default=True)
    is_new = models.BooleanField("New", default=False)
    is_hit = models.BooleanField("Hit", default=False)
    is_sale = models.BooleanField("Sale", default=False)

    class Meta:
        verbose_name = "Цвет типа профиля"
        verbose_name_plural = "Цвета типов профилей"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile_type", "color_material"],
                name="materials_calc_profile_type_color_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.profile_type_id} → {self.color_material_id}"


class CalculatorFillingType(models.Model):
    """Тип наполнения фасада (стекло, Лакобель, …) — для калькулятора / админки."""

    name = models.CharField("Название типа наполнения", max_length=255)
    image_url = models.CharField(
        "Картинка (URL)",
        max_length=1000,
        blank=True,
        default="",
        help_text="URL картинки для карточки типа.",
    )
    card_image = models.ImageField(
        "Картинка (файл)",
        upload_to="filling_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="filling_type_card_1",
        verbose_name="Картинка 1 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_2 = models.ImageField(
        "Картинка 2 (файл)",
        upload_to="filling_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_2 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="filling_type_card_2",
        verbose_name="Картинка 2 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_3 = models.ImageField(
        "Картинка 3 (файл)",
        upload_to="filling_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_3 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="filling_type_card_3",
        verbose_name="Картинка 3 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_4 = models.ImageField(
        "Картинка 4 (файл)",
        upload_to="filling_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_4 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="filling_type_card_4",
        verbose_name="Картинка 4 из базы текстур",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField("Активен", default=True)
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Тип наполнения (калькулятор)"
        verbose_name_plural = "Типы наполнения (калькулятор)"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.name


class CalculatorFillingTypeMaterial(models.Model):
    """Материал варианта наполнения (конкретное стекло / плёнка и т.д.)."""

    filling_type = models.ForeignKey(
        CalculatorFillingType,
        on_delete=models.CASCADE,
        related_name="materials",
        verbose_name="Тип наполнения",
    )
    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name="calculator_filling_in_types",
        verbose_name="Материал",
    )
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    is_active = models.BooleanField("Активен в калькуляторе", default=True)

    class Meta:
        verbose_name = "Материал типа наполнения"
        verbose_name_plural = "Материалы типов наполнения"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["filling_type", "material"],
                name="materials_calc_filling_type_material_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.filling_type_id} → {self.material_id}"


class CalculatorHingeType(models.Model):
    """Тип петель для калькулятора (присадка под петли производства)."""

    name = models.CharField("Название типа петель", max_length=255)
    image_url = models.CharField(
        "Картинка (URL)",
        max_length=1000,
        blank=True,
        default="",
        help_text="URL картинки для карточки типа.",
    )
    card_image = models.ImageField(
        "Картинка (файл)",
        upload_to="hinge_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="hinge_type_card_1",
        verbose_name="Картинка 1 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_2 = models.ImageField(
        "Картинка 2 (файл)",
        upload_to="hinge_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_2 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="hinge_type_card_2",
        verbose_name="Картинка 2 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_3 = models.ImageField(
        "Картинка 3 (файл)",
        upload_to="hinge_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_3 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="hinge_type_card_3",
        verbose_name="Картинка 3 из базы текстур",
        null=True,
        blank=True,
    )
    card_image_4 = models.ImageField(
        "Картинка 4 (файл)",
        upload_to="hinge_types/",
        max_length=300,
        null=True,
        blank=True,
    )
    card_texture_4 = models.ForeignKey(
        TextureItem,
        on_delete=models.SET_NULL,
        related_name="hinge_type_card_4",
        verbose_name="Картинка 4 из базы текстур",
        null=True,
        blank=True,
    )
    is_active = models.BooleanField("Активен", default=True)
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Тип петель (калькулятор)"
        verbose_name_plural = "Типы петель (калькулятор)"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.name


class CalculatorHingeTypeMaterial(models.Model):
    """Материал варианта петель (конкретная модель петли)."""

    hinge_type = models.ForeignKey(
        CalculatorHingeType,
        on_delete=models.CASCADE,
        related_name="materials",
        verbose_name="Тип петель",
    )
    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name="calculator_hinge_in_types",
        verbose_name="Материал",
    )
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    is_active = models.BooleanField("Активен в калькуляторе", default=True)

    class Meta:
        verbose_name = "Материал типа петель"
        verbose_name_plural = "Материалы типов петель"
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["hinge_type", "material"],
                name="materials_calc_hinge_type_material_uniq",
            )
        ]

    def __str__(self) -> str:
        return f"{self.hinge_type_id} → {self.material_id}"


class CalculatorHandleHoleDiameter(models.Model):
    """Диаметр отверстия под ручку (шаг 7 калькулятора): видимость для публичного клиента."""

    diameter_mm = models.PositiveSmallIntegerField("Диаметр, мм", unique=True)
    client_visible = models.BooleanField(
        "Показывать клиенту",
        default=True,
        help_text="Если снято — в публичном калькуляторе этот диаметр в списке не отображается.",
    )
    sort_order = models.PositiveIntegerField("Порядок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Диаметр отверстия под ручку"
        verbose_name_plural = "Диаметры отверстий под ручку"
        ordering = ["sort_order", "diameter_mm"]

    def __str__(self) -> str:
        return f"{self.diameter_mm} мм"


class FacadeOrder(models.Model):
    """Заказ из калькулятора рамочного фасада: контакты, снимок расчёта, PDF, статус для менеджера."""

    class Status(models.TextChoices):
        NOT_CONFIRMED = (
            "not_confirmed",
            "Не подтверждён (менеджер свяжется с клиентом)",
        )
        CONFIRMED = "confirmed", "Подтверждён"
        IN_PRODUCTION = "in_production", "В процессе сборки"
        READY = "ready", "Готов к выдаче"
        COMPLETED = "completed", "Завершён"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Не оплачен"
        PARTIAL = "partial", "Частично оплачен"
        PAID = "paid", "Оплачен"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="facade_orders",
        verbose_name="Клиент",
    )
    status = models.CharField(
        "Статус",
        max_length=32,
        choices=Status.choices,
        default=Status.NOT_CONFIRMED,
        db_index=True,
    )
    payment_status = models.CharField(
        "Статус оплаты",
        max_length=32,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
        db_index=True,
    )
    contact_name = models.CharField("Имя в заявке", max_length=255, blank=True)
    contact_phone = models.CharField("Телефон", max_length=64, blank=True)
    contact_email = models.EmailField("Email в заявке", blank=True)
    contact_comment = models.TextField("Комментарий", blank=True)
    snapshot = models.JSONField("Снимок калькулятора", default=dict)
    pdf_file = models.FileField("PDF расчёта", upload_to="facade_orders/pdf/%Y/%m/")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Заказ (фасад, калькулятор)"
        verbose_name_plural = "Заказы (фасады, калькулятор)"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Заказ #{self.pk} — {self.user_id}"
