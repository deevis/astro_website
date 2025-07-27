#!/usr/bin/env python3
"""
Production News Feed System - Minimal Version
Core functionality for RSS parsing, duplicate detection, and source aggregation
"""

import json
import hashlib
import re
import logging
import glob
import os
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Set, Optional
from difflib import SequenceMatcher

# External dependencies (install via: pip install feedparser beautifulsoup4 requests python-dateutil)
try:
    import feedparser
    import requests
    from bs4 import BeautifulSoup
    from dateutil import parser as date_parser
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install feedparser beautifulsoup4 requests python-dateutil")
    exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('news_feed.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class DuplicateDetector:
    """Advanced duplicate detection for news articles"""
    
    def __init__(self, similarity_threshold: float = 0.55):
        self.similarity_threshold = similarity_threshold
    
    def extract_story_elements(self, title: str, content: str = "") -> Dict[str, Any]:
        """Extract key story elements for comparison"""
        text = f"{title} {content}".lower()
        
        elements = {
            'numbers': re.findall(r'\$?(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:k|thousand|million|billion|trillion)?', text),
            'entities': re.findall(r'\b(bitcoin|btc|ethereum|eth|github|python|node\.?js|ruby|rails|google|apple|microsoft)\b', text),
            'actions': re.findall(r'\b(breaks?|hits?|reaches?|surges?|falls?|drops?|release[ds]?|launches?|announces?)\b', text),
            'keywords': re.findall(r'\b(high|record|all-time|ath|beta|version|price|market|ai|artificial|intelligence)\b', text)
        }
        
        return {k: list(set(v)) for k, v in elements.items()}
    
    def calculate_similarity(self, article1: Dict[str, Any], article2: Dict[str, Any]) -> float:
        """Calculate similarity between two articles"""
        elements1 = self.extract_story_elements(article1.get('title', ''), article1.get('content_preview', ''))
        elements2 = self.extract_story_elements(article2.get('title', ''), article2.get('content_preview', ''))
        
        # Calculate similarity for each element type
        similarities = {}
        for key in elements1.keys():
            if elements1[key] and elements2[key]:
                common = set(elements1[key]).intersection(set(elements2[key]))
                total = set(elements1[key]).union(set(elements2[key]))
                similarities[key] = len(common) / len(total) if total else 0
            else:
                similarities[key] = 0
        
        # Title similarity
        title1 = re.sub(r'[^\w\s]', '', article1.get('title', '').lower())
        title2 = re.sub(r'[^\w\s]', '', article2.get('title', '').lower())
        title_similarity = SequenceMatcher(None, title1, title2).ratio()
        
        # Category match bonus
        category_match = 1.0 if article1.get('category') == article2.get('category') else 0.5
        
        # Weighted combination
        final_similarity = (
            similarities['numbers'] * 0.25 +
            similarities['entities'] * 0.25 + 
            similarities['actions'] * 0.15 +
            similarities['keywords'] * 0.15 +
            title_similarity * 0.15 +
            category_match * 0.05
        )
        
        return final_similarity
    
    def find_duplicate_groups(self, articles: List[Dict[str, Any]]) -> List[List[int]]:
        """Find groups of duplicate articles"""
        duplicate_groups = []
        processed = set()
        
        for i, article1 in enumerate(articles):
            if i in processed:
                continue
                
            current_group = [i]
            
            for j, article2 in enumerate(articles[i+1:], i+1):
                if j in processed:
                    continue
                    
                similarity = self.calculate_similarity(article1, article2)
                
                if similarity >= self.similarity_threshold:
                    current_group.append(j)
                    processed.add(j)
            
            if len(current_group) > 1:
                duplicate_groups.append(current_group)
                processed.update(current_group)
        
        return duplicate_groups

class RSSParser:
    """RSS feed parser with rate limiting"""
    
    def __init__(self, delay: int = 8):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; NewsAggregator/1.0)'
        })
    
    def parse_feed(self, url: str, category: str) -> List[Dict[str, Any]]:
        """Parse RSS feed and return articles"""
        articles = []
        
        try:
            import time
            time.sleep(self.delay)  # Rate limiting
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            feed = feedparser.parse(response.content)
            
            for entry in feed.entries[:5]:  # Limit to 5 articles per feed
                # Filter Bitcoin articles to only include those with "BTC" or "Bitcoin" in title
                if category == 'bitcoin':
                    title_lower = entry.title.lower()
                    if not ('btc' in title_lower or 'bitcoin' in title_lower):
                        continue  # Skip articles without BTC or Bitcoin in title
                
                article = {
                    'id': hashlib.md5(entry.link.encode()).hexdigest()[:12],
                    'title': entry.title,
                    'url': entry.link,
                    'source': feed.feed.get('title', 'Unknown'),
                    'author': getattr(entry, 'author', ''),
                    'published_date': self._parse_date(getattr(entry, 'published', '')),
                    'category': category,
                    'content_preview': self._extract_preview(entry),
                    'importance': self._determine_importance(entry.title, category),
                    'tags': self._generate_tags(entry.title, category)
                }
                articles.append(article)
                
        except Exception as e:
            logger.error(f"Error parsing feed {url}: {e}")
        
        return articles
    
    def _parse_date(self, date_str: str) -> str:
        """Parse date string to ISO format"""
        if not date_str:
            return datetime.now(timezone.utc).isoformat()
        
        try:
            parsed_date = date_parser.parse(date_str)
            if parsed_date.tzinfo is None:
                parsed_date = parsed_date.replace(tzinfo=timezone.utc)
            return parsed_date.isoformat()
        except:
            return datetime.now(timezone.utc).isoformat()
    
    def _extract_preview(self, entry) -> str:
        """Extract content preview from entry"""
        content = ""
        if hasattr(entry, 'summary'):
            content = entry.summary
        elif hasattr(entry, 'description'):
            content = entry.description
        
        # Clean HTML
        if content:
            soup = BeautifulSoup(content, 'html.parser')
            content = soup.get_text()
        
        return content[:300] + "..." if len(content) > 300 else content
    
    def _determine_importance(self, title: str, category: str) -> str:
        """Determine article importance"""
        title_lower = title.lower()
        
        high_keywords = ['breaking', 'major', 'record', 'all-time', 'release', 'announces', 'launches']
        if any(keyword in title_lower for keyword in high_keywords):
            return 'high'
        
        if category == 'bitcoin' and any(word in title_lower for word in ['price', 'surge', 'rally']):
            return 'high'
        
        return 'medium'
    
    def _generate_tags(self, title: str, category: str) -> List[str]:
        """Generate tags for article"""
        tags = [category]
        title_lower = title.lower()
        
        # Category-specific tags
        if category == 'bitcoin':
            if 'price' in title_lower or '$' in title:
                tags.append('price')
            if any(word in title_lower for word in ['record', 'high', 'ath']):
                tags.append('ath')
        
        elif category == 'software_dev':
            if any(lang in title_lower for lang in ['python', 'ruby', 'javascript', 'node']):
                tags.extend(['programming', 'language'])
            if 'release' in title_lower or 'version' in title_lower:
                tags.append('release')
        
        elif category == 'ai_progress':
            if any(word in title_lower for word in ['gpt', 'llm', 'model']):
                tags.append('llm')
            if 'regulation' in title_lower or 'law' in title_lower:
                tags.append('regulation')
        
        return tags

class SourceAggregator:
    """Aggregates duplicate articles from multiple sources"""
    
    def __init__(self):
        self.duplicate_detector = DuplicateDetector()
    
    def merge_articles(self, articles: List[Dict[str, Any]], indices: List[int]) -> Dict[str, Any]:
        """Merge duplicate articles into one"""
        if not indices:
            return None
        
        # Use highest importance article as base
        base_article = max([articles[i] for i in indices], 
                          key=lambda x: {'high': 3, 'medium': 2, 'low': 1}.get(x.get('importance', 'low'), 1))
        base_article = base_article.copy()
        
        # Aggregate sources
        sources = []
        for idx in indices:
            article = articles[idx]
            sources.append({
                'name': article.get('source', ''),
                'url': article.get('url', ''),
                'author': article.get('author', ''),
                'published_date': article.get('published_date', '')
            })
        
        # Update article with aggregated info
        base_article['sources'] = sources
        base_article['source_count'] = len(sources)
        base_article['aggregated'] = True
        
        # Add source summary
        source_names = [s['name'] for s in sources if s['name']]
        unique_sources = list(dict.fromkeys(source_names))
        
        if len(unique_sources) > 1:
            base_article['content_preview'] += f" [Reported by: {', '.join(unique_sources)}]"
        
        # Update tags
        tags = base_article.get('tags', [])
        if 'multi-source' not in tags:
            tags.append('multi-source')
        base_article['tags'] = tags
        
        # Generate new ID
        source_hash = hashlib.md5(''.join(sorted(unique_sources)).encode()).hexdigest()[:8]
        base_article['id'] = f"agg_{source_hash}"
        
        return base_article
    
    def aggregate(self, articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process articles and aggregate duplicates"""
        if not articles:
            return articles
        
        duplicate_groups = self.duplicate_detector.find_duplicate_groups(articles)
        processed_indices = set()
        result = []
        
        # Process duplicate groups
        for group in duplicate_groups:
            merged = self.merge_articles(articles, group)
            if merged:
                result.append(merged)
                processed_indices.update(group)
        
        # Add non-duplicate articles
        for i, article in enumerate(articles):
            if i not in processed_indices:
                article_copy = article.copy()
                article_copy['aggregated'] = False
                article_copy['source_count'] = 1
                article_copy['sources'] = [{
                    'name': article.get('source', ''),
                    'url': article.get('url', ''),
                    'author': article.get('author', ''),
                    'published_date': article.get('published_date', '')
                }]
                result.append(article_copy)
        
        # Sort by date
        result.sort(key=lambda x: x.get('published_date', ''), reverse=True)
        
        logger.info(f"Aggregated {len(articles)} → {len(result)} articles")
        return result

class ProductionNewsFeed:
    """Production news feed system"""
    
    def __init__(self, update_interval_hours: int = 5):
        self.update_interval_hours = update_interval_hours
        self.base_filename = "news_feed"
        self.base_directory = "../../public/news_feeds"
        self.rss_parser = RSSParser()
        self.aggregator = SourceAggregator()
        
        # Production RSS feeds
        self.feeds = {
            'bitcoin': [
                'https://www.coindesk.com/arc/outboundfeeds/rss/',
                'https://cointelegraph.com/rss',
                'https://cryptoslate.com/feed/',
                'https://bitcoinist.com/feed',
                'https://newsbtc.com/feed',
                'https://decrypt.co/feed',
                'https://cryptopotato.com/feed/'
            ],
            'ai_progress': [
                'http://rss.slashdot.org/Slashdot/slashdotMain',
                'https://techcrunch.com/category/artificial-intelligence/feed/',
                'https://venturebeat.com/category/ai/feed/',
                'https://openai.com/blog/rss.xml'
            ],
            'software_dev': [
                'http://rss.slashdot.org/Slashdot/slashdotDevelopers',
                'https://github.blog/feed/',
                'https://stackoverflow.blog/feed/',
                'https://dev.to/feed',
                'https://nodejs.org/en/feed/blog.xml',
                'https://weblog.rubyonrails.org/feed/atom.xml'
            ]
        }
    
    def _ensure_directory_exists(self, directory_path: str) -> None:
        """Create directory if it doesn't exist"""
        os.makedirs(directory_path, exist_ok=True)
    
    def _generate_timestamped_filename(self) -> str:
        """Generate timestamped filename with directory structure"""
        now = datetime.now(timezone.utc)
        
        # Create year/month directory structure
        year = now.strftime('%Y')
        month = now.strftime('%m')
        directory = os.path.join(self.base_directory, year, month)
        
        # Ensure directory exists
        self._ensure_directory_exists(directory)
        
        # Generate filename
        timestamp = now.strftime('%Y-%m-%d_%H-%M-%S')
        filename = f"{self.base_filename}_{timestamp}.json"
        
        return os.path.join(directory, filename)
    
    def _get_most_recent_file(self) -> Optional[str]:
        """Find the most recent news feed file across all subdirectories"""
        if not os.path.exists(self.base_directory):
            return None
        
        # Search pattern across all subdirectories
        pattern = os.path.join(self.base_directory, "**", f"{self.base_filename}_*.json")
        files = glob.glob(pattern, recursive=True)
        
        if not files:
            # Fallback: check current directory for legacy files
            legacy_pattern = f"{self.base_filename}_*.json"
            files = glob.glob(legacy_pattern)
        
        if not files:
            return None
        
        # Sort by creation time (newest first)
        files.sort(key=lambda x: os.path.getctime(x), reverse=True)
        return files[0]
    
    def _parse_timestamp_from_filename(self, filepath: str) -> Optional[datetime]:
        """Extract timestamp from filepath"""
        try:
            # Get just the filename from the full path
            filename = os.path.basename(filepath)
            # Extract timestamp part from filename like "news_feed_2025-06-19_21-41-57.json"
            timestamp_part = filename.replace(f"{self.base_filename}_", "").replace(".json", "")
            return datetime.strptime(timestamp_part, '%Y-%m-%d_%H-%M-%S').replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    
    def _should_update(self) -> tuple[bool, Optional[str]]:
        """Check if enough time has passed since last update"""
        most_recent = self._get_most_recent_file()
        if not most_recent:
            return True, None
        
        # Try to parse timestamp from filename first
        file_timestamp = self._parse_timestamp_from_filename(most_recent)
        
        # If filename parsing fails, use file modification time
        if not file_timestamp:
            file_timestamp = datetime.fromtimestamp(os.path.getmtime(most_recent), tz=timezone.utc)
        else:
            # For testing: also check file modification time and use the older of the two
            # This allows our test script to work by modifying file timestamps
            mod_time = datetime.fromtimestamp(os.path.getmtime(most_recent), tz=timezone.utc)
            # Use the older time (allows test to make file appear older)
            if mod_time < file_timestamp:
                file_timestamp = mod_time
        
        time_since_update = datetime.now(timezone.utc) - file_timestamp
        hours_since_update = time_since_update.total_seconds() / 3600
        
        should_update = hours_since_update >= self.update_interval_hours
        return should_update, most_recent
    
    def _generate_source_summary(self, filename: str) -> Dict[str, Any]:
        """Generate summary of articles by source from existing file"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            articles = data.get('news_feed', {}).get('articles', [])
            
            # Count articles by source
            source_counts = {}
            category_counts = {}
            total_articles = len(articles)
            
            for article in articles:
                source = article.get('source', 'Unknown')
                category = article.get('category', 'unknown')
                
                source_counts[source] = source_counts.get(source, 0) + 1
                category_counts[category] = category_counts.get(category, 0) + 1
            
            # Get metadata
            metadata = data.get('news_feed', {}).get('metadata', {})
            generated_at = data.get('news_feed', {}).get('generated_at', 'Unknown')
            
            return {
                'filename': filename,
                'generated_at': generated_at,
                'total_articles': total_articles,
                'source_counts': dict(sorted(source_counts.items(), key=lambda x: x[1], reverse=True)),
                'category_counts': dict(sorted(category_counts.items(), key=lambda x: x[1], reverse=True)),
                'metadata': metadata
            }
            
        except Exception as e:
            logger.error(f"Error reading summary from {filename}: {e}")
            return {
                'filename': filename,
                'error': str(e),
                'total_articles': 0,
                'source_counts': {},
                'category_counts': {}
            }
    
    def print_summary(self, filename: Optional[str] = None) -> None:
        """Print summary of the most recent news feed"""
        if not filename:
            filename = self._get_most_recent_file()
        
        if not filename:
            print("📭 No news feed files found")
            return
        
        summary = self._generate_source_summary(filename)
        
        if 'error' in summary:
            print(f"❌ Error reading {filename}: {summary['error']}")
            return
        
        print(f"\n📊 News Feed Summary")
        print(f"📁 File: {summary['filename']}")
        print(f"🕒 Generated: {summary.get('generated_at', 'Unknown')}")
        print(f"📰 Total articles: {summary['total_articles']}")
        
        if summary['category_counts']:
            print(f"\n📂 Articles by category:")
            for category, count in summary['category_counts'].items():
                print(f"   {category}: {count}")
        
        if summary['source_counts']:
            print(f"\n🌐 Articles by source:")
            for source, count in list(summary['source_counts'].items())[:10]:  # Top 10 sources
                print(f"   {source}: {count}")
            
            if len(summary['source_counts']) > 10:
                remaining = len(summary['source_counts']) - 10
                print(f"   ... and {remaining} more sources")

    def fetch_articles(self) -> List[Dict[str, Any]]:
        """Fetch articles from all RSS feeds"""
        all_articles = []
        
        for category, urls in self.feeds.items():
            logger.info(f"Fetching {category} articles...")
            for url in urls:
                logger.info(f"   Parsing feed: {url}")
                articles = self.rss_parser.parse_feed(url, category)
                all_articles.extend(articles)
        
        return all_articles
    
    def generate_feed(self) -> Dict[str, Any]:
        """Generate complete news feed"""
        logger.info("Starting news feed generation...")
        
        # Fetch articles
        articles = self.fetch_articles()
        logger.info(f"Fetched {len(articles)} articles")
        
        # Apply source aggregation
        aggregated = self.aggregator.aggregate(articles)
        
        # Generate feed
        feed = {
            "news_feed": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "version": "4.0",
                "system": "production_minimal",
                "articles": aggregated,
                "metadata": {
                    "total_articles": len(aggregated),
                    "aggregated_articles": sum(1 for a in aggregated if a.get('aggregated', False)),
                    "multi_source_articles": sum(1 for a in aggregated if a.get('source_count', 1) > 1),
                    "total_sources": sum(len(urls) for urls in self.feeds.values()),
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "update_interval_hours": self.update_interval_hours
                }
            }
        }
        
        return feed
    
    def save_feed(self) -> str:
        """Generate and save news feed with timestamp"""
        feed = self.generate_feed()
        output_file = self._generate_timestamped_filename()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(feed, f, indent=2, ensure_ascii=False)
        
        # Also create latest.json for easy access in public directory
        latest_file = os.path.join(self.base_directory, 'latest.json')
        with open(latest_file, 'w', encoding='utf-8') as f:
            json.dump(feed, f, indent=2, ensure_ascii=False)
        
        # ALSO update the dist directory for production serving (if it exists)
        dist_base_directory = "../../dist"
        if not os.path.exists(dist_base_directory):
            dist_base_directory = "/app/dist"

        if os.path.exists(dist_base_directory):
            dist_directory = os.path.join(dist_base_directory, "news_feeds")
            self._ensure_directory_exists(dist_directory)
            
            # Copy latest.json to dist directory
            dist_latest_file = os.path.join(dist_directory, 'latest.json')
            with open(dist_latest_file, 'w', encoding='utf-8') as f:
                json.dump(feed, f, indent=2, ensure_ascii=False)
            
            # Copy timestamped file to dist directory structure
            dist_output_file = output_file.replace(self.base_directory, dist_directory)
            dist_output_dir = os.path.dirname(dist_output_file)
            self._ensure_directory_exists(dist_output_dir)
            with open(dist_output_file, 'w', encoding='utf-8') as f:
                json.dump(feed, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Production dist files updated: {dist_latest_file}")
        else:
            logger.info("No dist directory found - running in development mode")
        
        logger.info(f"News feed saved to {output_file}")
        logger.info(f"Latest feed also saved to {latest_file}")
        return output_file
    
    def update_if_needed(self) -> tuple[bool, str]:
        """Update feed only if enough time has passed"""
        should_update, most_recent = self._should_update()
        
        if not should_update:
            hours_passed = (datetime.now(timezone.utc) - 
                          self._parse_timestamp_from_filename(most_recent)).total_seconds() / 3600
            logger.info(f"Skipping update - only {hours_passed:.1f} hours since last update "
                       f"(minimum: {self.update_interval_hours} hours)")
            return False, most_recent
        
        # Perform update
        output_file = self.save_feed()
        return True, output_file

def main():
    """Main function"""
    try:
        news_feed = ProductionNewsFeed(update_interval_hours=2)
        
        # Check if update is needed and perform it
        updated, output_file = news_feed.update_if_needed()
        
        if updated:
            print(f"✅ News feed generated successfully!")
            
            # Load and display results for new file
            with open(output_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            metadata = data['news_feed']['metadata']
            print(f"📊 Total articles: {metadata['total_articles']}")
            print(f"🔗 Aggregated articles: {metadata['aggregated_articles']}")
            print(f"🌐 Sources: {metadata['total_sources']}")
            print(f"📁 Output: {output_file}")
        else:
            print(f"⏰ Update skipped - using existing file: {output_file}")
        
        # Always show summary of the most recent file
        news_feed.print_summary(output_file)
        
        return True
        
    except Exception as e:
        logger.error(f"News feed generation failed: {e}")
        print(f"❌ Error: {e}")
        
        # Try to show summary of most recent file even if update failed
        try:
            news_feed = ProductionNewsFeed()
            news_feed.print_summary()
        except Exception as summary_error:
            logger.error(f"Could not show summary: {summary_error}")
        
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

