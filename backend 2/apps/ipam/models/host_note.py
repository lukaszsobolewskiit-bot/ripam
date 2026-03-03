from django.db import models


class HostNote(models.Model):
    host = models.ForeignKey("ipam.Host", on_delete=models.CASCADE, related_name="notes")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_host_note"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note for {self.host} ({self.created_at:%Y-%m-%d})"
