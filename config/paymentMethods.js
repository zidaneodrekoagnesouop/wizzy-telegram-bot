module.exports = [
  {
    name: "Bitcoin (BTC)",
    ticker: "BTC",
    walletAddress: "bc1qvxvkcdw43c3utfe34d8xjl4amrarcerfxd87s2",
    conversionRate: 0.000023 // GBP to BTC (based on current ~£43,000/BTC)
  },
  {
    name: "Ethereum - ERC20 (ETH)",
    ticker: "ETH",
    walletAddress: "0xb54c4B5883CC994C7c0e007F66C12b21fBcC30fb",
    conversionRate: 0.00058 // GBP to ETH (based on current ~£1,700/ETH)
  },
  // {
  //   name: "Litecoin (LTC)",
  //   ticker: "LTC",
  //   walletAddress: "ltc1qthysfgku52mzrj029834gkclzzd80etts3j32t",
  //   conversionRate: 0.014 // GBP to LTC (based on current ~£70/LTC)
  // },
  {
    name: "Tether - Tron TRC20 (USDT)",
    ticker: "USDT",
    walletAddress: "TSwtEnUuA5rFpCYHCcQXWobiSz88KxwYzB", // Example TRC20 address
    conversionRate: 1.27 // GBP to USDT (based on current ~$1.27/£1 exchange rate)
  }
];