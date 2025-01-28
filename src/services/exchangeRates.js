const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { DOMParser } = require('xmldom');

// Указываем правильный путь к файлу кэша
const CACHE_DIR = path.join(__dirname, '../../cache');
const CACHE_PATH = path.join(CACHE_DIR, 'ratesCache.json');

// Создаем директорию cache, если её нет
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Инициализация файла кэша, если он пуст или отсутствует
if (!fs.existsSync(CACHE_PATH) || fs.readFileSync(CACHE_PATH, 'utf8').trim() === '') {
    fs.writeFileSync(CACHE_PATH, JSON.stringify({}));
}

let cache = {};
try {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
} catch (error) {
    logger.error(`Error reading cache file: ${error.message}`);
    // Если файл повреждён, инициализируем его пустым объектом
    cache = {};
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

async function fetchExchangeRates(date) {
    if (cache[date]) {
        logger.info(`Using cached rates for date: ${date}`);
        return cache[date];
    }

    try {
        const response = await axios.get(`https://www.cbr.ru/scripts/XML_daily.asp?date_req=${date}`);
        const rates = parseRates(response.data);
        if (rates && Object.keys(rates).length > 0) {
            cache[date] = rates;
            fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
            logger.info(`Fetched and cached rates for date: ${date}`);
            return rates;
        } else {
            logger.error('No rates found in the API response.');
            return null;
        }
    } catch (error) {
        logger.error(`Error fetching exchange rates: ${error.message}`);
        return null;
    }
}

function parseRates(xmlData) {
    const rates = {};
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlData, 'text/xml');

    // Проверяем, что документ был корректно распарсен
    if (!doc || !doc.getElementsByTagName) {
        logger.error('Invalid XML document.');
        return rates;
    }

    const valutes = doc.getElementsByTagName('Valute');

    // Проверяем, что valutes существует и является коллекцией
    if (!valutes || !valutes.length) {
        logger.error('No Valute elements found in the XML document.');
        return rates;
    }

    // Итерируем по элементам Valute
    for (let i = 0; i < valutes.length; i++) {
        const valute = valutes[i];
        const charCode = valute.getElementsByTagName('CharCode')[0]?.textContent;
        const value = parseFloat(valute.getElementsByTagName('Value')[0]?.textContent.replace(',', '.'));
        const nominal = parseFloat(valute.getElementsByTagName('Nominal')[0]?.textContent);

        if (charCode && !isNaN(value) && !isNaN(nominal)) {
            rates[charCode] = (value / nominal).toFixed(4);
        }
    }

    return rates;
}

module.exports = { fetchExchangeRates };