require("dotenv").config();
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Mancano SUPABASE_URL o SUPABASE_SERVICE_KEY nel file .env");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// FUNZIONE: Importa prezzi crypto da CoinGecko
// ============================================
async function importCryptoPrices(assetSymbol, coingeckoId, days = 365) {
  console.log(`Importazione prezzi per ${assetSymbol}...`);

  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart/range?vs_currency=eur&from=${Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)}&to=${Math.floor(Date.now() / 1000)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Errore API CoinGecko per ${assetSymbol}: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    const prices = data.prices; // [[timestamp, price], ...]

    const rows = prices.map(([timestamp, price]) => ({
      asset_symbol: assetSymbol,
      price_date: new Date(timestamp).toISOString().split('T')[0],
      price_eur: price,
      source: 'coingecko'
    }));

    // Inserisci in batch (evita duplicati con ON CONFLICT)
    let inserted = 0;
    for (const row of rows) {
      const { error } = await supabase
        .from('prices_daily')
        .upsert(row, { onConflict: 'asset_symbol,price_date' });
      
      if (error) {
        console.error(`Errore inserimento ${asset_symbol} ${row.price_date}:`, error.message);
      } else {
        inserted++;
      }
    }

    console.log(`Importati ${inserted} prezzi per ${assetSymbol}`);
  } catch (error) {
    console.error(`Errore importazione ${assetSymbol}:`, error.message);
  }
}

// ============================================
// FUNZIONE: Importa prezzi ETF da Yahoo Finance
// ============================================
async function importETFPrices(assetSymbol, yahooSymbol, days = 365) {
  console.log(`Importazione prezzi per ${assetSymbol} (${yahooSymbol})...`);

  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - days * 24 * 60 * 60;

  const url = `https://query1.finance.yahoo.com/v7/finance/download/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d&events=history`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Errore API Yahoo Finance per ${assetSymbol}: ${response.statusText}`);
      return;
    }

    const csv = await response.text();
    const lines = csv.split('\n').slice(1); // salta header

    const rows = [];
    for (const line of lines) {
      const [date, , , , , close] = line.split(',');
      if (!date || !close) continue;

      const priceEur = parseFloat(close);
      if (isNaN(priceEur)) continue;

      rows.push({
        asset_symbol: assetSymbol,
        price_date: date,
        price_eur: priceEur,
        source: 'yahoo'
      });
    }

    // Inserisci in batch
    let inserted = 0;
    for (const row of rows) {
      const { error } = await supabase
        .from('prices_daily')
        .upsert(row, { onConflict: 'asset_symbol,price_date' });
      
      if (error) {
        console.error(`Errore inserimento ${asset_symbol} ${row.price_date}:`, error.message);
      } else {
        inserted++;
      }
    }

    console.log(`Importati ${inserted} prezzi per ${assetSymbol}`);
  } catch (error) {
    console.error(`Errore importazione ${assetSymbol}:`, error.message);
  }
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('Avvio importazione prezzi...');

  // Crypto (da CoinGecko)
  await importCryptoPrices('BTC', 'bitcoin', 730); // 2 anni
  await importCryptoPrices('ETH', 'ethereum', 730);

  // ETF (da Yahoo Finance)
  await importETFPrices('SPY', 'SPY', 730); // S&P500 ETF
  await importETFPrices('QQQ', 'QQQ', 730); // Nasdaq ETF

  console.log('Importazione completata!');
}

main().catch(console.error);