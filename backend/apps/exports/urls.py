from django.urls import path

from . import views

urlpatterns = [
    path("exports/project/<int:project_id>/excel/",          views.ProjectExcelView.as_view(),  name="export-excel"),
    path("exports/project/<int:project_id>/pdf/",            views.ProjectPDFView.as_view(),    name="export-pdf"),
    path("exports/project/<int:project_id>/physical/excel/", views.PhysicalExcelView.as_view(), name="export-physical-excel"),
    path("exports/project/<int:project_id>/physical/pdf/",   views.PhysicalPDFView.as_view(),   name="export-physical-pdf"),
    path("exports/project/<int:project_id>/racks/excel/",    views.RacksExcelView.as_view(),    name="export-racks-excel"),
    path("exports/project/<int:project_id>/racks/pdf/",      views.RacksPDFView.as_view(),      name="export-racks-pdf"),
    path("backup/export/",                                   views.DataExportView.as_view(),    name="backup-export"),
    path("backup/import/",                                   views.DataImportView.as_view(),    name="backup-import"),
]
