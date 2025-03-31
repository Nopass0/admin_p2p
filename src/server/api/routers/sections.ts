import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import * as XLSX from 'xlsx';
import { parse, unparse } from 'papaparse';

// Схемы валидации для различных типов запросов
const ColumnTypeEnum = z.enum([
  "TEXT", "NUMBER", "DATE", "DATETIME", "BOOLEAN", 
  "SELECT", "BUTTON", "CALCULATED", "CURRENCY", "LINK", "COMMENT"
]);

const FilterOperatorEnum = z.enum([
  "EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", 
  "GREATER_OR_EQUAL", "LESS_OR_EQUAL", "CONTAINS", "NOT_CONTAINS", 
  "STARTS_WITH", "ENDS_WITH", "BETWEEN", "IN_LIST"
]);

export const sectionsRouter = createTRPCRouter({
  // ============ CRUD для разделов (секций) ============
  
  // Получение всех разделов
  getAllSections: publicProcedure
    .input(z.object({ 
      searchQuery: z.string().optional(),
      skip: z.number().int().nonnegative().optional(),
      take: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { searchQuery, skip, take } = input;
        let where = {};
        
        if (searchQuery) {
          where = {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { description: { contains: searchQuery, mode: 'insensitive' } },
            ]
          };
        }

        const [sections, totalCount] = await Promise.all([
          ctx.db.section.findMany({
            where,
            orderBy: { order: 'asc' },
            skip: skip || 0,
            take: take || 100,
            include: {
              _count: {
                select: { tables: true }
              }
            }
          }),
          ctx.db.section.count({ where })
        ]);

        return { 
          success: true, 
          sections,
          pagination: {
            total: totalCount,
            skip: skip || 0,
            take: take || 100
          }
        };
      } catch (error) {
        console.error("Ошибка при получении разделов:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении разделов", 
          sections: [],
          pagination: { total: 0, skip: 0, take: 100 }
        };
      }
    }),

  // Получение раздела по ID
  getSectionById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        const section = await ctx.db.section.findUnique({
          where: { id: input.id },
          include: {
            tables: {
              orderBy: { order: 'asc' },
              include: {
                _count: {
                  select: { columns: true, rows: true }
                }
              }
            }
          }
        });

        if (!section) {
          return { 
            success: false, 
            message: "Раздел не найден", 
            section: null 
          };
        }

        return { 
          success: true, 
          section 
        };
      } catch (error) {
        console.error("Ошибка при получении раздела:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении раздела", 
          section: null
        };
      }
    }),

  // Создание нового раздела
  createSection: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Название раздела обязательно"),
      description: z.string().optional(),
      slug: z.string().min(1, "URL-идентификатор обязателен"),
      isActive: z.boolean().optional(),
      order: z.number().int().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка на уникальность slug
        const existingSection = await ctx.db.section.findUnique({
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
            description: input.description || "",
            slug: input.slug,
            isActive: input.isActive ?? true,
            order: input.order ?? 0
          }
        });

        return { 
          success: true, 
          message: "Раздел успешно создан", 
          section: newSection 
        };
      } catch (error) {
        console.error("Ошибка при создании раздела:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании раздела", 
          section: null 
        };
      }
    }),

  // Обновление раздела
  updateSection: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      name: z.string().min(1, "Название раздела обязательно"),
      description: z.string().optional(),
      slug: z.string().min(1, "URL-идентификатор обязателен"),
      isActive: z.boolean().optional(),
      order: z.number().int().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования раздела
        const existingSection = await ctx.db.section.findUnique({
          where: { id: input.id }
        });

        if (!existingSection) {
          return {
            success: false,
            message: "Раздел не найден",
            section: null
          };
        }

        // Проверка на уникальность slug (если он изменился)
        if (input.slug !== existingSection.slug) {
          const slugExists = await ctx.db.section.findUnique({
            where: { slug: input.slug }
          });

          if (slugExists) {
            return {
              success: false,
              message: "Раздел с таким URL-идентификатором уже существует",
              section: null
            };
          }
        }

        const updatedSection = await ctx.db.section.update({
          where: { id: input.id },
          data: {
            name: input.name,
            description: input.description || "",
            slug: input.slug,
            isActive: input.isActive ?? existingSection.isActive,
            order: input.order ?? existingSection.order
          }
        });

        return { 
          success: true, 
          message: "Раздел успешно обновлен", 
          section: updatedSection 
        };
      } catch (error) {
        console.error("Ошибка при обновлении раздела:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении раздела", 
          section: null 
        };
      }
    }),

  // Удаление раздела
  deleteSection: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования раздела
        const existingSection = await ctx.db.section.findUnique({
          where: { id: input.id },
          include: { tables: true }
        });

        if (!existingSection) {
          return {
            success: false,
            message: "Раздел не найден"
          };
        }

        await ctx.db.section.delete({
          where: { id: input.id }
        });

        return { 
          success: true, 
          message: "Раздел успешно удален" 
        };
      } catch (error) {
        console.error("Ошибка при удалении раздела:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении раздела" 
        };
      }
    }),

  // ============ CRUD для таблиц ============
  
  // Получение всех таблиц раздела
  getSectionTables: publicProcedure
    .input(z.object({ 
      sectionId: z.number().int().positive(),
      searchQuery: z.string().optional(),
      skip: z.number().int().nonnegative().optional(),
      take: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { sectionId, searchQuery, skip, take } = input;
        
        // Проверка существования раздела
        const section = await ctx.db.section.findUnique({
          where: { id: sectionId }
        });

        if (!section) {
          return {
            success: false,
            message: "Раздел не найден",
            tables: [],
            pagination: { total: 0, skip: 0, take: 0 }
          };
        }

        let where: Prisma.TableWhereInput = { sectionId };
        
        if (searchQuery) {
          where.OR = [
            { name: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } },
          ];
        }

        const [tables, totalCount] = await Promise.all([
          ctx.db.table.findMany({
            where,
            orderBy: { order: 'asc' },
            skip: skip || 0,
            take: take || 100,
            include: {
              _count: {
                select: { columns: true, rows: true }
              }
            }
          }),
          ctx.db.table.count({ where })
        ]);

        return { 
          success: true, 
          tables,
          pagination: {
            total: totalCount,
            skip: skip || 0,
            take: take || 100
          }
        };
      } catch (error) {
        console.error("Ошибка при получении таблиц раздела:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении таблиц раздела", 
          tables: [],
          pagination: { total: 0, skip: 0, take: 0 }
        };
      }
    }),

  // Получение таблицы по ID с колонками
  getTableById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        const table = await ctx.db.table.findUnique({
          where: { id: input.id },
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
          return { 
            success: false, 
            message: "Таблица не найдена", 
            table: null 
          };
        }

        return { 
          success: true, 
          table 
        };
      } catch (error) {
        console.error("Ошибка при получении таблицы:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении таблицы", 
          table: null
        };
      }
    }),

  // Получение данных таблицы (строки и ячейки) с пагинацией и фильтрацией
  getTableData: publicProcedure
    .input(z.object({ 
      tableId: z.number().int().positive(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().optional(),
      searchQuery: z.string().optional(),
      filters: z.array(z.object({
        columnId: z.number().int().positive(),
        operator: FilterOperatorEnum,
        value: z.string().optional(),
        secondValue: z.string().optional(),
      })).optional(),
      sortColumn: z.number().int().positive().optional(),
      sortDirection: z.enum(['asc', 'desc']).optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { tableId, page, filters, searchQuery, sortColumn, sortDirection } = input;
        
        // Получаем информацию о таблице и колонках
        const table = await ctx.db.table.findUnique({
          where: { id: tableId },
          include: {
            columns: {
              orderBy: { order: 'asc' }
            }
          }
        });

        if (!table) {
          return { 
            success: false, 
            message: "Таблица не найдена", 
            rows: [],
            pagination: { total: 0, page: 1, pageSize: 10, pageCount: 0 }
          };
        }

        // Применяем размер страницы из настроек таблицы или из запроса
        const pageSize = input.pageSize || table.pageSize;
        const skip = (page - 1) * pageSize;
        
        // Базовый запрос для строк
        let rowsWhere: Prisma.RowWhereInput = { tableId };
        let rowsInclude: Prisma.RowInclude = {
          cells: {
            include: {
              column: true,
              comments: {
                orderBy: { createdAt: 'desc' },
                take: 5 // Ограничиваем кол-во комментариев для каждой ячейки
              }
            }
          }
        };
        
        // Формируем условия фильтрации
        let cellFilters: Prisma.CellWhereInput[] = [];
        
        // Применяем поиск по всем текстовым колонкам, если задан searchQuery
        if (searchQuery) {
          const textColumnIds = table.columns
            .filter(col => ["TEXT", "LINK", "COMMENT"].includes(col.type))
            .map(col => col.id);
            
          if (textColumnIds.length > 0) {
            cellFilters.push({
              AND: [
                { columnId: { in: textColumnIds } },
                { value: { contains: searchQuery, mode: 'insensitive' } }
              ]
            });
          }
        }
        
        // Добавляем пользовательские фильтры
        if (filters && filters.length > 0) {
          for (const filter of filters) {
            const column = table.columns.find(col => col.id === filter.columnId);
            if (!column) continue;
            
            // Создаем фильтр для ячейки в зависимости от типа столбца и оператора
            let cellFilter: Prisma.CellWhereInput = { columnId: filter.columnId };
            
            switch (filter.operator) {
              case "EQUALS":
                cellFilter.value = filter.value;
                break;
              case "NOT_EQUALS":
                cellFilter.NOT = { value: filter.value };
                break;
              case "GREATER_THAN":
                cellFilter.value = { gt: filter.value };
                break;
              case "LESS_THAN":
                cellFilter.value = { lt: filter.value };
                break;
              case "GREATER_OR_EQUAL":
                cellFilter.value = { gte: filter.value };
                break;
              case "LESS_OR_EQUAL":
                cellFilter.value = { lte: filter.value };
                break;
              case "CONTAINS":
                cellFilter.value = { contains: filter.value, mode: 'insensitive' };
                break;
              case "NOT_CONTAINS":
                cellFilter.NOT = { value: { contains: filter.value, mode: 'insensitive' } };
                break;
              case "STARTS_WITH":
                cellFilter.value = { startsWith: filter.value, mode: 'insensitive' };
                break;
              case "ENDS_WITH":
                cellFilter.value = { endsWith: filter.value, mode: 'insensitive' };
                break;
              case "BETWEEN":
                if (filter.value && filter.secondValue) {
                  cellFilter.AND = [
                    { value: { gte: filter.value } },
                    { value: { lte: filter.secondValue } }
                  ];
                }
                break;
              case "IN_LIST":
                if (filter.value) {
                  // Разбиваем строку со списком значений
                  const values = filter.value.split(',').map(v => v.trim());
                  cellFilter.value = { in: values };
                }
                break;
            }
            
            cellFilters.push(cellFilter);
          }
        }

        // Строим где-условие для строк с учетом ID ячеек, которые подходят под фильтры
        if (cellFilters.length > 0) {
          // Сначала находим ID ячеек, соответствующих фильтрам
          const filteredCells = await ctx.db.cell.findMany({
            where: { OR: cellFilters },
            select: { rowId: true }
          });
          
          const filteredRowIds = [...new Set(filteredCells.map(cell => cell.rowId))];
          
          // Если отфильтрованные строки есть - применяем фильтр по ID
          if (filteredRowIds.length > 0) {
            rowsWhere.id = { in: filteredRowIds };
          } else if (cellFilters.length > 0) {
            // Если фильтры есть, но подходящих строк нет - возвращаем пустой результат
            return {
              success: true,
              rows: [],
              pagination: {
                total: 0,
                page,
                pageSize,
                pageCount: 0
              }
            };
          }
        }

        // Определяем сортировку
        let orderBy: Prisma.RowOrderByWithRelationInput[] = [{ order: 'asc' }];
        
        if (sortColumn) {
          // Для сортировки по значению ячейки конкретной колонки, используем
          // firstOrderByNested с Prisma, что может потребовать raw SQL в реальном проекте
          // Здесь использована упрощенная версия
          orderBy = [{ order: 'asc' }];
        }
        
        // Получаем строки с пагинацией
        const [rows, totalRows] = await Promise.all([
          ctx.db.row.findMany({
            where: rowsWhere,
            include: rowsInclude,
            orderBy,
            skip,
            take: pageSize
          }),
          ctx.db.row.count({ where: rowsWhere })
        ]);

        // Дополнительно: сбор суммарных данных для числовых колонок с isSummable=true
        const summableCols = table.columns.filter(col => col.isSummable);
        const summaryData: Record<number, number> = {};
        
        if (summableCols.length > 0) {
          // Получаем ID всех строк, соответствующих фильтрам (без пагинации)
          const allFilteredRows = await ctx.db.row.findMany({
            where: rowsWhere,
            select: { id: true }
          });
          
          const rowIds = allFilteredRows.map(row => row.id);
          
          // Для каждой суммируемой колонки, находим сумму значений
          for (const col of summableCols) {
            const cells = await ctx.db.cell.findMany({
              where: {
                columnId: col.id,
                rowId: { in: rowIds }
              },
              select: { value: true }
            });
            
            // Считаем сумму
            const sum = cells.reduce((acc, cell) => {
              const value = parseFloat(cell.value || '0');
              return isNaN(value) ? acc : acc + value;
            }, 0);
            
            summaryData[col.id] = sum;
          }
        }
        
        // Считаем общее кол-во страниц
        const pageCount = Math.ceil(totalRows / pageSize);

        return {
          success: true,
          rows,
          summaryData,
          pagination: {
            total: totalRows,
            page,
            pageSize,
            pageCount
          }
        };
      } catch (error) {
        console.error("Ошибка при получении данных таблицы:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при получении данных таблицы", 
          rows: [],
          pagination: { total: 0, page: 1, pageSize: 10, pageCount: 0 }
        };
      }
    }),

  // Создание новой таблицы
  createTable: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Название таблицы обязательно"),
      description: z.string().optional(),
      sectionId: z.number().int().positive(),
      isSearchable: z.boolean().optional(),
      hasPagination: z.boolean().optional(),
      pageSize: z.number().int().positive().optional(),
      order: z.number().int().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования раздела
        const section = await ctx.db.section.findUnique({
          where: { id: input.sectionId }
        });

        if (!section) {
          return {
            success: false,
            message: "Раздел не найден",
            table: null
          };
        }

        const newTable = await ctx.db.table.create({
          data: {
            name: input.name,
            description: input.description || "",
            sectionId: input.sectionId,
            isSearchable: input.isSearchable ?? true,
            hasPagination: input.hasPagination ?? true,
            pageSize: input.pageSize ?? 10,
            order: input.order ?? 0
          }
        });

        return { 
          success: true, 
          message: "Таблица успешно создана", 
          table: newTable 
        };
      } catch (error) {
        console.error("Ошибка при создании таблицы:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании таблицы", 
          table: null 
        };
      }
    }),

  // Обновление таблицы
  updateTable: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      name: z.string().min(1, "Название таблицы обязательно"),
      description: z.string().optional(),
      isSearchable: z.boolean().optional(),
      hasPagination: z.boolean().optional(),
      pageSize: z.number().int().positive().optional(),
      order: z.number().int().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования таблицы
        const existingTable = await ctx.db.table.findUnique({
          where: { id: input.id }
        });

        if (!existingTable) {
          return {
            success: false,
            message: "Таблица не найдена",
            table: null
          };
        }

        const updatedTable = await ctx.db.table.update({
          where: { id: input.id },
          data: {
            name: input.name,
            description: input.description || "",
            isSearchable: input.isSearchable ?? existingTable.isSearchable,
            hasPagination: input.hasPagination ?? existingTable.hasPagination,
            pageSize: input.pageSize ?? existingTable.pageSize,
            order: input.order ?? existingTable.order
          }
        });

        return { 
          success: true, 
          message: "Таблица успешно обновлена", 
          table: updatedTable 
        };
      } catch (error) {
        console.error("Ошибка при обновлении таблицы:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении таблицы", 
          table: null 
        };
      }
    }),

  // Удаление таблицы
  deleteTable: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования таблицы
        const existingTable = await ctx.db.table.findUnique({
          where: { id: input.id }
        });

        if (!existingTable) {
          return {
            success: false,
            message: "Таблица не найдена"
          };
        }

        await ctx.db.table.delete({
          where: { id: input.id }
        });

        return { 
          success: true, 
          message: "Таблица успешно удалена" 
        };
      } catch (error) {
        console.error("Ошибка при удалении таблицы:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении таблицы" 
        };
      }
    }),

  // ============ CRUD для колонок ============
  
  // Создание новой колонки в таблице
  createColumn: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Название колонки обязательно"),
      type: ColumnTypeEnum,
      tableId: z.number().int().positive(),
      width: z.number().int().optional(),
      isRequired: z.boolean().optional(),
      isFilterable: z.boolean().optional(),
      isSummable: z.boolean().optional(),
      defaultValue: z.string().optional(),
      format: z.string().optional(),
      order: z.number().int().optional(),
      options: z.any().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования таблицы
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          include: { columns: true }
        });

        if (!table) {
          return {
            success: false,
            message: "Таблица не найдена",
            column: null
          };
        }

        // Определяем порядок для новой колонки (в конец списка)
        const nextOrder = input.order ?? (
          table.columns.length > 0 
            ? Math.max(...table.columns.map(c => c.order)) + 1 
            : 0
        );

        // Создаем колонку с учетом типа и опций
        const newColumn = await ctx.db.column.create({
          data: {
            name: input.name,
            type: input.type,
            tableId: input.tableId,
            width: input.width,
            isRequired: input.isRequired ?? false,
            isFilterable: input.isFilterable ?? false,
            isSummable: input.isSummable ?? false,
            defaultValue: input.defaultValue,
            format: input.format,
            order: nextOrder,
            options: input.options ? JSON.stringify(input.options) : null
          }
        });

        // Если есть существующие строки, добавляем ячейки для новой колонки
        if (table._count?.rows > 0) {
          const rows = await ctx.db.row.findMany({
            where: { tableId: input.tableId }
          });

          // Создаем ячейки для всех строк
          await Promise.all(rows.map(row => 
            ctx.db.cell.create({
              data: {
                rowId: row.id,
                columnId: newColumn.id,
                value: input.defaultValue ?? null
              }
            })
          ));
        }

        return { 
          success: true, 
          message: "Колонка успешно создана", 
          column: newColumn 
        };
      } catch (error) {
        console.error("Ошибка при создании колонки:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании колонки", 
          column: null 
        };
      }
    }),

  // Обновление колонки
  updateColumn: publicProcedure
    .input(z.object({ 
      id: z.number().int().positive(),
      name: z.string().min(1, "Название колонки обязательно"),
      width: z.number().int().optional(),
      isRequired: z.boolean().optional(),
      isFilterable: z.boolean().optional(),
      isSummable: z.boolean().optional(),
      defaultValue: z.string().optional(),
      format: z.string().optional(),
      order: z.number().int().optional(),
      options: z.any().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования колонки
        const existingColumn = await ctx.db.column.findUnique({
          where: { id: input.id }
        });

        if (!existingColumn) {
          return {
            success: false,
            message: "Колонка не найдена",
            column: null
          };
        }

        // Обновляем колонку
        const updatedColumn = await ctx.db.column.update({
          where: { id: input.id },
          data: {
            name: input.name,
            width: input.width,
            isRequired: input.isRequired ?? existingColumn.isRequired,
            isFilterable: input.isFilterable ?? existingColumn.isFilterable,
            isSummable: input.isSummable ?? existingColumn.isSummable,
            defaultValue: input.defaultValue,
            format: input.format,
            order: input.order ?? existingColumn.order,
            options: input.options ? JSON.stringify(input.options) : existingColumn.options
          }
        });

        return { 
          success: true, 
          message: "Колонка успешно обновлена", 
          column: updatedColumn 
        };
      } catch (error) {
        console.error("Ошибка при обновлении колонки:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении колонки", 
          column: null 
        };
      }
    }),

  // Удаление колонки
  deleteColumn: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования колонки
        const existingColumn = await ctx.db.column.findUnique({
          where: { id: input.id }
        });

        if (!existingColumn) {
          return {
            success: false,
            message: "Колонка не найдена"
          };
        }

        // Удаляем колонку
        await ctx.db.column.delete({
          where: { id: input.id }
        });

        return { 
          success: true, 
          message: "Колонка успешно удалена" 
        };
      } catch (error) {
        console.error("Ошибка при удалении колонки:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении колонки" 
        };
      }
    }),

  // ============ CRUD для строк и ячеек ============
  
  // Создание новой строки в таблице
  createRow: publicProcedure
    .input(z.object({ 
      tableId: z.number().int().positive(),
      cells: z.array(z.object({
        columnId: z.number().int().positive(),
        value: z.string().optional()
      })),
      order: z.number().int().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования таблицы и получение колонок
        const table = await ctx.db.table.findUnique({
          where: { id: input.tableId },
          include: { 
            columns: true,
            rows: {
              orderBy: { order: 'desc' },
              take: 1
            }
          }
        });

        if (!table) {
          return {
            success: false,
            message: "Таблица не найдена",
            row: null
          };
        }

        // Определяем порядок для новой строки (в конец списка)
        const nextOrder = input.order ?? (
          table.rows.length > 0 
            ? table.rows[0].order + 1 
            : 0
        );

        // Создаем новую строку
        const newRow = await ctx.db.row.create({
          data: {
            tableId: input.tableId,
            order: nextOrder,
            isActive: true
          }
        });

        // Создаем ячейки для всех колонок таблицы
        const cellData = [];
        
        // Для каждой колонки таблицы
        for (const column of table.columns) {
          // Ищем значение ячейки в переданных данных
          const cellInput = input.cells.find(c => c.columnId === column.id);
          
          // Определяем значение (из входных данных или значение по умолчанию колонки)
          const value = cellInput?.value !== undefined
            ? cellInput.value
            : column.defaultValue || null;
            
          // Добавляем ячейку в список для создания
          cellData.push({
            rowId: newRow.id,
            columnId: column.id,
            value
          });
        }

        // Создаем все ячейки
        await ctx.db.cell.createMany({
          data: cellData
        });

        // Получаем созданную строку с ячейками
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

        return { 
          success: true, 
          message: "Строка успешно создана", 
          row: createdRow 
        };
      } catch (error) {
        console.error("Ошибка при создании строки:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании строки", 
          row: null 
        };
      }
    }),

  // Обновление ячеек строки
  updateCells: publicProcedure
    .input(z.object({ 
      rowId: z.number().int().positive(),
      cells: z.array(z.object({
        columnId: z.number().int().positive(),
        value: z.string().nullable()
      }))
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования строки
        const row = await ctx.db.row.findUnique({
          where: { id: input.rowId },
          include: { cells: true }
        });

        if (!row) {
          return {
            success: false,
            message: "Строка не найдена"
          };
        }

        // Обновляем все указанные ячейки
        for (const cellData of input.cells) {
          // Проверяем существует ли ячейка
          const existingCell = row.cells.find(c => c.columnId === cellData.columnId);
          
          if (existingCell) {
            // Обновляем существующую ячейку
            await ctx.db.cell.update({
              where: { id: existingCell.id },
              data: { value: cellData.value }
            });
          } else {
            // Создаем новую ячейку, если она не существует
            await ctx.db.cell.create({
              data: {
                rowId: input.rowId,
                columnId: cellData.columnId,
                value: cellData.value
              }
            });
          }
        }

        // Получаем обновленную строку с ячейками
        const updatedRow = await ctx.db.row.findUnique({
          where: { id: input.rowId },
          include: {
            cells: {
              include: {
                column: true
              }
            }
          }
        });

        return { 
          success: true, 
          message: "Ячейки успешно обновлены", 
          row: updatedRow 
        };
      } catch (error) {
        console.error("Ошибка при обновлении ячеек:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при обновлении ячеек"
        };
      }
    }),

  // Добавление комментария к ячейке
  addComment: publicProcedure
    .input(z.object({ 
      cellId: z.number().int().positive(),
      text: z.string().min(1, "Текст комментария обязателен"),
      author: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования ячейки
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

        // Создаем новый комментарий
        const newComment = await ctx.db.comment.create({
          data: {
            cellId: input.cellId,
            text: input.text,
            author: input.author
          }
        });

        return { 
          success: true, 
          message: "Комментарий успешно добавлен", 
          comment: newComment 
        };
      } catch (error) {
        console.error("Ошибка при добавлении комментария:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при добавлении комментария", 
          comment: null 
        };
      }
    }),

  // Удаление строки
  deleteRow: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования строки
        const existingRow = await ctx.db.row.findUnique({
          where: { id: input.id }
        });

        if (!existingRow) {
          return {
            success: false,
            message: "Строка не найдена"
          };
        }

        // Удаляем строку
        await ctx.db.row.delete({
          where: { id: input.id }
        });

        return { 
          success: true, 
          message: "Строка успешно удалена" 
        };
      } catch (error) {
        console.error("Ошибка при удалении строки:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении строки" 
        };
      }
    }),

  // ============ Фильтры ============
  
  // Создание фильтра для таблицы
  createFilter: publicProcedure
    .input(z.object({ 
      name: z.string().min(1, "Название фильтра обязательно"),
      tableId: z.number().int().positive(),
      columnId: z.number().int().positive(),
      operator: FilterOperatorEnum,
      value: z.string().optional(),
      secondValue: z.string().optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования таблицы и колонки
        const [table, column] = await Promise.all([
          ctx.db.table.findUnique({ where: { id: input.tableId } }),
          ctx.db.column.findUnique({ where: { id: input.columnId } })
        ]);

        if (!table) {
          return {
            success: false,
            message: "Таблица не найдена",
            filter: null
          };
        }

        if (!column) {
          return {
            success: false,
            message: "Колонка не найдена",
            filter: null
          };
        }

        if (column.tableId !== input.tableId) {
          return {
            success: false,
            message: "Колонка не принадлежит указанной таблице",
            filter: null
          };
        }

        // Создаем новый фильтр
        const newFilter = await ctx.db.filter.create({
          data: {
            name: input.name,
            tableId: input.tableId,
            columnId: input.columnId,
            operator: input.operator,
            value: input.value,
            secondValue: input.secondValue,
            isActive: input.isActive ?? true
          }
        });

        return { 
          success: true, 
          message: "Фильтр успешно создан", 
          filter: newFilter 
        };
      } catch (error) {
        console.error("Ошибка при создании фильтра:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при создании фильтра", 
          filter: null 
        };
      }
    }),

  // Удаление фильтра
  deleteFilter: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Проверка существования фильтра
        const existingFilter = await ctx.db.filter.findUnique({
          where: { id: input.id }
        });

        if (!existingFilter) {
          return {
            success: false,
            message: "Фильтр не найден"
          };
        }

        // Удаляем фильтр
        await ctx.db.filter.delete({
          where: { id: input.id }
        });

        return { 
          success: true, 
          message: "Фильтр успешно удален" 
        };
      } catch (error) {
        console.error("Ошибка при удалении фильтра:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при удалении фильтра" 
        };
      }
    }),

  // ============ Импорт/Экспорт ============
  
  // Импорт данных из файла
  importData: publicProcedure
    .input(z.object({ 
      tableId: z.number().int().positive(),
      fileContent: z.string(),
      fileType: z.enum(['csv', 'xlsx', 'xls']),
      mappings: z.record(z.string(), z.number().int().positive()),
      options: z.object({
        hasHeaderRow: z.boolean().optional(),
        delimiter: z.string().optional(),
        sheet: z.string().optional(),
        clearExistingData: z.boolean().optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { tableId, fileContent, fileType, mappings, options } = input;
        
        // Проверка существования таблицы и получение колонок
        const table = await ctx.db.table.findUnique({
          where: { id: tableId },
          include: { columns: true }
        });

        if (!table) {
          return {
            success: false,
            message: "Таблица не найдена"
          };
        }

        // Подготовка данных из файла
        let data = [];
        
        if (fileType === 'csv') {
          // Парсинг CSV
          const parseResult = parse(fileContent, {
            header: options?.hasHeaderRow ?? true,
            skipEmptyLines: true,
            delimiter: options?.delimiter || ','
          });
          
          data = parseResult.data;
        } else if (['xlsx', 'xls'].includes(fileType)) {
          // Парсинг Excel
          const workbook = XLSX.read(fileContent, { type: 'base64' });
          const sheetName = options?.sheet || workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          data = XLSX.utils.sheet_to_json(worksheet, { 
            header: options?.hasHeaderRow ? 1 : undefined 
          });
        }
        
        if (!data.length) {
          return {
            success: false,
            message: "Файл не содержит данных"
          };
        }
        
        // Если нужно очистить существующие данные
        if (options?.clearExistingData) {
          await ctx.db.row.deleteMany({
            where: { tableId }
          });
        }
        
        // Создаем строки и ячейки
        let importedCount = 0;
        let lastRowOrder = 0;
        
        // Получаем текущую максимальную позицию строки
        const lastRow = await ctx.db.row.findFirst({
          where: { tableId },
          orderBy: { order: 'desc' }
        });
        
        if (lastRow) {
          lastRowOrder = lastRow.order;
        }

        // Импортируем каждую строку из файла
        for (const item of data) {
          lastRowOrder++;
          
          // Создаем строку
          const newRow = await ctx.db.row.create({
            data: {
              tableId,
              order: lastRowOrder,
              isActive: true
            }
          });
          
          // Создаем ячейки
          const cellsToCreate = [];
          
          // Для каждого маппинга (ключ файла -> id колонки)
          for (const [fileKey, columnId] of Object.entries(mappings)) {
            // Находим колонку
            const column = table.columns.find(c => c.id === columnId);
            if (!column) continue;
            
            // Получаем значение из данных файла
            let value = item[fileKey];
            
            // Преобразуем в строку и форматируем по необходимости
            if (value !== null && value !== undefined) {
              if (column.type === 'DATE' && value instanceof Date) {
                value = value.toISOString().split('T')[0];
              } else if (column.type === 'DATETIME' && value instanceof Date) {
                value = value.toISOString();
              } else {
                value = String(value);
              }
            } else {
              value = column.defaultValue || null;
            }
            
            cellsToCreate.push({
              rowId: newRow.id,
              columnId,
              value
            });
          }
          
          // Создаем все ячейки для строки
          if (cellsToCreate.length > 0) {
            await ctx.db.cell.createMany({
              data: cellsToCreate
            });
          }
          
          importedCount++;
        }

        return { 
          success: true, 
          message: `Успешно импортировано ${importedCount} строк`,
          importedCount
        };
      } catch (error) {
        console.error("Ошибка при импорте данных:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при импорте данных"
        };
      }
    }),

  // Экспорт данных в CSV/Excel
  exportData: publicProcedure
    .input(z.object({
      tableId: z.number().int().positive(),
      format: z.enum(['csv', 'xlsx']),
      filters: z.array(z.object({
        columnId: z.number().int().positive(),
        operator: FilterOperatorEnum,
        value: z.string().optional(),
        secondValue: z.string().optional(),
      })).optional(),
      mappings: z.record(z.number().int().positive(), z.string()).optional()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const { tableId, format, filters, mappings } = input;
        
        // Получаем таблицу с колонками
        const table = await ctx.db.table.findUnique({
          where: { id: tableId },
          include: { columns: true }
        });

        if (!table) {
          return {
            success: false,
            message: "Таблица не найдена",
            data: null,
            filename: null
          };
        }

        // Получаем все строки таблицы (с применением фильтров, если они есть)
        let rowsWhere: Prisma.RowWhereInput = { tableId };
        let cellFilters: Prisma.CellWhereInput[] = [];
        
        // Применяем пользовательские фильтры
        if (filters && filters.length > 0) {
          for (const filter of filters) {
            const column = table.columns.find(col => col.id === filter.columnId);
            if (!column) continue;
            
            // Создаем фильтр для ячейки в зависимости от типа столбца и оператора
            let cellFilter: Prisma.CellWhereInput = { columnId: filter.columnId };
            
            switch (filter.operator) {
              case "EQUALS":
                cellFilter.value = filter.value;
                break;
              case "NOT_EQUALS":
                cellFilter.NOT = { value: filter.value };
                break;
              case "GREATER_THAN":
                cellFilter.value = { gt: filter.value };
                break;
              case "LESS_THAN":
                cellFilter.value = { lt: filter.value };
                break;
              case "GREATER_OR_EQUAL":
                cellFilter.value = { gte: filter.value };
                break;
              case "LESS_OR_EQUAL":
                cellFilter.value = { lte: filter.value };
                break;
              case "CONTAINS":
                cellFilter.value = { contains: filter.value, mode: 'insensitive' };
                break;
              case "NOT_CONTAINS":
                cellFilter.NOT = { value: { contains: filter.value, mode: 'insensitive' } };
                break;
              case "STARTS_WITH":
                cellFilter.value = { startsWith: filter.value, mode: 'insensitive' };
                break;
              case "ENDS_WITH":
                cellFilter.value = { endsWith: filter.value, mode: 'insensitive' };
                break;
              case "BETWEEN":
                if (filter.value && filter.secondValue) {
                  cellFilter.AND = [
                    { value: { gte: filter.value } },
                    { value: { lte: filter.secondValue } }
                  ];
                }
                break;
              case "IN_LIST":
                if (filter.value) {
                  const values = filter.value.split(',').map(v => v.trim());
                  cellFilter.value = { in: values };
                }
                break;
            }
            
            cellFilters.push(cellFilter);
          }
        }

        // Строим где-условие для строк с учетом ID ячеек, которые подходят под фильтры
        if (cellFilters.length > 0) {
          // Сначала находим ID ячеек, соответствующих фильтрам
          const filteredCells = await ctx.db.cell.findMany({
            where: { OR: cellFilters },
            select: { rowId: true }
          });
          
          const filteredRowIds = [...new Set(filteredCells.map(cell => cell.rowId))];
          
          // Если отфильтрованные строки есть - применяем фильтр по ID
          if (filteredRowIds.length > 0) {
            rowsWhere.id = { in: filteredRowIds };
          } else if (cellFilters.length > 0) {
            // Если фильтры есть, но подходящих строк нет - возвращаем пустой результат
            return {
              success: true,
              message: "Нет данных для экспорта",
              data: format === 'csv' ? '' : null,
              filename: `export_${table.name}_empty.${format}`
            };
          }
        }

        // Получаем строки с ячейками
        const rows = await ctx.db.row.findMany({
          where: rowsWhere,
          include: {
            cells: {
              include: {
                column: true
              }
            }
          },
          orderBy: { order: 'asc' }
        });

        if (rows.length === 0) {
          return {
            success: true,
            message: "Нет данных для экспорта",
            data: format === 'csv' ? '' : null,
            filename: `export_${table.name}_empty.${format}`
          };
        }

        // Подготовка данных для экспорта
        const exportData = [];
        
        for (const row of rows) {
          const rowData: Record<string, any> = {};
          
          for (const cell of row.cells) {
            const column = cell.column;
            
            // Определяем ключ для колонки (из маппинга или имя колонки)
            const columnKey = mappings && mappings[column.id] 
              ? mappings[column.id] 
              : column.name;
            
            // Определяем значение ячейки
            let value = cell.value;
            
            // Форматируем значение в зависимости от типа колонки
            if (value !== null) {
              if (column.type === 'NUMBER' || column.type === 'CURRENCY') {
                value = value ? parseFloat(value) : null;
              } else if (column.type === 'BOOLEAN') {
                value = value === 'true';
              } else if (column.type === 'DATE' || column.type === 'DATETIME') {
                if (value) {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    if (column.type === 'DATE') {
                      value = date.toISOString().split('T')[0];
                    } else {
                      value = date.toISOString();
                    }
                  }
                }
              }
            }
            
            rowData[columnKey] = value;
          }
          
          exportData.push(rowData);
        }

        // Генерируем данные в нужном формате
        let result;
        let filename = `export_${table.name}_${new Date().toISOString().slice(0, 10)}`;
        
        if (format === 'csv') {
          result = unparse(exportData, {
            quotes: true,
            header: true
          });
          filename += '.csv';
        } else { // xlsx
          // Создаем рабочую книгу
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
          
          // Конвертируем в base64
          result = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
          filename += '.xlsx';
        }

        return {
          success: true,
          message: `Экспортировано ${exportData.length} строк`,
          data: result,
          filename
        };
      } catch (error) {
        console.error("Ошибка при экспорте данных:", error);
        return { 
          success: false, 
          message: "Произошла ошибка при экспорте данных",
          data: null,
          filename: null
        };
      }
    })
});