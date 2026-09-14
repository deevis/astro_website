import yfinance as yf
import pandas as pd

# Define index tickers
tickers = ['^GSPC', '^IXIC', '^NYA']

print("Fetching historical index data...")
# Download maximum available monthly data.
# yfinance 1.x no longer exposes a separate "Adj Close" column; for indexes
# Close is the right series (no dividend adjustment like individual stocks).
raw = yf.download(tickers, period="max", interval="1mo", auto_adjust=True, progress=False)
if isinstance(raw.columns, pd.MultiIndex):
    # Columns are (Price, Ticker) — prefer Close, fall back to Adj Close if present
    price_level = 'Close' if 'Close' in raw.columns.get_level_values(0) else 'Adj Close'
    data = raw[price_level]
else:
    data = raw['Close'] if 'Close' in raw.columns else raw['Adj Close']

# Resample to get the final closing price of each year
annual_data = data.resample('YE').last()

# Calculate Year-over-Year percentage change
yoy_returns = annual_data.pct_change() * 100

# Clean up the dataframe
yoy_returns = yoy_returns.dropna(how='all')
yoy_returns.index = yoy_returns.index.year
yoy_returns.index.name = 'Year'

# Rename columns to standard index names
yoy_returns = yoy_returns.rename(columns={
    '^GSPC': 'S&P 500',
    '^IXIC': 'Nasdaq Composite',
    '^NYA': 'NYSE Composite'
})

# Export to CSV for modeling
output_file = 'historical_yoy_returns.csv'
yoy_returns.round(2).to_csv(output_file)
print(f"Dataset generated: {output_file}")
print(yoy_returns.tail(10).round(2))
