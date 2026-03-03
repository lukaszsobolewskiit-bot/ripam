from django.db import migrations, models
import django.db.models.deletion


MEDIA_CHOICES_PORT = [
    ("same",         "Taki sam jak przód"),
    ("copper",       "Copper — RJ45"),
    ("copper_rj11",  "Copper — RJ11"),
    ("fiber_lc_sm",  "Fiber SM — LC"),
    ("fiber_sc_sm",  "Fiber SM — SC"),
    ("fiber_sc_apc", "Fiber SM — SC/APC"),
    ("fiber_sc_upc", "Fiber SM — SC/UPC"),
    ("fiber_st_sm",  "Fiber SM — ST"),
    ("fiber_fc_sm",  "Fiber SM — FC"),
    ("fiber_lc_mm",  "Fiber MM — LC"),
    ("fiber_sc_mm",  "Fiber MM — SC"),
    ("fiber_mpo12",  "Fiber MPO-12"),
    ("fiber_mpo24",  "Fiber MPO-24"),
]

MEDIA_CHOICES_BOX = [
    ("copper",       "Copper — RJ45"),
    ("copper_rj11",  "Copper — RJ11"),
    ("fiber_lc_sm",  "Fiber SM — LC"),
    ("fiber_sc_sm",  "Fiber SM — SC"),
    ("fiber_sc_apc", "Fiber SM — SC/APC"),
    ("fiber_sc_upc", "Fiber SM — SC/UPC"),
    ("fiber_st_sm",  "Fiber SM — ST"),
    ("fiber_fc_sm",  "Fiber SM — FC"),
    ("fiber_lc_mm",  "Fiber MM — LC"),
    ("fiber_sc_mm",  "Fiber MM — SC"),
    ("fiber_mpo12",  "Fiber MPO-12"),
    ("fiber_mpo24",  "Fiber MPO-24"),
    ("other",        "Inne"),
]

MEDIA_CHOICES_TPL = [
    ("copper","Copper — RJ45"),("copper_rj11","Copper — RJ11"),("copper_coax","Copper — Coax"),
    ("fiber_lc_sm","Fiber SM — LC"),("fiber_sc_sm","Fiber SM — SC"),("fiber_sc_apc","Fiber SM — SC/APC"),
    ("fiber_sc_upc","Fiber SM — SC/UPC"),("fiber_st_sm","Fiber SM — ST"),("fiber_fc_sm","Fiber SM — FC"),
    ("fiber_e2000","Fiber SM — E2000"),("fiber_lsh","Fiber SM — LSH"),("fiber_lc_mm","Fiber MM — LC"),
    ("fiber_lc_apc","Fiber MM — LC/APC"),("fiber_sc_mm","Fiber MM — SC"),("fiber_st_mm","Fiber MM — ST"),
    ("fiber_fc_mm","Fiber MM — FC"),("fiber_mpo12","Fiber MPO-12"),("fiber_mpo24","Fiber MPO-24"),
    ("fiber_mtp","Fiber MTP"),("other","Inne"),
]


class Migration(migrations.Migration):

    dependencies = [
        ('ipam', '0015_site_project_notes'),
        ('projects', '0005_remove_project_status'),
    ]

    operations = [
        # Add back_media_type to PatchPanelPort
        migrations.AddField(
            model_name='patchpanelport',
            name='back_media_type',
            field=models.CharField(
                max_length=30, choices=MEDIA_CHOICES_PORT, default='same',
                help_text='Typ złącza po stronie tylnej',
            ),
        ),

        # PanelPortTemplate
        migrations.CreateModel(
            name='PanelPortTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=150)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_panel_port_template', 'ordering': ['name']},
        ),
        migrations.CreateModel(
            name='PanelPortTemplateEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('template', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='entries', to='ipam.panelporttemplate',
                )),
                ('count', models.PositiveIntegerField(default=1)),
                ('media_type', models.CharField(max_length=30, choices=MEDIA_CHOICES_TPL, default='fiber_sc_apc')),
                ('face', models.CharField(max_length=10, choices=[('front','Przód'),('back','Tył')], default='front')),
                ('label_prefix', models.CharField(max_length=50, blank=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
            ],
            options={'db_table': 'ipam_panel_port_template_entry', 'ordering': ['template','sort_order','face']},
        ),

        # SubscriberBox
        migrations.CreateModel(
            name='SubscriberBox',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('site', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='subscriber_boxes', to='projects.site',
                )),
                ('name', models.CharField(max_length=100)),
                ('box_type', models.CharField(
                    max_length=20, default='indoor',
                    choices=[
                        ('indoor','Wewnętrzna'),('outdoor','Zewnętrzna'),('wall_mount','Naścienna'),
                        ('pole_mount','Słupowa'),('underground','Ziemna'),('cabinet','Szafkowa'),('other','Inna'),
                    ],
                )),
                ('location', models.CharField(max_length=200, blank=True)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_subscriber_box', 'ordering': ['site__name', 'name']},
        ),
        migrations.CreateModel(
            name='SubscriberBoxPort',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('box', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ports', to='ipam.subscriberbox',
                )),
                ('port_number', models.PositiveIntegerField()),
                ('label', models.CharField(max_length=100, blank=True)),
                ('direction', models.CharField(
                    max_length=10, default='drop',
                    choices=[('trunk','Wejście (trunk)'),('drop','Wyjście (abonent)')],
                )),
                ('media_type', models.CharField(max_length=30, choices=MEDIA_CHOICES_BOX, default='fiber_sc_apc')),
            ],
            options={'db_table': 'ipam_subscriber_box_port', 'ordering': ['box','direction','port_number']},
        ),
        migrations.AddConstraint(
            model_name='subscriberboxport',
            constraint=models.UniqueConstraint(
                fields=['box', 'port_number', 'direction'],
                name='unique_box_port_direction',
            ),
        ),
        migrations.CreateModel(
            name='SubscriberBoxConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('box_port', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='connection', to='ipam.subscriberboxport',
                )),
                ('panel_port', models.OneToOneField(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='subscriber_box_connection', to='ipam.patchpanelport',
                )),
                ('device_port', models.OneToOneField(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='subscriber_box_connection', to='ipam.hostport',
                )),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'ipam_subscriber_box_connection'},
        ),
    ]
