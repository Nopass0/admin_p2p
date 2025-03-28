// src/utils/format.ts

/**
 * Formats a number with thousands separators and specified decimal places
 * @param value Number to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
    return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  
  /**
   * Formats a currency value with symbol and thousands separators
   * @param value Number to format
   * @param currency Currency code ('RUB' or 'USDT')
   * @param decimals Number of decimal places (default: 2)
   * @returns Formatted currency string
   */
  export const formatCurrency = (value: number, currency: string, decimals: number = 2): string => {
    const formattedValue = formatNumber(value, decimals);
    
    if (currency === 'RUB') {
      return `${formattedValue} ₽`;
    } else if (currency === 'USDT') {
      return `${formattedValue} USDT`;
    }
    
    return formattedValue;
  };
  
  /**
   * Formats a date to a readable string
   * @param date Date to format
   * @param includeTime Whether to include time (default: true)
   * @returns Formatted date string
   */
  export const formatDate = (date: Date | string, includeTime: boolean = true): string => {
    const d = date instanceof Date ? date : new Date(date);
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    let result = `${day}.${month}.${year}`;
    
    if (includeTime) {
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      result += ` ${hours}:${minutes}`;
    }
    
    return result;
  };