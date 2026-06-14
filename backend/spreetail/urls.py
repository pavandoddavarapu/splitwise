"""
URL configuration for Spreetail.

Structure:
  /api/         → DRF API routes (each app registers its own urls.py)
  /admin/       → Django admin
  /*            → Catch-all: serve React's index.html so React Router handles
                  client-side navigation.
"""

from django.contrib import admin
from django.http import FileResponse, Http404, JsonResponse
from django.urls import include, path
from pathlib import Path
from django.conf import settings


def health_check(request):
    """
    Unauthenticated health-check endpoint.
    Used by the React hello-world to confirm Django is reachable.
    Also useful for Render's health-check ping.
    """
    return JsonResponse({"status": "ok"})


def serve_react(request, *args, **kwargs):
    """
    Serve the React app's index.html for any non-API route.

    WhiteNoise handles individual static assets (JS, CSS, images) via the
    STATICFILES_DIRS setting. This view only handles the HTML entry point so
    that React Router can manage client-side navigation.
    """
    index_file = Path(settings.STATIC_ROOT) / "index.html"
    if not index_file.exists():
        # In development (before `npm run build` + `collectstatic` have run),
        # fall back to the source dist directory directly.
        index_file = (
            Path(settings.BASE_DIR).parent / "frontend" / "dist" / "index.html"
        )
    if not index_file.exists():
        raise Http404("React app not built yet. Run: cd frontend && npm run build")
    return FileResponse(open(index_file, "rb"), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    # Health check — unauthenticated, used by React hello-world and Render
    path("api/health/", health_check),
    # API namespaces — each app plugs in its own router
    path("api/auth/", include("accounts.urls")),
    path("api/groups/", include("groups.urls")),
    path("api/expenses/", include("expenses.urls")),
    path("api/imports/", include("imports.urls")),
    # Catch-all: anything that didn't match above goes to React.
    # The trailing <path:> captures nested paths like /groups/1/expenses.
    path("", serve_react),
    path("<path:path>", serve_react),
]
