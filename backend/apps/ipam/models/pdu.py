"""PDU — Power Distribution Unit zainstalowany w szafie rack."""
from django.db import models


class PDU(models.Model):
    """PDU przypisane do konkretnego rack_unit w szafie."""

    class PDUType(models.TextChoices):
        BASIC       = "basic",       "Basic (bez zarządzania)"
        METERED     = "metered",     "Metered (pomiar prądu)"
        SWITCHED    = "switched",    "Switched (sterowanie gniazdami)"
        SMART       = "smart",       "Smart (IP + monitoring)"

    class OutletType(models.TextChoices):
        C13         = "c13",         "IEC C13"
        C19         = "c19",         "IEC C19"
        SCHUKO      = "schuko",      "Schuko (CEE 7/4)"
        IEC_C13_C19 = "mixed",       "Mieszany C13/C19"
        UK_G        = "uk_g",        "UK BS 1363"
        US_NEMA     = "nema",        "US NEMA 5-15"

    rack_unit = models.OneToOneField(
        "ipam.RackUnit",
        on_delete=models.CASCADE,
        related_name="pdu",
    )
    name = models.CharField(max_length=100)
    pdu_type = models.CharField(max_length=20, choices=PDUType.choices, default=PDUType.BASIC)
    outlet_type = models.CharField(max_length=20, choices=OutletType.choices, default=OutletType.C13)
    outlet_count = models.PositiveIntegerField(default=8)
    max_ampere = models.PositiveIntegerField(default=16, help_text="Maksymalny prąd [A]")
    voltage = models.PositiveIntegerField(default=230, help_text="Napięcie [V]")
    manufacturer = models.CharField(max_length=100, blank=True)
    model_name = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_pdu"

    def __str__(self):
        return f"{self.name} ({self.outlet_count}× {self.get_outlet_type_display()})"


class PDUOutlet(models.Model):
    """Pojedyncze gniazdo w PDU + opcjonalne przypisanie urządzenia z szafy."""

    pdu = models.ForeignKey(PDU, on_delete=models.CASCADE, related_name="outlets")
    outlet_number = models.PositiveIntegerField()
    label = models.CharField(max_length=100, blank=True, help_text="np. 'Core Switch', 'UPS bypass'")
    rack_unit = models.ForeignKey(
        "ipam.RackUnit",
        on_delete=models.SET_NULL,
        related_name="pdu_outlets",
        null=True, blank=True,
        help_text="Urządzenie w szafie podłączone do tego gniazda",
    )
    # Amperaż jeśli PDU ma pomiar
    current_a = models.DecimalField(
        max_digits=5, decimal_places=2,
        null=True, blank=True,
        help_text="Aktualny pobór prądu [A]",
    )
    is_on = models.BooleanField(default=True, help_text="Stan gniazda (dla Switched PDU)")

    class Meta:
        db_table = "ipam_pdu_outlet"
        ordering = ["pdu", "outlet_number"]
        unique_together = [["pdu", "outlet_number"]]

    def __str__(self):
        return f"{self.pdu.name} Gniazdo {self.outlet_number}"
