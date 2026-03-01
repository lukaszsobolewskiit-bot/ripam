from django.db import models


class PatchPanel(models.Model):
    """Physical patch panel installed at a site."""

    class MediaType(models.TextChoices):
        COPPER = "copper", "Copper (RJ45)"
        FIBER_LC = "fiber_lc", "Fiber (LC)"
        FIBER_SC = "fiber_sc", "Fiber (SC)"
        FIBER_ST = "fiber_st", "Fiber (ST)"
        FIBER_MTP = "fiber_mtp", "Fiber (MTP/MPO)"

    site = models.ForeignKey(
        "projects.Site",
        on_delete=models.CASCADE,
        related_name="patch_panels",
        null=True, blank=True,
    )
    name = models.CharField(max_length=100)
    media_type = models.CharField(
        max_length=20,
        choices=MediaType.choices,
        default=MediaType.COPPER,
    )
    port_count = models.PositiveIntegerField(default=24)
    location = models.CharField(max_length=200, blank=True, help_text="Rack/location description")
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_patch_panel"
        ordering = ["site__name", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_media_type_display()}, {self.port_count}p)"


class PatchPanelPort(models.Model):
    """Individual port on a patch panel."""

    panel = models.ForeignKey(
        PatchPanel,
        on_delete=models.CASCADE,
        related_name="ports",
    )
    port_number = models.PositiveIntegerField()
    label = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "ipam_patch_panel_port"
        ordering = ["panel", "port_number"]
        unique_together = [["panel", "port_number"]]

    def __str__(self):
        label = self.label or f"Port {self.port_number}"
        return f"{self.panel.name} – {label}"


class PatchPanelConnection(models.Model):
    """
    Connects a device port to a patch panel port.
    A full path is: device_port ↔ panel_port_a ... panel_port_b ↔ device_port_b
    We model this as two separate PatchPanelConnection records per physical cable,
    or as a straight device↔panel connection if only one end is patched.
    """

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="patch_connections",
        null=True, blank=True,
    )
    # Device side
    device_port = models.OneToOneField(
        "ipam.HostPort",
        on_delete=models.CASCADE,
        related_name="patch_connection",
        null=True, blank=True,
    )
    # Patch panel side
    panel_port = models.ForeignKey(
        PatchPanelPort,
        on_delete=models.CASCADE,
        related_name="connections",
    )
    # Optional: link two panel ports together (cross-connect / jumper)
    far_panel_port = models.OneToOneField(
        PatchPanelPort,
        on_delete=models.SET_NULL,
        related_name="far_connections",
        null=True, blank=True,
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_patch_panel_connection"
        ordering = ["panel_port__panel__name", "panel_port__port_number"]

    def __str__(self):
        device = str(self.device_port) if self.device_port else "—"
        return f"{device} → {self.panel_port}"
