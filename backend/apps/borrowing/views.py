from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import BorrowRecord
from .serializers import BorrowRecordSerializer
from .services import issue_book, return_book


class BorrowViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BorrowRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("librarian", "admin", "digital_officer"):
            return BorrowRecord.objects.all()
        return BorrowRecord.objects.filter(user=user)

    @action(detail=False, methods=["post"])
    def issue(self, request):
        book_id = request.data.get("book_id")
        if book_id is None:
            return Response({"detail": "book_id is required."}, status=400)
        try:
            rec = issue_book(request.user, int(book_id))
        except (ValueError, TypeError):
            return Response({"detail": "book_id must be an integer."}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(BorrowRecordSerializer(rec).data, status=201)

    @action(detail=True, methods=["post"], url_path="return")
    def return_book(self, request, pk=None):
        try:
            rec = return_book(request.user, int(pk))
        except (ValueError, TypeError):
            return Response({"detail": "Invalid borrow id."}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(BorrowRecordSerializer(rec).data)