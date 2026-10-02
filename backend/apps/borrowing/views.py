from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.utils import timezone
from datetime import timedelta
from .models import Borrow, BorrowHistory
from .serializers import BorrowSerializer, BorrowHistorySerializer
from .services import BorrowingService
from apps.users.permissions import IsLibrarianUser, IsAdminUser


class BorrowBookView(generics.CreateAPIView):
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        book_id = request.data.get('book')
        
        # Extract borrow data from request
        borrow_data = {
            'borrower_role': request.data.get('borrower_role', 'student'),
            'student_id': request.data.get('student_id'),
            'student_name': request.data.get('student_name'),
            'staff_id': request.data.get('staff_id'),
            'staff_name': request.data.get('staff_name'),
            'staff_position': request.data.get('staff_position'),
            'id_front_image': request.data.get('id_front_image'),
            'id_back_image': request.data.get('id_back_image'),
            'selfie_image': request.data.get('selfie_image'),
            'borrow_duration_days': request.data.get('borrow_duration_days', 14),
            'notes': request.data.get('notes', '')
        }
        
        result = BorrowingService.borrow_book(request.user, book_id, borrow_data)
        
        if result['success']:
            serializer = self.get_serializer(result['borrow'])
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)


class ReturnBookView(generics.UpdateAPIView):
    queryset = Borrow.objects.all()
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def update(self, request, *args, **kwargs):
        borrow_id = kwargs.get('id')
        result = BorrowingService.return_book(borrow_id, request.user)
        
        if result['success']:
            serializer = self.get_serializer(result['borrow'])
            return Response(serializer.data)
        return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)


class RenewBookView(generics.UpdateAPIView):
    queryset = Borrow.objects.all()
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def update(self, request, *args, **kwargs):
        borrow_id = kwargs.get('id')
        result = BorrowingService.renew_borrowing(borrow_id, request.user)
        
        if result['success']:
            serializer = self.get_serializer(result['borrow'])
            return Response(serializer.data)
        return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)


class BorrowHistoryView(generics.ListAPIView):
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in ['admin', 'librarian']:
            return Borrow.objects.all().order_by('-created_at')
        return Borrow.objects.filter(user=self.request.user).order_by('-created_at')


# Admin/Librarian All Borrowings View with Filters
class AllBorrowingsView(generics.ListAPIView):
    """
    View for librarians and admins to see all borrowings with filters.
    """
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated, IsLibrarianUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'borrower_role', 'user__role']
    search_fields = ['student_id', 'student_name', 'staff_id', 'staff_name', 'book__title', 'book__author']
    ordering_fields = ['borrow_date', 'due_date', 'status', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'librarian']:
            return Borrow.objects.all()
        return Borrow.objects.none()


# Detailed Borrowing View with History
class BorrowDetailView(generics.RetrieveAPIView):
    """
    View for librarians and admins to see full borrowing details including history.
    """
    queryset = Borrow.objects.all()
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated, IsLibrarianUser]
    lookup_field = 'id'


# Borrow History List for a specific borrow
class BorrowHistoryListView(generics.ListAPIView):
    """
    View to get all history entries for a specific borrowing.
    """
    serializer_class = BorrowHistorySerializer
    permission_classes = [IsAuthenticated, IsLibrarianUser]

    def get_queryset(self):
        borrow_id = self.kwargs.get('borrow_id')
        return BorrowHistory.objects.filter(borrowing_id=borrow_id).order_by('-timestamp')


# Active Borrowings List for Librarians
class ActiveBorrowingsView(generics.ListAPIView):
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated, IsLibrarianUser]

    def get_queryset(self):
        return Borrow.objects.filter(
            status__in=['borrowed', 'overdue', 'renewed']
        ).order_by('due_date')


# Overdue Borrowings List for Librarians
class OverdueBorrowingsView(generics.ListAPIView):
    serializer_class = BorrowSerializer
    permission_classes = [IsAuthenticated, IsLibrarianUser]

    def get_queryset(self):
        return Borrow.objects.filter(status='overdue').order_by('due_date')


# Borrowing Statistics for Dashboard
class BorrowingStatisticsView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsLibrarianUser]

    def get(self, request):
        total_borrowings = Borrow.objects.count()
        active_borrowings = Borrow.objects.filter(status__in=['borrowed', 'renewed']).count()
        overdue_borrowings = Borrow.objects.filter(status='overdue').count()
        returned_borrowings = Borrow.objects.filter(status='returned').count()
        
        # Borrowings by role
        student_borrowings = Borrow.objects.filter(borrower_role='student').count()
        staff_borrowings = Borrow.objects.filter(borrower_role='academic_staff').count()
        
        # Recent borrowings (last 30 days)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_borrowings = Borrow.objects.filter(borrow_date__gte=thirty_days_ago).count()
        
        return Response({
            'total_borrowings': total_borrowings,
            'active_borrowings': active_borrowings,
            'overdue_borrowings': overdue_borrowings,
            'returned_borrowings': returned_borrowings,
            'student_borrowings': student_borrowings,
            'staff_borrowings': staff_borrowings,
            'recent_borrowings': recent_borrowings,
        })


# ✅ ID Verification View
class VerifyIDView(generics.GenericAPIView):
    """
    View to verify student or staff ID before borrowing.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        role = request.data.get('role', 'student')
        user_id = request.data.get('user_id')
        user_name = request.data.get('user_name')
        
        if not user_id:
            return Response({
                'valid': False,
                'error': 'ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if role == 'student':
            is_valid, message, user = BorrowingService.validate_student_id(user_id)
        elif role == 'academic_staff':
            is_valid, message, user = BorrowingService.validate_staff_id(user_id)
        else:
            return Response({
                'valid': True,
                'message': 'Librarian identity verified'
            })
        
        return Response({
            'valid': is_valid,
            'message': message,
            'user_exists': user is not None,
            'user_id': user.id if user else None,
            'username': user.username if user else None,
        })


# ✅ NEW: Check if user can borrow
class CanBorrowView(generics.GenericAPIView):
    """
    Check if the current user can borrow a book.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        can_borrow = BorrowingService.can_borrow(request.user)
        active_borrowing = BorrowingService.get_user_active_borrowing(request.user)
        
        return Response({
            'can_borrow': can_borrow,
            'has_active_borrowing': not can_borrow,
            'active_borrowing': BorrowSerializer(active_borrowing).data if active_borrowing else None,
            'message': 'You can borrow a book' if can_borrow else 'You already have an active borrowing. Please return your current book first.'
        })
        
    # Add at the bottom of views.py

class ReportDamageView(generics.GenericAPIView):
    """Report damage or loss for a borrowed book"""
    permission_classes = [IsAuthenticated]

    def post(self, request, borrow_id):
        damage_status = request.data.get('damage_status')
        description = request.data.get('description', '')
        images = request.data.get('images', [])
        
        if not damage_status:
            return Response({
                'error': 'Damage status is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if damage_status not in ['minor', 'moderate', 'severe', 'lost']:
            return Response({
                'error': 'Invalid damage status'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        result = BorrowingService.report_damage(
            borrow_id, request.user, damage_status, description, images
        )
        
        if result['success']:
            return Response(result)
        return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)


class CreatePaymentView(generics.GenericAPIView):
    """Create Chapa payment for fines or damages"""
    permission_classes = [IsAuthenticated]

    def post(self, request, borrow_id):
        result = BorrowingService.create_chapa_payment(borrow_id, request.user)
        
        if result['success']:
            return Response(result)
        return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)


class VerifyPaymentView(generics.GenericAPIView):
    """Verify Chapa payment status"""
    permission_classes = [IsAuthenticated]

    def get(self, request, borrow_id):
        tx_ref = request.query_params.get('tx_ref')
        
        if not tx_ref:
            return Response({
                'error': 'Transaction reference required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        result = BorrowingService.verify_chapa_payment(borrow_id, tx_ref)
        
        if result['success']:
            return Response(result)
        return Response({'error': result['error']}, status=status.HTTP_400_BAD_REQUEST)


class CheckPaymentStatusView(generics.GenericAPIView):
    """Check payment status for a borrowing"""
    permission_classes = [IsAuthenticated]

    def get(self, request, borrow_id):
        try:
            borrow = Borrow.objects.get(id=borrow_id)
            return Response({
                'payment_status': borrow.payment_status,
                'payment_amount': borrow.payment_amount,
                'payment_reference': borrow.payment_reference,
                'fine_amount': borrow.fine_amount,
                'damage_cost': borrow.calculate_damage_cost(),
            })
        except Borrow.DoesNotExist:
            return Response({
                'error': 'Borrow record not found'
            }, status=status.HTTP_404_NOT_FOUND)
            
            
class MyBorrowingStatisticsView(generics.GenericAPIView):
    """
    Statistics for the CURRENT logged-in user.
    Accessible by any authenticated user (no librarian required).
    GET /api/borrowing/my-statistics/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        borrowings = Borrow.objects.filter(user=user)

        total_borrowings = borrowings.count()
        active_borrowings = borrowings.filter(
            status__in=['borrowed', 'renewed']
        ).count()
        overdue_borrowings = borrowings.filter(status='overdue').count()
        returned_borrowings = borrowings.filter(status='returned').count()

        # Total unpaid fines
        from django.db.models import Sum
        unpaid_fines = borrowings.filter(
            fine_paid=False
        ).aggregate(total=Sum('fine_amount'))['total'] or 0

        # Total pending payments (fines + damages)
        pending_payment = borrowings.exclude(
            payment_status='completed'
        ).aggregate(total=Sum('payment_amount'))['total'] or 0

        return Response({
            'total_borrowings': total_borrowings,
            'active_borrowings': active_borrowings,
            'overdue_borrowings': overdue_borrowings,
            'returned_borrowings': returned_borrowings,
            'total_fines': float(unpaid_fines),
            'pending_payment': float(pending_payment),
        })