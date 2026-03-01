from django.db import models


class PatchPanel(models.Model):
    """Physical patch panel installed at a site."""

    class MediaType(models.TextChoices):
        # ── Copper ─────────────────────────────────────────────────────────
        COPPER_RJ45   = "copper",         "Copper — RJ45"
        COPPER_RJ11   = "copper_rj11",    "Copper — RJ11"
        COPPER_COAX   = "copper_coax",    "Copper — Coax (BNC/F)"
        # ── Fiber singlemode ───────────────────────────────────────────────
        FIBER_LC_SM   = "fiber_lc_sm",    "Fiber SM — LC"
        FIBER_SC_SM   = "fiber_sc_sm",    "Fiber SM — SC"
        FIBER_SC_APC  = "fiber_sc_apc",   "Fiber SM — SC/APC"
        FIBER_SC_UPC  = "fiber_sc_upc",   "Fiber SM — SC/UPC"
        FIBER_ST_SM   = "fiber_st_sm",    "Fiber SM — ST"
        FIBER_FC_SM   = "fiber_fc_sm",    "Fiber SM — FC"
        FIBER_E2000   = "fiber_e2000",    "Fiber SM — E2000"
        FIBER_LSH     = "fiber_lsh",      "Fiber SM — LSH/E2000"
        # ── Fiber multimode ────────────────────────────────────────────────
        FIBER_LC_MM   = "fiber_lc_mm",    "Fiber MM — LC"
        FIBER_LC_APC  = "fiber_lc_apc",   "Fiber MM — LC/APC"
        FIBER_SC_MM   = "fiber_sc_mm",    "Fiber MM — SC"
        FIBER_ST_MM   = "fiber_st_mm",    "Fiber MM — ST"
        FIBER_FC_MM   = "fiber_fc_mm",    "Fiber MM — FC"
        # ── MPO / MTP ──────────────────────────────────────────────────────
        FIBER_MPO12   = "fiber_mpo12",    "Fiber MTP/MPO-12"
        FIBER_MPO24   = "fiber_mpo24",    "Fiber MTP/MPO-24"
        FIBER_MTP     = "fiber_mtp",      "Fiber MTP (generic)"
        # ── Pre-terminated ────────────────────────────────────────────────
        FIBER_PRETM   = "fiber_pretm",    "Fiber — Pre-terminated trunk"
        # ── HDMI / Video ──────────────────────────────────────────────────
        HDMI          = "hdmi",           "HDMI"
        DISPLAYPORT   = "displayport",    "DisplayPort"
        # ── Keystone / Blank ──────────────────────────────────────────────
        KEYSTONE      = "keystone",       "Keystone (generic)"
        BLANK_1U      = "blank_1u",       "Blank 1U"
        MIXED         = "mixed",          "Mixed / Keystone panel"

    site = models.ForeignKey(
        "projects.Site",
        on_delete=models.CASCADE,
        related_name="patch_panels",
        null=True, blank=True,
    )
    name = models.CharField(max_length=100)
    media_type = models.CharField(
        max_length=30,
        choices=MediaType.choices,
        default=MediaType.COPPER_RJ45,
    )
    port_count = models.PositiveIntegerField(default=24)
    location = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_patch_panel"
        ordering = ["site__name", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_media_type_display()}, {self.port_count}p)"


class PatchPanelPort(models.Model):
    panel = models.ForeignKey(PatchPanel, on_delete=models.CASCADE, related_name="ports")
    port_number = models.PositiveIntegerField()
    label = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "ipam_patch_panel_port"
        ordering = ["panel", "port_number"]
        unique_together = [["panel", "port_number"]]

    def __str__(self):
        return f"{self.panel.name} – Port {self.port_number}"


class PatchPanelConnection(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE,
        related_name="patch_connections", null=True, blank=True,
    )
    device_port = models.OneToOneField(
        "ipam.HostPort", on_delete=models.CASCADE,
        related_name="patch_connection", null=True, blank=True,
    )
    panel_port = models.ForeignKey(
        PatchPanelPort, on_delete=models.CASCADE, related_name="connections",
    )
    far_panel_port = models.OneToOneField(
        PatchPanelPort, on_delete=models.SET_NULL,
        related_name="far_connections", null=True, blank=True,
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_patch_panel_connection"
        ordering = ["panel_port__panel__name", "panel_port__port_number"]
