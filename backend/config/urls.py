"""URL configuration for SobNet project."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.projects.urls")),
    path("api/v1/", include("apps.ipam.urls")),
    path("api/v1/", include("apps.search.urls")),
    path("api/v1/", include("apps.audit.urls")),
    path("api/v1/", include("apps.exports.urls")),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/tools/", include("apps.ipam.tools_urls")),
]

# Always serve media files (for development + production with reverse proxy)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [
        path("__debug__/", include(debug_toolbar.urls)),
    ] + urlpatterns
