"""
Imports URL stubs — implemented in Steps 7 and 8.
Registered under /api/imports/ in the root urls.py.
"""

from django.urls import path

urlpatterns = [
    # Step 7+8: POST /api/imports/upload/
    # Step 8:   GET  /api/imports/<batch_id>/report/
    # Step 8:   POST /api/imports/anomalies/<id>/resolve/
]
