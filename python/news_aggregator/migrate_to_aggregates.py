#!/usr/bin/env python3
"""
Migration Script: Convert Raw Feeds to Monthly Aggregates
One-time script to process existing raw feed files into monthly aggregate format
"""

import json
import glob
import os
from datetime import datetime, timezone
from typing import Dict, List, Any
from collections import defaultdict
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import from our new system
from monthly_aggregate_system import StoryFingerprinter


class FeedMigrator:
    """Migrate raw feeds to monthly aggregates"""
    
    def __init__(self, feeds_directory: str = "../../public/news_feeds"):
        self.feeds_directory = feeds_directory
        self.fingerprinter = StoryFingerprinter()
    
    def load_feeds_for_month(self, year: int, month: int) -> List[Dict]:
        """Load all raw feed files for a given month"""
        pattern = os.path.join(
            self.feeds_directory,
            str(year),
            f"{month:02d}",
            "news_feed_*.json"
        )
        
        files = sorted(glob.glob(pattern))
        logger.info(f"Found {len(files)} feed files for {year}-{month:02d}")
        
        feeds = []
        for filepath in files:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                feeds.append({
                    'filepath': filepath,
                    'timestamp': data['news_feed']['generated_at'],
                    'articles': data['news_feed']['articles']
                })
            except Exception as e:
                logger.error(f"Error loading {filepath}: {e}")
        
        return feeds
    
    def track_story_lifecycles(self, feeds: List[Dict]) -> Dict[str, Dict]:
        """Track stories across all feeds in a month"""
        stories = {}
        
        logger.info(f"Processing {len(feeds)} feeds...")
        
        for feed_idx, feed in enumerate(feeds):
            if feed_idx % 20 == 0:
                logger.info(f"  Progress: {feed_idx}/{len(feeds)} feeds processed...")
            
            feed_timestamp = feed['timestamp']
            
            for article in feed['articles']:
                # Generate fingerprint
                story_id = self.fingerprinter.generate_fingerprint(article)
                
                # Check if this matches an existing story
                matched_story_id = story_id
                if story_id not in stories:
                    # Check for similarity with existing stories
                    for existing_id, existing_story in stories.items():
                        canonical = existing_story['canonical_article']
                        if self.fingerprinter.are_same_story(article, canonical):
                            matched_story_id = existing_id
                            break
                
                # Initialize or update story
                if matched_story_id not in stories:
                    stories[matched_story_id] = {
                        'story_id': matched_story_id,
                        'canonical_article': article.copy(),
                        'first_seen': feed_timestamp,
                        'last_seen': feed_timestamp,
                        'mention_timestamps': [],
                        'sources': [],
                        'importance_levels': []
                    }
                
                story = stories[matched_story_id]
                
                # Update lifecycle
                if feed_timestamp < story['first_seen']:
                    story['first_seen'] = feed_timestamp
                if feed_timestamp > story['last_seen']:
                    story['last_seen'] = feed_timestamp
                
                story['mention_timestamps'].append(feed_timestamp)
                story['importance_levels'].append(article.get('importance', 'medium'))
                
                # Track sources
                for source in article.get('sources', []):
                    source_entry = {
                        'name': source.get('name', ''),
                        'url': source.get('url', ''),
                        'author': source.get('author', ''),
                        'timestamp': feed_timestamp
                    }
                    story['sources'].append(source_entry)
                
                # Update canonical if higher importance
                importance_order = {'high': 3, 'medium': 2, 'low': 1}
                article_imp = importance_order.get(article.get('importance', 'medium'), 2)
                canonical_imp = importance_order.get(
                    story['canonical_article'].get('importance', 'medium'), 2
                )
                if article_imp > canonical_imp:
                    story['canonical_article'] = article.copy()
        
        logger.info(f"Tracked {len(stories)} unique stories from {sum(len(f['articles']) for f in feeds)} articles")
        return stories
    
    def deduplicate_sources(self, sources: List[Dict]) -> List[Dict]:
        """Remove duplicate source entries"""
        seen = set()
        unique = []
        
        for source in sources:
            key = (source['name'], source['url'])
            if key not in seen and source['url']:
                seen.add(key)
                unique.append(source)
        
        return unique
    
    def build_monthly_aggregate(self, year: int, month: int) -> str:
        """Build aggregate for a specific month"""
        logger.info(f"\n{'='*60}")
        logger.info(f"Building aggregate for {year}-{month:02d}")
        logger.info(f"{'='*60}")
        
        # Load all feeds
        feeds = self.load_feeds_for_month(year, month)
        
        if not feeds:
            logger.warning(f"No feeds found for {year}-{month:02d}")
            return None
        
        # Track story lifecycles
        stories_dict = self.track_story_lifecycles(feeds)
        
        # Convert to aggregate format
        stories = []
        for story_id, story_data in stories_dict.items():
            # Determine if story is still active (seen in last 48 hours of month)
            last_feed_time = datetime.fromisoformat(feeds[-1]['timestamp'])
            story_last_seen = datetime.fromisoformat(story_data['last_seen'])
            time_diff = (last_feed_time - story_last_seen).total_seconds() / 3600
            is_active = time_diff < 48
            
            # Get peak importance
            importance_counts = {
                'high': story_data['importance_levels'].count('high'),
                'medium': story_data['importance_levels'].count('medium'),
                'low': story_data['importance_levels'].count('low')
            }
            peak_importance = max(importance_counts.items(), key=lambda x: x[1])[0]
            
            # Deduplicate sources
            unique_sources = self.deduplicate_sources(story_data['sources'])
            
            story_entry = {
                'story_id': story_id,
                'title': story_data['canonical_article']['title'],
                'category': story_data['canonical_article']['category'],
                'importance': peak_importance,
                'first_seen': story_data['first_seen'],
                'last_seen': story_data['last_seen'],
                'is_active': is_active,
                'sources': unique_sources[:10],  # Limit to 10 sources
                'content_sample': story_data['canonical_article'].get('content_preview', '')[:200],
                'tags': story_data['canonical_article'].get('tags', []),
                'url': unique_sources[0]['url'] if unique_sources else ''
            }
            
            stories.append(story_entry)
        
        # Sort by first_seen (newest first)
        stories.sort(key=lambda s: s['first_seen'], reverse=True)
        
        # Calculate category distribution
        category_dist = defaultdict(int)
        for story in stories:
            category_dist[story['category']] += 1
        
        # Build aggregate document
        aggregate = {
            'monthly_aggregate': {
                'version': '2.0',
                'month': f"{year}-{month:02d}",
                'is_current': False,  # Historical month
                'created_at': datetime.now(timezone.utc).isoformat(),
                'last_updated': feeds[-1]['timestamp'] if feeds else datetime.now(timezone.utc).isoformat(),
                'total_articles': len(stories),
                'active_articles_count': sum(1 for s in stories if s.get('is_active')),
                'category_distribution': dict(category_dist),
                'source_stats': {
                    'total_feeds_processed': len(feeds),
                    'total_articles_processed': sum(len(f['articles']) for f in feeds),
                    'deduplication_ratio': round(
                        sum(len(f['articles']) for f in feeds) / len(stories), 2
                    ) if stories else 0
                },
                'articles': stories
            }
        }
        
        # Save aggregate
        output_dir = os.path.join(self.feeds_directory, str(year))
        os.makedirs(output_dir, exist_ok=True)
        
        output_path = os.path.join(output_dir, f"aggregate_{year}_{month:02d}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(aggregate, f, indent=2, ensure_ascii=False)
        
        # Calculate statistics
        original_size = sum(os.path.getsize(feed['filepath']) for feed in feeds)
        aggregate_size = os.path.getsize(output_path)
        savings_pct = ((original_size - aggregate_size) / original_size) * 100
        
        logger.info(f"\n✅ Aggregate created:")
        logger.info(f"   Original: {len(feeds)} files, {original_size/1024/1024:.2f}MB")
        logger.info(f"   Aggregate: {aggregate_size/1024:.2f}KB")
        logger.info(f"   Space savings: {savings_pct:.1f}%")
        logger.info(f"   Unique stories: {len(stories)}")
        logger.info(f"   Deduplication: {aggregate['monthly_aggregate']['source_stats']['deduplication_ratio']}x")
        logger.info(f"   Saved to: {output_path}\n")
        
        return output_path
    
    def migrate_all(self):
        """Migrate all existing months"""
        months_to_migrate = [
            (2025, 6, "June"),
            (2025, 7, "July"),
            (2025, 8, "August"),
            (2025, 9, "September")
            # (2025, 10, "October")
        ]
        
        print("\n" + "="*60)
        print("MIGRATION: Raw Feeds → Monthly Aggregates")
        print("="*60 + "\n")
        
        created_aggregates = []
        
        for year, month, month_name in months_to_migrate:
            try:
                aggregate_path = self.build_monthly_aggregate(year, month)
                if aggregate_path:
                    created_aggregates.append((month_name, aggregate_path))
            except Exception as e:
                logger.error(f"Failed to migrate {month_name} {year}: {e}")
                import traceback
                traceback.print_exc()
        
        # Create index
        self.create_index()
        
        # Final summary
        print("\n" + "="*60)
        print("🎉 MIGRATION COMPLETE!")
        print("="*60)
        print(f"\nCreated {len(created_aggregates)} monthly aggregates:")
        for month_name, path in created_aggregates:
            print(f"  ✓ {month_name}: {os.path.basename(path)}")
        
        print(f"\n📁 Aggregates saved to: {self.feeds_directory}/YYYY/")
        print("\n📝 Next steps:")
        print("  1. Review aggregates in public/news_feeds/YYYY/")
        print("  2. Test with: python python/news_aggregator/monthly_aggregate_system.py")
        print("  3. Consider removing old raw feeds (or add to .gitignore)")
        print("  4. Commit aggregates to Git")
        print("  5. Update Docker to use new system")
    
    def create_index(self):
        """Create index of all aggregates"""
        pattern = os.path.join(self.feeds_directory, "*", "aggregate_*.json")
        aggregates = sorted(glob.glob(pattern))
        
        index_data = []
        
        for aggregate_path in aggregates:
            try:
                with open(aggregate_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                agg = data['monthly_aggregate']
                filename = os.path.basename(aggregate_path)
                
                index_data.append({
                    'filename': filename,
                    'month': agg['month'],
                    'path': f"/news_feeds/{filename.split('_')[1]}/{filename}",
                    'total_articles': agg.get('total_articles', agg.get('total_stories', 0)),  # Support old format
                    'active_articles_count': agg.get('active_articles_count', agg.get('active_stories', 0)),  # Support old format
                    'is_current': agg.get('is_current', False)
                })
            except Exception as e:
                logger.error(f"Error indexing {aggregate_path}: {e}")
        
        index = {
            'aggregates_index': {
                'version': '2.0',
                'generated_at': datetime.now(timezone.utc).isoformat(),
                'total_aggregates': len(index_data),
                'aggregates': sorted(index_data, key=lambda x: x['month'], reverse=True)
            }
        }
        
        index_path = os.path.join(self.feeds_directory, 'index.json')
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Index created: {index_path}")


def main():
    """Main execution"""
    migrator = FeedMigrator()
    migrator.migrate_all()


if __name__ == "__main__":
    main()

