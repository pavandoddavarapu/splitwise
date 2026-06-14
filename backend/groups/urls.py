"""
Groups URL configuration.

Maps endpoints to Group and GroupMembership CRUD views.
"""

from django.urls import path
from .views import (
    GroupListCreateView,
    GroupRetrieveUpdateDestroyView,
    GroupMembershipListCreateView,
    GroupMembershipRetrieveUpdateDestroyView,
)

urlpatterns = [
    # Groups CRUD
    path("", GroupListCreateView.as_view(), name="group-list-create"),
    path("<int:pk>/", GroupRetrieveUpdateDestroyView.as_view(), name="group-detail"),
    
    # Memberships CRUD
    path(
        "<int:group_pk>/members/",
        GroupMembershipListCreateView.as_view(),
        name="group-membership-list-create",
    ),
    path(
        "<int:group_pk>/members/<int:pk>/",
        GroupMembershipRetrieveUpdateDestroyView.as_view(),
        name="group-membership-detail",
    ),
]
