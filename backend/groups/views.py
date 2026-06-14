"""
Views for the groups app.

GroupListCreateView             — GET/POST /api/groups/
GroupRetrieveUpdateDestroyView  — GET/PUT/PATCH/DELETE /api/groups/<id>/
GroupMembershipListCreateView   — GET/POST /api/groups/<group_pk>/members/
GroupMembershipRetrieveUpdateDestroyView — GET/PUT/PATCH/DELETE /api/groups/<group_pk>/members/<pk>/
"""

from django.shortcuts import get_object_or_404
from rest_framework import generics
from .models import Group, GroupMembership
from .serializers import GroupSerializer, GroupMembershipSerializer


class GroupListCreateView(generics.ListCreateAPIView):
    """
    GET /api/groups/
    POST /api/groups/
    """

    queryset = Group.objects.all().order_by("-created_at")
    serializer_class = GroupSerializer


class GroupRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/groups/<id>/
    PUT/PATCH /api/groups/<id>/
    DELETE /api/groups/<id>/
    """

    queryset = Group.objects.all()
    serializer_class = GroupSerializer


class GroupMembershipListCreateView(generics.ListCreateAPIView):
    """
    GET /api/groups/<group_pk>/members/
    POST /api/groups/<group_pk>/members/
    """

    serializer_class = GroupMembershipSerializer

    def get_group(self):
        return get_object_or_404(Group, pk=self.kwargs["group_pk"])

    def get_queryset(self):
        group = self.get_group()
        return GroupMembership.objects.filter(group=group).order_by("joined_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["group"] = self.get_group()
        return context

    def perform_create(self, serializer):
        group = self.get_group()
        serializer.save(group=group)


class GroupMembershipRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/groups/<group_pk>/members/<pk>/
    PUT/PATCH /api/groups/<group_pk>/members/<pk>/
    DELETE /api/groups/<group_pk>/members/<pk>/
    """

    serializer_class = GroupMembershipSerializer

    def get_group(self):
        return get_object_or_404(Group, pk=self.kwargs["group_pk"])

    def get_queryset(self):
        group = self.get_group()
        return GroupMembership.objects.filter(group=group)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["group"] = self.get_group()
        return context
