// src/services/exchangeRates.js
const axios = require('axios');

async function getRates() {
    try {
        const response = await axios.get('https://www.cbr-xml-daily.ru/latest.js', {
            responseType: 'json',
            headers: { 'Accept-Encoding': 'gzip,deflate,compress' }
        });

        return response.data;
    } catch (error) {
        console.error('Ошибка при загрузке курсов:', error.message);
        throw error;
    }
}

function validateRatesResponse(data) {
    return data && data.date && data.rates && typeof data.rates === 'object';
}

module.exports = { getRates, validateRatesResponse };
