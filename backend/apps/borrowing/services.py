from django.utils import timezone
from datetime import timedelta
from django.db import models
from .models import Borrow, BorrowHistory
from apps.books.models import Book
from apps.users.models import User
import re
import json
import uuid
from django.conf import settings

class BorrowingService:
    
    # ========== ID Validation Methods ==========
    
    @staticmethod
    def validate_student_id(student_id):
        """Validate student ID format and check if it exists in the system."""
        if not student_id:
            return False, "Student ID is required", None
        
        # Check format
        student_id_pattern = r'^[A-Za-z]{0,3}[-]?\d{4,6}[-]?\d{1,4}$|^\d{5,10}$'
        if not re.match(student_id_pattern, student_id.strip()):
            return False, "Invalid student ID format. Please check and try again.", None
        
        # Check if student ID exists in the system
        try:
            user = User.objects.filter(student_id=student_id.strip()).first()
            if user:
                return True, "Student ID verified successfully", user
            else:
                return True, "Student ID not found in system. Please verify with librarian.", None
        except Exception as e:
            return False, f"Error validating student ID: {str(e)}", None
    
    @staticmethod
    def validate_staff_id(staff_id):
        """Validate staff ID format and check if it exists in the system."""
        if not staff_id:
            return False, "Staff ID is required", None
        
        # Check format
        staff_id_pattern = r'^[A-Za-z]{2,4}[-]?\d{4,6}[-]?\d{1,4}$|^EMP[-]?\d{4,6}$|^[A-Za-z]{2,4}\d{4,6}$'
        if not re.match(staff_id_pattern, staff_id.strip()):
            return False, "Invalid staff ID format. Please check and try again.", None
        
        # Check if staff ID exists in the system
        try:
            user = User.objects.filter(
                models.Q(student_id=staff_id.strip()) | 
                models.Q(username=staff_id.strip())
            ).first()
            
            if user:
                return True, "Staff ID verified successfully", user
            else:
                return True, "Staff ID not found in system. Please verify with librarian.", None
        except Exception as e:
            return False, f"Error validating staff ID: {str(e)}", None
    
    @staticmethod
    def validate_user_identity(role, user_id, user_name):
        """Validate user identity based on role."""
        if role == 'student':
            return BorrowingService.validate_student_id(user_id)
        elif role == 'academic_staff':
            return BorrowingService.validate_staff_id(user_id)
        elif role == 'librarian':
            return True, "Librarian identity verified", None
        else:
            return False, "Invalid role selected", None
    
    # ========== Borrow Methods ==========
    
    @staticmethod
    def borrow_book(user, book_id, borrow_data):
        try:
            book = Book.objects.get(id=book_id)
            
            # Check availability
            if book.available_quantity <= 0:
                return {'success': False, 'error': 'Book not available'}
            
            # Check if user already has an active borrowing
            active_borrowing = Borrow.objects.filter(
                user=user,
                status__in=['borrowed', 'overdue', 'renewed']
            ).exists()
            
            if active_borrowing:
                return {
                    'success': False, 
                    'error': 'You already have a book borrowed. Please return the current book before borrowing another one.',
                    'code': 'ACTIVE_BORROWING_EXISTS'
                }
            
            # Check if user has any pending borrowings
            pending_borrowing = Borrow.objects.filter(
                user=user,
                status='pending'
            ).exists()
            
            if pending_borrowing:
                return {
                    'success': False,
                    'error': 'You have a pending borrowing request. Please wait for approval.',
                    'code': 'PENDING_BORROWING_EXISTS'
                }
            
            # Validate ID based on role
            role = borrow_data.get('borrower_role', 'student')
            id_to_validate = borrow_data.get('student_id') if role == 'student' else borrow_data.get('staff_id')
            name_to_validate = borrow_data.get('student_name') if role == 'student' else borrow_data.get('staff_name')
            
            if role in ['student', 'academic_staff']:
                is_valid, validation_message, found_user = BorrowingService.validate_user_identity(
                    role, id_to_validate, name_to_validate
                )
                
                if not is_valid:
                    return {'success': False, 'error': validation_message, 'validation_failed': True}
                
                if found_user:
                    borrow_data['linked_user'] = found_user
            
            # Get borrow duration
            borrow_duration = borrow_data.get('borrow_duration_days', 14)
            
            # Create borrow record with all data
            borrow = Borrow.objects.create(
                user=user,
                book=book,
                due_date=timezone.now().date() + timedelta(days=borrow_duration),
                status='borrowed',
                borrower_role=role,
                student_id=borrow_data.get('student_id'),
                student_name=borrow_data.get('student_name'),
                staff_id=borrow_data.get('staff_id'),
                staff_name=borrow_data.get('staff_name'),
                staff_position=borrow_data.get('staff_position'),
                id_front_image=borrow_data.get('id_front_image'),
                id_back_image=borrow_data.get('id_back_image'),
                selfie_image=borrow_data.get('selfie_image'),
                borrow_duration_days=borrow_duration,
                processed_by=user,
                notes=borrow_data.get('notes', '')
            )
            
            # Create history entry
            BorrowHistory.objects.create(
                borrowing=borrow,
                action='BORROWED',
                previous_status=None,
                new_status='borrowed',
                performed_by=user,
                notes=f"Borrowed by {borrow.get_borrower_name()} ({borrow.get_borrower_id()})"
            )
            
            # Update book availability
            book.available_quantity -= 1
            if book.available_quantity == 0:
                book.status = 'borrowed'
            book.save()
            
            return {'success': True, 'borrow': borrow}
            
        except Book.DoesNotExist:
            return {'success': False, 'error': 'Book not found'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ========== Return Methods ==========
    
    @staticmethod
    def return_book(borrow_id, user=None):
        try:
            borrow = Borrow.objects.get(id=borrow_id)
            if borrow.status == 'returned':
                return {'success': False, 'error': 'Book already returned'}
            
            # Check if overdue
            is_overdue = borrow.is_overdue()
            
            borrow.return_date = timezone.now().date()
            
            # If damaged or lost, keep status
            if borrow.damage_status in ['lost']:
                borrow.status = 'lost'
            elif borrow.damage_status in ['minor', 'moderate', 'severe']:
                borrow.status = 'damaged'
            else:
                borrow.status = 'returned'
            
            # Calculate fine if overdue
            if is_overdue:
                borrow.fine_amount = borrow.calculate_fine()
            
            # Calculate total payment
            borrow.payment_amount = borrow.fine_amount + borrow.calculate_damage_cost()
            
            borrow.save()
            
            # Create history entry
            BorrowHistory.objects.create(
                borrowing=borrow,
                action='RETURNED',
                previous_status=borrow.status,
                new_status='returned',
                performed_by=user or borrow.user,
                notes=f"Returned by {borrow.get_borrower_name()}"
            )
            
            # Update book availability only if not damaged or lost
            if borrow.damage_status == 'none':
                book = borrow.book
                book.available_quantity += 1
                if book.available_quantity > 0:
                    book.status = 'available'
                book.save()
            
            return {'success': True, 'borrow': borrow}
            
        except Borrow.DoesNotExist:
            return {'success': False, 'error': 'Borrow record not found'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    # ========== Damage/Loss Reporting ==========
    
    @staticmethod
    def report_damage(borrow_id, user, damage_status, description, images=None):
        """Report damage or loss for a borrowed book"""
        try:
            borrow = Borrow.objects.get(id=borrow_id)
            
            if borrow.status in ['returned', 'damaged', 'lost']:
                return {'success': False, 'error': 'Book already returned or reported'}
            
            borrow.damage_status = damage_status
            borrow.damage_description = description
            borrow.damage_reported_at = timezone.now()
            borrow.damage_reported_by = user
            if images:
                borrow.damage_images = json.dumps(images)
            
            # Update status based on damage
            if damage_status == 'lost':
                borrow.status = 'lost'
            else:
                borrow.status = 'damaged'
            
            # Calculate costs
            borrow.payment_amount = borrow.calculate_damage_cost()
            if borrow.is_overdue():
                borrow.payment_amount += borrow.calculate_fine()
            
            borrow.save()
            
            BorrowHistory.objects.create(
                borrowing=borrow,
                action='DAMAGE_REPORTED',
                previous_status=borrow.status,
                new_status=borrow.status,
                performed_by=user,
                notes=f"Damage reported: {damage_status} - {description}"
            )
            
            return {
                'success': True, 
                'borrow': borrow,
                'payment_amount': borrow.payment_amount,
                'message': 'Damage reported successfully'
            }
            
        except Borrow.DoesNotExist:
            return {'success': False, 'error': 'Borrow record not found'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    # ========== Renew Methods ==========
    
    @staticmethod
    def renew_borrowing(borrow_id, user=None):
        try:
            borrow = Borrow.objects.get(id=borrow_id)
            if borrow.status not in ['borrowed', 'overdue']:
                return {'success': False, 'error': 'Book cannot be renewed'}
            
            # Check if already renewed
            if borrow.status == 'renewed':
                return {'success': False, 'error': 'Book already renewed'}
            
            # Extend due date by 14 days
            borrow.due_date = borrow.due_date + timedelta(days=14)
            borrow.status = 'renewed'
            borrow.save()
            
            # Create history entry
            BorrowHistory.objects.create(
                borrowing=borrow,
                action='RENEWED',
                previous_status='borrowed',
                new_status='renewed',
                performed_by=user or borrow.user,
                notes=f"Renewed by {borrow.get_borrower_name()}"
            )
            
            return {'success': True, 'borrow': borrow}
            
        except Borrow.DoesNotExist:
            return {'success': False, 'error': 'Borrow record not found'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    # ========== Overdue Check ==========
    
    @staticmethod
    def check_overdue_borrowings():
        today = timezone.now().date()
        overdue_borrowings = Borrow.objects.filter(
            status__in=['borrowed', 'renewed'], 
            due_date__lt=today
        )
        
        for borrow in overdue_borrowings:
            borrow.status = 'overdue'
            borrow.fine_amount = borrow.calculate_fine()
            borrow.save()
            
            BorrowHistory.objects.create(
                borrowing=borrow,
                action='MARKED_OVERDUE',
                previous_status='borrowed',
                new_status='overdue',
                notes='Automatically marked overdue'
            )
        
        return overdue_borrowings.count()
    
    # ========== User Status Methods ==========
    
    @staticmethod
    def get_user_active_borrowing(user):
        """Get the user's current active borrowing"""
        return Borrow.objects.filter(
            user=user,
            status__in=['borrowed', 'overdue', 'renewed']
        ).first()
    
    @staticmethod
    def can_borrow(user):
        """Check if user can borrow a book (no active borrowings)"""
        active_count = Borrow.objects.filter(
            user=user,
            status__in=['borrowed', 'overdue', 'renewed']
        ).count()
        return active_count == 0
    
    # ========== Payment Methods ==========
    
    @staticmethod
    def create_chapa_payment(borrow_id, user):
        """Create Chapa payment for fines or damages"""
        try:
            borrow = Borrow.objects.get(id=borrow_id)
            
            if borrow.payment_amount <= 0:
                return {'success': False, 'error': 'No payment required'}
            
            if borrow.payment_status == 'completed':
                return {'success': False, 'error': 'Payment already completed'}
            
            # Generate unique transaction reference
            tx_ref = f"LIB-{borrow.id}-{uuid.uuid4().hex[:8]}"
            
            # Prepare Chapa payment data
            payment_data = {
                'amount': str(borrow.payment_amount),
                'currency': 'ETB',
                'tx_ref': tx_ref,
                'return_url': f"{settings.FRONTEND_URL}/payment/verify/{borrow.id}/",
                'payment_options': 'telebirr,cbe,chapa',
                'customer': {
                    'name': user.get_full_name() or user.username,
                    'email': user.email,
                },
                'customization': {
                    'title': f'Library Payment - {borrow.book.title}',
                    'description': f'Payment for {borrow.get_borrower_name()} - {borrow.book.title}'
                }
            }
            
            # Store payment data
            borrow.payment_reference = tx_ref
            borrow.payment_data = payment_data
            borrow.payment_status = 'pending'
            borrow.save()
            
            # In production, create payment with Chapa API
            # headers = {
            #     'Authorization': f'Bearer {settings.CHAPA_SECRET_KEY}',
            #     'Content-Type': 'application/json'
            # }
            # response = requests.post(
            #     'https://api.chapa.co/v1/transaction/initialize',
            #     json=payment_data,
            #     headers=headers
            # )
            # if response.status_code == 200:
            #     result = response.json()
            #     return {
            #         'success': True,
            #         'payment_url': result.get('data', {}).get('checkout_url'),
            #         'tx_ref': tx_ref,
            #         'amount': borrow.payment_amount
            #     }
            
            # For development, return payment data
            return {
                'success': True,
                'payment_data': payment_data,
                'tx_ref': tx_ref,
                'amount': borrow.payment_amount,
                'message': 'Payment created successfully'
            }
            
        except Borrow.DoesNotExist:
            return {'success': False, 'error': 'Borrow record not found'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def verify_chapa_payment(borrow_id, tx_ref):
        """Verify Chapa payment status"""
        try:
            borrow = Borrow.objects.get(id=borrow_id)
            
            if borrow.payment_status == 'completed':
                return {'success': True, 'message': 'Payment already verified'}
            
            # In production, call Chapa API to verify payment
            # headers = {
            #     'Authorization': f'Bearer {settings.CHAPA_SECRET_KEY}'
            # }
            # response = requests.get(
            #     f'https://api.chapa.co/v1/transaction/verify/{tx_ref}',
            #     headers=headers
            # )
            # if response.status_code == 200:
            #     data = response.json()
            #     if data.get('status') == 'success':
            #         borrow.payment_status = 'completed'
            #         borrow.save()
            #         return {'success': True, 'message': 'Payment verified'}
            
            # Simulate successful verification
            borrow.payment_status = 'completed'
            borrow.save()
            
            BorrowHistory.objects.create(
                borrowing=borrow,
                action='PAYMENT_COMPLETED',
                notes=f"Payment of ${borrow.payment_amount} completed",
                performed_by=borrow.user
            )
            
            return {
                'success': True,
                'message': 'Payment verified successfully',
                'amount': borrow.payment_amount
            }
            
        except Borrow.DoesNotExist:
            return {'success': False, 'error': 'Borrow record not found'}
        except Exception as e:
            return {'success': False, 'error': str(e)}