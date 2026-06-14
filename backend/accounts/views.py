"""
Auth views for the accounts app.

RegisterView  POST /api/auth/register/   — create user, return token + user
LoginView     POST /api/auth/login/      — authenticate, return token + user
LogoutView    POST /api/auth/logout/     — delete token (invalidates it server-side)
MeView        GET  /api/auth/me/         — return current user (requires token)

Why delete the token on logout instead of expiring it?
  DRF's built-in Token model has no expiry field. Deleting the row is the
  correct way to invalidate it — any subsequent request using the old token
  string will return 401 because the lookup will find nothing.
  For this project scope this is sufficient. In production you'd use a
  short-lived JWT or add a custom expiry field to the token model.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Body: { name, email, password }
    Returns: { token, user }
    Permission: open (no auth required — you're not logged in yet)
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        # raise_exception=True returns a 400 with the error dict automatically.
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # get_or_create so re-registering (if the unique check somehow passes)
        # doesn't break — but in practice the unique email check prevents this.
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: { email, password }
    Returns: { token, user }
    Permission: open
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # get_or_create handles the case where the user was created but their
        # token was deleted (e.g. they logged out on another device).
        token, _ = Token.objects.get_or_create(user=user)

        return Response({"token": token.key, "user": UserSerializer(user).data})


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Header: Authorization: Token <token>
    Returns: 204 No Content
    Permission: must be authenticated (token required)

    Deletes the token row — the token string is now invalid.
    """

    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Token.DoesNotExist:
            # Already logged out / token already gone — treat as success.
            pass
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """
    GET /api/auth/me/
    Header: Authorization: Token <token>
    Returns: { id, name, email, created_at }
    Permission: must be authenticated

    Used by the React app on startup to re-hydrate auth state from a stored
    token (avoids requiring re-login after page refresh).
    """

    def get(self, request):
        return Response(UserSerializer(request.user).data)
