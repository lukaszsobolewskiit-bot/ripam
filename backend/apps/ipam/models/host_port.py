from django.db import models


class HostPort(models.Model):
    class PortType(models.TextChoices):
        RJ45 = "rj45", "RJ45"
        SFP = "sfp", "SFP"
        SFP_PLUS = "sfp+", "SFP+"
        QSFP = "qsfp", "QSFP"
        USB = "usb", "USB"
        SERIAL = "serial", "Serial"

    host = models.ForeignKey(
        "ipam.Host", on_delete=models.CASCADE, related_name="ports"
    )
    name = models.CharField(max_length=50)
    port_type = models.CharField(max_length=20, choices=PortType.choices, default=PortType.RJ45)
    description = models.TextField(blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "ipam_host_port"
        ordering = ["position", "name"]
        unique_together = [["host", "name"]]

    def __str__(self):
        return f"{self.host} – {self.name} ({self.get_port_type_display()})"
