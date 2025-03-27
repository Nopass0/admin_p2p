import { useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";

interface UploadBybitTransactionsProps {
  userId: number;
  onSuccess?: () => void;
}

export function UploadBybitTransactions({ userId, onSuccess }: UploadBybitTransactionsProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    added: number;
    duplicates: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && (
      selectedFile.type === "application/vnd.ms-excel" || 
      selectedFile.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      selectedFile.name.endsWith('.xls') || 
      selectedFile.name.endsWith('.xlsx')
    )) {
      setFile(selectedFile);
      setError(null);
      setUploadResult(null);
    } else {
      setFile(null);
      setError("Пожалуйста, выберите файл Excel (.xls или .xlsx)");
    }
  };
  
  const handleUpload = async () => {
    if (!file || !userId) return;
    
    setUploading(true);
    setError(null);
    setUploadResult(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId.toString());
      
      const response = await fetch("/api/bybit/upload", {
        method: "POST",
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        setUploadResult({
          added: result.added,
          duplicates: result.duplicates
        });
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.message || "Ошибка при загрузке файла");
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Ошибка при загрузке файла. Пожалуйста, попробуйте еще раз.");
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <Card className="shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
      <CardBody className="p-4">
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
          Загрузить транзакции из файла Bybit
        </h3>
        
        <div className="flex flex-col gap-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 dark:text-red-400 rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {uploadResult && (
            <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/10 dark:text-green-400 rounded-md flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Загрузка успешна! Добавлено <strong>{uploadResult.added}</strong> новых транзакций. 
                {uploadResult.duplicates > 0 && ` Пропущено ${uploadResult.duplicates} дублирующихся записей.`}
              </span>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="col-span-2">
              <label htmlFor="bybit-file-upload" className="block text-sm font-medium mb-1 text-zinc-600 dark:text-zinc-400">
                Выберите XLS файл с транзакциями Bybit
              </label>
              <Input 
                id="bybit-file-upload"
                type="file" 
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                onChange={handleFileChange}
                disabled={uploading}
                aria-label="Выберите файл Excel с транзакциями Bybit"
              />
              {file && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Выбран файл: {file.name}
                </p>
              )}
            </div>
            
            <Button
              color="primary"
              onClick={handleUpload}
              isLoading={uploading}
              isDisabled={!file || uploading}
              className="h-10"
            >
              <Upload className="w-4 h-4 mr-2" />
              Загрузить
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}