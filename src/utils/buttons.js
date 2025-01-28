function createDateButtons() {
    return [
        [{ text: 'Сегодня', callback_data: 'today' }],
        [{ text: 'Ввод вручную', callback_data: 'manual' }]
    ];
}

function createCurrencyButtons(rates) {
    // Получаем коды валют и сортируем их по алфавиту
    const sortedCurrencies = Object.keys(rates).sort();

    // Количество колонок
    const columns = 3;

    // Создаём массив для кнопок
    const buttons = [];

    // Заполняем кнопки сначала по строкам, затем по столбцам
    for (let i = 0; i < sortedCurrencies.length; i += columns) {
        const row = sortedCurrencies
            .slice(i, i + columns) // Берём до 3 валют для текущей строки
            .map(currency => ({ text: currency, callback_data: currency })); // Создаём кнопки

        buttons.push(row); // Добавляем строку кнопок
    }

    return buttons;
}

module.exports = { createDateButtons, createCurrencyButtons };