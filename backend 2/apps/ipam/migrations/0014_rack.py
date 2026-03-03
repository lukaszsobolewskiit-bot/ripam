from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0013_patch_panel'),
        ('projects', '0001_initial'),
    ]

    operations = [
        # Update media_type max_length and choices
        migrations.AlterField(
            model_name='patchpanel',
            name='media_type',
            field=models.CharField(
                choices=[
                    ('copper','Copper — RJ45'),
                    ('copper_rj11','Copper — RJ11'),
                    ('copper_coax','Copper — Coax (BNC/F)'),
                    ('fiber_lc_sm','Fiber SM — LC'),
                    ('fiber_sc_sm','Fiber SM — SC'),
                    ('fiber_st_sm','Fiber SM — ST'),
                    ('fiber_fc_sm','Fiber SM — FC'),
                    ('fiber_e2000','Fiber SM — E2000'),
                    ('fiber_lsh','Fiber SM — LSH/E2000'),
                    ('fiber_lc_mm','Fiber MM — LC'),
                    ('fiber_sc_mm','Fiber MM — SC'),
                    ('fiber_st_mm','Fiber MM — ST'),
                    ('fiber_fc_mm','Fiber MM — FC'),
                    ('fiber_mpo12','Fiber MTP/MPO-12'),
                    ('fiber_mpo24','Fiber MTP/MPO-24'),
                    ('fiber_mtp','Fiber MTP (generic)'),
                    ('fiber_pretm','Fiber — Pre-terminated trunk'),
                    ('hdmi','HDMI'),
                    ('displayport','DisplayPort'),
                    ('keystone','Keystone (generic)'),
                    ('blank_1u','Blank 1U'),
                ],
                default='copper',
                max_length=30,
            ),
        ),
        # ── Rack model ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Rack',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('site', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='racks', to='projects.site',
                )),
                ('name', models.CharField(max_length=100)),
                ('facility_id', models.CharField(blank=True, max_length=100)),
                ('status', models.CharField(
                    max_length=30, default='active',
                    choices=[
                        ('active','Active'),
                        ('planned','Planned'),
                        ('reserved','Reserved'),
                        ('decommissioning','Decommissioning'),
                        ('retired','Retired'),
                    ],
                )),
                ('rack_type', models.CharField(
                    max_length=30, default='4post_closed',
                    choices=[
                        ('2post_open','2-post open frame'),
                        ('2post_closed','2-post closed'),
                        ('4post_open','4-post open frame'),
                        ('4post_closed','4-post closed cabinet'),
                        ('wall_open','Wall-mount open'),
                        ('wall_closed','Wall-mount closed'),
                    ],
                )),
                ('height_u', models.PositiveIntegerField(default=42)),
                ('numbering_desc', models.BooleanField(
                    default=False,
                    help_text='If true U1 is at the TOP (descending). Default False = U1 at bottom (ascending).'
                )),
                ('width_mm', models.PositiveIntegerField(default=600)),
                ('depth_mm', models.PositiveIntegerField(default=1000)),
                ('serial_number', models.CharField(blank=True, max_length=100)),
                ('asset_tag', models.CharField(blank=True, max_length=100)),
                ('location', models.CharField(blank=True, max_length=200, help_text='Row/room/floor')),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'ipam_rack', 'ordering': ['site__name', 'name']},
        ),
        # ── RackUnit: a device occupying U slots in a rack ──────────────────
        migrations.CreateModel(
            name='RackUnit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('rack', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='rack_units', to='ipam.rack',
                )),
                # host is optional – rack units can be unmanaged devices, blank panels, etc.
                ('host', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='rack_units', to='ipam.host',
                    null=True, blank=True,
                )),
                ('patch_panel', models.ForeignKey(
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='rack_units', to='ipam.patchpanel',
                    null=True, blank=True,
                )),
                ('position_u', models.PositiveIntegerField(help_text='Lowest U occupied (1 = bottom)')),
                ('height_u', models.PositiveIntegerField(default=1)),
                ('face', models.CharField(max_length=10, default='front', choices=[('front','Front'),('rear','Rear')])),
                # For unmanaged items (blank panels, cable managers, etc.)
                ('label', models.CharField(blank=True, max_length=200)),
                ('item_type', models.CharField(
                    max_length=30, default='device',
                    choices=[
                        ('device','Device / Host'),
                        ('patch_panel','Patch Panel'),
                        ('cable_mgmt','Cable Management'),
                        ('blank','Blank Panel'),
                        ('pdu','PDU'),
                        ('ups','UPS'),
                        ('other','Other'),
                    ],
                )),
                ('color', models.CharField(blank=True, max_length=20, help_text='Tailwind color name or hex')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_rack_unit', 'ordering': ['rack', 'position_u']},
        ),
        migrations.AddConstraint(
            model_name='rackunit',
            constraint=models.UniqueConstraint(
                fields=['rack', 'position_u', 'face'], name='unique_rack_unit_face'
            ),
        ),
    ]
