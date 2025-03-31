// import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
// import { z } from "zod";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// // Схема для валидации запроса на генерацию таблицы
// const GenerateTableSchema = z.object({
//   description: z.string().min(5, "Опишите таблицу подробнее").max(1000, "Описание слишком длинное"),
//   purpose: z.string().min(3, "Укажите назначение таблицы").optional(),
//   tableType: z.enum(["data", "financial", "project", "inventory", "custom"]),
//   complexity: z.enum(["simple", "medium", "complex"]),
//   additionalInfo: z.string().optional(),
// });

// // Схема для валидации структуры столбца таблицы
// const ColumnStructureSchema = z.object({
//   name: z.string(),
//   type: z.enum([
//     "TEXT", "NUMBER", "DATE", "DATETIME", "BOOLEAN", 
//     "SELECT", "BUTTON", "CALCULATED", "CURRENCY", "LINK", "COMMENT"
//   ]),
//   width: z.number().optional(),
//   isRequired: z.boolean().optional(),
//   isFilterable: z.boolean().optional(),
//   isSummable: z.boolean().optional(),
//   defaultValue: z.string().optional(),
//   format: z.string().optional(),
//   options: z.any().optional(),
//   description: z.string().optional(),
// });

// // Схема для валидации сгенерированной структуры таблицы
// const TableStructureSchema = z.object({
//   name: z.string(),
//   description: z.string().optional(),
//   columns: z.array(ColumnStructureSchema),
//   sampleData: z.array(z.record(z.string(), z.any())).optional(),
// });

// export const geminiRouter = createTRPCRouter({
//   // Генерация структуры таблицы с помощью Gemini
//   generateTableStructure: publicProcedure
//     .input(GenerateTableSchema)
//     .mutation(async ({ input }) => {
//       try {
//         // Инициализация Gemini API
//         const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
//         const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

//         // Формирование промпта для Gemini
//         const prompt = `
//         Создай структуру таблицы данных на основе следующего описания:
        
//         Описание: ${input.description}
//         ${input.purpose ? `Назначение: ${input.purpose}` : ''}
//         Тип таблицы: ${input.tableType}
//         Сложность: ${input.complexity}
//         ${input.additionalInfo ? `Дополнительная информация: ${input.additionalInfo}` : ''}
        
//         Я ожидаю структурированный ответ в JSON формате, который будет содержать:
//         1. Название таблицы (name)
//         2. Описание таблицы (description)
//         3. Массив столбцов (columns) с информацией:
//            - name: название столбца
//            - type: тип данных (TEXT, NUMBER, DATE, DATETIME, BOOLEAN, SELECT, BUTTON, CALCULATED, CURRENCY, LINK, COMMENT)
//            - width: ширина столбца в пикселях (опционально)
//            - isRequired: является ли поле обязательным (true/false, опционально)
//            - isFilterable: можно ли фильтровать по полю (true/false, опционально)
//            - isSummable: нужно ли считать сумму для поля (true/false, только для числовых типов)
//            - defaultValue: значение по умолчанию (опционально)
//            - format: формат данных (например, формат даты, валюты и т.д., опционально)
//            - options: дополнительные опции (например, варианты для SELECT, формула для CALCULATED, опционально)
//            - description: описание назначения столбца (опционально)
//         4. Примеры данных (sampleData): массив с 3-5 примерами записей для таблицы, соответствующие структуре столбцов
        
//         Учти следующие правила:
//         - Для типа SELECT укажи варианты в поле options.values в виде строки со значениями через запятую
//         - Для типа CALCULATED укажи формулу в поле options.formula с использованием [имя_колонки] для ссылок на другие колонки
//         - Для типа CURRENCY укажи тип валюты в поле format (RUB, USD, EUR)
//         - Делай столбец isFilterable=true только если фильтрация по нему имеет смысл
//         - Делай столбец isSummable=true только для числовых данных (NUMBER, CURRENCY)
//         - Для дат используй формат YYYY-MM-DD
//         - Придумай логичные значения по умолчанию для соответствующих типов данных
        
//         Верни только JSON без дополнительного текста.
//         `;

//         // Отправка запроса в Gemini
//         const result = await model.generateContent(prompt);
//         const response = result.response;
//         const text = response.text();
        
//         // Парсинг JSON из ответа
//         const jsonMatch = text.match(/\{[\s\S]*\}/);
//         if (!jsonMatch) {
//           throw new Error("Не удалось получить структурированный ответ от Gemini");
//         }
        
//         const jsonStr = jsonMatch[0];
        
//         try {
//           // Парсим и валидируем полученную структуру
//           const tableStructure = JSON.parse(jsonStr);
//           const validatedStructure = TableStructureSchema.parse(tableStructure);
          
//           return {
//             success: true,
//             data: validatedStructure
//           };
//         } catch (parseError) {
//           console.error("Ошибка при парсинге JSON:", parseError);
//           throw new Error("Ошибка при обработке ответа от Gemini. Попробуйте изменить описание и повторить запрос.");
//         }
//       } catch (error) {
//         console.error("Ошибка при взаимодействии с Gemini API:", error);
//         return {
//           success: false,
//           error: error instanceof Error ? error.message : "Неизвестная ошибка при генерации структуры таблицы"
//         };
//       }
//     }),
// });