from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0010_port_connection'),
        ('projects', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='portconnection',
            name='project',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='port_connections',
                to='projects.project',
            ),
        ),
        migrations.CreateModel(
            name='HostNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('host', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notes', to='ipam.host')),
                ('content', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'ipam_host_note', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='HostFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('host', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to='ipam.host')),
                ('name', models.CharField(max_length=255)),
                ('file', models.FileField(upload_to='host_files/')),
                ('size', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_host_file', 'ordering': ['-created_at']},
        ),
    ]
