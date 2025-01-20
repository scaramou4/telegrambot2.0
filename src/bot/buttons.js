// src/bot/buttons.js
function createCurrencyButtons(rates) {
    const currencies = Object.keys(rates).sort(); // Сортируем валюты по алфавиту
    const buttons = [];

    for (let i = 0; i < currencies.length; i += 3) {
        const row = currencies.slice(i, i + 3).map(currency => ({
            text: currency,
            callback_data: currency
        }));
        buttons.push(row);
    }

    return {
        reply_markup: JSON.stringify({ inline_keyboard: buttons })
    };
}

module.exports = { createCurrencyButtons };
