from rest_framework import serializers
from .models import Borrow, BorrowHistory
from apps.books.serializers import BookListSerializer
from apps.users.serializers import UserSerializer
from apps.borrowing.services import BorrowingService

class BorrowSerializer(serializers.ModelSerializer):
    book_details = BookListSerializer(source='book', read_only=True)
    user_details = UserSerializer(source='user', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    borrower_display_name = serializers.SerializerMethodField()
    borrower_display_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Borrow
        fields = [
            'id', 'user', 'user_details', 'book', 'book_details',
            'borrow_date', 'due_date', 'return_date', 'status',
            'fine_amount', 'fine_paid', 'notes', 'is_overdue',
            'borrower_role', 'student_id', 'student_name',
            'staff_id', 'staff_name', 'staff_position',
            'id_front_image', 'id_back_image', 'selfie_image',
            'borrow_duration_days', 'borrower_display_name', 'borrower_display_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'borrow_date', 'status', 'fine_amount', 'fine_paid',
            'created_at', 'updated_at'
        ]

    def get_is_overdue(self, obj):
        return obj.is_overdue()
    
    def get_borrower_display_name(self, obj):
        return obj.get_borrower_name()
    
    def get_borrower_display_id(self, obj):
        return obj.get_borrower_id()

    def validate(self, data):
        book = data.get('book')
        if book and book.available_quantity <= 0:
            raise serializers.ValidationError("This book is not available for borrowing.")
        
        user = self.context['request'].user
        
        # ✅ FIX: Check if user already has an active borrowing
        active_borrowing = Borrow.objects.filter(
            user=user,
            status__in=['borrowed', 'overdue', 'renewed']
        ).exists()
        
        if active_borrowing:
            raise serializers.ValidationError(
                "You already have a book borrowed. Please return your current book before borrowing another one."
            )
        
        # Validate role-based fields
        role = data.get('borrower_role', 'student')
        
        if role == 'student':
            student_id = data.get('student_id')
            student_name = data.get('student_name')
            
            if not student_id:
                raise serializers.ValidationError({"student_id": "Student ID is required"})
            if not student_name:
                raise serializers.ValidationError({"student_name": "Student name is required"})
            
            is_valid, message, _ = BorrowingService.validate_student_id(student_id)
            if not is_valid:
                raise serializers.ValidationError({"student_id": message})
                
        elif role == 'academic_staff':
            staff_id = data.get('staff_id')
            staff_name = data.get('staff_name')
            staff_position = data.get('staff_position')
            
            if not staff_id:
                raise serializers.ValidationError({"staff_id": "Staff ID is required"})
            if not staff_name:
                raise serializers.ValidationError({"staff_name": "Staff name is required"})
            if not staff_position:
                raise serializers.ValidationError({"staff_position": "Staff position is required"})
            
            is_valid, message, _ = BorrowingService.validate_staff_id(staff_id)
            if not is_valid:
                raise serializers.ValidationError({"staff_id": message})
        
        return data

    def create(self, validated_data):
        book = validated_data['book']
        book.available_quantity -= 1
        if book.available_quantity == 0:
            book.status = 'borrowed'
        book.save()
        
        return super().create(validated_data)

class BorrowHistorySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.username', read_only=True)
    
    class Meta:
        model = BorrowHistory
        fields = [
            'id', 'borrowing', 'action', 'previous_status', 
            'new_status', 'notes', 'performed_by', 'performed_by_name',
            'timestamp'
        ]
        read_only_fields = ['id', 'timestamp']