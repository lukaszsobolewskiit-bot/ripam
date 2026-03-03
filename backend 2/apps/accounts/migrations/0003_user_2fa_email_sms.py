from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_totp'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='email_2fa_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='phone_number',
            field=models.CharField(max_length=30, blank=True, default=''),
        ),
        migrations.AddField(
            model_name='user',
            name='sms_2fa_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='otp_code',
            field=models.CharField(max_length=8, blank=True, default=''),
        ),
        migrations.AddField(
            model_name='user',
            name='otp_expires',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='otp_type',
            field=models.CharField(max_length=10, blank=True, default=''),
        ),
    ]
