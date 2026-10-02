import os
import sys
import django
import random
from datetime import datetime, timedelta

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'library_backend.settings')

# Setup Django
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.books.models import Book, Category
from apps.borrowing.models import Borrow
from apps.users.models import User

User = get_user_model()

def create_sample_data():
    """Create sample data for testing"""
    
    print("Creating sample data...")
    
    # Create categories
    categories = [
        'Fiction', 'Non-Fiction', 'Science', 'Technology', 
        'History', 'Mathematics', 'Literature', 'Philosophy',
        'Computer Science', 'Engineering', 'Medicine', 'Art'
    ]
    
    category_objs = []
    for cat_name in categories:
        cat, created = Category.objects.get_or_create(name=cat_name)
        category_objs.append(cat)
        print(f"Category: {cat_name} - {'Created' if created else 'Exists'}")
    
    # Create admin user if not exists
    admin, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@library.com',
            'role': 'admin',
            'is_active': True,
            'first_name': 'Admin',
            'last_name': 'User'
        }
    )
    if created:
        admin.set_password('admin123')
        admin.save()
        print("Admin user created")
    
    # Create regular users
    users = [admin]
    for i in range(5):
        user, created = User.objects.get_or_create(
            username=f'student{i+1}',
            defaults={
                'email': f'student{i+1}@example.com',
                'role': 'student',
                'is_active': True,
                'first_name': f'Student{i+1}',
                'last_name': f'Last{i+1}'
            }
        )
        if created:
            user.set_password('password123')
            user.save()
            users.append(user)
            print(f"Student {i+1} created")
    
    # Create books
    books = []
    book_data = [
        {'title': 'Python Programming', 'author': 'John Doe', 'category': 'Technology'},
        {'title': 'JavaScript: The Good Parts', 'author': 'Douglas Crockford', 'category': 'Technology'},
        {'title': 'Data Structures and Algorithms', 'author': 'Robert Lafore', 'category': 'Computer Science'},
        {'title': 'The Great Gatsby', 'author': 'F. Scott Fitzgerald', 'category': 'Literature'},
        {'title': '1984', 'author': 'George Orwell', 'category': 'Literature'},
        {'title': 'A Brief History of Time', 'author': 'Stephen Hawking', 'category': 'Science'},
        {'title': 'The Art of War', 'author': 'Sun Tzu', 'category': 'History'},
        {'title': 'Clean Code', 'author': 'Robert C. Martin', 'category': 'Technology'},
        {'title': 'Design Patterns', 'author': 'Erich Gamma', 'category': 'Computer Science'},
        {'title': 'The Pragmatic Programmer', 'author': 'David Thomas', 'category': 'Technology'},
        {'title': 'Introduction to Algorithms', 'author': 'Thomas H. Cormen', 'category': 'Computer Science'},
        {'title': 'The Catcher in the Rye', 'author': 'J.D. Salinger', 'category': 'Literature'},
        {'title': 'To Kill a Mockingbird', 'author': 'Harper Lee', 'category': 'Literature'},
        {'title': 'The Hobbit', 'author': 'J.R.R. Tolkien', 'category': 'Fiction'},
        {'title': 'The Lord of the Rings', 'author': 'J.R.R. Tolkien', 'category': 'Fiction'},
    ]
    
    for data in book_data:
        category = Category.objects.get(name=data['category'])
        book, created = Book.objects.get_or_create(
            title=data['title'],
            defaults={
                'author': data['author'],
                'category': category,
                'added_by': admin,
                'quantity': random.randint(3, 10),
                'available_quantity': random.randint(1, 5),
                'status': random.choice(['available', 'borrowed']),
                'description': f"This is a book about {data['title']}"
            }
        )
        books.append(book)
        print(f"Book: {data['title']} - {'Created' if created else 'Exists'}")
    
    # Create borrowings - FIXED to avoid duplicate errors
    print("\nCreating borrowings...")
    for i in range(20):
        user = random.choice(users)
        book = random.choice(books)
        borrow_date = timezone.now() - timedelta(days=random.randint(1, 30))
        due_date = borrow_date.date() + timedelta(days=14)
        
        status = random.choice(['borrowed', 'returned', 'overdue'])
        
        # Check if borrowing already exists
        existing = Borrow.objects.filter(user=user, book=book).first()
        if existing:
            continue
        
        try:
            borrow = Borrow.objects.create(
                user=user,
                book=book,
                borrow_date=borrow_date,
                due_date=due_date,
                status=status,
                fine_amount=random.randint(0, 10) if status == 'overdue' else 0,
                processed_by=admin
            )
            print(f"Borrowing created: {user.username} - {book.title}")
        except Exception as e:
            print(f"Error creating borrowing: {e}")
    
    print("\n" + "="*50)
    print("Sample data created successfully!")
    print("="*50)
    print(f"Categories: {Category.objects.count()}")
    print(f"Books: {Book.objects.count()}")
    print(f"Users: {User.objects.count()}")
    print(f"Borrowings: {Borrow.objects.count()}")
    print("="*50)
    print("\nLogin credentials:")
    print("Admin - Username: admin, Password: admin123")
    print("Student - Username: student1-5, Password: password123")

if __name__ == "__main__":
    create_sample_data()