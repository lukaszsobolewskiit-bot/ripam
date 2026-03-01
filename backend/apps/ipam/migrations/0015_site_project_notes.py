from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0014_rack'),
        ('projects', '0005_remove_project_status'),
    ]

    operations = [
        # Add SC/APC and SC/UPC media types to PatchPanel
        migrations.AlterField(
            model_name='patchpanel',
            name='media_type',
            field=models.CharField(
                max_length=30,
                default='copper',
                choices=[
                    ('copper','Copper — RJ45'),
                    ('copper_rj11','Copper — RJ11'),
                    ('copper_coax','Copper — Coax (BNC/F)'),
                    ('fiber_lc_sm','Fiber SM — LC'),
                    ('fiber_sc_sm','Fiber SM — SC'),
                    ('fiber_sc_apc','Fiber SM — SC/APC'),
                    ('fiber_sc_upc','Fiber SM — SC/UPC'),
                    ('fiber_st_sm','Fiber SM — ST'),
                    ('fiber_fc_sm','Fiber SM — FC'),
                    ('fiber_e2000','Fiber SM — E2000'),
                    ('fiber_lsh','Fiber SM — LSH/E2000'),
                    ('fiber_lc_mm','Fiber MM — LC'),
                    ('fiber_lc_apc','Fiber MM — LC/APC'),
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
                    ('mixed','Mixed / Keystone panel'),
                ],
            ),
        ),
        # SiteNote
        migrations.CreateModel(
            name='SiteNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('site', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notes', to='projects.site',
                )),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'ipam_site_note', 'ordering': ['-created_at']},
        ),
        # ProjectNote
        migrations.CreateModel(
            name='ProjectNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('project', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notes', to='projects.project',
                )),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'ipam_project_note', 'ordering': ['-created_at']},
        ),
    ]
