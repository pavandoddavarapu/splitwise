"""
Imports URL stubs — implemented in Steps 7 and 8.
Registered under /api/imports/ in the root urls.py.
"""

from django.urls import path
from .views import ImportUploadView, ImportReportView, AnomalyResolveView

urlpatterns = [
    path("upload/", ImportUploadView.as_view(), name="import_upload"),
    path("<int:batch_id>/report/", ImportReportView.as_view(), name="import_report"),
    path("anomalies/<int:anomaly_id>/resolve/", AnomalyResolveView.as_view(), name="anomaly_resolve"),
]

