from django.db import models


class SiteNote(models.Model):
    site = models.ForeignKey(
        "projects.Site", on_delete=models.CASCADE, related_name="notes"
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_site_note"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note for {self.site.name} [{self.id}]"


class ProjectNote(models.Model):
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="notes"
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ipam_project_note"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note for {self.project.name} [{self.id}]"
