"""
PanelPortTemplate — konfiguracja pól (portów) dla szablonu panelu.
Pozwala zdefiniować np. "4x SC/APC + 8x SC/UPC" jako jeden szablon.
"""
from django.db import models


class PanelPortTemplate(models.Model):
    """
    Szablon zestawu portów — np. '4xFO SC/APC + 8xFO SC/UPC'.
    Można go wielokrotnie stosować przy tworzeniu paneli.
    """
    name = models.CharField(max_length=150, help_text='np. 4xFO SC/APC + 8xFO SC/UPC')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_panel_port_template"
        ordering = ["name"]

    def __str__(self):
        return self.name


class PanelPortTemplateEntry(models.Model):
    """Jeden wpis w szablonie — np. '4x SC/APC front, 4x SC/APC back'."""

    MEDIA_CHOICES = [
        ("copper",       "Copper — RJ45"),
        ("copper_rj11",  "Copper — RJ11"),
        ("copper_coax",  "Copper — Coax"),
        ("fiber_lc_sm",  "Fiber SM — LC"),
        ("fiber_sc_sm",  "Fiber SM — SC"),
        ("fiber_sc_apc", "Fiber SM — SC/APC"),
        ("fiber_sc_upc", "Fiber SM — SC/UPC"),
        ("fiber_st_sm",  "Fiber SM — ST"),
        ("fiber_fc_sm",  "Fiber SM — FC"),
        ("fiber_e2000",  "Fiber SM — E2000"),
        ("fiber_lsh",    "Fiber SM — LSH"),
        ("fiber_lc_mm",  "Fiber MM — LC"),
        ("fiber_lc_apc", "Fiber MM — LC/APC"),
        ("fiber_sc_mm",  "Fiber MM — SC"),
        ("fiber_st_mm",  "Fiber MM — ST"),
        ("fiber_fc_mm",  "Fiber MM — FC"),
        ("fiber_mpo12",  "Fiber MPO-12"),
        ("fiber_mpo24",  "Fiber MPO-24"),
        ("fiber_mtp",    "Fiber MTP"),
        ("other",        "Inne"),
    ]

    FACE_CHOICES = [
        ("front", "Przód"),
        ("back",  "Tył"),
    ]

    template = models.ForeignKey(PanelPortTemplate, on_delete=models.CASCADE, related_name="entries")
    count = models.PositiveIntegerField(default=1, help_text='Liczba portów tego typu')
    media_type = models.CharField(max_length=30, choices=MEDIA_CHOICES, default='fiber_sc_apc')
    face = models.CharField(max_length=10, choices=FACE_CHOICES, default='front')
    label_prefix = models.CharField(max_length=50, blank=True, help_text='np. FO- → FO-1, FO-2…')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ipam_panel_port_template_entry"
        ordering = ["template", "sort_order", "face"]

    def __str__(self):
        return f"{self.count}× {self.get_media_type_display()} ({self.face})"
