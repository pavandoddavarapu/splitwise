import csv
import io
import re
from datetime import datetime, date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated

from groups.models import Group, GroupMembership
from expenses.models import Expense, ExpenseShare, Settlement
from .models import ImportBatch, ImportAnomaly

User = get_user_model()


def normalize_name(name):
    """Normalize member names according to the alias map and clean whitespace."""
    if not name:
        return ""
    name_clean = name.strip()
    name_lower = name_clean.lower()
    if name_lower in ["priya", "priya s"]:
        return "Priya"
    if name_lower in ["rohan"]:
        return "Rohan"
    if len(name_clean) > 0:
        return name_clean[0].upper() + name_clean[1:]
    return name_clean


def parse_split_details(details_str):
    """
    Parses split details string.
    Examples:
      - 'Priya: 50, Rohan: 50' -> {'Priya': Decimal('50'), 'Rohan': Decimal('50')}
      - 'Priya, Rohan, Alice' -> {'Priya': Decimal('1'), 'Rohan': Decimal('1'), 'Alice': Decimal('1')}
      - 'Priya: 2, Rohan: 1' -> {'Priya': Decimal('2'), 'Rohan': Decimal('1')}
    """
    if not details_str:
        return None
    details_str = details_str.strip()
    if not details_str:
        return None

    result = {}
    # If it contains colons or equal signs, it has weights/percentages/exact amounts
    if ":" in details_str or "=" in details_str:
        pairs = re.split(r"[,;]+", details_str)
        for pair in pairs:
            if not pair.strip():
                continue
            parts = re.split(r"[:=]+", pair, 1)
            if len(parts) == 2:
                name = parts[0].strip()
                val_str = parts[1].strip().replace("%", "").replace("$", "").replace("₹", "").replace(",", "")
                try:
                    val = Decimal(val_str)
                except Exception:
                    val = Decimal("1")
                result[name] = val
            else:
                name = parts[0].strip()
                result[name] = Decimal("1")
    else:
        # Just a list of names
        names = re.split(r"[,;]+", details_str)
        for name in names:
            name = name.strip()
            if name:
                result[name] = Decimal("1")
    return result


def try_parse_date(date_str):
    """
    Attempts to parse date string using multiple formats.
    Returns (parsed_date, date_format_used, is_ambiguous).
    """
    if not date_str:
        return date.today(), "default", False

    date_str = date_str.strip()
    formats = [
        ("%Y-%m-%d", "ISO"),
        ("%d/%m/%Y", "DD/MM/YYYY"),
        ("%m/%d/%Y", "MM/DD/YYYY"),
        ("%Y/%m/%d", "YYYY/MM/DD"),
        ("%d-%m-%Y", "DD-MM-YYYY"),
        ("%d.%m.%Y", "DD.MM.YYYY"),
    ]

    # Check ambiguity: e.g. DD/MM vs MM/DD if both values are <= 12 and different
    is_ambiguous = False
    # If format is X/Y/Z or X-Y-Z
    match = re.match(r"^(\d+)[/-](\d+)[/-](\d+)$", date_str)
    if match:
        p1 = int(match.group(1))
        p2 = int(match.group(2))
        p3 = int(match.group(3))
        # Year is likely p3 if it's 4 digits, or p1.
        # If Z is year: p1 and p2 are day/month. If both <= 12 and p1 != p2, it's ambiguous
        if p3 > 31 and p1 <= 12 and p2 <= 12 and p1 != p2:
            is_ambiguous = True
        elif p1 > 31 and p2 <= 12 and p3 <= 12 and p2 != p3:
            is_ambiguous = True

    # If it is ambiguous, we default to DD/MM/YYYY or DD-MM-YYYY
    if is_ambiguous:
        # Reorder or prioritize DD/MM formats
        priority_formats = [
            ("%d/%m/%Y", "DD/MM/YYYY"),
            ("%d-%m-%Y", "DD-MM-YYYY"),
            ("%d/%m/%y", "DD/MM/YY"),
            ("%d-%m-%y", "DD-MM-YY"),
        ]
        for fmt, fmt_name in priority_formats:
            try:
                dt = datetime.strptime(date_str, fmt).date()
                return dt, fmt_name, True
            except ValueError:
                pass

    for fmt, fmt_name in formats:
        try:
            dt = datetime.strptime(date_str, fmt).date()
            return dt, fmt_name, is_ambiguous
        except ValueError:
            pass

    # Secondary formats (2-digit years)
    for fmt, fmt_name in [("%d/%m/%y", "DD/MM/YY"), ("%m/%d/%y", "MM/DD/YY"), ("%d-%m-%y", "DD-MM-YY")]:
        try:
            dt = datetime.strptime(date_str, fmt).date()
            return dt, fmt_name, is_ambiguous
        except ValueError:
            pass

    # Fallback
    return date.today(), "fallback", False


class ImportUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    @transaction.atomic
    def post(self, request):
        group_id = request.data.get("group") or request.data.get("group_id")
        if not group_id:
            return Response({"error": "group_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        group = get_object_or_404(Group, pk=group_id)
        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response({"error": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Create the batch row
        batch = ImportBatch.objects.create(
            filename=csv_file.name,
            imported_by=request.user
        )

        try:
            file_data = csv_file.read().decode("utf-8-sig")
            # Automatically detect delimiter
            delimiter = ","
            first_line = file_data.split("\n")[0] if file_data else ""
            if ";" in first_line and first_line.count(";") > first_line.count(","):
                delimiter = ";"
            elif "\t" in first_line and first_line.count("\t") > first_line.count(","):
                delimiter = "\t"

            csv_reader = csv.reader(io.StringIO(file_data), delimiter=delimiter)
        except Exception as e:
            return Response({"error": f"Failed to parse CSV file: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        rows = list(csv_reader)
        if not rows:
            return Response({"error": "CSV file is empty"}, status=status.HTTP_400_BAD_REQUEST)

        # Match headers
        headers = [h.strip().lower().replace(" ", "_") for h in rows[0]]
        data_rows = rows[1:]

        # Find column indices
        col_map = {}
        for idx, h in enumerate(headers):
            if "date" in h or "when" in h:
                col_map["date"] = idx
            elif "desc" in h or "item" in h or "what" in h:
                col_map["description"] = idx
            elif "amount" in h or "cost" in h or "price" in h or "value" in h or "total" in h:
                col_map["amount"] = idx
            elif "curr" in h:
                col_map["currency"] = idx
            elif "pay" in h or "who" in h or "paid" in h or "user" in h or "member" in h:
                if not any(k in h for k in ["split", "details", "participants", "share"]):
                    col_map["payer"] = idx
            elif "split_type" in h or "type" in h or "method" in h:
                col_map["split_type"] = idx
            elif "split_with" in h or "details" in h or "participants" in h or "share" in h or "split_details" in h or "splits" in h:
                col_map["split_with"] = idx

        # Ensure minimal required columns: date, description, amount, payer
        required = ["date", "description", "amount", "payer"]
        missing = [r for r in required if r not in col_map]
        if missing:
            return Response({
                "error": f"Missing required columns in CSV: {', '.join(missing)}",
                "detected_headers": headers
            }, status=status.HTTP_400_BAD_REQUEST)

        processed_rows = []
        anomalies_to_create = []
        expenses_to_create = []
        settlements_to_create = []

        # We keep track of clean rows that are exact duplicates or conflicting duplicates
        # We can store a key: (date, payer, amount, currency) -> list of processed info
        unique_check = {}

        # First pass: Parse and detect rules for each row
        for row_idx, row in enumerate(data_rows, start=2):
            if not any(row):  # Skip completely empty rows
                continue

            raw_row_data = {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}

            # Extract fields safely
            raw_date = row[col_map["date"]] if col_map["date"] < len(row) else ""
            raw_desc = row[col_map["description"]] if col_map["description"] < len(row) else ""
            raw_amount = row[col_map["amount"]] if col_map["amount"] < len(row) else ""
            raw_currency = row[col_map.get("currency", 999)] if col_map.get("currency", 999) < len(row) else ""
            raw_payer = row[col_map["payer"]] if col_map["payer"] < len(row) else ""
            raw_split_type = row[col_map.get("split_type", 999)] if col_map.get("split_type", 999) < len(row) else "equal"
            raw_split_with = row[col_map.get("split_with", 999)] if col_map.get("split_with", 999) < len(row) else ""

            row_anomalies = []

            # 1. Date Parsing & Rules (1, 2)
            parsed_date, fmt_used, is_ambiguous = try_parse_date(raw_date)
            if fmt_used != "ISO":
                row_anomalies.append({
                    "type": "mixed_date_format",
                    "description": f"Date '{raw_date}' is not in ISO format. Parsed as format {fmt_used}.",
                    "applied_policy": "Normalized date to YYYY-MM-DD",
                    "status": ImportAnomaly.AUTO_HANDLED
                })
            if is_ambiguous:
                row_anomalies.append({
                    "type": "ambiguous_date",
                    "description": f"Date '{raw_date}' is ambiguous (could be DD/MM or MM/DD).",
                    "applied_policy": "Defaulted ambiguous date to DD/MM format",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            # 2. Currency Rules (7)
            currency = raw_currency.strip().upper()
            if not currency:
                currency = "INR"
                row_anomalies.append({
                    "type": "missing_currency",
                    "description": "Currency is missing.",
                    "applied_policy": "Defaulted currency to INR",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            # 3. Amount Rules (8, 9, 10, 6)
            # Formatting (8)
            amount_clean = raw_amount.strip().replace("$", "").replace("₹", "").replace(",", "")
            is_formatting_issue = (amount_clean != raw_amount.strip()) or ("," in raw_amount) or ("$" in raw_amount) or ("₹" in raw_amount)
            
            try:
                original_amount = Decimal(amount_clean)
            except Exception:
                original_amount = Decimal("0.00")
                is_formatting_issue = True

            original_amount = Decimal(round(original_amount, 2))

            if is_formatting_issue:
                row_anomalies.append({
                    "type": "amount_formatting",
                    "description": f"Amount '{raw_amount}' has formatting issues.",
                    "applied_policy": f"Stripped currency symbols and commas, rounded to {original_amount}",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            # Negative (9)
            is_negative = original_amount < 0
            if is_negative:
                row_anomalies.append({
                    "type": "negative_amount",
                    "description": f"Amount {original_amount} is negative.",
                    "applied_policy": "Treated as a negative refund expense",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            # Zero (10)
            is_zero = original_amount == 0
            if is_zero:
                row_anomalies.append({
                    "type": "zero_amount",
                    "description": "Amount is zero.",
                    "applied_policy": "Imported with voided status",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            # USD conversion (6)
            fx_rate = None
            amount_inr = original_amount
            if currency == "USD":
                fx_rate = Decimal("83.50")
                amount_inr = Decimal(round(original_amount * fx_rate, 2))
                row_anomalies.append({
                    "type": "usd_amount",
                    "description": f"Converted ${original_amount} USD to INR.",
                    "applied_policy": f"Converted at fixed rate of 83.50 -> ₹{amount_inr} INR",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            # 4. Payer Normalization & Rules (11, 12, 17)
            payer_clean = normalize_name(raw_payer)
            is_payer_name_inconsistent = (payer_clean != raw_payer.strip()) and raw_payer.strip() != ""
            
            payer_user = None
            is_payer_missing = False
            is_payer_guest = False
            is_payer_non_member = False

            if not payer_clean:
                is_payer_missing = True
            elif payer_clean.lower() == "kabir":
                is_payer_guest = True
                row_anomalies.append({
                    "type": "excluded_participant",
                    "description": "Payer Kabir is a non-member guest.",
                    "applied_policy": "Excluded guest Kabir, blocked DB row creation for payer",
                    "status": ImportAnomaly.NEEDS_REVIEW
                })
            else:
                # Find in group memberships
                memberships = GroupMembership.objects.filter(group=group)
                matching_member = None
                for m in memberships:
                    if normalize_name(m.user.name).lower() == payer_clean.lower():
                        matching_member = m.user
                        break
                
                if matching_member:
                    payer_user = matching_member
                    # Check covers_date for payer on expense_date
                    payer_membership = GroupMembership.objects.filter(group=group, user=payer_user).first()
                    if payer_membership and not payer_membership.covers_date(parsed_date):
                        row_anomalies.append({
                            "type": "member_outside_window",
                            "description": f"Payer {payer_clean} is active outside the membership window on {parsed_date}.",
                            "applied_policy": "Blocked creation, needs review",
                            "status": ImportAnomaly.NEEDS_REVIEW
                        })
                else:
                    # Check if user exists in system at all
                    matching_user = User.objects.filter(name__iexact=payer_clean).first()
                    if matching_user:
                        is_payer_non_member = True
                        row_anomalies.append({
                            "type": "non_member_in_split",
                            "description": f"Payer {payer_clean} is a system user but not a group member.",
                            "applied_policy": "Blocked creation, needs review",
                            "status": ImportAnomaly.NEEDS_REVIEW
                        })
                    else:
                        is_payer_missing = True

            if is_payer_missing:
                row_anomalies.append({
                    "type": "missing_payer",
                    "description": f"Payer name '{raw_payer}' cannot be resolved to a registered user.",
                    "applied_policy": "Blocked database row creation; needs review",
                    "status": ImportAnomaly.NEEDS_REVIEW
                })

            if is_payer_name_inconsistent and payer_clean:
                row_anomalies.append({
                    "type": "inconsistent_name",
                    "description": f"Payer name '{raw_payer}' normalized to '{payer_clean}'.",
                    "applied_policy": "Applied name alias map normalization",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            # 5. Split Logic & Rules (11, 13, 14, 15, 16, 17)
            split_type = raw_split_type.strip().lower()
            if split_type not in ["equal", "percentage", "exact", "share"]:
                split_type = "equal"

            raw_splits = parse_split_details(raw_split_with)
            
            # If split_with is specified, but split_type is equal (or vice versa), check for mismatches
            is_type_mismatch = False
            if raw_split_with and split_type == "equal" and len(raw_splits or {}) > 0:
                # Type says equal but details are specified
                is_type_mismatch = True
            elif raw_split_with and split_type != "equal" and not ":" in raw_split_with and not "=" in raw_split_with:
                # Type says percentage/exact/share but details has no weights, just list of names
                is_type_mismatch = True

            if is_type_mismatch:
                row_anomalies.append({
                    "type": "split_type_mismatch",
                    "description": f"Split type '{split_type}' mismatches split details '{raw_split_with}'.",
                    "applied_policy": "Used split details to resolve weights",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            # Resolve split participants
            participants = {}
            if raw_splits:
                for name, val in raw_splits.items():
                    norm_n = normalize_name(name)
                    if not norm_n:
                        continue
                    
                    if norm_n.lower() == "kabir":
                        row_anomalies.append({
                            "type": "excluded_participant",
                            "description": "Participant Kabir in split is a non-member guest.",
                            "applied_policy": "Excluded guest Kabir from split calculations",
                            "status": ImportAnomaly.AUTO_HANDLED
                        })
                        continue

                    # Inconsistent name check for participant
                    if norm_n.lower() != name.strip().lower():
                        row_anomalies.append({
                            "type": "inconsistent_name",
                            "description": f"Participant name '{name}' normalized to '{norm_n}'.",
                            "applied_policy": "Applied name alias map normalization",
                            "status": ImportAnomaly.AUTO_HANDLED
                        })

                    # Look up user
                    member_user = None
                    memberships = GroupMembership.objects.filter(group=group)
                    for m in memberships:
                        if normalize_name(m.user.name).lower() == norm_n.lower():
                            member_user = m.user
                            break

                    if member_user:
                        # Check membership window
                        m_membership = GroupMembership.objects.filter(group=group, user=member_user).first()
                        if m_membership and m_membership.covers_date(parsed_date):
                            participants[member_user] = val
                        else:
                            row_anomalies.append({
                                "type": "member_outside_window",
                                "description": f"Member {norm_n} is not active in group on {parsed_date}.",
                                "applied_policy": f"Excluded {norm_n} from split calculations",
                                "status": ImportAnomaly.AUTO_HANDLED
                            })
                    else:
                        # Check if system user
                        matching_user = User.objects.filter(name__iexact=norm_n).first()
                        if matching_user:
                            row_anomalies.append({
                                "type": "non_member_in_split",
                                "description": f"User {norm_n} is not a member of the group.",
                                "applied_policy": f"Excluded non-member {norm_n} from split",
                                "status": ImportAnomaly.AUTO_HANDLED
                            })
                        else:
                            # Entirely missing user
                            row_anomalies.append({
                                "type": "non_member_in_split",
                                "description": f"Name {name} cannot be resolved to any registered user.",
                                "applied_policy": f"Excluded non-member {name} from split",
                                "status": ImportAnomaly.AUTO_HANDLED
                            })

            # If no participants are resolved, use all active members on this date
            if not participants:
                active_m = [m.user for m in GroupMembership.objects.filter(group=group) if m.covers_date(parsed_date)]
                for u in active_m:
                    participants[u] = Decimal("1")
                split_type = "equal"

            # Check percentage totals (13)
            if split_type == "percentage" and participants:
                total_pct = sum(participants.values())
                if total_pct != Decimal("100"):
                    row_anomalies.append({
                        "type": "percentage_not_100",
                        "description": f"Percentages sum to {total_pct}% instead of 100%.",
                        "applied_policy": "Rescaled percentages proportionally to sum to 100%",
                        "status": ImportAnomaly.AUTO_HANDLED
                    })
                    # Rescale
                    scaled = {}
                    for u, val in participants.items():
                        scaled[u] = Decimal(round((val / total_pct) * 100, 4))
                    participants = scaled

            # Determine if this is a settlement logged as an expense (5)
            is_settlement = False
            settle_paid_to = None
            desc_lower = raw_desc.lower()
            if "settle" in desc_lower or "settlement" in desc_lower or "repay" in desc_lower or "paid back" in desc_lower or "transfer" in desc_lower:
                is_settlement = True
            elif len(participants) == 1:
                # Paid by X, split with only Y for the exact full amount
                p_user = list(participants.keys())[0]
                if p_user != payer_user:
                    is_settlement = True
                    settle_paid_to = p_user

            if is_settlement:
                row_anomalies.append({
                    "type": "settlement_as_expense",
                    "description": f"Row '{raw_desc}' appears to be a debt settlement rather than an expense.",
                    "applied_policy": "Created Settlement database record instead of Expense",
                    "status": ImportAnomaly.AUTO_HANDLED
                })
                # Determine recipient
                if not settle_paid_to and len(participants) == 1:
                    settle_paid_to = list(participants.keys())[0]
                elif not settle_paid_to and len(participants) > 0:
                    # default to first participant who is not the payer
                    for u in participants:
                        if u != payer_user:
                            settle_paid_to = u
                            break

            # 6. Duplicates checking (3, 4)
            # We generate a signature: (date, payer_name, amount, currency)
            sig = (parsed_date, payer_clean, original_amount, currency)
            is_exact_dup = False
            is_conflicting_dup = False
            conflicting_target = None
            
            if sig in unique_check:
                # Let's check if exact or conflicting
                for prev_info in unique_check[sig]:
                    if (prev_info["description"] == raw_desc and 
                        prev_info["split_type"] == split_type and 
                        prev_info["split_with"] == raw_split_with):
                        is_exact_dup = True
                        prev_info["has_exact_dup"] = True
                        break
                    else:
                        is_conflicting_dup = True
                        prev_info["has_conflict"] = True
                        conflicting_target = prev_info
                        break

                if not is_exact_dup:
                    unique_check[sig].append({
                        "row_num": row_idx,
                        "description": raw_desc,
                        "split_type": split_type,
                        "split_with": raw_split_with,
                        "has_exact_dup": False,
                        "has_conflict": is_conflicting_dup,
                        "raw_row": raw_row_data
                    })
            else:
                unique_check[sig] = [{
                    "row_num": row_idx,
                    "description": raw_desc,
                    "split_type": split_type,
                    "split_with": raw_split_with,
                    "has_exact_dup": False,
                    "has_conflict": False,
                    "raw_row": raw_row_data
                }]

            if is_exact_dup:
                row_anomalies.append({
                    "type": "exact_duplicate",
                    "description": "This row is an exact duplicate of a previous row in this batch.",
                    "applied_policy": "Skipped creating second database record; logged both",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            if is_conflicting_dup:
                row_anomalies.append({
                    "type": "conflicting_duplicate",
                    "description": f"Conflicting duplicate of row {conflicting_target['row_num']} (same date/payer/amount but different description or split).",
                    "applied_policy": "Imported both expenses with 'disputed' status",
                    "status": ImportAnomaly.AUTO_HANDLED
                })

            processed_rows.append({
                "row_number": row_idx,
                "raw_row": raw_row_data,
                "parsed_date": parsed_date,
                "description": raw_desc,
                "original_amount": original_amount,
                "currency": currency,
                "amount_inr": amount_inr,
                "fx_rate": fx_rate,
                "payer_user": payer_user,
                "payer_clean": payer_clean,
                "split_type": split_type,
                "participants": participants,
                "is_settlement": is_settlement,
                "settle_paid_to": settle_paid_to,
                "is_exact_dup": is_exact_dup,
                "is_conflicting_dup": is_conflicting_dup,
                "is_zero": is_zero,
                "row_anomalies": row_anomalies
            })

        # Second pass: Check if there are any conflicting duplicates we need to back-update
        # (e.g. if row 5 conflicts with row 3, we need to mark row 3 as conflicting too!)
        for info in processed_rows:
            sig = (info["parsed_date"], info["payer_clean"], info["original_amount"], info["currency"])
            matches = unique_check[sig]
            has_conflict = any(m["has_conflict"] for m in matches)
            if has_conflict and not info["is_exact_dup"]:
                info["is_conflicting_dup"] = True
                # Make sure the conflicting_duplicate anomaly is in its anomalies list
                if not any(a["type"] == "conflicting_duplicate" for a in info["row_anomalies"]):
                    # Find which row it conflicts with
                    other_rows = [m["row_num"] for m in matches if m["row_num"] != info["row_number"]]
                    info["row_anomalies"].append({
                        "type": "conflicting_duplicate",
                        "description": f"Conflicting duplicate with row(s) {', '.join(map(str, other_rows))} (same date/payer/amount but different details).",
                        "applied_policy": "Imported both expenses with 'disputed' status",
                        "status": ImportAnomaly.AUTO_HANDLED
                    })

        # Third pass: Create database rows for all clean/auto-handled records
        anomalies_created_count = 0

        for info in processed_rows:
            row_idx = info["row_number"]
            row_anoms = info["row_anomalies"]
            
            # Check if there is any blocking needs_review anomaly
            needs_review = any(a["status"] == ImportAnomaly.NEEDS_REVIEW for a in row_anoms)
            is_blocked = needs_review or info["is_exact_dup"]

            created_expense = None
            created_settlement = None

            if not is_blocked:
                if info["is_settlement"]:
                    # Create Settlement
                    # Verify receiver is valid
                    receiver = info["settle_paid_to"]
                    if not receiver:
                        # Fallback: get a member who is not the payer
                        memberships = GroupMembership.objects.filter(group=group)
                        for m in memberships:
                            if m.user != info["payer_user"]:
                                receiver = m.user
                                break
                    
                    if info["payer_user"] and receiver:
                        created_settlement = Settlement.objects.create(
                            group=group,
                            paid_by=info["payer_user"],
                            paid_to=receiver,
                            amount_inr=info["amount_inr"],
                            settled_at=datetime.combine(info["parsed_date"], datetime.min.time()),
                            source=Settlement.IMPORT,
                            notes=f"CSV Import: {info['description']}"
                        )
                else:
                    # Create Expense
                    expense_status = Expense.ACTIVE
                    if info["is_zero"]:
                        expense_status = Expense.VOIDED
                    elif info["is_conflicting_dup"]:
                        expense_status = Expense.DISPUTED

                    created_expense = Expense.objects.create(
                        group=group,
                        paid_by=info["payer_user"],
                        description=info["description"],
                        expense_date=info["parsed_date"],
                        original_amount=info["original_amount"],
                        original_currency=info["currency"],
                        fx_rate_to_inr=info["fx_rate"],
                        amount_inr=info["amount_inr"],
                        split_type=info["split_type"],
                        status=expense_status,
                        source=Expense.IMPORT,
                        notes="CSV Import"
                    )

                    # Create shares
                    participants = info["participants"]
                    if participants:
                        # Round and allocate using Largest Remainder Method
                        total_weight = sum(participants.values())
                        participants_list = [(u.id, val) for u, val in participants.items()]
                        
                        # Use the allocate_shares mechanism
                        from expenses.serializers import allocate_shares
                        try:
                            allocated = allocate_shares(info["amount_inr"], participants_list)
                        except Exception:
                            # Fallback equal split
                            allocated = {u.id: info["amount_inr"] / len(participants) for u in participants}

                        for u, val in participants.items():
                            share_amt = allocated.get(u.id, Decimal("0.00"))
                            
                            # Build share_raw string
                            if info["split_type"] == "equal":
                                share_raw = f"equal ({len(participants)} members)"
                            elif info["split_type"] == "percentage":
                                share_raw = f"{val}%"
                            elif info["split_type"] == "share":
                                share_raw = f"{int(val)} share{'s' if val > 1 else ''} of {int(total_weight)}"
                            elif info["split_type"] == "exact":
                                symbol = "$" if info["currency"] == "USD" else "₹"
                                share_raw = f"{symbol}{val:.2f}"
                            else:
                                share_raw = f"{val}"

                            ExpenseShare.objects.create(
                                expense=created_expense,
                                user=u,
                                share_amount_inr=share_amt,
                                share_raw=share_raw
                            )

            # Save anomalies to database
            for anom in row_anoms:
                ImportAnomaly.objects.create(
                    batch=batch,
                    source_row_number=row_idx,
                    raw_row=info["raw_row"],
                    anomaly_type=anom["type"],
                    description=anom["description"],
                    applied_policy=anom["applied_policy"],
                    status=anom["status"],
                    linked_expense=created_expense,
                    linked_settlement=created_settlement
                )
                anomalies_created_count += 1

        # Update batch summary counts
        batch.row_count = len(processed_rows)
        batch.anomaly_count = anomalies_created_count
        batch.save()

        # Return report
        anomalies_qs = batch.anomalies.all()
        anomalies_data = [{
            "id": a.id,
            "row_number": a.source_row_number,
            "type": a.anomaly_type,
            "description": a.description,
            "applied_policy": a.applied_policy,
            "status": a.status,
            "raw_row": a.raw_row
        } for a in anomalies_qs]

        return Response({
            "batch_id": batch.id,
            "row_count": batch.row_count,
            "anomaly_count": batch.anomaly_count,
            "anomalies": anomalies_data
        }, status=status.HTTP_201_CREATED)


class ImportReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        batch = get_object_or_404(ImportBatch, pk=batch_id)
        anomalies_qs = batch.anomalies.all()
        anomalies_data = [{
            "id": a.id,
            "row_number": a.source_row_number,
            "type": a.anomaly_type,
            "description": a.description,
            "applied_policy": a.applied_policy,
            "status": a.status,
            "raw_row": a.raw_row
        } for a in anomalies_qs]

        return Response({
            "batch_id": batch.id,
            "filename": batch.filename,
            "imported_at": batch.imported_at,
            "row_count": batch.row_count,
            "anomaly_count": batch.anomaly_count,
            "anomalies": anomalies_data
        })


class AnomalyResolveView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, anomaly_id):
        anomaly = get_object_or_404(ImportAnomaly, pk=anomaly_id)
        action = request.data.get("action")
        if action not in ["approve", "reject"]:
            return Response({"error": "action must be 'approve' or 'reject'"}, status=400)

        if anomaly.status != ImportAnomaly.NEEDS_REVIEW:
            return Response({"error": "Only anomalies in 'needs_review' status can be resolved"}, status=400)

        if action == "reject":
            anomaly.status = ImportAnomaly.RESOLVED
            anomaly.applied_policy = "Rejected by user: DB row was not created."
            anomaly.save()
            return Response({"status": "resolved", "policy": anomaly.applied_policy})

        # action == "approve"
        # We need to construct the expense or settlement
        # For missing payer, the user must supply a payer_id
        payer_id = request.data.get("payer_id")
        payer_user = None
        if payer_id:
            payer_user = get_object_or_404(User, pk=payer_id)

        # Parse row fields to create database records
        raw_row = anomaly.raw_row
        
        # Determine group
        group_id = request.data.get("group_id")
        group = None
        if group_id:
            try:
                group = Group.objects.get(pk=group_id)
            except (Group.DoesNotExist, ValueError):
                pass
        
        if not group:
            group = anomaly.batch.anomalies.first().linked_expense.group if anomaly.batch.anomalies.filter(linked_expense__isnull=False).exists() else None
        if not group:
            # Fallback: get first group in database
            group = Group.objects.first()

        # Extract values from raw_row
        raw_date = ""
        raw_desc = ""
        raw_amount = ""
        raw_currency = ""
        raw_split_type = "equal"
        raw_split_with = ""

        for k, v in raw_row.items():
            k_clean = k.lower().replace(" ", "_")
            if "date" in k_clean:
                raw_date = v
            elif "desc" in k_clean or "item" in k_clean:
                raw_desc = v
            elif "amount" in k_clean or "cost" in k_clean or "price" in k_clean:
                raw_amount = v
            elif "curr" in k_clean:
                raw_currency = v
            elif "split_type" in k_clean or "type" in k_clean:
                raw_split_type = v
            elif "split_with" in k_clean or "details" in k_clean or "share" in k_clean:
                raw_split_with = v

        parsed_date, _, _ = try_parse_date(raw_date)
        amount_clean = str(raw_amount).strip().replace("$", "").replace("₹", "").replace(",", "")
        original_amount = Decimal(amount_clean or "0.00")
        currency = str(raw_currency).strip().upper() or "INR"
        
        fx_rate = None
        amount_inr = original_amount
        if currency == "USD":
            fx_rate = Decimal("83.50")
            amount_inr = Decimal(round(original_amount * fx_rate, 2))

        # Determine payer
        if not payer_user:
            # Try parsing from row
            raw_payer = raw_row.get("payer") or raw_row.get("paid_by") or raw_row.get("who_paid") or ""
            payer_clean = normalize_name(raw_payer)
            if payer_clean:
                payer_user = User.objects.filter(name__iexact=payer_clean).first()
        
        if not payer_user:
            return Response({"error": "Payer is missing or could not be resolved. Please specify payer_id."}, status=400)

        # Ensure payer is added to the group if they are not already a member
        if group:
            membership = GroupMembership.objects.filter(group=group, user=payer_user).first()
            if not membership:
                GroupMembership.objects.create(
                    group=group,
                    user=payer_user,
                    joined_at=parsed_date if parsed_date else date.today(),
                    left_at=None
                )
            else:
                # Adjust join date to cover the expense date if necessary
                if parsed_date < membership.joined_at:
                    membership.joined_at = parsed_date
                    membership.save()
                if membership.left_at and parsed_date > membership.left_at:
                    membership.left_at = None
                    membership.save()

        # Create database rows
        # Check if settlement
        is_settlement = False
        desc_lower = raw_desc.lower()
        if "settle" in desc_lower or "settlement" in desc_lower or "repay" in desc_lower or "paid back" in desc_lower or "transfer" in desc_lower:
            is_settlement = True

        if is_settlement:
            # Get recipient
            receiver = None
            raw_splits = parse_split_details(raw_split_with)
            if raw_splits:
                for name in raw_splits:
                    norm = normalize_name(name)
                    u = User.objects.filter(name__iexact=norm).first()
                    if u and u != payer_user:
                        receiver = u
                        break
            if not receiver:
                # Get a member
                m_membership = GroupMembership.objects.filter(group=group).exclude(user=payer_user).first()
                if m_membership:
                    receiver = m_membership.user
            
            # If still no receiver (e.g. only one member), find any other user or default
            if not receiver:
                other_user = User.objects.exclude(id=payer_user.id).first()
                if other_user:
                    receiver = other_user

            # Ensure receiver is also a member of the group
            if receiver and group:
                rec_membership = GroupMembership.objects.filter(group=group, user=receiver).first()
                if not rec_membership:
                    GroupMembership.objects.create(
                        group=group,
                        user=receiver,
                        joined_at=parsed_date if parsed_date else date.today(),
                        left_at=None
                    )
                else:
                    if parsed_date < rec_membership.joined_at:
                        rec_membership.joined_at = parsed_date
                        rec_membership.save()
                    if rec_membership.left_at and parsed_date > rec_membership.left_at:
                        rec_membership.left_at = None
                        rec_membership.save()

            if not receiver:
                return Response({"error": "A recipient is required for the settlement. Please add more members to the group."}, status=400)

            settlement = Settlement.objects.create(
                group=group,
                paid_by=payer_user,
                paid_to=receiver,
                amount_inr=amount_inr,
                settled_at=datetime.combine(parsed_date, datetime.min.time()),
                source=Settlement.IMPORT,
                notes=f"Resolved CSV: {raw_desc}"
            )
            anomaly.linked_settlement = settlement
            anomaly.applied_policy = f"Manually approved: Created settlement {settlement.id}"
        else:
            # Create Expense
            expense = Expense.objects.create(
                group=group,
                paid_by=payer_user,
                description=raw_desc,
                expense_date=parsed_date,
                original_amount=original_amount,
                original_currency=currency,
                fx_rate_to_inr=fx_rate,
                amount_inr=amount_inr,
                split_type=raw_split_type.lower() if raw_split_type.lower() in ["equal", "percentage", "exact", "share"] else "equal",
                status=Expense.ACTIVE,
                source=Expense.IMPORT,
                notes="Resolved from CSV Import"
            )

            # Create shares (split equally among active members on that date)
            active_members = [m.user for m in GroupMembership.objects.filter(group=group) if m.covers_date(parsed_date)]
            if not active_members:
                active_members = [m.user for m in GroupMembership.objects.filter(group=group)]
            if not active_members:
                active_members = [payer_user]

            share_amount = amount_inr / len(active_members)
            for u in active_members:
                ExpenseShare.objects.create(
                    expense=expense,
                    user=u,
                    share_amount_inr=share_amount,
                    share_raw=f"equal ({len(active_members)} members)"
                )
            
            anomaly.linked_expense = expense
            anomaly.applied_policy = f"Manually approved: Created expense {expense.id}"

        anomaly.status = ImportAnomaly.RESOLVED
        anomaly.save()

        return Response({
            "status": "resolved",
            "policy": anomaly.applied_policy,
            "linked_expense_id": anomaly.linked_expense.id if anomaly.linked_expense else None,
            "linked_settlement_id": anomaly.linked_settlement.id if anomaly.linked_settlement else None
        })
