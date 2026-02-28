from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0008_device_type_configurable'),
    ]

    operations = [
        # Manufacturer
        migrations.CreateModel(
            name='Manufacturer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('slug', models.SlugField(unique=True)),
                ('description', models.TextField(blank=True)),
            ],
            options={
                'db_table': 'ipam_manufacturer',
                'ordering': ['name'],
            },
        ),
        # DeviceModel
        migrations.CreateModel(
            name='DeviceModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('device_type', models.CharField(max_length=50, blank=True)),
                ('description', models.TextField(blank=True)),
                ('manufacturer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='device_models',
                    to='ipam.manufacturer',
                )),
            ],
            options={
                'db_table': 'ipam_device_model',
                'ordering': ['manufacturer__name', 'name'],
            },
        ),
        migrations.AddConstraint(
            model_name='devicemodel',
            constraint=models.UniqueConstraint(fields=['manufacturer', 'name'], name='unique_manufacturer_model'),
        ),
        # PortTemplate
        migrations.CreateModel(
            name='PortTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50)),
                ('port_type', models.CharField(
                    choices=[('rj45', 'RJ45'), ('sfp', 'SFP'), ('sfp+', 'SFP+'),
                              ('qsfp', 'QSFP'), ('usb', 'USB'), ('serial', 'Serial')],
                    default='rj45', max_length=20,
                )),
                ('position', models.PositiveIntegerField(default=0)),
                ('device_model', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='port_templates',
                    to='ipam.devicemodel',
                )),
            ],
            options={
                'db_table': 'ipam_port_template',
                'ordering': ['position', 'name'],
            },
        ),
        migrations.AddConstraint(
            model_name='porttemplate',
            constraint=models.UniqueConstraint(fields=['device_model', 'name'], name='unique_model_port'),
        ),
        # HostPort
        migrations.CreateModel(
            name='HostPort',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50)),
                ('port_type', models.CharField(
                    choices=[('rj45', 'RJ45'), ('sfp', 'SFP'), ('sfp+', 'SFP+'),
                              ('qsfp', 'QSFP'), ('usb', 'USB'), ('serial', 'Serial')],
                    default='rj45', max_length=20,
                )),
                ('description', models.TextField(blank=True)),
                ('position', models.PositiveIntegerField(default=0)),
                ('host', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ports',
                    to='ipam.host',
                )),
            ],
            options={
                'db_table': 'ipam_host_port',
                'ordering': ['position', 'name'],
            },
        ),
        migrations.AddConstraint(
            model_name='hostport',
            constraint=models.UniqueConstraint(fields=['host', 'name'], name='unique_host_port'),
        ),
        # Add device_model FK to Host
        migrations.AddField(
            model_name='host',
            name='device_model',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='hosts',
                to='ipam.devicemodel',
            ),
        ),
    ]
