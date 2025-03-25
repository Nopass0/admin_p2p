import { PrismaClient } from "@prisma/client";
import axios from 'axios';
import dayjs from "dayjs";

// Инициализация Prisma клиента
const prisma = new PrismaClient();

// Конфигурация API IDEX
const BASE_URL = 'https://panel.gate.cx';
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const DEFAULT_PAGES_TO_FETCH = 25;
const CONCURRENT_REQUESTS = 3; // Максимальное количество параллельных запросов

interface Cookie {
  domain: string;
  expirationDate: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite?: string;
  secure: boolean;
  session: boolean;
  storeId?: string;
  value: string;
}

interface Transaction {
  id: string;
  payment_method_id: string;
  wallet: string;
  amount: any;
  total: any;
  status: number;
  approved_at?: string;
  expired_at?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

/**
 * Авторизуется в IDEX и получает куки для доступа
 * @param credentials Учетные данные для авторизации
 * @returns Куки для доступа к API IDEX
 */
async function login(credentials: { login: string; password: string }): Promise<Cookie[]> {
  let retryCount = 0;
  let delay = BASE_DELAY;
  
  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`Попытка авторизации для ${credentials.login} (попытка ${retryCount + 1})...`);
      
      const response = await axios.post(`${BASE_URL}/auth`, {
        login: credentials.login,
        password: credentials.password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (response.data && response.data.set_cookie) {
        console.log(`Успешная авторизация для ${credentials.login}`);
        return response.data.set_cookie;
      }
      
      throw new Error('Ответ не содержит куки');
    } catch (error: any) {
      console.error(`Ошибка авторизации (попытка ${retryCount + 1}):`, error.message);
      
      if (retryCount === MAX_RETRIES - 1) {
        throw new Error(`Не удалось авторизоваться после ${MAX_RETRIES} попыток: ${error.message}`);
      }
      
      if (error.response && error.response.status === 429) {
        console.log(`Получен код 429 (слишком много запросов), ожидание ${delay}мс...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        retryCount++;
        delay *= 2; // Экспоненциальное увеличение задержки
      } else if (error.response && error.response.status === 409) {
        throw new Error('Авторизация не удалась со статусом: 409 Conflict. Вероятно, учетные данные неверны или аккаунт заблокирован.');
      } else {
        throw new Error(`Авторизация не удалась: ${error.message}`);
      }
    }
  }
  
  throw new Error(`Не удалось авторизоваться после ${MAX_RETRIES} попыток`);
}

/**
 * Получает страницу транзакций из IDEX API
 * @param cookies Куки для авторизации
 * @param page Номер страницы
 * @returns Массив транзакций
 */
async function fetchTransactionsPage(cookies: Cookie[], page: number): Promise<Transaction[]> {
  let retryCount = 0;
  let delay = BASE_DELAY;
  
  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`Получение страницы ${page} транзакций...`);
      
      // Формируем строку куки для заголовка
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      
      const response = await axios.get(`${BASE_URL}/transactions/json?page=${page}`, {
        headers: {
          'Cookie': cookieString,
          'Accept': 'application/json'
        }
      });
      
      if (response.data && Array.isArray(response.data.data)) {
        console.log(`Получено ${response.data.data.length} транзакций со страницы ${page}`);
        return response.data.data;
      }
      
      return [];
    } catch (error: any) {
      console.error(`Ошибка получения страницы ${page} (попытка ${retryCount + 1}):`, error.message);
      
      if (retryCount === MAX_RETRIES - 1) {
        throw new Error(`Не удалось получить страницу ${page} после ${MAX_RETRIES} попыток: ${error.message}`);
      }
      
      if (error.response && error.response.status === 429) {
        console.log(`Получен код 429 (слишком много запросов), ожидание ${delay}мс...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        retryCount++;
        delay *= 2;
      } else {
        throw new Error(`Не удалось получить страницу ${page}: ${error.message}`);
      }
    }
  }
  
  throw new Error(`Не удалось получить страницу ${page} после ${MAX_RETRIES} попыток`);
}

/**
 * Получает все транзакции из IDEX API
 * @param cookies Куки для авторизации
 * @param pages Количество страниц для получения
 * @returns Массив транзакций
 */
async function fetchTransactions(cookies: Cookie[], pages: number = DEFAULT_PAGES_TO_FETCH): Promise<Transaction[]> {
  let allTransactions: Transaction[] = [];
  let page = 1;
  
  // Получаем запрошенное количество страниц или до первой пустой страницы
  while (page <= pages) {
    try {
      const pageTransactions = await fetchTransactionsPage(cookies, page);
      
      if (pageTransactions.length === 0) {
        console.log(`Страница ${page} пуста, останавливаем получение транзакций`);
        break;
      }
      
      allTransactions = allTransactions.concat(pageTransactions);
      console.log(`Всего получено транзакций: ${allTransactions.length}`);
      
      // Добавляем задержку между запросами страниц, чтобы избежать ограничений API
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
      }
      
      page++;
    } catch (error) {
      console.error(`Ошибка при получении страницы ${page}:`, error);
      throw error;
    }
  }
  
  return allTransactions;
}

/**
 * Сохраняет транзакции в базу данных
 * @param transactions Массив транзакций
 * @param cabinetId ID кабинета
 * @returns Массив добавленных транзакций
 */
async function saveTransactions(transactions: Transaction[], cabinetId: number): Promise<{
  totalProcessed: number;
  newTransactions: number;
}> {
  let totalProcessed = 0;
  let newTransactions = 0;
  
  try {
    console.log(`Начало сохранения ${transactions.length} транзакций для кабинета ID ${cabinetId}...`);
    
    for (const transaction of transactions) {
      totalProcessed++;
      
      // Проверяем существует ли уже транзакция с таким externalId для данного кабинета
      const existingTransaction = await prisma.idexTransaction.findFirst({
        where: {
          externalId: BigInt(transaction.id),
          cabinetId: cabinetId
        }
      });
      
      if (!existingTransaction) {
        // Создаем новую запись, если транзакция не найдена
        await prisma.idexTransaction.create({
          data: {
            externalId: BigInt(transaction.id),
            paymentMethodId: BigInt(transaction.payment_method_id),
            wallet: transaction.wallet || "",
            amount: transaction.amount,
            total: transaction.total,
            status: transaction.status,
            approvedAt: transaction.approved_at || null,
            expiredAt: transaction.expired_at || null,
            createdAtExternal: transaction.created_at,
            updatedAtExternal: transaction.updated_at,
            extraData: transaction,
            cabinetId
          }
        });
        
        newTransactions++;
      }
    }
    
    console.log(`Сохранено ${newTransactions} новых транзакций из ${totalProcessed} для кабинета ID ${cabinetId}`);
    
    return { totalProcessed, newTransactions };
  } catch (error) {
    console.error(`Ошибка сохранения транзакций для кабинета ID ${cabinetId}:`, error);
    throw error;
  }
}

/**
 * Выполняет функцию с автоматическим повтором при ошибках
 * @param fn Функция для выполнения
 * @param retries Количество повторных попыток
 * @param delay Задержка между попытками в мс
 * @returns Результат выполнения функции
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  let attempt = 0;
  
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      console.error(`Ошибка при выполнении функции (попытка ${attempt}/${retries}):`, error);
      
      if (attempt >= retries) {
        throw error;
      }
      
      console.log(`Повторная попытка через ${delay}мс...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Экспоненциальное увеличение задержки
    }
  }
  
  throw new Error(`Не удалось выполнить функцию после ${retries} попыток`);
}

/**
 * Синхронизирует транзакции для одного кабинета
 * @param cabinet Кабинет IDEX
 * @param pages Количество страниц для получения
 * @returns Массив добавленных транзакций
 */
async function syncCabinetTransactions(cabinet: any, pages: number = DEFAULT_PAGES_TO_FETCH): Promise<{
  totalProcessed: number;
  newTransactions: number;
}> {
  console.log(`Начало синхронизации для кабинета ID ${cabinet.id} (${cabinet.login}), страниц: ${pages}`);
  
  try {
    // Выполняем авторизацию и получаем куки
    const cookies = await withRetry(() => login({
      login: cabinet.login,
      password: cabinet.password
    }));
    
    // Получаем все транзакции
    const transactions = await withRetry(() => fetchTransactions(cookies, pages));
    console.log(`Получено ${transactions.length} транзакций для кабинета ID ${cabinet.id}`);
    
    // Сохраняем транзакции в базу данных
    const result = await withRetry(() => saveTransactions(transactions, cabinet.id));
    
    console.log(`Синхронизация кабинета ID ${cabinet.id} завершена. Обработано ${result.totalProcessed}, добавлено ${result.newTransactions} новых транзакций.`);
    
    return result;
  } catch (error) {
    console.error(`Ошибка синхронизации кабинета ID ${cabinet.id}:`, error);
    throw error;
  }
}

/**
 * Обрабатывает один запрос на синхронизацию
 * @param syncOrder Запрос на синхронизацию
 */
async function processOrder(syncOrder: any): Promise<void> {
  console.log(`Обработка запроса на синхронизацию ID ${syncOrder.id}, статус: ${syncOrder.status}`);
  
  try {
    // Обновляем статус и время начала обработки
    await prisma.idexSyncOrder.update({
      where: { id: syncOrder.id },
      data: {
        status: "IN_PROGRESS",
        startSyncAt: new Date()
      }
    });
    
    const pages = syncOrder.pages[0] || DEFAULT_PAGES_TO_FETCH;
    const results: any = {};
    let totalProcessed = 0;
    let totalNew = 0;
    
    if (syncOrder.cabinetId === 0) {
      // Синхронизация всех кабинетов
      console.log(`Запрос ID ${syncOrder.id}: синхронизация всех кабинетов`);
      
      const cabinets = await prisma.idexCabinet.findMany();
      if (cabinets.length === 0) {
        throw new Error("Нет кабинетов для синхронизации");
      }
      
      // Обрабатываем кабинеты с ограничением параллельных запросов
      const chunks = [];
      for (let i = 0; i < cabinets.length; i += CONCURRENT_REQUESTS) {
        chunks.push(cabinets.slice(i, i + CONCURRENT_REQUESTS));
      }
      
      for (const chunk of chunks) {
        const chunkResults = await Promise.allSettled(
          chunk.map(async (cabinet) => {
            try {
              console.log(`Синхронизация кабинета ${cabinet.login}`);
              const result = await syncCabinetTransactions(cabinet, pages);
              
              // Обновляем прогресс для этого кабинета
              results[cabinet.id] = result;
              totalProcessed += result.totalProcessed;
              totalNew += result.newTransactions;
              
              // Обновляем информацию о прогрессе в запросе
              await prisma.idexSyncOrder.update({
                where: { id: syncOrder.id },
                data: {
                  processed: results
                }
              });
              
              return { success: true, result, cabinet };
            } catch (error: any) {
              console.error(`Ошибка синхронизации кабинета ${cabinet.login}:`, error);
              
              // Сохраняем информацию об ошибке
              results[cabinet.id] = {
                error: error.message,
                totalProcessed: 0,
                newTransactions: 0
              };
              
              // Обновляем информацию о прогрессе в запросе
              await prisma.idexSyncOrder.update({
                where: { id: syncOrder.id },
                data: {
                  processed: results
                }
              });
              
              return { success: false, error: error.message, cabinet };
            }
          })
        );
        
        // Добавляем задержку между группами
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, BASE_DELAY * 2));
        }
      }
      
    } else {
      // Синхронизация одного кабинета
      console.log(`Запрос ID ${syncOrder.id}: синхронизация кабинета ID ${syncOrder.cabinetId}`);
      
      const cabinet = await prisma.idexCabinet.findUnique({
        where: { id: syncOrder.cabinetId }
      });
      
      if (!cabinet) {
        throw new Error(`Кабинет ID ${syncOrder.cabinetId} не найден`);
      }
      
      try {
        const result = await syncCabinetTransactions(cabinet, pages);
        
        // Обновляем результаты
        results[cabinet.id] = result;
        totalProcessed = result.totalProcessed;
        totalNew = result.newTransactions;
        
        // Обновляем информацию о прогрессе в запросе
        await prisma.idexSyncOrder.update({
          where: { id: syncOrder.id },
          data: {
            processed: results
          }
        });
      } catch (error: any) {
        console.error(`Ошибка синхронизации кабинета ID ${syncOrder.cabinetId}:`, error);
        
        // Сохраняем информацию об ошибке
        results[cabinet.id] = {
          error: error.message,
          totalProcessed: 0,
          newTransactions: 0
        };
        
        throw error;
      }
    }
    
    // Обновляем статус и время завершения
    await prisma.idexSyncOrder.update({
      where: { id: syncOrder.id },
      data: {
        status: "COMPLETED",
        endSyncAt: new Date(),
        processed: results
      }
    });
    
    console.log(`Запрос ID ${syncOrder.id} успешно выполнен. Обработано транзакций: ${totalProcessed}, добавлено новых: ${totalNew}`);
    
  } catch (error: any) {
    console.error(`Ошибка при обработке запроса ID ${syncOrder.id}:`, error);
    
    // Обновляем статус с ошибкой
    await prisma.idexSyncOrder.update({
      where: { id: syncOrder.id },
      data: {
        status: "FAILED",
        endSyncAt: new Date(),
        processed: {
          ...syncOrder.processed,
          error: error.message
        }
      }
    });
  }
}

/**
 * Основная функция для обработки запросов на синхронизацию
 */
async function processSyncOrders(): Promise<void> {
  console.log("Начало обработки запросов на синхронизацию...");
  
  try {
    // Получаем все запросы со статусом PENDING
    const pendingOrders = await prisma.idexSyncOrder.findMany({
      where: {
        status: "PENDING"
      },
      orderBy: {
        createdAt: 'asc' // Обрабатываем сначала самые старые запросы
      }
    });
    
    if (pendingOrders.length === 0) {
      console.log("Нет ожидающих запросов на синхронизацию");
      return;
    }
    
    console.log(`Найдено ${pendingOrders.length} запросов на синхронизацию`);
    
    // Обрабатываем запросы последовательно
    for (const order of pendingOrders) {
      await processOrder(order);
    }
    
    console.log("Обработка запросов на синхронизацию завершена");
    
  } catch (error) {
    console.error("Ошибка при обработке запросов на синхронизацию:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем обработку при прямом вызове скрипта
if (require.main === module) {
  processSyncOrders()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Критическая ошибка:", error);
      process.exit(1);
    });
}

export { processSyncOrders };
