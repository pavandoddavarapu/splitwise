"""
Serializers for the accounts app.

RegisterSerializer  — validates and creates a new User, auto-sets username=email
                      so Django's internal auth machinery works without a separate
                      username field in the UI.

LoginSerializer     — validates email+password, runs Django's authenticate(),
                      and attaches the authenticated User to validated_data so
                      the view can create/retrieve a token.

UserSerializer      — read-only; used in API responses to return safe user fields.
                      Password hash is never included.
"""

from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Safe read-only representation of a user for API responses."""

    class Meta:
        model = User
        fields = ["id", "name", "email", "created_at"]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_email(self, value):
        """Reject duplicate emails with a clear message (not a 500)."""
        normalized = value.lower().strip()
        if User.objects.filter(email=normalized).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return normalized

    def create(self, validated_data):
        """
        Create the user via create_user() so the password is hashed by
        Django's PASSWORD_HASHERS (PBKDF2-SHA256 by default).

        We set username = email so Django's internal authenticate() call
        in LoginSerializer can use the username field without us exposing
        it in the UI.
        """
        return User.objects.create_user(
            username=validated_data["email"],   # username == email (internal only)
            email=validated_data["email"],
            password=validated_data["password"],
            name=validated_data["name"],
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        """
        Two-step validation:
          1. Look up the user by email (since Django's authenticate takes username).
          2. Call authenticate() with the stored username so Django's auth
             backends run (password check + any custom backends).

        Using a generic "Invalid credentials" message for both "user not found"
        and "wrong password" — avoids user-enumeration via error messages.
        """
        email = data["email"].lower().strip()
        password = data["password"]

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("Invalid email or password.")

        # authenticate() checks the password against the stored hash and
        # runs any custom auth backends. Returns None on failure.
        authenticated = authenticate(username=user.username, password=password)
        if authenticated is None:
            raise serializers.ValidationError("Invalid email or password.")

        # Attach to validated_data so the view can use it without another DB hit.
        data["user"] = authenticated
        return data
