// src/index.js (Основной модуль)
const TelegramAPI = require('node-telegram-bot-api');
const { getRates, validateRatesResponse } = require('./services/exchangeRates');
const { createCurrencyButtons } = require('./bot/buttons');
const config = require('./config.js');
const fs = require('fs').promises;

const token = config.telegram_bot.token;
const bot = new TelegramAPI(token, { polling: true });
const currencySelection = new Map(); // Хранение выбранной валюты по chatId
const ratesFile = 'rates.json';

async function startBot() {
    // Установка команд
    bot.setMyCommands([
        { command: '/start', description: 'Начать' },
        { command: '/info', description: 'Информация о курсах' },
        { command: '/currency', description: 'Выбрать валюту' },
    ]);

    // Обработка команды /start
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        await bot.sendMessage(chatId, `Добро пожаловать, ${msg.from.first_name}!`);
        return showCurrencySelection(chatId);
    });

    // Обработка команды /info
    bot.onText(/\/info/, async (msg) => {
        const chatId = msg.chat.id;
        const rates = await getRatesOrCache();
        if (!rates) {
            return bot.sendMessage(chatId, 'Не удалось загрузить курсы валют. Попробуйте позже.');
        }

        const ratesDate = rates.date;
        const ratesList = Object.entries(rates.rates)
            .map(([currency, rate]) => `${currency}: ${rate}`)
            .sort((a, b) => a.localeCompare(b)) // Сортировка по алфавиту
            .join('\n');

        await bot.sendMessage(chatId, `Курсы на ${ratesDate}:
${ratesList}`);
    });

    // Обработка команды /currency
    bot.onText(/\/currency/, async (msg) => {
        const chatId = msg.chat.id;
        return showCurrencySelection(chatId);
    });

    // Обработка callback_data от кнопок
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const currency = callbackQuery.data;

        currencySelection.set(chatId, currency);
        await bot.sendMessage(chatId, `Выбрана валюта: ${currency}. Введите сумму для конвертации.`);
    });

    // Обработка текстовых сообщений
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text.replace(/\s/g, '');

        // Игнорируем команды
        if (text.startsWith('/')) {
            return; // Не обрабатываем команды здесь
        }

        // Проверяем, ввёл ли пользователь число
        if (!isNaN(text) && text.trim() !== '') {
            const rates = await getRatesOrCache();
            if (!rates) {
                return bot.sendMessage(chatId, 'Не удалось загрузить курсы валют. Попробуйте позже.');
            }

            const selectedCurrency = currencySelection.get(chatId) || 'USD';
            const rate = rates.rates[selectedCurrency];
            if (!rate) {
                return bot.sendMessage(chatId, `Курс для валюты ${selectedCurrency} недоступен.`);
            }

            // Умножение суммы на курс для корректного вывода
            const result = (text / rate).toFixed(2);
            return bot.sendMessage(chatId, `${text} ${selectedCurrency} = ${result} RUB`);
        }

        // Сообщение по умолчанию, если текст не является числом
        if (!isNaN(text) || text.trim() === '') {
            return bot.sendMessage(chatId, 'Введите сумму или используйте команды.');
        }
    });
}

async function showCurrencySelection(chatId) {
    const rates = await getRatesOrCache();
    if (!rates) {
        return bot.sendMessage(chatId, 'Не удалось загрузить курсы валют. Попробуйте позже.');
    }

    const buttons = createCurrencyButtons(rates.rates);
    return bot.sendMessage(chatId, 'Выберите валюту:', buttons);
}

async function getRatesOrCache() {
    try {
        const today = new Date().toISOString().split('T')[0];
        let rates;

        try {
            const cachedData = JSON.parse(await fs.readFile(ratesFile, 'utf-8'));
            if (cachedData.date === today) {
                return cachedData;
            }
        } catch {
            console.log('Кэш не найден или устарел. Загружаем новые данные.');
        }

        rates = await getRates();
        if (validateRatesResponse(rates)) {
            await fs.writeFile(ratesFile, JSON.stringify(rates));
            return rates;
        }
    } catch (error) {
        console.error('Ошибка загрузки курсов:', error.message);
    }

    return null;
}

startBot();
