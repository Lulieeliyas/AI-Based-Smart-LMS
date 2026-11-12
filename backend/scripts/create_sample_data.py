import os
import sys
import django
import random
from datetime import datetime, timedelta

# Add backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'library_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.books.models import Book, Category, Rating
from apps.borrowing.models import BorrowRecord
from apps.ai_recommendations.models import UserBookInteraction

User = get_user_model()

def create_sample_data():
    """Create realistic sample data for library recommendation model training and testing."""
    print("=" * 60)
    print("Populating Smart LMS Sample Data for AI Recommendation Training")
    print("=" * 60)

    # 1. Categories
    categories_data = [
        'Computer Science', 'Technology', 'Fiction', 'Science', 
        'History', 'Philosophy', 'Literature', 'Mathematics'
    ]
    categories = {}
    for cat_name in categories_data:
        cat, _ = Category.objects.get_or_create(name=cat_name)
        categories[cat_name] = cat
        print(f"[Category] {cat_name}")

    # 2. Users
    # Ensure admin exists
    admin = User.objects.filter(role='admin').first()
    if not admin:
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@library.com',
                'role': 'admin',
                'is_active': True,
                'first_name': 'System',
                'last_name': 'Admin'
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save()
    print(f"[Admin] Using: {admin.username} ({admin.email})")

    users = [admin]
    for i in range(1, 6):
        u, created = User.objects.get_or_create(
            username=f'student{i}',
            defaults={
                'email': f'student{i}@example.com',
                'role': 'student',
                'is_active': True,
                'first_name': f'Student',
                'last_name': f'User {i}'
            }
        )
        if created:
            u.set_password('password123')
            u.save()
        users.append(u)
        print(f"[User] {u.username} ({u.email})")

    # 3. Books
    catalog = [
        {
            'title': 'Clean Code: A Handbook of Agile Software Craftsmanship',
            'author': 'Robert C. Martin',
            'category': 'Technology',
            'publisher': 'Prentice Hall',
            'published_year': 2008,
            'isbn': '9780132350884',
            'description': 'A guide to writing clean, maintainable, and readable code with practical refactoring advice for software engineers.'
        },
        {
            'title': 'The Pragmatic Programmer: Your Journey to Mastery',
            'author': 'David Thomas, Andrew Hunt',
            'category': 'Technology',
            'publisher': 'Addison-Wesley',
            'published_year': 2019,
            'isbn': '9780135957059',
            'description': 'Illustrates modern best practices in software development, architecture, testing, and career excellence.'
        },
        {
            'title': 'Design Patterns: Elements of Reusable Object-Oriented Software',
            'author': 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
            'category': 'Computer Science',
            'publisher': 'Addison-Wesley',
            'published_year': 1994,
            'isbn': '9780201633610',
            'description': 'Classic software engineering book documenting 23 reusable solutions to common object-oriented software design challenges.'
        },
        {
            'title': 'Introduction to Algorithms (CLRS)',
            'author': 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein',
            'category': 'Computer Science',
            'publisher': 'MIT Press',
            'published_year': 2009,
            'isbn': '9780262033848',
            'description': 'Comprehensive textbook covering graph theory, dynamic programming, sorting algorithms, and complexity analysis.'
        },
        {
            'title': 'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow',
            'author': 'Aurelien Geron',
            'category': 'Technology',
            'publisher': "O'Reilly Media",
            'published_year': 2019,
            'isbn': '9781492032649',
            'description': 'Deep dive into machine learning fundamentals, neural networks, deep learning models, and Python data science workflows.'
        },
        {
            'title': 'Artificial Intelligence: A Modern Approach',
            'author': 'Stuart Russell, Peter Norvig',
            'category': 'Computer Science',
            'publisher': 'Pearson',
            'published_year': 2020,
            'isbn': '9780134610993',
            'description': 'The definitive textbook exploring intelligent agents, search algorithms, probability, neural reasoning, and reinforcement learning.'
        },
        {
            'title': 'A Brief History of Time',
            'author': 'Stephen Hawking',
            'category': 'Science',
            'publisher': 'Bantam Books',
            'published_year': 1988,
            'isbn': '9780553380163',
            'description': 'Explores cosmology, the Big Bang, black holes, space-time, and the quest for a unified theory of physics.'
        },
        {
            'title': 'Cosmos',
            'author': 'Carl Sagan',
            'category': 'Science',
            'publisher': 'Random House',
            'published_year': 1980,
            'isbn': '9780394502946',
            'description': 'A journey through universe exploration, science history, astronomy, and human curiosity across billions of years.'
        },
        {
            'title': '1984',
            'author': 'George Orwell',
            'category': 'Fiction',
            'publisher': 'Secker & Warburg',
            'published_year': 1949,
            'isbn': '9780451524935',
            'description': 'Dystopian classic exploring totalitarian surveillance, censorship, psychological manipulation, and individual freedom.'
        },
        {
            'title': 'Brave New World',
            'author': 'Aldous Huxley',
            'category': 'Fiction',
            'publisher': 'Chatto & Windus',
            'published_year': 1932,
            'isbn': '9780060850524',
            'description': 'Futuristic dystopian novel probing genetic conditioning, psychological gratification, mass consumption, and societal control.'
        },
        {
            'title': 'The Great Gatsby',
            'author': 'F. Scott Fitzgerald',
            'category': 'Literature',
            'publisher': 'Charles Scribner\'s Sons',
            'published_year': 1925,
            'isbn': '9780743273565',
            'description': 'Tragic portrait of the Jazz Age, romantic obsession, wealth, and the disillusionment of the American Dream.'
        },
        {
            'title': 'To Kill a Mockingbird',
            'author': 'Harper Lee',
            'category': 'Literature',
            'publisher': 'J. B. Lippincott & Co.',
            'published_year': 1960,
            'isbn': '9780061120084',
            'description': 'Pulitzer prize-winning novel tackling racial injustice, moral courage, and childhood innocence in the American South.'
        },
        {
            'title': 'Sapiens: A Brief History of Humankind',
            'author': 'Yuval Noah Harari',
            'category': 'History',
            'publisher': 'Harper',
            'published_year': 2014,
            'isbn': '9780062316097',
            'description': 'Chronicles human evolution from early hominids through the Cognitive, Agricultural, and Scientific Revolutions.'
        },
        {
            'title': 'Guns, Germs, and Steel',
            'author': 'Jared Diamond',
            'category': 'History',
            'publisher': 'W. W. Norton',
            'published_year': 1997,
            'isbn': '9780393038910',
            'description': 'Examines environmental and geographic factors that shaped the fates of human societies across continents.'
        },
        {
            'title': 'Meditations',
            'author': 'Marcus Aurelius',
            'category': 'Philosophy',
            'publisher': 'Penguin Classics',
            'published_year': 2006,
            'isbn': '9780140449334',
            'description': 'Timeless Stoic reflections on wisdom, self-discipline, resilience, reason, and coping with adversity.'
        }
    ]

    created_books = []
    for item in catalog:
        cat_obj = categories.get(item['category'])
        book, created = Book.objects.get_or_create(
            isbn=item['isbn'],
            defaults={
                'title': item['title'],
                'author': item['author'],
                'category': cat_obj,
                'publisher': item['publisher'],
                'published_year': item['published_year'],
                'description': item['description'],
                'total_copies': 5,
                'available_copies': 3,
                'access_type': Book.AccessType.PUBLIC,
            }
        )
        created_books.append(book)
        print(f"[Book] {'Created' if created else 'Exists'}: {book.title}")

    # 4. User Interactions & Ratings & Borrow Records
    print("\nCreating borrowing history, ratings, and interaction events...")
    student_users = [u for u in users if u.role == 'student']

    # Student 1 loves Computer Science & Tech
    tech_books = [b for b in created_books if b.category.name in ('Technology', 'Computer Science')]
    # Student 2 loves Fiction & Literature
    fiction_books = [b for b in created_books if b.category.name in ('Fiction', 'Literature')]
    # Student 3 loves Science & Philosophy
    science_books = [b for b in created_books if b.category.name in ('Science', 'Philosophy', 'History')]

    user_preferences = {
        student_users[0]: tech_books,
        student_users[1]: fiction_books,
        student_users[2]: science_books,
        student_users[3]: tech_books[:3] + science_books[:2],
        student_users[4]: fiction_books[:2] + tech_books[:2],
    }

    now = timezone.now()

    for user, preferred_pool in user_preferences.items():
        for book in preferred_pool:
            # 1. Borrow record
            issue_date = (now - timedelta(days=random.randint(5, 45))).date()
            due_date = issue_date + timedelta(days=14)
            BorrowRecord.objects.get_or_create(
                user=user,
                book=book,
                defaults={
                    'issue_date': issue_date,
                    'due_date': due_date,
                    'status': BorrowRecord.Status.RETURNED,
                    'fine': 0,
                }
            )

            # 2. Rating (explicit signal)
            score = random.choice([4, 5])
            Rating.objects.get_or_create(
                user=user,
                book=book,
                defaults={'score': score, 'review': f"Really insightful book on {book.category.name}!"}
            )

            # 3. Interactions (views, favorites, borrows)
            UserBookInteraction.objects.get_or_create(
                user=user,
                book=book,
                interaction_type='borrow',
                defaults={'rating': score}
            )
            UserBookInteraction.objects.get_or_create(
                user=user,
                book=book,
                interaction_type='favorite',
            )
            UserBookInteraction.objects.get_or_create(
                user=user,
                book=book,
                interaction_type='view',
            )

    print("=" * 60)
    print("Sample Data Setup Complete!")
    print(f"Total Categories: {Category.objects.count()}")
    print(f"Total Books:      {Book.objects.count()}")
    print(f"Total Users:      {User.objects.count()}")
    print(f"Total Borrows:    {BorrowRecord.objects.count()}")
    print(f"Total Ratings:    {Rating.objects.count()}")
    print(f"Total Events:     {UserBookInteraction.objects.count()}")
    print("=" * 60)

if __name__ == '__main__':
    create_sample_data()
