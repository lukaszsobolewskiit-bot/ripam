from django.apps import AppConfig


class IpamConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ipam"
    label = "ipam"

    def ready(self):
        import apps.ipam.signals  # noqa: F401
