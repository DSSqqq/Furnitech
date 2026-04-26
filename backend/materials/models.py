from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class RoundingMode(models.TextChoices):
    NONE = "none", "Не округлять"
    CEIL_UNIT = "ceil_unit", "Округлять вверх до целого"
    CEIL_MULTIPLE = "ceil_multiple", "Округлять вверх до кратного числа"


class MaterialClass(models.Model):
    """Справочник классов материалов (премиум, стандарт, …)."""

    name = models.CharField("Наименование", max_length=255)
    code = models.SlugField("Код", max_length=64, blank=True)
    external_id = models.CharField("ID 1С", max_length=64, blank=True, null=True, db_index=True)
    last_synced_at = models.DateTimeField("Синхронизирован", null=True, blank=True)

    class Meta:
        verbose_name = "Класс материала"
        verbose_name_plural = "Классы материалов"
        ordering = ["name"]

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
        blank=True,
        db_index=True,
        help_text="Артикул / внутренний код (для сопоставления с учётом, в т.ч. 1С).",
    )
    material_classes = models.ManyToManyField(
        MaterialClass,
        blank=True,
        related_name="materials",
        verbose_name="Классы материала",
    )
    fnp_name = models.CharField("Наименование ФНП", max_length=500, blank=True)
    uom = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.PROTECT,
        related_name="materials",
        verbose_name="Ед. изм.",
    )
    unit_mass = models.DecimalField(
        "Масса на ед. изм.",
        max_digits=14,
        decimal_places=3,
        default=Decimal("0"),
        null=False,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
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
    is_active = models.BooleanField("Активен", default=True)
    external_id = models.CharField("ID 1С", max_length=64, blank=True, null=True, unique=True, db_index=True)
    last_synced_at = models.DateTimeField("Синхронизирован", null=True, blank=True)

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
    designation = models.CharField("Обозначение", max_length=255, blank=True)
    cut_coeff = models.DecimalField(
        "Коэф. с учётом раскроя",
        max_digits=18,
        decimal_places=6,
        default=Decimal("1"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    calc_type = models.CharField("Тип (калькулятор)", max_length=32, default="tape")

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
                name="materials_material_article_nonempty_uniq",
                condition=~Q(article=""),
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        from django.core.exceptions import ValidationError

        self.article = (self.article or "").strip()
        if self.rounding_mode == RoundingMode.CEIL_MULTIPLE and (
            self.rounding_multiple is None or self.rounding_multiple <= 0
        ):
            raise ValidationError(
                {"rounding_multiple": "Для кратного округления укажите положительное число (кратность)."}
            )
        if self.article:
            qs = Material.objects.filter(article=self.article)
            if self.pk is not None:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError(
                    {"article": "Материал с таким артикулом уже существует."}
                )

    def save(self, *args, **kwargs) -> None:
        self.article = (self.article or "").strip()
        super().save(*args, **kwargs)


class MaterialAlternativePrice(models.Model):
    """Сохранённая цена на единицу в каждой выбранной альтернативной валюте (не KZT)."""

    material = models.ForeignKey(
        "Material",
        on_delete=models.CASCADE,
        related_name="alternative_prices",
        verbose_name="Материал",
    )
    currency = models.CharField("Код валюты (ISO 4217)", max_length=3, db_index=True)
    price = models.DecimalField(
        "Цена за ед. изм.",
        max_digits=18,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
    )

    class Meta:
        verbose_name = "Цена в альтернативной валюте"
        verbose_name_plural = "Цены в альтернативных валютах"
        ordering = ["currency"]
        constraints = [
            models.UniqueConstraint(
                fields=["material", "currency"],
                name="materials_mat_alt_currency_uniq",
            )
        ]


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


class MaterialOperationLine(models.Model):
    """Операция/услуга в расчёте (текст + параметр с модели, кол-во, ед.изм., цена)."""

    material = models.ForeignKey(
        "Material",
        on_delete=models.CASCADE,
        related_name="operation_lines",
        verbose_name="Материал",
    )
    name = models.CharField("Операция", max_length=500)
    model_parameter = models.CharField("Параметр с модели", max_length=500, blank=True)
    quantity = models.DecimalField(
        "Количество",
        max_digits=18,
        decimal_places=3,
        default=Decimal("1"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    uom = models.ForeignKey(
        UnitOfMeasure,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="operation_lines",
        verbose_name="Ед. изм.",
    )
    price = models.DecimalField(
        "Цена (KZT)",
        max_digits=18,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0"))],
    )
    sort_order = models.PositiveIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Операция (строка)"
        verbose_name_plural = "Операции"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return f"{self.name} ({self.material_id})"


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
        on_delete=models.PROTECT,
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
        on_delete=models.PROTECT,
        related_name="calculator_color_in_profile_types",
        verbose_name="Материал (цвет)",
    )
    sort_order = models.PositiveIntegerField("Порядок", default=0)
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
