require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const https = require('https'); // Импортируем модуль https
const { fetchExchangeRates } = require('./services/exchangeRates');
const logger = require('./services/logger');
const { createDateButtons, createCurrencyButtons } = require('./utils/buttons');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('Токен бота не найден. Убедитесь, что он указан в файле .env.');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
// Список команд для меню
const commands = [
    { command: 'start', description: 'Запустить бота' },
    { command: 'date', description: 'Сменить дату' },
    { command: 'currency', description: 'Сменить валюту' },
    { command: 'info', description: 'Курсы валют' },
  ];
  
  // HTTP-запрос для обновления команд
  const updateCommands = () => {
    const postData = JSON.stringify({ commands });
  
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${token}/setMyCommands`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
  
    const req = https.request(options, (res) => {
      let data = '';
  
      res.on('data', (chunk) => {
        data += chunk;
      });
  
      res.on('end', () => {
        console.log('Ответ Telegram API:', data);
      });
    });
  
    req.on('error', (e) => {
      console.error('Ошибка запроса:', e);
    });
  
    req.write(postData);
    req.end();
  };
  
  // Обновляем команды
  updateCommands();


let userState = {};

// Обработчик ошибок polling
bot.on('polling_error', (error) => {
    logger.error(`Polling error: ${error.message}`);
    console.error('Polling error details:', error);
});

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userState[chatId] = { step: 'dateSelection' };
    bot.sendMessage(chatId, "Привет! Я бот для конвертации валют. Выбери дату:", {
        reply_markup: {
            inline_keyboard: createDateButtons()
        }
    });
});

// Команда /date
bot.onText(/\/date/, (msg) => {
    const chatId = msg.chat.id;
    userState[chatId] = { step: 'dateSelection' };
    bot.sendMessage(chatId, "Для загрузки новых курсов установите дату:", {
        reply_markup: {
            inline_keyboard: createDateButtons()
        }
    });
});

// Команда /info
bot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    const state = userState[chatId];

    if (!state || !state.date || !state.rates) {
        bot.sendMessage(chatId, "Курсы валют не загружены. Пожалуйста, выберите дату с помощью команды /date.", {
            reply_markup: { remove_keyboard: true } // Отключаем кнопки
        });
        return;
    }

    // Формируем список валют с курсами
    let currencyList = `Курсы валют на ${state.date}:\n`;
    for (const [currency, rate] of Object.entries(state.rates)) {
        currencyList += `${currency}: ${rate} RUB\n`;
    }

    // Отправляем список валют
    bot.sendMessage(chatId, currencyList, {
        reply_markup: { remove_keyboard: true } // Удаляем кнопки
    });

    // Предлагаем ввести новую сумму или выбрать новую дату / валюту
    bot.sendMessage(chatId, "Введите новую сумму для конвертации или выберите новую дату / валюту.");
});

// Команда /currency
bot.onText(/\/currency/, (msg) => {
    const chatId = msg.chat.id;
    const state = userState[chatId];

    // Проверяем, загружены ли курсы валют
    if (!state || !state.rates) {
        bot.sendMessage(chatId, "Курсы валют не загружены. Пожалуйста, выберите дату с помощью команды /date.", {
            reply_markup: { remove_keyboard: true } // Отключаем кнопки
        });
        return;
    }

    // Показываем кнопки с валютами
    bot.sendMessage(chatId, "Выберите валюту:", {
        reply_markup: {
            inline_keyboard: createCurrencyButtons(state.rates)
        }
    });
});

// Обработчик callback_query (кнопки)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data; // Данные из нажатой кнопки
    const state = userState[chatId];

    console.log('Callback query data:', data); // Лог для отладки
    console.log('Current state:', state); // Лог текущего состояния

    if (!state) {
        bot.sendMessage(chatId, "Пожалуйста, начните с команды /start.");
        return;
    }

    // Обработка выбора валюты в любом состоянии
    if (state.rates && state.rates[data]) {
        state.currency = data; // Устанавливаем выбранную валюту
        state.step = 'amountInput'; // Переключаем шаг на ввод суммы
        const exchangeRate = state.rates[data]; // Получаем курс валюты к рублю
        bot.sendMessage(
            chatId,
            `Выбрана валюта: ${state.currency}. \nКурс на ${state.date}: 1 ${state.currency} = ${exchangeRate} RUB`
        ).then(() => {
            bot.sendMessage(chatId, "Введите сумму для конвертации:")});
        return;
    }

    if (state.step === 'dateSelection') {
        if (data === 'today') {
            state.date = new Date().toLocaleDateString('ru-RU');
        } else if (data === 'manual') {
            state.step = 'manualDateInput';
            bot.sendMessage(chatId, "Введите дату в формате ДДММГГГГ:");
            return;
        }
        state.step = 'currencySelection';
        const rates = await fetchExchangeRates(state.date);
        if (rates) {
            state.rates = rates;
            bot.sendMessage(chatId, "Выберите валюту:", {
                reply_markup: {
                    inline_keyboard: createCurrencyButtons(rates)
                }
            });
        } else {
            bot.sendMessage(chatId, "Не удалось загрузить курсы валют.");
        }
    } else {
        console.log('Необработанное состояние:', state.step);
    }
});

// Обработчик ввода даты вручную
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = userState[chatId];

    // Игнорируем сообщения, которые являются командами
    if (text.startsWith('/')) {
        return;
    }

    // Проверяем, существует ли состояние пользователя
    if (!state) {
        bot.sendMessage(chatId, "Пожалуйста, начните с команды /start.");
        return;
    }

    if (state.step === 'manualDateInput') {
        const parsedDate = parseDate(text);
        if (parsedDate.valid) {
            const date = parsedDate.date;
            bot.sendMessage(chatId, `Установлена дата ${date}`);
            state.date = date;
            state.step = 'currencySelection';
            fetchExchangeRates(state.date).then(rates => {
                if (rates) {
                    state.rates = rates;
                    bot.sendMessage(chatId, "Выберите валюту:", {
                        reply_markup: {
                            inline_keyboard: createCurrencyButtons(rates)
                        }
                    });
                } else {
                    bot.sendMessage(chatId, "Не удалось загрузить курсы валют.");
                }
            });
        } else {
            // Сообщение об ошибке и повторный запрос даты
            // Сначала причина ошибки, затем запрос новой даты
            bot.sendMessage(chatId, parsedDate.message).then(() => {
                bot.sendMessage(chatId, "Введите дату снова:");
            });
        }
    } else if (state.step === 'amountInput') {
        const normalizedInput = text.replace(/\s/g, '').replace('?', '.').replace(',', '.'); // Убираем пробелы и заменяем запятую
        const amount = parseFloat(normalizedInput);
        console.log(amount);
        if (!isNaN(amount)) {
            const result = (amount * state.rates[state.currency]).toFixed(2);
            const formattedAmount = amount.toLocaleString('ru-RU'); // Форматируем введённую сумму
            const formattedResult = new Intl.NumberFormat('ru-RU', {
                minimumFractionDigits: 2, // Обеспечивает наличие двух знаков после запятой
                maximumFractionDigits: 2,
            }).format(parseFloat(result));
            bot.sendMessage(chatId, `${formattedAmount} ${state.currency} = ${formattedResult} RUB на ${state.date}`).then(() => {    
                bot.sendMessage(chatId, "Введите новую сумму для конвертации или выберите новую дату / валюту.")});        // Остаёмся на шаге amountInput для следующей конвертации
        } else {
            bot.sendMessage(chatId, "Пожалуйста, введите корректную сумму.");
        }
    }
});

// Функция для парсинга даты
function parseDate(input) {
    // Регулярное выражение для различных форматов даты
    const match = input.match(/^(\d{2})[./,]?(\d{2})[./,]?(\d{4})$/);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // Месяцы в JavaScript начинаются с 0
        const year = parseInt(match[3], 10);

        const enteredDate = new Date(year, month, day);
        const minDate = new Date(1992, 6, 1); // 01/07/1992

        // Проверяем, что дата корректна и не раньше минимальной даты
        if (enteredDate < minDate) {
            return { valid: false, message: "Дата слишком ранняя. Доступны курсы только с 01/07/1992." };
        }

        // Возвращаем корректно отформатированную дату
        return { valid: true, date: `${match[1]}/${match[2]}/${match[3]}` };
    }

    // Некорректный формат
    return { valid: false, message: "Некорректный формат даты. Введите дату в формате ДДММГГГГ, ДД/ММ/ГГГГ, ДД.ММ.ГГГГ или ДД,ММ,ГГГГ." };
}