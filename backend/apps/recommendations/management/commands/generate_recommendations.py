from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.recommendations.models import Recommendation
from apps.recommendations.ai_engine.recommender import BookRecommender
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class Command(BaseCommand):
    help = 'Generate AI recommendations for all users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=str,
            help='Generate recommendations for a specific user (username)'
        )
        parser.add_argument(
            '--top-n',
            type=int,
            default=10,
            help='Number of recommendations to generate per user (default: 10)'
        )

    def handle(self, *args, **options):
        try:
            recommender = BookRecommender()
            recommender.build_similarity_matrix()
            
            if options.get('user'):
                users = User.objects.filter(username=options['user'])
            else:
                users = User.objects.filter(is_active=True)
            
            if not users.exists():
                self.stdout.write(self.style.ERROR('No users found'))
                return
            
            total_recommendations = 0
            
            for user in users:
                # Clear existing recommendations for this user
                Recommendation.objects.filter(user=user).delete()
                
                # Generate new recommendations
                recommended_books = recommender.get_recommendations_for_user(
                    user, 
                    top_n=options['top_n']
                )
                
                if not recommended_books:
                    recommended_books = recommender.get_category_based_recommendations(
                        user, 
                        top_n=options['top_n']
                    )
                
                # Save recommendations with scores
                for idx, book in enumerate(recommended_books):
                    score = 1.0 - (idx / len(recommended_books)) if recommended_books else 0.5
                    Recommendation.objects.create(
                        user=user,
                        book=book,
                        score=score
                    )
                    
                total_recommendations += len(recommended_books)
                self.stdout.write(
                    self.style.SUCCESS(f'Generated {len(recommended_books)} recommendations for {user.username}')
                )
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully generated {total_recommendations} recommendations for {users.count()} users')
            )
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))