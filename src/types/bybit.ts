/**
 * Типы для работы с транзакциями Bybit
 */

/**
 * Транзакция Bybit
 */
export interface BybitTransaction {
    id?: number;
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
    userId?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }
  
  /**
   * Сводная информация о транзакциях Bybit
   */
  export interface BybitTransactionSummary {
    totalTransactions: number;
    totalAmount: Record<string, number>;
    totalValue: Record<string, number>;
    averagePrice: Record<string, number>;
    addedTransactions?: number;
    skippedTransactions?: number;
    totalProcessed?: number;
  }
  
  /**
   * Результат парсинга XLS файла с транзакциями Bybit
   */
  export interface ParsedBybitXLS {
    transactions: BybitTransaction[];
    summary: BybitTransactionSummary;
  }
  
  /**
   * Параметры для запроса транзакций Bybit
   */
  export interface GetBybitTransactionsParams {
    userId: number;
    page?: number;
    pageSize?: number;
    searchQuery?: string;
    startDate?: Date | null;
    endDate?: Date | null;
  }
  
  /**
   * Результат запроса транзакций Bybit
   */
  export interface GetBybitTransactionsResult {
    success: boolean;
    message?: string;
    transactions: BybitTransaction[];
    pagination: {
      totalTransactions: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
    };
  }
  
  /**
   * Параметры для загрузки XLS файла с транзакциями
   */
  export interface UploadBybitTransactionsParams {
    userId: number;
    fileBase64: string;
  }
  
  /**
   * Результат загрузки XLS файла с транзакциями
   */
  export interface UploadBybitTransactionsResult {
    success: boolean;
    message?: string;
    summary: BybitTransactionSummary & {
      addedTransactions: number;
      skippedTransactions: number;
      totalProcessed: number;
    };
  }