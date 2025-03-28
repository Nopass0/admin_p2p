import * as xlsx from 'xlsx';

/**
 * Интерфейс для транзакции Bybit
 */
export interface BybitTransaction {
  orderNo: string;
  dateTime: Date;
  type: string;
  asset: string;
  amount: number;
  totalPrice: number;
  unitPrice: number;
  counterparty: string | null;
  status: string;
  originalData?: any;
}

/**
 * Интерфейс для сводной информации о транзакциях
 */
export interface BybitTransactionSummary {
  totalTransactions: number;
  totalAmount: Record<string, number>;
  totalValue: Record<string, number>;
  averagePrice: Record<string, number>;
}

/**
 * Интерфейс для результата парсинга XLS файла Bybit
 */
export interface ParsedBybitXLS {
  transactions: BybitTransaction[];
  summary: BybitTransactionSummary;
}

/**
 * Класс для парсинга XLS файлов с транзакциями Bybit
 */
export class BybitParser {
  /**
   * Парсит XLS буфер с транзакциями Bybit
   * @param buffer Буфер с содержимым XLS файла
   * @returns Объект с транзакциями и сводной информацией
   */
  static async parseXLSBuffer(buffer: Buffer): Promise<ParsedBybitXLS> {
    try {
      // Проверяем, что буфер не пустой
      if (!buffer || buffer.length === 0) {
        throw new Error("Получен пустой буфер");
      }
      
      // Создаем копию буфера, чтобы избежать проблем с потоками
      const bufferCopy = Buffer.from(buffer);
      
      // Читаем Excel файл с более детальными опциями
      const workbook = xlsx.read(bufferCopy, { 
        type: 'buffer',
        cellDates: true,     // Корректно обрабатывать даты
        cellNF: true,        // Сохранять форматы чисел
        cellText: false,     // Не генерировать текстовые поля
        WTF: true,           // Включить режим отладки
        codepage: 65001      // UTF-8 кодировка
      });
      
      // Проверяем наличие листов
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("В файле не найдено листов");
      }
      
      // Получаем первый лист
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Преобразуем лист в массив объектов с расширенными опциями
      const rawData = xlsx.utils.sheet_to_json(worksheet, {
        defval: '',          // Значение по умолчанию для пустых ячеек
        blankrows: false,    // Пропускать пустые строки
        raw: false           // Преобразовывать значения
      });
      
      // Проверяем, что данные получены
      if (!rawData || rawData.length === 0) {
        throw new Error("Не удалось извлечь данные из файла");
      }
      
      // Преобразуем данные в формат транзакций Bybit
      const transactions: BybitTransaction[] = rawData.map((row: any) => {
        return {
          orderNo: row['Номер ордера'] || row['Order No.'] || '',
          dateTime: new Date(row['Время транзакции'] || row['Transaction Time'] || new Date()),
          type: this.mapTransactionType(row['Тип конвертации'] || row['Convert Type'] || ''),
          asset: row['Криптовалюта'] || row['Cryptocurrency'] || '',
          amount: this.parseNumber(row['Количество монет'] || row['Coin Amount'] || 0),
          totalPrice: this.parseNumber(row['Сумма фиата'] || row['Fiat Amount'] || 0),
          unitPrice: this.parseNumber(row['Цена'] || row['Price'] || 0),
          counterparty: row['Контрагент'] || row['Counterparty'] || '',
          status: this.mapTransactionStatus(row['Статус'] || row['Status'] || ''),
          originalData: { ...row }
        };
      });
  
      // Вычисляем сводную информацию
      const summary = this.calculateSummary(transactions);
      
      return {
        transactions,
        summary
      };
    } catch (error) {
      console.error('Подробная ошибка при парсинге XLS файла:', error);
      throw new Error(`Ошибка при обработке XLS файла: ${error.message}`);
    }
  }

  /**
   * Преобразует строковое значение в число
   * @param value Значение для преобразования
   * @returns Число или 0, если преобразование невозможно
   */
  private static parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    
    if (typeof value === 'string') {
      // Убираем все нецифровые символы, кроме точки и минуса
      const cleanValue = value.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleanValue);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }

  /**
   * Преобразует тип транзакции Bybit в стандартный формат
   * @param type Тип транзакции из Bybit
   * @returns Стандартизированный тип транзакции
   */
  private static mapTransactionType(type: string): string {
    // Преобразуем типы транзакций Bybit в наш формат
    const typeMap: Record<string, string> = {
      'BUY': 'buy',
      'SELL': 'sell',
      'Покупка': 'buy',
      'Продажа': 'sell'
    };
    
    return typeMap[type] || type;
  }

  /**
   * Преобразует статус транзакции Bybit в стандартный формат
   * @param status Статус транзакции из Bybit
   * @returns Стандартизированный статус транзакции
   */
  private static mapTransactionStatus(status: string): string {
    // Преобразуем статусы Bybit в наш формат
    const statusMap: Record<string, string> = {
      'Completed': 'completed',
      'Cancelled': 'cancelled',
      'Processing': 'processing',
      'Завершен': 'completed',
      'Отменен': 'cancelled',
      'В обработке': 'processing'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Вычисляет сводную информацию по транзакциям
   * @param transactions Массив транзакций
   * @returns Объект со сводной информацией
   */
  private static calculateSummary(transactions: BybitTransaction[]): BybitTransactionSummary {
    const totalAmount: Record<string, number> = {};
    const totalValue: Record<string, number> = {};
    const count: Record<string, number> = {};
    
    // Обрабатываем каждую транзакцию
    for (const tx of transactions) {
      const asset = tx.asset;
      
      // Инициализируем счетчики, если необходимо
      if (!totalAmount[asset]) {
        totalAmount[asset] = 0;
        totalValue[asset] = 0;
        count[asset] = 0;
      }
      
      // Учитываем транзакцию в зависимости от типа
      if (tx.type.toLowerCase() === 'buy') {
        totalAmount[asset] += tx.amount;
      } else if (tx.type.toLowerCase() === 'sell') {
        totalAmount[asset] -= tx.amount;
      }
      
      totalValue[asset] += tx.totalPrice;
      count[asset]++;
    }
    
    // Вычисляем средние цены
    const averagePrice: Record<string, number> = {};
    for (const asset in totalValue) {
      averagePrice[asset] = count[asset] > 0 ? totalValue[asset] / count[asset] : 0;
    }
    
    return {
      totalTransactions: transactions.length,
      totalAmount,
      totalValue,
      averagePrice
    };
  }
}