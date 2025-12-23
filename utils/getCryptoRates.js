const axios = require("axios");

async function getCryptoRates() {
  try {
    // CoinGecko API — fetch prices in GBP (added monero)
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,tether,monero&vs_currencies=gbp";

    const response = await axios.get(url);
    const prices = response.data;

    // GBP → Crypto (1 GBP = ? Crypto)
    const conversionRates = {
      BTC: 1 / prices.bitcoin.gbp,
      ETH: 1 / prices.ethereum.gbp,
      LTC: 1 / prices.litecoin.gbp,
      USDT: 1 / prices.tether.gbp,
      XMR: 1 / prices.monero.gbp, // ✅ Added Monero
    };

    return conversionRates;
  } catch (error) {
    console.error("Error fetching crypto rates:", error.message);
    // Fallback values (to prevent crash)
    return {
      BTC: 0.000023,
      ETH: 0.00058,
      LTC: 0.014,
      USDT: 1.27,
      XMR: 0.006, // ✅ Added fallback rate for Monero
    };
  }
}

module.exports = getCryptoRates;
