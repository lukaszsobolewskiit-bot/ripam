from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Host, HostPort


@receiver(post_save, sender=Host)
def copy_ports_from_model(sender, instance, created, **kwargs):
    """
    When a device_model is assigned to a host, copy port templates as HostPorts.
    Only copies if the host has no ports yet (avoids overwriting on every save).
    """
    if not instance.device_model_id:
        return

    # Avoid recursive signal triggering
    if not created and not _device_model_changed(instance):
        return

    existing_ports = HostPort.objects.filter(host=instance)
    if existing_ports.exists():
        return

    templates = instance.device_model.port_templates.all()
    ports_to_create = [
        HostPort(
            host=instance,
            name=pt.name,
            port_type=pt.port_type,
            position=pt.position,
        )
        for pt in templates
    ]
    if ports_to_create:
        HostPort.objects.bulk_create(ports_to_create)


def _device_model_changed(instance):
    """Check if device_model field changed by comparing to DB."""
    try:
        old = Host.objects.get(pk=instance.pk)
        return old.device_model_id != instance.device_model_id
    except Host.DoesNotExist:
        return False
