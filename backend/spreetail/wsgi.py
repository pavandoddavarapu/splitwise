"""
WSGI config for Spreetail.

Exposes the WSGI callable as module-level variable `application`.
Gunicorn on Render uses: gunicorn spreetail.wsgi:application
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "spreetail.settings")

application = get_wsgi_application()
