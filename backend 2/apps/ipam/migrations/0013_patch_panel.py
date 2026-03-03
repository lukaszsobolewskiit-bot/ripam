from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0012_site_file'),
        ('projects', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PatchPanel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('site', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='patch_panels', to='projects.site')),
                ('name', models.CharField(max_length=100)),
                ('media_type', models.CharField(
                    choices=[('copper','Copper (RJ45)'),('fiber_lc','Fiber (LC)'),('fiber_sc','Fiber (SC)'),('fiber_st','Fiber (ST)'),('fiber_mtp','Fiber (MTP/MPO)')],
                    default='copper', max_length=20)),
                ('port_count', models.PositiveIntegerField(default=24)),
                ('location', models.CharField(blank=True, max_length=200)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_patch_panel', 'ordering': ['site__name', 'name']},
        ),
        migrations.CreateModel(
            name='PatchPanelPort',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('panel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ports', to='ipam.patchpanel')),
                ('port_number', models.PositiveIntegerField()),
                ('label', models.CharField(blank=True, max_length=50)),
            ],
            options={'db_table': 'ipam_patch_panel_port', 'ordering': ['panel', 'port_number']},
        ),
        migrations.AddConstraint(
            model_name='patchpanelport',
            constraint=models.UniqueConstraint(fields=['panel', 'port_number'], name='unique_panel_port'),
        ),
        migrations.CreateModel(
            name='PatchPanelConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('project', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='patch_connections', to='projects.project')),
                ('device_port', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='patch_connection', to='ipam.hostport')),
                ('panel_port', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='connections', to='ipam.patchpanelport')),
                ('far_panel_port', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='far_connections', to='ipam.patchpanelport')),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_patch_panel_connection', 'ordering': ['panel_port__panel__name', 'panel_port__port_number']},
        ),
    ]
