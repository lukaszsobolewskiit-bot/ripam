from django.db import models


class Rack(models.Model):

    class Status(models.TextChoices):
        ACTIVE           = "active",           "Active"
        PLANNED          = "planned",           "Planned"
        RESERVED         = "reserved",          "Reserved"
        DECOMMISSIONING  = "decommissioning",   "Decommissioning"
        RETIRED          = "retired",           "Retired"

    class RackType(models.TextChoices):
        TWO_POST_OPEN    = "2post_open",   "2-post open frame"
        TWO_POST_CLOSED  = "2post_closed", "2-post closed"
        FOUR_POST_OPEN   = "4post_open",   "4-post open frame"
        FOUR_POST_CLOSED = "4post_closed", "4-post closed cabinet"
        WALL_OPEN        = "wall_open",    "Wall-mount open"
        WALL_CLOSED      = "wall_closed",  "Wall-mount closed"

    site = models.ForeignKey(
        "projects.Site", on_delete=models.CASCADE, related_name="racks"
    )
    name = models.CharField(max_length=100)
    facility_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.ACTIVE)
    rack_type = models.CharField(max_length=30, choices=RackType.choices, default=RackType.FOUR_POST_CLOSED)
    height_u = models.PositiveIntegerField(default=42)
    numbering_desc = models.BooleanField(default=False)
    width_mm = models.PositiveIntegerField(default=600)
    depth_mm = models.PositiveIntegerField(default=1000)
    serial_number = models.CharField(max_length=100, blank=True)
    asset_tag = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_rack"
        ordering = ["site__name", "name"]

    def __str__(self):
        return f"{self.name} @ {self.site.name}"


class RackUnit(models.Model):

    class ItemType(models.TextChoices):
        DEVICE      = "device",      "Device / Host"
        PATCH_PANEL = "patch_panel", "Patch Panel"
        CABLE_MGMT  = "cable_mgmt",  "Cable Management"
        BLANK       = "blank",       "Blank Panel"
        PDU         = "pdu",         "PDU"
        UPS         = "ups",         "UPS"
        OTHER       = "other",       "Other"

    rack = models.ForeignKey(Rack, on_delete=models.CASCADE, related_name="rack_units")
    host = models.ForeignKey(
        "ipam.Host", on_delete=models.SET_NULL,
        related_name="rack_units", null=True, blank=True,
    )
    patch_panel = models.ForeignKey(
        "ipam.PatchPanel", on_delete=models.SET_NULL,
        related_name="rack_units", null=True, blank=True,
    )
    position_u = models.PositiveIntegerField()
    height_u = models.PositiveIntegerField(default=1)
    face = models.CharField(max_length=10, default="front",
                            choices=[("front", "Front"), ("rear", "Rear")])
    label = models.CharField(max_length=200, blank=True)
    item_type = models.CharField(max_length=30, choices=ItemType.choices, default=ItemType.DEVICE)
    color = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_rack_unit"
        ordering = ["rack", "position_u"]
        constraints = [
            models.UniqueConstraint(fields=["rack", "position_u", "face"], name="unique_rack_unit_face")
        ]

    def __str__(self):
        label = self.label or (str(self.host) if self.host else "Empty")
        return f"{self.rack.name} U{self.position_u} – {label}"
