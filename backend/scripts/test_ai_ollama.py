import os
import sys
import django

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'library_backend.settings')
django.setup()

from apps.ai_recommendations.services.ollama_service import get_ollama_status, ask_ai_librarian
from apps.ai_recommendations.services.external_ai import generate_grounded_explanation

def run_tests():
    print("=" * 60)
    print("Testing Smart LMS AI & Ollama Integration")
    print("=" * 60)

    # 1. Ollama Status
    status = get_ollama_status()
    print("\n1. Ollama Service Status:")
    print(f"   - Online:        {status.get('online')}")
    print(f"   - Host:          {status.get('host')}")
    print(f"   - Target Model:  {status.get('default_model')}")
    print(f"   - Local Models:  {status.get('models')}")
    print(f"   - Ready:         {status.get('ready')}")

    # 2. Grounded Explanation Test
    print("\n2. Grounded Explanation Test:")
    explanation = generate_grounded_explanation(
        book_title="Clean Code",
        book_author="Robert C. Martin",
        book_category="Technology",
        user_context="Writing maintainable Python and software craftsmanship",
        score=0.92,
    )
    print(f"   - Result: {explanation}")

    # 3. AI Librarian Recommendation Test
    print("\n3. Ask AI Librarian Test:")
    query = "I want books about computer algorithms and software architecture."
    print(f"   - Query: '{query}'")
    rec_result = ask_ai_librarian(query=query, limit=2)
    print(f"   - AI Advice:  {rec_result.get('answer')}")
    print(f"   - Powered By: {rec_result.get('powered_by')}")
    print("   - Matched Books:")
    for b in rec_result.get('results', []):
        book_info = b.get('book', {})
        print(f"     * [{book_info.get('id')}] {book_info.get('title')} by {book_info.get('author')}")

    print("\n" + "=" * 60)
    print("AI & Ollama Integration Check Finished Successfully!")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()
