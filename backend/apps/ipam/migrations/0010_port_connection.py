from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0009_manufacturer_devicemodel_porttemplate_hostport'),
    ]

    operations = [
        migrations.CreateModel(
            name='PortConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('port_a', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='connection_as_a',
                    to='ipam.hostport',
                )),
                ('port_b', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='connection_as_b',
                    to='ipam.hostport',
                )),
            ],
            options={
                'db_table': 'ipam_port_connection',
            },
        ),
    ]
