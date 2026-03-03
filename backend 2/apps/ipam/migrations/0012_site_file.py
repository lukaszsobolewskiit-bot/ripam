from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0011_portconnection_project_notes_files'),
        ('projects', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SiteFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('site', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to='projects.site')),
                ('name', models.CharField(max_length=255)),
                ('file', models.FileField(upload_to='site_files/')),
                ('size', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_site_file', 'ordering': ['-created_at']},
        ),
    ]
