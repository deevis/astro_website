#!/usr/bin/env python3
"""
Bitcoin Price History Updater
Fetches current Bitcoin price from CoinGecko API and updates price_data.csv files
Also populates missing days within the last 60 days
"""

import csv
import os
import sys
import logging
import time
import random
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Set

# External dependencies
try:
    import requests
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install requests")
    sys.exit(1)

# Configure logging - handle both local and production environments
def setup_logging():
    """Setup logging configuration for both local and production environments"""
    handlers = [logging.StreamHandler()]  # Always include console output
    
    # Try to use production log file, fall back to local file if needed
    log_paths = [
        '/var/log/bitcoin_price_cron.log',  # Production path
        'bitcoin_price_cron.log'            # Local development path
    ]
    
    for log_path in log_paths:
        try:
            # Try to create the log file handler
            file_handler = logging.FileHandler(log_path)
            handlers.append(file_handler)
            break
        except (OSError, FileNotFoundError):
            # Continue to next path if this one fails
            continue
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=handlers
    )

setup_logging()
logger = logging.getLogger(__name__)

class BitcoinPriceUpdater:
    """Fetches Bitcoin price from CoinGecko and updates CSV files"""
    
    def __init__(self, rate_limit_delay: float = 10.0, max_retries: int = 5):
        """
        Initialize the Bitcoin price updater
        
        Args:
            rate_limit_delay: Base delay between API calls in seconds (default: 10s for free tier)
            max_retries: Maximum number of retry attempts for failed requests
        """
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; BitcoinPriceUpdater/1.0)'
        })
        
        # Rate limiting configuration
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        self.last_api_call_time = 0
        
        # File paths - handle both local and production environments
        self.file_paths = self._get_file_paths()
        
        # CoinGecko API endpoints
        self.current_price_url = 'https://api.coingecko.com/api/v3/simple/price'
        self.historical_price_url = 'https://api.coingecko.com/api/v3/coins/bitcoin/history'
        
        self.current_price_params = {
            'ids': 'bitcoin',
            'vs_currencies': 'usd',
            'include_24hr_change': 'false'
        }
        
        logger.info(f"Initialized with rate limit delay: {rate_limit_delay}s, max retries: {max_retries}")
        
    def _wait_for_rate_limit(self):
        """Ensure we respect rate limits by waiting between API calls"""
        current_time = time.time()
        time_since_last_call = current_time - self.last_api_call_time
        
        if time_since_last_call < self.rate_limit_delay:
            wait_time = self.rate_limit_delay - time_since_last_call
            # Add small random jitter to avoid thundering herd
            jitter = random.uniform(0, 0.5)
            total_wait = wait_time + jitter
            
            logger.info(f"Rate limiting: waiting {total_wait:.1f} seconds before next API call")
            time.sleep(total_wait)
        
        self.last_api_call_time = time.time()
    
    def _make_api_request(self, url: str, params: Dict[str, Any], description: str) -> Optional[Dict[str, Any]]:
        """
        Make an API request with rate limiting and retry logic
        
        Args:
            url: The API endpoint URL
            params: Request parameters
            description: Description for logging
            
        Returns:
            JSON response data or None if failed
        """
        for attempt in range(self.max_retries):
            try:
                # Wait for rate limit before making request
                self._wait_for_rate_limit()
                
                logger.info(f"Making API request (attempt {attempt + 1}/{self.max_retries}): {description}")
                
                response = self.session.get(url, params=params, timeout=30)
                
                # Handle rate limiting specifically
                if response.status_code == 429:
                    retry_after = response.headers.get('Retry-After')
                    if retry_after:
                        wait_time = int(retry_after)
                        logger.warning(f"Rate limited (429), waiting {wait_time} seconds as requested by server")
                        time.sleep(wait_time)
                    else:
                        # Use exponential backoff if no Retry-After header
                        wait_time = (2 ** attempt) * self.rate_limit_delay
                        logger.warning(f"Rate limited (429), using exponential backoff: {wait_time:.1f} seconds")
                        time.sleep(wait_time)
                    continue
                
                # Handle other HTTP errors
                response.raise_for_status()
                
                # Success
                data = response.json()
                logger.info(f"Successfully completed API request: {description}")
                return data
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"API request failed (attempt {attempt + 1}/{self.max_retries}): {e}")
                
                if attempt < self.max_retries - 1:
                    # Exponential backoff for retries
                    wait_time = (2 ** attempt) * 2  # 2, 4, 8, 16 seconds
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"All retry attempts failed for: {description}")
                    
            except (KeyError, ValueError, TypeError) as e:
                logger.error(f"Error parsing API response for {description}: {e}")
                break  # Don't retry parsing errors
        
        return None

    def _get_file_paths(self) -> List[str]:
        """Get appropriate file paths for current environment"""
        paths = []
        
        # Production paths (Docker environment)
        production_paths = [
            '/app/public/bitcoin/price_data.csv',
            '/app/dist/bitcoin/price_data.csv'
        ]
        
        # Local development paths
        local_paths = [
            'public/bitcoin/price_data.csv',
            '../../public/bitcoin/price_data.csv'  # From python/bitcoin/ directory
        ]
        
        # Check if we're in a Docker/production environment
        if os.path.exists('/app'):
            paths.extend(production_paths)
        else:
            # Local development - try different relative paths
            for path in local_paths:
                if os.path.exists(path):
                    paths.append(path)
        
        return paths
    
    def fetch_current_price(self) -> Optional[float]:
        """Fetch current Bitcoin price from CoinGecko API"""
        data = self._make_api_request(
            self.current_price_url, 
            self.current_price_params, 
            "fetching current Bitcoin price"
        )
        
        if data is None:
            return None
            
        try:
            price = data.get('bitcoin', {}).get('usd')
            
            if price is None:
                logger.error("Failed to extract Bitcoin price from API response")
                return None
                
            logger.info(f"Successfully fetched current Bitcoin price: ${price:,.2f}")
            return float(price)
            
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Error parsing current Bitcoin price response: {e}")
            return None
    
    def fetch_historical_price(self, date: str) -> Optional[float]:
        """Fetch historical Bitcoin price for a specific date from CoinGecko API"""
        # CoinGecko historical API expects date in DD-MM-YYYY format
        try:
            date_obj = datetime.strptime(date, '%Y-%m-%d')
            formatted_date = date_obj.strftime('%d-%m-%Y')
        except ValueError as e:
            logger.error(f"Invalid date format {date}: {e}")
            return None
        
        params = {'date': formatted_date}
        data = self._make_api_request(
            self.historical_price_url,
            params,
            f"fetching historical Bitcoin price for {date}"
        )
        
        if data is None:
            return None
            
        try:
            # The historical API returns price in market_data.current_price.usd
            price = data.get('market_data', {}).get('current_price', {}).get('usd')
            
            if price is None:
                logger.error(f"Failed to extract historical Bitcoin price for {date}")
                return None
                
            logger.info(f"Successfully fetched historical Bitcoin price for {date}: ${price:,.2f}")
            return float(price)
            
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Error parsing historical Bitcoin price response for {date}: {e}")
            return None
    
    def get_existing_dates(self, file_path: str) -> Set[str]:
        """Get all existing dates from the CSV file"""
        existing_dates = set()
        
        try:
            if not os.path.exists(file_path):
                logger.warning(f"CSV file not found: {file_path}")
                return existing_dates
                
            with open(file_path, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    existing_dates.add(row['date'])
                    
            logger.info(f"Found {len(existing_dates)} existing dates in {file_path}")
            return existing_dates
            
        except Exception as e:
            logger.error(f"Error reading existing dates from CSV file {file_path}: {e}")
            return existing_dates
    
    def get_missing_dates(self, file_path: str, days_back: int = 60) -> List[str]:
        """Get list of missing dates within the last specified number of days"""
        existing_dates = self.get_existing_dates(file_path)
        
        # Generate all dates for the last N days
        today = datetime.now(timezone.utc).date()
        all_dates = []
        
        for i in range(days_back):
            date = today - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            all_dates.append(date_str)
        
        # Find missing dates
        missing_dates = []
        for date_str in all_dates:
            if date_str not in existing_dates:
                missing_dates.append(date_str)
        
        # Sort missing dates in ascending order (oldest first)
        missing_dates.sort()
        
        logger.info(f"Found {len(missing_dates)} missing dates in the last {days_back} days")
        if missing_dates:
            logger.info(f"Missing dates: {missing_dates}")
        
        return missing_dates
    
    def get_latest_entry_date(self, file_path: str) -> Optional[str]:
        """Get the date of the latest entry in the CSV file"""
        try:
            if not os.path.exists(file_path):
                logger.warning(f"CSV file not found: {file_path}")
                return None
                
            with open(file_path, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                rows = list(reader)
                
                if not rows:
                    logger.warning(f"CSV file is empty: {file_path}")
                    return None
                    
                # Get the last row's date
                latest_date = rows[-1]['date']
                logger.info(f"Latest entry in {file_path}: {latest_date}")
                return latest_date
                
        except Exception as e:
            logger.error(f"Error reading CSV file {file_path}: {e}")
            return None
    
    def update_csv_file(self, file_path: str, date: str, price: float) -> bool:
        """Update a single CSV file with new price data"""
        try:
            if not os.path.exists(file_path):
                logger.warning(f"CSV file not found: {file_path}")
                return False
                
            # Check if entry for this date already exists
            existing_dates = self.get_existing_dates(file_path)
            if date in existing_dates:
                logger.info(f"Entry for {date} already exists in {file_path}")
                return True
                
            # Append new entry
            with open(file_path, 'a', newline='', encoding='utf-8') as file:
                writer = csv.writer(file)
                writer.writerow([date, price, 'coingecko'])
                
            logger.info(f"Successfully updated {file_path} with {date}: ${price:,.2f}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating CSV file {file_path}: {e}")
            return False
    
    def populate_missing_dates(self, days_back: int = 60) -> bool:
        """Populate missing dates in all CSV files within the specified number of days"""
        logger.info(f"Starting to populate missing dates within the last {days_back} days...")
        
        success_count = 0
        total_files = len(self.file_paths)
        
        for file_path in self.file_paths:
            logger.info(f"Processing file: {file_path}")
            
            # Get missing dates for this file
            missing_dates = self.get_missing_dates(file_path, days_back)
            
            if not missing_dates:
                logger.info(f"No missing dates found for {file_path}")
                success_count += 1
                continue
            
            # Fetch and update prices for missing dates
            file_success = True
            for date in missing_dates:
                price = self.fetch_historical_price(date)
                if price is not None:
                    if not self.update_csv_file(file_path, date, price):
                        file_success = False
                        logger.error(f"Failed to update {file_path} with {date}")
                else:
                    file_success = False
                    logger.error(f"Failed to fetch price for {date}")
            
            if file_success:
                success_count += 1
                logger.info(f"Successfully populated all missing dates for {file_path}")
            else:
                logger.warning(f"Some dates failed to populate for {file_path}")
        
        if success_count == total_files:
            logger.info("Successfully populated missing dates for all files")
            return True
        else:
            logger.warning(f"Successfully populated {success_count} out of {total_files} files")
            return False
    
    def update_all_files(self) -> bool:
        """Update all CSV files with current Bitcoin price and populate missing dates"""
        logger.info("Starting comprehensive update process...")
        
        # First, populate missing dates
        missing_dates_success = self.populate_missing_dates(60)
        
        # Then, update with current price
        current_price_success = self.update_current_price()
        
        # Return true if both operations succeeded
        return missing_dates_success and current_price_success
    
    def update_current_price(self) -> bool:
        """Update all CSV files with current Bitcoin price"""
        # Get current price
        price = self.fetch_current_price()
        if price is None:
            logger.error("Failed to fetch current Bitcoin price, aborting current price update")
            return False
            
        # Get today's date
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Update all existing CSV files
        success_count = 0
        for file_path in self.file_paths:
            if self.update_csv_file(file_path, today, price):
                success_count += 1
            else:
                logger.warning(f"Failed to update {file_path} with current price")
        
        if success_count == 0:
            logger.error("Failed to update any CSV files with current price")
            return False
        else:
            logger.info(f"Successfully updated {success_count} CSV file(s) with current price")
            return True
    
    def validate_csv_structure(self, file_path: str) -> bool:
        """Validate that CSV file has correct structure"""
        try:
            if not os.path.exists(file_path):
                return False
                
            with open(file_path, 'r', newline='', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                
                # Check for required columns
                required_columns = ['date', 'price_usd', 'source']
                if not all(col in reader.fieldnames for col in required_columns):
                    logger.error(f"CSV file {file_path} missing required columns")
                    return False
                    
                # Check first few rows to ensure data integrity
                row_count = 0
                for row in reader:
                    if row_count >= 5:  # Check first 5 rows
                        break
                    
                    # Validate date format
                    try:
                        datetime.strptime(row['date'], '%Y-%m-%d')
                    except ValueError:
                        logger.error(f"Invalid date format in {file_path}: {row['date']}")
                        return False
                    
                    # Validate price is numeric
                    try:
                        float(row['price_usd'])
                    except ValueError:
                        logger.error(f"Invalid price format in {file_path}: {row['price_usd']}")
                        return False
                    
                    row_count += 1
                
                logger.info(f"CSV file {file_path} structure is valid")
                return True
                
        except Exception as e:
            logger.error(f"Error validating CSV file {file_path}: {e}")
            return False

def main():
    """Main function to update Bitcoin price data"""
    logger.info("Starting Bitcoin price update process...")
    
    # Configure rate limiting for CoinGecko free tier
    # Free tier: 10-30 calls per minute, recommended 6-10 second delays
    rate_limit_delay = 10.0  # 10 seconds between API calls
    max_retries = 5          # Maximum retry attempts
    
    updater = BitcoinPriceUpdater(rate_limit_delay=rate_limit_delay, max_retries=max_retries)
    
    # Log environment detection
    if os.path.exists('/app'):
        logger.info("Running in production/Docker environment")
    else:
        logger.info("Running in local development environment")
    
    logger.info(f"Target CSV files: {updater.file_paths}")
    
    # Validate CSV files first
    valid_files = []
    for file_path in updater.file_paths:
        if updater.validate_csv_structure(file_path):
            valid_files.append(file_path)
    
    if not valid_files:
        logger.error("No valid CSV files found to update")
        sys.exit(1)
    
    # Update the files (includes both missing dates and current price)
    if updater.update_all_files():
        logger.info("Bitcoin price update completed successfully")
        sys.exit(0)
    else:
        logger.error("Bitcoin price update failed")
        sys.exit(1)

if __name__ == "__main__":
    main()

