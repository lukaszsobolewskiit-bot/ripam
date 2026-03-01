from django.db import models


class SiteFile(models.Model):
    site = models.ForeignKey(
        "projects.Site", on_delete=models.CASCADE, related_name="files"
    )
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="site_files/")
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ipam_site_file"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.site})"
