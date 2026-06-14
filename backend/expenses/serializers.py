from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework import serializers
from groups.models import Group, GroupMembership
from .models import Expense, ExpenseShare

User = get_user_model()


def allocate_shares(total_amount: Decimal, participants_with_weights):
    """
    Allocates total_amount (Decimal) to a list of (participant_id, weight) tuples.
    Returns a dict: {participant_id: share_amount_inr}
    Ensures that the sum of shares is exactly equal to total_amount.
    """
    if not participants_with_weights:
        return {}

    total_cents = int(round(total_amount * 100))
    weights = [Decimal(str(w)) for _, w in participants_with_weights]
    total_weight = sum(weights)

    if total_weight <= 0:
        raise ValueError("Total weight must be positive.")

    # Calculate initial shares in cents (truncated)
    allocated_cents = []
    remainders = []

    for p_id, w in participants_with_weights:
        exact_share_cents = (Decimal(total_cents) * Decimal(str(w))) / total_weight
        init_cents = int(exact_share_cents)
        rem = exact_share_cents - init_cents
        allocated_cents.append(init_cents)
        remainders.append(rem)

    sum_allocated = sum(allocated_cents)
    diff = total_cents - sum_allocated

    # Sort indices by remainder in descending order
    # To keep it deterministic, we use negative index as secondary key
    # (since reverse=True, -i descending means i ascending)
    sorted_indices = sorted(
        range(len(participants_with_weights)),
        key=lambda i: (remainders[i], -i),
        reverse=True,
    )

    # Distribute the difference (1 cent at a time)
    for i in range(diff):
        idx = sorted_indices[i]
        allocated_cents[idx] += 1

    # Convert cents back to Decimals
    shares = {}
    for idx, (p_id, _) in enumerate(participants_with_weights):
        shares[p_id] = Decimal(allocated_cents[idx]) / 100

    return shares


class ExpenseSerializer(serializers.ModelSerializer):
    splits = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True,
    )
    shares = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "group",
            "paid_by",
            "description",
            "expense_date",
            "original_amount",
            "original_currency",
            "fx_rate_to_inr",
            "amount_inr",
            "split_type",
            "status",
            "source",
            "notes",
            "created_at",
            "splits",
            "shares",
        ]
        read_only_fields = [
            "fx_rate_to_inr",
            "amount_inr",
            "status",
            "source",
            "created_at",
        ]

    def get_shares(self, obj):
        # Nested serializer representation of computed shares
        from accounts.serializers import UserSerializer

        class ShareDetailSerializer(serializers.ModelSerializer):
            user = UserSerializer(read_only=True)

            class Meta:
                model = ExpenseShare
                fields = ["id", "user", "share_amount_inr", "share_raw"]

        return ShareDetailSerializer(obj.shares.all(), many=True).data

    def validate(self, attrs):
        group = attrs.get("group")
        expense_date = attrs.get("expense_date")
        original_amount = attrs.get("original_amount")
        original_currency = attrs.get("original_currency")
        split_type = attrs.get("split_type")
        splits = attrs.get("splits", [])

        # Validate amount
        if original_amount <= 0:
            raise serializers.ValidationError(
                {"original_amount": "Amount must be greater than zero."}
            )

        # Calculate amount_inr and fx_rate_to_inr
        if original_currency == "USD":
            fx_rate = Decimal("83.50")
            amount_inr = Decimal(round(original_amount * fx_rate, 2))
        else:
            fx_rate = None
            amount_inr = original_amount

        # Get all active memberships on expense_date
        memberships = GroupMembership.objects.filter(group=group)
        active_memberships = [
            m for m in memberships if m.covers_date(expense_date)
        ]

        if not active_memberships:
            raise serializers.ValidationError(
                {
                    "expense_date": "There are no active members in this group on the selected expense date."
                }
            )

        active_users_dict = {m.user.id: m.user for m in active_memberships}
        active_user_ids = set(active_users_dict.keys())

        calculated_shares = {}  # user_id -> share_amount_inr
        share_raw_dict = {}  # user_id -> share_raw string

        # Process by split type
        if split_type == Expense.EQUAL:
            n_members = len(active_memberships)
            participants = sorted([(uid, 1) for uid in active_user_ids])
            allocated = allocate_shares(amount_inr, participants)
            for uid, amt in allocated.items():
                calculated_shares[uid] = amt
                share_raw_dict[uid] = f"equal ({n_members} members)"

        elif split_type == Expense.PERCENTAGE:
            if not splits:
                raise serializers.ValidationError(
                    {"splits": "Splits are required for percentage split type."}
                )

            split_user_ids = []
            total_pct = Decimal("0")
            for item in splits:
                uid = item.get("user_id")
                # Handle possible string representation of numbers from client JSON
                try:
                    val = Decimal(str(item.get("value", 0)))
                except Exception:
                    raise serializers.ValidationError(
                        {"splits": "Invalid split value format."}
                    )

                if uid not in active_user_ids:
                    user_name = (
                        User.objects.filter(id=uid)
                        .values_list("name", flat=True)
                        .first()
                        or f"ID {uid}"
                    )
                    raise serializers.ValidationError(
                        {
                            "splits": f"User {user_name} is not active in the group on the expense date."
                        }
                    )
                if val <= 0:
                    raise serializers.ValidationError(
                        {"splits": "Percentage values must be positive."}
                    )

                split_user_ids.append((uid, val))
                total_pct += val

            if total_pct != Decimal("100"):
                raise serializers.ValidationError(
                    {
                        "splits": f"The sum of percentages must equal 100% (currently {total_pct}%)."
                    }
                )

            allocated = allocate_shares(amount_inr, split_user_ids)
            for uid, amt in allocated.items():
                val = next(v for u, v in split_user_ids if u == uid)
                calculated_shares[uid] = amt
                share_raw_dict[uid] = f"{val}%"

        elif split_type == Expense.SHARE:
            if not splits:
                raise serializers.ValidationError(
                    {"splits": "Splits are required for share split type."}
                )

            split_user_ids = []
            total_shares = Decimal("0")
            for item in splits:
                uid = item.get("user_id")
                try:
                    val = Decimal(str(item.get("value", 0)))
                except Exception:
                    raise serializers.ValidationError(
                        {"splits": "Invalid split value format."}
                    )

                if uid not in active_user_ids:
                    user_name = (
                        User.objects.filter(id=uid)
                        .values_list("name", flat=True)
                        .first()
                        or f"ID {uid}"
                    )
                    raise serializers.ValidationError(
                        {
                            "splits": f"User {user_name} is not active in the group on the expense date."
                        }
                    )
                if val <= 0:
                    raise serializers.ValidationError(
                        {"splits": "Share values must be positive."}
                    )

                split_user_ids.append((uid, val))
                total_shares += val

            allocated = allocate_shares(amount_inr, split_user_ids)
            for uid, amt in allocated.items():
                val = next(v for u, v in split_user_ids if u == uid)
                calculated_shares[uid] = amt
                share_suffix = "shares" if val > 1 else "share"
                share_raw_dict[uid] = (
                    f"{int(val)} {share_suffix} of {int(total_shares)}"
                )

        elif split_type == Expense.EXACT:
            if not splits:
                raise serializers.ValidationError(
                    {"splits": "Splits are required for exact split type."}
                )

            split_user_ids = []
            total_exact = Decimal("0")
            for item in splits:
                uid = item.get("user_id")
                try:
                    val = Decimal(str(item.get("value", 0)))
                except Exception:
                    raise serializers.ValidationError(
                        {"splits": "Invalid split value format."}
                    )

                if uid not in active_user_ids:
                    user_name = (
                        User.objects.filter(id=uid)
                        .values_list("name", flat=True)
                        .first()
                        or f"ID {uid}"
                    )
                    raise serializers.ValidationError(
                        {
                            "splits": f"User {user_name} is not active in the group on the expense date."
                        }
                    )
                if val <= 0:
                    raise serializers.ValidationError(
                        {"splits": "Exact values must be positive."}
                    )

                split_user_ids.append((uid, val))
                total_exact += val

            if total_exact != original_amount:
                symbol = "$" if original_currency == "USD" else "₹"
                raise serializers.ValidationError(
                    {
                        "splits": f"The sum of exact split values ({symbol}{total_exact}) must equal the total expense amount ({symbol}{original_amount})."
                    }
                )

            # Convert exact values to INR first to serve as weights
            split_user_ids_inr = []
            for uid, val in split_user_ids:
                val_inr = Decimal(round(val * fx_rate, 2)) if fx_rate else val
                split_user_ids_inr.append((uid, val_inr))

            allocated = allocate_shares(amount_inr, split_user_ids_inr)
            for uid, amt in allocated.items():
                val = next(v for u, v in split_user_ids if u == uid)
                calculated_shares[uid] = amt
                symbol = "$" if original_currency == "USD" else "₹"
                share_raw_dict[uid] = f"{symbol}{val:.2f}"

        # Attach calculations to validated_data
        attrs["calculated_shares"] = calculated_shares
        attrs["share_raw_dict"] = share_raw_dict
        attrs["amount_inr"] = amount_inr
        attrs["fx_rate_to_inr"] = fx_rate

        return attrs

    def create(self, validated_data):
        calculated_shares = validated_data.pop("calculated_shares")
        share_raw_dict = validated_data.pop("share_raw_dict")
        validated_data.pop("splits", None)

        expense = Expense.objects.create(**validated_data)

        # Create ExpenseShare rows
        for uid, share_amount in calculated_shares.items():
            ExpenseShare.objects.create(
                expense=expense,
                user_id=uid,
                share_amount_inr=share_amount,
                share_raw=share_raw_dict[uid],
            )

        return expense

    def update(self, instance, validated_data):
        calculated_shares = validated_data.pop("calculated_shares", None)
        share_raw_dict = validated_data.pop("share_raw_dict", None)
        validated_data.pop("splits", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if calculated_shares is not None:
            instance.shares.all().delete()
            for uid, share_amount in calculated_shares.items():
                ExpenseShare.objects.create(
                    expense=instance,
                    user_id=uid,
                    share_amount_inr=share_amount,
                    share_raw=share_raw_dict[uid],
                )

        return instance
