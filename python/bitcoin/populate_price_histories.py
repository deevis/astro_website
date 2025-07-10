#!/usr/bin/env python3
"""
Bitcoin Price History Updater
Fetches current Bitcoin price from CoinGecko API and updates price_data.csv files
"""

import csv
import os
import sys
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

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
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; BitcoinPriceUpdater/1.0)'
        })
        
        # File paths - handle both local and production environments
        self.file_paths = self._get_file_paths()
        
        # CoinGecko API endpoint
        self.api_url = 'https://api.coingecko.com/api/v3/simple/price'
        self.params = {
            'ids': 'bitcoin',
            'vs_currencies': 'usd',
            'include_24hr_change': 'false'
        }
        
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
        try:
            logger.info("Fetching Bitcoin price from CoinGecko API...")
            
            response = self.session.get(self.api_url, params=self.params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            price = data.get('bitcoin', {}).get('usd')
            
            if price is None:
                logger.error("Failed to extract Bitcoin price from API response")
                return None
                
            logger.info(f"Successfully fetched Bitcoin price: ${price:,.2f}")
            return float(price)
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching Bitcoin price: {e}")
            return None
        except (KeyError, ValueError, TypeError) as e:
            logger.error(f"Error parsing Bitcoin price response: {e}")
            return None
    
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
                
            # Check if entry for today already exists
            latest_date = self.get_latest_entry_date(file_path)
            if latest_date == date:
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
    
    def update_all_files(self) -> bool:
        """Update all CSV files with current Bitcoin price"""
        # Get current price
        price = self.fetch_current_price()
        if price is None:
            logger.error("Failed to fetch Bitcoin price, aborting update")
            return False
            
        # Get today's date
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Update all existing CSV files
        success_count = 0
        for file_path in self.file_paths:
            if self.update_csv_file(file_path, today, price):
                success_count += 1
            else:
                logger.warning(f"Failed to update {file_path}")
        
        if success_count == 0:
            logger.error("Failed to update any CSV files")
            return False
        else:
            logger.info(f"Successfully updated {success_count} CSV file(s)")
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
    
    updater = BitcoinPriceUpdater()
    
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
    
    # Update the files
    if updater.update_all_files():
        logger.info("Bitcoin price update completed successfully")
        sys.exit(0)
    else:
        logger.error("Bitcoin price update failed")
        sys.exit(1)

if __name__ == "__main__":
    main()

