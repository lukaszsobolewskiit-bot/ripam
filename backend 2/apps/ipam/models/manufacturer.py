from django.db import models


class Manufacturer(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "ipam_manufacturer"
        ordering = ["name"]

    def __str__(self):
        return self.name


class DeviceModel(models.Model):
    manufacturer = models.ForeignKey(
        Manufacturer, on_delete=models.CASCADE, related_name="device_models"
    )
    name = models.CharField(max_length=100)
    device_type = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "ipam_device_model"
        ordering = ["manufacturer__name", "name"]
        unique_together = [["manufacturer", "name"]]

    def __str__(self):
        return f"{self.manufacturer.name} {self.name}"


class PortTemplate(models.Model):
    class PortType(models.TextChoices):
        RJ45 = "rj45", "RJ45"
        SFP = "sfp", "SFP"
        SFP_PLUS = "sfp+", "SFP+"
        QSFP = "qsfp", "QSFP"
        USB = "usb", "USB"
        SERIAL = "serial", "Serial"

    device_model = models.ForeignKey(
        DeviceModel, on_delete=models.CASCADE, related_name="port_templates"
    )
    name = models.CharField(max_length=50)
    port_type = models.CharField(max_length=20, choices=PortType.choices, default=PortType.RJ45)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ipam_port_template"
        ordering = ["position", "name"]
        unique_together = [["device_model", "name"]]

    def __str__(self):
        return f"{self.device_model} – {self.name} ({self.get_port_type_display()})"
