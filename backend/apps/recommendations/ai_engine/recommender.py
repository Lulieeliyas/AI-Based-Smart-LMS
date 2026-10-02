import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import NearestNeighbors
from django.db.models import Count, Q, Avg
from django.utils import timezone
from django.conf import settings  # ✅ Add this import
from datetime import timedelta
from apps.books.models import Book, BookReview
from apps.borrowing.models import Borrow  # ✅ Use Borrow not BorrowRecord
from apps.users.models import User
from apps.recommendations.models import Recommendation, RecommendationActivity
import logging
import pickle
import os
from pathlib import Path

logger = logging.getLogger(__name__)

class BookRecommender:
    """
    AI-based Book Recommendation Engine using Hybrid Approach
    Combines Content-Based Filtering and Collaborative Filtering
    """
    
    def __init__(self):
        self.tfidf_vectorizer = TfidfVectorizer(
            stop_words='english', 
            max_features=5000,
            ngram_range=(1, 2),
            min_df=2
        )
        self.svd = TruncatedSVD(n_components=100, random_state=42)
        self.scaler = StandardScaler()
        self.similarity_matrix = None
        self.book_metadata = None
        self.user_factors = None
        self.book_factors = None
        self.model_loaded = False
        self.user_similarity = {}  # ✅ Initialize this
        
        # Model paths
        self.model_dir = Path(settings.BASE_DIR) / 'models' / 'recommendations'
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.similarity_path = self.model_dir / 'similarity_matrix.npy'
        self.metadata_path = self.model_dir / 'book_metadata.pkl'
        self.tfidf_path = self.model_dir / 'tfidf_vectorizer.pkl'
        
        # Try to load existing model
        self._load_model()

    # ==================== Model Loading/Saving ====================
    
    def _load_model(self):
        """Load pre-trained model if exists"""
        try:
            if self.similarity_path.exists() and self.metadata_path.exists():
                self.similarity_matrix = np.load(self.similarity_path)
                self.book_metadata = pd.read_pickle(self.metadata_path)
                self.model_loaded = True
                logger.info(f"Loaded existing recommendation model with {len(self.book_metadata)} books")
                return True
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
        return False

    def _save_model(self):
        """Save trained model"""
        try:
            np.save(self.similarity_path, self.similarity_matrix)
            pd.to_pickle(self.book_metadata, self.metadata_path)
            logger.info("Saved recommendation model successfully")
            return True
        except Exception as e:
            logger.error(f"Error saving model: {str(e)}")
            return False

    # ==================== Content-Based Filtering ====================
    
    def build_content_based_model(self, force_rebuild=False):
        """Build content-based similarity matrix using book metadata"""
        try:
            if self.model_loaded and not force_rebuild:
                return True
            
            books = Book.objects.select_related('category').all()
            if books.count() == 0:
                logger.warning("No books found in database")
                return False

            # Create comprehensive feature matrix
            features = []
            for book in books:
                # Combine all text features
                text = " ".join([
                    book.title or '',
                    book.author or '',
                    book.category.name if book.category else '',
                    book.sub_category or '',
                    book.keywords or '',
                    book.description or '',
                    book.publisher or '',
                ]).lower()
                features.append(text)

            # TF-IDF Vectorization
            tfidf_matrix = self.tfidf_vectorizer.fit_transform(features)
            
            # Reduce dimensions for better performance
            if tfidf_matrix.shape[0] > 50:
                tfidf_matrix = self.svd.fit_transform(tfidf_matrix)
                self.similarity_matrix = cosine_similarity(tfidf_matrix)
            else:
                self.similarity_matrix = cosine_similarity(tfidf_matrix)

            # Create metadata DataFrame
            from django.db.models import Avg
            self.book_metadata = pd.DataFrame({
                'book_id': [book.id for book in books],
                'title': [book.title for book in books],
                'author': [book.author for book in books],
                'category': [book.category.name if book.category else '' for book in books],
                'description': [book.description or '' for book in books],
                'average_rating': [book.reviews.aggregate(Avg('rating'))['rating__avg'] or 0 for book in books],
                'borrow_count': [book.borrowings.filter(status='returned').count() for book in books],
                'available_quantity': [book.available_quantity for book in books],
            })
            
            self.model_loaded = True
            self._save_model()
            
            logger.info(f"Built content-based model for {books.count()} books")
            return True

        except Exception as e:
            logger.error(f"Error building content-based model: {str(e)}")
            return False

    def get_content_based_recommendations(self, user, top_n=10):
        """Get recommendations based on book content similarity"""
        try:
            if not self.model_loaded:
                self.build_content_based_model()
            
            if self.similarity_matrix is None or self.book_metadata is None:
                return self.get_popular_books(top_n)
            
            # Get user's borrowed books
            borrowed_books = Borrow.objects.filter(
                user=user,
                status='returned'
            ).values_list('book_id', flat=True)
            
            # Get user's reviewed books with high ratings
            high_rated_books = BookReview.objects.filter(
                user=user,
                rating__gte=4
            ).values_list('book_id', flat=True)
            
            # Combine user's interactions
            user_books = list(set(list(borrowed_books) + list(high_rated_books)))
            
            if not user_books:
                return self.get_popular_books(top_n)
            
            # Get indices of books user has interacted with
            user_indices = []
            for book_id in user_books[:5]:  # Limit for performance
                idx = self.book_metadata[self.book_metadata['book_id'] == book_id].index
                if len(idx) > 0:
                    user_indices.append(idx[0])
            
            if not user_indices:
                return self.get_popular_books(top_n)
            
            # Calculate average similarity scores
            similarity_scores = np.mean(self.similarity_matrix[user_indices], axis=0)
            
            # Get top similar books (excluding already borrowed)
            similar_indices = np.argsort(similarity_scores)[::-1]
            
            recommendations = []
            borrowed_set = set(borrowed_books)
            seen = set()
            
            for idx in similar_indices:
                book_id = self.book_metadata.iloc[idx]['book_id']
                if book_id not in borrowed_set and book_id not in seen:
                    seen.add(book_id)
                    try:
                        book = Book.objects.get(id=book_id)
                        recommendations.append(book)
                    except Book.DoesNotExist:
                        continue
                    if len(recommendations) >= top_n:
                        break
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error getting content-based recommendations: {str(e)}")
            return self.get_popular_books(top_n)

    # ==================== Collaborative Filtering ====================
    
    def build_collaborative_model(self):
        """Build collaborative filtering model using user-book interactions"""
        try:
            # Get all borrow interactions
            borrows = Borrow.objects.filter(
                status='returned'
            ).select_related('user', 'book')
            
            if borrows.count() < 10:
                logger.warning("Not enough data for collaborative filtering")
                return False
            
            # Create user-item matrix
            user_book_matrix = {}
            users = User.objects.filter(borrowings__status='returned').distinct()
            
            for user in users:
                user_books = Borrow.objects.filter(
                    user=user,
                    status='returned'
                ).values_list('book_id', flat=True)
                user_book_matrix[user.id] = set(user_books)
            
            # Find similar users based on Jaccard similarity
            self.user_similarity = {}
            user_list = list(user_book_matrix.keys())
            
            for i, user1 in enumerate(user_list):
                for user2 in user_list[i+1:]:
                    if user1 not in self.user_similarity:
                        self.user_similarity[user1] = {}
                    
                    set1 = user_book_matrix[user1]
                    set2 = user_book_matrix[user2]
                    
                    if set1 and set2:
                        intersection = len(set1.intersection(set2))
                        union = len(set1.union(set2))
                        similarity = intersection / union if union > 0 else 0
                        
                        if similarity > 0.2:  # Threshold for similarity
                            self.user_similarity[user1][user2] = similarity
                            if user2 not in self.user_similarity:
                                self.user_similarity[user2] = {}
                            self.user_similarity[user2][user1] = similarity
            
            logger.info(f"Built collaborative model with {len(self.user_similarity)} users")
            return True
            
        except Exception as e:
            logger.error(f"Error building collaborative model: {str(e)}")
            return False

    def get_collaborative_recommendations(self, user, top_n=10):
        """Get recommendations based on similar users"""
        try:
            # Get user's borrowed books
            user_books = set(Borrow.objects.filter(
                user=user,
                status='returned'
            ).values_list('book_id', flat=True))
            
            if not user_books:
                return self.get_popular_books(top_n)
            
            # Find similar users
            similar_users = User.objects.filter(
                borrowings__book__in=user_books,
                borrowings__status='returned'
            ).exclude(id=user.id).annotate(
                common_books=Count('borrowings', filter=Q(borrowings__book__in=user_books))
            ).filter(common_books__gte=1).order_by('-common_books')[:20]
            
            if not similar_users:
                return self.get_popular_books(top_n)
            
            # Get books borrowed by similar users
            recommended_books = Book.objects.filter(
                borrowings__user__in=similar_users,
                borrowings__status='returned'
            ).exclude(
                borrowings__user=user
            ).annotate(
                recommendation_score=Count('borrowings')
            ).order_by('-recommendation_score')[:top_n]
            
            return list(recommended_books)
            
        except Exception as e:
            logger.error(f"Error getting collaborative recommendations: {str(e)}")
            return self.get_popular_books(top_n)

    # ==================== Hybrid Recommendations ====================
    
    def get_hybrid_recommendations(self, user, top_n=10):
        """
        Combine content-based and collaborative filtering recommendations
        with weighted scoring
        """
        try:
            content_recs = self.get_content_based_recommendations(user, top_n * 2)
            collab_recs = self.get_collaborative_recommendations(user, top_n)
            
            # Weight scores
            content_weight = 0.6
            collab_weight = 0.4
            
            # Combine and rank
            book_scores = {}
            
            for i, book in enumerate(content_recs):
                score = (1 - i / len(content_recs)) * content_weight if content_recs else 0
                book_scores[book.id] = score
            
            for i, book in enumerate(collab_recs):
                score = (1 - i / len(collab_recs)) * collab_weight if collab_recs else 0
                if book.id in book_scores:
                    book_scores[book.id] += score
                else:
                    book_scores[book.id] = score
            
            # Sort by score and return top N
            sorted_books = sorted(book_scores.items(), key=lambda x: x[1], reverse=True)
            
            recommendations = []
            seen = set()
            for book_id, score in sorted_books:
                if book_id in seen:
                    continue
                seen.add(book_id)
                try:
                    book = Book.objects.get(id=book_id)
                    recommendations.append(book)
                except Book.DoesNotExist:
                    continue
                if len(recommendations) >= top_n:
                    break
            
            # Save recommendations to database
            self._save_recommendations(user, recommendations)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error getting hybrid recommendations: {str(e)}")
            return self.get_popular_books(top_n)

    # ==================== Popular Books (Fallback) ====================
    
    def get_popular_books(self, top_n=10):
        """Get popular books based on borrowing frequency and ratings"""
        try:
            popular_books = Book.objects.annotate(
                borrow_count=Count('borrowings', filter=Q(borrowings__status='returned')),
                avg_rating=Avg('reviews__rating'),
                review_count=Count('reviews')
            ).filter(
                borrow_count__gt=0
            ).order_by(
                '-borrow_count', '-avg_rating'
            )[:top_n]
            
            if not popular_books:
                return Book.objects.all()[:top_n]
            
            return list(popular_books)
            
        except Exception as e:
            logger.error(f"Error getting popular books: {str(e)}")
            return Book.objects.all()[:top_n]

    # ==================== Category-Based Recommendations ====================
    
    def get_category_recommendations(self, user, top_n=10):
        """Recommend books from user's preferred categories"""
        try:
            # Get user's category preferences
            borrowed_books = Borrow.objects.filter(
                user=user,
                status='returned'
            ).select_related('book__category')
            
            if not borrowed_books:
                return self.get_popular_books(top_n)
            
            # Count category occurrences
            category_counts = {}
            for borrow in borrowed_books:
                if borrow.book.category:
                    cat_name = borrow.book.category.name
                    category_counts[cat_name] = category_counts.get(cat_name, 0) + 1
            
            if not category_counts:
                return self.get_popular_books(top_n)
            
            # Get top categories
            top_categories = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            top_category_names = [cat[0] for cat in top_categories]
            
            # Get books from these categories
            borrowed_ids = set(borrowed_books.values_list('book_id', flat=True))
            
            recommendations = Book.objects.filter(
                category__name__in=top_category_names
            ).exclude(
                id__in=borrowed_ids
            ).annotate(
                borrow_count=Count('borrowings')
            ).order_by('-borrow_count')[:top_n]
            
            return list(recommendations)
            
        except Exception as e:
            logger.error(f"Error getting category recommendations: {str(e)}")
            return self.get_popular_books(top_n)

    # ==================== Similar Books ====================
    
    def get_similar_books(self, book_id, top_n=10):
        """Get books similar to a given book"""
        try:
            if not self.model_loaded:
                self.build_content_based_model()
            
            if self.similarity_matrix is None or self.book_metadata is None:
                return []
            
            # Find book index
            idx = self.book_metadata[self.book_metadata['book_id'] == book_id].index
            if len(idx) == 0:
                return []
            
            idx = idx[0]
            similarity_scores = list(enumerate(self.similarity_matrix[idx]))
            similarity_scores = sorted(similarity_scores, key=lambda x: x[1], reverse=True)
            
            # Get top similar books
            similar_indices = [i[0] for i in similarity_scores[1:top_n+1]]
            
            similar_books = []
            for i in similar_indices:
                similar_books.append({
                    'book_id': self.book_metadata.iloc[i]['book_id'],
                    'score': similarity_scores[similar_indices.index(i) + 1][1]
                })
            
            return similar_books
            
        except Exception as e:
            logger.error(f"Error getting similar books: {str(e)}")
            return []

    # ==================== Personalization ====================
    
    def get_personalized_recommendations(self, user, top_n=10):
        """Get personalized recommendations for a user"""
        try:
            # Check if user has existing recent recommendations
            recent_recs = Recommendation.objects.filter(
                user=user,
                created_at__gte=timezone.now() - timedelta(days=7)
            ).order_by('-score')[:top_n]
            
            if recent_recs:
                return [rec.book for rec in recent_recs]
            
            # Check if user has borrowing history
            has_history = Borrow.objects.filter(user=user, status='returned').exists()
            
            if has_history:
                # Use hybrid recommendations
                recommendations = self.get_hybrid_recommendations(user, top_n)
            else:
                # New user - use popularity and category-based
                recommendations = self.get_popular_books(top_n)
            
            # Save recommendations
            self._save_recommendations(user, recommendations)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error getting personalized recommendations: {str(e)}")
            return self.get_popular_books(top_n)

    # ==================== Recommendation Storage ====================
    
    def _save_recommendations(self, user, books):
        """Save recommendations to database"""
        try:
            # Delete old recommendations
            Recommendation.objects.filter(user=user).delete()
            
            for i, book in enumerate(books):
                score = 1.0 - (i / len(books)) if books else 0.5
                Recommendation.objects.create(
                    user=user,
                    book=book,
                    score=score,
                    algorithm_used='hybrid'
                )
            
            logger.info(f"Saved {len(books)} recommendations for user {user.id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving recommendations: {str(e)}")
            return False

    # ==================== User Activity Tracking ====================
    
    def record_user_activity(self, user_id, book_id, activity_type, data=None):
        """Record user activity for better recommendations"""
        try:
            user = User.objects.get(id=user_id)
            book = Book.objects.get(id=book_id)
            
            RecommendationActivity.objects.create(
                user=user,
                book=book,
                activity_type=activity_type,
                data=data or {}
            )
            
            # Update recommendation scores based on activity
            if activity_type in ['borrow', 'return']:
                self._update_user_preferences(user)
            
            return True
            
        except Exception as e:
            logger.error(f"Error recording user activity: {str(e)}")
            return False

    def _update_user_preferences(self, user):
        """Update user preferences based on activity"""
        try:
            # Get user's recent activity
            recent_activities = RecommendationActivity.objects.filter(
                user=user,
                created_at__gte=timezone.now() - timedelta(days=30)
            )
            
            if recent_activities.count() > 5:
                # Update recommendations
                self.get_personalized_recommendations(user, 10)
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating user preferences: {str(e)}")
            return False

    # ==================== Model Management ====================
    
    def retrain_model(self):
        """Retrain the recommendation model with latest data"""
        try:
            self.build_content_based_model(force_rebuild=True)
            self.build_collaborative_model()
            self._save_model()
            logger.info("Model retrained successfully")
            return True
        except Exception as e:
            logger.error(f"Error retraining model: {str(e)}")
            return False

    def get_model_stats(self):
        """Get model statistics"""
        return {
            'model_loaded': self.model_loaded,
            'total_books': len(self.book_metadata) if self.book_metadata is not None else 0,
            'similarity_matrix_shape': self.similarity_matrix.shape if self.similarity_matrix is not None else None,
            'model_size': self.similarity_path.stat().st_size if self.similarity_path.exists() else 0
        }


# Global instance
recommender = BookRecommender()