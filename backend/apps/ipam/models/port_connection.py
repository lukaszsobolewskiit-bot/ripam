from django.db import models


class PortConnection(models.Model):
    port_a = models.OneToOneField(
        "ipam.HostPort",
        on_delete=models.CASCADE,
        related_name="connection_as_a",
    )
    port_b = models.OneToOneField(
        "ipam.HostPort",
        on_delete=models.CASCADE,
        related_name="connection_as_b",
    )
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_port_connection"

    def __str__(self):
        return f"{self.port_a} ↔ {self.port_b}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.port_a_id and self.port_b_id and self.port_a_id == self.port_b_id:
            raise ValidationError("A port cannot be connected to itself.")
