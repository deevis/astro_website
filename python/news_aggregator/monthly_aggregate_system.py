#!/usr/bin/env python3
"""
Monthly Aggregate News Feed System
Single living document per month that continuously updates with story lifecycles
"""

import json
import hashlib
import os
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from difflib import SequenceMatcher

# External dependencies
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
        logging.FileHandler('monthly_aggregate.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class StoryFingerprinter:
    """Generate consistent fingerprints for stories across time/sources"""
    
    def __init__(self, similarity_threshold: float = 0.95):
        self.similarity_threshold = similarity_threshold
    
    def extract_story_signature(self, article: Dict[str, Any]) -> Dict[str, Any]:
        """Extract stable story signature elements"""
        title = article.get('title', '').lower()
        content = article.get('content_preview', '').lower()
        text = f"{title} {content}"
        
        return {
            'entities': self._extract_entities(text),
            'numbers': self._extract_numbers(text),
            'actions': self._extract_actions(text),
            'keywords': self._extract_keywords(text),
            'category': article.get('category', 'unknown')
        }
    
    def _extract_entities(self, text: str) -> List[str]:
        entities = re.findall(
            r'\b(bitcoin|btc|ethereum|eth|github|python|node\.?js|ruby|rails|'
            r'google|apple|microsoft|amazon|meta|openai|anthropic|nvidia|intel|amd|'
            r'congress|senate|fed|treasury|sec|satoshi|lightning|taproot)\b',
            text
        )
        return sorted(list(set(entities)))
    
    def _extract_numbers(self, text: str) -> List[str]:
        numbers = re.findall(
            r'(\$?\d+(?:,\d{3})*(?:\.\d+)?[kmbt]?|\d+\.\d+\.\d+|\d+%)',
            text
        )
        return sorted(list(set(numbers)))
    
    def _extract_actions(self, text: str) -> List[str]:
        actions = re.findall(
            r'\b(break|hit|reach|surge|fall|drop|crash|release|launch|announce|'
            r'approve|reject|ban|allow|introduce|unveil|reveal|acquire|merge|'
            r'invest|raise|fund|fire|hire|quit|resign|upgrade|update)\w*\b',
            text
        )
        return sorted(list(set(actions)))
    
    def _extract_keywords(self, text: str) -> List[str]:
        keywords = re.findall(
            r'\b(high|low|record|all-time|ath|atl|beta|alpha|version|release|'
            r'price|market|crash|rally|bull|bear|regulation|law|bill|vote|'
            r'ai|artificial|intelligence|machine|learning|model|llm|halving|etf)\b',
            text
        )
        return sorted(list(set(keywords)))
    
    def generate_fingerprint(self, article: Dict[str, Any]) -> str:
        """Generate stable story fingerprint based on URL for uniqueness"""
        # Use URL as the primary fingerprint source for uniqueness
        url = article.get('url', '')
        if url:
            fingerprint = hashlib.md5(url.encode('utf-8')).hexdigest()[:16]
            return f"story_{fingerprint}"
        
        # Fallback to title-based fingerprint if no URL
        title = article.get('title', '').lower().strip()
        title_normalized = re.sub(r'[^\w\s]', '', title)
        fingerprint = hashlib.md5(title_normalized.encode('utf-8')).hexdigest()[:16]
        return f"story_{fingerprint}"
    
    def calculate_similarity(self, sig1: Dict, sig2: Dict) -> float:
        """Calculate similarity between two story signatures"""
        if sig1['category'] != sig2['category']:
            return 0.0
        
        similarities = []
        weights = {'entities': 0.35, 'numbers': 0.25, 'actions': 0.20, 'keywords': 0.20}
        
        for key, weight in weights.items():
            set1 = set(sig1.get(key, []))
            set2 = set(sig2.get(key, []))
            
            if not set1 and not set2:
                continue
            
            intersection = len(set1 & set2)
            union = len(set1 | set2)
            
            if union > 0:
                similarities.append((intersection / union) * weight)
        
        return sum(similarities)
    
    def are_same_story(self, article1: Dict, article2: Dict) -> bool:
        """Determine if two articles are the exact same (same URL or nearly identical title)"""
        url1 = article1.get('url', '').strip()
        url2 = article2.get('url', '').strip()
        
        # Only match if URLs are identical
        if url1 and url2 and url1 == url2:
            return True
        
        # Fallback: match if titles are nearly identical (95%+ similar)
        title1 = re.sub(r'[^\w\s]', '', article1.get('title', '').lower())
        title2 = re.sub(r'[^\w\s]', '', article2.get('title', '').lower())
        title_sim = SequenceMatcher(None, title1, title2).ratio()
        
        return title_sim >= self.similarity_threshold


class RSSParser:
    """RSS feed parser with rate limiting"""
    
    def __init__(self, delay: int = 8):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; NewsAggregator/2.0)'
        })
    
    def parse_feed(self, url: str, category: str) -> List[Dict[str, Any]]:
        """Parse RSS feed and return articles"""
        articles = []
        
        try:
            import time
            time.sleep(self.delay)
            
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            feed = feedparser.parse(response.content)
            
            for entry in feed.entries[:5]:
                # Filter Bitcoin articles
                if category == 'bitcoin':
                    title_lower = entry.title.lower()
                    if not ('btc' in title_lower or 'bitcoin' in title_lower):
                        continue
                
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
        content = ""
        if hasattr(entry, 'summary'):
            content = entry.summary
        elif hasattr(entry, 'description'):
            content = entry.description
        
        if content:
            soup = BeautifulSoup(content, 'html.parser')
            content = soup.get_text()
        
        return content[:300] + "..." if len(content) > 300 else content
    
    def _determine_importance(self, title: str, category: str) -> str:
        title_lower = title.lower()
        high_keywords = ['breaking', 'major', 'record', 'all-time', 'release', 'announces', 'launches']
        if any(keyword in title_lower for keyword in high_keywords):
            return 'high'
        if category == 'bitcoin' and any(word in title_lower for word in ['price', 'surge', 'rally']):
            return 'high'
        return 'medium'
    
    def _generate_tags(self, title: str, category: str) -> List[str]:
        tags = [category]
        title_lower = title.lower()
        
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


class MonthlyAggregateSystem:
    """Single living aggregate per month"""
    
    def __init__(self, base_directory: str = "../../public/news_feeds"):
        self.base_directory = base_directory
        self.fingerprinter = StoryFingerprinter()
        self.parser = RSSParser()
        
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
                # AI-focused sources only
                'https://techcrunch.com/category/artificial-intelligence/feed/',
                'https://venturebeat.com/category/ai/feed/',
                'https://openai.com/blog/rss.xml'
            ],
            'tech_news': [
                # General technology news
                'http://rss.slashdot.org/Slashdot/slashdotMain'
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
    
    def get_current_aggregate_path(self) -> str:
        """Get path for current month's aggregate"""
        now = datetime.now(timezone.utc)
        year = now.strftime('%Y')
        month = now.strftime('%m')
        
        directory = os.path.join(self.base_directory, year)
        os.makedirs(directory, exist_ok=True)
        
        return os.path.join(directory, f"aggregate_{year}_{month}.json")
    
    def load_current_aggregate(self) -> Dict:
        """Load or create current month's aggregate"""
        path = self.get_current_aggregate_path()
        
        if os.path.exists(path):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading aggregate, creating new: {e}")
        
        # Create new aggregate
        now = datetime.now(timezone.utc)
        return {
            "monthly_aggregate": {
                "version": "2.0",
                "month": now.strftime('%Y-%m'),
                "is_current": True,
                "created_at": now.isoformat(),
                "last_updated": now.isoformat(),
                "articles": []
            }
        }
    
    def find_matching_story(self, article: Dict, existing_articles: List[Dict]) -> Optional[str]:
        """Find if article matches an existing story"""
        article_sig = self.fingerprinter.extract_story_signature(article)
        
        for existing_article in existing_articles:
            # Quick check: same fingerprint
            story_id = self.fingerprinter.generate_fingerprint(article)
            if existing_article['story_id'] == story_id:
                return story_id
            
            # Deeper check: similar story
            story_article = {
                'title': existing_article['title'],
                'content_preview': existing_article.get('content_sample', ''),
                'category': existing_article['category']
            }
            
            if self.fingerprinter.are_same_story(article, story_article):
                return existing_article['story_id']
        
        return None
    
    def update_aggregate(self, new_articles: List[Dict]) -> str:
        """Update current aggregate with new articles"""
        aggregate = self.load_current_aggregate()
        articles = aggregate['monthly_aggregate']['articles']
        now = datetime.now(timezone.utc).isoformat()
        
        logger.info(f"Updating aggregate with {len(new_articles)} new articles")
        logger.info(f"Current aggregate has {len(articles)} articles")
        
        updated_count = 0
        added_count = 0
        
        # Process new articles
        for article in new_articles:
            # Try to find matching story
            matched_story_id = self.find_matching_story(article, articles)
            
            if matched_story_id:
                # Update existing article
                for existing_article in articles:
                    if existing_article['story_id'] == matched_story_id:
                        existing_article['last_seen'] = now
                        existing_article['is_active'] = True
                        
                        # Add any new sources
                        existing_urls = {s['url'] for s in existing_article.get('sources', [])}
                        for source in article.get('sources', []):
                            if source['url'] not in existing_urls:
                                existing_article['sources'].append({
                                    'name': source['name'],
                                    'url': source['url'],
                                    'author': source.get('author', ''),
                                    'timestamp': now
                                })
                        
                        updated_count += 1
                        break
            else:
                # Add new article
                story_id = self.fingerprinter.generate_fingerprint(article)
                new_article = {
                    'story_id': story_id,
                    'title': article['title'],
                    'category': article['category'],
                    'importance': article.get('importance', 'medium'),
                    'first_seen': now,
                    'last_seen': now,
                    'is_active': True,
                    'sources': [
                        {
                            'name': source['name'],
                            'url': source['url'],
                            'author': source.get('author', ''),
                            'timestamp': now
                        }
                        for source in article.get('sources', [])
                    ],
                    'content_sample': article.get('content_preview', '')[:200],
                    'tags': article.get('tags', []),
                    'url': article.get('url', '')
                }
                articles.append(new_article)
                added_count += 1
        
        # Mark articles inactive if not seen in last 48 hours
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=48)
        inactive_count = 0
        for article in articles:
            last_seen = datetime.fromisoformat(article['last_seen'])
            if last_seen < cutoff_time and article.get('is_active'):
                article['is_active'] = False
                inactive_count += 1
        
        # Update metadata
        aggregate['monthly_aggregate']['last_updated'] = now
        aggregate['monthly_aggregate']['total_articles'] = len(articles)
        aggregate['monthly_aggregate']['active_articles_count'] = sum(1 for a in articles if a.get('is_active'))
        
        # Create active_articles list (for latest.json top-level)
        active_articles_list = [
            article for article in articles if article.get('is_active', False)
        ]
        
        # Save aggregate (monthly_aggregate only)
        path = self.get_current_aggregate_path()
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(aggregate, f, indent=2, ensure_ascii=False)
        
        # Save latest.json with active_articles at top level
        latest_data = {
            "monthly_aggregate": aggregate['monthly_aggregate'],
            "active_articles": active_articles_list
        }
        latest_path = os.path.join(self.base_directory, 'latest.json')
        with open(latest_path, 'w', encoding='utf-8') as f:
            json.dump(latest_data, f, indent=2, ensure_ascii=False)
        
        # Update dist directory if it exists
        self._update_dist_files(aggregate, active_articles_list)
        
        logger.info(f"   Aggregate updated: {added_count} added, {updated_count} updated, {inactive_count} marked inactive")
        logger.info(f"   Total articles: {len(articles)}, Active: {aggregate['monthly_aggregate']['active_articles_count']}")
        logger.info(f"   Saved to: {path}")
        
        return path
    
    def _update_dist_files(self, aggregate: Dict, active_articles: List[Dict]):
        """Update dist directory for production serving"""
        dist_base = "../../dist"
        if not os.path.exists(dist_base):
            dist_base = "/app/dist"
        
        if os.path.exists(dist_base):
            now = datetime.now(timezone.utc)
            year = now.strftime('%Y')
            month = now.strftime('%m')
            
            # Create dist directory structure
            dist_news_dir = os.path.join(dist_base, "news_feeds", year)
            os.makedirs(dist_news_dir, exist_ok=True)
            
            # Copy aggregate file
            dist_aggregate = os.path.join(dist_news_dir, f"aggregate_{year}_{month}.json")
            with open(dist_aggregate, 'w', encoding='utf-8') as f:
                json.dump(aggregate, f, indent=2, ensure_ascii=False)
            
            # Copy latest.json with active_articles at top level
            latest_data = {
                "monthly_aggregate": aggregate['monthly_aggregate'],
                "active_articles": active_articles
            }
            dist_latest = os.path.join(dist_base, "news_feeds", "latest.json")
            os.makedirs(os.path.dirname(dist_latest), exist_ok=True)
            with open(dist_latest, 'w', encoding='utf-8') as f:
                json.dump(latest_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"   Dist files updated: {dist_aggregate}")
    
    def fetch_articles(self) -> List[Dict[str, Any]]:
        """Fetch articles from all RSS feeds"""
        all_articles = []
        
        for category, urls in self.feeds.items():
            logger.info(f"Fetching {category} articles...")
            for url in urls:
                logger.info(f"   Parsing feed: {url}")
                articles = self.parser.parse_feed(url, category)
                all_articles.extend(articles)
        
        return all_articles
    
    def run_update(self):
        """Fetch RSS feeds and update aggregate"""
        logger.info("="*60)
        logger.info("Starting monthly aggregate update")
        logger.info("="*60)
        
        try:
            # Fetch articles
            articles = self.fetch_articles()
            logger.info(f"Fetched {len(articles)} total articles")
            
            # Apply within-fetch deduplication (for same URL)
            seen_urls = set()
            deduplicated = []
            for article in articles:
                url = article.get('url', '')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    # Wrap in sources array
                    article['sources'] = [{
                        'name': article.get('source', ''),
                        'url': url,
                        'author': article.get('author', ''),
                        'published_date': article.get('published_date', '')
                    }]
                    deduplicated.append(article)
            
            logger.info(f"After URL deduplication: {len(deduplicated)} articles")
            
            # Update monthly aggregate
            path = self.update_aggregate(deduplicated)
            
            logger.info("="*60)
            logger.info("Update complete!")
            logger.info("="*60)
            
            return True
            
        except Exception as e:
            logger.error(f"Update failed: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Main function"""
    system = MonthlyAggregateSystem()
    success = system.run_update()
    exit(0 if success else 1)


if __name__ == "__main__":
    main()

