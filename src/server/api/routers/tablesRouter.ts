import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Схема для типа колонки
const columnTypeSchema = z.enum([
  "TEXT",
  "NUMBER",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "SELECT",
  "BUTTON",
  "CALCULATED",
  "CURRENCY",
  "LINK",
  "COMMENT"
]);

// Схема для оператора фильтра
const filterOperatorSchema = z.enum([
  "EQUALS",
  "NOT_EQUALS",
  "GREATER_THAN",
  "LESS_THAN",
  "GREATER_OR_EQUAL",
  "LESS_OR_EQUAL",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "BETWEEN",
  "IN_LIST"
]);

// Роутер для работы с конструктором таблиц
export const tablesRouter = createTRPCRouter({
  // ============= РАЗДЕЛЫ =============
  
  // Получение всех разделов
  getAllSections: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const sections = await ctx.db.section.findMany({
          orderBy: { order: 'asc' },
          include: {
            tables: {
              orderBy: { order: 'asc' },
              select: { id: true, name: true, description: true }
            }
          }
        });
        
        return { success: true, sections };
      } catch (error) {
        console.error("Ошибка при получении разделов:", error);
        return { success: false, message: "Ошибка при получении разделов", sections: [] };
      }
    }),
  
  // Получение раздела по ID
  getSectionById: publicProcedure
    .input(z.object({ 
      sectionId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const section = await ctx.db.section.findUnique({
          where: { id: input.sectionId },
          include: {
            tables: {
              orderBy: { order: 'asc' },
              select: { id: true, name: true, description: true }
            }
          }
        });
        
        if (!section) {
          return { success: false, message: "Раздел не найден", section: null };
        }
        
        return { success: true, section };
      } catch (error) {
        console.error("Ошибка при получении раздела:", error);
        return { success: false, message: "Ошибка при получении раздела", section: null };
      }
    }),
  
  // Создание нового раздела
  createSection: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Название раздела обязательно"),
      description: z.string().optional(),
      slug: z.string().min(1, "URL-идентификатор обязателен"),
      isActive: z.boolean().default(true),
      order: z.number().int().default(0)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем уникальность slug
        const existingSection = await ctx.db.section.findFirst({
          where: { slug: input.slug }
        });
        
        if (existingSection) {
          return { 
            success: false, 
            message: "Раздел с таким URL-идентификатором уже существует", 
            section: null 
          };
        }
        
        const newSection = await ctx.db.section.create({
          data: {
            name: input.name,
            description: input.description,
            slug: input.slug,
            isActive: input.isActive,
            order: input.order
          }
        });
        
        return { success: true, message: "Раздел успешно создан", section: newSection };
      } catch (error) {
        console.error("Ошибка при создании раздела:", error);
        return { success: false, message: "Ошибка при создании раздела", section: null };
      }
    }),
  
  // Обновление раздела
  updateSection: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      name: z.string().min(1, "Название раздела обязательно"),
      description: z.string().optional(),
      slug: z.string().min(1, "URL-идентификатор обязателен"),
      isActive: z.boolean(),
      order: z.number().int()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем уникальность slug (не считая текущий раздел)
        const existingSection = await ctx.db.section.findFirst({
          where: { 
            slug: input.slug,
            id: { not: input.id }
          }
        });
        
        if (existingSection) {
          return { 
            success: false, 
            message: "Раздел с таким URL-идентификатором уже существует", 
            section: null 
          };
        }
        
        const updatedSection = await ctx.db.section.update({
          where: { id: input.id },
          data: {
            name: input.name,
            description: input.description,
            slug: input.slug,
            isActive: input.isActive,
            order: input.order
          }
        });
        
        return { success: true, message: "Раздел успешно обновлен", section: updatedSection };
      } catch (error) {
        console.error("Ошибка при обновлении раздела:", error);
        return { success: false, message: "Ошибка при обновлении раздела", section: null };
      }
    }),
  
  // Удаление раздела
  deleteSection: publicProcedure
    .input(z.object({ 
      sectionId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем, есть ли таблицы в этом разделе
        const tablesCount = await ctx.db.table.count({
          where: { sectionId: input.sectionId }
        });
        
        if (tablesCount > 0) {
          return { 
            success: false, 
            message: `Невозможно удалить раздел, так как он содержит ${tablesCount} таблиц. Сначала удалите или переместите эти таблицы.` 
          };
        }
        
        await ctx.db.section.delete({
          where: { id: input.sectionId }
        });
        
        return { success: true, message: "Раздел успешно удален" };
      } catch (error) {
        console.error("Ошибка при удалении раздела:", error);
        return { success: false, message: "Ошибка при удалении раздела" };
      }
    }),
  
  // ============= ТАБЛИЦЫ =============
  
  // Получение всех таблиц
  getAllTables: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const tables = await ctx.db.table.findMany({
          orderBy: { order: 'asc' },
          include: {
            section: true,
            _count: {
              select: { 
                columns: true,
                rows: true 
              }
            }
          }
        });
        
        return { success: true, tables };
      } catch (error) {
        console.error("Ошибка при получении таблиц:", error);
        return { success: false, message: "Ошибка при получении таблиц", tables: [] };
      }
    }),
  
  // Получение таблицы по ID (с полной структурой)
  getTableById: publicProcedure
    .input(z.object({ 
      tableId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          include: {
            section: true,
            columns: {
              orderBy: { order: 'asc' }
            },
            filters: {
              include: {
                column: true
              }
            }
          }
        });
        
        if (!table) {
          return { success: false, message: "Таблица не найдена", table: null };
        }
        
        return { success: true, table };
      } catch (error) {
        console.error("Ошибка при получении таблицы:", error);
        return { success: false, message: "Ошибка при получении таблицы", table: null };
      }
    }),
  
  // Создание новой таблицы
  createTable: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Название таблицы обязательно"),
      description: z.string().optional(),
      sectionId: z.number().int().positive(),
      isSearchable: z.boolean().default(true),
      hasPagination: z.boolean().default(true),
      pageSize: z.number().int().positive().default(10),
      order: z.number().int().default(0)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование раздела
        const section = await ctx.db.section.findUnique({
          where: { id: input.sectionId }
        });
        
        if (!section) {
          return { 
            success: false, 
            message: "Указанный раздел не существует", 
            table: null 
          };
        }
        
        const newTable = await ctx.db.table.create({
          data: {
            name: input.name,
            description: input.description,
            sectionId: input.sectionId,
            isSearchable: input.isSearchable,
            hasPagination: input.hasPagination,
            pageSize: input.pageSize,
            order: input.order
          }
        });
        
        return { success: true, message: "Таблица успешно создана", table: newTable };
      } catch (error) {
        console.error("Ошибка при создании таблицы:", error);
        return { success: false, message: "Ошибка при создании таблицы", table: null };
      }
    }),
  
  // Обновление таблицы
  updateTable: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      name: z.string().min(1, "Название таблицы обязательно"),
      description: z.string().optional(),
      sectionId: z.number().int().positive(),
      isSearchable: z.boolean(),
      hasPagination: z.boolean(),
      pageSize: z.number().int().positive(),
      order: z.number().int()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование раздела
        const section = await ctx.db.section.findUnique({
          where: { id: input.sectionId }
        });
        
        if (!section) {
          return { 
            success: false, 
            message: "Указанный раздел не существует", 
            table: null 
          };
        }
        
        const updatedTable = await ctx.db.table.update({
          where: { id: input.id },
          data: {
            name: input.name,
            description: input.description,
            sectionId: input.sectionId,
            isSearchable: input.isSearchable,
            hasPagination: input.hasPagination,
            pageSize: input.pageSize,
            order: input.order
          }
        });
        
        return { success: true, message: "Таблица успешно обновлена", table: updatedTable };
      } catch (error) {
        console.error("Ошибка при обновлении таблицы:", error);
        return { success: false, message: "Ошибка при обновлении таблицы", table: null };
      }
    }),
  
  // Удаление таблицы
  deleteTable: publicProcedure
    .input(z.object({ 
      tableId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // В Prisma каскадное удаление настроено в схеме, поэтому удаляем сразу таблицу
        await ctx.db.table.delete({
          where: { id: input.tableId }
        });
        
        return { success: true, message: "Таблица и все связанные данные успешно удалены" };
      } catch (error) {
        console.error("Ошибка при удалении таблицы:", error);
        return { success: false, message: "Ошибка при удалении таблицы" };
      }
    }),
  
  // ============= КОЛОНКИ =============
  
  // Получение колонок таблицы
  getTableColumns: publicProcedure
    .input(z.object({ 
      tableId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const columns = await ctx.db.column.findMany({
          where: { tableId: input.tableId },
          orderBy: { order: 'asc' }
        });
        
        return { success: true, columns };
      } catch (error) {
        console.error("Ошибка при получении колонок:", error);
        return { success: false, message: "Ошибка при получении колонок", columns: [] };
      }
    }),
  
  // Создание новой колонки
  createColumn: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Название колонки обязательно"),
      type: columnTypeSchema,
      tableId: z.number().int().positive(),
      width: z.number().int().optional(),
      isRequired: z.boolean().default(false),
      isFilterable: z.boolean().default(false),
      isSummable: z.boolean().default(false),
      defaultValue: z.string().optional(),
      format: z.string().optional(),
      order: z.number().int().min(0),
      options: z.any().optional() // JSON с опциями для типов SELECT, CALCULATED и т.д.
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование таблицы
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId }
        });
        
        if (!table) {
          return { 
            success: false, 
            message: "Указанная таблица не существует", 
            column: null 
          };
        }

        // Проверяем, если колонка типа NUMBER или CURRENCY и isSummable=true, 
        // но название не содержит "сумма", "стоимость", "цена" и т.д.,
        // то предупреждаем (но всё равно создаём)
        let warning = null;
        if ((input.type === "NUMBER" || input.type === "CURRENCY") && 
             input.isSummable && 
             !(input.name.toLowerCase().includes("сумма") || 
               input.name.toLowerCase().includes("цена") || 
               input.name.toLowerCase().includes("стоимость") || 
               input.name.toLowerCase().includes("итог") || 
               input.name.toLowerCase().includes("total") || 
               input.name.toLowerCase().includes("sum") || 
               input.name.toLowerCase().includes("price") || 
               input.name.toLowerCase().includes("cost"))) {
          warning = "Колонка отмечена как суммируемая, но её название не содержит ключевых слов 'сумма', 'цена', 'стоимость' и т.д.";
        }
        
        const newColumn = await ctx.db.column.create({
          data: {
            name: input.name,
            type: input.type,
            tableId: input.tableId,
            width: input.width,
            isRequired: input.isRequired,
            isFilterable: input.isFilterable,
            isSummable: input.isSummable,
            defaultValue: input.defaultValue,
            format: input.format,
            order: input.order,
            options: input.options ? Prisma.JsonValue : undefined
          }
        });
        
        return { 
          success: true, 
          message: "Колонка успешно создана", 
          warning, 
          column: newColumn 
        };
      } catch (error) {
        console.error("Ошибка при создании колонки:", error);
        return { success: false, message: "Ошибка при создании колонки", column: null };
      }
    }),
  
  // Обновление колонки
  updateColumn: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      name: z.string().min(1, "Название колонки обязательно"),
      type: columnTypeSchema,
      width: z.number().int().optional(),
      isRequired: z.boolean(),
      isFilterable: z.boolean(),
      isSummable: z.boolean(),
      defaultValue: z.string().optional(),
      format: z.string().optional(),
      order: z.number().int().min(0),
      options: z.any().optional() // JSON с опциями для типов SELECT, CALCULATED и т.д.
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Получаем текущую колонку для проверки, меняется ли тип
        const currentColumn = await ctx.db.column.findUnique({
          where: { id: input.id },
          include: { cells: { take: 1 } }
        });
        
        if (!currentColumn) {
          return { 
            success: false, 
            message: "Колонка не найдена", 
            column: null 
          };
        }

        // Проверяем, если меняется тип колонки и уже есть данные
        let warning = null;
        if (currentColumn.type !== input.type && currentColumn.cells.length > 0) {
          warning = "Изменение типа колонки может привести к потере или искажению данных. Рекомендуется создать новую колонку вместо изменения типа существующей.";
        }

        // Проверяем, если колонка типа NUMBER или CURRENCY и isSummable=true, но название не подходящее
        if ((input.type === "NUMBER" || input.type === "CURRENCY") && 
             input.isSummable && 
             !(input.name.toLowerCase().includes("сумма") || 
               input.name.toLowerCase().includes("цена") || 
               input.name.toLowerCase().includes("стоимость") || 
               input.name.toLowerCase().includes("итог") || 
               input.name.toLowerCase().includes("total") || 
               input.name.toLowerCase().includes("sum") || 
               input.name.toLowerCase().includes("price") || 
               input.name.toLowerCase().includes("cost"))) {
          warning = (warning || "") + " Колонка отмечена как суммируемая, но её название не содержит ключевых слов 'сумма', 'цена', 'стоимость' и т.д.";
        }
        
        const updatedColumn = await ctx.db.column.update({
          where: { id: input.id },
          data: {
            name: input.name,
            type: input.type,
            width: input.width,
            isRequired: input.isRequired,
            isFilterable: input.isFilterable,
            isSummable: input.isSummable,
            defaultValue: input.defaultValue,
            format: input.format,
            order: input.order,
            options: input.options ? Prisma.JsonValue : undefined
          }
        });
        
        return { 
          success: true, 
          message: "Колонка успешно обновлена", 
          warning, 
          column: updatedColumn 
        };
      } catch (error) {
        console.error("Ошибка при обновлении колонки:", error);
        return { success: false, message: "Ошибка при обновлении колонки", column: null };
      }
    }),
  
  // Удаление колонки
  deleteColumn: publicProcedure
    .input(z.object({ 
      columnId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем, есть ли у колонки ячейки с данными
        const cellsCount = await ctx.db.cell.count({
          where: { columnId: input.columnId }
        });
        
        // Удаляем колонку
        await ctx.db.column.delete({
          where: { id: input.columnId }
        });
        
        return { 
          success: true, 
          message: `Колонка успешно удалена${cellsCount > 0 ? `. Также удалено ${cellsCount} ячеек с данными.` : ''}` 
        };
      } catch (error) {
        console.error("Ошибка при удалении колонки:", error);
        return { success: false, message: "Ошибка при удалении колонки" };
      }
    }),
  
  // ============= СТРОКИ И ЯЧЕЙКИ =============
  
  // Получение данных таблицы (строк и ячеек) с фильтрацией, сортировкой и пагинацией
  getTableData: publicProcedure
    .input(z.object({
      tableId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().default(10),
      sortColumn: z.number().int().optional(), // ID колонки для сортировки
      sortDirection: z.enum(['asc', 'desc']).default('asc'),
      filters: z.array(z.object({
        columnId: z.number().int().positive(),
        operator: filterOperatorSchema,
        value: z.string().optional(),
        secondValue: z.string().optional()
      })).optional(),
      searchText: z.string().optional() // Глобальный поиск по всем колонкам
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Получаем информацию о таблице
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          select: {
            hasPagination: true,
            pageSize: true
          }
        });
        
        if (!table) {
          return { success: false, message: "Таблица не найдена", data: null };
        }
        
        // Получаем колонки таблицы для работы с типами данных и форматами
        const columns = await ctx.db.column.findMany({
          where: { tableId: input.tableId },
          orderBy: { order: 'asc' }
        });
        
        // Базовый фильтр по таблице и активным строкам
        let where: Prisma.RowWhereInput = {
          tableId: input.tableId,
          isActive: true
        };
        
        // Применяем фильтры, если они есть
        if (input.filters && input.filters.length > 0) {
          // Формируем сложные условия для фильтрации по ячейкам
          // Это требует более сложной логики с Prisma и может потребовать кастомных запросов
          // Для демонстрации пропустим детали реализации фильтров
        }
        
        // Применяем глобальный поиск, если он задан
        if (input.searchText && input.searchText.trim() !== '') {
          // Добавляем условие поиска по всем колонкам через Cell
        }
        
        // Получаем общее количество строк для пагинации
        const totalRows = await ctx.db.row.count({ where });
        
        // Применяем пагинацию, если она включена в настройках таблицы
        const usePagination = table.hasPagination;
        const pageSize = usePagination ? (input.pageSize || table.pageSize) : totalRows;
        const skip = usePagination ? (input.page - 1) * pageSize : 0;
        
        // Получаем строки с пагинацией и сортировкой
        const rows = await ctx.db.row.findMany({
          where,
          orderBy: input.sortColumn 
            ? { cells: { some: { columnId: input.sortColumn, value: input.sortDirection } } } 
            : { order: 'asc' },
          include: {
            cells: {
              include: {
                column: true,
                comments: {
                  orderBy: { createdAt: 'desc' }
                }
              }
            }
          },
          skip,
          take: pageSize
        });
        
        // Рассчитываем итоги по колонкам с isSummable = true
        const summableColumns = columns.filter(col => col.isSummable);
        
        let summaries = null;
        if (summableColumns.length > 0) {
          // В реальном приложении здесь будет логика вычисления итогов
          // Для демонстрации создадим заглушку
          summaries = {};
          for (const col of summableColumns) {
            summaries[col.id] = 0; // Здесь должна быть сумма значений
          }
        }
        
        // Форматируем данные для отображения
        const formattedRows = rows.map(row => {
          const cells = {};
          row.cells.forEach(cell => {
            cells[cell.column.id] = {
              value: cell.value,
              displayValue: cell.displayValue || cell.value,
              calculatedValue: cell.calculatedValue,
              comments: cell.comments
            };
          });
          
          return {
            id: row.id,
            order: row.order,
            cells
          };
        });
        
        return { 
          success: true, 
          data: {
            columns,
            rows: formattedRows,
            pagination: {
              totalRows,
              totalPages: Math.ceil(totalRows / pageSize),
              currentPage: input.page,
              pageSize
            },
            summaries
          }
        };
      } catch (error) {
        console.error("Ошибка при получении данных таблицы:", error);
        return { success: false, message: "Ошибка при получении данных таблицы", data: null };
      }
    }),
  
  // Создание новой строки
  createRow: publicProcedure
    .input(z.object({ 
      tableId: z.number().int().positive(),
      cells: z.array(z.object({
        columnId: z.number().int().positive(),
        value: z.string().nullable()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование таблицы и получаем её колонки
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          include: {
            columns: true
          }
        });
        
        if (!table) {
          return { 
            success: false, 
            message: "Указанная таблица не существует", 
            row: null 
          };
        }
        
        // Проверяем, что все обязательные колонки заполнены
        const requiredColumns = table.columns.filter(col => col.isRequired);
        for (const col of requiredColumns) {
          const cell = input.cells.find(c => c.columnId === col.id);
          if (!cell || cell.value === null || cell.value.trim() === '') {
            return { 
              success: false, 
              message: `Колонка "${col.name}" обязательна для заполнения`, 
              row: null 
            };
          }
        }
        
        // Получаем максимальный порядок существующих строк
        const maxOrder = await ctx.db.row.findFirst({
          where: { tableId: input.tableId },
          orderBy: { order: 'desc' },
          select: { order: true }
        });
        
        const newOrder = maxOrder ? maxOrder.order + 1 : 0;
        
        // Создаем новую строку
        const newRow = await ctx.db.row.create({
          data: {
            tableId: input.tableId,
            order: newOrder,
            isActive: true
          }
        });
        
        // Создаем ячейки для строки
        const cellsData = [];
        for (const cellInput of input.cells) {
          const column = table.columns.find(col => col.id === cellInput.columnId);
          if (!column) continue;
          
          // Получаем значение для ячейки (или используем значение по умолчанию)
          const value = cellInput.value !== null ? cellInput.value : (column.defaultValue || null);
          
          // Форматируем значение для отображения (в реальном приложении здесь будет логика форматирования)
          let displayValue = value;
          
          // Для типа DATE форматируем дату
          if (column.type === 'DATE' && value) {
            try {
              displayValue = new Date(value).toLocaleDateString('ru-RU');
            } catch (e) {
              displayValue = value;
            }
          }
          
          // Для типа DATETIME форматируем дату и время
          if (column.type === 'DATETIME' && value) {
            try {
              displayValue = new Date(value).toLocaleString('ru-RU');
            } catch (e) {
              displayValue = value;
            }
          }
          
          // Для типа CURRENCY форматируем как валюту
          if (column.type === 'CURRENCY' && value) {
            try {
              displayValue = new Intl.NumberFormat('ru-RU', { 
                style: 'currency', 
                currency: 'RUB' 
              }).format(parseFloat(value));
            } catch (e) {
              displayValue = value;
            }
          }
          
          cellsData.push({
            rowId: newRow.id,
            columnId: cellInput.columnId,
            value,
            displayValue
          });
        }
        
        // Создаем все ячейки сразу
        await ctx.db.cell.createMany({
          data: cellsData
        });
        
        // Получаем созданную строку со всеми ячейками
        const createdRow = await ctx.db.row.findUnique({
          where: { id: newRow.id },
          include: {
            cells: {
              include: {
                column: true
              }
            }
          }
        });
        
        return { success: true, message: "Строка успешно создана", row: createdRow };
      } catch (error) {
        console.error("Ошибка при создании строки:", error);
        return { success: false, message: "Ошибка при создании строки", row: null };
      }
    }),
  
  // Обновление строки и ячеек
  updateRow: publicProcedure
    .input(z.object({ 
      rowId: z.number().int().positive(),
      cells: z.array(z.object({
        columnId: z.number().int().positive(),
        value: z.string().nullable()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Получаем строку и проверяем её существование
        const row = await ctx.db.row.findUnique({
          where: { id: input.rowId },
          include: {
            table: {
              include: {
                columns: true
              }
            }
          }
        });
        
        if (!row) {
          return { 
            success: false, 
            message: "Строка не найдена", 
            row: null 
          };
        }
        
        // Проверяем, что все обязательные колонки заполнены
        const requiredColumns = row.table.columns.filter(col => col.isRequired);
        for (const col of requiredColumns) {
          const cell = input.cells.find(c => c.columnId === col.id);
          if (!cell || cell.value === null || cell.value.trim() === '') {
            return { 
              success: false, 
              message: `Колонка "${col.name}" обязательна для заполнения`, 
              row: null 
            };
          }
        }
        
        // Обновляем или создаем ячейки
        for (const cellInput of input.cells) {
          const column = row.table.columns.find(col => col.id === cellInput.columnId);
          if (!column) continue;
          
          // Получаем текущую ячейку (если есть)
          const existingCell = await ctx.db.cell.findUnique({
            where: {
              rowId_columnId: {
                rowId: input.rowId,
                columnId: cellInput.columnId
              }
            }
          });
          
          // Получаем значение для ячейки
          const value = cellInput.value !== null ? cellInput.value : (column.defaultValue || null);
          
          // Форматируем значение для отображения (как в createRow)
          let displayValue = value;
          
          // Обновляем или создаем ячейку
          if (existingCell) {
            await ctx.db.cell.update({
              where: { id: existingCell.id },
              data: {
                value,
                displayValue
              }
            });
          } else {
            await ctx.db.cell.create({
              data: {
                rowId: input.rowId,
                columnId: cellInput.columnId,
                value,
                displayValue
              }
            });
          }
        }
        
        // Получаем обновленную строку со всеми ячейками
        const updatedRow = await ctx.db.row.findUnique({
          where: { id: input.rowId },
          include: {
            cells: {
              include: {
                column: true,
                comments: {
                  orderBy: { createdAt: 'desc' }
                }
              }
            }
          }
        });
        
        return { success: true, message: "Строка успешно обновлена", row: updatedRow };
      } catch (error) {
        console.error("Ошибка при обновлении строки:", error);
        return { success: false, message: "Ошибка при обновлении строки", row: null };
      }
    }),
  
  // Удаление строки
  deleteRow: publicProcedure
    .input(z.object({ 
      rowId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование строки
        const row = await ctx.db.row.findUnique({
          where: { id: input.rowId }
        });
        
        if (!row) {
          return { success: false, message: "Строка не найдена" };
        }
        
        // Удаляем строку (каскадно удалятся и ячейки)
        await ctx.db.row.delete({
          where: { id: input.rowId }
        });
        
        return { success: true, message: "Строка успешно удалена" };
      } catch (error) {
        console.error("Ошибка при удалении строки:", error);
        return { success: false, message: "Ошибка при удалении строки" };
      }
    }),
  
  // ============= КОММЕНТАРИИ =============
  
  // Добавление комментария к ячейке
  addComment: publicProcedure
    .input(z.object({ 
      cellId: z.number().int().positive(),
      text: z.string().min(1, "Текст комментария обязателен"),
      author: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование ячейки
        const cell = await ctx.db.cell.findUnique({
          where: { id: input.cellId }
        });
        
        if (!cell) {
          return { 
            success: false, 
            message: "Ячейка не найдена", 
            comment: null 
          };
        }
        
        // Создаем комментарий
        const newComment = await ctx.db.comment.create({
          data: {
            cellId: input.cellId,
            text: input.text,
            author: input.author
          }
        });
        
        return { success: true, message: "Комментарий успешно добавлен", comment: newComment };
      } catch (error) {
        console.error("Ошибка при добавлении комментария:", error);
        return { success: false, message: "Ошибка при добавлении комментария", comment: null };
      }
    }),
  
  // Получение комментариев к ячейке
  getCellComments: publicProcedure
    .input(z.object({ 
      cellId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const comments = await ctx.db.comment.findMany({
          where: { cellId: input.cellId },
          orderBy: { createdAt: 'desc' }
        });
        
        return { success: true, comments };
      } catch (error) {
        console.error("Ошибка при получении комментариев:", error);
        return { success: false, message: "Ошибка при получении комментариев", comments: [] };
      }
    }),
  
  // ============= ФИЛЬТРЫ =============
  
  // Получение фильтров таблицы
  getTableFilters: publicProcedure
    .input(z.object({ 
      tableId: z.number().int().positive() 
    }))
    .query(async ({ ctx, input }) => {
      try {
        const filters = await ctx.db.filter.findMany({
          where: { 
            tableId: input.tableId,
            isActive: true
          },
          include: {
            column: true
          },
          orderBy: { createdAt: 'asc' }
        });
        
        return { success: true, filters };
      } catch (error) {
        console.error("Ошибка при получении фильтров:", error);
        return { success: false, message: "Ошибка при получении фильтров", filters: [] };
      }
    }),
  
  // Создание нового фильтра
  createFilter: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Название фильтра обязательно"),
      tableId: z.number().int().positive(),
      columnId: z.number().int().positive(),
      operator: filterOperatorSchema,
      value: z.string().optional(),
      secondValue: z.string().optional(),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование таблицы и колонки
        const column = await ctx.db.column.findFirst({
          where: { 
            id: input.columnId,
            tableId: input.tableId,
            isFilterable: true
          }
        });
        
        if (!column) {
          return { 
            success: false, 
            message: "Указанная колонка не существует или не поддерживает фильтрацию", 
            filter: null 
          };
        }
        
        // Проверка на совместимость оператора и типа колонки
        let warning = null;
        if (
          ((column.type === 'DATE' || column.type === 'DATETIME') && 
           !['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL', 'BETWEEN'].includes(input.operator)) ||
          ((column.type === 'NUMBER' || column.type === 'CURRENCY') && 
           !['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL', 'BETWEEN', 'IN_LIST'].includes(input.operator)) ||
          (column.type === 'BOOLEAN' && !['EQUALS', 'NOT_EQUALS'].includes(input.operator))
        ) {
          warning = "Выбранный оператор может быть несовместим с типом данных колонки";
        }
        
        // Проверка для оператора BETWEEN - должны быть оба значения
        if (input.operator === 'BETWEEN' && (!input.value || !input.secondValue)) {
          return { 
            success: false, 
            message: "Для оператора 'BETWEEN' необходимо указать оба значения", 
            filter: null 
          };
        }
        
        // Создаем фильтр
        const newFilter = await ctx.db.filter.create({
          data: {
            name: input.name,
            tableId: input.tableId,
            columnId: input.columnId,
            operator: input.operator,
            value: input.value,
            secondValue: input.secondValue,
            isActive: input.isActive
          }
        });
        
        return { 
          success: true, 
          message: "Фильтр успешно создан", 
          warning, 
          filter: newFilter 
        };
      } catch (error) {
        console.error("Ошибка при создании фильтра:", error);
        return { success: false, message: "Ошибка при создании фильтра", filter: null };
      }
    }),
  
  // Обновление фильтра
  updateFilter: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      name: z.string().min(1, "Название фильтра обязательно"),
      operator: filterOperatorSchema,
      value: z.string().optional(),
      secondValue: z.string().optional(),
      isActive: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Получаем текущий фильтр
        const currentFilter = await ctx.db.filter.findUnique({
          where: { id: input.id },
          include: { column: true }
        });
        
        if (!currentFilter) {
          return { 
            success: false, 
            message: "Фильтр не найден", 
            filter: null 
          };
        }
        
        // Проверка на совместимость оператора и типа колонки
        let warning = null;
        if (
          ((currentFilter.column.type === 'DATE' || currentFilter.column.type === 'DATETIME') && 
           !['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL', 'BETWEEN'].includes(input.operator)) ||
          ((currentFilter.column.type === 'NUMBER' || currentFilter.column.type === 'CURRENCY') && 
           !['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'GREATER_OR_EQUAL', 'LESS_OR_EQUAL', 'BETWEEN', 'IN_LIST'].includes(input.operator)) ||
          (currentFilter.column.type === 'BOOLEAN' && !['EQUALS', 'NOT_EQUALS'].includes(input.operator))
        ) {
          warning = "Выбранный оператор может быть несовместим с типом данных колонки";
        }
        
        // Проверка для оператора BETWEEN - должны быть оба значения
        if (input.operator === 'BETWEEN' && (!input.value || !input.secondValue)) {
          return { 
            success: false, 
            message: "Для оператора 'BETWEEN' необходимо указать оба значения", 
            filter: null 
          };
        }
        
        // Обновляем фильтр
        const updatedFilter = await ctx.db.filter.update({
          where: { id: input.id },
          data: {
            name: input.name,
            operator: input.operator,
            value: input.value,
            secondValue: input.secondValue,
            isActive: input.isActive
          }
        });
        
        return { 
          success: true, 
          message: "Фильтр успешно обновлен", 
          warning, 
          filter: updatedFilter 
        };
      } catch (error) {
        console.error("Ошибка при обновлении фильтра:", error);
        return { success: false, message: "Ошибка при обновлении фильтра", filter: null };
      }
    }),
  
  // Удаление фильтра
  deleteFilter: publicProcedure
    .input(z.object({ 
      filterId: z.number().int().positive() 
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверяем существование фильтра
        const filter = await ctx.db.filter.findUnique({
          where: { id: input.filterId }
        });
        
        if (!filter) {
          return { success: false, message: "Фильтр не найден" };
        }
        
        // Удаляем фильтр
        await ctx.db.filter.delete({
          where: { id: input.filterId }
        });
        
        return { success: true, message: "Фильтр успешно удален" };
      } catch (error) {
        console.error("Ошибка при удалении фильтра:", error);
        return { success: false, message: "Ошибка при удалении фильтра" };
      }
    }),
});