from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0016_subscriber_box_panel_templates'),
    ]

    operations = [
        migrations.CreateModel(
            name='PDU',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('rack_unit', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='pdu', to='ipam.rackunit',
                )),
                ('name', models.CharField(max_length=100)),
                ('pdu_type', models.CharField(
                    max_length=20, default='basic',
                    choices=[
                        ('basic','Basic (bez zarządzania)'),
                        ('metered','Metered (pomiar prądu)'),
                        ('switched','Switched (sterowanie gniazdami)'),
                        ('smart','Smart (IP + monitoring)'),
                    ],
                )),
                ('outlet_type', models.CharField(
                    max_length=20, default='c13',
                    choices=[
                        ('c13','IEC C13'),('c19','IEC C19'),('schuko','Schuko (CEE 7/4)'),
                        ('mixed','Mieszany C13/C19'),('uk_g','UK BS 1363'),('nema','US NEMA 5-15'),
                    ],
                )),
                ('outlet_count', models.PositiveIntegerField(default=8)),
                ('max_ampere', models.PositiveIntegerField(default=16)),
                ('voltage', models.PositiveIntegerField(default=230)),
                ('manufacturer', models.CharField(max_length=100, blank=True)),
                ('model_name', models.CharField(max_length=100, blank=True)),
                ('serial_number', models.CharField(max_length=100, blank=True)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_pdu'},
        ),
        migrations.CreateModel(
            name='PDUOutlet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('pdu', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='outlets', to='ipam.pdu',
                )),
                ('outlet_number', models.PositiveIntegerField()),
                ('label', models.CharField(max_length=100, blank=True)),
                ('rack_unit', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='pdu_outlets', to='ipam.rackunit',
                )),
                ('current_a', models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)),
                ('is_on', models.BooleanField(default=True)),
            ],
            options={'db_table': 'ipam_pdu_outlet', 'ordering': ['pdu', 'outlet_number']},
        ),
        migrations.AddConstraint(
            model_name='pduoutlet',
            constraint=models.UniqueConstraint(
                fields=['pdu', 'outlet_number'],
                name='unique_pdu_outlet_number',
            ),
        ),
    ]
