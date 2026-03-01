"""
SubscriberBox — puszka abonencka (outdoor/indoor fiber/copper terminal box).
Może mieć wejścia (porty trunk) i wyjścia (porty abonenckie) z różnymi typami złączy.
"""
from django.db import models


class SubscriberBox(models.Model):
    """Puszka abonencka — dowolna konfiguracja portów wejście/wyjście."""

    class BoxType(models.TextChoices):
        INDOOR        = "indoor",        "Wewnętrzna"
        OUTDOOR       = "outdoor",       "Zewnętrzna"
        WALL_MOUNT    = "wall_mount",    "Naścienna"
        POLE_MOUNT    = "pole_mount",    "Słupowa"
        UNDERGROUND   = "underground",   "Ziemna"
        CABINET       = "cabinet",       "Szafkowa"
        OTHER         = "other",         "Inna"

    site = models.ForeignKey(
        "projects.Site", on_delete=models.CASCADE,
        related_name="subscriber_boxes", null=True, blank=True,
    )
    name = models.CharField(max_length=100)
    box_type = models.CharField(max_length=20, choices=BoxType.choices, default=BoxType.INDOOR)
    location = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_subscriber_box"
        ordering = ["site__name", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_box_type_display()})"


class SubscriberBoxPort(models.Model):
    """Pojedynczy port w puszce abonenckiej."""

    class PortDirection(models.TextChoices):
        TRUNK = "trunk",       "Wejście (trunk)"
        DROP  = "drop",        "Wyjście (abonent)"

    MEDIA_CHOICES = [
        ("copper",       "Copper — RJ45"),
        ("copper_rj11",  "Copper — RJ11"),
        ("fiber_lc_sm",  "Fiber SM — LC"),
        ("fiber_sc_sm",  "Fiber SM — SC"),
        ("fiber_sc_apc", "Fiber SM — SC/APC"),
        ("fiber_sc_upc", "Fiber SM — SC/UPC"),
        ("fiber_st_sm",  "Fiber SM — ST"),
        ("fiber_fc_sm",  "Fiber SM — FC"),
        ("fiber_lc_mm",  "Fiber MM — LC"),
        ("fiber_sc_mm",  "Fiber MM — SC"),
        ("fiber_mpo12",  "Fiber MPO-12"),
        ("fiber_mpo24",  "Fiber MPO-24"),
        ("other",        "Inne"),
    ]

    box = models.ForeignKey(SubscriberBox, on_delete=models.CASCADE, related_name="ports")
    port_number = models.PositiveIntegerField()
    label = models.CharField(max_length=100, blank=True)
    direction = models.CharField(max_length=10, choices=PortDirection.choices, default=PortDirection.DROP)
    media_type = models.CharField(max_length=30, choices=MEDIA_CHOICES, default="fiber_sc_apc")

    class Meta:
        db_table = "ipam_subscriber_box_port"
        ordering = ["box", "direction", "port_number"]
        unique_together = [["box", "port_number", "direction"]]

    def __str__(self):
        return f"{self.box.name} – {self.get_direction_display()} {self.port_number}"


class SubscriberBoxConnection(models.Model):
    """Połączenie portu puszki z portem patch panelu lub innego urządzenia."""

    box_port = models.OneToOneField(
        SubscriberBoxPort, on_delete=models.CASCADE, related_name="connection",
    )
    panel_port = models.OneToOneField(
        "ipam.PatchPanelPort", on_delete=models.SET_NULL,
        related_name="subscriber_box_connection", null=True, blank=True,
    )
    device_port = models.OneToOneField(
        "ipam.HostPort", on_delete=models.SET_NULL,
        related_name="subscriber_box_connection", null=True, blank=True,
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_subscriber_box_connection"
