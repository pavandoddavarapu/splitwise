"""
Serializers for the groups app.

GroupMembershipSerializer — handles membership CRUD, validation of dates (joined_at <= left_at),
                           and prevents duplicate memberships for the same user in a group.
GroupSerializer           — handles group CRUD, nesting memberships for detail view.
"""

from datetime import date
from rest_framework import serializers
from accounts.models import User
from accounts.serializers import UserSerializer
from .models import Group, GroupMembership


class GroupMembershipSerializer(serializers.ModelSerializer):
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", write_only=True
    )
    user = UserSerializer(read_only=True)
    joined_at = serializers.DateField(required=True)
    left_at = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = GroupMembership
        fields = ["id", "user_id", "user", "joined_at", "left_at"]

    def validate(self, attrs):
        joined_at = attrs.get("joined_at")
        left_at = attrs.get("left_at")

        # Validation: joined_at must be before or equal to left_at
        if left_at and joined_at and left_at < joined_at:
            raise serializers.ValidationError(
                {"left_at": "Leave date cannot be before join date."}
            )

        # Get group from view kwargs or context if available
        group = self.context.get("group")
        user = attrs.get("user")

        # Validation: one membership interval per user per group
        if group and user:
            qs = GroupMembership.objects.filter(group=group, user=user)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"user_id": f"User {user.name} is already a member of this group."}
                )

        return attrs

    def create(self, validated_data):
        # Inject the group from context if it wasn't passed in validated_data
        group = self.context.get("group")
        if group:
            validated_data["group"] = group
        return super().create(validated_data)


class GroupSerializer(serializers.ModelSerializer):
    memberships = GroupMembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ["id", "name", "created_at", "memberships"]
        read_only_fields = ["created_at"]
